"use client";

import {
  MapAgent,
  MealPlanAgent,
  PriceAgent,
  TikTokAgent,
} from "../_components/TiktokWidget";
import { AgentMapWidget } from "../_components/AgentMapWidget";
import { ChatInterface } from "../_components/ChatInterface";
import { Button } from "../../components/ui/button";
// import { useToast } from "../components/hooks/use-toast";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getCurrentLocation } from '../../utils/getUserLocation';
import { RecipeWidget } from "../_components/RecipeWidget"; // Import vừa tạo
// let socket: Socket;
import {type RecipeData } from "../_components/RecipeWidget";
import { type RecipePriceData } from "../../server/agents/search_Price";
import { IngredientPriceAgent } from "../_components/IngredientPriceAgent";
import test_ingredient_price from '~/server/test_ingredient_price.json';
import test_recipe from '~/server/test_recipe.json';
import {saveRecipeToDatabase} from "~/server/db/queries";
import { ChevronRight } from 'lucide-react'; // Import icon nếu cần
import { getNearestSupermarket, getLatLongFromID } from "../../server/tools/getNearestSupermarket";
import { Switch } from "../../components/ui/switch"; // Nếu dùng shadcn/ui
// Hoặc dùng input checkbox thường nếu chưa có component Switch
import { BrainCircuit } from "lucide-react";
// import { useUser } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import {type quickDataType } from "../_components/ChatInterface";
export interface LatLng {
  lat: number;
  lng: number;
}
export interface DisplayName {
  text: string;
  languageCode: string;
}

export interface DestinationInfo {
  name: string;               // place.displayName.text
  address: string;            // place.formattedAddress
  walkingDistance: number;    // Math.round(minDist)
  supermarketLocation: LatLng;// placeLoc
  busIndex: number;           // minIndex (Vị trí index của điểm xuống xe bus trong mảng routePath)
}

// 3. Định nghĩa đối tượng chính (Place)
export interface RadiusMap {
  id: string;
  formattedAddress: string;
  location: LatLng;
  displayName: DisplayName;
}


// 3. Interface chính cho Map (Khớp với dataToSave)
export interface RouteMap {
  routePath: LatLng[];        // Đường vẽ trên bản đồ
  destinationInfo: DestinationInfo;
}

interface AddressDetail {
  adressName: string;
  adressID: string;
  location: LatLng;
}
// Định nghĩa kiểu cho dữ liệu Map trả về từ Backend
export interface MapResultData {

  optimized_route_map: RouteMap | RadiusMap[] | null;
  current_origin_address: AddressDetail,
  current_destination_address: AddressDetail,
  brand_preference: string,
  user_current_location: LatLng,
                      
}


const mockVideos = {
  video_id: "1",
  url:[
  "/kkk6.mp4",
  "/doj.mp4",
  "/dowj5658915.mp4",
  "/dowj658917.mp4",
],
  path: [
    "https://res.cloudinary.com/ddnrrg0hp/video/upload/v1772451950/food-agent-videos/muou3mpptvujhkjoeguh.mp4",
    // "/https://res.cloudinary.com/ddnrrg0hp/video/upload/v1772451947/food-agent-videos/jjqggtt7ddfahnfvf7od.mp4",
    "https://res.cloudinary.com/ddnrrg0hp/video/upload/v1772451740/food-agent-videos/o2j4xkpyjczvcfrwvwzc.mp4",
    "https://res.cloudinary.com/ddnrrg0hp/video/upload/v1772451739/food-agent-videos/n7drbubbuml7d4dj4soc.mp4",
  ]

};

interface VideoInterface  {video_id: string, url: string[], path: string[]}

