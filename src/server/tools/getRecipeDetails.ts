import axios from 'axios';

interface ColesRecipe {
  name: string;
  image_url: string;
  cook_time: string;
  recipe_url: string;
}
const rawData = {
  timeInfo: '* Serves 12 12\n* Cook time 2 hr 2 hour\n* Prep time 25 min 25 minute, + 15 mins resting time',
  ingredients: '* 1.2kg Coles Australian Pork Belly Roast\n... (như trên) ...\n### Kimchi\n... (như trên)',
  nutrition: '',
  method: '1.   ### Step 1\n\nPreheat oven...\n2.   ### Step 2\n...'
};

function cleanRecipeArtifacts(data: typeof rawData) {
  // Hàm nhỏ để xử lý từng chuỗi
  const cleanString = (str: string) => {
    if (!str) return "";
    return str
      .replace(/###/g, "") // 1. Xóa sạch dấu ###
      .replace(/  +/g, " ") // 2. (Tùy chọn) Gộp nhiều khoảng trắng thành 1 nếu việc xóa ### để lại lỗ hổng
      .trim();              // 3. Cắt khoảng trắng đầu đuôi
  };

  return {
    timeInfo: cleanString(data.timeInfo),
    ingredients: cleanString(data.ingredients),
    nutrition: cleanString(data.nutrition),
    method: cleanString(data.method)
  };
}

export function parseRecipeStructured(input: string) {
  // 1. SPLIT: Tách đoạn dựa trên dấu gạch ngang (ít nhất 3 dấu gạch)
  // Regex bắt: Xuống dòng + (khoảng trắng tùy ý) + "---..." + (khoảng trắng) + Xuống dòng
  const segments = input.split(/\n\s*-{3,}\s*\n/);

  // Khởi tạo các biến kết quả
  let result = {
    timeInfo: "",
    ingredients: "",
    nutrition: "",
    method: ""
  };

  // 2. XỬ LÝ SEGMENT ĐẦU TIÊN (Mặc định là Time + Header tiếp theo)
  // Tách segment 0 thành các dòng
  let currentSegmentLines = segments[0].split('\n').filter(line => line.trim() !== '');
  
  // Dòng cuối cùng của segment 0 chính là TIÊU ĐỀ của segment 1 (Ví dụ: "Ingredients")
  let nextSectionHeader = currentSegmentLines.pop()?.trim().toLowerCase() || "";
  
  // Phần còn lại chính là Time Info
  result.timeInfo = currentSegmentLines.join('\n').trim();

  // 3. LOOP QUA CÁC SEGMENT CÒN LẠI
  for (let i = 1; i < segments.length; i++) {
    const rawContent = segments[i]; // Đây là nội dung + tiêu đề của phần kế tiếp
    
    // Tách dòng để xử lý
    let lines = rawContent.split('\n');
    
    // Biến chứa nội dung thực sự của phần này
    let sectionContent = "";
    
    // Nếu đây KHÔNG PHẢI là segment cuối cùng, thì dòng cuối cùng sẽ là Header của phần sau
    if (i < segments.length - 1) {
      // Tìm dòng có chữ (bỏ qua dòng trống ở cuối)
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
      }
      // Lấy dòng cuối làm Header cho vòng lặp sau
      const headerLine = lines.pop()?.trim() || "";
      
      sectionContent = lines.join('\n').trim();
      
      // Lưu header cho vòng lặp kế tiếp
      const currentHeader = nextSectionHeader; // Header của phần hiện tại (đã lấy từ vòng trước)
      nextSectionHeader = headerLine.toLowerCase(); // Header cho phần sau
      
      // Gán nội dung vào đúng chỗ dựa trên currentHeader
      assignContent(result, currentHeader, sectionContent);
      
    } else {
      // Đây LÀ segment cuối cùng (thường là Method)
      // Không cần tách header nữa, toàn bộ là nội dung
      sectionContent = rawContent.trim();
      assignContent(result, nextSectionHeader, sectionContent);
    }
  }

  // 4. CLEAN UP METHOD (Xóa Footer rác như yêu cầu cũ)
  if (result.method) {
    const footerMatch = result.method.match(/\n\*\s+Serves/i);
    if (footerMatch && footerMatch.index !== undefined) {
      result.method = result.method.substring(0, footerMatch.index).trim();
    }
  }

  return cleanRecipeArtifacts(result);
}

