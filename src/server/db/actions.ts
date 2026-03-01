"use server";

import { db } from "./index";
import { comments, likes } from "./schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

// --- XỬ LÝ COMMENT ---
export async function addComment(recipeId: number, content: string) {
  const user = await currentUser();
  if (!user) throw new Error("Bạn cần đăng nhập để bình luận");

  await db.insert(comments).values({
    recipeId,
    userId: user.id,
    userName: user.fullName || user.username || "Người dùng ẩn danh",
    content,
  });

  revalidatePath(`/recipe/${recipeId}`);
}

// --- XỬ LÝ LIKE ---
export async function toggleLike(recipeId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Kiểm tra xem đã like chưa
  const existingLike = await db.query.likes.findFirst({
    where: and(eq(likes.recipeId, recipeId), eq(likes.userId, userId)),
  });

  if (existingLike) {
    // Nếu rồi thì unlike
    await db.delete(likes).where(eq(likes.id, existingLike.id));
  } else {
    // Nếu chưa thì like
    await db.insert(likes).values({ recipeId, userId });
  }

  revalidatePath(`/recipe/${recipeId}`);
}