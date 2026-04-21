"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Message = { role: "user" | "ai"; text: string };

export default function RoverDashboard() {
  const ws = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [status, setStatus] = useState("Disconnected");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prompt, setPrompt] = useState("");
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);

  const PI_IP = "10.248.130.62";

  const sendCommand = useCallback((left: number, right: number) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ L: left, R: right }));
    }
  }, []);

  // --- WEBSOCKET & KEYBOARD LOGIC ---
  useEffect(() => {
    ws.current = new WebSocket(`ws://${PI_IP}:8765`);
    ws.current.onopen = () => setStatus("Connected (Ready to Drive)");
    ws.current.onclose = () => setStatus("Disconnected");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      const key = e.key;
      if (['w', 'W', 'ArrowUp'].includes(key)) { setActiveButton('up'); sendCommand(1.0, 1.0); }
      else if (['s', 'S', 'ArrowDown'].includes(key)) { setActiveButton('down'); sendCommand(-1.0, -1.0); }
      else if (['a', 'A', 'ArrowLeft'].includes(key)) { setActiveButton('left'); sendCommand(-1.0, 1.0); }
      else if (['d', 'D', 'ArrowRight'].includes(key)) { setActiveButton('right'); sendCommand(1.0, -1.0); }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      const key = e.key;
      if (['w', 'W', 'ArrowUp', 's', 'S', 'ArrowDown', 'a', 'A', 'ArrowLeft', 'd', 'D', 'ArrowRight'].includes(key)) {
        setActiveButton(null);
        sendCommand(0.0, 0.0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      ws.current?.close();
    };
  }, [sendCommand]);

  // --- NATIVE WEBRTC VIDEO LOGIC ---
  useEffect(() => {
    let pc: RTCPeerConnection | null = null;
    
    const startVideo = async () => {
      try {
          pc = new RTCPeerConnection();
          pc.addTransceiver("video", { direction: "recvonly" });

          pc.ontrack = (event) => {
            if (videoRef.current) videoRef.current.srcObject = event.streams[0];
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // MediaMTX WHEP Endpoint
          const response = await fetch(`http://${PI_IP}:8889/cam/whep`, {
            method: "POST",
            headers: { "Content-Type": "application/sdp" },
            body: offer.sdp,
          });

          if(response.ok) {
            const answer = await response.text();
            await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answer }));
          }
      } catch(e) {
          console.error("WebRTC Error:", e);
      }
    };

    startVideo();
    return () => {
        if(pc) pc.close();
    };
  }, []);

  // --- GEMINI AI VISION LOGIC ---
  const analyzeFrame = async (customPrompt?: string) => {
    if (!videoRef.current || !canvasRef.current) return;
    const finalPrompt = customPrompt || prompt || "Describe what you see in this image in one concise sentence.";
    
    setIsAnalyzing(true);
    setMessages(prev => [...prev, { role: "user", text: finalPrompt }]);
    setPrompt("");

    const ctx = canvasRef.current.getContext("2d");
    canvasRef.current.width = videoRef.current.videoWidth || 640;
    canvasRef.current.height = videoRef.current.videoHeight || 480;
    ctx?.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvasRef.current.toDataURL("image/jpeg", 0.8);

    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, prompt: finalPrompt }),
      });
      const data = await res.json();
      if(data.error) {
          setMessages(prev => [...prev, { role: "ai", text: `Error: ${data.error}` }]);
      } else {
          setMessages(prev => [...prev, { role: "ai", text: data.text }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", text: "Connection error with AI brain." }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePointerDown = (dir: string, l: number, r: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveButton(dir);
    sendCommand(l, r);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.releasePointerCapture(e.pointerId);
    setActiveButton(null);
    sendCommand(0, 0);
  };

  const renderDPad = () => (
    <div className="grid grid-cols-3 gap-2 w-48 touch-none select-none">
        <div />
        <button 
            onPointerDown={handlePointerDown('up', 1, 1)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`h-16 flex items-center justify-center border-4 border-black font-black text-2xl transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${activeButton === 'up' ? 'bg-[#ff0055] text-white shadow-none translate-x-[4px] translate-y-[4px]' : 'bg-[#fff500] text-black shadow-[4px_4px_0_0_#000]'}`}
        >↑</button>
        <div />
        <button 
            onPointerDown={handlePointerDown('left', -1, 1)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`h-16 flex items-center justify-center border-4 border-black font-black text-2xl transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${activeButton === 'left' ? 'bg-[#ff0055] text-white shadow-none translate-x-[4px] translate-y-[4px]' : 'bg-[#fff500] text-black shadow-[4px_4px_0_0_#000]'}`}
        >←</button>
        <button 
            onPointerDown={handlePointerDown('down', -1, -1)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`h-16 flex items-center justify-center border-4 border-black font-black text-2xl transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${activeButton === 'down' ? 'bg-[#ff0055] text-white shadow-none translate-x-[4px] translate-y-[4px]' : 'bg-[#fff500] text-black shadow-[4px_4px_0_0_#000]'}`}
        >↓</button>
        <button 
            onPointerDown={handlePointerDown('right', 1, -1)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`h-16 flex items-center justify-center border-4 border-black font-black text-2xl transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${activeButton === 'right' ? 'bg-[#ff0055] text-white shadow-none translate-x-[4px] translate-y-[4px]' : 'bg-[#fff500] text-black shadow-[4px_4px_0_0_#000]'}`}
        >→</button>
    </div>
  );

  const renderAIChat = () => (
      <div className="flex flex-col h-full bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-4 font-mono">
          <div className="flex justify-between items-center mb-4 border-b-4 border-black pb-2">
            <h2 className="text-xl font-black uppercase">Rover Vision</h2>
            <button 
              onClick={() => setMessages([])}
              className="px-2 py-1 bg-[#ff0055] text-white font-bold border-2 border-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[2px_2px_0_0_#000]"
            >Clear</button>
          </div>

          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.length === 0 && (
                <div className="text-gray-500 italic font-bold">Start a conversation to analyze the feed!</div>
            )}
            {messages.map((msg, idx) => (
                <div key={idx} className={`p-3 border-4 border-black ${msg.role === 'user' ? 'bg-[#00ffcc] ml-auto w-4/5' : 'bg-[#e0e0e0] mr-auto w-4/5'}`}>
                    <span className="font-black block mb-1 text-sm">{msg.role === 'user' ? 'YOU' : 'AI'}</span>
                    {msg.text}
                </div>
            ))}
            {isAnalyzing && (
                <div className="p-3 border-4 border-black bg-[#e0e0e0] mr-auto w-4/5 animate-pulse font-bold">
                    Analyzing frame...
                </div>
            )}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyzeFrame()}
              placeholder="Ask anything..."
              className="flex-1 border-4 border-black p-2 font-bold focus:outline-none focus:bg-[#f0f0f0] shadow-[4px_4px_0_0_#000]"
            />
            <button 
              onClick={() => analyzeFrame()}
              disabled={isAnalyzing}
              className="bg-[#fff500] hover:bg-[#e6d000] disabled:bg-gray-300 text-black border-4 border-black p-2 font-extrabold uppercase shadow-[4px_4px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            >
              Send
            </button>
          </div>
      </div>
  );

  return (
    <main className={`min-h-screen font-mono bg-[#f4f4f0] text-black ${isFullscreen ? 'fixed inset-0 z-50 overflow-hidden' : 'p-4 md:p-8 flex flex-col items-center'}`}>
      
      {/* Hidden Canvas for Image Extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {!isFullscreen && (
          <div className="w-full max-w-6xl mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
                      Rover<span className="text-[#00ffcc] neubrutalist-stroke">Mania</span>
                  </h1>
                  <div className="inline-block mt-2 px-3 py-1 border-4 border-black bg-white font-bold shadow-[4px_4px_0_0_#000]">
                      Status: <span className={status.includes("Connected") ? "text-[#00cc00]" : "text-[#ff0055]"}>{status}</span>
                  </div>
              </div>
          </div>
      )}

      <div className={`w-full max-w-6xl flex gap-8 ${isFullscreen ? 'h-full flex-row max-w-none' : 'flex-col md:flex-row'}`}>
          
          {/* Main Content Area (Video + Overlay) */}
          <div className={`relative bg-black border-4 border-black overflow-hidden flex-1 ${isFullscreen ? 'h-full shadow-none border-none' : 'aspect-video shadow-[8px_8px_0_0_#000]'}`}>
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                  <div className="w-10 h-10 border-4 border-white/50 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
              </div>

              {/* Fullscreen Toggles */}
              <button 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="absolute top-4 right-4 z-40 bg-white border-4 border-black p-2 font-bold shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
              >
                  {isFullscreen ? 'Exit Fullscreen' : '⛶ Fullscreen'}
              </button>

              {/* Overlays for Fullscreen Mode */}
              {isFullscreen && (
                  <>
                      {/* Left Side: Controls Overlay */}
                      <div className="absolute left-8 bottom-8 z-40">
                          {renderDPad()}
                      </div>

                      {/* Right Side: AI FAB */}
                      <button 
                          onClick={() => setIsAiOpen(!isAiOpen)}
                          className="absolute right-8 bottom-8 z-40 w-16 h-16 rounded-full bg-[#00ffcc] border-4 border-black flex items-center justify-center text-3xl shadow-[4px_4px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                      >
                          🤖
                      </button>

                      {/* Right Side: Floating AI Chat */}
                      {isAiOpen && (
                          <div className="absolute right-8 top-20 bottom-32 w-80 z-40 shadow-[12px_12px_0_0_#000]">
                              {renderAIChat()}
                          </div>
                      )}
                  </>
              )}
          </div>

          {/* Sidebar / Normal Mode Additional Panels */}
          {!isFullscreen && (
              <div className="flex flex-col gap-8 w-full md:w-96 shrink-0">
                  {/* Remote Controls Card */}
                  <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
                      <h2 className="text-2xl font-black uppercase mb-4 border-b-4 border-black pb-2">Manual Control</h2>
                      <div className="flex justify-center mb-4">
                          {renderDPad()}
                      </div>
                      <p className="text-sm font-bold text-gray-500 text-center">Use Arrow Keys, WASD keys, or Touch</p>
                  </div>

                  {/* AI Chat Card */}
                  <div className="h-[500px]">
                      {renderAIChat()}
                  </div>
              </div>
          )}

      </div>
      
      {/* Footer Credit */}
      <footer className="mt-12 mb-4">
        <p className="font-black uppercase text-sm border-2 border-black bg-[#fff500] px-4 py-1 shadow-[4px_4px_0_0_#000]">
          Made by Prerith.M
        </p>
      </footer>
    </main>
  );
}