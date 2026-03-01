import { 
  BaseMessage, 
  HumanMessage, 
  SystemMessage, 
  AIMessage, 
  RemoveMessage 
} from "@langchain/core/messages";
import { Annotation, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { AgentState } from "../graph/state";
import { llm_summarizer } from "../lib/llm";


// Helper: Gom tin nhắn thành các cụm (Conversation Turns)
// Một cụm bắt đầu bằng HumanMessage và bao gồm các AI/Tool messages theo sau
export const getMessageClusters = (messages: BaseMessage[]): BaseMessage[][] => {
  const clusters: BaseMessage[][] = [];
  let currentCluster: BaseMessage[] = [];

  for (const msg of messages) {
    // Nếu gặp HumanMessage và currentCluster đã có dữ liệu -> Đẩy cụm cũ vào list, tạo cụm mới
    if (msg instanceof HumanMessage && currentCluster.length > 0) {
      clusters.push(currentCluster);
      currentCluster = [];
    }
    // Bỏ qua SystemMessage (không tóm tắt cũng không xóa SystemMessage trong logic này)
    if (!(msg instanceof SystemMessage)) {
       currentCluster.push(msg);
    }
  }

  // Đẩy cụm cuối cùng vào
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return clusters;
};






