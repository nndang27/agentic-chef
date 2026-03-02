import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Send, Sparkles, User, Loader2 } from "lucide-react"; // Import thêm Loader2
import { useState, useRef, useEffect } from "react";

import { io, Socket } from "socket.io-client";
import { Switch } from "../../components/ui/switch"; // Nếu dùng shadcn/ui
// Hoặc dùng input checkbox thường nếu chưa có component Switch
import { BrainCircuit } from "lucide-react";
// let socket: Socket;

interface ChatInterfaceProps {
  messages: any[]; // Message type của bạn
  isGenerating: boolean;
  agentStatus: string | null;
  
  // 👇 QUAN TRỌNG: Khai báo hàm này để nhận từ cha
  onSendMessage: (text: string) => void; 
  isMemoryMode: boolean;
  onToggleMemory: (checked: boolean) => void;
}

export function ChatInterface({ 
  messages, 
  isGenerating, 
  agentStatus, 
  onSendMessage ,
  isMemoryMode,
  onToggleMemory
}: ChatInterfaceProps){
  const [input, setInput] = useState("");

  // const [isGenerating, setIsGenerating] = useState(false);
  
  // State lưu trạng thái hành động hiện tại của Agent (VD: "Thinking...", "Searching...")
  // const [agentStatus, setAgentStatus] = useState<string | null>(null);
  

  const lastUserMessageRef = useRef<HTMLDivElement>(null);


  // --- 2. LOGIC SCROLL ---
  useEffect(() => {
    if (lastUserMessageRef.current) {
      setTimeout(() => {
        lastUserMessageRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "start" 
        });
      }, 100);
    }
  }, [messages.length, agentStatus]); // Scroll cả khi status thay đổi

  // --- 3. HANDLE SEND ---
  const handleSend = () => {


    if (!input.trim() || isGenerating) return;
    
    const userText = input;
    setInput("");

    onSendMessage(userText);

  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] h-full bg-slate-50 border-r border-slate-200 overflow-hidden">
      
      {/* --- PHẦN HEADER BẠN MUỐN SỬA --- */}
      <div className="p-6 border-b border-slate-200/50 bg-white shrink-0 z-10 flex items-center justify-between">
        
        {/* Bên trái: Tiêu đề & Mô tả */}
        <div>
          <h2 className="font-display font-bold text-xl text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 fill-blue-100" />
            Food Agent
          </h2>
          <p className="text-sm text-slate-500 mt-1">Ready to help you plan.</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
          <div className="flex items-center gap-1.5">
            <BrainCircuit 
              className={`w-4 h-4 ${isMemoryMode ? "text-blue-600" : "text-slate-400"}`} 
            />
            <span className={`text-xs font-semibold ${isMemoryMode ? "text-blue-700" : "text-slate-500"}`}>
              Memory
            </span>
          </div>
          {/* Component Switch (Nếu dùng Shadcn UI) */}
          <Switch 
            checked={isMemoryMode}
            onCheckedChange={onToggleMemory}
            className="data-[state=checked]:bg-blue-600 h-5 w-9"
          />
        </div>
        
      </div>

      {/* BODY */}
      <div className="overflow-hidden bg-slate-50 relative">
         <ScrollArea className="h-full w-full">
            <div className="p-6 space-y-6 pb-[85vh]"> 
              
              {messages.map((msg, i) => {
                const isLastUserInteraction = 
                    msg.role === "user" && 
                    (i === messages.length - 1 || i === messages.length - 2);
                
                // Kiểm tra xem tin nhắn này có phải là tin nhắn cuối cùng của Agent đang gen không
                const isAgentGenerating = msg.role === "agent" && i === messages.length - 1 && isGenerating;

                return (
                  <div 
                    key={i} 
                    ref={isLastUserInteraction ? lastUserMessageRef : null}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "agent" 
                        ? "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 border border-blue-200" 
                        : "bg-slate-200 text-slate-600"
                    }`}>
                      {msg.role === "agent" ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>

                    {/* Bubble */}
                    <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                      msg.role === "agent" 
                        ? "bg-white text-slate-700 rounded-tl-none border border-slate-100" 
                        : "bg-blue-600 text-white rounded-tr-none shadow-blue-600/20"
                    }`}>
                      
                      {/* --- PHẦN SHOW THINKING (GEMINI STYLE) --- */}
                      {isAgentGenerating && agentStatus && (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-50">
                            {/* Icon xoay xoay */}
                            <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                            {/* Text gradient chuyển động */}
                            <span className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent animate-pulse">
                                {agentStatus}
                            </span>
                        </div>
                      )}

                      {/* Content chính */}
                      {msg.role === "agent" && msg.content === "" && isGenerating ? (
                        // Nếu chưa có chữ nào thì không hiện gì thêm (chỉ hiện thinking ở trên)
                        <span className="opacity-0">...</span>
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              
            </div>
         </ScrollArea>
      </div>

      {/* FOOTER */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0 z-10">
        <div className="relative">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            onKeyDown={(e) => {
               if (e.key === "Enter") {
                  // @ts-ignore
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  handleSend();
               }
            }}
            // Placeholder thay đổi theo trạng thái
            placeholder={isGenerating ? (agentStatus || "Agent is working...") : "Ask anything..."}
            className="pr-12 py-6 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-blue-500"
          />
          <Button 
            onClick={handleSend} 
            disabled={isGenerating}
            size="icon" 
            className="absolute right-1 top-1 h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white transition-all"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

    </div>
  );
}