"use client";
import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X, Bell, MessageCircle, ClipboardList, Rss,
  Heart, MessageSquare, UserPlus, Mail, Users,
  RotateCcw, CheckCheck,
} from "lucide-react";
import { useNotificationStore, type AppNotification, type NotificationType } from "@/store/notificationStore";
import Avatar from "@/components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "feed" | "chat" | "tasks";

const TABS: { id: TabId; label: string; Icon: React.ElementType; types: NotificationType[] }[] = [
  { id: "feed",  label: "Feed",  Icon: Rss,           types: ["new_post", "post_like", "post_comment", "new_member"] },
  { id: "chat",  label: "Chat",  Icon: MessageCircle, types: ["new_dm", "new_group_message"] },
  { id: "tasks", label: "Tasks", Icon: ClipboardList, types: ["new_assignment", "assignment_update"] },
];

// ─── Type badge config ────────────────────────────────────────────────────────

const TYPE_BADGE: Record<NotificationType, { Icon: React.ElementType; bg: string }> = {
  new_post:            { Icon: Rss,           bg: "bg-accent" },
  post_like:           { Icon: Heart,         bg: "bg-rose-500" },
  post_comment:        { Icon: MessageSquare, bg: "bg-blue-500" },
  new_member:          { Icon: UserPlus,      bg: "bg-emerald-500" },
  new_dm:              { Icon: Mail,          bg: "bg-violet-500" },
  new_group_message:   { Icon: Users,         bg: "bg-cyan-500" },
  new_assignment:      { Icon: ClipboardList, bg: "bg-orange-500" },
  assignment_update:   { Icon: RotateCcw,     bg: "bg-amber-500" },
};

// ─── Notification content ─────────────────────────────────────────────────────

function getContent(n: AppNotification): { action: string; subtitle?: string } {
  const meta = n.meta ?? {};

  switch (n.type) {
    case "new_post":
      return {
        action: "shared a new post",
        subtitle: meta.post_preview ? String(meta.post_preview) : undefined,
      };
    case "post_like":
      return { action: "liked your post" };
    case "post_comment":
      return {
        action: "commented on your post",
        subtitle: meta.comment_preview ? `"${String(meta.comment_preview)}"` : undefined,
      };
    case "new_member":
      return {
        action: "joined the family",
        subtitle: meta.family_name ? String(meta.family_name) : undefined,
      };
    case "new_dm":
      return {
        action: "sent you a message",
        subtitle: meta.preview ? String(meta.preview) : undefined,
      };
    case "new_group_message":
      return {
        action: "sent a group message",
        subtitle: meta.preview ? String(meta.preview) : undefined,
      };
    case "new_assignment":
      return {
        action: "assigned you a task",
        subtitle: meta.title ? `"${String(meta.title)}"` : undefined,
      };
    case "assignment_update":
      if (meta.status_change) {
        return {
          action: "changed task status",
          subtitle: meta.title
            ? `${String(meta.title)}: ${String(meta.status_change)}`
            : String(meta.status_change),
        };
      }
      return {
        action: "added a task note",
        subtitle: meta.title
          ? `"${String(meta.title)}"${meta.preview ? ` — ${String(meta.preview)}` : ""}`
          : meta.preview ? String(meta.preview) : undefined,
      };
    default:
      return { action: "sent a notification" };
  }
}

// ─── Navigation path ──────────────────────────────────────────────────────────

