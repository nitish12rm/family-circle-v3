"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Send, ArrowLeft, Users } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useFamilyStore } from "@/store/familyStore";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { formatDistanceToNow } from "date-fns";
import type { Message } from "@/types";

export default function GroupChatView({ familyId }: { familyId: string }) {
  const { user } = useAuthStore();
  const { families } = useFamilyStore();
  const router = useRouter();
  const family = families.find((f) => f.id === familyId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);

  const markRead = useCallback(() => {
    api.post(`/api/families/${familyId}/messages/read`, {}).catch(() => {});
  }, [familyId]);

  const loadMessages = useCallback(async (initial = false) => {
    try {
      const url = initial
        ? `/api/families/${familyId}/messages?limit=50`
        : `/api/families/${familyId}/messages?limit=50${lastTimestampRef.current ? `&after=${encodeURIComponent(lastTimestampRef.current)}` : ""}`;
      const data = await api.get<Message[]>(url);
      if (data.length > 0) {
        lastTimestampRef.current = data[data.length - 1].created_at;
        if (initial) {
          setMessages(data);
        } else {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const fresh = data.filter((m) => !seen.has(m.id));
            // Update read_by on existing messages from polling data
            const updatedById = Object.fromEntries(data.map((m) => [m.id, m]));
            const merged = prev.map((m) => updatedById[m.id] ? { ...m, read_by: updatedById[m.id].read_by } : m);
            return fresh.length ? [...merged, ...fresh] : merged;
          });
        }
        markRead();
      }
    } catch { /* silent */ }
    finally { if (initial) setLoading(false); }
  }, [familyId, markRead]);

  useEffect(() => { setLoading(true); lastTimestampRef.current = null; loadMessages(true); }, [loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { const t = setInterval(() => loadMessages(false), 3000); return () => clearInterval(t); }, [loadMessages]);

  const handleSend = async () => {
    if (!content.trim()) return;
    const text = content.trim();
    setContent("");
    setSending(true);
    try {
      const msg = await api.post<Message>(`/api/families/${familyId}/messages`, { content: text });
      setMessages((prev) => [...prev, { ...msg, read_by: [] }]);
      lastTimestampRef.current = msg.created_at;
    } catch { setContent(text); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col max-w-xl mx-auto" style={{ height: "var(--content-h)" }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button onClick={() => router.push("/chat")} className="p-1.5 rounded-lg hover:bg-bg-2 text-text-muted hover:text-text transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="w-8 h-8 bg-accent-muted border border-accent/30 rounded-full flex items-center justify-center shrink-0">
          <Users size={14} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">{family?.name ?? "Family Chat"}</p>
          <p className="text-xs text-text-faint">Group</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {loading ? <div className="flex justify-center py-10"><Spinner /></div>
          : messages.length === 0 ? <div className="text-center py-20"><p className="text-text-muted text-sm">No messages yet. Say hello!</p></div>
          : messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            // Readers: exclude the sender themselves
            const readers = (msg.read_by ?? []).filter((r) => r.id !== msg.sender_id);
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} mb-1`}>
                <div className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  {!isMe && (
                    <button onClick={() => router.push(`/profile/${msg.sender_id}`)} className="mt-1 shrink-0">
                      <Avatar src={msg.sender?.avatar} name={msg.sender?.name} size={28} />
                    </button>
                  )}
                  <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                      <button
                        onClick={() => router.push(`/profile/${msg.sender_id}`)}
                        className="text-xs text-text-muted mb-1 ml-1 hover:text-accent transition-colors"
                      >
                        {msg.sender?.name}
                      </button>
                    )}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isMe ? "bg-accent text-white rounded-br-sm" : "bg-bg-3 text-text rounded-bl-sm"}`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-text-faint mt-1 mx-1">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                {/* Read receipts — avatar stack of who read this message */}
                {readers.length > 0 && (
                  <div className={`flex items-center gap-0.5 mt-0.5 ${isMe ? "mr-1" : "ml-9"}`}>
                    <div className="flex -space-x-1">
                      {readers.slice(0, 5).map((r) => (
                        <Avatar key={r.id} src={r.avatar} name={r.name} size={14} className="ring-1 ring-bg-1" />
                      ))}
                    </div>
                    {readers.length > 5 && (
                      <span className="text-[9px] text-text-faint ml-1">+{readers.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Message..." rows={1} className="flex-1 bg-bg-2 border border-border rounded-2xl px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent resize-none max-h-24" />
          <button onClick={handleSend} disabled={!content.trim() || sending} className="w-10 h-10 bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-full flex items-center justify-center transition-colors shrink-0">
            {sending ? <Spinner size={16} /> : <Send size={16} className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
