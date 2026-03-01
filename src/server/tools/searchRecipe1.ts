// file: tools/search_tool.ts
import { tavily } from "@tavily/core";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" }); 
// 1. Khởi tạo Client
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY }); 

export async function searchRecipe(query: string) {
  try {
    console.log(`🔍 Đang tìm kiếm: ${query}...`);

    const response = await tvly.search(query, {
      search_depth: "basic", 
      max_results: 5,
      include_domains: [],
    });

    return response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
    }));

  } catch (error) {
    console.error("Lỗi Search:", error);
    return "Không tìm thấy kết quả do lỗi mạng.";
  }
}

export async function scrapeContent(url: string): Promise<string> {
  try {
    console.log(`🕷️ Đang cào nội dung từ: ${url}`);
    const response = await axios.get(`https://r.jina.ai/${url}`, {
            headers: {
            'X-Return-Format': 'text', 
            
            // 1. Target Selector: Chỉ lấy nội dung trong các thẻ này
            // Jina sẽ tìm theo thứ tự ưu tiên. Thẻ <article> và <main> là chuẩn HTML5 cho nội dung chính.
            // .wprm-recipe-container là class chuẩn của 90% food blog (WordPress Recipe Maker)
            'X-Target-Selector': 'article, main, .wprm-recipe-container, .recipe-card, #recipe-content',
            
            // 2. Remove Selector: Xóa thẳng tay các phần rác nếu nó lỡ lọt vào
            'X-Remove-Selector': 'nav, footer, header, aside, .sidebar, .ads, .comment-section, .related-posts',
            
            // Các config cũ
            'X-Retain-Images': 'none', 
            'X-With-Links-Summary': 'false'
            }
        });
    return response.data;
  } catch (error) {
    console.warn(`⚠️ Không cào được URL ${url}, bỏ qua.`);
    return "";
  }
}