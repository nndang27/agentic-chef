// src/lib/llm.ts
import { ChatOllama } from "@langchain/ollama";
import { updateProfileTool } from "../tools/profileTools";
import { OllamaEmbeddings } from "@langchain/ollama";

// 1. Model gốc (Sạch - Dùng cho Routing/Classification)
export const baseLlm = new ChatOllama({
  model: "llama3.1:8b", //"qwen3:8b", //
  temperature: 0,
  baseUrl: `http://${process.env.OLLAMA_HOST}`,
  
});

// export const llmWithTools = baseLlm.bindTools([updateProfileTool]);
export const llm_chatbot = new ChatOllama({
  model: "llama3.1:8b",
  temperature: 0.3,     // factual QA
  // topK: 1,             // greedy
  // topP: 1.0,
  baseUrl: `http://${process.env.OLLAMA_HOST}`,
});

export const llm_semantic_memory = new ChatOllama({
  model: "llama3.1:8b",
  temperature: 0.1, 
  baseUrl: `http://${process.env.OLLAMA_HOST}`,
  // numCtx: 8192, 
  format: "json",
});


export const llm_summarizer = new ChatOllama({
  model: "llama3.1:8b",
  temperature: 0.3,     // factual QA
  // topK: 1,             // greedy
  // topP: 1.0,
  baseUrl: `http://${process.env.OLLAMA_HOST}`,
});

export const llm_consolidate = new ChatOllama({
  model: "llama3.1:8b",
  temperature: 0.1, 
  baseUrl: `http://${process.env.OLLAMA_HOST}`,
  // numCtx: 8192, 
  format: "json",
});


export const embeddingsLLM = new OllamaEmbeddings({
    model: "mxbai-embed-large",
    baseUrl: `http://${process.env.OLLAMA_HOST}`,
});