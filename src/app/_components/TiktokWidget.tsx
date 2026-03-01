

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


// const mockVideos = await getVideoList();

interface AgentWidgetProps {
  isLoading: boolean;
  videoUrl: {video_id: string, url: string[], path: string[]} | null;
}

export function TikTokAgent({ isLoading , videoUrl}: AgentWidgetProps) {
  // if (isLoading) return <Skeleton className="w-full h-full rounded-2xl bg-slate-100" />;

  // console.log(mockVideos);
  // console.log("ABC: ", videoUrl);
  // console.log("videoUrl?.path: ", videoUrl?.path);
  // console.log("videoUrl?.path length: ", videoUrl?.path.length);
  return (
    <div className="py-10 bg-slate-100 min-h-screen">
          <h1 className="text-center mb-5 font-bold">TikTok Collection</h1>
          
          <TikTokFeed videoUrls={videoUrl?.path} />
          
    </div>
  );
}

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
