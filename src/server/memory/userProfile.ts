import { z } from "zod";
import { v5 as uuidv5 } from "uuid";
import { getVectorStore } from "../graph/workflow";
// 1. Cấu trúc dữ liệu User Profile (Semantic Memory)
export interface UserProfile {
  id: string;
  personal_info: {
    name?: string;
    home_address?: string;
    work_address?: string;
  };
  preferences: {
    favorites: string[]; // Món yêu thích
    liked_ingredients: string[]; // Nguyên liệu thích
    disliked_ingredients: string[]; // Nguyên liệu ghét
    allergies: string[]; // Dị ứng
    cuisines: string[]; // Kiểu món (Á, Âu, Hàn...)
    spiciness: "none" | "mild" | "medium" | "hot";
  };
  cooking_context: {
    skill_level: "beginner" | "intermediate" | "advanced";
    equipment: string[]; // air_fryer, oven...
    dietary_goals: string[]; // keto, weight_loss...
    budget_tier: "budget" | "moderate" | "premium";
    portion_size: number;
  };
}

// Giá trị mặc định khi user mới chưa có gì
export const DEFAULT_PROFILE: UserProfile = {
  id: "unknown",
  personal_info: {},
  preferences: {
    favorites: [], liked_ingredients: [], disliked_ingredients: [],
    allergies: [], cuisines: [], spiciness: "medium"
  },
  cooking_context: {
    skill_level: "beginner", equipment: [],
    dietary_goals: [], budget_tier: "moderate", portion_size: 1
  }
};

const PROFILE_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

// 2. SERVICE XỬ LÝ
// ==============================================================================
export const UserProfileService = {

  // --- LẤY PROFILE ---
  async getProfile(userId: string): Promise<UserProfile> {
    console.log(`🔍 [UserProfile] Fetching for: ${userId}`);
    
    try {
        const vectorStore = await getVectorStore();
        
        // Tìm kiếm chính xác bản ghi profile của user này
        const searchResults = await vectorStore.similaritySearch(
            "user profile", // Query giả (dummy)
            1,              // Lấy 1 kết quả
            { userId: userId, doc_type: "core_profile" } // Filter metadata
        );

        if (searchResults.length > 0) {
            try {
                // Parse dữ liệu từ Vector Store
                const storedData = JSON.parse(searchResults[0].pageContent);
                
                // Merge với Default để đảm bảo nếu schema thay đổi thì không bị thiếu trường
                const mergedProfile: UserProfile = {
                    ...DEFAULT_PROFILE,
                    ...storedData,
                    id: userId, // Luôn đảm bảo ID đúng
                    // Đảm bảo các sub-object cũng được merge nếu storedData thiếu
                    personal_info: { ...DEFAULT_PROFILE.personal_info, ...storedData.personal_info },
                    preferences: { ...DEFAULT_PROFILE.preferences, ...storedData.preferences },
                    cooking_context: { ...DEFAULT_PROFILE.cooking_context, ...storedData.cooking_context },
                };

                console.log("✅ [UserProfile] Found and loaded.");
                return mergedProfile;
            } catch (parseError) {
                console.warn("⚠️ [UserProfile] Parse error. Returning Default.");
            }
        }
    } catch (error) {
        console.error("❌ [UserProfile] Error fetching:", error);
    }

    // Nếu không tìm thấy hoặc lỗi -> Trả về Default
    return { ...DEFAULT_PROFILE, id: userId };
  },

  // --- CẬP NHẬT PROFILE ---
  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    console.log(`💾 [UserProfile] Updating for: ${userId}`);

    try {
        // 1. Lấy dữ liệu cũ
        const current = await this.getProfile(userId);

        // 2. Gộp dữ liệu (Deep Merge thủ công để an toàn)
        // Lưu ý: Với các mảng (favorites, allergies...), logic ở đây là GHI ĐÈ nếu có dữ liệu mới.
        const updatedProfile: UserProfile = {
            ...current,
            ...data, // Ghi đè các trường cấp 1 (như id)
            
            personal_info: {
                ...current.personal_info,
                ...(data.personal_info || {})
            },
            
            preferences: {
                ...current.preferences,
                ...(data.preferences || {})
            },
            
            cooking_context: {
                ...current.cooking_context,
                ...(data.cooking_context || {})
            }
        };

        // 3. Chuẩn bị Document
        // Tạo ID cố định dựa trên UserId để Vector Store tự động cập nhật bản ghi cũ
        const docId = uuidv5(`${userId}`, PROFILE_NAMESPACE);
        
        const doc = new Document({
            pageContent: JSON.stringify(updatedProfile),
            metadata: {
                userId: userId,
                doc_type: "core_profile", // Metadata quan trọng để filter
                updated_at: new Date().toISOString()
            },
        });

        // 4. Lưu vào Vector Store
        const vectorStore = await getVectorStore();
        
        // Truyền id vào để thực hiện Upsert (Update nếu có, Insert nếu chưa)
        await vectorStore.addDocuments([doc], { ids: [docId] });

        console.log("✅ [UserProfile] Successfully saved.");

    } catch (error) {
        console.error("❌ [UserProfile] Failed to update:", error);
        throw error;
    }
  }
};