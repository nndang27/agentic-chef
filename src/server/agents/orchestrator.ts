import { z } from "zod";
import { baseLlm } from "../lib/llm";
import { AgentState } from "../graph/state";
import { SystemMessage , HumanMessage} from "@langchain/core/messages";
import { UserProfileService } from "../memory/userProfile";
// Import schema vừa định nghĩa ở trên

// --- SUB-SCHEMAS ---

const SearchRecipeSchema = z.object({
  intent: z.literal("SEARCH_RECIPE"),
  dish_name: z.string().describe("The full name of the dish, including any specific adjectives or constraints (e.g., 'Healthy Chicken Salad', 'Carbonara no cream')."),
});

const SearchVideoSchema = z.object({
  intent: z.literal("SEARCH_VIDEO"),
  dish_name: z.string().describe("The search query for the video. CRITICAL: If the user uses pronouns like 'it' or 'that', you MUST resolve this to the specific dish name from the chat history."),
});

const SearchPriceSchema = z.object({
  intent: z.literal("SEARCH_PRICE"),
  dependency_mode: z.enum(["direct", "depend_on_recipe"]).describe("Set to 'depend_on_recipe' if the user asks for the total cost of a DISH (requires recipe first). Set to 'direct' if the user asks for the price of specific items."),
  specific_ingredients: z.array(z.string()).optional().describe("List of specific ingredients if dependency_mode is 'direct'. Leave empty if 'depend_on_recipe'."),
});

const SearchMapSchema = z.object({
  intent: z.literal("SEARCH_MAP"),
  origin_address: z.string().nullable().describe("The user's starting point (if explicitly mentioned)."),
  destination_address: z.string().nullable().describe("The target destination or area the user wants to go to."),
  brand_preference: z.enum(["Coles", "Woolworths", "Any"]).nullable().describe("Preferred supermarket brand based on user input or negation logic."),
});

const GeneralChatSchema = z.object({
  intent: z.literal("GENERAL_CHAT"),
  type: z.enum(["greeting", "consultation", "clarification", "small_talk"]).describe("Classification of the non-search interaction."),
  response_guideline: z.string().optional().describe("Brief instruction on how the Chat Agent should respond (e.g., 'Suggest 3 dinner options')."),
});

// --- UNION ---
const IntentItemSchema = z.discriminatedUnion("intent", [
  SearchRecipeSchema, SearchVideoSchema, SearchMapSchema, SearchPriceSchema, GeneralChatSchema,
]);

// --- MAIN OUTPUT SCHEMA ---
export const SupervisorOutputSchema = z.object({
  // STEP 1: CLASSIFICATION
  classification_group: z.enum(["SINGLE_INTENT", "COMBO_INTENT", "VAGUE_GENERAL", "CONTEXTUAL"])
    .describe("Classify the user's request into one of the 4 logic groups."),
  
  // STEP 2: REASONING
  reasoning: z.string().describe("Briefly explain why this group was chosen and how intents were derived."),
  
  // STEP 3: ACTION LIST
  intents: z.array(IntentItemSchema).describe("The list of specific actionable intents, ordered by execution priority."),
});
// ==========================================================================================
// ================================== ========================================================

