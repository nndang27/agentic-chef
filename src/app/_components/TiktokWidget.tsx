

import { PRICES, MEAL_PLAN } from "../../lib/mockData";
import { Badge } from "../../components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Skeleton } from "../../components/ui/skeleton";
import { Check, Flame, MapPin, Play } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "../../components/ui/carousel";
import { getVideoList } from "../../server/db/getVideos";
import { TikTokFeed } from "./TikTokFeed";
import { Loader2 } from "lucide-react"; // Đừng quên import icon này

// const mockVideos = await getVideoList();

interface AgentWidgetProps {
  isLoading: boolean;
  videoUrl: {video_id: string, url: string[], path: string[]} | null;
}

export function TikTokAgent({ isLoading, videoUrl }: AgentWidgetProps) {
  console.log("isLoading:22 ", isLoading);
  // console.log("videoUrl: ", videoUrl);
  return (
    <div className="relative w-full h-full min-h-[300px] flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200">
      
      {/* ---------------- LOADING OVERLAY ---------------- */}
      {/* Chỉ hiện khi isLoading = true */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-slate-100/90 backdrop-blur-[2px] flex flex-col items-center justify-center text-slate-600 animate-in fade-in duration-300">
          {/* Icon xoay tròn */}
          <Loader2 className="w-10 h-10 animate-spin text-black mb-3" />
          
          <span className="text-sm font-semibold tracking-wide animate-pulse">
            Searching for TikToks...
          </span>
        </div>
      )}

      {/* ---------------- MAIN CONTENT ---------------- */}
      {/* Nội dung chính vẫn nằm dưới (hoặc bị che đi khi loading) */}
      <div className="py-6 px-2 flex-1 overflow-y-auto">
          <h1 className="text-center mb-5 font-bold text-lg text-slate-800">
            TikTok Collection
          </h1>
          
          {/* Chỉ render feed khi có data để tránh lỗi layout rỗng */}
          {videoUrl?.path && <TikTokFeed videoUrls={videoUrl.path} />}
      </div> 
    </div> 
  );
}
// export function TikTokAgent({ isLoading, videoUrl }: AgentWidgetProps) {
//   // 1. Trạng thái Loading: Hiển thị Skeleton đẹp mắt thay vì trống trơn
//   if (isLoading) {
//     return (
//       <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 animate-pulse p-4">
//          <div className="w-2/3 h-64 bg-slate-200 rounded-xl mb-4"></div>
//          <div className="w-1/2 h-4 bg-slate-200 rounded mb-2"></div>
//          <div className="w-1/3 h-4 bg-slate-200 rounded"></div>
//          <span className="text-slate-400 text-sm mt-4 font-medium">Searching TikToks...</span>
//       </div>
//     );
//   }

//   // 2. Trạng thái có dữ liệu
//   return (
//     // Xóa py-10, xóa h1, chỉ giữ lại feed
//     // Thêm class h-full để nó chiếm hết chiều cao của thẻ cha
//     <div className="w-full h-full bg-slate-900/5"> 
//       {/* bg-slate-900/5 tạo nền tối nhẹ giúp video nổi bật hơn nếu video không full width */}
      
//       {videoUrl?.path ? (
//          <TikTokFeed videoUrls={videoUrl.path} />
//       ) : (
//          // Trạng thái chờ (chưa search)
//          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
//             <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
//                🎬
//             </div>
//             <p className="text-sm">No videos found yet.</p>
//          </div>
//       )}
//     </div> 
//   );
// }
export function MealPlanAgent({ isLoading }: AgentWidgetProps) {
  if (isLoading) return <Skeleton className="w-full h-24 rounded-2xl bg-slate-100" />;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <h3 className="font-semibold text-slate-800">7-Day Meal Plan & Receipts</h3>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {MEAL_PLAN.map((plan, i) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
            <div className="flex-shrink-0 w-16 text-center">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">{plan.day}</span>
              <div className={`mx-auto mt-1 h-1.5 w-1.5 rounded-full ${i === 2 ? 'bg-primary' : 'bg-slate-300'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-slate-800 text-sm">Dinner</h4>
                <Badge variant="secondary" className="bg-white shadow-sm text-orange-700 h-5 px-1.5 text-[10px] border border-orange-100">
                  <Flame className="w-3 h-3 mr-1" /> {plan.calories} kcal
                </Badge>
              </div>
              <p className="text-slate-700 text-sm mb-2">{plan.meal}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/50 w-fit px-2 py-1 rounded-md">
                <Check className="w-3 h-3 text-green-500" /> Ingredients matched
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
