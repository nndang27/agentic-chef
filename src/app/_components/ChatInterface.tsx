import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Send, Sparkles, User, Loader2, Square, ChevronUp, ChevronDown , CheckCircle2, Circle} from "lucide-react"; // Import thêm Loader2
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
  onStop?: () => void;
}

export interface quickDataType {
    recipeDish: string | "",
    videoDish: string | "",
    priceIngredients: string | "",
    mapOrigin: string | "",
    mapDestination: string | "",
    mapSupermarket: string | ""
  }

export function ChatInterface({ 
  messages, 
  isGenerating, 
  agentStatus, 
  onSendMessage ,
  isMemoryMode,
  onToggleMemory,
  onStop
}: ChatInterfaceProps){

  const [input, setInput] = useState("");
  const lastUserMessageRef = useRef<HTMLDivElement>(null);

  // --- STATE CHO QUICK MODE ---
  const [isQuickPanelOpen, setIsQuickPanelOpen] = useState(true);
  const [activeModes, setActiveModes] = useState({
    RECIPE: false, PRICE: false, MAP: false, VIDEO: false
  });

  const [quickData, setQuickData] = useState<quickDataType>({
    recipeDish: "",
    videoDish: "",
    priceIngredients: "",
    mapOrigin: "",
    mapDestination: "",
    mapSupermarket: ""
  });


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
      if (!input.trim()) return;

      const userText = input;
      setInput("");
      onSendMessage(userText);
    };


    // Placeholder động cho Price dựa vào Recipe
  const pricePlaceholder = (activeModes.RECIPE && quickData.recipeDish.trim()) 
    ? `${quickData.recipeDish} ingredients` 
    : "e.g., beef, onions, garlic";

  const videoPlaceholder = (activeModes.RECIPE && quickData.recipeDish.trim()) 
    ? `cooking ${quickData.recipeDish}` 
    : "Dish name (e.g: pho,..)";
  // Hàm toggle bật/tắt module
  const toggleMode = (mode: keyof typeof activeModes) => {
    setActiveModes(prev => ({ ...prev, [mode]: !prev[mode] }));
  };

  // Cập nhật dữ liệu input
  const updateData = (field: keyof typeof quickData, value: string) => {
  setQuickData(prev => ({ ...prev, [field]: value }));
  };
