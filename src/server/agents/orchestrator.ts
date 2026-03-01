import { z } from "zod";
import { baseLlm } from "../lib/llm";
import { AgentState } from "../graph/state";
import { SystemMessage } from "@langchain/core/messages";
import { UserProfileService } from "../memory/userProfile";
// Import schema vừa định nghĩa ở trên


// Intent: SEARCH_RECIPE
const SearchRecipeSchema = z.object({
  intent: z.literal("SEARCH_RECIPE"),
  dish_name: z.string().nullable().describe("The FULL name of the dish including adjectives and constraints (e.g., 'authentic Italian Carbonara no cream'). Return null if not specified."),
});

// Intent: SEARCH_VIDEO
const SearchVideoSchema = z.object({
  intent: z.literal("SEARCH_VIDEO"),
  dish_name: z.string().nullable().describe("The FULL search query for the video, including modifiers (e.g., 'no cream', 'vegan'). Return null if not specified."),
});

// Intent: SEARCH_MAP
const SearchMapSchema = z.object({
  intent: z.literal("SEARCH_MAP"),
  
  origin_address: z.string().nullable()
    .describe("The starting location (e.g., '100 George St'). Return null if NOT explicitly mentioned as a starting point."),
  
  destination_address: z.string().nullable()
    .describe("The target area or final destination (e.g. 'Parramatta' in 'on way to Parramatta', or 'Zetland' in 'near Zetland'). DO NOT include the object name like 'Coles' or 'Supermarket' here."),
  
  brand_preference: z.enum(["Coles", "Woolworths", "Any"]).nullable()
    .describe("The preferred supermarket brand. Logic: 'Not Coles' -> 'Woolworths'. 'Not Woolies' -> 'Coles'. No preference -> 'Any'."),
});

// Intent: SEARCH_PRICE
const SearchPriceSchema = z.object({
  intent: z.literal("SEARCH_PRICE"),
  specific_ingredients: z.array(z.string()).optional().describe("List of specific ingredients to check price for."),
});

// Intent: GENERAL_CHAT
const GeneralChatSchema = z.object({
  intent: z.literal("GENERAL_CHAT"),
  user_prompt: z.string().describe("The user's input prompt is kept entirely unchanged."),
});

// --- Create the Union ---
const IntentItemSchema = z.discriminatedUnion("intent", [
  SearchRecipeSchema,
  SearchVideoSchema,
  SearchMapSchema,
  SearchPriceSchema,
  GeneralChatSchema,
]);

export const SupervisorOutputSchema = z.object({
  reasoning: z.string().describe("Explain why these intents were chosen based on user input."),
  intents: z.array(IntentItemSchema).describe("List of detailed actionable intents."),
});
// ==========================================================================================
// ================================== ========================================================



