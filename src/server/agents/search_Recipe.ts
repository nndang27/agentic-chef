import { AgentState } from "../graph/state";
import { searchRecipe } from "../tools/searchRecipe1";
import { AIMessage } from "@langchain/core/messages";
import axios from "axios";
import { z } from "zod";
import { scrapeContent } from "../tools/searchRecipe1";
import {llm_summarizer} from "../lib/llm";
import { GetColesRecipeDetail } from "../tools/getRecipeDetails";
import { parseRecipeStructured } from "../tools/getRecipeDetails";
import { getColesRecipeList } from "../tools/getRecipeList";
import { type RecipeData } from "../graph/state";

const RecipeSchema = z.object({
//   name: z.string().describe("The name of the dish."),
  serves: z.array(
    z.object({
      value: z.string().describe("The value of the serves."),
      unit: z.string().nullable().describe("The unit of the serves (people)"),
    })
  ).nullable().describe("Total serves"),
  cook_time: z.array(
    z.object({
      value: z.string().describe("The value of the cook time."),
      unit: z.string().nullable().describe("The unit of the cook time (hours, minute, second, day)"),
    })
  ).nullable().describe("Total time to cook"),
  prep_time: z.array(
    z.object({
      value: z.string().describe("The value of the prep time."),
      unit: z.string().nullable().describe("The unit of the prep time (hours, minute, second, day)"),
    })
  ).nullable().describe("Total time to prepare"),
//   description: z.string().nullable().describe("A short description of the dish."),
  
  ingredients: z.array(
    z.object({
      item: z.string().describe("The CLEAN name of the ingredient (e.g., 'Beef', 'Onion', 'Flour'). Do NOT include quantities here."),
      amount: z.string().nullable().describe("The quantity and unit (e.g., '500g', '2 cups', '1 tbsp'). PRIORITIZE Metric units (grams/ml) if possible."),
      notes: z.string().nullable().describe("Preparation notes or state (e.g., 'minced', 'chopped', 'sliced thinly', 'room temperature')."),
    })
  ).nullable().describe("List of ingredients required."),

  steps: z.array(
    z.object({
      step: z.number(),
      action: z.string(),
      time_minutes: z.number().nullable(),
    })
  ).nullable(),

  nutrition_estimate: z.object({
    calories: z.number().nullable(),
    protein: z.string().nullable(),
    fat: z.string().nullable(),
    sugar: z.string().nullable(),
  }).nullable(),
  
  chef_tips: z.string().nullable(),
});


const createColesUrl = (query:string) => {
  // const baseUrl = "https://www.coles.com.au/search/recipes?q="; // COLES

  const baseUrl = "https://www.taste.com.au/search-recipes/?q="; // TASTE
  
  const slug = query
    .toLowerCase()                          // 1. Chuyển tất cả sang chữ thường
    .replace(/&/g, 'and')                   // 2. Thay dấu '&' thành chữ 'and' (thường dùng trong URL)
    .replace(/[^a-z0-9\s-]/g, '')           // 3. Xóa hết ký tự đặc biệt (!, @, #, v.v...) chỉ giữ lại chữ, số, khoảng trắng
    .trim()                                 // 4. Cắt khoảng trắng thừa ở đầu và cuối
    .replace(/\s+/g, '-')                   // 5. Thay tất cả khoảng trắng (bao gồm cả nhiều khoảng trắng liền nhau) thành 1 dấu gạch ngang
    .replace(/-+/g, '-');                   // 6. Đảm bảo không có dấu gạch ngang kép (ví dụ --)

  return `${baseUrl}${slug}`;
};

