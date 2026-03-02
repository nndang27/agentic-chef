// src/server/agent/workflow.ts

import { StateGraph, END, START } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
// import { trimMessages } from "@langchain/core/messages/utils";
import { trimMessages } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
// import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { embeddingsLLM } from "../lib/llm";
import { Pool } from "pg"; // Checkpointer CẦN driver 'pg' chuẩn
import { AgentState } from "./state";
// import { supervisorNode } from "../agents/supervisor";
import { tiktokAgentNode } from "../agents/search_Video";
import { generalChatNode } from "../agents/chatbot";
import { UserProfileService } from "../memory/userProfile";
import { updateProfileTool } from "../tools/profileTools";
import { semantic_memoryAgentNode } from "../agents/semantic_userProfile";
import { summarizeConversationNode } from "../agents/summarize_message";
import { OllamaEmbeddings } from "@langchain/ollama";
import { manageMemNode, searchMemoryNode } from "../agents/semantic_Collection";
import { recipeAgentNode } from "../agents/search_Recipe";
import { orchestratorNode } from "../agents/orchestrator";
import { searchMapNode } from "../agents/search_Map";
import { searchPriceAgentNode } from "../agents/search_Price";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
if (!process.env.POSTGRES_URL) {
  throw new Error("❌ POSTGRES_URL chưa được load. Kiểm tra lại file .env");
}

const globalForPool = globalThis as unknown as { pgPool: Pool };
const pool = globalForPool.pgPool || new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false,
  },
});

if (process.env.NODE_ENV !== "production") globalForPool.pgPool = pool;

const checkpointer = new PostgresSaver(pool);

// const store = new PostgresStore(pool);

