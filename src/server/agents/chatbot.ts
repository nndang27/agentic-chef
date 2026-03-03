// src/nodes/generalAssistant.ts
import { SystemMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { AgentState } from "../graph/state";
import { llm_chatbot } from "../lib/llm";
import { DEFAULT_PROFILE } from "../memory/userProfile";
import { getVectorStore } from "../graph/workflow";
import { UserProfileService } from "../memory/userProfile";

export const generalChatNode = async (state: typeof AgentState.State, config: any) => {
    console.time("⏱️ generalChatNode time");
    // 1. Lấy User Profile (Giữ nguyên logic cũ)
    let memoryContextString = "No memory context available.";
    console.log("state.isMemoryMode: ", state.isMemoryMode)
    if (state.isMemoryMode) {
            try {
                // A. User Profile
                const userId = config.configurable?.user_id || "default_user";
                console.log("userId: ", userId)
                const userProfile = await UserProfileService.getProfile(userId);
                console.log("userProfile: ", userProfile)
                // B. Graph Context (Từ node search_memory)
                const graphContext = state.graphContext || [];

                // C. Đóng gói JSON
                memoryContextString = JSON.stringify({
                    user_profile: userProfile,
                    relevant_past_interactions: graphContext
                }, null, 2);
                
            } catch (err) {
                console.error("⚠️ GeneralChat failed to load memory:", err);
            }
    }


    // 2. Lấy câu hỏi gốc của người dùng (Last Human Message)
    const messages = state.messages;
    const lastUserMessage = messages.slice().reverse().find((msg) => msg._getType() === "human");
    const userPrompt = lastUserMessage ? lastUserMessage.content : "No prompt found";

    // ------ Lấy ra 3 tin nhắn human gần nhất không tính tin nắhn cuối cùng ----
    let recentUserHistory = "No memory context available.";
    if (state.isMemoryMode) {

        const allHumanMessages = messages.filter(msg => msg._getType() === "human");
        const historyCandidates = allHumanMessages.slice(0, -1);
        recentUserHistory = historyCandidates.slice(-3).map(m => m.content).join(" | ");

    }

    // ------------------------------------------------------------------------

    // 3. Thu thập Context từ các Agent đã chạy
    // Chúng ta tạo một object chứa kết quả để nạp vào prompt
    const executionContext: any = {};
    const activeAgents = state.next_active_agents || []; // List các agent đã chạy, vd: ["SEARCH_RECIPE", "SEARCH_PRICE"]

    console.log("🔍 Collecting context from agents:", activeAgents);

    // --- CASE: SEARCH_RECIPE ---
    if (activeAgents.includes("SEARCH_RECIPE")) {
        executionContext["RECIPE_RESULT"] = {
            status: "Executed",
            dish_name: state.current_dish,
            data: state.recipesList && state.recipesList.length > 0 
                ? state.recipesList.map(r => ({ title: r.title, ingredients: r.ingredients, steps_summary: `Has ${r.steps.length} steps` })) 
                : "No recipe found."
        };
    }

    // --- CASE: SEARCH_VIDEO ---
    if (activeAgents.includes("SEARCH_VIDEO")) {
        console.log("***&%$^state.videoUrl: ", state.videoUrl)
        executionContext["VIDEO_RESULT"] = {
            status: "Executed",
            search_query: state.current_dish_video,
            video_url: state.videoUrl.url ? state.videoUrl.url : "No video URL found."
        };
    }

    // --- CASE: SEARCH_PRICE ---
    if (activeAgents.includes("SEARCH_PRICE")) {
        executionContext["PRICE_RESULT"] = {
            status: "Executed",
            ingredients_to_check: state.cached_ingredients,
            price_data: state.ingredientPriceList // List giá cả
        };
    }

    // --- CASE: SEARCH_MAP ---
    if (activeAgents.includes("SEARCH_MAP")) {
        if(state.optimized_route_map===null){
            executionContext["MAP_RESULT"] = {
                status: "Failed",
                origin: state.current_origin_address?.addressName || "Unknown origin", 
                destination: state.current_destination_address?.addressName || "Unknown destination",
                brand: state.brand_preference,
            // Có thể thêm state.optimized_route_map nếu agent Map trả về kết quả cụ thể
            };
        }
        else{
            // Lưu ý: Check kỹ chính tả addressName hay adressName trong state của bạn
            executionContext["MAP_RESULT"] = {
                status: "Executed",
                origin: state.current_origin_address?.addressName || "Unknown origin", 
                destination: state.current_destination_address?.addressName || "Unknown destination",
                brand: state.brand_preference,
                // Có thể thêm state.optimized_route_map nếu agent Map trả về kết quả cụ thể
            };
        }
    }

    // --- CASE: GENERAL_CHAT (Tư vấn/Small talk) ---
    if (activeAgents.includes("GENERAL_CHAT")) {
        executionContext["CONSULTATION_CONTEXT"] = {
            type: state.general_chat_type, // 'consultation', 'greeting', etc.
            // guideline: state.general_response_guideline
        };
    }
    // ### USER PROFILE (MEMORY):
    // ${JSON.stringify(current_profile, null, 2)}
    // 4. Xây dựng Prompt tổng hợp
    console.log("memoryContextString: ", memoryContextString);
    const systemPrompt = `
        You are a smart, friendly, and personalized Cooking Assistant named "Chef bot".
        Your goal is to analyze User Input + Tool Results + (Optional) Memory + (Optional) Recent Chat History to provide a helpful, natural response.

        ### 🧠 MEMORY & CONTEXT (Use this to personalize):
        ${memoryContextString}

        ### RECENT CHAT HISTORY (Last 3 inputs for context):
        ${recentUserHistory ? recentUserHistory : "No previous history."}
             
        ### 🛠️ EXECUTION CONTEXT (Data found by tools):
        ${JSON.stringify(executionContext, null, 2)}

        ### INSTRUCTIONS:
        1. **Synthesize**: Combine "EXECUTION CONTEXT" to form a complete answer.
        - **RECIPE**: Mention dish name & key ingredients. Ask if they want full steps.
        - **VIDEO**: Provide the URL explicitly: "Here is a video guide: [URL]".
        - **PRICE**: Summarize total cost.
        - **MAP**: Mention location/brand.
        - **GENERAL_CHAT**: If no tools ran, just chat naturally based on Memory.

        2. **Personalization (CRITICAL)**: 
        - If **User Profile** exists: Check **Allergies** and **Diet** immediately. WARN the user if the found recipe violates their diet (e.g., "Note: This recipe contains peanuts, which you are allergic to.").
        - If **Past Interactions** exist: Reference them naturally (e.g., "Unlike the chicken dish you had yesterday, this one is...").

        3. **Tone**: Helpful, encouraging, concise. 
        - Do NOT mention "JSON", "Agents", "Schema", or "Tools". 
        - Talk like a human friend.

        4. **Missing Data**: If a tool ran but returned null/"No found", politely inform the user.

        Answer the user's input below based on this context.
        `;

    console.log("==========================================");
    console.log("📝 GENERATING FINAL RESPONSE...");
    // console.log("System Prompt Preview:", systemPrompt);
    // console.log("==========================================");
  

    // 5. Gọi LLM
    const inputs = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt) // Dùng tin nhắn gốc của user để LLM biết ngữ cảnh hỏi
    ];
    console.log("inputs: ", inputs);
    const response = await llm_chatbot.invoke(inputs);

    console.log("🤖 CHAT BOT RESPONSE:", response.content);
    console.timeEnd("⏱️ generalChatNode time");
    
    return { 
        messages: [new AIMessage(response.content)],
        finished_branches: ["general_chat_done"]
     };
};