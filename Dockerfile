# Sử dụng base image Node.js 20 trên nền Debian (hỗ trợ tốt apt)
FROM node:20-bookworm

# Đặt thư mục làm việc
WORKDIR /workspace/recipe_optimm

# ---------------------------------------------------------
# PHẦN 1 & 4: CÀI ĐẶT HỆ THỐNG & YT-DLP
# Cài đặt git, python3 (cần cho yt-dlp) và các công cụ cơ bản
# ---------------------------------------------------------
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y git curl python3 nano procps && \
    npm install -g pnpm pm2 && \
    # Cài đặt yt-dlp
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# ---------------------------------------------------------
# PHẦN 2: CÀI ĐẶT AI (OLLAMA & MODELS)
# ---------------------------------------------------------
RUN curl -fsSL https://ollama.com/install.sh | sh

# Mẹo: Khởi chạy Ollama tạm thời trong lúc build để pull model.
# LƯU Ý: Việc pull Llama 3.1 8B và mxbai-embed-large sẽ làm image nặng thêm khoảng ~5.5GB.
RUN nohup bash -c "ollama serve &" && \
    sleep 5 && \
    ollama pull llama3.1:8b && \
    ollama pull mxbai-embed-large && \
    pkill ollama

# ---------------------------------------------------------
# PHẦN 3: CODE & PHỤ THUỘC
# Thay vì git clone, chúng ta copy trực tiếp code từ máy vào container
# để tận dụng cache của Docker khi code thay đổi.
# ---------------------------------------------------------
COPY . .

# Cài đặt các package và build Frontend
RUN pnpm install && \
    pnpm run build

# ---------------------------------------------------------
# PHẦN 5: KHỞI CHẠY & CẤU HÌNH
# ---------------------------------------------------------
# Cấp quyền thực thi cho file start.sh
RUN chmod +x ./start.sh

# Mở các cổng cần thiết (Thay đổi cổng nếu app của bạn dùng port khác)
# Ví dụ: 3000 (Frontend), 8080 (Backend Socket), 11434 (Ollama)
EXPOSE 3000 8080 11434

# Lệnh chạy cuối cùng khi container start
CMD ["./start.sh"]