const vectorStoreConfig = {
  postgresConnectionOptions: {
    connectionString: process.env.POSTGRES_URL,
  },
  tableName: "semantic_memories", // Tên bảng lưu vector
  columns: {
    idColumnName: "id",
    vectorColumnName: "embedding",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
};

// Hàm helper để lấy instance của VectorStore nhanh
export const getVectorStore = async () => {
  return await PGVectorStore.initialize(
    embeddingsLLM,
    vectorStoreConfig
  );
};

// await setupAgentDB();
// =======================================================================================================
// --- 3. NODE: Mark Memory Done ---
const markMemoryDoneNode = async () => {
  return { finished_branches: ["memory_done"] };
};
// Node này thực ra không làm gì cả, chỉ là điểm tập kết
const barrierNode = async (state: typeof AgentState.State) => {
  console.log("🛑 Barrier checking:", state.finished_branches);
  return {};
};

const checkBarrierCondition = (state: typeof AgentState.State) => {
  const signals = state.finished_branches || [];
  const hasSupervisor = signals.includes("supervisor_done");
  const hasMemory = signals.includes("memory_done");

  if (hasSupervisor && hasMemory) {
    console.log("🚀 All branches done! Starting General Assistant.");
    const action = state.router_decision?.next_action;

    return "general_assistant";
  }

  console.log("⏳ Waiting for other branch...");
  return "END";
};

const hasAction = (actions, actionName) => {
  if (actions instanceof Set) return actions.has(actionName);
  if (Array.isArray(actions)) return actions.includes(actionName);
  return false;
};


// --- 4. KHỞI TẠO GRAPH ---
const workflow = new StateGraph(AgentState);
// ------ Define Node --------
// const resetNode = async () => ({ finished_branches: ["RESET"] });
// workflow.addNode("reset_state", resetNode);
// workflow.addNode("supervisor", supervisorNode);
// workflow.addNode("general_assistant", generalAssistantNode);
// workflow.addNode("barrier", barrierNode);
// workflow.addNode("load_update_memory", semantic_memoryAgentNode);
// workflow.addNode("summarize_conversation", summarizeConversationNode);
// workflow.addNode("manage_memory", manageMemNode);
// workflow.addNode("search_memory", searchMemoryNode);

// workflow.addEdge(START, "reset_state");
// workflow.addEdge("reset_state", "load_update_memory");
// workflow.addEdge("reset_state", "supervisor");

// workflow.addEdge("load_update_memory", "search_memory");
// workflow.addEdge("search_memory", "manage_memory");
// workflow.addEdge("manage_memory", "orchestrator");

// workflow.addEdge("supervisor", "barrier");

// // 4. Node Barrier và Chốt chặn cuối cùng
// workflow.addConditionalEdges(
//     "barrier",
//     checkBarrierCondition,
//     {
//         general_assistant: "general_assistant", // Chỉ chạy khi đủ cả 2
//         END: END // Dừng nếu chưa đủ
//     }
// );


// workflow.addEdge("general_assistant", "summarize_conversation");
// workflow.addEdge("summarize_conversation", END);

// --- THÊM CÁC NODE MEMORY ---
workflow.addNode("load_update_memory", semantic_memoryAgentNode);
workflow.addNode("summarize_conversation", summarizeConversationNode);
workflow.addNode("manage_memory", manageMemNode);
workflow.addNode("search_memory", searchMemoryNode);

// ------ Các ndoe chính --------
workflow.addNode("orchestrator", orchestratorNode);
workflow.addNode("search_video", tiktokAgentNode);     // Ưu tiên 1
workflow.addNode("search_map", searchMapNode);         // Ưu tiên 2
workflow.addNode("search_recipe", recipeAgentNode);    // Ưu tiên 3
workflow.addNode("search_price", searchPriceAgentNode);// Ưu tiên 4
workflow.addNode("general_chat", generalChatNode);
// 2. Bắt đầu từ Orchestrator
// workflow.addEdge(START, "orchestrator");
workflow.addConditionalEdges(
  START,
  (state) => {
    // Nếu bật Memory Mode -> Vào luồng Memory
    
    if (state.isMemoryMode) {
      return "load_update_memory";
    }

    // Nếu tắt -> Vào thẳng Orchestrator như cũ
    return "orchestrator";
  },
  {
    load_update_memory: "load_update_memory",
    orchestrator: "orchestrator"
  }
);

// 🔗 LUỒNG MEMORY (CHẠY TUẦN TỰ TRƯỚC ORCHESTRATOR)
workflow.addEdge("load_update_memory", "search_memory");
workflow.addEdge("search_memory", "manage_memory");
workflow.addEdge("manage_memory", "orchestrator");

// --- BƯỚC 1: Sau Orchestrator ---
// Kiểm tra từ đầu danh sách ưu tiên
workflow.addConditionalEdges(
  "orchestrator",
  (state) => {
    const actions = state.next_active_agents;
    console.log("actions: ", actions)
    // Ưu tiên cao nhất: VIDEO
    if (hasAction(actions, "SEARCH_VIDEO")) return "search_video";
    
    // Nếu không có Video, check tiếp Map
    if (hasAction(actions, "SEARCH_MAP")) return "search_map";
    
    // Nếu không có Map, check tiếp Recipe
    if (hasAction(actions, "SEARCH_RECIPE")) return "search_recipe";
    
    // Nếu không có Recipe, check tiếp Price
    if (hasAction(actions, "SEARCH_PRICE")) return "search_price";

    if (hasAction(actions, "GENERAL_CHAT")){ 
      console.log("general_chat");
      return "general_chat";}
    if(actions.length === 0) return "general_chat";
    return "general_chat";
  },
  { 
    search_video: "search_video", 
    search_map: "search_map", 
    search_recipe: "search_recipe", 
    search_price: "search_price", 
    general_chat: "general_chat",
  }
);

// --- BƯỚC 2: Sau SEARCH_VIDEO ---
// Video chạy xong -> Check tiếp Map, Recipe, Price
workflow.addConditionalEdges(
  "search_video",
  (state) => {
    const actions = state.next_active_agents;
    
    // Video xong thì xem có Map không?
    if (hasAction(actions, "SEARCH_MAP")) return "search_map";
    
    // Không có Map thì xem có Recipe không?
    if (hasAction(actions, "SEARCH_RECIPE")) return "search_recipe";
    
    // Không có Recipe thì xem có Price không?
    if (hasAction(actions, "SEARCH_PRICE")) return "search_price";

    if (hasAction(actions, "GENERAL_CHAT")) return "general_chat";
    
    return "general_chat";
  },
  { search_map: "search_map", search_recipe: "search_recipe", search_price: "search_price", general_chat: "general_chat" }
);

// --- BƯỚC 3: Sau SEARCH_MAP ---
// Map chạy xong -> Check tiếp Recipe, Price (Bỏ qua Video vì Video priority cao hơn nên đã chạy rồi hoặc không có)
workflow.addConditionalEdges(
  "search_map",
  (state) => {
    const actions = state.next_active_agents;
    
    if (hasAction(actions, "SEARCH_RECIPE")) return "search_recipe";
    if (hasAction(actions, "SEARCH_PRICE")) return "search_price";

    if (hasAction(actions, "GENERAL_CHAT")) return "general_chat";
    
    return "general_chat";
  },
  { search_recipe: "search_recipe", search_price: "search_price", general_chat: "general_chat" }
);

// --- BƯỚC 4: Sau SEARCH_RECIPE ---
// Recipe chạy xong -> Chỉ còn Price là priority thấp hơn
workflow.addConditionalEdges(
  "search_recipe",
  (state) => {
    const actions = state.next_active_agents;
    
    // Recipe xong bắt buộc check Price (Dependency quan trọng)
    if (hasAction(actions, "SEARCH_PRICE")) return "search_price";

    // if (hasAction(actions, "GENERAL_CHAT")) return "general_chat";
    
    return "general_chat";
  },
  { search_price: "search_price", general_chat: "general_chat" }
);

// --- BƯỚC 5: Sau SEARCH_PRICE ---
// Price là node cuối cùng -> Kết thúc
workflow.addEdge("search_price", "general_chat");

// --- BƯỚC 6: Sau GENERAL_CHAT ---
// Chat là node cuối cùng -> Kết thúc
// workflow.addEdge("general_chat", END);

workflow.addConditionalEdges(
  "general_chat",
  (state) => {
    // Nếu đang bật Memory Mode -> Cần tóm tắt hội thoại để lưu lại
    if (state.isMemoryMode) {
      return "summarize_conversation";
    }
    // Nếu tắt -> Kết thúc luôn
    return END;
  },
  {
    summarize_conversation: "summarize_conversation",
    [END]: END
  }
);

// Cuối cùng: Sau khi tóm tắt xong thì kết thúc
workflow.addEdge("summarize_conversation", END);

// ================================================
// --- 5. COMPILE VỚI CHECKPOINTER ---
export const app = workflow.compile(
  {
    checkpointer: checkpointer,
  }
);

// Hàm setup DB (Chạy 1 lần)
export async function setupAgentDB() {
  try {
    await checkpointer.setup(); // Tạo bảng checkpoints, checkpoint_blobs...

  } catch (e) {
    console.error("❌ Setup failed:", e);
  }
};
