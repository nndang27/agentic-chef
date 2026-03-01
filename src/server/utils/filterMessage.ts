import { BaseMessage } from "@langchain/core/messages";

export const prepareMessagesForLLM = (messages: BaseMessage[]) => {
  
  // 1. Tạo biến mới, lọc bỏ SystemMessage
  // Logic: Giữ lại Human, AI, Tool. Bỏ System.
  const cleanHistory = messages.filter((msg) => {
    // Cách 1: Kiểm tra theo type string (an toàn nhất trong LangChain JS)
    const type = msg._getType(); 
    return type === "human" || type === "ai" || type === "tool";

    // Cách 2: Dùng instanceof (nếu bạn import đúng class)
    // return !(msg instanceof SystemMessage);
  });

  // Lúc này cleanHistory là mảng mới, state.messages cũ vẫn nguyên vẹn.
  return cleanHistory;
};