"use client"

import { motion } from "framer-motion";
import { Heart, Clock, Users, ExternalLink } from "lucide-react";
import { RecipeData, RecipePriceData } from "@/server/db/schema";
import Link from "next/link"; // Thêm import này
import { LikeButton } from "../../components/LikeButton";
// Định nghĩa interface cho item nhận vào từ API combined
interface InteractionData {
  total_like: number;
  is_liked: boolean;
}

interface RecipeFeedItem {
  recipe: RecipeData;
  ingredient_price: RecipePriceData;
  interaction: InteractionData;
}

export function RecipeFeed({ recipes }: { recipes: RecipeFeedItem[] }) {
  
  // Hàm helper tính tổng tiền từ danh sách giá để hiển thị lên card
  const calculateTotal = (priceData: RecipePriceData) => {
      const totals = priceData.IngredientPricePerRecipe.reduce(
        (acc, ing) => {
          // 1. Lấy giá sản phẩm đầu tiên của Coles cho nguyên liệu này
          const colesItem = ing.ingredient_list.find((s) => s.supermarket === "COLES")?.item_list[0];
          const colesPrice = colesItem?.current_price || 0;

          // 2. Lấy giá sản phẩm đầu tiên của Woolworths cho nguyên liệu này
          const wooliesItem = ing.ingredient_list.find((s) => s.supermarket === "WOOLWORTHS")?.item_list[0];
          const wooliesPrice = wooliesItem?.current_price || 0;

          return {
            coles: acc.coles + colesPrice,
            woolies: acc.woolies + wooliesPrice,
          };
        },
        { coles: 0, woolies: 0 }
      );

      // 3. So sánh và trả về giá trị nhỏ nhất (Best Price)
      // Nếu một bên bằng 0 (do không tìm thấy món nào), ta ưu tiên lấy bên còn lại
      if (totals.coles === 0) return totals.woolies;
      if (totals.woolies === 0) return totals.coles;

      return Math.min(totals.coles, totals.woolies);
    };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {recipes.map((item, index) => {
          const { recipe, ingredient_price, interaction } = item;
          const totalPrice = calculateTotal(ingredient_price);

          return (
            <motion.div
              key={`${recipe.id}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ y: -8 }}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl border border-slate-100 transition-all duration-300 flex flex-col"
            >
              {/* Image Section */}
              <Link href={`/recipe/${recipe.id}`} className="block">
              <div className="aspect-[16/10] relative overflow-hidden bg-slate-100">
                <img
                  src={recipe.image || "/api/placeholder/400/300"} // Fallback nếu không có ảnh
                  alt={recipe.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl text-sm font-bold text-emerald-600 shadow-lg border border-emerald-100">
                  ${totalPrice.toFixed(2)}
                </div>
              
                {/* Overlay khi hover */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                   <div className="bg-white text-slate-900 px-4 py-2 rounded-full font-bold text-sm shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                      View Recipe <ExternalLink className="w-4 h-4" />
                   </div>
                </div>
              </div>
              </Link>
              {/* Content Section */}
              <div className="p-6 flex flex-col flex-1 space-y-4">
                
                <div className="space-y-2">
                  <Link href={`/recipe/${recipe.id}`}>
                  <h3 className="font-bold text-xl text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                    {recipe.title}
                  </h3>
                  </Link>
                  {/* Stats: Cook time & Serves */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {recipe.cook_time[0]?.value} {recipe.cook_time[0]?.unit}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Serves {recipe.serves[0]?.value}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-500 line-clamp-2 italic">
                  "{recipe.chef_tips}"
                </p>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                      {recipe.title.charAt(0)}
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{recipe.userId}</span>
                  </div>
                  
                  {/* <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 px-2.5 py-1 rounded-lg"> */}
                    {/* <Heart className="w-3.5 h-3.5 fill-current" />
                    <span className="font-bold text-xs">AI Optimized</span> */}
                    <LikeButton 
                      recipeId={recipe.id} 
                      initialLikes={interaction.total_like} 
                      initialIsLiked={interaction.is_liked} 
                    />
                  {/* </div> */}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}