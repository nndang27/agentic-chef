import { z } from "zod";
import type { UserProfile } from "../memory/userProfile";
import { DEFAULT_PROFILE } from "../memory/userProfile";
import { llm_consolidate } from "../lib/llm";
import { SystemMessage } from "@langchain/core/messages";
import { getVectorStore } from "../graph/workflow";
import { Document } from "@langchain/core/documents";
import { AgentState } from "../graph/state";
import { v5 as uuidv5 } from "uuid";
import { UserProfileService } from "../memory/userProfile";

// Định nghĩa các hành động được phép
const MemoryActionSchema = z.object({
  action: z.enum(["SET", "ADD", "REMOVE"]).describe("The type of operation"),
  field: z.enum([
    "personal_info.name",
    "personal_info.address",
    "personal_info.work_address",
    "preferences.favorites",
    "preferences.liked_ingredients",
    "preferences.disliked_ingredients",
    "preferences.allergies",
    "preferences.cuisines",
    "preferences.spiciness",
    "cooking_context.skill_level",
    "cooking_context.equipment",
    "cooking_context.dietary_goals",
    "cooking_context.budget_tier",
    "cooking_context.portion_size"
  ]).describe("The target field in UserProfile to modify (dot notation)"),
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.string())
  ]).describe("The value to set, add, or remove."),
  reason: z.string().describe("Short reason why this change is made (for debugging)")
});

// Output mong đợi là một danh sách các hành động
const MemoryUpdateSchema = z.object({
  operations: z.array(MemoryActionSchema)
});

const PROFILE_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

export const semantic_memoryAgentNode = async (state: typeof AgentState.State, runtime: any)  => {
    const userId = runtime.configurable?.user_id;
    console.log("userId: ", userId);
    const namespace = ["semantic_memory", userId];
    const key = "core_profile";
    console.log("state.isMemoryMode999: ", state.isMemoryMode);
    // 1. Lấy thông tin đầu vào
    const lastMessage = state.messages.at(-1);
    if (!lastMessage || lastMessage._getType() !== "human") return {};
    // 2. Lấy Profile CŨ từ Store
    const vectorStore = await getVectorStore();
    const docId = uuidv5(`${userId}`, PROFILE_NAMESPACE);
    const searchResults = await vectorStore.similaritySearch(
            "user profile", // Dummy query (Từ khóa phụ)
            1,              // Chỉ lấy 1 kết quả (Profile gốc)
            { userId: userId, doc_type: "core_profile" } // Filter cực kỳ quan trọng để lấy đúng file
        );
    let currentProfile = { ...DEFAULT_PROFILE, id: userId };

    // Nếu tìm thấy trong DB, parse chuỗi JSON từ pageContent ra thành Object
    if (searchResults.length > 0) {
        try {
            currentProfile = JSON.parse(searchResults[0].pageContent);
        } catch (error) {
            console.warn("⚠️ Không thể parse JSON từ profile cũ, dùng default.");
        }
    }
    console.log("currentProfile", currentProfile);
    console.log("======================================");
    // --------- system prompt --------
    const prompt = `
        You are a precise Database Manager for a meal planning and recipe assistant. Your task is to extract memory updates from the user's message and apply them to the User Profile.

        ### DATA SCHEMA (CRITICAL):
        You must respect the field types. 

        [SINGLE-VALUE FIELDS] -> Only use 'SET' to overwrite, or 'REMOVE' to clear.
        - personal_info.name (string)
        - personal_info.home_address (string)
        - personal_info.work_address (string)
        - preferences.spiciness (enum: "none" | "mild" | "medium" | "hot")
        - cooking_context.skill_level (enum: "beginner" | "intermediate" | "advanced")
        - cooking_context.budget_tier (enum: "budget" | "moderate" | "premium")
        - cooking_context.portion_size (number)

        [LIST FIELDS (string[])] -> Only use 'ADD' to append, or 'REMOVE' to delete a specific item.
        - preferences.favorites
        - preferences.liked_ingredients
        - preferences.disliked_ingredients
        - preferences.allergies
        - preferences.cuisines
        - cooking_context.equipment
        - cooking_context.dietary_goals

        ### OPERATION RULES:
        - **SET**: Overwrites the old value for single-value fields. 
        - **ADD**: Appends a new string to list fields. Ignore if it already exists.
        - **REMOVE**: Removes a specific string from list fields, OR clears a single-value field.

        ### EXAMPLES:

        **Example 1: Basic Overwrite and Append**
        User: "I am a student in Australia now, so my budget is pretty tight. Also I just bought an air fryer."
        Operations:
        - SET "moderate" (or "budget") to 'cooking_context.budget_tier'
        - ADD "air fryer" to 'cooking_context.equipment'

        **Example 2: Handling Negation & Evolution**
        User: "I don't hate beans anymore. Actually, they are really nice."
        Operations:
        - REMOVE "beans" from 'preferences.disliked_ingredients'
        - ADD "beans" to 'preferences.liked_ingredients'

        **Example 3: Conflict & Refinement**
        User: "I used to cook for 4 people, but now my roommates moved out so it's just me. Oh, and no more spicy food due to my stomach."
        Operations:
        - SET 1 to 'cooking_context.portion_size'
        - SET "none" to 'preferences.spiciness'

        **Example 4: Clearing Single Values**
        User: "I don't work at the Hanoi office anymore, I work from home."
        Operations:
        - REMOVE "Hanoi office" (or whatever the old value was) from 'personal_info.work_address'

        **Example 5: Multiple Array Updates**
        User: "I want to start a keto diet and I love Italian food, but please, absolutely no peanuts!"
        Operations:
        - ADD "keto" to 'cooking_context.dietary_goals'
        - ADD "Italian" to 'preferences.cuisines'
        - ADD "peanuts" to 'preferences.allergies' (or disliked_ingredients)

        -------- ACTUAL TASK STARTS HERE --------
        ### CURRENT PROFILE:
        ${JSON.stringify(currentProfile)}

        ### LATEST USER MESSAGE:
        "${lastMessage.content}"

        Determine what needs to change based on the LATEST USER MESSAGE. Return JSON matching the schema.
        `;

    const structuredLLM = llm_consolidate.withStructuredOutput(MemoryUpdateSchema);
    const result = await structuredLLM.invoke([new SystemMessage(prompt)]);

    console.log("result: ", result.operations);
    // BƯỚC QUAN TRỌNG: Apply các lệnh này vào Profile cũ
    const updatedProfile = applyOperations(currentProfile, result.operations);

    // Xóa profile bản cũ ra khỏi Vector Store để tránh trùng lặp
    try {
        await vectorStore.delete({ ids: [docId] });
    } catch (e) {
        // Có thể văng lỗi nếu ID chưa tồn tại (chạy lần đầu tiên), ta cứ bỏ qua
    }

    // Lưu bản mới vào Vector DB dưới dạng văn bản (Stringify)
    await vectorStore.addDocuments(
        [
            new Document({
                pageContent: JSON.stringify(updatedProfile),
                metadata: {
                    userId: userId,
                    doc_type: "core_profile",
                    updated_at: new Date().toISOString()
                },
            })
        ],
        { ids: [docId] }
    );

    return {};
};


