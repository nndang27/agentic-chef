import path from "path";
import fs from "fs";
import { create } from "youtube-dl-exec"; // Wrapper xịn cho yt-dlp

// Khởi tạo wrapper (tự tìm đường dẫn yt-dlp trong máy)
const youtubedl = create("/opt/homebrew/bin/yt-dlp"); // Hoặc chỉ cần 'yt-dlp' nếu đã add vào PATH

export const downloadTikTok = async (videoUrl: string, outputFolder: string = "downloads") => {
  // 1. Tạo folder download nếu chưa có
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const timestamp = Date.now();
  const outputFilename = `tiktok_${timestamp}.mp4`;
  const outputPath = path.join(outputFolder, outputFilename);

  console.log(`⬇️ Đang tải video từ: ${videoUrl}`);

  try {
    await youtubedl(videoUrl, {
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      // TikTok specific flags:
      format: 'best[ext=mp4]/best', // Lấy định dạng tốt nhất qua HTTP
      output: outputPath,
      
      // Mẹo: yt-dlp tự động ưu tiên bản no-watermark đối với TikTok
    });

    console.log(`✅ Tải xong! File lưu tại: ${outputPath}`);
    return outputPath;

  } catch (error) {
    console.error("❌ Lỗi download yt-dlp:", error);
    return null;
  }
};

// --- Test thử ---
// downloadTikTok("https://www.tiktok.com/@daily_cooking168/video/7176295585601916202");