// export const recipeAgentNode = async () => {
export const recipeAgentNode = async (state: typeof AgentState.State, config: any) => {
  let userQuery = [""];
  if(state.quickMode.length > 0){
      if(state.quickMode.includes("RECIPE")){
          if(state.quickQuery.recipeDish !== ""){
              state.current_dish = state.quickQuery.recipeDish;
              userQuery = [state.quickQuery.recipeDish];
          }
      }
  }
  else{
    userQuery = [state.current_dish];
  }

  console.log("**********************************************************************\n");
  console.time("⏱️ SEARCH RECIPE running TIME:");
  if(userQuery[0] === ""){
    return {
      finished_branches: ["search_recipe_done"],
      recipesList: []
    };
  }
  // --------------------------------------------------------------------------------
  
  let fullContent = "";
  let sourceUrl = "";
  let ListRecipe: RecipeData[] = [];
  // const test__url = "https://www.coles.com.au/recipes-inspiration/recipes/easy-beef-pho"
  for (const userDish of userQuery) {
        const ColesUrl = createColesUrl(userDish);
        console.log("ColesUrl: ", ColesUrl);
        const recipeList = await getColesRecipeList(userDish, ColesUrl);
        console.log("Best recipe: ",recipeList[0]);
        // const bestRecipeLink = recipeList?[0].recipe_url;
        const bestRecipeLink = recipeList[0]?.recipe_url;
        const content_scraped = await GetColesRecipeDetail(bestRecipeLink);
        // Kiểm tra sơ bộ xem content có đủ dài không (tránh trang lỗi)
        console.log("content_scraped: ", content_scraped);
        const parsed = parseRecipeStructured(content_scraped);
        console.log("parsed: ", parsed);
        if (content_scraped.length > 100) { 

            sourceUrl = ColesUrl;
            fullContent = content_scraped;
            // sourceUrl = url_results.url;

            // ------------------- Extract by LLM ---------------------------
            const structuredLlm = llm_summarizer.withStructuredOutput(RecipeSchema);
            const prompt = `
                You are a Culinary Data Engineer for an Australian Grocery App.
                Your goal is to parse pre-segmented recipe data into a strict JSON structure.

                ### INPUT DATA SECTIONS:
                1. **METADATA:** Contains prep time, cook time, and servings.
                2. **INGREDIENTS:** Raw list of items.
                3. **METHOD:** Cooking instructions.

                ---
                ### SECTION 1: METADATA EXTRACTION
                    Input: """${parsed.timeInfo}"""

                    **STRICT EXTRACTION & PARSING RULES:**
                    You must extract cleaner data and structure it into arrays of { value, unit }.

                    1. **CLEAN REPETITION ARTIFACTS (First Priority):**
                    - The input often contains duplicated text like "2 hr 2 hour" or "Serves 4 4".
                    - **Rule:** Ignore the redundant repetition. Only extract the unique value ONCE.
                    - *Example:* "2 hr 2 hour" -> Treat as "2 hours".

                    2. **STRUCTURING RULES (Array Format):**
                    - **Composite Times:** If a time is "1 hour 30 mins", split it into TWO objects in the array.
                        -> [{ value: "1", unit: "hour" }, { value: "30", unit: "minute" }]
                    - **Simple Times:** "25 mins" -> [{ value: "25", unit: "minute" }]
                    - **Serves:** "Serves 4" -> [{ value: "4", unit: "people" }]
                    
                    3. **UNIT NORMALIZATION:**
                    - Normalize units to singular/plural full words: "hour", "hours", "minute", "minutes".
                    - If no unit is found (e.g. just "Serves 4"), set unit to "people" for serves, or null.
                ---
                ### SECTION 2: INGREDIENTS INSTRUCTIONS (CRITICAL)
                Input: """${parsed.ingredients}"""
                - **Rule 1 (Field Mapping):**
                    - 'item': The product name ONLY (e.g., "Basmati Rice"). Remove brands like "Coles" unless essential.
                    - 'amount': The quantity + unit (e.g., "2 cups", "500g"). 
                    - 'notes': The state or prep (e.g., "chopped", "thinly sliced", "room temp").
                - **Rule 2 (Metric Conversion - AU):** - You MUST convert US units to Metric approximation in 'amount'.
                    - 1 lb -> ~450g
                    - 1 oz -> ~28g
                    - 1 stick butter -> ~113g
                    - 1 cup flour -> ~150g (approx)
                - **Rule 3 (Formatting):**
                    - Input: "2 cloves garlic, crushed" -> { item: "Garlic", amount: "2 cloves", notes: "crushed" }
                    - Input: "Salt and pepper" -> { item: "Salt and pepper", amount: "to taste", notes: null }

                ---
                ### SECTION 3: METHOD INSTRUCTIONS
                Input: """${parsed.method}"""
                - Split instructions into logical steps.
                - **'time_minutes':** If a step says "simmer for 20 mins", extract 20. If no specific time, set null.
                - **'chef_tips':** If the method mentions crucial advice (e.g., "Do not overmix"), summarize it here.
                - **'nutrition_estimate':** If nutritional info is explicitly present in the text, extract it. Otherwise return null.

                ---
                ### SECTION 4: NUTRITION ESTIMATE
                Input: """${parsed.nutrition || "NO_DATA_AVAILABLE"}""" 

                **STRICT EXTRACTION LOGIC:**
                1. **SHORT CIRCUIT (CRITICAL):** - IF the Input is "NO_DATA_AVAILABLE", empty, or just whitespace -> **RETURN NULL IMMEDIATELY**.
                   - DO NOT try to find data in other sections.
                   - DO NOT use data from previous examples.
                2. **VALIDATION:**
                   - **Calories:** Must be a number (extract "Cals"/"kcal"). Ignore "kJ".
                   - **Sugar/Fat/Protein:** Must look like nutritional macros (e.g. "5g", "10.2g"). 
                ---
                ### FINAL OUTPUT FORMAT:
                Return ONLY the valid JSON object matching the Schema.
                `;
            const result = await structuredLlm.invoke(prompt);
            console.log("Recipe result: \n", result);
            console.timeEnd("⏱️ recipeAgentNode time");

            const reFormattedRecipes: RecipeData = {
                id: 1, // Tự sinh ID (hoặc dùng Date.now())
                
                // Model không trả về Title, nên ta cần một fallback name
                // Hoặc logic thông minh hơn: Lấy tên ingredient chính để đặt tên
                title: recipeList[0].name || "N/A", 
                
                // Placeholder Image (Vì model không trả về ảnh)
                image: recipeList[0].image_url || "N/A",
                
                serves: result?.serves || "N/A",
                cook_time: result?.cook_time || "N/A",
                prep_time: result?.prep_time || "N/A",
                ingredients: result?.ingredients || "N/A",
                steps: result?.steps || "N/A",
                
                // Xử lý Nutrition: Convert null thành string "N/A" hoặc "-" để khớp interface string | number
                nutrition_estimate: {
                  calories: result?.nutrition_estimate?.calories || "N/A",
                  protein: result?.nutrition_estimate?.protein || "N/A",
                  fat: result?.nutrition_estimate?.fat || "N/A",
                  sugar: result?.nutrition_estimate?.sugar || "N/A",
                },

                // Xử lý Chef Tips: Convert null thành string rỗng hoặc câu mặc định
                chef_tips: result?.chef_tips || "Enjoy your meal with fresh ingredients!",
              };
              ListRecipe.push(reFormattedRecipes);
            
        }
            // ---------------------------------------------------------------
    }
    console.log("ListRecipe: \n", ListRecipe);
    console.timeEnd("⏱️ SEARCH RECIPE running TIME:");
    console.log("**********************************************************************\n");
    
    return { 
      finished_branches: ["search_recipe_done"], 
      recipesList: ListRecipe
    };
}




// recipeAgentNode();