const SYSTEM_PROMPT = `
You are the **Master Orchestrator** of an intelligent Cooking Assistant App.
Your objective is to analyze User Input + Chat History + (Optional) Long-term Context, classify the request into a specific **Logic Group**, and route it to the correct agents.

### INPUT DATA STRUCTURE:
1. **Context Data** (Optional): User Profile & Knowledge Graph (Past habits, preferences). Use this to resolve VAGUE requests (e.g., "Dinner" -> Check what they ate yesterday to suggest something different).
2. **Chat History**: Last 3 turns. Crucial for pronouns ("it", "that").
3. **Current Input**: The immediate command to process.

---

### PART 1: CLASSIFICATION LOGIC (You must choose ONE Group)

#### GROUP 1: SINGLE_INTENT (Clear & Direct)
- **Definition**: User asks for ONE specific task with clear entities.
- **Examples**: 
  - "How to make Pho?" -> SEARCH_RECIPE.
  - "Price of 1kg beef" -> SEARCH_PRICE (direct).
  - "Where is the nearest Coles?" -> SEARCH_MAP.

#### GROUP 2: COMBO_INTENT (Complex, Multi-Step & Dependent)
- **Definition**: User asks for multiple things (2, 3, or 4 actions) OR a request that logically triggers a dependency chain.
- **THE "RECIPE FIRST" ANCHOR**:
  - If the user wants to cook, buy ingredients, or check the price of a DISH, you MUST start with **SEARCH_RECIPE** to generate the necessary data (ingredients/context) for subsequent steps.

- **STACKING RULES (Combine these logic blocks):**
  1. **Visual need**: If user wants to "watch", "see", or "video" -> Add **SEARCH_VIDEO**.
  2. **Budget need**: If user asks "cost", "price", or "how much" for the **dish** -> Add **SEARCH_PRICE** (set dependency_mode="depend_on_recipe").
  3. **Shopping need**: If user asks "where to buy", "shop", or "market" for the ingredients -> Add **SEARCH_MAP**.

- **COMPLEX CHAIN EXAMPLES**:
  - **3-Step (Cook + Budget + Shop)**: "How to make Pho, how much does it cost, and where to buy ingredients?"
    - **Output**: [SEARCH_RECIPE, SEARCH_PRICE, SEARCH_MAP]
  - **3-Step (Cook + Video + Budget)**: "Show me recipe and video for Pizza, and is it expensive?"
    - **Output**: [SEARCH_RECIPE, SEARCH_VIDEO, SEARCH_PRICE]
  - **4-Step (The "Full Package")**: "I want to make Bun Cha. Show me the recipe, a video guide, calculate the total price, and find the nearest Coles."
    - **Output**: [SEARCH_RECIPE, SEARCH_VIDEO, SEARCH_PRICE, SEARCH_MAP]

- **STRICT PRIORITY ORDER**:
  - Regardless of the user's sentence structure, ALWAYS output intents in this logical order:
  - **1. RECIPE** (Source of Truth) -> **2. VIDEO** (Visual) -> **3. PRICE** (Calculation) -> **4. MAP** (Action).

#### GROUP 3: VAGUE_GENERAL (Consultation & Chat)
- **Definition**: 
  - Open-ended questions ("What should I eat today?", "Suggest a dinner").
  - Greetings / Identity ("Hi", "Who are you?").
  - Knowledge questions NOT about cooking instructions ("Where does Pizza originate?").
- **Action**: DO NOT generate Search Intents. Route to **GENERAL_CHAT**.
- **Reasoning**: We cannot search for a recipe if the dish name is not decided yet. The Chat Agent must consult the user first.

#### GROUP 4: CONTEXTUAL (Memory Reference)
- **Definition**: The user uses **pronouns** like "it", "that", "the video", "the price", or "previous one".
- **Action**: 
  - Look at **Chat History** to find the *most recent Dish Name*.
  - **RESOLVE** the pronoun to that specific Dish Name immediately in the intent parameters.
  - *Example*: User says "Show video of it" (Context: Pizza) -> Intent: SEARCH_VIDEO { dish_name: "Pizza" } (NOT "it").

---

### PART 2: PARAMETER EXTRACTION RULES

1. **SEARCH_MAP**:
   - "My way to [X]" -> destination_address: [X].
   - "Near [Y]" -> destination_address: [Y].
   - "Not Coles" -> brand_preference: "Woolworths".
   - "Not Woolies" -> brand_preference: "Coles".
   - "Grocery store" / "Supermarket" -> brand_preference: "Any".

2. **SEARCH_RECIPE / VIDEO**:
   - Capture FULL modifiers: "Carbonara no cream" -> dish_name: "Carbonara no cream".

---

### FEW-SHOT EXAMPLES (Study these carefully):

**Input**: "The weather is nice, what should I eat?"
**Output**:
{
  "classification_group": "VAGUE_GENERAL",
  "reasoning": "User is asking for a suggestion. No specific dish is defined yet.",
  "intents": [{ "intent": "GENERAL_CHAT", "type": "consultation", "response_guideline": "Suggest 3 light dishes suitable for nice weather." }]
}

**Input**: "How much money do I need to make Bun Cha?"
**Output**:
{
  "classification_group": "COMBO_INTENT",
  "reasoning": "To find the cost of Bun Cha, we first need the ingredients.",
  "intents": [
    { "intent": "SEARCH_RECIPE", "dish_name": "Bun Cha" },
    { "intent": "SEARCH_PRICE", "dependency_mode": "depend_on_recipe" }
  ]
}

**Input**: "Price of 1kg lobster and 2 bunches of spinach."
**Output**:
{
  "classification_group": "SINGLE_INTENT",
  "reasoning": "User asks for prices of specific items. No recipe search needed.",
  "intents": [
    { "intent": "SEARCH_PRICE", "dependency_mode": "direct", "specific_ingredients": ["1kg lobster", "2 bunches of spinach"] }
  ]
}

**History**: [User: "How to make Pho?", Bot: "Here is the recipe..."]
**Input**: "Show me a video of it."
**Output**:
{
  "classification_group": "CONTEXTUAL",
  "reasoning": "User says 'it'. Context implies 'Pho'. Resolving 'it' to 'Pho'.",
  "intents": [
    { "intent": "SEARCH_VIDEO", "dish_name": "Pho" }
  ]
}
`;


