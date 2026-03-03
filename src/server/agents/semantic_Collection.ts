// 
import neo4j from "neo4j-driver";
import { getVectorStore } from "../graph/workflow";
import { AgentState } from "../graph/state"; // Import type State của bạn
import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";
import type { TripleFact } from "../graph/state";
import { llm_summarizer } from "../lib/llm"
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";

const driver = neo4j.driver(
    process.env.NEO4J_URI ,
    neo4j.auth.basic(
        process.env.NEO4J_USERNAME , 
        process.env.NEO4J_PASSWORD 
    )
);

export const initGraphDB = async () => {
    const session = driver.session();
    try {
        console.log("🚀 Initializing Graph DB Schema...");

        // CÂU LỆNH QUAN TRỌNG:
        // "IF NOT EXISTS": Chỉ tạo nếu chưa có, chạy lại nhiều lần không sao.
        // Đảm bảo node có label :Entity thì property 'name' phải là DUY NHẤT.
        const constraintQuery = `
            CREATE CONSTRAINT entity_name_unique IF NOT EXISTS
            FOR (e:Entity)
            REQUIRE e.name IS UNIQUE
        `;

        await session.run(constraintQuery);
        console.log("✅ Graph DB Constraint ensured: Entity.name is UNIQUE");

        // (Tùy chọn) Tạo Index cho Context để search nhanh hơn sau này
        // await session.run("CREATE INDEX rel_context_index IF NOT EXISTS FOR ()-[r:RELATIONSHIP]-() ON (r.context)");

    } catch (error) {
        console.error("❌ Failed to initialize Graph DB:", error);
    } finally {
        await session.close();
    }
};

// ==============================================================
const FactTripleSchema = z.object({
  subject: z.string().describe("The entity (e.g., 'User', 'Ece')."),
  predicate: z.string().describe("The relationship (e.g., 'is a', 'lives in')."),
  object: z.string().describe("The target value (e.g., 'team member', 'Hanoi')."),
  context: z.string().optional().describe("Crucial details that don't fit in S-P-O (e.g., 'AI team', 'when raining', 'since 2020')."),
});

const ExtractionListSchema = z.object({
  facts: z.array(FactTripleSchema),
});


