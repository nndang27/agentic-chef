import { redisClient } from "../lib/redis.ts";
import { OllamaEmbeddings } from "@langchain/ollama";

// Config Model Embedding
const embeddingsModel = new OllamaEmbeddings({
  model: "all-minilm", // Model này tạo vector kích thước 768 chiều
  baseUrl: "http://127.0.0.1:11434",
});

const INDEX_NAME = "idx:tiktok_cache";
const CACHE_TTL = 60 * 60 * 24; // Cache sống trong 24 giờ

// Ngưỡng khoảng cách (Distance Threshold)
// Trong Cosine Distance: 0 là giống hệt, 1 là khác biệt hoàn toàn.
// Ta chọn 0.15 (tức là giống nhau > 85%)
const DISTANCE_THRESHOLD = 0.3;

export class SemanticCache {
  
  // Hàm check cache
  static async checkCache(userQuery: string): Promise<any | null> {
    try {
      if (!redisClient.isOpen) await redisClient.connect();
      // 1. Tạo Vector từ Query của User
      const queryVector = await embeddingsModel.embedQuery(userQuery);
      
      // 2. Chuyển đổi Vector sang Buffer (Redis yêu cầu dạng Blob)
      const blob = float32Buffer(queryVector);
      // 3. Thực hiện Vector Search (KNN - K Nearest Neighbors)
      // Tìm 1 thằng gần nhất (LIMIT 0 1)
      const result = await redisClient.ft.search(
        INDEX_NAME,
        `*=>[KNN 1 @vector $BLOB AS score]`,
        {
          PARAMS: {
            BLOB: blob,
          },
          SORTBY: "score",
          DIALECT: 2,
          // 👇 SỬA Ở ĐÂY: Thêm $. vào trước tên trường và đặt Alias (AS)
          RETURN: [
            "score", 
            "$.response_data", "AS", "response_data", // Lấy $.response_data đặt tên là response_data
            "$.original_query", "AS", "original_query"
          ],
        }
      );
      // 4. Kiểm tra kết quả
      console.log("result.total: ",result.documents);
      if (result.total > 0) {
        const topMatch = result.documents[0];
        const score = Number(topMatch.value.score);

        console.log(`[Redis] 🔍 Search: "${userQuery}" | Match: "${topMatch.value.original_query}" | Distance: ${score}`);

        // Nếu khoảng cách nhỏ hơn ngưỡng (tức là rất giống nhau)
        if (score < DISTANCE_THRESHOLD) {
            console.log("✅ CACHE HIT! Reusing result.");
            // Parse lại JSON string thành Object
            return JSON.parse(topMatch.value.response_data as string);
        }
      }
      console.log(6);
      console.log("❌ CACHE MISS.");
      return null;
    } catch (error) {
      console.error("Redis Cache Error:", error);
      return null; // Nếu lỗi redis thì cứ trả về null để chạy luồng chính bình thường
    }
  }

  // Hàm lưu cache
  static async setCache(userQuery: string, data: any): Promise<void> {
    try {
      const queryVector = await embeddingsModel.embedQuery(userQuery);
      
      const key = `tiktok:cache:${Date.now()}`;
      
      // Lưu vào Redis dưới dạng JSON
      await redisClient.json.set(key, "$", {
        original_query: userQuery,
        response_data: JSON.stringify(data), // Stringify data để lưu an toàn
        query_vector: queryVector, // RedisJSON tự động xử lý mảng số thành vector khi có index
      });

      // Set thời gian hết hạn (TTL)
      await redisClient.expire(key, CACHE_TTL);
      
      console.log(`[Redis] 💾 Saved cache for "${userQuery}"`);
    } catch (error) {
      console.error("Redis Set Error:", error);
    }
  }
}

// Utility: Chuyển Array<number> thành Buffer
function float32Buffer(arr: number[]) {
  return Buffer.from(new Float32Array(arr).buffer);
}