// Hàm phụ trợ để gán nội dung vào đúng key
function assignContent(result: any, header: string, content: string) {
  if (header.includes("ingredient")) {
    result.ingredients = content;
  } else if (header.includes("method") || header.includes("instruction") || header.includes("step")) {
    result.method = content;
  } else if (header.includes("nutrit") || header.includes("analy")) {
    result.nutrition = content;
  }
}


// 

export async function GetColesRecipeDetail(url: string): Promise<string> {
  try {

    const targetSelectors = [
        // Time & Details (Đưa lên đầu để dễ nhìn)
        '.coles-targeting-RecipeDetailsRecipeDetails', 
        
        // // Ingredients
        // // '.coles-targeting-RecipeIngredientsCategoryList',

        // '.coles-targeting-RecipeIngredientsComponent',
        
        // // Steps
        // // '.coles-targeting-RecipeMethodSteps',
        // '.coles-targeting-RecipeMethodComponent',
        
        // // Tips
        // '.coles-targeting-RecipeTipsComponent',
        
        // // Nutrition
        // // '.css-r1tp55, .coles-targeting-NutritionalInformation' 

        '.coles-targeting-RecipeContainerRecipeContainer'
    ].join(','); // Nối lại bằng dấu phẩy


    const response = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
            'X-Return-Format': 'markdown', 
            
            // // 2. Target vào danh sách trên
            'X-Target-Selector': targetSelectors,
            
            // // 3. Quan trọng: Chờ thằng Ingredients hiện ra rồi mới cào (vì Coles load chậm)
            // 'X-WaitForSelector': '.coles-targeting-RecipeIngredientsCategoryList',
            
            // // 4. Xóa rác: Nút mua hàng, icon, phần tử ẩn
            // 'X-Remove-Selector': 'button, [class*="ShopButton"], .sr-only, svg, [role="button"]',
            
            // 'X-Retain-Images': 'none', 
            // 'X-With-Links-Summary': 'false'
        }
    });

    // if (!response.data || response.data.trim().length === 0) {
    //     console.warn("⚠️ Jina trả về rỗng.");
    //     return "";
    // }

    // console.log("✅ Kết quả Gộp (Markdown):");
    console.log("response.data: ", response.data); // In thử
    console.log("=========================================================");

    return response.data;

  } catch (error: any) {
    console.error(`❌ Lỗi: ${error.message}`);
    return "";
  }
}

// // Chạy thử
// const coles_url = 'https://www.coles.com.au/recipes-inspiration/recipes/fennel-pork-belly-sliders-with-kimchi'

// // const coles_url = "https://www.coles.com.au/search/recipes?q=kimchi";
// GetColesRecipeDetail(coles_url);



export async function getIngredientImage(url: string): Promise<string> {
  try {
    // Target thẳng vào thẻ img nằm trong Wrapper để Jina lọc bớt rác
    // const targetSelectors = '.coles-targeting-ProductImagesWrapper img'; 
    const targetSelectors = '.image-thumbnails_thumbnails'; 

    const response = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
            'X-Return-Format': 'markdown', 
            'X-Target-Selector': targetSelectors,
            // Đảm bảo không chặn ảnh
            // 'X-Retain-Images': 'none', <--- Đừng bật dòng này
        }
    });

    const markdownText = response.data;
    console.log("Jina Markdown:", markdownText);

    // Dùng Regex để bắt chuỗi trong ngoặc tròn của cú pháp ảnh markdown: ![alt](URL)
    // Regex giải thích:
    // !\[.*?\]  -> Tìm phần ![bất_kỳ_chữ_gì]
    // \((.*?)\) -> Tìm phần (link_ảnh) và group lại nội dung bên trong
    const imageRegex = /!\[.*?\]\((.*?)\)/;
    
    const match = markdownText.match(imageRegex);

    if (match && match[1]) {
        console.log("✅ Image Found:", match[1]);
        return match[1]; // Trả về URL ảnh
    }

    console.warn("⚠️ No image found in markdown response");
    return "";

  } catch (error: any) {
    console.error(`❌ Lỗi lấy ảnh: ${error.message}`);
    return "";
  }
}


// const test_url = "https://www.woolworths.com.au/shop/productdetails/405838/red-seedless-grapes-bag-approx-900g";

// getIngredientImage(test_url);
