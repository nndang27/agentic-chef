#!/bin/bash

# 1. Khởi chạy Ollama ngầm
echo "Starting Ollama..."
ollama serve &
# Đợi một chút để daemon của Ollama sẵn sàng
sleep 5

# 2. Khởi chạy Backend
echo "Starting Backend..."
pm2 start "npx tsx --env-file=./.env src/server/start_backend.ts" --name backend_main

# 3. Khởi chạy Frontend
echo "Starting Frontend..."
pm2 start "pnpm start" --name frontend_main

# 4. Giữ cho container luôn chạy và hiển thị log để bạn dễ debug (đặc biệt là socket)
pm2 logs