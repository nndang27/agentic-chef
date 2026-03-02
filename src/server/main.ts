import { HumanMessage } from "@langchain/core/messages";
import * as readline from "node:readline/promises"; // Module để đọc input từ terminal
import { stdin as input, stdout as output } from "node:process";
import { app } from "./graph/workflow.ts";
import { AgentService } from "./services/agentService";
import { initGraphDB } from "./agents/semantic_Collection";
// import { initRedisIndex } from "./lib/redis.ts";


async function runChat(userInput: string) {
  console.log("\n-----------------------------------");
  const userId = "user_dang_01";
  const sessionId = "14";
  
  const session = new AgentService(userId || "guest", sessionId);
  const finalState = await session.chat(userInput);

  // Xử lý logic hiển thị dựa trên quyết định của Router/Agents
  // const lastMessage = finalState.messages[finalState.messages.length - 1];

  // if (finalState.router_decision?.next_action === "UPDATE_MEMORY") {
  //   console.log("📝 System: Memory updated successfully.");
  // } else if (finalState.videoUrl) {
  //   console.log("🤖 TikTok Agent:", finalState.videoUrl);
  // } else {
  //   // Hiển thị câu trả lời text thông thường từ Agent
  //   console.log("🤖 Assistant:", lastMessage.content);
  // }
}

async function main() {
  // await initRedisIndex();
  await initGraphDB();
  
  const rl = readline.createInterface({ input, output });

  console.log("🚀 Recipe AI Agent đã sẵn sàng! (Gõ 'exit' hoặc 'quit' để thoát)");

  // 3. Vòng lặp vô hạn để lắng nghe người dùng
  while (true) {
    try {
      const userInput = await rl.question("\n👤 You: ");

      // Thoát chương trình nếu người dùng yêu cầu
      if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
        console.log("Goodbye! 👋");
        break;
      }

      // Bỏ qua nếu người dùng nhập rỗng
      if (!userInput.trim()) continue;

      // Chạy luồng xử lý Agent
      await runChat(userInput);

    } catch (error) {
      console.error("❌ Error during chat:", error);
    }
  }

  rl.close();
}

main().catch(console.error);