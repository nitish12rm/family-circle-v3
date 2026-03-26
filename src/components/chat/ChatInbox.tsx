"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, Users, MessageCircle } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { formatDistanceToNow } from "date-fns";
import type { FamilyMember } from "@/types";

interface DMConversation {
  userId: string;
  name: string;
  avatar?: string | null;
  lastMessage: string;
  lastMessageAt: string;
  isMe: boolean;
}

export default function ChatInbox() {
  const { activeFamilyId, families } = useFamilyStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  const load = useCallback(async () => {
    if (!activeFamilyId) { setLoading(false); return; }
    try {
      const [membersData, convsData] = await Promise.all([
        api.get<FamilyMember[]>(`/api/families/${activeFamilyId}/members`),
        api.get<DMConversation[]>("/api/dm"),
      ]);
      setMembers(membersData);
      setConversations(convsData);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [activeFamilyId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Merge members with conversation previews
  const otherMembers = members.filter((m) => m.user_id !== user?.id);
  const convMap = new Map(conversations.map((c) => [c.userId, c]));

  const filtered = otherMembers.filter((m) =>
    !search || (m.profile?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Sort: members with existing DMs first (by latest message time), rest alphabetically
  const sorted = [...filtered].sort((a, b) => {
    const ca = convMap.get(a.user_id);
    const cb = convMap.get(b.user_id);
    if (ca && cb) return new Date(cb.lastMessageAt).getTime() - new Date(ca.lastMessageAt).getTime();
    if (ca) return -1;
    if (cb) return 1;
    return (a.profile?.name ?? "").localeCompare(b.profile?.name ?? "");
  });

  if (!activeFamilyId) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-text-muted text-sm">No family selected.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-text mb-3">Messages</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            placeholder="Search members…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-2 border border-border rounded-xl pl-8 pr-4 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <>
            {/* Pinned family group chat */}
            {!search && (
              <>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-semibold text-text-faint uppercase tracking-wide">Group</p>
                </div>
                <button
                  onClick={() => router.push(`/chat?family=${activeFamilyId}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-2 transition-colors"
                >
                  <div className="w-12 h-12 bg-accent-muted border border-accent/30 rounded-full flex items-center justify-center shrink-0">
                    <Users size={20} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-text">{activeFamily?.name ?? "Family Chat"}</p>
                    <p className="text-xs text-text-muted mt-0.5">{members.length} members</p>
                  </div>
                  <div className="w-2 h-2 bg-accent rounded-full shrink-0" />
                </button>
                <div className="mx-4 border-b border-border" />
              </>
            )}

            {/* DM list */}
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-semibold text-text-faint uppercase tracking-wide">
                {search ? "Members" : "Direct Messages"}
              </p>
            </div>

            {sorted.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle size={32} className="mx-auto text-text-faint mb-2" />
                <p className="text-text-muted text-sm">No members found.</p>
              </div>
            ) : (
              sorted.map((member) => {
                const conv = convMap.get(member.user_id);
                return (
                  <button
                    key={member.id}
                    onClick={() => router.push(`/chat?dm=${member.user_id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-2 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <Avatar src={member.profile?.avatar} name={member.profile?.name} size={48} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-text truncate">{member.profile?.name ?? "Unknown"}</p>
                        {conv && (
                          <span className="text-[10px] text-text-faint shrink-0">
                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {conv
                          ? `${conv.isMe ? "You: " : ""}${conv.lastMessage}`
                          : <span className="text-text-faint italic">Tap to message</span>}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
