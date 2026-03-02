"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleLikeAction } from "../server/db/actions.ts"; // Import action ở bước 2
import { cn } from "../lib/utils"; // Hàm nối class (nếu có dùng shadcn), nếu không thì dùng string template

interface LikeButtonProps {
  recipeId: number;
  initialLikes: number;
  initialIsLiked: boolean;
}

export function LikeButton({ recipeId, initialLikes, initialIsLiked }: LikeButtonProps) {
  // State để cập nhật giao diện ngay lập tức (Optimistic UI)
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.preventDefault(); // Ngăn chặn click lan ra thẻ cha (nếu thẻ cha là Link)
    e.stopPropagation();

    if (isLoading) return;
    setIsLoading(true);
     
    // 1. Optimistic Update: Cập nhật UI ngay lập tức cho mượt
    const previousIsLiked = isLiked;
    const previousCount = likesCount;

    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    try {
      // 2. Gọi Server Action
      await toggleLikeAction(recipeId);
    } catch (error) {
      // 3. Nếu lỗi thì revert (quay lại trạng thái cũ)
      setIsLiked(previousIsLiked);
      setLikesCount(previousCount);
      console.error("Like failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleLike}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors duration-200",
        // Logic đổi màu nền và chữ
        isLiked 
          ? "text-rose-600 bg-rose-100 hover:bg-rose-200" 
          : "text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-rose-500"
      )}
    >
      <Heart
        className={cn(
          "w-3.5 h-3.5 transition-all duration-300",
          // Logic đổi màu icon (fill)
          isLiked ? "fill-rose-600 scale-110" : "fill-transparent"
        )}
      />
      <span className="font-bold text-xs">
        {likesCount > 0 ? likesCount : "Like"}
      </span>
    </button>
  );
}