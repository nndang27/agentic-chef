// src/app/api/test-save/route.ts
import { NextResponse } from "next/server";
import { saveRecipeToDatabase, getAllUsersRecipes } from "~/server/db/queries"; // Import hàm bạn vừa viết
// import  test_recipe  from "~/server/test_recipe.json"; // Import data giả
// import test_ingredient_price from '~/server/test_ingredient_price.json';
import {type RecipeData } from "../_components/RecipeWidget";


export async function GET() {
  try {
    // Gọi hàm lưu database
    const result: RecipeData[] = await getAllUsersRecipes();

    console.log(result);
    for (let i = 0; i < result.length; i++) {
      const recipe = result[i];
      await saveRecipeToDatabase(recipe);
    }
    return NextResponse.json({
      success: true,
      message: "Recipe saved successfully!",
      data: result,
    });
  } catch (error) {
    console.error("🔴 Save failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}