import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid'; // Cần cài: npm install uuid @types/uuid

// ================= CONFIGURATION =================
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// const ORIGIN = 'UTS Tower, 1/15 Broadway, Ultimo NSW 2007';
// const DESTINATION = '148 Homer St, Earlwood NSW 2204';
// =================================================

const BRAND_NAME = 'Coles Woolworths Aldi'; 
const MAX_WALKING_DISTANCE = 500;
// ============================================


// 1. Giải mã Polyline của Google thành mảng tọa độ [lat, lng]
function decodePolyline(encoded: string) {
    const poly: {lat: number, lng: number}[] = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return poly;
}

// 2. Tính khoảng cách giữa 2 điểm (Haversine Formula)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // Bán kính trái đất (mét)
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 3. Tính khoảng cách ngắn nhất từ 1 điểm đến đường Polyline
function minDistanceToPolyline(point: {lat: number, lng: number}, polyline: {lat: number, lng: number}[]) {
    let minDist = Infinity;
    let minLocationBus = null;
    let minIndex = null;
    // Để tối ưu hiệu năng, ta check khoảng cách tới từng điểm trên polyline
    // (Phiên bản đơn giản hóa, đủ dùng cho bài toán tìm siêu thị)
    for (const [index, p] of polyline.entries()) {
        const dist = getDistanceFromLatLonInM(point.lat, point.lng, p.lat, p.lng);
        if (dist < minDist){
            minDist = dist;
            minLocationBus = p;
            minIndex = index;
        }
    }
    return {minDist, minLocationBus, minIndex};
}

// --- CÁC HÀM GỌI API ---

export async function getNearestSupermarket(currentUserLocation: {latitude: number, longitude: number}, originId: string, destinationId: string, SUPERMARKET_NAME: string) {

    if (originId  && destinationId === null) {
        const { latitude, longitude } = await getLatLongFromID(originId);
        const nearestSupermarket = await getSupermarketByRadius(latitude, longitude, 2000, SUPERMARKET_NAME);
        return nearestSupermarket;

    }
    else if (originId === null && destinationId === null) {
        const nearestSupermarket = await getSupermarketByRadius(currentUserLocation.latitude, currentUserLocation.longitude, 2000, SUPERMARKET_NAME);
        return nearestSupermarket;
    }

    try {
        // Gọi Routes API
        const routeRes = await axios.post('https://routes.googleapis.com/directions/v2:computeRoutes', {
            origin: originId 
            ? { placeId: originId } 
            : { 
                location: {
                    latLng: {
                        latitude: currentUserLocation.lat,
                        longitude: currentUserLocation.lng
                    }
                }
            },
                destination: { placeId: destinationId },
                travelMode: 'TRANSIT',
                transitPreferences: { allowedTravelModes: ['BUS'] }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'routes.polyline,routes.viewport,routes.legs' // Lấy thêm viewport
            }
        });
        const route = routeRes.data.routes[0];
        
        const viewport = route.viewport; // { low: {latitude, longitude}, high: {...} }
        const encodedPolyline = route.polyline.encodedPolyline;
        // console.log(3);

        // Gọi Places API (Text Search) với giới hạn vùng (Rectangle)
        const placesRes = await axios.post('https://places.googleapis.com/v1/places:searchText', {
            textQuery: SUPERMARKET_NAME,
            locationRestriction: {
                rectangle: {
                    low: viewport.low,
                    high: viewport.high
                }
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'
            }
        });
        // console.log(4);
        const candidates = placesRes.data.places || [];
        // console.log("===================================================");

        const routePath = decodePolyline(encodedPolyline);

        const validResults = [];

        for (const place of candidates) {
            const placeLoc = { lat: place.location.latitude, lng: place.location.longitude };
            
            // Tính khoảng cách từ siêu thị đến đường xe bus chạy
            const {minDist, minLocationBus, minIndex} = minDistanceToPolyline(placeLoc, routePath);

            if (minDist <= MAX_WALKING_DISTANCE) {
                validResults.push({
                    name: place.displayName.text,
                    address: place.formattedAddress,
                    walkingDistance: Math.round(minDist),
                    supermarketLocation: placeLoc,
                    busIndex: minIndex
                });
            }
        }

        // Sắp xếp theo khoảng cách đi bộ gần nhất
        validResults.sort((a, b) => a.walkingDistance - b.walkingDistance);
        // console.log("routePath: ", routePath);
        // console.log("===================================================");
        // console.log("validResults: ", validResults[0]);
        // console.log("===================================================");

        let minValue = null;
        for (const value of validResults) {
            if (value.name.includes(SUPERMARKET_NAME)) {
                minValue = value;
                break;
            }
        }
        if(minValue !== null) {
            const dataToSave = {
                routePath: routePath,
                destinationInfo: minValue 
            };
            // console.log("dataToSave: ", dataToSave);
            return dataToSave;
        }

        const dataToSave = {
                routePath: routePath,
                destinationInfo: validResults[0] 
            };
        // console.log("dataToSave: ", dataToSave);
        return dataToSave;


    } catch (error: any) {
        console.error('Lỗi:', error.message);
        if (error.response) console.error(JSON.stringify(error.response.data, null, 2));
    }
}

// main();

// getNearestSupermarket("UTS Tower", "148 Homer St", "Coles");


export const autoCompleteAddress = async (input: string) => {
    if (!input || input.length < 2) {
      return;
    }

    try {
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY as string,
        },
        body: JSON.stringify({
          input: input,
          sessionToken: uuidv4(), 
          locationBias: { 
             circle: {
               center: { latitude: -33.8688, longitude: 151.2093 },
               radius: 50000.0
             }
          },
          includedRegionCodes: ["au"] 
        }),
      });

      const data = await response.json();
      
      // LOGIC MỚI Ở ĐÂY 👇
      if (data.suggestions && data.suggestions.length > 0) {

            // 1. Lấy kết quả tốt nhất (cái đầu tiên)
            const bestMatch = data.suggestions[0];
            console.log("bestMatch: ", bestMatch);
            return bestMatch;

      } else {
        return null;
      }
    } catch (error) {
      console.error("Lỗi Autocomplete New:", error);
    }
  };


export const getLatLongFromID = async (placeId: string) => {
    const detailRes = await axios.get(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'location' // Chỉ lấy field location để tiết kiệm chi phí & băng thông
        }
    });
    return detailRes.data.location;
}


export const getSupermarketByRadius = async (lat: number, lng: number, radius: number, SUPERMARKET_NAME: string) => {
    const placesRes = await axios.post('https://places.googleapis.com/v1/places:searchText', {
        textQuery: SUPERMARKET_NAME,
        
        // Sử dụng locationBias để ưu tiên tìm gần vị trí này
        locationBias: {
            circle: {
                center: {
                    latitude: lat,  // Thay bằng biến lat của bạn
                    longitude: lng // Thay bằng biến lng của bạn
                },
                radius: radius // Đơn vị là mét (10km = 10000m)
            }
        },
        
        // Tùy chọn: Giới hạn số lượng kết quả (nếu cần)
        maxResultCount: 10,
    }, {
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            // Bạn nên lấy thêm id để sau này dùng nếu cần
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
        }
    });
    return placesRes.data.places;
}