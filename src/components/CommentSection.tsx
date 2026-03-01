"use client";

import { useState } from "react";
import { addComment } from "~/server/db/actions";
import { MessageSquare, Send } from "lucide-react";

interface Comment {
  id: number;
  userName: string;
  content: string;
  createdAt: Date | null;
}

export function CommentSection({ recipeId, initialComments }: { recipeId: number, initialComments: any[] }) {
  const [content, setContent] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsPending(true);
    await addComment(recipeId, content);
    setContent("");
    setIsPending(false);
  };

  return (
    <div className="space-y-6 pt-10">
      <div className="flex items-center gap-2 border-b pb-4">
        <MessageSquare className="w-5 h-5 text-slate-500" />
        <h3 className="text-xl font-bold text-slate-800">Bình luận ({initialComments.length})</h3>
      </div>

      {/* Form nhập bình luận */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Chia sẻ cảm nghĩ của bạn về công thức này..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
        />
        <button 
          disabled={isPending}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
        >
          {isPending ? "Đang gửi..." : <><Send className="w-4 h-4" /> Gửi</>}
        </button>
      </form>

      {/* Danh sách bình luận */}
      <div className="space-y-4">
        {initialComments.length === 0 ? (
          <p className="text-center text-slate-400 py-10 italic">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
        ) : (
          initialComments.map((comment) => (
            <div key={comment.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 text-sm">{comment.userName}</span>
                <span className="text-[10px] text-slate-400 uppercase font-medium">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{comment.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}