export const searchMemoryNode = async (state: typeof AgentState.State, config: any) => {
    const rawInput = state.messages[state.messages.length - 1].content as string;
    const userId = config.configurable?.userId || "default_user";

    // =============== Extracting. ==================================================================
    
    const structuredLLM = llm_summarizer.withStructuredOutput(ExtractionListSchema);

    // Prompt dạy AI cách dùng Context
    const systemPrompt = `
    You are a Fact Extractor. Extract atomic facts from user input.

    ### RULES:
    1. **Context Usage:** Use 'context' for specific scopes, conditions, or timeframes.
        - Input: "Ece is in the AI team."
        - ✅ (Ece, is member of, team, context="AI team")
        - ❌ (Ece, is member of, AI team, context=null) -> (Object quá dài)
    
    2. **Active Voice Preference:** Always convert passive voice to active voice.
            - ❌ BAD: (Peanuts, cause allergy to, User)
            - ✅ GOOD: (User, is allergic to, Peanuts)

    3. **User-Centric:** If the fact involves the User, make "User" the SUBJECT.
        - ❌ BAD: (Late classes, force, User to cook late)
        - ✅ GOOD: (User, cooks late, because of late classes)

    4. **Split Distinct Concepts:** Only split if they are truly different facts.
        - "I run and swim" -> [(User, runs), (User, swims)] (Allowed).

    ### EXAMPLES:
    Input: "I usually cook at 6pm if I have time."
    Output: { "facts": [{ "subject": "User", "predicate": "cooks", "object": "dinner", "context": "at 6pm, if has time" }] }

    Input: "Yaz leads the AI team."
    Output: { "facts": [{ "subject": "Yaz", "predicate": "leads", "object": "team", "context": "AI department" }] }
    `;

    await dispatchCustomEvent(
        "node_progress", // Tên sự kiện (bạn tự đặt)
        { message: `Extracting facts for semantic memory...` }, 
        config 
    );

    const result = await structuredLLM.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(rawInput)
    ]);

    const facts: TripleFact[] = result.facts || [];
    
    // Fallback
    if (facts.length === 0) {
        facts.push({ subject: "User", predicate: "query", object: rawInput });
    }

    console.log(`Response Extracted Facts:\n ${JSON.stringify(facts, null, 2)}`);
    console.log("------>>");
    // =================================================================================
    const vectorStore = await getVectorStore();
    
    const searchPromises = facts.map(async (fact) => {
        // Kỹ thuật ghép chuỗi: Nối context vào cuối để tăng độ chính xác vector
        // Ví dụ: "Ece is member of team AI department"
        const query = `${fact.subject} ${fact.predicate} ${fact.object} ${fact.context || ''}`.trim();
        
        console.log(`🔍 Searching Atom: "${query}"`);
        
        return vectorStore.similaritySearch(
            query, 
            3, 
            { userId: userId, doc_type: "semantic_triple" }
        );
    });

    const resultsArray = await Promise.all(searchPromises);
    
    // --- KHỬ TRÙNG LẶP & FORMAT ---
    const uniqueDocsMap = new Map<string, Document>();
    resultsArray.flat().forEach((doc) => {
        if (doc.metadata.id && !uniqueDocsMap.has(doc.metadata.id)) {
            uniqueDocsMap.set(doc.metadata.id, doc);
        }
    });

    const finalUniqueResults = Array.from(uniqueDocsMap.values());
    
    // Format kết quả trả về cũng phải hiển thị Context cho ManageNode thấy
    const structuredResults = finalUniqueResults.map(r => {
        // Giả sử lúc lưu bạn đã lưu context vào metadata
        const meta = r.metadata;
        const contextStr = meta.context ? ` (Context: ${meta.context})` : "";
        
        return {
            id: meta.id,
            text_representation: `[${meta.subject}] ${meta.predicate} [${meta.object}]${contextStr}`
        };
    });
    
    console.log(`Response Searched Memory:\n ${JSON.stringify(structuredResults, null, 2)}`);
    console.log("------>>");
    // Trích xuất Entity Names để làm khóa tìm kiếm trong Graph
    // (Chúng ta giả định metadata.subject và object đã được chuẩn hóa)
    const entryEntities = new Set<string>();
    finalUniqueResults.forEach(doc => {
        if (doc.metadata.subject) entryEntities.add(doc.metadata.subject);
        if (doc.metadata.object) entryEntities.add(doc.metadata.object);
    });
    const entitiesArray = Array.from(entryEntities);

    console.log(`Entities List from searched memory:\n ${entitiesArray}`);
    console.log("------>>");

    // =================================================================================
    // BƯỚC 2: GRAPH TRAVERSAL (PROPERTY GRAPH EXPANSION)
    // =================================================================================
    await dispatchCustomEvent(
        "node_progress", // Tên sự kiện (bạn tự đặt)
        { message: `Extracting the user's past experience...` }, 
        config 
    );
    let graphConnections: string[] = []; // Mảng chứa các quan hệ tìm được
        const session = driver.session(); 

        try {
            if (entitiesArray.length > 0) {

                const cypherQuery = `
                    MATCH (n:Entity)-[r]-(m:Entity)
                    WHERE n.name IN $entities
                    
                    // Đảm bảo không lấy chính nó
                    AND n <> m
                    
                    // QUAN TRỌNG: Lấy đúng chiều gốc của cạnh (start -> end)
                    // Dù ta match 2 chiều (-[r]-), nhưng khi return ta lấy startNode(r)
                    RETURN 
                        startNode(r).name AS source, 
                        type(r) AS rel_type, 
                        properties(r) AS rel_props, 
                        endNode(r).name AS target
                    LIMIT 30
                `;

                const result = await session.run(cypherQuery, { entities: entitiesArray });
                
                const relationships = result.records.map(record => {
                    const source = record.get("source");
                    const relType = record.get("rel_type");
                    const target = record.get("target");
                    const props = record.get("rel_props"); 
                    if (props.updated_at) {
                        delete props.updated_at;
                    }
                    // Format properties thành JSON string
                    const propsString = Object.keys(props).length > 0 
                        ? ` ${JSON.stringify(props)}` 
                        : "";

                    // Format chuẩn: (Source) -[REL {props}]-> (Target)
                    return `(${source}) -[${relType}${propsString}]-> (${target})`;
                });

                if (relationships.length > 0) {
                    // Deduplicate và lưu vào mảng
                    graphConnections = Array.from(new Set(relationships));
                    console.log(`🕸️ Graph found ${graphConnections.length} connections.`);
                }
            }
        } catch (error) {
            console.error("❌ Graph DB Error:", error);
            // Có thể push một string lỗi vào mảng graph nếu muốn UI hiển thị lỗi
            graphConnections.push(`Error: Graph DB unavailable.`);
        } finally {
            await session.close();
        }

    // =================================================================================
    // BƯỚC 3: SYNTHESIZE & RETURN (HỢP NHẤT KẾT QUẢ)
    // =================================================================================
    console.log(`Searched graph DB:\n ${JSON.stringify(graphConnections, null, 2)}`);
    console.log("------>>");
    return {
        searchResults: structuredResults,
        proposed_facts: facts,
        graphContext: graphConnections
    };
};




