import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.ts"; // Trỏ đúng vào file schema của bạn
import { config } from "dotenv";

// Load biến môi trường
config({ path: ".env" });

if (!process.env.POSTGRES_URL) {
  throw new Error("❌ POSTGRES_URL is missing in .env file");
}

const sql = neon(process.env.POSTGRES_URL);
const db = drizzle(sql, { schema });

async function main() {
  console.log("🌱 Starting seeding process...");

  try {
    // ---------------------------------------------------------
    // 1. CLEANUP (Xóa dữ liệu cũ để tránh trùng lặp)
    // ---------------------------------------------------------
    console.log("🧹 Cleaning up old data...");
    // Xóa theo thứ tự ngược lại của quan hệ (Con xóa trước, Cha xóa sau)
    await db.delete(schema.messages);
    await db.delete(schema.chatSessions);
    await db.delete(schema.videos);
    await db.delete(schema.users);
    
    // ---------------------------------------------------------
    // 2. SEED USERS (Tạo 2 user mẫu)
    // ---------------------------------------------------------
    console.log("👤 Seeding Users...");
    
    const usersData = [
      {
        id: "user_dang_01", // ID giả lập (thường sẽ là ID từ Clerk)
        name: "Dang",
        email: "nndang2701@gmail.com",
        preferences: {
          allergies: ["peanut"],
          likes: ["pho", "bun bo hue"],
          dislikes: ["onion"],
          equipment: ["air_fryer"],
          home_address: "Earlwood, Sydney"
        }
      },
      {
        id: "user_ngoc_01",
        name: "Ngoc Dang",
        email: "elnino27012002@gmail.com",
        preferences: {
          allergies: [],
          likes: ["pasta", "pizza"],
          dislikes: ["spicy food"],
          equipment: ["oven", "stove"],
          home_address: "Hanoi, Vietnam"
        }
      }
    ];

    await db.insert(schema.users).values(usersData);

    // ---------------------------------------------------------
    // 3. SEED VIDEOS (Dữ liệu TikTok giả)
    // ---------------------------------------------------------
    console.log("🎥 Seeding Videos...");

    // Lưu ý: recipeId đang để null vì chưa tạo recipe, 
    // nếu schema yêu cầu notNull thì cần tạo recipe trước.
    const videosData = [
      {
        platform: "tiktok",
        platformId: "7238472384723",
        url: "https://www.tiktok.com/@nino/video/7238472384723",
        authorName: "Nino's Home",
        caption: "Cách làm Phở Bò đơn giản tại nhà #pho #cooking",
        hashtags: ["pho", "vietnamesefood", "cooking"],
        stats: { likes: 150000, views: 2000000, shares: 5000 }
      },
      {
        platform: "tiktok",
        platformId: "888888888888",
        url: "https://www.tiktok.com/@gordonramsay/video/888888888888",
        authorName: "Gordon Ramsay",
        caption: "Perfect Pizza Dough Recipe",
        hashtags: ["pizza", "italy", "masterchef"],
        stats: { likes: 5000000, views: 10000000, shares: 20000 }
      }
    ];

    await db.insert(schema.videos).values(videosData);

    // ---------------------------------------------------------
    // 4. SEED CHAT SESSIONS (Hội thoại mẫu)
    // ---------------------------------------------------------
    console.log("💬 Seeding Chat Sessions...");

    // Session 1: Dang hỏi về Phở
    const [session1] = await db.insert(schema.chatSessions).values({
      userId: "user_dang_01",
      title: "Học nấu Phở Bò",
    }).returning();

    // Session 2: Ngoc Dang hỏi về Pizza
    const [session2] = await db.insert(schema.chatSessions).values({
      userId: "user_ngoc_01",
      title: "Tìm công thức Pizza",
    }).returning();

    // ---------------------------------------------------------
    // 5. SEED MESSAGES (Nội dung chat)
    // ---------------------------------------------------------
    console.log("📩 Seeding Messages...");

    const messagesData = [
      // Chat của Dang (Session 1)
      {
        sessionId: session1.id,
        role: "user",
        content: "Tìm giúp tôi video hướng dẫn nấu phở bò bằng nồi áp suất.",
        agentName: null
      },
      {
        sessionId: session1.id,
        role: "assistant",
        content: "Tôi tìm thấy video này từ Nino's Home rất phù hợp với bạn.",
        agentName: "TikTokAgent"
      },
      
      // Chat của Ngoc Dang (Session 2)
      {
        sessionId: session2.id,
        role: "user",
        content: "I want to make a pizza but I don't have an oven.",
        agentName: null
      },
      {
        sessionId: session2.id,
        role: "assistant",
        content: "Since you don't have an oven, I suggest a pan-pizza recipe. Let me check the database.",
        agentName: "Supervisor"
      }
    ];

    await db.insert(schema.messages).values(messagesData);

    console.log("✅ Seeding completed successfully!");
    console.log(`Created 2 Users, 2 Videos, 2 Sessions, and ${messagesData.length} Messages.`);

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();