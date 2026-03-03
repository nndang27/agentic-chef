import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { UserProfile } from "../memory/userProfile";
import {type RecipePriceData} from "../agents/search_Price";
export interface RouterDecision {
  next_action: "SEARCH_VIDEO" | "UPDATE_MEMORY" | "GENERAL_CHAT";
  reasoning?: string;
  payload?: string;
  search_query?: string;
  memory_content?: string;
}
interface LatLng {
  lat: number;
  lng: number;
}

export type SearchResultItem = {
  id: string;       // BẮT BUỘC PHẢI CÓ ID ĐỂ SỬA
  content: string;  // Nội dung để AI hiểu ngữ cảnh
  score?: number;   // (Tùy chọn) Độ tương đồng
};

export type TripleFact = {
  subject: string;
  predicate: string;
  object: string;
  context?: string;
};

export type SearchRoute = {
  name: string;
  address: string;
  walkingDistance: number;
  supermarketLocation: {lat: number, lng: number};
  busIndex: number;
}

// ---------- Recipe type -------------------
interface Ingredient {
  item: string;
  amount: string | null;
  notes: string | null;
}

interface Step {
  step: number;
  action: string;
  time_minutes: number | null;
}

export interface AddressData {
  adressName: string;
  adressID: string | null;
  location: { lat: number; lng: number } | null; // Hoặc kiểu dữ liệu bạn đang dùng
}

export interface RecipeData {
  id: number;
  title: string; // Thêm title để hiển thị
  image: string; // Thêm ảnh cho popup preview
  serves: { value: string; unit: string }[];
  cook_time: { value: string; unit: string }[];
  prep_time: { value: string; unit: string }[] | null;
  ingredients: Ingredient[];
  steps: Step[];
  nutrition_estimate: { [key: string]: string | number };
  chef_tips: string;
}

export interface VideoGroupResult {
  video_id: string;        // ID định danh nhóm video (UUID)
  url: (string | undefined)[]; // URL gốc của video (TikTok/Youtube...), có thể undefined nếu map lỗi
  path: string[];          // URL video đã upload lên Cloudinary (Final URLs)
}

export interface quickDataType {
    recipeDish: string | "",
    videoDish: string | "",
    priceIngredients: string | "",
    mapOrigin: string | "",
    mapDestination: string | "",
    mapSupermarket: string | ""
  }

// ------------------------------------------
// Kế thừa MessagesAnnotation để có sẵn lịch sử chat (messages)
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,

  summary: Annotation<string>({
    reducer: (current, update) => update ?? current,
  }),
  
  userProfile: Annotation<UserProfile>,

  finished_branches: Annotation<string[]>({
    reducer: (x, y) => y, // ✅ Ghi đè: Giá trị mới sẽ thay thế hoàn toàn giá trị cũ
    default: () => [],
}),
  
  searchResults: Annotation<SearchResultItem[]>({
    reducer: (x, y) => y, // Luôn ghi đè kết quả mới nhất
    default: () => [],
  }),

  proposed_facts: Annotation<TripleFact[]>({
    reducer: (x, y) => y, // Ghi đè mới nhất
    default: () => [],
  }),

  graphContext: Annotation<string[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),

  is_first_turn: Annotation<boolean>({
    reducer: (x, y) => y,
    default: () => true,
  }),

  current_dish: Annotation<string>({
    reducer: (x, y) => y,
    default: () => "",
  }),
  current_dish_video:Annotation<string>({
    reducer: (x, y) => y,
    default: () => "",
  }),
  current_origin_address: Annotation<AddressData>({
    reducer: (x, y) => y, // Ghi đè toàn bộ object mới
    default: () => ({
      adressName: "",
      adressID: null,
      location: null
    }),
  }),
  general_chat_type: Annotation<string>({
    reducer: (x, y) => y,
    default: () => "",
  }),
  general_response_guideline: Annotation<string>({
    reducer: (x, y) => y,
    default: () => "",
  }),
  current_destination_address: Annotation<AddressData>({
    reducer: (x, y) => y,
    default: () => ({
      adressName: "",
      adressID: null,
      location: null
    }),
  }),

  brand_preference: Annotation<string>({
    reducer: (x, y) => y,
    default: () => "",
  }),

  cached_ingredients: Annotation<string[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),

  next_active_agents: Annotation<string[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),

  optimized_route_map: Annotation<string>({
    reducer: (x, y) => y,
    default: () => "",
  }),

  user_current_location: Annotation<LatLng | null>({
    // Reducer: Luôn lấy giá trị mới nhất ghi đè lên giá trị cũ
    reducer: (current, next) => next,
    
    // Default: Ban đầu chưa có thì để null
    default: () => null,
  }),

recipesList: Annotation<RecipeData[]>({
    
    // Reducer: (current, next) => next
    // Ý nghĩa: Khi có dữ liệu mới, sẽ GHI ĐÈ toàn bộ danh sách cũ. 
    // (Phù hợp nếu Agent sinh ra cả plan 7 ngày 1 lúc)
    reducer: (current, next) => next,

    // Default: Nên để là mảng rỗng [] thay vì null 
    // để khi render giao diện .map() không bị lỗi crash
    default: () => [],
  }),

ingredientPriceList: Annotation<RecipePriceData[]>({
    reducer: (current, next) => next,
    default: () => [],
  }),
  
  isMemoryMode: Annotation<boolean>({
    reducer: (current, next) => next,
    default: () => true,
  }),

  videoUrl: Annotation<VideoGroupResult>({
    reducer: (current, next) => next,
    default: () => null,
  }),
  quickMode: Annotation<string[]>({
    reducer: (current, next) => next,
    default: () => [],
  }),

  quickQuery: Annotation<quickDataType>({
    reducer: (current, next) => next,
    default: () => null,
  }),
});

