import { AgentState } from "../graph/state";
import { z } from "zod";
import {llm_summarizer} from "../lib/llm";
import {getAllColesIngredients, getProductImageFromUrl} from "../tools/getProductDetail";
// import { test_recipe } from "../test_recipe.json";
import test_recipe from "../test_recipe.json" with { type: "json" };
// 2. Destructure để lấy dữ liệu bạn cần
// const { test_recipe } = data;
import { type RecipeData } from "../graph/state";
// Schema for a single ingredient item
const IngredientItemSchema = z.object({
  id: z.number().describe("The ID or index corresponding to the input list."),
  original_name: z.string().describe("The original, unprocessed ingredient name."),
  normalized_name: z.string().describe(
    "The generic, concise product name suitable for searching in any supermarket (Coles, Woolworths, ALDI). " +
    "ACTION: REMOVE brand names (Coles, Woolworths), origins (Australian, Asia), " +
    "marketing terms (RSPCA Approved, Finest, Premium), and packaging info (pkt, can, bag). " +
    "KEEP only the core product name (e.g., 'Chicken Mince', 'Udon Noodles')."
  ),
});

// Root Schema for the output list
const IngredientSchema = z.object({
  ingredients: z.array(IngredientItemSchema).describe("A list of normalized ingredients ready for search."),
});



const ProductAnalysisItemSchema = z.object({
  id: z.number(),
  original_name: z.string(),
  
  // Bước 1: Lọc rác
  isCookingIngredient: z.boolean().describe(
    "Is this item a raw/primary food ingredient used for cooking? " +
    "(TRUE for: Meat, Veg, Fruit, Spices, Sauces, Noodles, Rice, Stock. " +
    "FALSE for: Gardening seeds, Pet food, Cleaning products, Ready-to-eat junk food/snacks like Potato Chips/Chocolate)."
  ),

  // Bước 2: So khớp bản chất
  isRequestByUser: z.boolean().describe(
    "Does this product satisfy the user's culinary need? " +
    "Ignore extra marketing adjectives (e.g., 'Organic', 'Premium', 'No Hormone', 'Baby', 'Large'). " +
    "Ignore word order (e.g., 'Choy Pak' == 'Pak Choy'). " +
    "Accept sub-types/synonyms (e.g., 'Vermicelli' IS 'Rice Noodles'). " +
    "For HERBS/VEG: Default to FRESH unless 'Powder'/'Dried' is explicitly requested. " +
    "TRUE if the core product is what the user asked for. FALSE otherwise."
  ),

//   reason: z.string().optional().describe("Brief reasoning (e.g., 'Exact match ignoring adjectives', 'Synonym match', 'Wrong form: Dried instead of Fresh').")
});

const AnalyzedSearchResultSchema = z.object({
  items: z.array(ProductAnalysisItemSchema),
});

const structuredLlm = llm_summarizer.withStructuredOutput(IngredientSchema);
const structuredLlmValidation = llm_summarizer.withStructuredOutput(AnalyzedSearchResultSchema);

const makePrompt=(inputForLlm: string)=>{

    return `
    You are an intelligent shopping assistant. Your task is to extract the "search term" from a list of recipe ingredients.

    GOAL: Create a generic product name that can be found at any supermarket (Coles, Woolworths, ALDI).

    NORMALIZATION RULES:
    1. REMOVE Brand Names: "Coles", "Woolworths", "Countdown", "Nestle", etc.
    2. REMOVE Origins/Marketing terms: "Australian", "RSPCA Approved", "Finest", "Premium", "Gourmet", "Asia", "Inspired".
    3. REMOVE Packaging/Quantity info if attached to the name: "pkt", "can", "bag", "large", "500g".
    4. KEEP the original name if it is already generic (e.g., "olive oil", "carrot").
    5. MAINTAIN the correct ID corresponding to the input.

    FEW-SHOT EXAMPLES:
    - Input: "[0] Coles Australian RSPCA Approved Chicken Mince"
    -> Output: "Chicken Mince"
    - Input: "[1] Coles Asia Udon Noodles"
    -> Output: "Udon Noodles"
    - Input: "[2] Woolworths Essentials Cannellini Beans"
    -> Output: "Cannellini Beans"
    - Input: "[3] olive oil"
    -> Output: "olive oil"
    - Input: "[4] coriander sprigs"
    -> Output: "coriander"
    - Input: "[5] Coles Vietnamese Inspired Beef Pho Stock"
    -> Output: "Beef Pho Stock"
    
    INGREDIENT LIST TO PROCESS:
    ${inputForLlm}
    `;
}