// ===============================================================================
// ========================= UPDATE MEM ===========================================

const OperationSchema = z.object({
  action: z.enum(["CREATE", "UPDATE", "DELETE"]).describe("The action to perform."),
  existing_memory_id: z.string().optional().describe("REQUIRED for UPDATE/DELETE. The UUID of the existing memory to modify. Must match exactly from the Context."),
  // Chúng ta yêu cầu LLM tự ghép Subject-Predicate-Object thành 1 câu hoàn chỉnh vào đây
  // content: z.string().optional().describe("REQUIRED for CREATE/UPDATE. Format: 'Subject Predicate Object (Context)'. E.g., 'User is allergic to Peanuts (Severe)'"),
  use_proposed_fact_index: z.number().optional().describe("The index number of the 'PROPOSED FACT' to apply. Required for CREATE and UPDATE."),
});

const MemoryResponseSchema = z.object({
  operations: z.array(OperationSchema),
});


export const extractTripleFromText = (text: string) => {
    // Regex giải thích:
    // ^\[(.*?)\]    -> Bắt đầu bằng "[", lấy mọi thứ ở giữa (Subject), đóng "]"
    // \s+(.*?)\s+   -> Khoảng trắng, lấy mọi thứ (Predicate) cho đến khi gặp...
    // \[(.*?)\]     -> ...cái "[", lấy mọi thứ ở giữa (Object), đóng "]"
    // (?: \(Context: (.*)\))? -> (Tùy chọn) Nếu có "(Context: ...)", lấy nội dung bên trong
    const regex = /^\[(.*?)\]\s+(.*?)\s+\[(.*?)\](?: \(Context: (.*)\))?$/;

    const match = text.match(regex);

    if (match) {
        return {
            subject: match[1],   // Group 1
            predicate: match[2], // Group 2
            object: match[3],    // Group 3
            context: match[4] || undefined // Group 4 (có thể undefined)
        };
    }
    return null; // Trả về null nếu format không khớp
};