export default function DashboardPage() {

  // const { isLoaded, isSignedIn, user } = useUser();
  // console.log("userID CLIENT", user?.id);
  const { getToken, userId } = useAuth();
  const [isSocketReady, setIsSocketReady] = useState(false);
  // Set memory node
  const [isMemoryMode, setIsMemoryMode] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  // const [messages, setMessages] = useState<Message[]>([]);
    const [messages, setMessages] = useState([
    { role: "agent", content: "Hi! I'm ready to help you plan your meals." },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);


  const abortControllerRef = useRef<AbortController | null>(null);

  // const socketRef = useRef<Socket | null>(null);

  // State dành riêng cho Map
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [isSearchingRecipe, setIsSearchingRecipe] = useState(false);
  const [mapDestination, setMapDestination] = useState<MapResultData | null>(null);
  const [recipesList, setRecipesList] = useState<RecipeData[] | null>(test_recipe);

  const [ingredientPriceList, setIngredientPriceList] = useState<RecipePriceData[] | null>(test_ingredient_price);
  const [isSearchingPrice, setIsSearchingPrice] = useState(false);
  const [isSearchingVideo, setIsSearchingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<VideoInterface | null>(mockVideos);


  const [isExpanded, setIsExpanded] = useState(false);
  // // const { toast } = useToast();
  const [loadingStates, setLoadingStates] = useState({
    tiktok: true,
    price: true,
    map: true,
    mealPlan: true,
  });
// ============================================
const executeSearch = async () => {
  setIsSearchingMap(true);
  
  try {
    // 1. Luôn lấy vị trí hiện tại trước
    const location = await getCurrentLocation();
    const currentUserLocation = location ? {latitude: location.latitude, longitude: location.longitude} : null;
 

    // 2. Gọi API tìm kiếm
    // Lưu ý: Lúc mới load trang, formData có thể null/rỗng, 
    // API getNearestSupermarket cần xử lý được trường hợp originId/destinationId bị null (tìm xung quanh user)
    const Location_List = await getNearestSupermarket(
        currentUserLocation, 
        null, 
        null, 
        "Coles Woolworths ALDI"
    );

    let originLocation = null;
    let destinationLocation = null;

    if (Location_List) {
      // Logic lấy tọa độ chi tiết nếu người dùng đã nhập form (nếu không nhập thì bỏ qua)
      // if (formData?.originId) {
      //   originLocation = await getLatLongFromID(formData?.originId);
      // }
      // if (formData?.destinationId) {
      //   destinationLocation = await getLatLongFromID(formData?.destinationId);
      // }
      // 3. Cập nhật State
      setMapDestination({
        optimized_route_map: Location_List,
        // Nếu không có input origin, mặc định lấy vị trí hiện tại làm origin hiển thị (tuỳ logic hiển thị của bạn)
        current_origin_address: {
            adressName: null, 
            adressID: null, 
            location: null // Fallback về location user nếu không có input
        },
        current_destination_address: {
            adressName: null, 
            adressID: null, 
            location: null
        },
        brand_preference: "Coles Woolworths ALDI",
        user_current_location: location,
      });
    }

  } catch (error) {
    console.error("Lỗi khi tìm kiếm mặc định:", error);
  } finally {
    setIsSearchingMap(false);
  }
};
useEffect(() => {
  if (!isSocketReady) return;
  // executeSearch();
  const savedPrompt = localStorage.getItem("pending_prompt");
  if (savedPrompt) {
    console.log("savedPrompt: ", savedPrompt);
    handleSendMessage(savedPrompt);
    localStorage.removeItem("pending_prompt");
  }
}, [isSocketReady]);
// ==============================================
    // --- 1. SETUP SOCKET ---
  useEffect(() => {
    const connectSocket = async () => {
      const token = await getToken();
      // console.log("userId: ", userId);
      // console.log("process.env.BACKEND_IP: ", process.env.NEXT_PUBLIC_BACKEND_IP);

      if (token) {
        
        socketRef.current = io(process.env.NEXT_PUBLIC_BACKEND_IP, { // , `. "http://localhost:3001"
          auth: {
            token: token // Server sẽ đọc cái này ở socket.handshake.auth.token
          }
        });
        socketRef.current.on("connect", () => {
          console.log("Connected to backend!");
          setIsSocketReady(true);
        });



    socketRef.current.on("agent_node", (nodeName) => {
      let statusText = null;
      // Map tên Node sang trạng thái hiển thị
      if (nodeName === "search_map") {
        statusText = "Searching route...";
        setIsSearchingMap(true);
      }
      if (nodeName === "search_recipe") {
        statusText = "Searching recipes...";
        setIsSearchingRecipe(true);
      }
      if (nodeName === "search_price") {
        statusText = "Searching ingredient prices...";
        setIsSearchingPrice(true);
      }
      if (nodeName === "orchestrator") {
        statusText = "Reasoning user'intents..."; 
      }
      if (nodeName === "search_video") {
        statusText = "Searching videos...";
        setIsSearchingVideo(true);
      }
      if (nodeName === "general_chat") {
        statusText = "Chatting...";
      }
      if (nodeName === "load_update_memory") {
        statusText = "Getting the user Profile...";
      }
      if (nodeName === "search_memory") {
        statusText = "Searching past experiences...";
      }
      if (nodeName === "manage_memory") {
        statusText = "Managing memory...";
      }
      setAgentStatus(statusText);
    });

    socketRef.current.on("stream_chunk", (token: string) => {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg.role === "agent") {
          newMessages[newMessages.length - 1] = {
            ...lastMsg,
            content: lastMsg.content + token,
          };
        }
        return newMessages;
      });
    });

    
    socketRef.current.on("agent_noti", (data) => {
       setAgentStatus(data);
       
    });
    // Khi Agent tìm xong map (Backend cần gửi sự kiện này kèm dữ liệu)
    socketRef.current.on("map_result", (data) => {
       setIsSearchingMap(false); // Tắt loading ở Map
       if(data?.optimized_route_map){
          setMapDestination(data); // Cập nhật Map
       }
       
    });
    socketRef.current.on("video_result", (data) => {

      setIsSearchingVideo(false); // Tắt loading ở Video
      if(data){
        setVideoUrl(data); // Cập nhật Video
      }

    });
    socketRef.current.on("recipe_result", (data) => {
      setIsSearchingRecipe(false); // Tắt loading ở Recipe
      if(data.length >0){
        setRecipesList(data);
      }

    });
    socketRef.current.on("ingredient_price_result", (data) => {
      setIsSearchingPrice(false); // Tắt loading ở Recipe
      if(data.length >0){
        setIngredientPriceList(data);
      }

    });
    socketRef.current.on("stream_done", () => {
      setIsGenerating(false);
      setAgentStatus(null);
      setIsSearchingMap(false); 
      setIsSearchingRecipe(false); 
      setIsSearchingPrice(false); 
    });
    
    socketRef.current.on("error", (err) => {
      console.error("Socket error:", err);
      setIsGenerating(false);
      setAgentStatus(null);
    });

      }
    }
    if (userId) {
      connectSocket();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };


  }, [getToken, userId]);


  const handleSendMessage = async (msg: string, quickMode?: string[], quickQuery?: quickDataType) => {

    console.log("quickMode: ", quickMode);
    console.log("quickQuery: ", quickQuery);

    setIsGenerating(true);
    setAgentStatus("Thinking..."); // Set trạng thái mặc định ban đầu

    setMessages(prev => [
      ...prev, 
      { role: "user", content: msg },
      { role: "agent", content: "" }
    ]);

    const location = await getCurrentLocation();
    const a = location ?{latitude: location.latitude, longitude: location.longitude} : null;
    console.log("location when hancle message: ", a);
    socketRef.current?.emit("chat_message", {
      msg, 
      userCurrentLocation:a, 
      isMemoryMode: isMemoryMode,
      quickMode: quickMode || null,     // "RECIPE", "VIDEO", "PRICE", "MAP"
      quickQuery: quickQuery || null
    });
  };


  // 2. THÊM HÀM NÀY: Xử lý khi user bấm nút Stop
  const handleStopGeneration = () => {
    if (!isGenerating) return;
    // A. Báo cho Backend biết để dừng xử lý (Tiết kiệm token & tài nguyên)
    socketRef.current?.emit("interrupt_agent"); 

    // B. Cập nhật giao diện ngay lập tức
    setIsSearchingRecipe(false);
    setIsSearchingVideo(false);
    setIsSearchingPrice(false);
    setIsSearchingMap(false);
    setIsGenerating(false);
    setAgentStatus("Stopped by user");
    
  };

  const handleSaveClick = async (recipeFromChild: any, index: number) => {

      // 1. Duyệt mảng ingredientPriceList để tìm item có recipe_id khớp với id của recipe con
      // userId
      const foundPrice = ingredientPriceList.find(
        (price: any) => price.recipe_id === Number(recipeFromChild.id)
      );
      console.log("foundPrice: ", foundPrice);
      // 2. Nếu tìm thấy thì lấy, nếu không tìm được thì gán bằng null
      const matchingPrice = foundPrice || null;

      // (Tùy chọn) Bạn có thể bỏ thông báo lỗi chặn lại, vì yêu cầu là vẫn lưu dù null
      // Nếu bạn muốn cảnh báo nhẹ mà vẫn lưu thì có thể toast info ở đây
      if (!matchingPrice) {
        console.log("Lưu ý: Đang lưu công thức mà không có dữ liệu giá.");
      }

      // 3. Gọi Server Action để lưu vào Database
      // Lúc này matchingPrice có thể là object giá hoặc null
      const result = await saveRecipeToDatabase(recipeFromChild, matchingPrice);

    };

  return (
    <div className="h-full w-full flex bg-slate-50 overflow-hidden font-sans ">

      {/* Left Sidebar - Chat */}
      <div className="w-1/3 min-w-[350px] max-w-[450px] h-full">

          
        <ChatInterface 
          messages={messages} 
          isGenerating={isGenerating}
          agentStatus={agentStatus}
          onSendMessage={handleSendMessage} 
          isMemoryMode={isMemoryMode}        // Truyền giá trị xuống để hiển thị
          onToggleMemory={setIsMemoryMode}
          onStop={handleStopGeneration}
        />
      </div>



      {/* Main Dashboard */}
      <div className="flex-1 h-full flex flex-col p-3 pt-1 overflow-hidden">


        {/* Dashboard Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 min-h-0">
          
            <div className="flex flex-col gap-4 h-full min-h-0">

  {/* --- Recipe Widget (Chiếm 50% chiều cao) --- */}
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.2 }}
    // SỬA QUAN TRỌNG: Thêm 'overflow-hidden' để nội dung không tràn xuống widget dưới
    // Thêm 'rounded-xl' để bo góc container khớp với widget con
    className="flex-[3] min-h-0 overflow-hidden rounded-xl"
  >
    {/* Lưu ý: Bên trong file RecipeWidget.tsx thẻ div ngoài cùng PHẢI là h-full */}
    <RecipeWidget 
    isSearching={isSearchingRecipe}
    recipesList={recipesList}
    onSaveRecipe={handleSaveClick}
    />
  </motion.div>

  {/* --- Price Widget (Chiếm 25% chiều cao) --- */}
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
    // SỬA: Thêm overflow-hidden
    className="flex-1 min-h-0 overflow-hidden rounded-xl"
  >
    <div className="w-full h-full bg-white border border-slate-200 p-4 overflow-hidden flex flex-col">
      {/* <h3 className="font-bold text-slate-700 mb-2 shrink-0">Price Comparison</h3>
       */}
      <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="font-bold text-slate-700">Price Comparison</h3>
          
          {/* Nút bấm được di chuyển ra đây */}
          <button 
              onClick={() => setIsExpanded(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
          >
              Compare & Swap <ChevronRight className="w-3 h-3" />
          </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
         <IngredientPriceAgent 
         isLoading={isSearchingPrice} 
        //  recipesPriceData={test_ingredient_price}
         recipesPriceData={ingredientPriceList}
         isExpanded={isExpanded} 
        onClose={() => setIsExpanded(false)}
         />
      </div>
    </div>
  </motion.div>

  {/* --- Map Widget (Chiếm 25% chiều cao) --- */}
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2 }}
    className="flex-1 min-h-0 overflow-hidden rounded-xl"
  >
    <div className="w-full h-full border border-slate-200">
        <AgentMapWidget 
          destination="UTS Tower"
          isSearching={isSearchingMap}
          agentMapResult={mapDestination} 
        />
    </div>
  </motion.div>
</div>


          {/* Right Column - Stacked Widgets */}
          <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">

            {/* <div className="flex justify-end mb-6">
              <Button
                // onClick={handleAddToNotion}
                className="bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm gap-2"
              >
                <div className="w-5 h-5 flex items-center justify-center rounded bg-slate-100">
                  <span className="font-serif font-bold text-xs">N</span>
                </div>
                Add to Notion
              </Button>
            </div> */}

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="shrink-0"
            >
              <TikTokAgent 
                isLoading={isSearchingVideo} 
                videoUrl={videoUrl}
              />
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}