const makePromptValidate = (query: string, productsList: string)=>{
    return `
You are an expert Personal Shopper with deep culinary knowledge.
Your goal is to identify if a supermarket product matches a user's shopping list item.

USER REQUEST INGREDIENT: "${query}"

INSTRUCTIONS:
Evaluate each product in the list below using the following **"Culinary Equivalence Strategy"**:

---
**PHASE 1: NOISE REMOVAL (Mental Step)**
When comparing the Product Name to the User Query, mentally REMOVE:
1.  **Marketing Adjectives**: "Premium", "Finest", "Organic", "RSPCA Approved", "No Added Hormones", "Essentials", "Gold".
2.  **Origin/Brand**: "Australian", "Coles", "Woolworths", "Asian", "Thai".
3.  **State/Cut**: "Sliced", "Diced", "Whole", "Fillet", "Bunch", "Punnet", "Loose".

*Example Logic:* - Product: "Coles No Added Hormone Beef Rump Steak" -> Core Identity: "Beef Rump Steak".
- User Query: "Beef Rump Steak".
- Result: MATCH.

---
**PHASE 2: CORE IDENTITY MATCHING**
Check if the "Core Identity" matches the User Query:
1.  **Word Order**: Ignore order. "Choy Pak" === "Pak Choy".
2.  **Synonyms/Sub-classes**: 
    - "Vermicelli" IS A TYPE OF "Rice Noodles".
    - "Cilantro" IS "Coriander".
    - "Sirloin" IS A TYPE OF "Steak".
3.  **Inclusion**: If the product name contains the user query + extra descriptive words, it is a MATCH.
    - "Baby Buk Choy" matches "Buk Choy".
    - "Coriander Leaves" matches "Coriander".

---
**PHASE 3: FORM & INTENT CHECK**
1.  **Fresh vs. Dry**: 
    - If the user asks for a vegetable/herb (e.g., "Coriander", "Ginger"), assume they want **FRESH**. 
    - REJECT "Powder", "Ground", "Seeds", "Dried" (unless the user specifically asked for "Powder" or "Spice").
    - "Coriander" (Product) -> MATCH (Implicitly fresh).
    - "Coriander Seeds" -> NO MATCH (Wrong form).
2.  **Ingredient vs. Derivative**:
    - If user asks for "Chicken", REJECT "Chicken Salt" or "Chicken Flavoured Chips".
    - If user asks for "Pak Choy", REJECT "San Choy Bao Sauce".

---
**FINAL DECISION:**
- You MUST preserve the exact 'id' from the input list for each item.
- Set 'isCookingIngredient' to TRUE if it is food for cooking.
- Set 'isRequestByUser' to TRUE if it passes Phase 1, 2, and 3.
- If the Product Name contains the User Query text (ignoring brand/case), isRequestByUser MUST be TRUE.

PRODUCT LIST TO ANALYZE:
${productsList}
`;
}
const testList = [{
  serves: [ { value: '4', unit: 'people' } ],
  cook_time: [ { value: '25', unit: 'minute' }, { value: '1', unit: 'hour' } ],
  prep_time: null,
  ingredients: [
    {
      item: 'Coles Australian No Added Hormones Beef Rump Steak',
      amount: '750g',
      notes: null
    },
    {
      item: 'Coles Vietnamese Inspired Beef Pho Stock',
      amount: '1L',
      notes: null
    },
    { item: 'Asian Pak Choy', amount: null, notes: 'quartered' },
    {
      item: 'rice noodles or Coles Asia Vermicelli Rice Noodles',
      amount: '250g',
      notes: null
    },
    { item: 'coriander sprigs', amount: '1/3 cup', notes: null }
  ],
  steps: [
    {
      step: 1,
      action: 'Heat a large non-stick frying pan over high heat. Cook the beef for 2-3 mins each side for medium or until cooked to your liking. Set aside for 5 mins to rest. Thinly slice.',
      time_minutes: null
    },
    {
      step: 2,
      action: 'Meanwhile, place the stock in a large saucepan. Bring to the boil over medium heat. Remove the pan from heat. Add the pak choy. Stir until the pak choy just wilts.',
      time_minutes: null
    },
    {
      step: 3,
      action: 'Prepare the noodles following packet directions. Drain. Divide the noodles among serving bowls. Ladle over the broth and pak choy. Top with the beef. Sprinkle with coriander to serve.',
      time_minutes: null
    }
  ],
  nutrition_estimate: { calories: 519, protein: null, fat: null, sugar: null },
  chef_tips: null
}]

