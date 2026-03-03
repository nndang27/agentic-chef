import { createServer } from "http";
import { Server } from "socket.io";
import { HumanMessage } from "@langchain/core/messages";
// Import workflow (app) đã compile từ LangGraph
import { app } from "./graph/workflow"; 
import { initGraphDB } from "./agents/semantic_Collection"; // Uncomment nếu cần
import { initRedisIndex } from "./lib/redis"; // Uncomment nếu cần
import { createClerkClient } from "@clerk/backend";
import { verifyToken } from "@clerk/backend";
// Cấu hình Port
const PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || 3000;

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY, 
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY 
});

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
io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token; 
      
      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      // 3. Dùng hàm verifyToken độc lập
      // Hàm này cần secretKey để xác thực chữ ký của token
      const verifiedToken = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY, 
      });
      
      console.log("✅ User Verified:", verifiedToken.sub); 

      // Gắn userId vào socket
      // @ts-ignore
      socket.userId = verifiedToken.sub; 
      
      next();
    } catch (err) {
      console.error("❌ Auth Failed:", err);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  const activeControllers = new Map<string, AbortController>();
  // 3. Lắng nghe kết nối Socket
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    const userId = socket.userId;
    // Giả lập session ID và User ID (Thực tế nên gửi từ client lên)
    let config = {
      configurable: {
        thread_id: socket.id, 
        user_id: userId,
        user_current_location: null
      }
    };

    socket.on("chat_message", async (payload: { msg: string, userCurrentLocation: any, isMemoryMode:boolean }) => {
      if (activeControllers.has(socket.id)) {
        activeControllers.get(socket.id)?.abort();
        activeControllers.delete(socket.id);
      }

      // B. Tạo cầu dao mới cho request này
      const controller = new AbortController();
      activeControllers.set(socket.id, controller); // Lưu lại
      
      try {
        const { msg, userCurrentLocation, isMemoryMode } = payload;
        console.log(`📩 Received: ${msg}`);

        // Input cho LangGraph
        const inputs = {
          messages: [new HumanMessage(msg)],
          isMemoryMode: isMemoryMode || false,
        };

        config.configurable.user_current_location = userCurrentLocation;
        console.log("config: ", config);
        const eventStream = await app.streamEvents(inputs, {
          ...config,
          version: "v2",
          signal: controller.signal
        });

        let isChat = 0;
        // Vòng lặp lắng nghe từng sự kiện sinh ra
        let isVideoSent = false;
        let isMapSent = false;
        let isRecipeSent = false;
        let isPriceSent = false;

        const emittedNodes = new Set<string>();
        for await (const { event, data, tags, metadata } of eventStream) {
            
            // 1. Bắt sự kiện Tool Start (Ví dụ agent bắt đầu tìm kiếm)
            if (event === "on_chain_start") {
                const nodeName = metadata?.langgraph_node; 
                if (nodeName && !emittedNodes.has(nodeName)) {
                    socket.emit("agent_node", nodeName);
                    emittedNodes.add(nodeName);

                    if (nodeName === "general_chat") {
                      isChat = 1;
                    }

                }

            }
            if (event=="on_chain_end"){
                const finished_brances = data.output.finished_branches|| [];
                console.log("finished_brances: ", finished_brances);
                if (!isMapSent && finished_brances.includes("search_map_done")){
                    const optimized_route_map = data.output.optimized_route_map;

                    if(optimized_route_map===null){
                      socket.emit("stream_chunk", "❌ Search map failed, please remember turn on your location\n");
                    }else{
                      const result_map = {
                          optimized_route_map: optimized_route_map,
                          current_origin_address: data.output.current_origin_address,
                          current_destination_address: data.output.current_destination_address,
                          brand_preference: data.output.brand_preference,
                          user_current_location: data.output.user_current_location,
                      }
                      socket.emit("map_result", result_map);
                      socket.emit("stream_chunk", "✅ Search map done\n");
                    }
                    isMapSent = true;
                }
                if (!isVideoSent && finished_brances.includes("search_video_done")){
                  const videoUrl = data.output.videoUrl;
                  // console.log("videoUrl: ", videoUrl);
                  socket.emit("video_result", videoUrl);
                  socket.emit("stream_chunk", "✅ Search video done\n");
                  isVideoSent = true;
                }
                if (!isRecipeSent && finished_brances.includes("search_recipe_done")){
                    const recipesList = data.output.recipesList;
                    // console.log("***********************");
                    // console.log("recipesList: ", recipesList);
                    // console.log("***********************");
                    socket.emit("recipe_result", recipesList);
                    socket.emit("stream_chunk", "✅ Search recipe done\n");
                    isRecipeSent = true;
                }
                if (finished_brances.includes("general_chat_done")){
                  isChat = 0;

                }
                if (!isPriceSent && finished_brances.includes("search_price_done")){
                    const ingredientPriceList = data.output.ingredientPriceList;
                    socket.emit("ingredient_price_result", ingredientPriceList);
                    socket.emit("stream_chunk", "✅ Search ingredient price done\n");
                    isPriceSent = true;
                }
            }
            // 2. Bắt sự kiện Token Stream (như cũ)
            if (event === "on_chat_model_stream" && data.chunk?.content && isChat === 1) {
                // Khi bắt đầu trả lời thì đổi status thành Thinking... hoặc ẩn đi
                socket.emit("stream_chunk", data.chunk.content);
            }
        }

        // Báo hiệu đã xong hoàn toàn
        socket.emit("stream_done");
        console.log("✅ Stream finished");

      } catch (error:any) {
          if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
            console.log(`🛑 Stream manually stopped by user: ${socket.id}`);
            socket.emit("stream_chunk", "\n[Đã dừng bởi người dùng]");
            socket.emit("stream_done"); // Báo front-end là xong rồi (dù là bị hủy)
          } else {
            console.error("❌ Error processing message:", error);
            socket.emit("error", "Sorry, something went wrong on the server.");
          }
      }
      finally {
        // F. Dọn dẹp Controller sau khi xong
        activeControllers.delete(socket.id);
      }
    });

    socket.on("interrupt_agent", () => {
      console.log(`⚠️ Received interrupt signal from: ${socket.id}`);
      const controller = activeControllers.get(socket.id);
      if (controller) {
        controller.abort(); // <--- Gạt cầu dao!
        activeControllers.delete(socket.id);
        console.log("✂️ Agent execution aborted.");
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      // Cleanup nếu client thoát đột ngột
      if (activeControllers.has(socket.id)) {
        activeControllers.get(socket.id)?.abort();
        activeControllers.delete(socket.id);
      }
    });
  });

  // 4. Mở cổng
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n-----------------------------------`);
    console.log(`🚀 WebSocket Server running on 0.0.0.0:${PORT}`);
    console.log(`👉 External URL: Kiểm tra Public IP của RunPod`);
    console.log(`-----------------------------------\n`);
  });
}

// Chạy server
startServer().catch((e) => console.error(e));