export const manageMemNode = async (state: typeof AgentState.State, config: any) => {
    const userId = config.configurable?.userId || "default_user";
    
    // 1. LẤY DATA TỪ STATE
    const existingMemories = state.searchResults || []; // Ký ức cũ tìm thấy trong DB
    const proposedFacts = state.proposed_facts || [];   // Triple mới toanh từ Search Node
    const graphRels = state.graphContext || [];
    const formattedGraphContext = graphRels.join("\n");
    console.log("=========================================================");
    console.log("==================== MANAGE MEM NODE ====================");
    console.log("=========================================================");
    console.log(`Previous searched graph DB:\n ${formattedGraphContext}`);
    console.log("------>>");
    // Nếu không có triple nào được extract từ search node, thì nghỉ khỏe
    if (proposedFacts.length === 0) {
        return { messages: [new SystemMessage("No new facts detected to process.")] };
    }

    // 2. TẠO CONTEXT CHO LLM
    // Liệt kê Ký ức cũ
    const existingContext = existingMemories.map((m, i) => 
        `[ID: ${m.id}] ${m.text_representation}`
    ).join("\n");

    // Liệt kê Triple mới (đánh số index để LLM chọn)
    const proposedContext = proposedFacts.map((f, i) => 
        `[INDEX: ${i}] ${f.subject} -> ${f.predicate} -> ${f.object} ${f.context ? `(Context: ${f.context})` : ''}`
    ).join("\n");

    // 3. SYSTEM PROMPT
    const prompt = `
    You are a Memory Controller. Map "PROPOSED FACTS" to actions on "EXISTING MEMORIES".

    ### INPUT DATA:
    
    --- EXISTING MEMORIES (In Database) ---
    ${existingContext || "None"}

    --- PROPOSED FACTS (Extracted from User Input) ---
    ${proposedContext}

    ### ADDITIONAL LOGICAL GRAPH MEMORIES:
    ${formattedGraphContext || "None"}

    ### INSTRUCTIONS:
    For EACH "PROPOSED FACT" (by Index), decide an action:
    
    1. **CREATE**: If it's new info.
       - action: "CREATE"
       - use_proposed_fact_index: [Index number]
    
    2. **UPDATE**: If it corrects/updates an EXISTING memory.
       - action: "UPDATE"
       - existing_memory_id: [UUID of existing memory]
       - use_proposed_fact_index: [Index number of the new info]

    3. **DELETE**: If a proposed fact explicitly contradicts an old one (e.g., "I don't like X anymore").
       - action: "DELETE"
       - existing_memory_id: [UUID to delete]
       - (No need for proposed index)
    
    4. **IGNORE**: If the fact is already exactly stored in Existing Memories (Duplicate).

    Output the JSON list of operations.
    `;

    // 4. GỌI LLM
    const memoryLLM = new ChatOllama({ model: "llama3.1:8b", temperature: 0 });
    const structuredLLM = memoryLLM.withStructuredOutput(MemoryResponseSchema);
    
    const response = await structuredLLM.invoke([ new SystemMessage(prompt) ]);

    // 5. THỰC THI (RESOLVE INDEX -> TRIPLE)
    const executionLogs: string[] = [];

    console.log(`Response manageNode:\n ${JSON.stringify(response.operations, null, 2)}`);
    console.log("------>>");
    if (response.operations) {
        for (const op of response.operations) {
            
            // Bước quan trọng: Lấy lại Triple gốc từ mảng dựa vào Index
            let tripleData = null;
            if (typeof op.use_proposed_fact_index === 'number') {
                tripleData = proposedFacts[op.use_proposed_fact_index];
            }


            // 2. LẤY TRIPLE CŨ (Từ state.searchResults - dùng cho DELETE/UPDATE)
            let oldTripleData = null;
            if (op.existing_memory_id) {
                // Tìm trong mảng kết quả search có sẵn
                const existingMem = state.searchResults.find(m => m.id === op.existing_memory_id);
                
                if (existingMem && existingMem.text_representation) {
                    // PARSE TEXT RA OBJECT
                    oldTripleData = extractTripleFromText(existingMem.text_representation);
                    console.log(`🧩 Extracted OLD triple from text:`, oldTripleData);
                }
            }

            // Gọi hàm execute (đã sửa nhẹ để nhận tripleData trực tiếp)
            // Lưu ý: Ta truyền tripleData đã có sẵn, không bắt LLM sinh ra

            const log = await executeMemoryOperation({
                action: op.action,
                id: op.existing_memory_id,
                newData: tripleData,  // Dữ liệu để tạo mới
                oldData: oldTripleData
            }, userId);
            
            executionLogs.push(log);
        }
    }

    return { messages: [new SystemMessage(`Memory Sync: ${executionLogs.join(", ")}`)] };
};