// Hàm xử lý riêng cho nút Enter trên Quick Panel
  const handleComboSubmit = () => {
    // Kiểm tra xem có chọn module nào không
    const selectedModes = Object.keys(activeModes).filter(k => activeModes[k as keyof typeof activeModes]);
    if (selectedModes.length === 0 || isGenerating) return;

    // 1. Tạo câu chat hiển thị cho đẹp
    let displayLines = ["⚡ Quick Combo Task:"];
    if (activeModes.RECIPE) displayLines.push(`- 🍳 Recipe: ${quickData.recipeDish || "Not specified"}`);
    if (activeModes.VIDEO){
      const p = quickData.videoDish || (activeModes.RECIPE ? `cooking ${quickData.recipeDish}` : "Not specified");
      displayLines.push(`- 📺 Video: ${p}`);
    } 
    if (activeModes.PRICE) {
      const p = quickData.priceIngredients || (activeModes.RECIPE ? `Ingredients of ${quickData.recipeDish}` : "All");
      displayLines.push(`- 💰 Price: ${p}`);
    }
    if (activeModes.MAP) {
      const origin_required = `${quickData.mapOrigin}` || "Your current location"
      const supermarket_required = `${quickData.mapSupermarket}` || "Coles, Woolworths, Aldi,.."
      const destination_required = `${quickData.mapDestination}` || ""
      displayLines.push(`- 📍 Map: ${origin_required} -> ${destination_required} (${supermarket_required})`);
    }

    const displayMsg = displayLines.join("\n");

    // 2. Gom dữ liệu gửi xuống Backend
    const payload = {
      modes: selectedModes, // ["RECIPE", "PRICE"]
      data: quickData       // Gửi toàn bộ params xuống
    };

    // 3. Đóng panel, clear input (tuỳ chọn) và gửi
    setIsQuickPanelOpen(false);
    onSendMessage(displayMsg, payload.modes, payload.data); 
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
{/* ------------------- */}
{/* --- QUICK ACTION PANEL (COMBO MODE) --- */}
      <div className="relative z-20 w-full bg-white border-t border-slate-200 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] transition-all duration-300">
        
        <button 
          onClick={() => setIsQuickPanelOpen(!isQuickPanelOpen)}
          className="absolute -top-6 left-1/2 -translate-x-1/2 h-6 px-6 bg-white border border-slate-200 border-b-0 rounded-t-xl text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center shadow-[0_-2px_5px_-1px_rgba(0,0,0,0.05)]"
        >
          {isQuickPanelOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        <div className={`overflow-hidden transition-all duration-500 ${isQuickPanelOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="p-4 grid grid-cols-2 gap-3 bg-slate-50 overflow-y-auto max-h-80">
            
            {/* CARD: RECIPE */}
            <div 
              className={`p-3 border rounded-xl transition-all cursor-pointer ${activeModes.RECIPE ? "bg-white border-blue-400 shadow-sm ring-1 ring-blue-400/20" : "bg-transparent border-slate-200 opacity-60 hover:opacity-100"}`}
              onClick={() => toggleMode('RECIPE')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">🍳 Recipe</span>
                {activeModes.RECIPE ? <CheckCircle2 className="w-4 h-4 text-blue-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
              </div>
              {activeModes.RECIPE && (
                <div onClick={e => e.stopPropagation()}>
                  <input 
                    placeholder={"Dish name (e.g., Spring Roll)"} 
                    value={quickData.recipeDish}
                    onChange={(e) => updateData('recipeDish', e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* CARD: VIDEO */}
            <div 
              className={`p-3 border rounded-xl transition-all cursor-pointer ${activeModes.VIDEO ? "bg-white border-blue-400 shadow-sm ring-1 ring-blue-400/20" : "bg-transparent border-slate-200 opacity-60 hover:opacity-100"}`}
              onClick={() => toggleMode('VIDEO')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">📺 Video</span>
                {activeModes.VIDEO ? <CheckCircle2 className="w-4 h-4 text-blue-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
              </div>
              {activeModes.VIDEO && (
                <div onClick={e => e.stopPropagation()}>
                  <input 
                    placeholder={videoPlaceholder} 
                    value={quickData.videoDish}
                    onChange={(e) => updateData('videoDish', e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* CARD: PRICE */}
            <div 
              className={`p-3 border rounded-xl transition-all cursor-pointer ${activeModes.PRICE ? "bg-white border-blue-400 shadow-sm ring-1 ring-blue-400/20" : "bg-transparent border-slate-200 opacity-60 hover:opacity-100"}`}
              onClick={() => toggleMode('PRICE')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">💰 Price</span>
                {activeModes.PRICE ? <CheckCircle2 className="w-4 h-4 text-blue-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
              </div>
              {activeModes.PRICE && (
                <div onClick={e => e.stopPropagation()}>
                  <input 
                    placeholder={pricePlaceholder} 
                    value={quickData.priceIngredients}
                    onChange={(e) => updateData('priceIngredients', e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* CARD: MAP */}
            <div 
              className={`p-3 border rounded-xl transition-all cursor-pointer ${activeModes.MAP ? "bg-white border-blue-400 shadow-sm ring-1 ring-blue-400/20" : "bg-transparent border-slate-200 opacity-60 hover:opacity-100"}`}
              onClick={() => toggleMode('MAP')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">📍 Map</span>
                {activeModes.MAP ? <CheckCircle2 className="w-4 h-4 text-blue-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
              </div>
              {activeModes.MAP && (
                <div onClick={e => e.stopPropagation()} className="space-y-2">
                  <input 
                    placeholder="Origin " 
                    value={quickData.mapOrigin}
                    onChange={(e) => updateData('mapOrigin', e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input 
                    placeholder="Destination" 
                    value={quickData.mapDestination}
                    onChange={(e) => updateData('mapDestination', e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input 
                    placeholder="Supermarket(e.g., Coles, Woolies)" 
                    value={quickData.mapSupermarket}
                    onChange={(e) => updateData('mapSupermarket', e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* NÚT SUBMIT COMBO */}
          <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
             <Button 
                onClick={handleComboSubmit}
                disabled={isGenerating || !Object.values(activeModes).some(v => v)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 font-semibold shadow-md"
             >
                ✨ Run Quick Combo
             </Button>
          </div>
        </div>
      </div>


      {/* FOOTER */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0 z-10">
        <div className={`flex items-center w-full h-16 rounded-[32px] border transition-all px-2 ${
          // activeQuickInput || null 
          //   ? "bg-slate-100 border-slate-200 opacity-60 pointer-events-none" :// Khóa thanh chat khi đang dùng Quick Panel
             "bg-slate-50 border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500"
        }`}>
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isGenerating} // || activeQuickInput !== null
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && !isGenerating) {
                      e.preventDefault();
                      handleSend();
                  }
                }}
                // placeholder={isGenerating ? (agentStatus || "Agent is working...") : "Ask anything..."}
                placeholder={
              isGenerating ? (agentStatus || "Agent is working...") 
              : "Ask anything..." //: activeQuickInput ? "Quick Search is active..." 
              //: 
            }
                // --- STYLE INPUT MỚI ---
                // 1. bg-transparent & border-none: Để nó hòa vào container cha
                // 2. h-full: Chiều cao ăn theo container (100% căn giữa)
                // 3. focus-visible:ring-0: Tắt viền focus mặc định của shadcn
                className="flex-1 h-full bg-transparent border-none shadow-none focus-visible:ring-0 text-base px-6 placeholder:text-slate-400" 
              />
              
              <Button 
                onClick={isGenerating ? onStop : handleSend}
                disabled={!isGenerating && !input.trim()}
                size="icon" 
                
                // --- STYLE MỚI ---
                className={`h-11 w-11 shrink-0 rounded-full transition-all duration-200 flex items-center justify-center mr-1 ${
                  isGenerating 
                    ? "bg-blue-400 text-white hover:bg-blue-600 shadow-md" // STOP: Màu đỏ (Rõ ràng chức năng dừng)
                    : input.trim() 
                      ? "bg-blue-400 text-white hover:bg-blue-600 shadow-lg shadow-blue-200" // SEND: Màu xanh (Tông xuyệt tông)
                      : "bg-slate-100 text-slate-400 cursor-not-allowed" // DISABLED: Màu xám rất nhạt
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center">
                      {/* Icon Stop màu trắng */}
                      <Square className="w-3.5 h-3.5 fill-current" /> 
                  </div>
                ) : (
                  // Icon Send
                  <Send className="w-5 h-5 ml-0.5" />
                )}
              </Button>
            </div>
          </div>

      </div>
  );
}