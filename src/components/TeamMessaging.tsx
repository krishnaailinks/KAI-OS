"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Paperclip,
  Hash,
  Megaphone,
  Volume2,
  Plus,
  Trash2,
  Users,
  PhoneOff,
  X,
  ChevronDown,
  ChevronRight,
  User,
  MicOff,
} from "lucide-react";
import { SystemPermissions } from "../types/dashboard";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Channel {
  id: string;
  name: string;
  slug: string;
  type: "text" | "announcement";
  description: string | null;
  created_by: string | null;
}

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

interface TeamMessage {
  id: string;
  channel_id: string;
  user_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

interface TeamMessagingProps {
  permissions: SystemPermissions;
  role: "director" | "employee" | "client";
  onJoinMeeting?: (roomCode: string, roomName: string, roomId: string) => void;
  currentUserId?: string;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export const TeamMessaging: React.FC<TeamMessagingProps> = ({
  permissions,
  role,
  onJoinMeeting,
  currentUserId,
}) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [voiceRooms, setVoiceRooms] = useState<VoiceRoom[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Record<string, TeamMessage[]>>({});
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Add Channel modal
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: "",
    type: "text" as "text" | "announcement",
    description: "",
  });
  const [addingChannel, setAddingChannel] = useState(false);
  const [addChannelError, setAddChannelError] = useState("");

