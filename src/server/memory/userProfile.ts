import { z } from "zod";

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

// 2. Mock Database Service (Thực tế bạn sẽ thay bằng Postgres/MongoDB)
export const UserProfileService = {
  // Giả lập DB trong Ram
  _db: new Map<string, UserProfile>(),

  async getProfile(userId: string): Promise<UserProfile> {
    const a = this._db.get(userId) || { ...DEFAULT_PROFILE, id: userId };
    return a
  },

  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    const current = await this.getProfile(userId);
    // Merge deep (Gộp dữ liệu cũ và mới)

    const updated = {
      ...current,
      ...data, // Lưu ý: Cần viết hàm merge sâu hơn nếu làm production
      personal_info: { ...current.personal_info, ...data.personal_info },
      preferences: { ...current.preferences, ...data.preferences },
      cooking_context: { ...current.cooking_context, ...data.cooking_context }
    };
    this._db.set(userId, updated);
  }
};