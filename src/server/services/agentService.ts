// src/server/services/AgentService.ts

import { app } from "../graph/workflow";
import { HumanMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid"; // Cần cài: pnpm add uuid @types/uuid

export class AgentService {
  private sessionId: string;
  private userId: string;

  /**
   * Khởi tạo một phiên làm việc.
   * - Nếu có sessionId cũ -> Nó sẽ load lại lịch sử chat cũ (Resume).
   * - Nếu không truyền sessionId -> Nó tạo session mới tinh (New Chat).
   */
  constructor(userId: string = "guest", sessionId?: string) {
    this.userId = userId;
    this.sessionId = sessionId || uuidv4(); // Tự sinh ID nếu chưa có
  }


  getSessionId() {
    return this.sessionId;
  }


  async chat(userMessage: string) {
    // Cấu hình định danh cho LangGraph Checkpointer
    const uniqueThreadId = `${this.userId}:${this.sessionId}`;

    const config = {
      configurable: {
        thread_id: uniqueThreadId,
        user_id: this.userId,
      },
    };
    // console.log("config", config);
    try {
      // Gọi Agent
      const output = await app.invoke(
        { messages: [new HumanMessage(userMessage)] },
        config
      );

      // Lấy tin nhắn cuối cùng của Bot
      const lastMessage = output.messages[output.messages.length - 1];
      return lastMessage.content;

    } catch (error) {
      console.error("Agent Error:", error);
      throw error;
    }
  }

  /**
   * Lấy lại toàn bộ lịch sử chat của Session này từ Postgres
   */
  async getHistory() {
    const config = { configurable: { thread_id: this.sessionId } };
    
    // app.getState() sẽ chọc vào PostgresSaver lấy state ra
    const state = await app.getState(config);
    
    // Map data cho đẹp để trả về frontend
    return (state.values.messages || []).map((msg: any) => ({
      role: msg._getType(), // 'human' | 'ai' | 'system'
      content: msg.content,
    }));
  }
}