import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

export const uploadToCloudinary = async (filePath: string) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "video", // Quan trọng: báo là video
      folder: "food-agent-videos",
    });
    console.log("Upload result:", result.secure_url);
    return result.secure_url; // Trả về URL https://res.cloudinary...
  } catch (error) {
    console.error("Upload failed:", error);
    throw error;
  }
};

uploadToCloudinary("/Users/nndang27/Documents/dangnn/Recipe_t3/recipe_t3/public/download_vids/b72de716-0e80-41ea-abf8-b4166acbe6e7/tiktok_1772392919913.mp4")