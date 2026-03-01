import { createClient } from "redis";

// Kết nối đến Redis Stack
export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

const INDEX_NAME = "idx:tiktok_cache";

// Hàm khởi tạo Index (Chạy 1 lần khi start app)
export async function initRedisIndex() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  try {
    // Thử lấy thông tin index xem có chưa
    await redisClient.ft.info(INDEX_NAME);
    console.log("✅ Redis Vector Index already exists.");
  } catch (e) {
    console.log("⚠️ Index not found. Creating new Vector Index...");
    
    // SỬA: Dùng chuỗi trực tiếp thay vì Enum để tránh lỗi import
    await redisClient.ft.create(
      INDEX_NAME,
      {
        "$.query_vector": {
          type: "VECTOR" as any, // Ép kiểu as any để TS không báo lỗi
          ALGORITHM: "HNSW" as any, 
          TYPE: "FLOAT32" as any,
          DIM: 384, // Khớp với nomic-embed-text
          DISTANCE_METRIC: "COSINE" as any,
          AS: "vector",
        },
      },
      {
        ON: "JSON",
        PREFIX: "tiktok:cache:", 
      }
    );
    console.log("✅ Created Redis Vector Index successfully.");
  }
}