export const orchestratorNode = async (state: typeof AgentState.State, config: any) => {
    console.log("**********************************************************************");
    console.time("⏱️ ORCHESTRATOR running TIME:");
    
    
    const messages = state.messages;
    const lastUserMessage = messages.slice().reverse().find((msg) => msg._getType() === "human");

    // ------ Lấy ra 3 tin nhắn human gần nhất không tính tin nắhn cuối cùng ----
    const allHumanMessages = messages.filter(msg => msg._getType() === "human");
    const historyCandidates = allHumanMessages.slice(0, -1);
    const recentUserHistory = historyCandidates.slice(-3).map(m => m.content).join(" | ");
    // ------------------------------------------------------------------------
    // Context Management
    const isFirstTurn = state.is_first_turn ?? true;
    let currentDish = state.current_dish;

    // Profile Fetching
    // const userId = config.configurable?.user_id || "default_user";
    // const userProfile = await UserProfileService.getProfile(userId);

    // --- CALL LLM ---
    const router = baseLlm.withStructuredOutput(SupervisorOutputSchema);
    // const systemMessage = new SystemMessage(SYSTEM_PROMPT);

    let memoryContextString = "No memory context available.";
    console.log("state.isMemoryMode 77: ", state.isMemoryMode);
    if (state.isMemoryMode) {
      try {
            // A. Lấy User Profile (Long-term Static)
            const userId = config.configurable?.user_id || "default_user";
            // Giả sử hàm này tồn tại
            const userProfile = await UserProfileService.getProfile(userId); 
            
            // B. Lấy Graph Context (Long-term Dynamic - từ node search_memory trước đó)
            const graphContext = state.graphContext || []; 
            
            // C. Format thành chuỗi để đưa vào Prompt
            memoryContextString = `
            ### LONG-TERM MEMORY CONTEXT:
            1. **FULL USER PROFILE (JSON)**:
            ${JSON.stringify(userProfile, null, 2)}
            2. **KNOWLEDGE GRAPH (Past Events & Relationships)**: 
            ${graphContext.length > 0 ? graphContext.join("\n") : "No related past events found."}
            `;
      } catch (err) {
            console.error("⚠️ Failed to load memory context:", err);
      }
    }
    let result;



    try {
        if (state.isMemoryMode) {

          const messagesPayload = [
              // A. System Prompt (Luật lệ cố định)
              new SystemMessage(SYSTEM_PROMPT),
              
              // B. Context & History (Dữ liệu hỗ trợ - Tách biệt)
              new SystemMessage(`
              === AUXILIARY DATA START ===
              
              ${state.isMemoryMode ? memoryContextString : ""}

              ### RECENT CHAT HISTORY (Last 3 inputs for context):
              ${recentUserHistory ? recentUserHistory : "No previous history."}
              
              === AUXILIARY DATA END ===
              `),

              // C. Current Input (Câu hỏi chính cần xử lý)
              new HumanMessage(`CURRENT USER INPUT: "${lastUserMessage.content}"`)
          ];
          result = await router.invoke(messagesPayload);
        } else {
          result = await router.invoke([new SystemMessage(SYSTEM_PROMPT), new HumanMessage(`CURRENT USER INPUT: "${lastUserMessage.content}"`)]);
        }
        
    } catch (error) {
        console.error("Router Error:", error);
        return { next_active_agents: ["GENERAL_CHAT"] };
    }

    // console.log("🔍 LLM Reasoning:", JSON.stringify(result, null, 2));

    // --- PROCESS INTENTS ---
    const nextActiveAgents = new Set<string>();

    // Variables to update in State
    let newOrigin = null;
    let newDest = null;
    let newBrandPreference = null;
    let newIngredients = null;
    let newCurrentDish = null;
    let newCurrentDishVideo = null;
    let general_chat_type = null;
    let general_response_guideline = null;
    // Duyệt qua từng Intent object để xử lý logic riêng biệt

    for (const intent of result.intents) {
        switch (intent.intent) {
            case "SEARCH_RECIPE":
                nextActiveAgents.add("SEARCH_RECIPE");
                newCurrentDish = intent.dish_name;
                break;
            case "SEARCH_VIDEO":
                nextActiveAgents.add("SEARCH_VIDEO");
                newCurrentDishVideo = intent.dish_name;
                break;
            case "SEARCH_PRICE":
                nextActiveAgents.add("SEARCH_PRICE");
                if(intent.specific_ingredients){
                    newIngredients = intent.specific_ingredients;
                }
                else if(nextActiveAgents.has("SEARCH_RECIPE")){
                  newIngredients = ["depend_on_recipe"];
                }
                break;
            case "SEARCH_MAP":
                nextActiveAgents.add("SEARCH_MAP");
                if(intent.origin_address.toLowerCase().includes("user") && intent.origin_address.toLowerCase().includes("location")){
                  newOrigin = "user_location";
                }
                if(intent.destination_address){
                  newDest = intent.destination_address;
                }
                if(intent.brand_preference){
                  newBrandPreference = intent.brand_preference;
                }
                break;
            case "GENERAL_CHAT":
                nextActiveAgents.add("GENERAL_CHAT");
                if(intent.type){
                  general_chat_type = intent.type;
                }
                if(intent.response_guideline){
                  general_response_guideline = intent.response_guideline;
                }
                break;
        }
    }
    console.log("nextActiveAgents: ", nextActiveAgents);
    console.log("newCurrentDish: ", newCurrentDish);
    console.log("newCurrentDishVideo: ", newCurrentDishVideo);
    console.log("newOrigin: ", newOrigin);
    console.log("newDest: ", newDest);
    console.log("newBrandPreference: ", newBrandPreference);
    console.log("newIngredients: ", newIngredients);
    console.log("general_chat_type: ", general_chat_type);
    console.log("general_response_guideline: ", general_response_guideline);
    console.timeEnd("⏱️ ORCHESTRATOR running TIME:");
    console.log("**********************************************************************");
    
    return {
        // Cập nhật State mới
        finished_branches: [],
        is_first_turn: false,
        current_dish: newCurrentDish,
        current_dish_video: newCurrentDishVideo,
        current_origin_address: {  
            adressName: newOrigin,
            adressID: null,
            location: null
        },
        current_destination_address: {  
            adressName: newDest,
            adressID: null,
            location: null
        },
        brand_preference: newBrandPreference,
        cached_ingredients: newIngredients,
        general_chat_type: general_chat_type,
        general_response_guideline: general_response_guideline,
        // Danh sách Agent sẽ kích hoạt
        next_active_agents: Array.from(nextActiveAgents),


        // ============== Reset output =====
        recipesList: null,
        optimized_route_map: null,
        videoUrl: null,
        ingredientPriceList: null
    };
};