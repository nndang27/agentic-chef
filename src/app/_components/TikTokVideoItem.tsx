"use client";

import { useRef, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Play, Pause } from "lucide-react"; // Cần cài: npm install lucide-react

interface TikTokVideoItemProps {
  url: string;
}

export function TikTokVideoItem({ url }: TikTokVideoItemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // Tiến độ video (0-100%)
  const [duration, setDuration] = useState(0);

  // useInView để phát hiện khi lướt tới
  const { ref, inView } = useInView({
    threshold: 0.6,
  });

  // Hợp nhất ref
  const setRefs = (node: HTMLDivElement) => {
    ref(node);
  };

  // 1. Xử lý Logic Autoplay khi lướt tới
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (inView) {
      // Cố gắng phát video với âm thanh
      video.currentTime = 0;
      video.volume = 1.0; // Max Volume
      const playPromise = video.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            // Lỗi này xảy ra do trình duyệt chặn Autoplay có tiếng
            console.log("Autoplay bị chặn (cần tương tác người dùng):", error);
            setIsPlaying(false);
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [inView]);

  // 2. Hàm Toggle Play/Pause khi click
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // 3. Cập nhật thanh tiến trình khi video chạy
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      const current = video.currentTime;
      const total = video.duration || 1; // Tránh chia cho 0
      setProgress((current / total) * 100);
    }
  };

  // 4. Khi người dùng kéo thanh seekbar
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (video) {
      const manualChange = Number(e.target.value);
      video.currentTime = (video.duration / 100) * manualChange;
      setProgress(manualChange);
    }
  };

  // Lấy thời lượng video khi load xong metadata
  const onLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  return (
    <div
      ref={setRefs}
      className="relative w-full h-full snap-start flex items-center justify-center bg-black"
    >
      {/* --- VIDEO PLAYER --- */}
      <video
        ref={videoRef}
        src={url}
        className="h-full w-auto max-w-full object-contain cursor-pointer"
        onClick={togglePlay} // Click vào video để pause/play
        loop
        playsInline
        muted={false} // QUAN TRỌNG: Mở tiếng (nhưng dễ bị trình duyệt chặn autoplay)
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
      />

      {/* --- NÚT PLAY Ở GIỮA (Chỉ hiện khi Pause) --- */}
      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          // pointer-events-none để click xuyên qua vào video
        >
          <div className="bg-black/40 p-4 rounded-full backdrop-blur-sm">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* --- THANH SEEKBAR (Giống TikTok) --- */}
      <div className="absolute bottom-0 left-0 w-full px-2 py-4 group cursor-pointer z-20">
        <div className="relative w-full h-1 bg-gray-600/60 rounded-full group-hover:h-2 transition-all duration-200">
            {/* Thanh Input vô hình đè lên để kéo */}
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
            />
            
            {/* Thanh hiển thị tiến độ (Màu trắng) */}
            <div 
              className="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            
            {/* Cục tròn (Thumb) ở đầu thanh - chỉ hiện khi hover container cha */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${progress}%` }}
            />
        </div>
        
        {/* Hiển thị thời gian (Optional - giống TikTok web) */}
        <div className="flex justify-between text-[10px] text-white/80 mt-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <span>
              {videoRef.current ? formatTime(videoRef.current.currentTime) : "00:00"}
            </span>
            <span>
              {formatTime(duration)}
            </span>
        </div>
      </div>
    </div>
  );
}

// Hàm phụ để format giây thành 00:00
function formatTime(seconds: number) {
  if (!seconds) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}