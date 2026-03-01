"use client";

import React, { useState } from "react";
import { Clock, Users, ChefHat, Info , Loader2} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- 1. Interface Definitions ---
interface Ingredient {
  item: string;
  amount: string | null;
  notes: string | null;
}

interface Step {
  step: number;
  action: string;
  time_minutes: number | null;
}

export interface RecipeData {
  id: number;
  title: string; // Thêm title để hiển thị
  image: string; // Thêm ảnh cho popup preview
  serves: { value: string; unit: string }[];
  cook_time: { value: string; unit: string }[];
  prep_time: { value: string; unit: string }[] | null;
  ingredients: Ingredient[];
  steps: Step[];
  nutrition_estimate: { [key: string]: string | number };
  chef_tips: string;
}

// --- 2. Mock Data (7 Days) ---
// Nhân bản data mẫu của bạn thành 7 ngày
const MOCK_RECIPES: RecipeData[] = Array.from({ length: 7 }).map((_, i) => ({
  id: i,
  title: i === 0 ? "Beef Rump Steak Pho" : `Day ${i + 1} Special Meal`,
  image: "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2070&auto=format&fit=crop", // Ảnh placeholder
  serves: [{ value: "4", unit: "people" }],
  cook_time: [{ value: "25", unit: "minute" }],
  prep_time: null,
  ingredients: [
    { item: "Coles Australian No Added Hormones Beef Rump Steak", amount: "750g", notes: null },
    { item: "Coles Vietnamese Inspired Beef Pho Stock", amount: "1L", notes: null },
    { item: "Asian Pak Choy", amount: null, notes: "quartered" },
    { item: "Rice Noodles", amount: "250g", notes: null },
    { item: "Coriander Sprigs", amount: "1/3 cup", notes: null },
    { item: "Lebanese cucumber", amount: "1", notes: "peeled into ribbons" }, // Thêm từ ảnh mẫu
    { item: "Kimchi", amount: "2 tbs", notes: null },
  ],
  steps: [
    {
      step: 1,
      action: "Combine the cucumber, vinegar and sugar in a medium bowl. Season well with salt. Set aside for 15 mins to develop the flavours.",
      time_minutes: null,
    },
    {
      step: 2,
      action: "Meanwhile, combine the kimchi and mayonnaise in a small bowl. Season.",
      time_minutes: null,
    },
    {
      step: 3,
      action: "Drain the cucumber mixture. Spread the bread slices with the mayonnaise mixture. Top half the bread slices with salad mix, beef, cucumber and cheese.",
      time_minutes: null,
    },
  ],
  nutrition_estimate: { calories: 519, protein: ">46g", fat: ">6g", sugar: "1g (1%)" },
  chef_tips: "Use it up: Make beef burrito bowls with the leftover brisket. For inspiration, check out our Quick Beef Burrito Bowls.",
}));


interface RecipeWidgetProps {
  isSearching?: boolean;
  recipesList: RecipeData[]; 
  // 👇 Đây là prop hàm callback bạn muốn truyền vào
  // Nó nhận vào recipe và index, trả về Promise (để hiện loading)
  onSaveRecipe: (recipe: RecipeData, index: number) => Promise<void>;
}

