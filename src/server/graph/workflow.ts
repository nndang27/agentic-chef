// src/server/agent/workflow.ts

import { StateGraph, END, START } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
// import { trimMessages } from "@langchain/core/messages/utils";
import { trimMessages } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
// import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";

import { Pool } from "pg"; // Checkpointer CẦN driver 'pg' chuẩn
import { AgentState } from "./state";
import { supervisorNode } from "../agents/supervisor";
import { tiktokAgentNode } from "../agents/search_Video";
import { generalAssistantNode } from "../agents/chatbot";
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
    new OllamaEmbeddings({
      model: "nomic-embed-text", // Model chuyên dùng để nhúng của Ollama
      baseUrl: "http://127.0.0.1:11434", // Mặc định Ollama chạy ở port này, bạn có thể bỏ qua dòng này nếu chạy local bình thường
    }),
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


// --- 4. KHỞI TẠO GRAPH ---
const workflow = new StateGraph(AgentState);
// ------ Define Node --------
// const resetNode = async () => ({ finished_branches: ["RESET"] });
// workflow.addNode("reset_state", resetNode);
// workflow.addNode("supervisor", supervisorNode);
// workflow.addNode("load_update_memory", semantic_memoryAgentNode);
// workflow.addNode("general_assistant", generalAssistantNode);
// workflow.addNode("barrier", barrierNode);
// workflow.addNode("summarize_conversation", summarizeConversationNode);
// workflow.addNode("manage_memory", manageMemNode);
// workflow.addNode("search_memory", searchMemoryNode);

// workflow.addEdge(START, "reset_state");
// workflow.addEdge("reset_state", "load_update_memory");
// workflow.addEdge("reset_state", "supervisor");

// workflow.addEdge("load_update_memory", "search_memory");
// workflow.addEdge("search_memory", "manage_memory");
// workflow.addEdge("manage_memory", "barrier");

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


workflow.addNode("orchestrator", orchestratorNode);
workflow.addNode("search_map", searchMapNode);
workflow.addNode("search_recipe", recipeAgentNode);
workflow.addNode("search_price", searchPriceAgentNode);
workflow.addNode("search_video", tiktokAgentNode);
workflow.addEdge(START, "orchestrator");
// workflow.addEdge("orchestrator", END);
workflow.addConditionalEdges(
  "orchestrator",
  (state) => {
    const actions = state.next_active_agents;
    console.log("action: ", actions);
    if (actions.includes("SEARCH_MAP")) {
      return "search_map";
    }
    if (actions.includes("SEARCH_RECIPE")) {
      return "search_recipe";
    }
    if (actions.includes("SEARCH_VIDEO")) {
      return "search_video";
    }
    return "END";
  },
  {
    search_map: "search_map",
    search_recipe: "search_recipe",
    search_video: "search_video",
    END: END
  }
);

workflow.addConditionalEdges(
  "search_recipe",
  (state) => {
    const actions = state.next_active_agents;
    console.log("action: ", actions);
    if (actions.includes("SEARCH_PRICE")) {
      return "search_price";
    }
    return "END";
  },
  {
    search_price: "search_price",
    END: END
  }
);

workflow.addEdge("search_price", END);

// workflow.addEdge("search_recipe", END);

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
