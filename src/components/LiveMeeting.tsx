"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Users, Settings, UserPlus, Check, X, Send, User, Clock } from "lucide-react";
import { SystemPermissions } from "../types/dashboard";

interface LiveMeetingProps {
  permissions: SystemPermissions;
  role?: "director" | "employee";
}

type MeetingState = "lobby" | "waiting" | "active";

export const LiveMeeting: React.FC<LiveMeetingProps> = ({ permissions, role = "employee" }) => {
  const [meetingState, setMeetingState] = useState<MeetingState>("lobby");
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  
  // Fake requests state for Director
  const [joinRequests, setJoinRequests] = useState([
    { id: 1, name: "Nishant" },
    { id: 2, name: "Alice" }
  ]);
  
  // In-meeting chat
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: "System", text: "Meeting session initialized." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, meetingState]);

  useEffect(() => {
    // Request hardware permissions
    const requestPermissions = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // After permission granted, we could attach the stream to a video element.
        // For now, we just request permission to trigger the browser prompt.
      } catch (err) {
        console.warn("User denied or no media devices available", err);
        setVideoOn(false);
        setMicOn(false);
      }
    };
    if (permissions.allowVideo && (meetingState === "lobby" || meetingState === "waiting" || meetingState === "active")) {
      requestPermissions();
    }
  }, [permissions.allowVideo]);

  if (!permissions.allowVideo) {
    return (
      <div className="h-[calc(100vh-140px)] flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="text-center max-w-md p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-300 dark:border-slate-700">
            <VideoOff className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Meeting Access Restricted</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Live Meeting services have been suspended by Director Mode policies. 
            Please contact your system administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages([...chatMessages, { id: Date.now(), sender: "You", text: chatInput }]);
    setChatInput("");
  };

  const handleStartMeeting = () => {
    setMeetingState("active");
  };

  const handleJoinMeeting = () => {
    setMeetingState("waiting");
    // Simulate auto-accept after 3 seconds for employee
    setTimeout(() => {
      setMeetingState("active");
      setChatMessages(prev => [...prev, { id: Date.now(), sender: "System", text: "You have been admitted by the Host." }]);
    }, 3000);
  };

  const handleAcceptRequest = (id: number) => {
    setJoinRequests(prev => prev.filter(r => r.id !== id));
    setChatMessages(prev => [...prev, { id: Date.now(), sender: "System", text: `A new participant joined.` }]);
  };

  const handleLeaveMeeting = () => {
    setMeetingState("lobby");
    setChatMessages([{ id: 1, sender: "System", text: "Meeting session initialized." }]);
  };

  if (meetingState === "lobby" || meetingState === "waiting") {
    return (
      <div className="h-[calc(100vh-140px)] flex items-center justify-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 relative overflow-hidden">
        
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row">
          <div className="p-8 md:w-1/2 flex flex-col justify-center items-center text-center border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 border-4 border-white dark:border-slate-950 shadow-sm relative">
              {videoOn ? (
                <User className="w-10 h-10 text-slate-500" />
              ) : (
                <VideoOff className="w-10 h-10 text-slate-500" />
              )}
              <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center ${micOn ? 'bg-green-500' : 'bg-red-500'}`}>
                {micOn ? <Mic className="w-3 h-3 text-white" /> : <MicOff className="w-3 h-3 text-white" />}
              </div>
            </div>
            
            <div className="flex gap-4 mb-6">
               <button 
                onClick={() => setMicOn(!micOn)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${micOn ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-100"}`}
               >
                 {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
               </button>
               <button 
                onClick={() => setVideoOn(!videoOn)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${videoOn ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-100"}`}
               >
                 {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
               </button>
            </div>
          </div>

          <div className="p-8 md:w-1/2 flex flex-col justify-center">
            {meetingState === "waiting" ? (
              <div className="text-center">
                <div className="inline-block p-4 bg-sky-50 dark:bg-sky-900/20 rounded-full mb-4">
                  <Clock className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Waiting for Host</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  The Director will let you in soon. Ensure your devices are configured.
                </p>
                <button 
                  onClick={handleLeaveMeeting}
                  className="mt-6 px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors text-sm"
                >
                  Cancel Request
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Q3 Architecture Sync</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                  {role === "director" ? "You are the Host. Start when ready." : "Ready to join?"}
                </p>
                
                {role === "director" ? (
                  <button 
                    onClick={handleStartMeeting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <Video className="w-5 h-5" /> Start Meeting as Host
                  </button>
                ) : (
                  <button 
                    onClick={handleJoinMeeting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" /> Ask to Join
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex bg-slate-900 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md">
      
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Top Bar */}
        <div className="absolute top-0 inset-x-0 h-14 flex items-center justify-between px-6 bg-gradient-to-b from-white/90 to-transparent dark:from-slate-900/90 dark:to-transparent z-20 text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
            <span className="text-sm font-bold tracking-wide text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-md">Q3 ARCHITECTURE SYNC</span>
            <span className="px-2 py-0.5 bg-slate-100/80 dark:bg-slate-800/80 text-[10px] text-slate-600 dark:text-slate-300 rounded-md font-mono border border-slate-300/50 dark:border-slate-600/50 backdrop-blur-sm">00:45:12</span>
          </div>
          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-200">
            <button className="hover:text-slate-900 dark:hover:text-white transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Grid Area */}
        <div className="flex-1 p-4 pt-16 grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950">
          {/* Main Speaker */}
          <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden group shadow-sm dark:shadow-inner">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-slate-100 dark:bg-slate-700 border-4 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center mb-6">
                <span className="text-4xl font-bold text-slate-400">AL</span>
              </div>
              <div className="flex gap-1.5 items-end h-6">
                <span className="w-1.5 h-3 bg-blue-500 animate-pulse rounded-full"></span>
                <span className="w-1.5 h-5 bg-blue-500 animate-[pulse_1s_ease-in-out_infinite] rounded-full"></span>
                <span className="w-1.5 h-6 bg-blue-500 animate-[pulse_0.8s_ease-in-out_infinite] rounded-full"></span>
                <span className="w-1.5 h-4 bg-blue-500 animate-pulse rounded-full"></span>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Alice L. (Speaking)</span>
            </div>
          </div>

          {/* Other Participants */}
          <div className="col-span-2 md:col-span-1 grid grid-rows-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden shadow-sm dark:shadow-inner">
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                   <span className="text-2xl font-bold text-slate-400">NS</span>
                 </div>
               </div>
               <div className="absolute bottom-3 left-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <MicOff className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-300">Nishant</span>
               </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden shadow-sm dark:shadow-inner">
               {videoOn ? (
                 <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-2 border-blue-500/30">
                     <span className="text-2xl font-bold text-slate-400">YOU</span>
                   </div>
                 </div>
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 dark:bg-slate-900/50">
                   <VideoOff className="w-10 h-10 text-slate-400 dark:text-slate-600" />
                 </div>
               )}
               <div className="absolute bottom-3 left-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  {micOn ? <Mic className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <MicOff className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />}
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-300">You</span>
               </div>
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <div className="h-24 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-4 px-6 z-10">
          <button 
            onClick={() => setMicOn(!micOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm border ${
              micOn ? "bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600" : "bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/30"
            }`}
          >
            {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          <button 
            onClick={() => setVideoOn(!videoOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm border ${
              videoOn ? "bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600" : "bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/30"
            }`}
          >
            {videoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
          <button 
            className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm"
            title="Share Screen"
          >
            <MonitorUp className="w-6 h-6" />
          </button>
          
          <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 mx-2"></div>

          
          <button 
            onClick={handleLeaveMeeting}
            className="px-8 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:shadow-red-500/20"
          >
            <PhoneOff className="w-5 h-5" />
            {role === "director" ? "End Meeting" : "Leave"}
          </button>
        </div>
      </div>

      {/* Side Panel: Requests & Chat */}
      <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col hidden lg:flex">
        
        {/* Pending Requests for Director */}
        {role === "director" && joinRequests.length > 0 && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Waiting Room ({joinRequests.length})
            </h3>
            <div className="space-y-2">
              {joinRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 shadow-sm">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{req.name}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setJoinRequests(prev => prev.filter(r => r.id !== req.id))} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleAcceptRequest(req.id)} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meeting Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Session Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900 text-sm">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'System' ? 'items-center' : msg.sender === 'You' ? 'items-end' : 'items-start'}`}>
                {msg.sender === 'System' ? (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{msg.text}</span>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-slate-400 mb-1">{msg.sender}</span>
                    <div className={`px-3 py-2 rounded-xl ${msg.sender === 'You' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-blue-500">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Message meeting..." 
                className="flex-1 bg-transparent text-sm px-2 focus:outline-none dark:text-white"
              />
              <button 
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                className="p-1.5 bg-blue-600 text-white rounded-md disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
