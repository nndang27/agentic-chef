import axios from 'axios';
import {baseLlm, llm_summarizer, embeddingsLLM} from "../lib/llm";
import { z } from "zod";
// import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";
interface ColesRecipe {
  name: string;
  image_url: string;
  recipe_url: string;
}


  
  


export function parseRecipeList(markdownData: string): ColesRecipe[] {
  const results: ColesRecipe[] = [];

  // const regex = /\[!\[Image \d+: ([^\]]+)\]\(([^)]+)\) ### .*? (\d+(?: hr)?(?: \d+)? min.*?)\]\(([^)]+)\)/g; // COLES
  const regex = /\[!\[Image \d+: ([^\]]+)\]\(([^)]+)\)\]\(([^)]+)\)/g;

  let match;
  while ((match = regex.exec(markdownData)) !== null) {
    results.push({
      name: match[1].trim(),       // Tên món
      image_url: match[2].trim(),  // Link ảnh
      recipe_url: match[3].trim()  // Link bài viết
    });
  }

  return results;
}
// ========== Reranking meals ==========
const ItemAnalysisSchema = z.object({
  id: z.number().describe("The exact index from the input list []."),
  head_noun: z.string().describe("The Main Dish Noun (e.g. 'Burger', 'Soup', 'Kimchi'). Lowercase."),
  flavor_profile: z.string().optional().describe("The adjectives/ingredients (e.g. 'Kimchi', 'Beef', 'Spicy'). Lowercase."),
});

// 2. Structure cho User Query
const QueryAnalysisSchema = z.object({
  target_dish: z.string().describe("What dish does the user want? (e.g. 'Burger'). Lowercase."),
  target_flavor: z.string().optional().describe("What flavor must it have? (e.g. 'chicken'). Lowercase. Empty if none."),
});

// 3. Output tổng
const ExtractionSchema = z.object({
  user_intent: QueryAnalysisSchema,
  items: z.array(ItemAnalysisSchema).describe("Analysis of EVERY item in the input list."),
});

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}



async function getEmbedding(text: string): Promise<number[]> {
  // LangChain dùng method .embedQuery() để lấy vector số thực
  const vector = await embeddingsLLM.embedQuery(text);
  return vector;
}

export async function smartRerankWithOllama(userQuery: string, recipes: Recipe[]): Promise<Recipe[]> {
    console.log(`🦙 Llama 3.2 đang suy nghĩ để sắp xếp ${recipes.length} món...`);

    // Chuẩn bị danh sách input: "[0] Recipe Name"
    const listForAI = recipes
      .map((r, index) => `[${index}] ${r.name}`)
      .join("\n");

    // 4. Tạo Prompt Template
    console.log("listForAI: \n", listForAI);
    const promptText = `
      You are a Culinary Data Extractor.
      User Query: "${userQuery}"

      **YOUR ONLY TASK:** 
      1. Extract the **Head Noun** and **Flavor** for the User Query.
      2. Extract the **Head Noun** and **Flavor** for EVERY item in the Input List.

      **GRAMMAR RULES:**
      - "Kimchi Burger" -> Head: "burger", Flavor: "kimchi"
      - "Kimchi Soup" -> Head: "soup", Flavor: "kimchi"
      - "Traditional Kimchi" -> Head: "kimchi", Flavor: "traditional"
      - "Beef Burger" -> Head: "burger", Flavor: "beef"
      - "Prawns with Kimchi" -> Head: "prawns", Flavor: "with kimchi"

      **CONSTRAINT:**
      - Process ALL items. Do not filter. 
      - Keep IDs exactly as shown in [].

      **INPUT LIST:**
      ${listForAI}
      
      {format_instructions}
    `;

    const structuredLlm = baseLlm.withStructuredOutput(ExtractionSchema);
    try {
      // 6. Chạy Chain
      const extractedData = await structuredLlm.invoke(promptText);

      console.log(`🧐 Phân tích của Llama\n: ${JSON.stringify(extractedData, null, 2)}`);

      // ========================================

      const targetDish = extractedData.user_intent.target_dish;   // "Burger"
      const targetHeadVector = await getEmbedding(targetDish);
      console.log("targetDish: ", targetDish);
      const targetFlavor = extractedData.user_intent.target_flavor; // "kimchi"
      const targetFlavorVector = await getEmbedding(targetFlavor);
    
      const itemsWithVectors = await Promise.all(
        extractedData.items.map(async (item) => {
          const vector_head = await getEmbedding(item.head_noun);
          const vector_flavor = await getEmbedding(item.flavor_profile);
          return { ...item, vector_head, vector_flavor };
        })
      );

      const semanticMatches = itemsWithVectors
        .map(item => {

          const headScore = cosineSimilarity(targetHeadVector, item.vector_head);
          let flavorScore = 0;
          if(targetFlavor=="" || item.flavor_profile==""){
          // console.log("targetFlavor: ", targetFlavor, "item.flavor_profile: ", item.flavor_profile);
          // console.log("**************************");
          flavorScore = 0.7;
      }
      else{
          flavorScore = targetFlavorVector 
          ? cosineSimilarity(targetFlavorVector, item.vector_flavor)
          : 1.0; 
      }

      return { ...item, headScore, flavorScore };
    })
    .filter(item => {
      const isHeadMatch = item.headScore > 0.65; 
      const isFlavorMatch = item.flavorScore > 0.60; 

      return isHeadMatch && isFlavorMatch;
    })
    .sort((a, b) => {
      const totalScoreA = a.headScore + a.flavorScore;
      const totalScoreB = b.headScore + b.flavorScore;
      
      return totalScoreB - totalScoreA;
    });

      // console.log("semanticMatches: ", semanticMatches);
      const returnRecipeList = semanticMatches.map(item => recipes[item.id]);
      // console.log("returnRecipeList: ", returnRecipeList);
  // ===================================================
      return returnRecipeList;

    } catch (error) {
      console.error("❌ Lỗi Rerank với Ollama:", error);
      return recipes; // Fallback về danh sách gốc
    }
}
// ===========================================

// const coles_url = "https://www.coles.com.au/search/recipes?q=beef%20pho";

export async function getColesRecipeList(userQuery: string, url: string): Promise<string> {
  try {


    // const targetSelectors=".coles-targeting-themegridRow";//COLES

    const targetSelectors = [".card-grid"] 
    const response = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
            'X-Return-Format': 'markdown', 
            // Target vào lưới chứa recipe
            'X-Target-Selector': targetSelectors,
            // Thêm options này để Jina cố gắng đợi trang load (quan trọng với Woolies)
            'X-WaitForSelector': targetSelectors, 
        }
    });

    console.log("response.data: ", response.data);
    const recipes = parseRecipeList(response.data);
    console.log("recipes: ", recipes);
    return recipes;

  } catch (error: any) {
    console.error(`❌ Lỗi: ${error.message}`);
    return "";
  }
}

// Chạy thử
// getColesRecipeList(coles_url);