"use client";

import { useEffect, useState, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapResultData } from "../dashboardPage/page";

import {getLatLongFromID} from "../../server/tools/getNearestSupermarket";
import axios from "axios";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Định nghĩa kiểu dữ liệu cho toạ độ
interface LatLng {
  lat: number;
  lng: number;
}

interface RouteVisualizerProps {
  busStops: LatLng[];    // Danh sách 30 điểm bến xe bus
  supermarketLocation: LatLng;   // Toạ độ siêu thị Coles
  busStopMiddleID: number; // Toạ độ điểm bến xe giữa
  padding?: number | google.maps.Padding;
  isBigMap?: boolean;
}

export function Directions({ agentMapResult, isBigMap = true, padding = 50 }: {agentMapResult:MapResultData, isBigMap?: boolean, padding?: number }) {
  const map = useMap();
  const mapsLibrary = useMapsLibrary("maps"); // Load thư viện 'maps' để dùng Polyline
  const markerLibrary = useMapsLibrary("marker"); // Load thư viện marker

  const busPolylineRef = useRef<google.maps.Polyline | null>(null);
  const walkPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);

    // Render radius map:
  const isRadiusMode = 
      (agentMapResult?.current_origin_address?.adressName && agentMapResult?.current_destination_address?.adressName === null) || 
      (agentMapResult?.current_origin_address?.adressName === null && agentMapResult?.current_destination_address?.adressName === null);
 
  useEffect(() => {
    if (!map || !mapsLibrary || !markerLibrary || agentMapResult === null) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = []; 

    if(isRadiusMode){
        const resultRadiusMap = agentMapResult.optimized_route_map;

        let startLocation = null;
        if(agentMapResult.current_origin_address.adressName === null){
          startLocation = {lat: agentMapResult.user_current_location.lat, lng: agentMapResult.user_current_location.lng};
        }else{
          // startLocation = agentMapResult.current_origin_address.location;
          startLocation = {lat: agentMapResult.current_origin_address.location.latitude, lng: agentMapResult.current_origin_address.location.longitude};
        }
        const bounds = new google.maps.LatLngBounds();
        //Mark current User Location
        const startMarker = new markerLibrary.Marker({
          position: startLocation,
          map: map,
          title: "Get off here & Walk",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#0ceb2dff",
            fillOpacity: 1,
            strokeWeight: 4,
            strokeColor: "#2563EB" // Viền xanh giống đường bus
          }
        });
        markersRef.current.push(startMarker);
        bounds.extend(startLocation);

        // Marker supermarkets nearest
        resultRadiusMap.forEach((supermarket) =>{
          
            const marker = new markerLibrary.Marker({
              position: {lat: supermarket.location.latitude, lng: supermarket.location.longitude},
              map: map,
              title: "Supermarket",
              animation: google.maps.Animation.DROP, // Hiệu ứng rơi xuống
            });
            markersRef.current.push(marker);
            bounds.extend({lat: supermarket.location.latitude, lng: supermarket.location.longitude});
          }
        )
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, padding);
        }
      }
      else{
  // Render route map:==============================================================================
          const busStops = agentMapResult?.optimized_route_map?.routePath || [];
          const supermarketLocation = agentMapResult?.optimized_route_map?.destinationInfo?.supermarketLocation || null;
          const busStopMiddleID = agentMapResult?.optimized_route_map?.destinationInfo?.busIndex || null;
          
          if (busStops.length === 0 && supermarketLocation===null && busStopMiddleID===null) {
              map.panTo({
                "lat": -33.88397,
                "lng": 151.20102
              });
              map.setZoom(15);
              return;
          }
          const id = busStopMiddleID;
          const originStop = busStops[0];
          const destinationStop = busStops[busStops.length - 1];
          const middleStop = busStops[id];

          let routeBusStops = busStops.filter((_, index) => {
            return index !== 0 && index !== busStops.length - 1;
          });

          // --- 1. XÓA CŨ (Cleanup) ---
          // Xóa các đường cũ nếu có
          if (busPolylineRef.current) busPolylineRef.current.setMap(null);
          // if (walkPolylineRef.current) walkPolylineRef.current.setMap(null);
          // Xóa các marker cũ
          walkPolylinesRef.current.forEach(line => line.setMap(null));
          walkPolylinesRef.current = []; // Reset mảng về rỗng

          markersRef.current.forEach(m => m.setMap(null));
          markersRef.current = [];

          // Marker 1: Điểm xuất phát (Start)
          const startMarker = new markerLibrary.Marker({
            position: originStop,
            map: map,
            title: "Get off here & Walk",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#0ceb2dff",
              fillOpacity: 1,
              strokeWeight: 4,
              strokeColor: "#2563EB" // Viền xanh giống đường bus
            }
          });
          markersRef.current.push(startMarker);
          // ----- Vẽ đường đi bộ từ origin tới bến xe đầu tiên --
          const lineSymbol = {
            path: "M 0,-1 L 0,1",   // Thêm chữ L (LineTo) để vẽ chuẩn SVG
            strokeOpacity: 1,       // Quan trọng: Nét gạch phải hiện rõ (100%), không theo đường chính (0%)
            strokeColor: "#6B7280", // Quan trọng: Màu xám phải đặt Ở ĐÂY
            strokeWeight: 2,        // Độ dày của nét gạch
            scale: 3,               // Độ dài của nét gạch
          };

          const walkOriginPath = new mapsLibrary.Polyline({
            path: [originStop, routeBusStops[0]],
            geodesic: true,
            strokeOpacity: 0,       // Ẩn đường nối chính
            icons: [
              {
                icon: lineSymbol,
                offset: "0",
                repeat: "20px",     // Giãn khoảng cách ra một chút cho dễ nhìn
              },
            ],
            map: map,
          });
          walkPolylinesRef.current.push(walkOriginPath);

          // --- 2. VẼ CHẶNG XE BUS (ĐƯỜNG LIỀN) ---
          const busPath = new mapsLibrary.Polyline({
            path: routeBusStops,
            geodesic: true,
            strokeColor: "#2563EB",
            strokeOpacity: 1.0,
            strokeWeight: 5,
            map: map,
          });
          busPolylineRef.current = busPath;
          // ========== Chấm điểm các chặng xe bus Stop ============
          if (isBigMap) {
            busStops.forEach((stop, index) => {
              if (index != id && index != 0 && index != busStops.length - 1) {

                const isStart = index === 0;

                const marker = new markerLibrary.Marker({
                  position: stop,
                  map: map,
                  title: isStart ? "Start Point" : `Bus Stop #${index}`,
                  zIndex: isStart ? 10 : 1,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isStart ? 7 : 4,
                    // Nếu là điểm đầu tiên (isStart) -> Màu đỏ, ngược lại -> Màu trắng
                    fillColor: "#FFFFFF",
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: "#2563EB", // Viền xanh
                  },
                });
                // Lưu vào ref để quản lý (xóa đi vẽ lại khi cần)
                markersRef.current.push(marker);

              }

            });
          }
          // =======================================================
          // --- 3. VẼ CHẶNG ĐI BỘ (ĐƯỜNG NÉT ĐỨT) ---

          const walkSupermarketPath = new mapsLibrary.Polyline({
            path: [middleStop, supermarketLocation],
            geodesic: true,
            strokeOpacity: 0,
            icons: [
              {
                icon: lineSymbol,
                offset: "0",
                repeat: "20px",
              },
            ],
            map: map,
          });
          walkPolylinesRef.current.push(walkSupermarketPath);
          // walkPolylineRef.current = walkSupermarketPath;

          // --- 4. TẠO MARKER (ĐIỂM ĐẦU, CHUYỂN TIẾP, ĐÍCH) ---


          // Marker 2: Điểm xuống xe bus (Transfer)
          const transferMarker = new markerLibrary.Marker({
            position: middleStop,
            map: map,
            title: "Get off here & Walk",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#fff200ff",
              fillOpacity: 1,
              strokeWeight: 4,
              strokeColor: "#2563EB" // Viền xanh giống đường bus
            }
          });
          markersRef.current.push(transferMarker);

          // Marker 3: Đích đến (Destination - Coles)
          const endMarker = new markerLibrary.Marker({
            position: supermarketLocation,
            map: map,
            title: "Coles Supermarket",
            animation: google.maps.Animation.BOUNCE, // Hiệu ứng rơi xuống
          });
          markersRef.current.push(endMarker);

          // ================== Đi bộ từ bến cuối về nhà =============
          const destinationMarker = new markerLibrary.Marker({
            position: destinationStop,
            map: map,
            title: "Destination",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#ff0022ff",
              fillOpacity: 1,
              strokeWeight: 4,
              strokeColor: "#2563EB" // Viền xanh giống đường bus
            }
          });
          markersRef.current.push(destinationMarker);


          const walkDestinationPath = new mapsLibrary.Polyline({
            path: [routeBusStops[routeBusStops.length - 1], destinationStop], 
            geodesic: true,
            strokeOpacity: 0, 
            icons: [
              {
                icon: lineSymbol,
                offset: "0",
                repeat: "20px",
              },
            ],
            map: map,
          });
          walkPolylinesRef.current.push(walkDestinationPath);

          // --- 5. TỰ ĐỘNG ZOOM ĐỂ THẤY TOÀN BỘ LỘ TRÌNH ---
          const bounds = new google.maps.LatLngBounds();
          busStops.forEach(pt => bounds.extend(pt));
          bounds.extend(supermarketLocation);
          map.fitBounds(bounds, padding);

    }
  }, [ map, mapsLibrary, markerLibrary, agentMapResult]);
  // [map, mapsLibrary, markerLibrary, mapDataFingerprint, padding]

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      if (busPolylineRef.current) busPolylineRef.current.setMap(null);
      // if (walkPolylineRef.current) walkPolylineRef.current.setMap(null);
      walkPolylinesRef.current.forEach(m => m.setMap(null));
      markersRef.current.forEach(m => m.setMap(null));
    };
  }, []);

  return null; // Component này chỉ vẽ layer lên Map
}