export interface ProductItem {
  barcode: string | null;
  product_name: string;
  product_brand: string;
  current_price: number;
  product_size: string;
  url: string;
  image_url: string;
}
export interface ValidatedProductItem {
  id: number;
  original_name: string;
  isCookingIngredient: boolean;
  isRequestByUser: boolean;
}

// export interface IngredientPriceList {
//     ingredient_name: string;
//     ingredient_list: ProductItem[]
// }

export interface IngredientStoreGroup {
  supermarket: 'COLES' | 'WOOLWORTHS';
  item_list: ProductItem[];
}

// 2. Cập nhật IngredientPriceList dùng cấu trúc mới
export interface IngredientPriceList {
  ingredient_name: string;
  ingredient_list: IngredientStoreGroup[]; // Thay đổi từ ProductItem[] sang IngredientStoreGroup[]
}


export interface RecipePriceData {
  // Bạn đang push object { IngredientPricePerRecipe } vào mảng
  recipe_id: number;
  IngredientPricePerRecipe: IngredientPriceList[];
}

const SUPERMARKET_LIST = ['COLES', 'WOOLWORTHS'];
function postProcessSearchResults(query: string, items: ValidatedProductItem[], productsList: ProductItem[], SUPERMARKET: string): ProductItem[] {
  // 1. Chuẩn hoá Query: Chuyển về chữ thường, bỏ ký tự đặc biệt, tách thành mảng từ
  const normalizeText = (text: string) => text.toLowerCase().trim();
  
  const queryWords = normalizeText(query)
    .split(/\s+/) // Tách theo khoảng trắng
    .filter(word => word.length > 0); // Loại bỏ chuỗi rỗng

  // Nếu Query quá ngắn (chỉ 1 từ), trả về nguyên gốc để tránh match sai (ví dụ "Corn" match "Popcorn")
  // Trừ khi bạn muốn áp dụng cho cả 1 từ, nhưng theo yêu cầu là "2 từ trở lên"
    const finalProductList = items.reduce((acc, item) => {
        // 1. Logic kiểm tra từ khoá (giữ nguyên logic của bạn)
        const normalizedName = normalizeText(item.original_name);
        const matchedCount = queryWords.filter(keyword => 
        normalizedName.includes(keyword)
        ).length;

        const containsAtLeastTwoKeywords = matchedCount >= 2;

        // 2. Kiểm tra điều kiện: (AI thấy đúng) HOẶC (Thuật toán đếm từ thấy đúng)
        if (containsAtLeastTwoKeywords || (item.isCookingIngredient && item.isRequestByUser)) {
            
            // 3. Lấy ra sản phẩm gốc từ danh sách productsList
            // Lưu ý: item.id ở bước trước chính là index của mảng productsList, 
            // nên dùng productsList[item.id] sẽ nhanh hơn .find()
            let product = productsList[item.id]; 
            if (product) {
                product.image_url = getProductImageFromUrl(product.url, SUPERMARKET) ?? "";
                
            }
            
            acc.push(product);
            // console.log("product: ", product);
            
        }

        return acc;
    }, []);

    return finalProductList;
}


