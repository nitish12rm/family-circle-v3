"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { formatDistanceToNow } from "date-fns";
import type { Message } from "@/types";

export default function ChatView() {
  const { activeFamilyId } = useFamilyStore();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);

  const loadMessages = useCallback(async (initial = false) => {
    if (!activeFamilyId) return;
    try {
      const url = initial
        ? `/api/families/${activeFamilyId}/messages?limit=50`
        : `/api/families/${activeFamilyId}/messages?limit=50${
            lastTimestampRef.current
              ? `&after=${encodeURIComponent(lastTimestampRef.current)}`
              : ""
          }`;

      const data = await api.get<Message[]>(url);
      if (data.length > 0) {
        lastTimestampRef.current = data[data.length - 1].created_at;
        if (initial) {
          setMessages(data);
        } else {
          setMessages((prev) => [...prev, ...data]);
        }
      }
    } catch {
      // silent
    } finally {
      if (initial) setLoading(false);
    }
  }, [activeFamilyId]);

  useEffect(() => {
    setLoading(true);
    lastTimestampRef.current = null;
    loadMessages(true);
  }, [loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll every 3s for new messages
  useEffect(() => {
    const interval = setInterval(() => loadMessages(false), 3000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleSend = async () => {
    if (!content.trim() || !activeFamilyId) return;
    const text = content.trim();
    setContent("");
    setSending(true);
    try {
      const msg = await api.post<Message>(
        `/api/families/${activeFamilyId}/messages`,
        { content: text }
      );
      setMessages((prev) => [...prev, msg]);
      lastTimestampRef.current = msg.created_at;
    } catch {
      setContent(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeFamilyId) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-text-muted text-sm">No family selected.</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col max-w-xl mx-auto overflow-hidden"
      style={{ height: "var(--content-h)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-text">Family Chat</h1>
      </div>

      {/* Messages — only this section scrolls */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-muted text-sm">No messages yet.</p>
            <p className="text-text-faint text-xs mt-1">Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
              >
                {!isMe && (
                  <Avatar
                    src={msg.sender?.avatar}
                    name={msg.sender?.name}
                    size={30}
                    className="mt-1"
                  />
                )}
                <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                  {!isMe && (
                    <span className="text-xs text-text-muted mb-1 ml-1">
                      {msg.sender?.name}
                    </span>
                  )}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                      isMe
                        ? "bg-accent text-white rounded-br-sm"
                        : "bg-bg-3 text-text rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-text-faint mt-1 mx-1">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — always pinned to bottom */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-bg-2 border border-border rounded-2xl px-4 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent resize-none max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="w-10 h-10 bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-full flex items-center justify-center transition-colors shrink-0"
          >
            {sending ? <Spinner size={16} /> : <Send size={16} className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
