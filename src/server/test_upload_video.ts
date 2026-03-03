import axios from 'axios';

interface ColesRecipe {
  name: string;
  image_url: string;
  cook_time: string;
  recipe_url: string;
}

// URL tìm kiếm chuẩn của Woolworths
// Ví dụ: https://www.woolworths.com.au/shop/recipes/search?searchTerm=beef%20pho
export async function getWooliesRecipeList(userQuery: string, url: string): Promise<string> {
  try {
    const targetSelectors = [".card-grid"]
    // const targetSelectors = [ ".main-content-container", ".recipe-ingredients-section", ".recipe-method-steps",]; 
    // const targetSelectors =[ ".search-results-list-1", ".structured-ingredients__list", ".structured-project__steps",]
    console.log(`🔍 Đang gọi Jina cho URL: ${url}`);

    const response = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
            'X-Return-Format': 'markdown', 
            // Target vào lưới chứa recipe
            'X-Target-Selector': targetSelectors,
            // Thêm options này để Jina cố gắng đợi trang load (quan trọng với Woolies)
            'X-WaitForSelector': targetSelectors, 
        }
    });

    console.log("✅ Jina Response Length:", response.data);
    
    // Lưu ý: Format Markdown của Woolies sẽ khác Coles, 
    // bạn cần sửa lại hàm parseRecipeList tương ứng.
    // const recipes = parseRecipeList(response.data); 

    return response.data; // Tạm thời return raw markdown để bạn debug

  } catch (error: any) {
    console.error(`❌ Lỗi Jina: ${error.message}`);
    if (error.response) {
        console.error("Data:", error.response.data);
    }
    return "";
  }
}

getWooliesRecipeList("", "https://www.taste.com.au/search-recipes/?q=spring+roll")

// "https://www.simplyrecipes.com/search?q=spring+roll"
// "https://www.taste.com.au/recipes/spring-rolls-2/fe06a8e0-3098-481d-a8fa-69b178efd282"