function getPath(n: AppNotification): string {
  switch (n.type) {
    case "new_post":
    case "post_like":
    case "post_comment":
      return n.entity_id ? `/post/${n.entity_id}` : "/feed";
    case "new_member":
      return "/family";
    case "new_dm":
      return `/chat?tab=dm&with=${n.actor_id}`;
    case "new_group_message":
      return "/chat";
    case "new_assignment":
    case "assignment_update":
      return n.entity_id ? `/assignments?open=${n.entity_id}` : "/assignments";
    default:
      return "/feed";
  }
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotificationRow({
  n,
  isLast,
  onClick,
}: {
  n: AppNotification;
  isLast: boolean;
  onClick: (n: AppNotification) => void;
}) {
  const { action, subtitle } = getContent(n);
  const badge = TYPE_BADGE[n.type];
  const BadgeIcon = badge.Icon;
  const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
  const actorName = n.actor?.name ?? "Someone";

  return (
    <button
      onClick={() => onClick(n)}
      className={`
        w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all duration-150
        ${!n.read ? "bg-accent/[0.06] hover:bg-accent/[0.09]" : "hover:bg-white/[0.03]"}
        ${!isLast ? "border-b border-white/[0.05]" : ""}
        active:scale-[0.99]
      `}
    >
      {/* Avatar + type badge */}
      <div className="relative shrink-0 mt-0.5">
        <Avatar src={n.actor?.avatar} name={actorName} size={38} />
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ring-[2.5px] ring-bg-1 ${badge.bg}`}
        >
          <BadgeIcon size={9} className="text-white" strokeWidth={2.5} />
        </div>
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm leading-snug">
          <span className={`font-semibold ${!n.read ? "text-text" : "text-text-muted"}`}>
            {actorName}
          </span>
          <span className={`${!n.read ? "text-text" : "text-text-muted"}`}> {action}</span>
        </p>
        {subtitle && (
          <p className="text-xs text-text-faint mt-0.5 line-clamp-1 leading-relaxed">
            {subtitle}
          </p>
        )}
        <p className="text-[11px] text-text-faint mt-1 font-medium">{timeAgo}</p>
      </div>

      {/* Unread indicator */}
      {!n.read && (
        <div className="w-2 h-2 rounded-full bg-accent shadow-glow-sm shrink-0 mt-2.5" />
      )}
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTab({ tab }: { tab: (typeof TABS)[number] }) {
  const Icon = tab.Icon;
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-bg-2 border border-border flex items-center justify-center">
        <Icon size={20} className="text-text-faint" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-muted">No {tab.label} notifications</p>
        <p className="text-xs text-text-faint mt-1">You're all caught up here.</p>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface NotificationPanelProps {
  open: boolean;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onClose: () => void;
}

export default function NotificationPanel({
  open,
  activeTab,
  onTabChange,
  onClose,
}: NotificationPanelProps) {
  const router = useRouter();
  const { notifications, markAllRead } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleClick = useCallback(
    async (n: AppNotification) => {
      if (!n.read) {
        api.patch(`/api/notifications/${n.id}`, {}).catch(() => {});
        useNotificationStore.setState((s) => ({
          notifications: s.notifications.map((x) =>
            x.id === n.id ? { ...x, read: true } : x
          ),
          unread: Math.max(0, s.unread - 1),
        }));
      }
      onClose();
      router.push(getPath(n));
    },
    [onClose, router]
  );

  const currentTab   = TABS.find((t) => t.id === activeTab)!;
  const tabNotifs    = notifications.filter((n) => currentTab.types.includes(n.type));
  const totalUnread  = notifications.filter((n) => !n.read).length;
  const tabUnread    = (id: TabId) =>
    notifications.filter((n) => TABS.find((t) => t.id === id)!.types.includes(n.type) && !n.read).length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed left-0 right-0 z-50 mx-auto max-w-lg animate-slide-up"
        style={{ top: "var(--topbar-h)" }}
      >
        <div
          className="bg-bg-1 border-x border-b border-white/[0.08] rounded-b-[28px] shadow-card flex flex-col overflow-hidden"
          style={{ maxHeight: "calc(100dvh - var(--topbar-h) - 1rem)" }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center">
                <Bell size={13} className="text-accent" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-semibold text-text tracking-tight">Notifications</span>
              {totalUnread > 0 && (
                <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-[3px] rounded-full leading-none">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>

            <div className="flex items-center gap-0.5">
              {totalUnread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent/70 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-accent/10"
                >
                  <CheckCheck size={12} strokeWidth={2.5} />
                  All read
                </button>
              )}
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-text-faint hover:text-text-muted hover:bg-bg-3 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── Tabs — matching app tab style ── */}
          <div className="px-4 pb-3">
            <div className="flex gap-1 bg-bg-2 border border-white/[0.06] rounded-2xl p-1">
              {TABS.map((tab) => {
                const count   = tabUnread(tab.id);
                const active  = activeTab === tab.id;
                const TabIcon = tab.Icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`
                      flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                      text-xs font-medium transition-all duration-150
                      ${active
                        ? "bg-bg-3 text-text shadow-sm"
                        : "text-text-muted hover:text-text"
                      }
                    `}
                  >
                    <TabIcon size={13} strokeWidth={2} />
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-[2px] rounded-full leading-none ${
                          active
                            ? "bg-accent/20 text-accent"
                            : "bg-bg-4 text-text-faint"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-white/[0.06] mx-0" />

          {/* ── Notification list ── */}
          <div className="overflow-y-auto flex-1">
            {tabNotifs.length === 0 ? (
              <EmptyTab tab={currentTab} />
            ) : (
              tabNotifs.map((n, i) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  isLast={i === tabNotifs.length - 1}
                  onClick={handleClick}
                />
              ))
            )}
          </div>

          {/* ── Bottom safe padding ── */}
          <div className="h-2 shrink-0" />
        </div>
      </div>
    </>
  );
}
