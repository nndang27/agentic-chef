// src/server/db/schema.ts
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTableCreator,
  serial,
  text,
  timestamp,
  varchar,
  boolean,
  doublePrecision,
} from "drizzle-orm/pg-core";

// Tiền tố giúp phân biệt bảng nếu dùng chung DB nhiều dự án
export const createTable = pgTableCreator((name) => `recipe_ai_${name}`);

// --- 1. USERS (Semantic Memory) ---
// Cohesion: Lưu toàn bộ thông tin định danh và sở thích người dùng
export const users = createTable(
  "user",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // User ID từ Clerk
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    
    // Semantic Memory: Lưu dạng JSONB để linh hoạt schema (Schema-less within Schema)
    // Chứa: allergies, preferences, equipment, address (cho Map agent)
    preferences: jsonb("preferences").$type<{
       allergies: string[];
       likes: string[];
       dislikes: string[];
       equipment: string[];
       home_address?: string;
    }>().default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (t) => [index("email_idx").on(t.email)]
);

// --- 2. CHAT SESSIONS (Episodic Memory) ---
// Lưu lịch sử chat để Supervisor Agent nhớ ngữ cảnh


export const messages = createTable("message", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => chatSessions.id).notNull(),
  role: varchar("role", { length: 50 }).notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(), // Nội dung chat
  
  // Lưu metadata nếu message này do Agent nào xử lý (Agent Trace)
  agentName: varchar("agent_name", { length: 50 }), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- 3. RECIPES (Kết quả từ Recipe Agent) ---
export const recipes = createTable("recipe", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).references(() => users.id), // Ai yêu cầu món này
  
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  
  // Dữ liệu JSON cho các bước nấu (vì thứ tự quan trọng)
  instructions: jsonb("instructions").$type<string[]>().notNull(), 
  
  // Thời gian nấu, khẩu phần (phục vụ việc scale công thức)
  prepTimeMinutes: integer("prep_time_minutes"),
  servings: integer("servings").default(1),
  
  // Nguồn gốc (nếu crawl từ web)
  sourceUrl: varchar("source_url", { length: 512 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bảng Ingredients tách riêng để phục vụ Price Agent dễ query
export const ingredients = createTable("ingredient", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").references(() => recipes.id).notNull(),
  name: varchar("name", { length: 256 }).notNull(), // Tên nguyên liệu (VD: "Chicken breast")
  amount: doublePrecision("amount"), // Số lượng (VD: 500)
  unit: varchar("unit", { length: 50 }), // Đơn vị (VD: "grams")
});

// --- 4. VIDEOS (Kết quả từ TikTok Agent) ---
export const videos = createTable("video", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").references(() => recipes.id), // Link lỏng lẻo với Recipe
  
  platform: varchar("platform", { length: 50 }).default("tiktok"), // tiktok, youtube
  platformId: varchar("platform_id", { length: 255 }).notNull(), // ID gốc trên TikTok
  url: varchar("url", { length: 512 }).notNull(), // Link gốc
  
  // Nếu bạn quyết định tải video về S3/R2, lưu link đó ở đây
  storageUrl: varchar("storage_url", { length: 512 }), 
  
  authorName: varchar("author_name", { length: 256 }),
  caption: text("caption"),
  hashtags: jsonb("hashtags").$type<string[]>(),
  
  stats: jsonb("stats").$type<{
    likes: number;
    views: number;
    shares: number;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- 5. MARKET PRICES (Kết quả từ Price Agent) ---
// Lưu giá tham khảo tại thời điểm search
export const marketPrices = createTable("market_price", {
  id: serial("id").primaryKey(),
  ingredientId: integer("ingredient_id").references(() => ingredients.id),
  
  storeName: varchar("store_name", { length: 100 }).notNull(), // "coles", "woolworths", "aldi"
  productName: varchar("product_name", { length: 256 }).notNull(), // Tên sản phẩm thực tế ngoài siêu thị
  price: doublePrecision("price").notNull(),
  currency: varchar("currency", { length: 10 }).default("AUD"),
  
  productUrl: varchar("product_url", { length: 512 }),
  promotion: text("promotion"), // "Buy 1 Get 1 Free"
  
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

// --- RELATIONS (Giúp Drizzle query lồng nhau dễ dàng) ---
export const usersRelations = relations(users, ({ many }) => ({
  recipes: many(recipes),
  chatSessions: many(chatSessions),
}));

export const chatSessionsRelations = relations(chatSessions, ({ many, one }) => ({
  messages: many(messages),
  user: one(users, { fields: [chatSessions.userId], references: [users.id] }),
}));

export const recipesRelations = relations(recipes, ({ many, one }) => ({
  ingredients: many(ingredients),
  videos: many(videos),
  user: one(users, { fields: [recipes.userId], references: [users.id] }),
}));

export const ingredientsRelations = relations(ingredients, ({ many, one }) => ({
  recipe: one(recipes, { fields: [ingredients.recipeId], references: [recipes.id] }),
  prices: many(marketPrices),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  recipe: one(recipes, { fields: [videos.recipeId], references: [recipes.id] }),
}));

export const marketPricesRelations = relations(marketPrices, ({ one }) => ({
  ingredient: one(ingredients, { fields: [marketPrices.ingredientId], references: [ingredients.id] }),
}));