import axios from 'axios';

// ------------------ Get the product from COLES -----------------------------
const API_KEY = '567ca949c2msh6d3d4aaa852d6c7p12f620jsn39eea09f310c'; 

async function searchProduct(query:any, SUPERMARKET:string) {
  let url_search = ""
  let API_HOST = ""
  if(SUPERMARKET=="COLES"){
    API_HOST = 'coles-product-price-api.p.rapidapi.com';
    url_search = `https://${API_HOST}/coles/product-search/`
  }
  else if(SUPERMARKET=="WOOLWORTHS"){
    API_HOST = 'woolworths-products-api.p.rapidapi.com';
    url_search =`https://${API_HOST}/woolworths/product-search/`
  }
  const options = {
    method: 'GET',
    url: url_search,
    params: {
      query: query,
      page: '1' // Thường nên lấy page 1
    },
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': API_HOST
    }
  };

  try {
    const response = await axios.request(options);
    return {
      query: query,
      status: 'success',
      // Giả sử API trả về data.hits hoặc data.results, tùy response thực tế
      // Thường Coles API trả về JSON chứa list sản phẩm
      data: response.data 
    };
  } catch (error) {
    return {
      query: query,
      status: 'error',
      message: error.message
    };
  }
}

// 4. Hàm chính để chạy tất cả
export async function getAllColesIngredients(recipeData:any, SUPERMARKET: string) {

  // Tạo một mảng các Promise (chưa chạy xong)
  const searchPromises = recipeData.ingredients.map(item => {
    return searchProduct(item.normalized_name, SUPERMARKET);
  });


  const results = await Promise.all(searchPromises);

  return results;
}

// ------------------ Get the images -----------------------------

export const getProductImageFromUrl = (url: string, supermarket: string): string | null => {
  try {
    
    const match = url.match(/[-/](\d+)(?:\?|$)/);

    if (!match || !match[1]) {
      return null;
    }

    const productID = match[1];
    if (supermarket=="COLES"){
        // Kiểm tra độ dài ID (cần ít nhất 3 số để lấy index 0, 1, 2)
        if (productID.length < 3) {
          return null;
        }

        // 2. Lấy 3 chữ số đầu tiên
        const p0 = productID[0];
        const p1 = productID[1];
        const p2 = productID[2];

        // 3. Tạo link ảnh theo format yêu cầu
        const imageUrl = `https://shop.coles.com.au/wcsstore/Coles-CAS/images/${p0}/${p1}/${p2}/${productID}-zm.jpg`;

        return imageUrl;
    }
    else if (supermarket=="WOOLWORTHS"){
        const imageUrl = `https://assets.woolworths.com.au/images/1005/${productID}.jpg?impolicy=wowsmkqiema`
        // `https://cdn0.woolworths.media/content/wowproductimages/large/${productID}.jpg`;

        return imageUrl;
    }
  } catch (error) {
    console.error("Lỗi tạo link ảnh Coles:", error);
    return null;
  }
};





