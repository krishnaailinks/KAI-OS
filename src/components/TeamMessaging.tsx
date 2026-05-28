"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Hash, User, Plus } from "lucide-react";
import { SystemPermissions } from "../types/dashboard";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface TeamMessagingProps {
  permissions: SystemPermissions;
}

type ChannelId = "general" | "engineering" | "alerts" | "nishant" | "alice";

interface TeamMessage {
  id: string;
  channel_id: ChannelId;
  user_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

const initialMessages: Record<ChannelId, TeamMessage[]> = {
  general: [],
  engineering: [],
  alerts: [],
  nishant: [],
  alice: [],
};

export const TeamMessaging: React.FC<TeamMessagingProps> = ({ permissions }) => {
  const [activeChannel, setActiveChannel] = useState<ChannelId>("general");
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChannel]);

  useEffect(() => {
    let cancelled = false;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/messages?channel=${activeChannel}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setMessages(prev => ({
            ...prev,
            [activeChannel]: data.messages || [],
          }));
        }
      } catch (err) {
        console.error("Failed to fetch team messages", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`team_messages:${activeChannel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `channel_id=eq.${activeChannel}` },
        (payload) => {
          const newMessage = payload.new as TeamMessage;
          setMessages(prev => {
            if (prev[activeChannel].some(message => message.id === newMessage.id)) return prev;
            return {
              ...prev,
              [activeChannel]: [...prev[activeChannel], newMessage],
            };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeChannel]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const body = input.trim();
    setInput("");

    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: activeChannel,
          body,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdMessage = data.message as TeamMessage;
        setMessages(prev => {
          if (prev[activeChannel].some(message => message.id === createdMessage.id)) return prev;
          return {
            ...prev,
            [activeChannel]: [...prev[activeChannel], createdMessage],
          };
        });
      }
    } catch (err) {
      console.error("Failed to send message", err);
      setInput(body);
    }
  };

  const currentChat = messages[activeChannel];

  const getChannelStyle = (id: ChannelId) => {
    return activeChannel === id
      ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold shadow-sm"
      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-semibold transition-colors";
  };

  const getChannelIconStyle = (id: ChannelId) => {
    return activeChannel === id
      ? "text-blue-600 dark:text-blue-500 opacity-100"
      : "opacity-50";
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Channels Sidebar */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 flex flex-col gap-6 hidden md:flex">
        <div>
          <h3 className="text-[11px] font-bold text-slate-500 mb-3 tracking-wider uppercase">Channels</h3>
          <ul className="space-y-1">
            {(["general", "engineering", "alerts"] as ChannelId[]).map((ch) => (
              <li 
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm ${getChannelStyle(ch)}`}
              >
                <Hash className={`w-4 h-4 ${getChannelIconStyle(ch)}`} /> {ch}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-slate-500 mb-3 tracking-wider uppercase">Direct Messages</h3>
          <ul className="space-y-1">
            <li 
              onClick={() => setActiveChannel("nishant")}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm ${getChannelStyle("nishant")}`}
            >
              <span className={`w-2 h-2 rounded-full ${activeChannel === 'nishant' ? 'bg-blue-600' : 'bg-blue-400'}`}></span> Nishant
            </li>
            <li 
              onClick={() => setActiveChannel("alice")}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm ${getChannelStyle("alice")}`}
            >
              <span className={`w-2 h-2 rounded-full ${activeChannel === 'alice' ? 'bg-sky-600' : 'bg-sky-400'}`}></span> Alice
            </li>
          </ul>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            {["general", "engineering", "alerts"].includes(activeChannel) ? (
              <Hash className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            ) : (
              <User className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            )}
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 capitalize">{activeChannel}</h2>
          </div>
          <div className="flex items-center -space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">N</div>
            <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-sky-700 dark:text-sky-300">A</div>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs text-slate-500">
              <Plus className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col bg-slate-50/30 dark:bg-slate-950/20">
          {permissions.systemLockout ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-sm">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200 dark:border-red-800/50">
                  <User className="w-8 h-8 text-red-600 dark:text-red-500" />
                </div>
                <h3 className="text-red-600 dark:text-red-400 font-bold text-lg mb-2">COMMUNICATION LOCKED</h3>
                <p className="text-slate-500 text-sm font-medium">Director Mode has enforced a system-wide lockout for all non-admin personnel.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex flex-col min-h-full justify-end">
              {loading && currentChat.length === 0 && (
                <div className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Loading messages...</div>
              )}
              {currentChat.map((msg) => (
                <div key={msg.id} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
                    <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{msg.author_name}</span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed font-medium p-3 rounded-2xl rounded-tl-none shadow-sm inline-block bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                      {msg.body}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={endOfMessagesRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-2 rounded-xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-inner">
            <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" disabled={permissions.systemLockout}>
              <Paperclip className="w-4 h-4" />
            </button>
            <input 
              type="text" 
              placeholder={permissions.systemLockout ? "Chat disabled..." : `Message ${['general','engineering','alerts'].includes(activeChannel) ? '#' : '@'}${activeChannel}...`}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 px-2"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={permissions.systemLockout}
            />
            <button 
              onClick={handleSend}
              disabled={permissions.systemLockout || !input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-bold text-sm transition-all shadow-sm flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