// --- 3. Component ---
export function RecipeWidget({ isSearching = true, recipesList , onSaveRecipe}: RecipeWidgetProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredDotIndex, setHoveredDotIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  if(!recipesList){
    recipesList = MOCK_RECIPES;
  }
  const currentRecipe = recipesList[activeIndex];

  const handleInternalClick = async () => {
      if (!currentRecipe) return;

      setIsSaving(true); // Bật loading
      try {
        // 👇 GỌI HÀM CỦA CHA (PASS DỮ LIỆU RA NGOÀI)
        await onSaveRecipe(currentRecipe, activeIndex);
      } catch (error) {
        console.error("Lỗi khi lưu:", error);
      } finally {
        setIsSaving(false); // Tắt loading dù thành công hay thất bại
      }
    };

  return (
    <div className=
    {`w-full h-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden font-sans relative`}
    >
{/* ---------------- LOADING OVERLAY ---------------- */}
      {/* Lớp phủ này sẽ hiện lên đè lên toàn bộ widget khi isSearching = true */}
{isSearching && (
        <div className="absolute inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex flex-col items-center justify-center text-slate-600 animate-in fade-in duration-300">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
          <span className="text-sm font-semibold tracking-wide animate-pulse">
            Searching the Internet for recipe...
          </span>
        </div>
      )}
        {/* TRƯỜNG HỢP 2: ĐÃ TÌM XONG (HOVER ĐỂ MỞ RỘNG) */}

      
      {/* Header: Navigation & Title */}
      <div className="shrink-0 border-b border-slate-100 p-4 pb-2 bg-white z-20">
        
        {/* Navigation Dots */}
        <div className="flex justify-center items-center gap-3 mb-3 relative">
          {recipesList.map((recipe, index) => (
            <div
              key={index}
              className="relative py-2 group cursor-pointer" // Tăng vùng hover
              onMouseEnter={() => setHoveredDotIndex(index)}
              onMouseLeave={() => setHoveredDotIndex(null)}
              onClick={() => setActiveIndex(index)}
            >
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  activeIndex === index
                    ? "bg-red-600 scale-125 shadow-md"
                    : "bg-slate-300 hover:bg-red-300"
                }`}
              />
            </div>
          ))}

          {/* Popup Preview - Hiển thị khi hover vào vùng dots */}
          <AnimatePresence>
            {hoveredDotIndex !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-white p-2 rounded-lg shadow-xl border border-slate-100 w-48"
              >
                <div className="aspect-video w-full rounded-md overflow-hidden bg-slate-100 mb-2">
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={recipesList[hoveredDotIndex].image} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs font-bold text-slate-700 text-center truncate">
                  {recipesList[hoveredDotIndex].title}
                </p>
                <div className="flex justify-center gap-2 mt-1 text-[10px] text-slate-500">
                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3"/> {recipesList[hoveredDotIndex].cook_time[0].value}m</span>
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3"/> {recipesList[hoveredDotIndex].serves[0].value}</span>
                </div>
                {/* Mũi tên trỏ lên */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45"></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recipe Header Info */}
        <div className="flex justify-between items-end">
            <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">{currentRecipe.title || "No title"}</h2>
                <div className="flex gap-4 mt-1 text-sm text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-red-500" />
                    <span>Serves {currentRecipe.serves[0].value}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-red-500" />
                    <span>{currentRecipe.cook_time[0].value} {currentRecipe.cook_time[0].unit}</span>
                </div>
                </div>
            </div>
            {/* Nút Action giả lập */}
            <button 
            onClick={handleInternalClick}
            disabled={isSaving}
            className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
            >
                Save Recipe
            </button>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* LEFT COL: Ingredients & Nutrition */}
          <div className="space-y-8">
            {/* Ingredients */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Ingredients</h3>
              <ul className="space-y-3">
                {currentRecipe.ingredients.map((ing, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 group">
                    {/* Bullet point màu đỏ custom */}
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 group-hover:scale-125 transition-transform" />
                    <span className="leading-relaxed">
                      {ing.amount && <span className="font-semibold">{ing.amount} </span>}
                      {ing.item}
                      {ing.notes && <span className="text-slate-500 italic">, {ing.notes}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Nutrition Information */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Nutritional information</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Per Serve: Energy: {currentRecipe.nutrition_estimate.calories}kJ, 
                Protein: {currentRecipe.nutrition_estimate.protein}, 
                Fat: {currentRecipe.nutrition_estimate.fat}, 
                Sugar: {currentRecipe.nutrition_estimate.sugar}.
              </p>
              <p className="text-[10px] text-slate-400 mt-2 italic">
                Nutritional analysis is an estimate only and uses branded products where possible.
              </p>
            </div>
          </div>

          {/* RIGHT COL: Method & Tips */}
          <div className="space-y-8">
            {/* Method */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Method</h3>
              <div className="space-y-6">
                {currentRecipe.steps.map((step) => (
                  <div key={step.step} className="flex flex-col gap-1">
                    <span className="text-red-600 font-bold text-sm uppercase tracking-wide">
                      Step {step.step}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {step.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recipe Tip Box */}
            <div className="bg-[#FFFBF2] border border-[#F5E6C8] rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-red-600 p-1.5 rounded-full">
                    <ChefHat className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-bold text-slate-800">Recipe tip</h4>
              </div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                COOK. STORE. SAVE.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {currentRecipe.chef_tips}
              </p>
            </div>
          </div>
        </div>
        
      </div>

    </div>
  );
}