export const saveToGraphDB = async (triple: { subject: string; predicate: string; object: string; context?: string }) => {
    const session = driver.session();
    // await session.close();

    try {
        // 1. Chuẩn hóa Predicate (Mối quan hệ)
        // Neo4j Relationship Type không được chứa khoảng trắng và nên viết hoa
        // VD: "lives in" -> "LIVES_IN"
        const cleanPredicate = triple.predicate
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, "_"); // Chỉ giữ lại chữ, số và gạch dưới

        // 2. Chuẩn bị Properties cho Mối quan hệ (Context)
        // Chúng ta lưu context vào edge để query sau này
        const relProps = triple.context ? { context: triple.context } : {};

        // 3. CÂU LỆNH CYPHER (WRITE)
        // Lưu ý: Neo4j không cho truyền Type qua tham số $param, nên phải dùng template string `${}` 
        // (Cần cẩn thận injection nếu predicate đến từ nguồn không tin cậy, nhưng ở đây từ LLM thì tạm ổn)
        const cypher = `
            MERGE (s:Entity {name: $subject})
            MERGE (o:Entity {name: $object})
            
            // Tạo mối quan hệ giữa chúng
            // MERGE đảm bảo không tạo 2 cạnh giống hệt nhau
            MERGE (s)-[r:${cleanPredicate}]->(o)
            
            // Cập nhật thuộc tính context nếu có
            SET r += $props, r.updated_at = datetime()
        `;

        await session.run(cypher, {
            subject: triple.subject,
            object: triple.object,
            props: relProps
        });
        // await session.executeWrite(async (tx) => {
        //     await tx.run(cypher, {
        //         subject: triple.subject,
        //         object: triple.object,
        //         props: relProps
        //     });
        // });

        console.log(`✅ Saved to Neo4j: (${triple.subject}) -[${cleanPredicate}]-> (${triple.object})`);

    } catch (error) {
        console.error("❌ Failed to save to Graph DB:", error);
    } finally {
        await session.close();
    }
};

// Hàm xóa cạnh (Dùng khi action là DELETE)
export const deleteFromGraphDB = async (triple: { subject: string; predicate: string; object: string }) => {
     const session = driver.session();
     try {
         const cleanPredicate = triple.predicate.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
         const cypher = `
            MATCH (s:Entity {name: $subject})-[r:${cleanPredicate}]->(o:Entity {name: $object})
            DELETE r
         `;
         await session.run(cypher, { subject: triple.subject, object: triple.object });
         console.log(`🗑️ Deleted relation from Neo4j`);
     } finally {
         await session.close();
     }
}

async function executeMemoryOperation(params: { action: string, id?: string, newData?: TripleFact, oldData?: TripleFact }, userId: string) {
    const vectorStore = await getVectorStore();
    const { action, id, newData, oldData } = params;

    try {
        console.log("------================>>");
        // --- LOGIC ĐỒNG BỘ SANG GRAPH DB (NEO4J) ---
        console.log(`Action: ${action}, ID: ${id}, New Data: ${JSON.stringify(newData, null, 2)}, Old Data: ${JSON.stringify(oldData, null, 2)}`);
        
        if (action === "DELETE" && oldData) {
            console.log(1)
            // Xóa khỏi Graph (Fire & Forget - không cần await nếu muốn nhanh)
            deleteFromGraphDB(oldData).catch(e => console.error(e));
        } 
        else if ((action === "CREATE" || action === "UPDATE") && newData) {
            console.log(2)
            // Lưu vào Graph
            saveToGraphDB(newData).catch(e => console.error(e));
        }


        if (action === "DELETE" && id) {
             await vectorStore.delete({ ids: [id] });
             return `🗑️ DELETED ${id}`;
        }

        if ((action === "CREATE" || action === "UPDATE") && newData) {
            // Tái tạo nội dung từ Object data có sẵn (không phải do LLM bịa)
            const contentString = `${newData.subject} ${newData.predicate} ${newData.object} ${newData.context || ''}`.trim();
            const docId = (action === "UPDATE" && id) ? id : uuidv4();

            if (action === "UPDATE") { try { 
              console.log("Deleting old memory: ", docId);
              await vectorStore.delete({ ids: [docId] }); 
            
            } catch(e){} }

            await vectorStore.addDocuments([new Document({
                pageContent: contentString,
                metadata: {
                    id: docId,
                    userId,
                    doc_type: "semantic_triple",
                    // Save full struct
                    subject: newData.subject,
                    predicate: newData.predicate,
                    object: newData.object,
                    context: newData.context
                }
            })], { ids: [docId] });

            return `✅ ${action} [${newData.subject} ${newData.predicate}...]`;
        }

        return `⚠️ SKIPPED ${action}`;
    } catch (e) {
        return `❌ Error: ${e}`;
    }
}