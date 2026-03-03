export interface UserLocation {
  latitude: number;
  longitude: number;
}

export const getCurrentLocation = (): Promise<UserLocation | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      alert("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Lấy thành công
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        // Kiểm tra xem lỗi có phải do người dùng từ chối cấp quyền không
        if (error.code === error.PERMISSION_DENIED) {
          // Bắn Pop-up thông báo cho người dùng
          alert(
            "📍 Location permission required!\n\n" +
            "Please allow location access in your browser's address bar so the Agent can find the nearest supermarkets, then try again."
          );
        } else {
          console.warn("Lỗi lấy vị trí:", error.message);
        }
        
        // Vẫn trả về null để app không bị crash
        resolve(null);
      },
      {
        enableHighAccuracy: true, 
        timeout: 5000,            
        maximumAge: 0             
      }
    );
  });
};