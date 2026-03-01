// npm install apify-client
import { ApifyClient } from 'apify-client';

// import * as dotenv from "dotenv";
// dotenv.config({ path: ".env" });

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN, // Đăng ký lấy token free
});

export const searchTikTok = async (query: string) => {
    try {
        console.log(`Searching TikTok for: ${query}`);

        // SỬA TÊN ACTOR Ở ĐÂY 👇
        const run = await client.actor("clockworks/tiktok-scraper").call({
            // Input của actor này có thể hơi khác, kiểm tra docs trên apify
            searchQueries: [query],
            resultsPerPage: 10,
            searchSection: "/video",
            shouldDownloadCovers: false, // Tắt bớt cho nhẹ
            shouldDownloadSlideshowImages: false,
            shouldDownloadVideos: false // Chỉ lấy link, không tải file về server Apify (tốn tiền)
        });

        console.log(`Actor finished. Dataset ID: ${run.defaultDatasetId}`);

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        // Map dữ liệu
        return items.map((item: any) => ({
            id: item.id,
            desc: item.text,
            videoUrl: item.videoMeta?.downloadAddr || item.webVideoUrl, // Clockworks trả về cấu trúc này
            author: item.authorMeta?.name,
            stats: {
                likes: item.diggCount,
                views: item.playCount
            }
        }));

    } catch (error) {
        console.error("Apify Error:", error);
        return [];
    }
};

// searchTikTok("Stir-fried Potatoes with Minced Pork")