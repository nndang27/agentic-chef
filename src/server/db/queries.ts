// server/db/queries.ts
"use server";
import "server-only";
import { db } from "."; // Import từ file index.ts của bạn
import { recipes, recipePrices, comments, likes } from "./schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import type { RecipeData, RecipePriceData } from "./schema"; 
// import {type RecipePriceData} from "../agents/search_Price";
import { clerkClient } from "@clerk/nextjs/server";
// Định nghĩa Type đầu vào cho hàm save (bỏ id vì db tự sinh)
type SaveRecipeInput = Omit<RecipeData, "id">;
type SavePriceInput = RecipePriceData;

export interface InteractionData {
  total_like: number;
  is_liked: boolean;
}

export async function saveRecipeToDatabase(
  recipeData: SaveRecipeInput,
  priceData: SavePriceInput
) {
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  try {
    // Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
    // (Nếu lưu recipe thành công mà lưu giá thất bại thì rollback hết)
    const result = await db.transaction(async (tx) => {
      
      // 1. Insert Recipe
      const [insertedRecipe] = await tx
        .insert(recipes)
        .values({
          userId: user.userId,
          title: recipeData.title,
          imageUrl: recipeData.image,
          serves: recipeData.serves,
          cookTime: recipeData.cook_time,
          prepTime: recipeData.prep_time,
          ingredients: recipeData.ingredients,
          steps: recipeData.steps,
          nutrition: recipeData.nutrition_estimate,
          chefTips: recipeData.chef_tips,
        })
        .returning({ id: recipes.id }); // Lấy ID vừa tạo

      if (!insertedRecipe) throw new Error("Failed to insert recipe");

      // 2. Tính toán tổng tiền sơ bộ (Optional - tốt cho việc hiển thị danh sách sau này)
      // Logic tính tổng đơn giản từ dữ liệu priceData
      let totalColes = 0;
      let totalWoolies = 0;
      
      // Bạn có thể viết logic tính tổng ở đây nếu muốn lưu vào DB
      // Ví dụ đơn giản (Cần logic phức tạp hơn ở frontend để chọn product nào, ở đây mình chỉ lưu raw data)
      
      // 3. Insert Price Data
      if(priceData!=null){
        await tx.insert(recipePrices).values({
          recipeId: insertedRecipe.id,
          priceData: priceData.IngredientPricePerRecipe,
          // totalColes: ..., 
          // totalWoolworths: ...
      });
    }

      return insertedRecipe.id;
    });

    return { success: true, recipeId: result };
  } catch (error) {
    console.error("Error saving recipe:", error);
    throw new Error("Failed to save recipe");
  }
}

export async function getAllUsersRecipes() {
  try {
    // 1. Lấy userId của người đang đăng nhập để check xem họ đã like chưa
    const { userId: currentUserId } = await auth();

    const allRecipes = await db.query.recipes.findMany({
      orderBy: [desc(recipes.createdAt)],
      with: {
        priceInfo: true,
        likes: true, // ⚠️ QUAN TRỌNG: Phải có dòng này mới lấy được danh sách like
      },
    });

    // -------------------------
    // Logic lấy thông tin User từ Clerk (Giữ nguyên)
    const userIds = [...new Set(allRecipes.map((r) => r.userId))];
    
    // Xử lý trường hợp không có user nào để tránh lỗi gọi Clerk
    let userMap = new Map();
    if (userIds.length > 0) {
        const clerkUsers = await (await clerkClient()).users.getUserList({
          userId: userIds,
          limit: 100, 
        });
        const usersData = clerkUsers.data;
        userMap = new Map(usersData.map((user) => [user.id, user]));
    }
    // --------------------------

    const combinedResults = allRecipes.map((item) => {
      const author = userMap.get(item.userId);

      // --- LOGIC TÍNH TOÁN LIKE ---
      const totalLikes = item.likes.length;
      const isLikedByCurrentUser = currentUserId 
        ? item.likes.some((like) => like.userId === currentUserId) 
        : false;

      // 1. Object Recipe (Giữ nguyên Interface RecipeData cũ, KHÔNG thêm like vào đây)
      const recipe: RecipeData = {
        id: item.id,
        userId: author?.fullName || author?.username || "Unknown User", // Map tên hiển thị
        title: item.title,
        image: item.imageUrl ?? "",
        serves: item.serves,
        cook_time: item.cookTime,
        prep_time: item.prepTime,
        ingredients: item.ingredients,
        steps: item.steps,
        nutrition_estimate: item.nutrition || {},
        chef_tips: item.chefTips ?? "",
      };

      // 2. Object Price (Giữ nguyên)
      const ingredient_price: RecipePriceData = {
        IngredientPricePerRecipe: (item.priceInfo?.priceData as IngredientPriceList[]) || []
      };

      // 3. Object Interaction (Chứa thông tin Like tách riêng)
      const interaction: InteractionData = {
        total_like: totalLikes,
        is_liked: isLikedByCurrentUser
      };

      // RETURN: Trả về 3 object riêng biệt
      return {
        recipe,
        ingredient_price,
        interaction, // <-- Thông tin like nằm ở đây
      };
    });
    
    combinedResults.sort((a, b) => {
      return b.interaction.total_like - a.interaction.total_like;
    });
    
    return combinedResults;

  } catch (error) {
    console.error("🔴 Lỗi khi lấy tất cả recipes:", error);
    throw new Error("Could not fetch recipes from database");
  }
}

// Hàm lấy danh sách Recipe của User
export async function getUserRecipes() {
  const user = await auth();
  
  if (!user.userId) return [];

  const userRecipes = await db.query.recipes.findMany({
    where: eq(recipes.userId, user.userId),
    orderBy: [desc(recipes.createdAt)],
    with: {
      priceInfo: true, // Join lấy luôn thông tin giá
    },
  });

  return userRecipes;
}

// Hàm lấy chi tiết 1 Recipe
export async function getRecipeById(id: number) {
  // const user = await auth();
  // if (!user.userId) throw new Error("Unauthorized");

  const { userId: currentUserId } = await auth();

  const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, id),
      with: {
        priceInfo: true,
        
        // --- THÊM PHẦN NÀY ---
        comments: {
          // Sắp xếp bình luận mới nhất lên đầu
          orderBy: [desc(comments.createdAt)], 
        },
        likes: true, // Lấy luôn danh sách like để kiểm tra user đã like chưa
        // ---------------------
      },
    });

  const totalLikes = recipe?.likes.length;
  const isLikedByCurrentUser = currentUserId 
    ? recipe?.likes.some((like) => like.userId === currentUserId) 
    : false;
  console.log("recipe: ", recipe);


  if (!recipe) return null;
  // Security check: chỉ chủ sở hữu mới xem được (hoặc bỏ nếu public)
  // if (recipe.userId !== user.userId) throw new Error("Unauthorized access to recipe");

  return {
    interaction:{
      total_like: totalLikes,
      is_liked: isLikedByCurrentUser
    },
    current_recipe: recipe
  };
}