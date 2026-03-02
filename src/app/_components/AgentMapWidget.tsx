// src/components/map/AgentMapWidget.tsx
"use client";

import { useState, useEffect } from "react";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { Directions } from "./DirectionsMap";
import { Dialog, DialogContent, DialogTrigger , DialogTitle} from "../../components/ui/dialog"; // Dùng Shadcn Dialog
import { Button } from "../../components/ui/button";
import { Maximize2, MapPin, Circle, ShoppingCart, Search, Loader2 } from "lucide-react";
import * as fs from 'fs';
import * as path from 'path';
// import routeResult from "/Users/nndang27/Documents/dangnn/Recipe_t3/recipe_t3/src/server/route_result.json";
import { getNearestSupermarket, getLatLongFromID } from "../../server/tools/getNearestSupermarket";
import { PlaceAutocompleteNew } from "../../components/PlaceAutocomplete"; // Import component vừa tạo
import { getCurrentLocation } from '../../utils/getUserLocation';

import { type MapResultData } from "../dashboardPage/page";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string;

// ======== Đọc latitude và longitude từ file JSON ========
// const busRouteData = routeResult.routePath;
// const colesLocation = routeResult.destinationInfo.supermarketLocation;
// const busStopMiddle = routeResult.destinationInfo.busLocation;

// const filePath = "/Users/nndang27/Documents/dangnn/Recipe_t3/recipe_t3/src/server/route_result.json";
// const rawData = fs.readFileSync(filePath, 'utf-8');
// const jsonData = JSON.parse(rawData);
// const busRouteData = jsonData.routePath;
// const colesLocation = jsonData.destinationInfo.supermarketLocation;
// =========================================================
interface LatLng {
  lat: number;
  lng: number;
}

interface FormData {
    origin: string | "",
    originId: string | null, // Lưu Place ID của Origin

    supermarket: string | "",
    supermarketId: string | null, // Lưu Place ID của Supermarket

    destination: string | "",
    destinationId: string | null // Lưu Place ID của Destination
}

