"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Video, VideoOff, PhoneOff, Plus, Users, X } from "lucide-react";
import type { SystemPermissions } from "../types/dashboard";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface VoiceRoomParticipant {
  user_id: string;
  display_name: string;
}

interface VoiceRoom {
  id: string;
  name: string;
  room_code: string;
  is_active: boolean;
  max_participants: number;
  created_by: string | null;
  participants: VoiceRoomParticipant[];
}

export interface ActiveMeeting {
  roomCode: string;
  roomName: string;
  roomId: string;
}

interface LiveMeetingProps {
  permissions: SystemPermissions;
  role?: "director" | "employee";
  activeMeeting?: ActiveMeeting | null;
  onLeaveMeeting?: () => void;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export const LiveMeeting: React.FC<LiveMeetingProps> = ({
  permissions,
  role,
  activeMeeting,
  onLeaveMeeting,
}) => {
  const [voiceRooms, setVoiceRooms] = useState<VoiceRoom[]>([]);
  const [currentMeeting, setCurrentMeeting] = useState<ActiveMeeting | null>(
    activeMeeting ?? null,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  // Cache the auth token so we can send a leave beacon on page unload.
  const sessionTokenRef = useRef<string | null>(null);
  // Keep a ref to currentMeeting so the unload handler always sees the latest value.
  const currentMeetingRef = useRef<ActiveMeeting | null>(activeMeeting ?? null);

  // Sync prop-driven join (from TeamMessaging sidebar)
  useEffect(() => {
    if (activeMeeting) {
      setCurrentMeeting(activeMeeting);
      currentMeetingRef.current = activeMeeting;
    }
  }, [activeMeeting]);

  // Keep the session token cached so unload handler can use it synchronously.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      sessionTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  // Keep the ref in sync so the unload handler always has the latest roomId.
  useEffect(() => {
    currentMeetingRef.current = currentMeeting;
  }, [currentMeeting]);

  // Clean up participant record when the user closes the tab or navigates away.
  // fetch with keepalive:true fires even as the page unloads.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const meeting = currentMeetingRef.current;
      const token = sessionTokenRef.current;
      if (!meeting?.roomId || !token) return;
      fetch(`/api/voice-rooms/${meeting.roomId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const fetchRooms = useCallback(async () => {
    const res = await apiFetch("/api/voice-rooms").catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setVoiceRooms(data.rooms || []);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const id = setInterval(fetchRooms, 8_000);
    return () => clearInterval(id);
  }, [fetchRooms]);

  const handleJoinRoom = async (room: VoiceRoom) => {
    const res = await apiFetch(`/api/voice-rooms/${room.id}/join`, {
      method: "POST",
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      const meeting = {
        roomCode: data.room_code,
        roomName: data.room_name,
        roomId: data.room_id,
      };
      setCurrentMeeting(meeting);
      currentMeetingRef.current = meeting;
      fetchRooms();
    }
  };

  const handleLeave = async () => {
    if (currentMeeting?.roomId) {
      await apiFetch(`/api/voice-rooms/${currentMeeting.roomId}/leave`, {
        method: "POST",
      }).catch(() => {});
    }
    setCurrentMeeting(null);
    currentMeetingRef.current = null;
    onLeaveMeeting?.();
    fetchRooms();
  };

  const handleCreateAndJoin = async () => {
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const createRes = await apiFetch("/api/voice-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoomName, max_participants: 20 }),
      }).catch(() => null);
      if (!createRes?.ok) return;
      const { room } = await createRes.json();

      const joinRes = await apiFetch(`/api/voice-rooms/${room.id}/join`, {
        method: "POST",
      }).catch(() => null);
      if (joinRes?.ok) {
        const data = await joinRes.json();
        const meeting = {
          roomCode: data.room_code,
          roomName: data.room_name,
          roomId: data.room_id,
        };
        setCurrentMeeting(meeting);
        currentMeetingRef.current = meeting;
        setShowCreate(false);
        setNewRoomName("");
        fetchRooms();
      }
    } finally {
      setCreating(false);
    }
  };

  // ── Gate: video permission not granted ─────────────────────────────────────
  if (!permissions.allowVideo) {
    return (
      <div className="h-[calc(100vh-140px)] flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="text-center max-w-md p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-300 dark:border-slate-700">
            <VideoOff className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
            Meeting Access Restricted
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live meeting services require video access permission.
            Contact your director to enable this feature for your account.
          </p>
        </div>
      </div>
    );
  }

  // ── Active meeting: Jitsi Meet iframe ──────────────────────────────────────
  if (currentMeeting) {
    const jitsiUrl = `https://meet.jit.si/${currentMeeting.roomCode}`;
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Meeting toolbar */}
        <div className="h-11 bg-slate-900 border-b border-slate-800 flex items-center px-5 justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-sm font-bold text-white truncate">
              {currentMeeting.roomName}
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:block">
              · Live
            </span>
          </div>
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Leave
          </button>
        </div>

        {/* Jitsi iframe — full meeting experience */}
        <div className="flex-1 relative">
          <iframe
            src={jitsiUrl}
            className="w-full h-full"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            title={`Meeting: ${currentMeeting.roomName}`}
            style={{ border: "none" }}
          />
        </div>
      </div>
    );
  }

