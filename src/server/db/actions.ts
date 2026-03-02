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
// export async function toggleLike(recipeId: number) {
//   const { userId } = await auth();
//   if (!userId) throw new Error("Unauthorized");

//   // Kiểm tra xem đã like chưa
//   const existingLike = await db.query.likes.findFirst({
//     where: and(eq(likes.recipeId, recipeId), eq(likes.userId, userId)),
//   });

//   if (existingLike) {
//     // Nếu rồi thì unlike
//     await db.delete(likes).where(eq(likes.id, existingLike.id));
//   } else {
//     // Nếu chưa thì like
//     await db.insert(likes).values({ recipeId, userId });
//   }

//   revalidatePath(`/recipe/${recipeId}`);
//   revalidatePath('/');

// }


export async function toggleLikeAction(recipeId: number) {
  // 1. Lấy user hiện tại
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Bạn cần đăng nhập để thực hiện hành động này.");
  }

  try {
    // 2. Kiểm tra xem user đã like bài này chưa
    const existingLike = await db.query.likes.findFirst({
      where: and(eq(likes.recipeId, recipeId), eq(likes.userId, userId)),
    });

    if (existingLike) {
      // 3. Nếu có rồi -> Xóa (Unlike)
      await db.delete(likes).where(eq(likes.id, existingLike.id));
      
      // Revalidate để cập nhật lại UI server (nếu cần)
      // revalidatePath(`/recipe/${recipeId}`);
      // revalidatePath('/');
      return { liked: false };
    } else {
      // 4. Nếu chưa có -> Thêm mới (Like)
      await db.insert(likes).values({
        recipeId: recipeId,
        userId: userId,
      });
      
      // revalidatePath(`/recipe/${recipeId}`);
      // revalidatePath('/');
      return { liked: true };
    }
  } catch (error) {
    console.error("Lỗi toggle like:", error);
    throw new Error("Failed to toggle like");
  }
}