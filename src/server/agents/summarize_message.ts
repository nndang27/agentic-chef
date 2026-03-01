import { 
  BaseMessage, 
  HumanMessage, 
  SystemMessage, 
  AIMessage, 
  RemoveMessage 
} from "@langchain/core/messages";
import { AgentState } from "../graph/state";
import { llm_summarizer } from "../lib/llm";
import { getMessageClusters } from "../utils/clusterMessage";

export const summarizeConversationNode = async (state: typeof AgentState.State) => {
  
  const summary = state.summary;
  const messages = state.messages;
  
  const existingMessageIds = new Set(messages.map((m) => m.id));

  // 1. Chia toàn bộ lịch sử thành các cụm
  const clusters = getMessageClusters(messages);
  console.log("🧹 Số cụm cũ: ", clusters.length);

  // CẤU HÌNH CHIẾN THUẬT
  const KEEP_RECENT_CLUSTERS = 10; // Giữ 10 cụm mới nhất
  const PROCESS_THRESHOLD = 5;     // Chỉ chạy khi cụm cũ tích tụ đủ 5 cụm

  // Tính toán số lượng cụm cần xem xét
  // (Tổng số) - (Số lượng muốn giữ lại) = (Số lượng cụm "Cũ")
  const oldClustersCount = clusters.length - KEEP_RECENT_CLUSTERS;

  // 2. Điều kiện kích hoạt: Nếu số cụm cũ chưa vượt quá 5 thì KHÔNG LÀM GÌ CẢ
  if (oldClustersCount <= PROCESS_THRESHOLD) {
    console.log("⏳ Số cụm cũ chưa đủ để kích hoạt dọn dẹp bộ nhớ.");
    return {}; 
  }

  console.log("🧹 Đang kích hoạt dọn dẹp bộ nhớ...");

  const clustersToSummarize = clusters.slice(0, PROCESS_THRESHOLD);
  
  const messagesToSummarize = clustersToSummarize.flat();

  let prompt = "";
  if (summary) {
    prompt = `This is the summary of the conversation so far: "${summary}"\n\n` +
             `Extend the summary by incorporating the following new lines of conversation:\n`;
  } else {
    prompt = `Summarize the following conversation lines concisely:\n`;
  }

  const conversationText = messagesToSummarize
    .map((m) => `${m._getType().toUpperCase()}: ${m.content}`)
    .join("\n");

  // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  // console.log("messagesToSummarize: ", messagesToSummarize);

  prompt += conversationText;

  const response = await llm_summarizer.invoke([
    new HumanMessage(prompt)
  ]);

  const newSummary = response.content as string;

  const deleteOperations = messagesToSummarize.map(
    (m) => new RemoveMessage({ id: m.id })
  );


  // console.log("***************************************************");
  // console.log("New Summary: ", newSummary);
  return {
    summary: newSummary,
    messages: deleteOperations
  };
};
