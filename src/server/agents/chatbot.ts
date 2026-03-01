// src/nodes/generalAssistant.ts
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { AgentState } from "../graph/state";
import { llm_chatbot } from "../lib/llm";
import { UserProfileService } from "../memory/userProfile";
import {prepareMessagesForLLM} from "../utils/filterMessage";
import { DEFAULT_PROFILE } from "../memory/userProfile";
import { getVectorStore } from "../graph/workflow";

export const generalAssistantNode = async (state: typeof AgentState.State, config: any) => {
    console.time("⏱️ generalAssistantNode time");
    // const current_profile = state.userProfile; // Đã có từ load_memory
    const userId = config.configurable?.user_id || "default_user";
    // const current_profile = await UserProfileService.getProfile(userId);

    const vectorStore = await getVectorStore();

    const searchResults = await vectorStore.similaritySearch(
            "user profile", // Dummy query (Từ khóa phụ)
            1,              // Chỉ lấy 1 kết quả (Profile gốc)
            { userId: userId, doc_type: "core_profile" } // Filter cực kỳ quan trọng để lấy đúng file
        );

    let current_profile = { ...DEFAULT_PROFILE, id: userId };
    
    // Nếu tìm thấy trong DB, parse chuỗi JSON từ pageContent ra thành Object
    if (searchResults.length > 0) {
        try {
            current_profile = JSON.parse(searchResults[0].pageContent);
        } catch (error) {
            console.warn("⚠️ Không thể parse JSON từ profile cũ, dùng default.");
        }
    }

    console.log("==========================================");
    console.log("USER PROFILE: ", current_profile);
    console.log("==========================================");
    // Prompt chuyên để TRẢ LỜI (không cần lo về routing)
    const systemPrompt = `
    You are a helpful ChatBot as ChatGPT.

    USER PROFILE (MEMORY):
    ${JSON.stringify(current_profile, null, 2)}

    INSTRUCTION:
    - Answer the user's question naturally and shortly.
    - ALWAYS check the User Profile before answering. If they ask for food, avoid their allergies.
    - If you don't know, just say you don't know.
    `;

    const filted_message = prepareMessagesForLLM(state.messages);
    // console.log("==========================================");
    // console.log("SYSTEM PROMPT: ", filted_message);
    // console.log("==========================================");

    
    const messages = [new SystemMessage(systemPrompt), ...filted_message];

    // // Gọi LLM để sinh câu trả lời
    // const response = await llm_chatbot.invoke(messages);
    // console.log("==========================================");
    // console.log("CHAT BOT: ", response.content);
    

    process.stdout.write("CHAT BOT: "); // In tiêu đề trước, không xuống dòng
    let finalContent = "";

    const stream = await llm_chatbot.stream(messages);
    for await (const chunk of stream) {
        const content = chunk.content as string;
        process.stdout.write(content);
        finalContent += content;
    }
    process.stdout.write("\n");

    console.timeEnd("⏱️ generalAssistantNode time");
    
    return { messages: [new AIMessage(finalContent)] };
};