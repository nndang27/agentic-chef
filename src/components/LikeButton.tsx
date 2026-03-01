"use client";

import { Heart } from "lucide-react";
import { toggleLike } from "~/server/db/actions";
import { useState } from "react";
import { cn } from "~/lib/utils";

export function LikeButton({ recipeId, initialIsLiked }: { recipeId: number, initialIsLiked: boolean }) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);

  const handleLike = async () => {
    setIsLiked(!isLiked); // Optimistic update
    try {
      await toggleLike(recipeId);
    } catch (err) {
      setIsLiked(isLiked); // Revert nếu lỗi
    }
  };

  return (
    <button 
      onClick={handleLike}
      className="group flex items-center gap-2 bg-rose-50 px-4 py-2 rounded-full transition-all hover:bg-rose-100"
    >
      <Heart className={cn(
        "w-6 h-6 transition-all",
        isLiked ? "fill-rose-500 text-rose-500 scale-110" : "text-rose-400 group-hover:scale-110"
      )} />
      <span className="font-bold text-rose-600 text-sm">Save Recipe</span>
    </button>
  );
}