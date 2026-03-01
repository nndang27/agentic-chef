"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import { v4 as uuidv4 } from 'uuid'; // Cần cài: npm install uuid @types/uuid

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface PlaceAutocompleteNewProps {
  onPlaceSelect: (placeId: string, address: string) => void;

  onInputChange?: (text: string) => void;

  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

interface Prediction {
  placePrediction: {
    place: string; // Đây là resource name, dạng "places/ChIJ..."
    placeId: string;
    text: {
      text: string;
    };
    structuredFormat: {
      mainText: { text: string };
      secondaryText?: { text: string };
    };
  };
}

export const PlaceAutocompleteNew = ({ onPlaceSelect, onInputChange, defaultValue, placeholder, className }: PlaceAutocompleteNewProps) => {
  const [inputValue, setInputValue] = useState(defaultValue || "");
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 1. Tạo Session Token mới khi component mount hoặc sau khi chọn xong
  useEffect(() => {
    setSessionToken(uuidv4());
  }, []);

  // 2. Xử lý click ra ngoài để đóng dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. Hàm gọi API Places (New)
  const fetchPredictions = async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
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
          sessionToken: sessionToken, // Gửi kèm token để tối ưu chi phí
          locationBias: { // (Tùy chọn) Ưu tiên vị trí Sydney (circle radius 5km)
             circle: {
               center: { latitude: -33.8688, longitude: 151.2093 },
               radius: 50000.0
             }
          },
          // Hoặc giới hạn quốc gia Úc:
          includedRegionCodes: ["au"] 
        }),
      });

      const data = await response.json();
      
      if (data.suggestions) {
        setSuggestions(data.suggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Lỗi Autocomplete New:", error);
    }
  };

  // 4. Debounce: Chỉ gọi API khi ngừng gõ 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue && document.activeElement === wrapperRef.current?.querySelector("input")) {
        fetchPredictions(inputValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // 5. Xử lý khi chọn địa điểm
  const handleSelect = (prediction: Prediction) => {
    const placeId = prediction.placePrediction.placeId;
    const fullText = prediction.placePrediction.text.text;

    setInputValue(fullText);
    setShowSuggestions(false);
    
    // Gửi ID ra ngoài
    onPlaceSelect(placeId, fullText);

    // Reset session token cho lần tìm kiếm mới
    setSessionToken(uuidv4());
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
            const newText = e.target.value;
            setInputValue(newText);
            
            // 👇 2. Quan trọng: Khi gõ phím, gọi hàm này để cha biết mà XÓA ID cũ
            if (onInputChange) {
                onInputChange(newText);
            }
        }}
        onFocus={() => inputValue.length > 1 && setShowSuggestions(true)}
        className={className}
        placeholder={placeholder}
      />
      
      {/* Dropdown Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-[9999] w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-[250px] overflow-y-auto no-scrollbar">
          {suggestions.map((item, index) => (
            <li
              key={item.placePrediction.placeId + index}
              onClick={() => handleSelect(item)}
              className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
            >
              <MapPin className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-800">
                  {item.placePrediction.structuredFormat.mainText.text}
                </span>
                <span className="text-xs text-slate-500 truncate">
                  {item.placePrediction.structuredFormat.secondaryText?.text}
                </span>
              </div>
            </li>
          ))}
          {/* Logo Google bắt buộc (Theo luật Google Maps) */}
          <li className="p-2 flex justify-end bg-slate-50">
             <img src="https://developers.google.com/maps/documentation/images/powered_by_google_on_white.png" alt="Powered by Google" className="h-4 opacity-70" />
          </li>
        </ul>
      )}
    </div>
  );
};