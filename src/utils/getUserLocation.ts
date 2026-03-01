export interface UserLocation {
  lat: number;
  lng: number;
}

export const getCurrentLocation = (): Promise<UserLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ Geolocation"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        // Người dùng từ chối hoặc lỗi thiết bị
        reject(error);
      },
      {
        enableHighAccuracy: true, // Lấy vị trí chính xác nhất (có dùng GPS)
        timeout: 5000,            // Chờ tối đa 5s
        maximumAge: 0             // Không dùng cache cũ
      }
    );
  });
};

