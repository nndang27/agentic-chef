import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { UserProfileService } from "../memory/userProfile";

// 1. Define the sub-schemas clearly
const PersonalInfoSchema = z.object({
  name: z.string().optional(),
  home_address: z.string().optional(),
  work_address: z.string().optional(),
});

const PreferencesSchema = z.object({
  favorites: z.array(z.string()).optional(),
  liked_ingredients: z.array(z.string()).optional(),
  disliked_ingredients: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(), // "Hate" usually maps to disliked, but "allergic" is safer if ambiguous
  cuisines: z.array(z.string()).optional(),
  spiciness: z.enum(["none", "mild", "medium", "hot"]).optional(),
});

const CookingContextSchema = z.object({
  skill_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  equipment: z.array(z.string()).optional(),
  dietary_goals: z.array(z.string()).optional(),
  budget_tier: z.enum(["budget", "moderate", "premium"]).optional(),
  portion_size: z.number().optional(),
});

// 2. The Unified Schema (Allows updating multiple categories in ONE call)
const UserProfileUpdateSchema = z.object({
  personal_info: PersonalInfoSchema.optional(),
  preferences: PreferencesSchema.optional(),
  cooking_context: CookingContextSchema.optional(),
});


export const updateProfileTool = tool(
  async (input, config) => {
    // 1. Get User ID
    const userId = config.configurable?.user_id || "default_user";
    console.time("⏱️ updateProfileTool time");
    await UserProfileService.updateProfile(userId, input);
    console.timeEnd("⏱️ updateProfileTool time");
    return "SUCCESS";
  },
  {
    name: "update_user_memory",
    description: "Update the user's semantic profile.",
    schema: UserProfileUpdateSchema, // Keep your Zod schema exactly as is
  }
);
