import { z } from "zod";
// import { baseLlm } from "../../lib/llm"; // Import model sạch
import { baseLlm } from "../lib/llm";
import { AgentState } from "../graph/state";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { UserProfileService } from "../memory/userProfile";

const promptss = `
You are the Orchestrator of a Cooking Assistant App. Your job is to classify the User's latest input into a SINGLE routing action.

### CLASSIFICATION RULES (Choose One):

1. **SEARCH_VIDEO**: 
   - User asks for visual content, TikToks, clips, or "watch how to make".

2. **SEARCH_RECIPE**: 
   - User asks for cooking steps, text-based instructions, ingredients list, or "how to cook [dish]".

3. **SEARCH_MAP**: 
   - User asks for locations, supermarkets, restaurants, or "where to buy".

4. **SEARCH_INGREDIENT_PRICE**: 
   - User asks about costs, prices, budget for a meal, or "how much is [ingredient]".

5. **CHATBOT_RESPONSE**: 
   - Greetings ("Hi", "Hello"), vague requests, clarifying questions, or general chit-chat.
   - Use this if the input doesn't fit the specific tools above.

### OUTPUT FORMAT (JSON ONLY):
{
  "reasoning": "Brief explanation of why this action was chosen.",
  "next_action": "ONE_OF_THE_ACTIONS_ABOVE"
}

### FEW-SHOT EXAMPLES:

User: "Hi, are you there?"
AI: {
  "reasoning": "User is greeting.",
  "next_action": "CHATBOT_RESPONSE"
}

User: "Show me a video on how to slice onions."
AI: {
  "reasoning": "User explicitly asked for 'Show me' and visual content.",
  "next_action": "SEARCH_VIDEO"
}

User: "How do I make Pho Bo? I need the steps."
AI: {
  "reasoning": "User asked for 'steps' and 'how to make' (Text recipe).",
  "next_action": "SEARCH_RECIPE"
}

User: "Where can I buy fresh basil near me?"
AI: {
  "reasoning": "User asked 'Where to buy' and implies location.",
  "next_action": "SEARCH_MAP"
}

User: "Is beef expensive right now?"
AI: {
  "reasoning": "User asked about price/cost of an ingredient.",
  "next_action": "SEARCH_INGREDIENT_PRICE"
}

User: "Can you help me cook something?"
AI: {
  "reasoning": "Vague request. Needs clarification from Chatbot.",
  "next_action": "CHATBOT_RESPONSE"
}
`;

// Schema Output (Giữ nguyên)
const RoutingSchema = z.object({
  step1_user_sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "INQUISITIVE"]),
  step2_reasoning: z.string(),
  next_action: z.enum(["SEARCH_VIDEO", "SEARCH_RECIPE", "SEARCH_MAP", "SEARCH_INGREDIENT_PRICE", "CHATBOT_RESPONSE"]),
});

export const supervisorNode = async (state: typeof AgentState.State, config: any) => {
  console.time("⏱️ supervisorNode time");
  // ----- Get the newest user Profile --------------
  // const userId = config.configurable?.user_id || "default_user";
  // const current_profile = await UserProfileService.getProfile(userId);

  // ------ Get the lastest message ----------------
  const messages = state.messages;

  const lastUserMessage = messages.slice().reverse().find(
    (msg) => msg._getType() === "human"
  );

  // 1. Tạo System Prompt để định hướng
  const systemPrompt = new SystemMessage(
      promptss
  );

  // 2. Gọi LLM với Structured Output (Chỉ model sạch mới chạy được cái này)
  const router = baseLlm.withStructuredOutput(RoutingSchema);

  
  try {
    const response = await router.invoke([systemPrompt, lastUserMessage.content]);
    console.timeEnd("⏱️ supervisorNode time");
    // console.log("current_profile: ", JSON.stringify(current_profile, null, 2));
    return {
      router_decision: response, 
      finished_branches: ["supervisor_done"],
      // userProfile: current_profile
    };
  } catch (error) {
    console.timeEnd("⏱️ supervisorNode time");
    console.error("Router Error:", error);
    // Fallback nếu model lỗi
    return { 
      router_decision: { next_action: "CHATBOT_RESPONSE" } ,
      finished_branches: ["supervisor_done"]
    // , userProfile: current_profile
  };
  }
};