// Hàm áp dụng thay đổi vào Profile cũ
const applyOperations = (profile: any, ops: z.infer<typeof MemoryActionSchema>[]) => {
  // Tạo bản copy để không sửa trực tiếp (Immutability)
  const newProfile = JSON.parse(JSON.stringify(profile));

  for (const op of ops) {
    // Tách đường dẫn "preferences.disliked_ingredients" thành ["preferences", "disliked_ingredients"]
    const path = op.field.split(".");
    
    // Tìm đến object cha (ví dụ: object "preferences")
    let target = newProfile;
    for (let i = 0; i < path.length - 1; i++) {
      if (!target[path[i]]) target[path[i]] = {}; // Tạo mới nếu chưa có
      target = target[path[i]];
    }
    const finalKey = path[path.length - 1]; // "disliked_ingredients"

    // THỰC HIỆN HÀNH ĐỘNG
    switch (op.action) {
      case "SET":
        // Ghi đè giá trị
        if (op.value === "") break;
        target[finalKey] = op.value;
        break;

      case "ADD":
        // Nếu chưa là mảng thì tạo mảng
        if (!Array.isArray(target[finalKey])) target[finalKey] = [];
        // Chỉ add nếu chưa có (tránh trùng lặp)
        if (!target[finalKey].includes(op.value)) {
          target[finalKey].push(op.value);
        }
        break;

      case "REMOVE":
        // Xóa phần tử khỏi mảng
        if (Array.isArray(target[finalKey])) {
          target[finalKey] = target[finalKey].filter((item: string) => 
            // So sánh chuỗi thường để xóa chính xác
            item.toLowerCase() !== String(op.value).toLowerCase()
          );
        }
        break;
    }
  }
  
  return newProfile;
};