export function AgentMapWidget({ destination, isSearching = true, agentMapResult }: { destination: string, isSearching?: boolean, agentMapResult: MapResultData | null }) {
  // Giả sử vị trí hiện tại của user (Có thể lấy từ navigator.geolocation)
  
  const [mapData, setMapData] = useState<MapResultData | null>(null);


  const [formData, setFormData] = useState<FormData | null>({
    origin: "",
    originId: null, // Lưu Place ID của Origin

    supermarket: "Supermarket",
    supermarketId: null, // Lưu Place ID của Supermarket

    destination: "",
    destinationId:   null // Lưu Place ID của Destination
  });

  const [isLoading, setIsLoading] = useState(false);


  useEffect(() => {
    // Nếu có kết quả từ Agent gửi xuống -> Cập nhật State ngay
    if (agentMapResult) {
      // console.log("agentMapResult: ", agentMapResult);
      setMapData(agentMapResult);

      setFormData(prev => ({
        ...prev,
        ["origin"]: agentMapResult?.current_origin_address?.adressName,
        ["originId"]: agentMapResult?.current_origin_address?.adressID,
        ["supermarket"]: agentMapResult?.brand_preference,
        ["supermarketId"]: "",
        ["destination"]: agentMapResult?.current_destination_address?.adressName,
        ["destinationId"]: agentMapResult?.current_destination_address?.adressID
      }));
    }



  }, [agentMapResult]);


const handlePlaceSelect = (field: string, placeId: string, address: string) => {
      console.log(`📍 Đã chọn ${field}:`, address, placeId);
      
      setFormData((prev) => {
        // 1. Tạo fallback data nếu state đang null
        const currentData: FormData = prev || {
            origin: "", originId: null,
            supermarket: "", supermarketId: null,
            destination: "", destinationId: null
        };

        // 2. Return object mới và ép kiểu (Type Assertion)
        return {
            ...currentData,
            [field]: address,         // Cập nhật text hiển thị (ví dụ: "UTS Tower")
            [`${field}Id`]: placeId   // Cập nhật ID ẩn (ví dụ: "ChIJ...")
        } as FormData; 
      });
  };


const handleTextInput = (field: string, text: string) => {
    setFormData((prev) => {
      // 1. Nếu prev đang null (chưa có dữ liệu), tạo object mặc định
      const currentData = prev || {
        origin: "", originId: null,
        supermarket: "", supermarketId: null,
        destination: "", destinationId: null
      };

      return {
        ...currentData,
        [field]: text,          // Cập nhật text người dùng gõ
        [`${field}Id`]: null    // ❌ XÓA ID: Gán về null để khớp với interface (string | null)
      };
    });
  };
  const isFormValid = (formData?.originId === null && formData?.destinationId === null) || (formData?.originId && formData?.destination === "") || (formData?.origin === "" && formData?.destinationId);
  // --- 2. HÀM XỬ LÝ KHI NGƯỜI DÙNG NHẬP LIỆU ---
  const handleInputChange = (field: string, value: string) => {
      setFormData((prev) => {
        // 1. Xử lý trường hợp prev bị null (fallback về giá trị mặc định)
        const currentData: FormData = prev || {
          origin: "", originId: null,
          supermarket: "", supermarketId: null,
          destination: "", destinationId: null
        };

        // 2. Cập nhật giá trị
        return {
          ...currentData,
          [field]: value
        } as FormData; // 3. Ép kiểu để báo cho TS biết đây chắc chắn là FormData
      });
    };

  // --- 3. HÀM GỬI DỮ LIỆU SANG BACKEND ---
  const handleSearch = async (e: React.MouseEvent) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    setIsLoading(true);
    console.log("📡 Đang gửi dữ liệu đi:", formData);

    try {
      const location = await getCurrentLocation();
      const currentUserLocation = {latitude: location.lat, longitude: location.lng};

      const Location_List = await getNearestSupermarket(currentUserLocation, formData?.originId, formData?.destinationId, formData?.supermarket);
      let originLocation = null;
      let destinationLocation = null;
      if (Location_List) {
        if(formData?.origin){
          originLocation = await getLatLongFromID(formData?.originId);
        }
        if(formData?.destination){
          destinationLocation = await getLatLongFromID(formData?.destinationId);
        }
        setMapData({
          optimized_route_map: Location_List,
          current_origin_address: {adressName: formData?.origin || null, adressID: formData?.originId || null, location: originLocation},
          current_destination_address: {adressName: formData?.destination || null, adressID: formData?.destinationId || null, location: destinationLocation},
          brand_preference: formData?.supermarket || null,
          user_current_location: location,
        });
      }

    } catch (error) {
      console.error("Lỗi gửi dữ liệu:", error);
    } finally {
      setIsLoading(false); // Tắt loading khi xong (hoặc đợi socket phản hồi mới tắt)
    }
  };

  return (
    <APIProvider apiKey={API_KEY}>
      
      {/* --- PHẦN 1: MINI MAP (Hiển thị kết quả Agent) --- */}
      {/* Click vào đây sẽ mở Dialog bên dưới */}
      <Dialog>
        <DialogTrigger asChild>
          <div className="relative w-full h-[200px] rounded-xl overflow-hidden cursor-pointer group border border-slate-200 hover:border-primary transition-all shadow-sm">
            
            {/* Map Nhỏ */}
            <Map
              defaultCenter={{ lat: 21.0285, lng: 105.8542 }}
              defaultZoom={13}
              gestureHandling={"none"} // Khóa zoom/scroll ở map nhỏ để dễ click
              disableDefaultUI={true} // Ẩn các nút điều khiển cho gọn
              className="w-full h-full"
            >
              <Directions 
                agentMapResult={mapData}
                isBigMap = {false}
                padding={{ top: 20, bottom: 20, left: 20, right: 20 }}
              />

            </Map>

              <div className={`
                absolute inset-0 transition flex items-center justify-center
                ${isSearching 
                  ? "bg-black/60 backdrop-blur-sm" // Khi đang search: Nền tối mờ luôn hiện
                  : "bg-black/0 group-hover:bg-black/50" // Khi bình thường: Chỉ hiện nền tối khi hover
                }
              `}>
                {/* TRƯỜNG HỢP 1: ĐANG TÌM KIẾM (LOADING) */}
                {isSearching ? (
                  <div className="flex flex-col items-center gap-2 text-white animate-in fade-in zoom-in duration-300">
                    {/* Icon xoay */}
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <span className="text-sm font-medium tracking-wide">
                      Finding the best route...
                    </span>
                  </div>
                ) : (
                  /* TRƯỜNG HỢP 2: ĐÃ TÌM XONG (HOVER ĐỂ MỞ RỘNG) */
                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 px-3 py-1 rounded-full text-xs font-medium shadow-sm flex items-center gap-1 transform transition-all duration-200 translate-y-2 group-hover:translate-y-0">
                    <Maximize2 className="w-3 h-3" />
                    Expand map
                  </span>
                )}
              </div>

          </div>
        </DialogTrigger>

        {/* --- PHẦN 2: POPUP LỚN (Full chức năng) --- */}
        <DialogContent 
          className="
            !fixed !left-[50%] !top-[50%] !translate-x-[-50%] !translate-y-[-50%] 
            w-[90vw] max-w-[90vw] h-[80vh] 
            p-0 
            overflow-hidden 
            flex flex-col 
            bg-white
            data-[state=open]:!animate-none data-[state=closed]:!animate-none
          "
        >
          {/* Thêm Title ẩn để fix lỗi accessibility */}
          <DialogTitle className="sr-only">Chi tiết bản đồ</DialogTitle>

          <div className="flex-1 relative w-full h-full">
            <Map
              defaultCenter={{ lat: 21.0285, lng: 105.8542 }}
              defaultZoom={13}
              gestureHandling={"greedy"}
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <Directions 
                agentMapResult={mapData}
                isBigMap = {true}
                padding={50}
              />
            </Map>

            {/* ===== Thanh search == */}
            <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl flex flex-col gap-3 w-[380px] border border-slate-100">
               
               {/* Hàng 1: Origin */}
               <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-3 gap-1 h-full">
                     <Circle className="w-3.5 h-3.5 text-slate-500 fill-slate-500" /> {/* Chấm tròn đặc */}
                     <div className="w-[2px] h-8 border-l-2 border-dotted border-slate-300 my-1" />
                  </div>
                  {/* Cột Input */}
                  <div className="flex-1">
                     <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Origin</label>

                    <PlaceAutocompleteNew 
                        defaultValue={formData?.origin}
                        // Khi chọn: Lưu ID
                        onPlaceSelect={(id, addr) => handlePlaceSelect("origin", id, addr)}
                        // Khi gõ: Xóa ID
                        onInputChange={(text) => handleTextInput("origin", text)} 
                        
                        className={`w-full p-2 border rounded-lg outline-none ${
                            !formData?.originId && formData?.origin ? "border-red-300 bg-red-50" : "border-slate-200"
                        }`} // (Optional) Hiện màu đỏ nếu gõ mà chưa chọn
                        placeholder="Nhập điểm bắt đầu..."
                    />
                  </div>
               </div>

               {/* Hàng 2: Supermarket (Điểm trung gian) */}
               <div className="flex items-start gap-3 -mt-2">
                   {/* Cột Icon + Line */}
                  <div className="flex flex-col items-center pt-3 gap-1 h-full">
                     <ShoppingCart className="w-4 h-4 text-orange-500" /> {/* Icon giỏ hàng */}
                     <div className="w-[2px] h-8 border-l-2 border-dotted border-slate-300 my-1" />
                  </div>
                  <div className="flex-1">
                     <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Supermarket</label>
                     <input 
                        type="text" 
                        value={formData?.supermarket || "Supermarket"}
                        // defaultValue={"Coles Broadway"} // Bạn có thể thay bằng biến tên siêu thị
                        onChange={(e) => handleInputChange("supermarket", e.target.value)}
                        className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Chọn siêu thị..."
                     />
                  </div>
               </div>

               {/* Hàng 3: Destination */}
               <div className="flex items-start gap-3 -mt-2">
                   {/* Cột Icon */}
                  <div className="flex flex-col items-center pt-3 h-full">
                     <MapPin className="w-4 h-4 text-red-600 fill-red-600" /> {/* Pin đỏ */}
                  </div>
                  <div className="flex-1">
                     <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Destination</label>
   
                    <PlaceAutocompleteNew 
                        defaultValue={formData?.destination}
                        // Khi chọn: Lưu ID
                        onPlaceSelect={(id, addr) => handlePlaceSelect("destination", id, addr)}
                        // Khi gõ: Xóa ID
                        onInputChange={(text) => handleTextInput("destination", text)} 
                        
                        className={`w-full p-2 border rounded-lg outline-none ${
                            !formData?.destinationId && formData?.destination ? "border-red-300 bg-red-50" : "border-slate-200"
                        }`} // (Optional) Hiện màu đỏ nếu gõ mà chưa chọn
                        placeholder="Nhập điểm đến..."
                    />

                  </div>
               </div>

               {/* Nút Action */}
              <Button 
                  type="button"
                  onClick={handleSearch}
                  // 👇 4. Khóa nút nếu form chưa valid
                  disabled={!isFormValid || isLoading} 
                  className={`w-full mt-2 transition-all ${
                      !isFormValid 
                      ? "bg-slate-300 cursor-not-allowed text-slate-500" // Style khi bị khóa
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-md" // Style khi mở
                  }`}
              >
                  {isLoading ? "Searching..." : "Search new route"}
              </Button>
              
              {/* (Optional) Dòng thông báo nhỏ nhắc nhở */}
              {!isFormValid && (
                  <p className="text-xs text-red-500 text-center mt-1">
                      * Vui lòng chọn địa điểm từ danh sách gợi ý
                  </p>
              )}

            </div>


          </div>
        </DialogContent>
      </Dialog>

    </APIProvider>
  );
}