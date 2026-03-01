"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { TikTokVideoItem } from "./TikTokVideoItem";
import { ChevronUp, ChevronDown } from "lucide-react";

interface TikTokFeedProps {
  videoUrls: string[];
}

export function TikTokFeed({ videoUrls }: TikTokFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Ref để khóa cuộn (tránh spam)
  const isScrolling = useRef(false);
  
  // Ref để lưu index hiện tại (để dùng trong event listener mà không cần dependency)
  const indexRef = useRef(0);

  // Cập nhật cả state và ref
  const updateIndex = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= videoUrls.length) return;
    setActiveIndex(newIndex);
    indexRef.current = newIndex;
  };

  // Hàm thực hiện cuộn đến video cụ thể
  const scrollToVideo = useCallback((index: number) => {
    if (!containerRef.current) return;
    
    isScrolling.current = true; // 🔒 Khóa lại ngay
    
    // Tính toán vị trí pixel cần đến
    const videoHeight = containerRef.current.clientHeight;
    
    containerRef.current.scrollTo({
      top: index * videoHeight,
      behavior: "smooth", // Hiệu ứng trượt mượt mà
    });

    // 🔓 Mở khóa sau 800ms (đủ để video trượt xong)
    setTimeout(() => {
      isScrolling.current = false;
    }, 800);
  }, []);

  // --- XỬ LÝ SỰ KIỆN LĂN CHUỘT (PC) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // 1. Chặn trình duyệt tự cuộn
      e.preventDefault();

      // 2. Nếu đang trượt dở thì bỏ qua mọi thao tác
      if (isScrolling.current) return;

      // 3. Xác định hướng (Chỉ cần > 0 là xuống, < 0 là lên, ko quan tâm mạnh nhẹ)
      const direction = e.deltaY > 0 ? 1 : -1;
      const nextIndex = indexRef.current + direction;

      // 4. Nếu index hợp lệ thì trượt
      if (nextIndex >= 0 && nextIndex < videoUrls.length) {
        updateIndex(nextIndex);
        scrollToVideo(nextIndex);
      }
    };

    // passive: false là bắt buộc để dùng preventDefault()
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [videoUrls.length, scrollToVideo]);

  // --- XỬ LÝ SỰ KIỆN VUỐT TAY (MOBILE/TOUCHPAD) ---
  // (Cần thêm cái này vì preventDefault ở trên sẽ chặn luôn vuốt trên điện thoại)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isScrolling.current) return;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY - touchEndY;

      // Nếu vuốt mạnh hơn 50px mới tính
      if (Math.abs(deltaY) > 50) {
        const direction = deltaY > 0 ? 1 : -1;
        const nextIndex = indexRef.current + direction;
        
        if (nextIndex >= 0 && nextIndex < videoUrls.length) {
          updateIndex(nextIndex);
          scrollToVideo(nextIndex);
        }
      }
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [videoUrls.length, scrollToVideo]);


  return (
    <div className="relative w-full max-w-md mx-auto border rounded-xl overflow-hidden shadow-2xl bg-black">
      
      {/* CONTAINER CHÍNH */}
      {/* Quan trọng: overflow-hidden để ẩn thanh cuộn xấu xí đi */}
      <div
        ref={containerRef}
        className="h-[600px] w-full overflow-hidden relative"
      >
        {videoUrls.map((url, index) => (
          <div key={index} className="h-full w-full">
            {/* Truyền isActive để video chỉ chạy khi đúng là video đang xem */}
            {/* Bạn cần sửa TikTokVideoItem nhận prop isActive để tối ưu hơn nữa */}
            <TikTokVideoItem url={url} />
          </div>
        ))}
      </div>

      {/* NÚT BẤM (Vẫn giữ để user click nếu thích) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
        <button
          onClick={() => {
            const next = activeIndex - 1;
            if(next >= 0) { updateIndex(next); scrollToVideo(next); }
          }}
          className="p-3 bg-gray-800/50 hover:bg-gray-800 text-white rounded-full backdrop-blur-sm transition"
        >
          <ChevronUp />
        </button>
        <button
          onClick={() => {
            const next = activeIndex + 1;
            if(next < videoUrls.length) { updateIndex(next); scrollToVideo(next); }
          }}
          className="p-3 bg-gray-800/50 hover:bg-gray-800 text-white rounded-full backdrop-blur-sm transition"
        >
          <ChevronDown />
        </button>
      </div>
    </div>
  );
}