import { createServer } from "http";
import { Server } from "socket.io";
import { HumanMessage } from "@langchain/core/messages";

// Import workflow (app) đã compile từ LangGraph
import { app } from "./graph/workflow"; 
import { initGraphDB } from "./agents/semantic_Collection"; // Uncomment nếu cần
import { initRedisIndex } from "./lib/redis"; // Uncomment nếu cần

// Cấu hình Port
const PORT = process.env.PORT || 3001;

async function startServer() {
  // 1. Khởi tạo Database (Nếu có)
  try {
    // await initRedisIndex();
    // await initGraphDB();
    console.log("✅ Databases initialized");
  } catch (err) {
    console.error("❌ Failed to init DB:", err);
  }

  // 2. Tạo HTTP Server và Socket.io
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Cho phép mọi frontend kết nối (trong dev)
      methods: ["GET", "POST"]
    },
  });

  console.log("🚀 Server đang khởi động...");

  // 3. Lắng nghe kết nối Socket
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Giả lập session ID và User ID (Thực tế nên gửi từ client lên)
    let config = {
      configurable: {
        thread_id: "session_10", 
        user_id: "user_dang_03",
        user_current_location: null
      }
    };

    socket.on("chat_message", async (payload: { msg: string, userCurrentLocation: any }) => {
      try {
        const { msg, userCurrentLocation } = payload;
        console.log(`📩 Received: ${msg}`);

        // Input cho LangGraph
        const inputs = {
          messages: [new HumanMessage(msg)],
        };

        console.log("location: ", userCurrentLocation);
        config.configurable.user_current_location = userCurrentLocation;
        console.log("config: ", config);
        const eventStream = await app.streamEvents(inputs, {
          ...config,
          version: "v2",
        });

        // Vòng lặp lắng nghe từng sự kiện sinh ra
        for await (const { event, data, tags, metadata } of eventStream) {
            
            // console.log("event: ", event);
            // console.log("data: ", data);
            // console.log("tags: ", tags);
            // console.log("metadata: ", metadata);
            // 1. Bắt sự kiện Tool Start (Ví dụ agent bắt đầu tìm kiếm)
            if (event === "on_chain_start") {
                const nodeName = metadata?.langgraph_node; 
                if (nodeName) {
                    console.log("▶️ Entering Node:", nodeName);
                    socket.emit("agent_node", nodeName);

                }
            }
            if (event=="on_chain_end"){
                const finished_brances = data.output.finished_branches|| [];
                console.log("finished_brances: ", finished_brances);
                if (finished_brances.includes("search_map_done")){
                    const optimized_route_map = data.output.optimized_route_map;
                    const result_map = {
                      optimized_route_map: optimized_route_map,
                      current_origin_address: data.output.current_origin_address,
                      current_destination_address: data.output.current_destination_address,
                      brand_preference: data.output.brand_preference,
                      user_current_location: data.output.user_current_location,
                    }

                }
                if (finished_brances.includes("search_video_done")){
                  const videoUrl = data.output.videoUrl;
                  console.log("videoUrl: ", videoUrl);
                  socket.emit("video_result", videoUrl);
                }
                if (finished_brances.includes("search_recipe_done")){
                    const recipesList = data.output.recipesList;
                    console.log("***********************");
                    console.log("recipesList: ", recipesList);
                    console.log("***********************");
                    socket.emit("recipe_result", recipesList);
                }
                if (finished_brances.includes("search_price_done")){
                    const ingredientPriceList = data.output.ingredientPriceList;
                    socket.emit("ingredient_price_result", ingredientPriceList);
                }
            }
            // 2. Bắt sự kiện Token Stream (như cũ)
            if (event === "on_chat_model_stream" && data.chunk?.content) {
                // Khi bắt đầu trả lời thì đổi status thành Thinking... hoặc ẩn đi
                socket.emit("stream_chunk", data.chunk.content);
            }
        }

        // Báo hiệu đã xong hoàn toàn
        socket.emit("stream_done");
        console.log("✅ Stream finished");

      } catch (error) {
        console.error("❌ Error processing message:", error);
        socket.emit("error", "Sorry, something went wrong on the server.");
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  // 4. Mở cổng
  httpServer.listen(PORT, () => {
    console.log(`\n-----------------------------------`);
    console.log(`🚀 WebSocket Server running at http://127.0.0.1:${PORT}`);
    console.log(`-----------------------------------\n`);
  });
}

// Chạy server
startServer().catch((e) => console.error(e));