// const testListIngredients = 
// 
export const searchPriceAgentNode = async (state: typeof AgentState.State, config: any) => {
    console.log("**********************************************************************");
    console.time("⏱️ SEARCH PRICE running TIME:");
    let recipesList: RecipeData[] = [];
    

    if (state.cached_ingredients.includes("depend_on_recipe")) {
      // TRƯỜNG HỢP 1: Lấy danh sách recipe đã có sẵn
      recipesList = state.recipesList;
      if(recipesList.length===0){
        return {
          finished_branches: ["search_price_done"],
          ingredientPriceList: []
        };
      }
    } else {
      // TRƯỜNG HỢP 2: Tạo RecipeData giả từ danh sách string nguyên liệu
      // Ví dụ: state.cached_ingredients = ["onion", "garlic", "beef"]
      
      recipesList = state.cached_ingredients.map((ingredientName, index) => {
        return {
          id: index + 100000, // Tạo ID giả để không trùng lặp
          title: ingredientName, // Dùng tên nguyên liệu làm tiêu đề để hiển thị
          image: "", // Không có ảnh
          serves: [],
          cook_time: [],
          prep_time: null,
          
          // Quan trọng: Gán string vào item của Ingredient
          ingredients: [
            {
              item: ingredientName,
              amount: null, 
              notes: null
            }
          ],
          
          steps: [], // Không có bước nấu
          nutrition_estimate: {},
          chef_tips: ""
        } as RecipeData;
      });
      console.log("recipesList for each ingredient: \n", JSON.stringify(recipesList, null, 2));
    }

    const recipesListWithPrice: RecipePriceData[] = [];
    for (const recipe of recipesList) {
        const itemNames = recipe.ingredients
          .map((r, index) => `[${index}] ${r.item}`)
          .join("\n");
        
        const prompt = makePrompt(itemNames);
        
        const result = await structuredLlm.invoke(prompt);
        const recipe_ID = recipe.id;
        const ingredientAggregationMap = new Map<string, IngredientStoreGroup[]>();
        for (const supermarket of SUPERMARKET_LIST) {
          const SearchedPrice = await getAllColesIngredients(result, supermarket);          
          // -------- Lọc sản phẩm -------------------
          for (const query of SearchedPrice) {
              const productName = query.data.query;
              const productsList = query.data.results
                .map((item, index) => `[${index}]: ${item.product_name}`)
                .join("\n");


              const validatedPrompt = makePromptValidate(productName, productsList);
              const resultValidation = await structuredLlmValidation.invoke(validatedPrompt);

              const finalProductList: ProductItem[] = postProcessSearchResults(
                productName, 
                resultValidation.items, 
                query.data.results,
                supermarket
              );

              const storeGroup: IngredientStoreGroup = {
                    supermarket: supermarket as 'COLES' | 'WOOLWORTHS',
                    item_list: finalProductList
              };

              if (!ingredientAggregationMap.has(productName)) {
                    ingredientAggregationMap.set(productName, []);
              }
              ingredientAggregationMap.get(productName)?.push(storeGroup);
              // console.log("ingredientAggregationMap (Current): ", 
              //     JSON.stringify(Object.fromEntries(ingredientAggregationMap), null, 2)
              // );
              // console.log("-------------------");
            }

            // console.log("ingredientAggregationMap: ", JSON.stringify(ingredientAggregationMap, null, 2));
            // console.log("*********************************************************************");
          }
          const IngredientPricePerRecipe: IngredientPriceList[] = [];
          ingredientAggregationMap.forEach((groups, name) => {
              IngredientPricePerRecipe.push({
                  ingredient_name: name,
                  ingredient_list: groups // Mảng này sẽ chứa cả Coles và Woolworths (nếu tìm thấy)
              });
          });

          // 4. Push kết quả của Recipe này vào danh sách tổng
          recipesListWithPrice.push({
            recipe_id : recipe_ID,
            IngredientPricePerRecipe: IngredientPricePerRecipe
          });
      
    }
    console.log(".......................\n");
    console.log("recipesListWithPrice: \n", JSON.stringify(recipesListWithPrice, null, 2));
    console.timeEnd("⏱️ SEARCH PRICE running TIME:");
    console.log("**********************************************************************\n");
    
    return {
        finished_branches: ["search_price_done"],
        ingredientPriceList: recipesListWithPrice
    };

}

// searchPriceAgentNode();