const SYSTEM_PROMPT = `
You are the Orchestrator of a Cooking Assistant App. Your sole purpose is to route user input to the correct specific agent(s) and extract PRECISE parameters.

### CRITICAL ROUTING RULES:

1. **SEARCH_RECIPE & SEARCH_VIDEO (Entity Extraction)**:
   - **Capture Modifiers**: You MUST capture specific constraints in 'dish_name'.
     - Input: "Carbonara no cream" -> dish_name: "Carbonara no cream" (NOT just "Carbonara").
     - Input: "Authentic Italian Pizza" -> dish_name: "Authentic Italian Pizza".

2. **SEARCH_MAP (Location Logic)**:
   - **Origin**: Where the user is *starting* or *leaving from* (e.g., "from the gym", "at 100 George St").
   - **Destination**: The *final destination* or the *target area* for the search.
     - Rule: "On my way to [X]" -> Destination is **[X]**.
     - Rule: "Near [Y]" -> Destination is **[Y]**.
     - NEVER put the store name (e.g., "Coles") inside 'destination_address'.
   - **Brand Logic (Negation Handling)**:
     - "Coles" -> "Coles"
     - "Woolworths" / "Woolies" -> "Woolworths"
     - "Not Coles" -> "Woolworths" (Implies the alternative).
     - "Not Woolworths" -> "Coles".
     - "Grocery store" / "Supermarket" -> "Any".

3. **SEARCH_PRICE (Cost & Budgeting)**:
   - Trigger this when user asks about the price, cost, budget, or "how much" for ingredients.
   - If the user asks about "price of ingredients" for a specific dish (without naming specific items like "milk"), trigger this intent with an empty list [].
   - **Combined Intent**: Ideally, users often ask for a recipe AND its price. Return BOTH intents in the list.

4. **GENERAL_CHAT**:
   - Only use for greetings or identity questions. If ANY cooking/shopping intent exists, use specific agents.

### FEW-SHOT EXAMPLES (Study these carefully):

User: "I'm currently at 100 George St. Which Coles is best to stop at on my way to Parramatta?"
Output: intents=[{ "intent": "SEARCH_MAP", "origin_address": "100 George St", "destination_address": "Parramatta", "brand_preference": "Coles" }]

User: "Find me a grocery store that isn't Coles, preferably one near my apartment in Zetland."
Output: intents=[{ "intent": "SEARCH_MAP", "origin_address": null, "destination_address": "Zetland", "brand_preference": "Woolworths" }]

User: "Show me how to make Carbonara, but NOT the version with cream. I want the authentic Italian video guide."
Output: intents=[{ "intent": "SEARCH_VIDEO", "dish_name": "authentic Italian Carbonara no cream" }]

User: "Wait, did you say the supermarket is closed? I need to find another one near North Sydney then"
Output: intents=[{ "intent": "SEARCH_MAP", "origin_address": null, "destination_address": "North Sydney", "brand_preference": "Any" }]

User: "How can i cook chicken pizza and how about the price of ingredients?"
Output: intents=[
  { "intent": "SEARCH_RECIPE", "dish_name": "chicken pizza" },
  { "intent": "SEARCH_PRICE", "specific_ingredients": [] } 
]

User: "How much is 1kg of beef and a bottle of milk?"
Output: intents=[{ "intent": "SEARCH_PRICE", "specific_ingredients": ["1kg beef", "bottle of milk"] }]

`;
export const orchestratorNode = async (state: typeof AgentState.State, config: any) => {
    console.time("⏱️ supervisorNode logic");
    
    
    const messages = state.messages;
    const lastUserMessage = messages.slice().reverse().find((msg) => msg._getType() === "human");

    // Context Management
    console.log("is_first_turn: ", state.is_first_turn);
    const isFirstTurn = state.is_first_turn ?? true;
    let currentDish = state.current_dish;

    // Profile Fetching
    // const userId = config.configurable?.user_id || "default_user";
    // const userProfile = await UserProfileService.getProfile(userId);

    // --- CALL LLM ---
    const router = baseLlm.withStructuredOutput(SupervisorOutputSchema);
    const systemMessage = new SystemMessage(SYSTEM_PROMPT);

    let result;
    try {
        console.log(8);
        // console.log("router: ", router);
        result = await router.invoke([systemMessage, lastUserMessage.content]);
        console.log(99);
    } catch (error) {
        console.error("Router Error:", error);
        // Fallback
        return { next_active_agents: ["GENERAL_CHAT"] };
    }

    console.log("🔍 LLM Reasoning:", result.reasoning);

    // --- PROCESS INTENTS ---
    const nextActiveAgents = new Set<string>();

    // Variables to update in State
    let newOrigin = null;
    let newDest = null;
    let newBrandPreference = null;
    let newIngredients = state.cached_ingredients;
    console.log("results llm: \n", result);
    // Duyệt qua từng Intent object để xử lý logic riêng biệt
    for (const item of result.intents) {

        // Logic chung cho Recipe và Video: Cập nhật Dish name
        if (item.intent === "SEARCH_RECIPE" || item.intent === "SEARCH_VIDEO") {
            nextActiveAgents.add(item.intent); // Add agent name
            
            // Nếu LLM trích xuất được món mới -> Cập nhật State
            if (item.dish_name) {
            currentDish = item.dish_name;
            // Reset ingredient cũ nếu món ăn thay đổi
            // newIngredients = []; 
            }
        }

        // Logic riêng cho Map
        else if (item.intent === "SEARCH_MAP") {
            nextActiveAgents.add("SEARCH_MAP");
            
            // Cập nhật địa chỉ nếu user nói rõ trong câu này
            if (item.origin_address) newOrigin = item.origin_address;
            if (item.destination_address) newDest = item.destination_address;
            if(item.brand_preference) newBrandPreference = item.brand_preference;

            // // Logic Fallback: Nếu không có địa chỉ trong Prompt -> Lấy Profile
            // if (!newOrigin) newOrigin = userProfile?.work_address;
            // if (!newDest) newDest = userProfile?.home_address;

            // Safety check: Nếu vẫn thiếu địa chỉ -> Không chạy Agent Map
            // if (!newOrigin || !newDest) {
            // console.warn("⚠️ Bỏ qua SEARCH_MAP vì thiếu địa chỉ Origin/Dest.");
            // nextActiveAgents.delete("SEARCH_MAP");
            // nextActiveAgents.add("GENERAL_CHAT"); // Chat để hỏi địa chỉ
            // }
        }

        // Logic riêng cho Price
        else if (item.intent === "SEARCH_PRICE") {
            nextActiveAgents.add("SEARCH_PRICE");
            if (item.specific_ingredients && item.specific_ingredients.length > 0) {
                // Nếu user hỏi giá cụ thể: "Giá thịt bò bao nhiêu" -> Update list này
                newIngredients = item.specific_ingredients;
            }
        }

        else if (item.intent === "GENERAL_CHAT") {
            nextActiveAgents.add("GENERAL_CHAT");
        }
        }

        // --- SPECIAL LOGIC: FIRST TURN ---
        // Nếu là lượt đầu tiên, dù user chỉ hỏi Recipe, ta vẫn "khuyến mãi" thêm các agent khác
        // if (isFirstTurn && currentDish) {
        // console.log("🚀 First Turn Logic Activated");
        // nextActiveAgents.add("SEARCH_RECIPE");
        // nextActiveAgents.add("SEARCH_VIDEO");
        // nextActiveAgents.add("SEARCH_PRICE");

        // // Chỉ thêm Map nếu có đủ địa chỉ
        // if ((newOrigin || userProfile?.work_address) && (newDest || userProfile?.home_address)) {
        //     nextActiveAgents.add("SEARCH_MAP");
        // }
    // }

    console.log("currentDish: ", currentDish);
    console.log("newOrigin: ", newOrigin);
    console.log("newDest: ", newDest);
    console.log("newIngredients: ", newIngredients);
    console.log("nextActiveAgents: ", nextActiveAgents);
    console.timeEnd("⏱️ supervisorNode logic");

    return {
        // Cập nhật State mới
        finished_branches: [],
        is_first_turn: false,
        current_dish: currentDish,
        current_origin_address: {  
            adressName: newOrigin,
            adressID: null
        },
        current_destination_address: {  
            adressName: newDest,
            adressID: null
        },
        brand_preference: newBrandPreference,
        cached_ingredients: newIngredients,

        // Danh sách Agent sẽ kích hoạt
        next_active_agents: Array.from(nextActiveAgents),

        
    };
};