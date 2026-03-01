import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { baseLlm } from "../lib/llm.js";
import { AgentState } from "../graph/state.js";
import { searchTikTok } from "../tools/tiktok/search_tiktok.js";
import { downloadTikTok } from "../tools/tiktok/download_tiktok.js";
import { SemanticCache } from "../services/semanticCache.js";
// 1. Định nghĩa cấu trúc chấm điểm (Scoring Schema)
import { v4 as uuidv4 } from 'uuid';
const VideoScoreSchema = z.object({
  index: z.number().describe("The index of the video in the input list (0, 1, 2...)"),
  isRecipe: z.boolean().describe("True if cooking tutorial, False otherwise"),
});

// Định nghĩa output là một mảng các điểm số
const VideoAnalysisList = z.object({
  analyses: z.array(VideoScoreSchema)
});

// 2. Hàm Logic chính của Node
export const tiktokAgentNode = async (state: typeof AgentState.State) => {
  // const messages = state.messages;
  // const lastMessage = messages[messages.length - 1];
  // const userQuery = lastMessage.content.toString();

  let userQuery = state.current_dish;

  // --- BƯỚC 0: CHECK CACHE ------------------
  // const cachedData = await SemanticCache.checkCache(userQuery);
  // console.log("cachedData:", cachedData);

  // if (cachedData) {
  //   const formattedResponse = Array.isArray(cachedData) 
  //       ? cachedData.join("\n") 
  //       : JSON.stringify(cachedData);

  //   return {
  //     messages: [new HumanMessage(`(Kết quả từ bộ nhớ) Đây là video bạn cần:\n${formattedResponse}`)],
  //     videoUrl: cachedData
  //   };
  // }
  // else{
  // console.log("🐢 Cache Miss. Bắt đầu đi tìm video mới...");
  // await SemanticCache.setCache(userQuery, "abc");
  // console.log("abc");
  // }
  // =====================================================================
  const searchResultJson = await searchTikTok(userQuery);
  console.log(99);
  const videos_data = searchResultJson
    .sort((a: any, b: any) => (b.stats.likeCount || 0) - (a.stats.likeCount || 0))
    .slice(0, 10)
    .map((v: any, idx: number) => {
      const hashtagRegex = /#[\w\u00C0-\u1EF9]+/g;
      const hashtagsArray = (v.desc || "").match(hashtagRegex) || [];
      let caption = (v.desc || "").replace(hashtagRegex, "");
      caption = caption.replace(/\s+/g, " ").trim();

      return {
        index: idx,
        caption: caption,
        hashtags: hashtagsArray.join(" "),
        likes: v.stats.likeCount || 0,
        url: `https://www.tiktok.com/@${v.author.uniqueId}/video/${v.id}`
      };
    });

  const payloadForLLM = videos_data.map(v => ({
    index: v.index,
    caption: v.caption,
    hashtags: v.hashtags
  }));
  //   console.log(videos_data)
  if (videos_data.length === 0) {
    return { messages: [new HumanMessage("Không tìm thấy video nào.")] };
  }

  // --- BƯỚC 2: ANALYZE & SCORE (Dùng LLM để chấm điểm) ---
  console.log("🧠 TikTok Agent: Đang phân tích chất lượng video...");

  const analyzerLLM = baseLlm.withStructuredOutput(VideoAnalysisList);
  const analysisResult = await analyzerLLM.invoke([
    new SystemMessage(`
            You are a strict 'Culinary Content Moderator'.
            Task: Analyze the list of videos and determine if they are COOKING RECIPES.
            
            RULES:
            1. READ the caption and hashtags.
            2. REJECT (#dance, #review, #vlog, #eating, #funny) -> isRecipe: false.
            3. ACCEPT (#recipe, #cooking, "how to make", "ingredients") -> isRecipe: true.
            
            CRITICAL OUTPUT RULE:
            - You MUST return an analysis for EVERY item in the input list.
            - Use the 'index' field to match the input.
        `),
    new HumanMessage(`User Query: "${userQuery}"\nAnalyze these videos:\n${JSON.stringify(payloadForLLM, null, 2)}`)
  ]);

  console.log(analysisResult.analyses)
  // BƯỚC 3: Filter (Lấy danh sách các video > 7 điểm)
  // Logic: Lấy hết tất cả video thỏa mãn điều kiện
  const goodVideos = analysisResult.analyses.filter(v => v.isRecipe);

  if (goodVideos.length === 0) {
    return { messages: [new HumanMessage("Không có video nào là recipe")] };
  }

  console.log(`Tìm thấy ${goodVideos.length} video . Đang tải xuống đồng thời...`);

  // BƯỚC 4: Parallel Download (Tải song song)
  // Map mỗi video thành một Promise download
  const groupVideoID = uuidv4();
  const downloadPromises = goodVideos.map(async (videoAnalysis) => {
    const originalVideo = videos_data.find(v => v.index === videoAnalysis.index);
    if (!originalVideo) return null;

    // const fullUrl = `https://www.tiktok.com/@${originalVideo.author}/video/${originalVideo.id}`;

    try {
      // Gọi tool download
      console.log("originalVideo: ", originalVideo);
      const path = await downloadTikTok(originalVideo.url, `../../public/download_vids/${groupVideoID}`);
      return { video_id: originalVideo.index, url: originalVideo.url, path };
    } catch (e) {
      console.error(`Lỗi tải video ${videoAnalysis.index}:`, e);
      return null;
    }
  });

  // Chờ tất cả video tải xong (Promise.all)
  const results = await Promise.all(downloadPromises);

  // Lọc bỏ các cái bị null (lỗi tải)
  const validResults = results.filter(r => r && r.path != null);

  // // Format kết quả trả về cho User
  // const resultMessage = successResults
  //   .map((r, index) => `${index + 1}. ${r.url} - Đã lưu tại: ${r.path}`)
  //   .join("\n");

  console.log("validResults: ", validResults);

  return {
    finished_branches: ["search_video_done"],
    videoUrl: {
      video_id: groupVideoID,
      url: validResults.map(r => r?.url),
      path: validResults.map(r => r?.path)
    }

  };
  //  return { messages: [new HumanMessage("Đã tải xong video")] };
};