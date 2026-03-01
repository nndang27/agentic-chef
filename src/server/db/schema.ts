// server/db/schema.ts
import { sql } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  serial,
  varchar,
  text,
  jsonb,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- IMPORT INTERFACES TỪ FILE TYPE CỦA BẠN (Hoặc định nghĩa tạm ở đây để dùng cho $type) ---
// Bạn nên move các interface này vào 1 file shared types, ở đây mình định nghĩa lại để Drizzle hiểu type
export interface Ingredient {
  item: string;
  amount: string | null;
  notes: string | null;
}

export interface Step {
  step: number;
  action: string;
  time_minutes: number | null;
}

export interface TimeValue {
  value: string;
  unit: string;
}

// Interface cho Price Data
export interface ProductItem {
  barcode: string | null;
  product_name: string;
  product_brand: string;
  current_price: number;
  product_size: string;
  url: string;
  image_url: string;
}

export interface IngredientStoreGroup {
  supermarket: 'COLES' | 'WOOLWORTHS';
  item_list: ProductItem[];
}

export interface IngredientPriceList {
  ingredient_name: string;
  ingredient_list: IngredientStoreGroup[];
}

// ------------------------------------------------------------------

export const createTable = pgTableCreator((name) => `${name}`);

// 1. BẢNG RECIPES
export const recipes = createTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 256 }).notNull(), // Clerk User ID
    
    title: varchar("title", { length: 256 }).notNull(),
    imageUrl: varchar("image_url", { length: 512 }), // URL ảnh
    chefTips: text("chef_tips"),

    // Lưu các dữ liệu mảng dưới dạng JSONB để truy xuất nhanh và giữ cấu trúc
    serves: jsonb("serves").$type<TimeValue[]>().notNull(),
    cookTime: jsonb("cook_time").$type<TimeValue[]>().notNull(),
    prepTime: jsonb("prep_time").$type<TimeValue[] | null>(),
    
    ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull(),
    steps: jsonb("steps").$type<Step[]>().notNull(),
    nutrition: jsonb("nutrition").$type<{ [key: string]: string | number } | null>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date()),
  },
  (t) => [index("recipe_user_idx").on(t.userId)]
);

// 2. BẢNG RECIPE PRICES (Lưu snapshot giá tại thời điểm lưu)
export const recipePrices = createTable(
  "recipe_prices",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }), // Xóa recipe thì xóa luôn giá
    
    // Lưu toàn bộ cấu trúc IngredientPricePerRecipe vào đây
    priceData: jsonb("price_data").$type<IngredientPriceList[]>().notNull(),
    
    // Có thể lưu thêm tổng tiền để sort/filter nhanh nếu cần
    totalColes: integer("total_coles"), // Lưu cent hoặc float
    totalWoolworths: integer("total_woolworths"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [index("price_recipe_idx").on(t.recipeId)]
);

// --- RELATIONS (Để query join dễ dàng) ---
// export const recipesRelations = relations(recipes, ({ one }) => ({
//   priceInfo: one(recipePrices, {
//     fields: [recipes.id],
//     references: [recipePrices.recipeId],
//   }),
// }));





// --------------- like and comment ------------------
export const comments = createTable("comments", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 256 }).notNull(),
  userName: varchar("user_name", { length: 256 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const likes = createTable("likes", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 256 }).notNull(),
});

// Thêm quan hệ (Relations)
export const recipesRelations = relations(recipes, ({ one, many }) => ({
  priceInfo: one(recipePrices, {
    fields: [recipes.id],
    references: [recipePrices.recipeId],
  }),
  comments: many(comments), // Quan hệ 1-nhiều
  likes: many(likes),       // Quan hệ 1-nhiều
}));

// 2. Thêm Relations cho bảng COMMENTS (QUAN TRỌNG: Đây là phần bị thiếu)
export const commentsRelations = relations(comments, ({ one }) => ({
  recipe: one(recipes, {
    fields: [comments.recipeId],
    references: [recipes.id],
  }),
}));

// 3. Thêm Relations cho bảng LIKES (Để tránh lỗi tương tự với likes)
export const likesRelations = relations(likes, ({ one }) => ({
  recipe: one(recipes, {
    fields: [likes.recipeId],
    references: [recipes.id],
  }),
}));

// 4. Relations cho bảng RECIPE_PRICES (Đã có từ trước, giữ nguyên)
export const recipePricesRelations = relations(recipePrices, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipePrices.recipeId],
    references: [recipes.id],
  }),
}));