  // ── Lobby: list active rooms or create one ─────────────────────────────────
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-5 justify-between bg-white dark:bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Video className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Live Meetings
          </h2>
          {voiceRooms.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
              {voiceRooms.length} live
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Start Meeting
        </button>
      </div>

      {/* Room grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {voiceRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-800/40">
              <Video className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
              No Active Meetings
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              Start a meeting to connect with your team in real time.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              Start a Meeting
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {voiceRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                role={role}
                onJoin={() => handleJoinRoom(room)}
                onRefresh={fetchRooms}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Room modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Start New Meeting
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                  Meeting Name
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Daily Standup, Project Review"
                  maxLength={100}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !creating && handleCreateAndJoin()
                  }
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAndJoin}
                  disabled={!newRoomName.trim() || creating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl text-sm font-bold transition-all"
                >
                  <Video className="w-4 h-4" />
                  {creating ? "Starting…" : "Start Meeting"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Room Card ─────────────────────────────────────────────────────────────────

interface RoomCardProps {
  room: VoiceRoom;
  role?: string;
  onJoin: () => void;
  onRefresh: () => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, role, onJoin, onRefresh }) => {
  const handleEnd = async () => {
    if (!confirm(`End meeting "${room.name}"?`)) return;
    await apiFetch(`/api/voice-rooms/${room.id}`, { method: "DELETE" }).catch(
      () => {},
    );
    onRefresh();
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center border border-green-200 dark:border-green-800/50 flex-shrink-0">
          <Video className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          LIVE
        </span>
      </div>

      <div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
          {room.name}
        </h3>
        {room.participants.length > 0 ? (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex -space-x-1.5">
              {room.participants.slice(0, 4).map((p, i) => (
                <div
                  key={p.user_id}
                  className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 border border-white dark:border-slate-800 flex items-center justify-center text-[9px] font-bold text-blue-700 dark:text-blue-300"
                  style={{ zIndex: 4 - i }}
                  title={p.display_name}
                >
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
              ))}
              {room.participants.length > 4 && (
                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 border border-white dark:border-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500">
                  +{room.participants.length - 4}
                </div>
              )}
            </div>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {room.participants.length} / {room.max_participants}
            </span>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-1">No participants yet</p>
        )}
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={onJoin}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors"
        >
          <Video className="w-3.5 h-3.5" />
          Join
        </button>
        {role === "director" && (
          <button
            onClick={handleEnd}
            className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-xs font-bold transition-colors"
            title="End meeting"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