  // Create Voice Room modal
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomMax, setNewRoomMax] = useState(20);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Collapsible sections
  const [textCollapsed, setTextCollapsed] = useState(false);
  const [announcementsCollapsed, setAnnouncementsCollapsed] = useState(false);
  const [voiceCollapsed, setVoiceCollapsed] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () =>
    endRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChannel?.slug]);

  // ── Fetch channels ──────────────────────────────────────────────────────────
  const fetchChannels = useCallback(async () => {
    const res = await apiFetch("/api/channels").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    const chs: Channel[] = data.channels || [];
    setChannels(chs);
    setActiveChannel((prev) => {
      if (prev && chs.some((c) => c.id === prev.id)) return prev;
      return chs.find((c) => c.slug === "general") ?? chs[0] ?? null;
    });
  }, []);

  useEffect(() => {
    fetchChannels();
    const rtCh = supabase
      .channel('channels_list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channels' }, () => fetchChannels())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'channels' }, () => fetchChannels())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'channels' }, () => fetchChannels())
      .subscribe();
    return () => { supabase.removeChannel(rtCh); };
  }, [fetchChannels]);

  // ── Fetch voice rooms (poll every 10 s for presence) ───────────────────────
  const fetchVoiceRooms = useCallback(async () => {
    const res = await apiFetch("/api/voice-rooms").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setVoiceRooms(data.rooms || []);
  }, []);

  useEffect(() => {
    fetchVoiceRooms();
    const id = setInterval(fetchVoiceRooms, 10_000);
    return () => clearInterval(id);
  }, [fetchVoiceRooms]);

  // ── Fetch messages when active channel changes ─────────────────────────────
  useEffect(() => {
    if (!activeChannel) return;
    const slug = activeChannel.slug;
    let cancelled = false;

    const fetchMsgs = async () => {
      setLoadingMessages(true);
      const res = await apiFetch(`/api/messages?channel=${slug}`).catch(() => null);
      if (res?.ok && !cancelled) {
        const data = await res.json();
        setMessages((prev) => ({ ...prev, [slug]: data.messages || [] }));
      }
      if (!cancelled) setLoadingMessages(false);
    };
    fetchMsgs();

    const rtChannel = supabase
      .channel(`team_messages:${slug}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `channel_id=eq.${slug}`,
        },
        (payload) => {
          const msg = payload.new as TeamMessage;
          setMessages((prev) => {
            const existing = prev[slug] || [];
            if (existing.some((m) => m.id === msg.id)) return prev;
            return { ...prev, [slug]: [...existing, msg] };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(rtChannel);
    };
  }, [activeChannel]);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !activeChannel) return;
    const body = input.trim();
    setInput("");
    const res = await apiFetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: activeChannel.slug, body }),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      const msg = data.message as TeamMessage;
      setMessages((prev) => {
        const existing = prev[activeChannel.slug] || [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [activeChannel.slug]: [...existing, msg] };
      });
    } else {
      setInput(body); // restore on failure
    }
  };

  // ── Channel management (director) ──────────────────────────────────────────
  const handleAddChannel = async () => {
    if (!newChannel.name.trim()) return;
    setAddingChannel(true);
    setAddChannelError("");
    const res = await apiFetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newChannel),
    }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}));
      setAddChannelError(data?.error || "Failed to create channel");
      setAddingChannel(false);
      return;
    }
    await fetchChannels();
    setShowAddChannel(false);
    setNewChannel({ name: "", type: "text", description: "" });
    setAddChannelError("");
    setAddingChannel(false);
  };

  const handleDeleteChannel = async (ch: Channel) => {
    if (!confirm(`Archive channel #${ch.slug}? Messages are preserved.`)) return;
    const res = await apiFetch(`/api/channels/${ch.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      if (activeChannel?.id === ch.id) {
        const remaining = channels.filter((c) => c.id !== ch.id);
        setActiveChannel(remaining.find((c) => c.slug === "general") ?? remaining[0] ?? null);
      }
      fetchChannels();
    }
  };

  // ── Voice room management ──────────────────────────────────────────────────
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setCreatingRoom(true);
    const res = await apiFetch("/api/voice-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoomName, max_participants: newRoomMax }),
    }).catch(() => null);
    setCreatingRoom(false);
    if (res?.ok) {
      await fetchVoiceRooms();
      setShowCreateRoom(false);
      setNewRoomName("");
      setNewRoomMax(20);
    }
  };

  const handleJoinRoom = async (room: VoiceRoom) => {
    const res = await apiFetch(`/api/voice-rooms/${room.id}/join`, {
      method: "POST",
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      fetchVoiceRooms();
      onJoinMeeting?.(data.room_code, data.room_name, data.room_id);
    }
  };

  const handleEndRoom = async (room: VoiceRoom) => {
    if (!confirm(`End meeting "${room.name}"?`)) return;
    const res = await apiFetch(`/api/voice-rooms/${room.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) fetchVoiceRooms();
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const textChannels = channels.filter((c) => c.type === "text");
  const announcementChannels = channels.filter((c) => c.type === "announcement");
  const currentMessages = activeChannel ? (messages[activeChannel.slug] || []) : [];
  const canPost =
    activeChannel?.type === "announcement" ? role === "director" : true;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-140px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="w-60 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hidden md:flex flex-col flex-shrink-0 overflow-y-auto">
        {/* Server header */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            KAI-OS Team Hub
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </div>

        <nav className="flex-1 px-2 py-3 space-y-4">
          {/* Text Channels */}
          <SidebarSection
            label="Text Channels"
            collapsed={textCollapsed}
            onToggle={() => setTextCollapsed((v) => !v)}
            onAdd={role === "director" ? () => setShowAddChannel(true) : undefined}
            addTestId="add-channel-btn"
          >
            {textChannels.map((ch) => (
              <ChannelRow
                key={ch.id}
                channel={ch}
                isActive={activeChannel?.id === ch.id}
                role={role}
                onClick={() => setActiveChannel(ch)}
                onDelete={() => handleDeleteChannel(ch)}
              />
            ))}
            {textChannels.length === 0 && (
              <p className="text-xs text-slate-400 px-2.5 py-1">No text channels</p>
            )}
          </SidebarSection>

          {/* Announcement Channels */}
          {announcementChannels.length > 0 && (
            <SidebarSection
              label="Announcements"
              collapsed={announcementsCollapsed}
              onToggle={() => setAnnouncementsCollapsed((v) => !v)}
            >
              {announcementChannels.map((ch) => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  isActive={activeChannel?.id === ch.id}
                  role={role}
                  onClick={() => setActiveChannel(ch)}
                  onDelete={() => handleDeleteChannel(ch)}
                />
              ))}
            </SidebarSection>
          )}

          {/* Voice Rooms */}
          <SidebarSection
            label="Voice Rooms"
            collapsed={voiceCollapsed}
            onToggle={() => setVoiceCollapsed((v) => !v)}
            onAdd={permissions.allowVideo ? () => setShowCreateRoom(true) : undefined}
            addTestId="add-voice-room-btn"
          >
            {voiceRooms.length === 0 && (
              <p className="text-xs text-slate-400 px-2.5 py-1">
                {permissions.allowVideo ? "No active rooms" : "Video not enabled"}
              </p>
            )}
            {voiceRooms.map((room) => (
              <VoiceRoomRow
                key={room.id}
                room={room}
                role={role}
                canJoin={permissions.allowVideo}
                currentUserId={currentUserId}
                onJoin={() => handleJoinRoom(room)}
                onEnd={() => handleEndRoom(room)}
              />
            ))}
          </SidebarSection>
        </nav>

        {/* User status strip */}
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate capitalize">{role}</p>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Online
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="h-13 border-b border-slate-200 dark:border-slate-800 flex items-center px-5 justify-between bg-white dark:bg-slate-900 flex-shrink-0 min-h-[52px]">
          {activeChannel ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                {activeChannel.type === "announcement" ? (
                  <Megaphone className="w-4 h-4 text-amber-500 flex-shrink-0" />
                ) : (
                  <Hash className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                )}
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {activeChannel.name}
                </h2>
                {activeChannel.description && (
                  <>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block flex-shrink-0" />
                    <p className="text-xs text-slate-500 truncate hidden sm:block">
                      {activeChannel.description}
                    </p>
                  </>
                )}
                {activeChannel.type === "announcement" && role !== "director" && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded ml-1 flex-shrink-0">
                    READ ONLY
                  </span>
                )}
              </div>
              <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </>
          ) : (
            <p className="text-sm text-slate-400">Select a channel</p>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col bg-slate-50/30 dark:bg-slate-950/10">
          {permissions.systemLockout ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center bg-white dark:bg-slate-900 p-8 rounded-2xl border border-red-200 dark:border-red-900/40 shadow-sm max-w-sm">
                <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MicOff className="w-7 h-7 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="font-bold text-red-600 dark:text-red-400 mb-1">
                  Communication Locked
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Director policy has restricted all messaging for your account.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-end min-h-full space-y-5">
              {loadingMessages && currentMessages.length === 0 && (
                <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Loading…
                </p>
              )}
              {!loadingMessages && currentMessages.length === 0 && activeChannel && (
                <div className="text-center py-10 text-slate-400 dark:text-slate-600">
                  <Hash className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">
                    No messages yet — be the first to post!
                  </p>
                </div>
              )}
              {currentMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          {activeChannel && (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <button
                className="p-1.5 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors rounded-lg"
                disabled
                title="Attachments coming soon"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                data-testid="msg-input"
                type="text"
                placeholder={
                  permissions.systemLockout
                    ? "Chat disabled…"
                    : !canPost
                    ? "Only directors can post here"
                    : `Message ${activeChannel.type === "text" ? "#" : "📢 "}${activeChannel.name}…`
                }
                className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-50 px-2"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend()
                }
                disabled={permissions.systemLockout || !canPost}
              />
              <button
                onClick={handleSend}
                disabled={
                  permissions.systemLockout || !input.trim() || !canPost
                }
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Channel Modal ───────────────────────────────────────────────── */}
      {showAddChannel && (
        <Modal
          title="Create Channel"
          onClose={() => {
            setShowAddChannel(false);
            setAddChannelError("");
          }}
        >
          <div className="space-y-4">
            <Field label="Channel Name">
              <input
                autoFocus
                type="text"
                placeholder="e.g. design, marketing"
                maxLength={50}
                className={inputCls}
                value={newChannel.name}
                onChange={(e) =>
                  setNewChannel((p) => ({ ...p, name: e.target.value }))
                }
              />
            </Field>

            <Field label="Type">
              <div className="flex gap-2">
                {(["text", "announcement"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewChannel((p) => ({ ...p, type: t }))}
                    className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      newChannel.type === t
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {t === "text" ? (
                      <Hash className="w-4 h-4" />
                    ) : (
                      <Megaphone className="w-4 h-4" />
                    )}
                    {t === "text" ? "Text" : "Announcement"}
                  </button>
                ))}
              </div>
              {newChannel.type === "announcement" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                  Only directors can post in announcement channels.
                </p>
              )}
            </Field>

            <Field label="Description (optional)">
              <input
                type="text"
                placeholder="What is this channel about?"
                maxLength={500}
                className={inputCls}
                value={newChannel.description}
                onChange={(e) =>
                  setNewChannel((p) => ({ ...p, description: e.target.value }))
                }
              />
            </Field>

            {addChannelError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {addChannelError}
              </p>
            )}

            <ModalActions
              onCancel={() => {
                setShowAddChannel(false);
                setAddChannelError("");
              }}
              onConfirm={handleAddChannel}
              confirmLabel="Create Channel"
              confirmingLabel="Creating…"
              loading={addingChannel}
              disabled={!newChannel.name.trim()}
            />
          </div>
        </Modal>
      )}

      {/* ── Create Voice Room Modal ─────────────────────────────────────────── */}
      {showCreateRoom && (
        <Modal title="Create Meeting Room" onClose={() => setShowCreateRoom(false)}>
          <div className="space-y-4">
            <Field label="Room Name">
              <input
                autoFocus
                type="text"
                placeholder="e.g. Daily Standup, Sprint Review"
                maxLength={100}
                className={inputCls}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
              />
            </Field>
            <Field label="Max Participants">
              <select
                className={inputCls}
                value={newRoomMax}
                onChange={(e) => setNewRoomMax(Number(e.target.value))}
              >
                {[5, 10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} people
                  </option>
                ))}
              </select>
            </Field>
            <ModalActions
              onCancel={() => setShowCreateRoom(false)}
              onConfirm={handleCreateRoom}
              confirmLabel="Create Room"
              confirmingLabel="Creating…"
              loading={creatingRoom}
              disabled={!newRoomName.trim()}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all";

interface SidebarSectionProps {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addTestId?: string;
  children: React.ReactNode;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
  label,
  collapsed,
  onToggle,
  onAdd,
  addTestId,
  children,
}) => (
  <div>
    <div className="flex items-center group mb-0.5">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 flex-1 min-w-0 py-1"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
        )}
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 dark:group-hover:text-slate-300 truncate">
          {label}
        </span>
      </button>
      {onAdd && (
        <button
          data-testid={addTestId}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="p-1 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          title={`Add ${label.toLowerCase()}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
    {!collapsed && <div className="space-y-0.5">{children}</div>}
  </div>
);

interface ChannelRowProps {
  channel: Channel;
  isActive: boolean;
  role: string;
  onClick: () => void;
  onDelete: () => void;
}

const ChannelRow: React.FC<ChannelRowProps> = ({
  channel,
  isActive,
  role,
  onClick,
  onDelete,
}) => (
  <div className="group relative">
    <button
      data-testid={`channel-btn-${channel.slug}`}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
        isActive
          ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-semibold"
      }`}
    >
      {channel.type === "announcement" ? (
        <Megaphone className="w-4 h-4 flex-shrink-0 opacity-70" />
      ) : (
        <Hash className="w-4 h-4 flex-shrink-0 opacity-70" />
      )}
      <span className="truncate">{channel.name}</span>
    </button>
    {role === "director" && channel.slug !== "general" && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
        title="Archive channel"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    )}
  </div>
);

interface VoiceRoomRowProps {
  room: VoiceRoom;
  role: string;
  canJoin: boolean;
  currentUserId?: string;
  onJoin: () => void;
  onEnd: () => void;
}

const VoiceRoomRow: React.FC<VoiceRoomRowProps> = ({
  room,
  role,
  canJoin,
  currentUserId,
  onJoin,
  onEnd,
}) => {
  // Only the room creator or a director may end the meeting.
  // Previously the condition was `room.created_by` (always truthy for a UUID
  // string), so every user saw the End button regardless of ownership.
  const canEnd = role === "director" || (!!currentUserId && room.created_by === currentUserId);

  return (
  <div
    data-testid={`voice-room-row-${room.id}`}
    className="group px-2.5 py-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all"
  >
    <div className="flex items-center gap-2">
      <Volume2 className="w-4 h-4 text-green-500 flex-shrink-0" />
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate flex-1">
        {room.name}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {canJoin && (
          <button
            data-testid={`voice-room-join-${room.id}`}
            onClick={onJoin}
            className="text-[11px] font-bold px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
          >
            Join
          </button>
        )}
        {canEnd && (
          <button
            onClick={onEnd}
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
            title="End meeting"
          >
            <PhoneOff className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
    {room.participants.length > 0 && (
      <div className="flex items-center gap-1.5 mt-1.5 pl-6">
        <div className="flex -space-x-1.5">
          {room.participants.slice(0, 5).map((p, i) => (
            <div
              key={p.user_id}
              className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 border border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-blue-700 dark:text-blue-300"
              style={{ zIndex: 5 - i }}
              title={p.display_name}
            >
              {p.display_name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
        <span className="text-[10px] text-slate-500">
          {room.participants.length} in call
        </span>
      </div>
    )}
  </div>
  );
};

interface MessageBubbleProps {
  message: TeamMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => (
  <div className="flex gap-3 group">
    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300">
      {message.author_name.charAt(0).toUpperCase()}
    </div>
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {message.author_name}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words max-w-2xl">
        {message.body}
      </p>
    </div>
  </div>
);

// ─── Shared modal primitives ───────────────────────────────────────────────────

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
    <div
      className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

interface ModalActionsProps {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmingLabel: string;
  loading: boolean;
  disabled?: boolean;
}

const ModalActions: React.FC<ModalActionsProps> = ({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmingLabel,
  loading,
  disabled,
}) => (
  <div className="flex gap-3 pt-1">
    <button
      onClick={onCancel}
      className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
    >
      Cancel
    </button>
    <button
      onClick={onConfirm}
      disabled={disabled || loading}
      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl text-sm font-bold transition-all"
    >
      {loading ? confirmingLabel : confirmLabel}
    </button>
  </div>
);
