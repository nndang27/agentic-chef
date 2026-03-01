// import { drizzle } from "drizzle-orm/neon-http";
// import { neon } from "@neondatabase/serverless";
// import { config } from "dotenv";
// import * as schema from "./schema";
// config({ path: ".env" }); // or .env.local

// const sql = neon(process.env.POSTGRES_URL!);
// export const db = drizzle(sql, { schema });


// src/server/db/index.ts
import { drizzle } from "drizzle-orm/neon-serverless"; // Đổi từ neon-http sang neon-serverless
import { Pool } from "@neondatabase/serverless"; // Dùng Pool thay vì neon()
import { config } from "dotenv";
import * as schema from "./schema";

config({ path: ".env" });

// Sử dụng Pool để hỗ trợ WebSockets và Transactions
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export const db = drizzle(pool, { schema });