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
  unread: number;
}

export default function ChatInbox() {
  const { activeFamilyId, families } = useFamilyStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [groupUnread, setGroupUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  const load = useCallback(async () => {
    if (!activeFamilyId) { setLoading(false); return; }
    try {
      const [membersData, convsData, unreadData] = await Promise.all([
        api.get<FamilyMember[]>(`/api/families/${activeFamilyId}/members`),
        api.get<DMConversation[]>("/api/dm"),
        api.get<{ dms: number; group: number; total: number }>("/api/chat/unread"),
      ]);
      setMembers(membersData);
      setConversations(convsData);
      setGroupUnread(unreadData.group);
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
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 bg-accent-muted border border-accent/30 rounded-full flex items-center justify-center">
                      <Users size={20} className="text-accent" />
                    </div>
                    {groupUnread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                        {groupUnread > 99 ? "99+" : groupUnread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm truncate ${groupUnread > 0 ? "font-bold text-text" : "font-semibold text-text"}`}>
                      {activeFamily?.name ?? "Family Chat"}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{members.length} members</p>
                  </div>
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
                const hasUnread = (conv?.unread ?? 0) > 0;
                const lastSeen = (member.profile as { last_seen?: string | null } | undefined)?.last_seen;
                const online = lastSeen ? Date.now() - new Date(lastSeen).getTime() < 3 * 60 * 1000 : false;
                return (
                  <button
                    key={member.id}
                    onClick={() => router.push(`/chat?dm=${member.user_id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-2 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <Avatar src={member.profile?.avatar} name={member.profile?.name} size={48} />
                      {online && !hasUnread && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-bg-1" />
                      )}
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                          {conv!.unread > 99 ? "99+" : conv!.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-sm truncate ${hasUnread ? "font-bold text-text" : "font-semibold text-text"}`}>
                          {member.profile?.name ?? "Unknown"}
                        </p>
                        {conv && (
                          <span className={`text-[10px] shrink-0 ${hasUnread ? "text-accent font-semibold" : "text-text-faint"}`}>
                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 truncate ${hasUnread ? "text-text font-medium" : online ? "text-green-500 font-medium" : "text-text-muted"}`}>
                        {conv
                          ? `${conv.isMe ? "You: " : ""}${conv.lastMessage}`
                          : online
                          ? "Online"
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
