"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Send, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { formatDistanceToNow } from "date-fns";

interface DMMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  sender: { id: string; name: string; avatar?: string } | null;
  read_by: { id: string; name: string; avatar?: string }[];
}

interface OtherProfile {
  id: string;
  name: string;
  avatar?: string;
}

export default function DMChatView({ userId }: { userId: string }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    api.get<{ profile: OtherProfile }>(`/api/profiles/${userId}`)
      .then((d) => setOther(d.profile))
      .catch(() => {});
  }, [userId]);

  const markRead = useCallback(() => {
    api.post(`/api/dm/${userId}/read`, {}).catch(() => {});
  }, [userId]);

  const loadMessages = useCallback(async (initial = false) => {
    try {
      const url = `/api/dm/${userId}${lastTimestampRef.current && !initial ? `?after=${encodeURIComponent(lastTimestampRef.current)}` : ""}`;
      const data = await api.get<DMMessage[]>(url);
      if (data.length > 0) {
        lastTimestampRef.current = data[data.length - 1].created_at;
        if (initial) {
          setMessages(data);
        } else {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const fresh = data.filter((m) => !seen.has(m.id));
            // Also update read_by on existing messages
            const updatedById = Object.fromEntries(data.map((m) => [m.id, m]));
            const merged = prev.map((m) => updatedById[m.id] ? { ...m, read_by: updatedById[m.id].read_by } : m);
            return fresh.length ? [...merged, ...fresh] : merged;
          });
        }
        markRead();
      }
    } catch { /* silent */ }
    finally { if (initial) setLoading(false); }
  }, [userId, markRead]);

  useEffect(() => { setLoading(true); lastTimestampRef.current = null; loadMessages(true); }, [loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { const t = setInterval(() => loadMessages(false), 3000); return () => clearInterval(t); }, [loadMessages]);

  const handleSend = async () => {
    if (!content.trim()) return;
    const text = content.trim();
    setContent("");
    setSending(true);
    try {
      const msg = await api.post<DMMessage>(`/api/dm/${userId}`, { content: text });
      setMessages((prev) => [...prev, { ...msg, read_by: [] }]);
      lastTimestampRef.current = msg.created_at;
    } catch { setContent(text); }
    finally { setSending(false); }
  };

  // Find the last message I sent that has been read by the other user
  const lastReadByOtherIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender_id === user?.id && m.read_by.some((r) => r.id === userId)) return i;
    }
    return -1;
  })();

  return (
    <div className="flex flex-col max-w-xl mx-auto" style={{ height: "var(--content-h)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button onClick={() => router.push("/chat")} className="p-1.5 rounded-lg hover:bg-bg-2 text-text-muted hover:text-text transition-colors">
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => router.push(`/profile/${userId}`)} className="shrink-0">
          <Avatar src={other?.avatar} name={other?.name ?? ""} size={32} />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => router.push(`/profile/${userId}`)} className="text-sm font-semibold text-text truncate hover:text-accent transition-colors">
            {other?.name ?? "..."}
          </button>
          <p className="text-xs text-text-faint">Direct message</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {loading ? <div className="flex justify-center py-10"><Spinner /></div>
          : messages.length === 0 ? (
            <div className="text-center py-20">
              <button onClick={() => router.push(`/profile/${userId}`)} className="block mx-auto mb-3">
                <Avatar src={other?.avatar} name={other?.name ?? ""} size={56} />
              </button>
              <button onClick={() => router.push(`/profile/${userId}`)} className="text-sm font-medium text-text hover:text-accent transition-colors">
                {other?.name}
              </button>
              <p className="text-xs text-text-muted mt-1">Send a message to start the conversation.</p>
            </div>
          ) : messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            const showReceipt = isMe && idx === lastReadByOtherIdx;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} mb-1`}>
                <div className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  {!isMe && <Avatar src={msg.sender?.avatar} name={msg.sender?.name} size={28} className="mt-1 shrink-0" />}
                  <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isMe ? "bg-accent text-white rounded-br-sm" : "bg-bg-3 text-text rounded-bl-sm"}`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-text-faint mt-1 mx-1">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                {/* Seen receipt — shown under the last message the other person has read */}
                {showReceipt && (
                  <div className="flex items-center gap-1 mt-0.5 mr-1">
                    <Avatar src={other?.avatar} name={other?.name ?? ""} size={14} />
                    <span className="text-[10px] text-text-faint">Seen</span>
                  </div>
                )}
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={`Message ${other?.name ?? ""}...`} rows={1} className="flex-1 bg-bg-2 border border-border rounded-2xl px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent resize-none max-h-24" />
          <button onClick={handleSend} disabled={!content.trim() || sending} className="w-10 h-10 bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-full flex items-center justify-center transition-colors shrink-0">
            {sending ? <Spinner size={16} /> : <Send size={16} className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
