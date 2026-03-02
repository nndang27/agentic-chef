// "use client"
// src/app/recipe/[id]/page.tsx
import { getRecipeById } from "~/server/db/queries";
import { IngredientPriceAgent } from "../../_components/IngredientPriceAgent"; // Component hiển thị Coles/Woolies bạn đã viết
import { CommentSection } from "../../../components/CommentSection"; // Bạn sẽ viết component này sau
import { LikeButton } from "../../../components/LikeButton";
export default async function RecipeDetailPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const searched_recipe = await getRecipeById(Number(id));
  const interaction = searched_recipe?.interaction;
  const recipeData = searched_recipe?.current_recipe
  console.log("recipeData: ", recipeData);
  if (!recipeData) return <div>Recipe not found</div>;

  // Format lại dữ liệu để truyền vào IngredientPriceAgent
  const formattedPriceData = {
    IngredientPricePerRecipe: recipeData.priceInfo?.priceData || []
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* 1. Header & Image */}
      <section className="space-y-4">
        <img src={recipeData.imageUrl} className="w-full h-[400px] object-cover rounded-3xl" />
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">{recipeData.title}</h1>
          {/* <LikeButton recipeId={recipeData.id} /> */}
          <LikeButton 
            recipeId={recipeData.id} 
            initialLikes={interaction?.total_like} 
            initialIsLiked={interaction?.is_liked} 
          />
        </div> 
      </section>

      {/* 2. Price Comparison (Sử dụng lại component Agent của bạn) */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 italic">Price Comparison (Coles vs Woolworths)</h2>
        <IngredientPriceAgent recipesPriceData={[formattedPriceData]} />
      </section>

      {/* 3. Ingredients & Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="font-bold text-lg mb-2 underline">Ingredients</h2>
          <ul className="list-disc pl-5">
            {recipeData.ingredients.map((ing, i) => (
              <li key={i}>{ing.amount} {ing.item} - <span className="text-slate-400">{ing.notes}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-bold text-lg mb-2 underline">Cooking Steps</h2>
          {recipeData.steps.map((step) => (
            <div key={step.step} className="mb-4">
              <p className="font-bold text-blue-600">Step {step.step} ({step.time_minutes} min)</p>
              <p>{step.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Comments Section */}
      <hr />
      <CommentSection recipeId={recipeData.id} initialComments={recipeData.comments} />
    </div>
  );
}