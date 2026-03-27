"use client";
import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Bell, MessageCircle, ClipboardList, Rss, CheckCheck } from "lucide-react";
import { useNotificationStore, type AppNotification, type NotificationType } from "@/store/notificationStore";
import Avatar from "@/components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";

// ─── Tab definitions ────────────────────────────────────────────────────────

type TabId = "feed" | "chat" | "tasks";

const TABS: { id: TabId; label: string; icon: React.ReactNode; types: NotificationType[] }[] = [
  {
    id: "feed",
    label: "Feed",
    icon: <Rss size={14} />,
    types: ["new_post", "post_like", "post_comment", "new_member"],
  },
  {
    id: "chat",
    label: "Chat",
    icon: <MessageCircle size={14} />,
    types: ["new_dm", "new_group_message"],
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: <ClipboardList size={14} />,
    types: ["new_assignment", "assignment_update"],
  },
];

// ─── Notification text ───────────────────────────────────────────────────────

function getNotificationText(n: AppNotification): { title: string; subtitle?: string } {
  const actor = n.actor?.name ?? "Someone";
  const meta = n.meta ?? {};

  switch (n.type) {
    case "new_post":
      return {
        title: `${actor} shared a new post`,
        subtitle: meta.post_preview ? String(meta.post_preview) : undefined,
      };
    case "post_like":
      return { title: `${actor} liked your post` };
    case "post_comment":
      return {
        title: `${actor} commented on your post`,
        subtitle: meta.comment_preview ? String(meta.comment_preview) : undefined,
      };
    case "new_member":
      return {
        title: `${actor} joined the family`,
        subtitle: meta.family_name ? `in ${String(meta.family_name)}` : undefined,
      };
    case "new_dm":
      return {
        title: `${actor} sent you a message`,
        subtitle: meta.preview ? String(meta.preview) : undefined,
      };
    case "new_group_message":
      return {
        title: `${actor} sent a group message`,
        subtitle: meta.preview ? String(meta.preview) : undefined,
      };
    case "new_assignment":
      return {
        title: `${actor} assigned you a task`,
        subtitle: meta.title ? String(meta.title) : undefined,
      };
    case "assignment_update":
      return {
        title: `${actor} updated an assignment`,
        subtitle: meta.status_change
          ? String(meta.status_change)
          : meta.title
          ? String(meta.title)
          : undefined,
      };
    default:
      return { title: "New notification" };
  }
}

// ─── Navigation path ─────────────────────────────────────────────────────────

function getNotificationPath(n: AppNotification): string {
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
      return "/assignments";
    default:
      return "/feed";
  }
}

// ─── Tab icon component ───────────────────────────────────────────────────────

function NotificationIcon({ type }: { type: NotificationType }) {
  const base = "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm";
  switch (type) {
    case "new_post":        return <div className={`${base} bg-accent/15 text-accent`}>📝</div>;
    case "post_like":       return <div className={`${base} bg-rose-500/15 text-rose-400`}>❤️</div>;
    case "post_comment":    return <div className={`${base} bg-blue-500/15 text-blue-400`}>💬</div>;
    case "new_member":      return <div className={`${base} bg-green-500/15 text-green-400`}>👋</div>;
    case "new_dm":          return <div className={`${base} bg-purple-500/15 text-purple-400`}>✉️</div>;
    case "new_group_message": return <div className={`${base} bg-cyan-500/15 text-cyan-400`}>💬</div>;
    case "new_assignment":  return <div className={`${base} bg-orange-500/15 text-orange-400`}>📋</div>;
    case "assignment_update": return <div className={`${base} bg-yellow-500/15 text-yellow-400`}>🔄</div>;
    default:                return <div className={`${base} bg-bg-3`}><Bell size={14} /></div>;
  }
}

// ─── Single notification row ─────────────────────────────────────────────────

function NotificationRow({
  notification,
  onClick,
}: {
  notification: AppNotification;
  onClick: (n: AppNotification) => void;
}) {
  const { title, subtitle } = getNotificationText(notification);
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  return (
    <button
      onClick={() => onClick(notification)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-2 active:bg-bg-3 ${
        !notification.read ? "bg-accent/5" : ""
      }`}
    >
      {/* Actor avatar with type icon overlay */}
      <div className="relative shrink-0 mt-0.5">
        <Avatar
          src={notification.actor?.avatar}
          name={notification.actor?.name ?? "?"}
          size={36}
        />
        <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">
          {notification.type === "new_post" && "📝"}
          {notification.type === "post_like" && "❤️"}
          {notification.type === "post_comment" && "💬"}
          {notification.type === "new_member" && "👋"}
          {notification.type === "new_dm" && "✉️"}
          {notification.type === "new_group_message" && "💬"}
          {notification.type === "new_assignment" && "📋"}
          {notification.type === "assignment_update" && "🔄"}
        </span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!notification.read ? "font-semibold text-text" : "font-normal text-text-muted"}`}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-text-faint mt-0.5 truncate">{subtitle}</p>
        )}
        <p className="text-[11px] text-text-faint mt-1">{timeAgo}</p>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />
      )}
    </button>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

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
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
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

  const handleNotificationClick = useCallback(
    async (n: AppNotification) => {
      // Mark single notification as read
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
      router.push(getNotificationPath(n));
    },
    [onClose, router]
  );

  const handleMarkAllRead = useCallback(() => {
    markAllRead();
  }, [markAllRead]);

  // Per-tab filtered notifications
  const currentTab = TABS.find((t) => t.id === activeTab)!;
  const tabNotifications = notifications.filter((n) =>
    currentTab.types.includes(n.type)
  );

  // Unread count per tab (for badges)
  const tabUnread = (tab: TabId) =>
    notifications.filter(
      (n) => TABS.find((t) => t.id === tab)!.types.includes(n.type) && !n.read
    ).length;

  const totalUnread = notifications.filter((n) => !n.read).length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 left-0 right-0 z-50 mx-auto max-w-lg bg-bg-1 border-b border-x border-border rounded-b-3xl shadow-2xl flex flex-col"
        style={{
          top: "var(--topbar-h)",
          maxHeight: "calc(100dvh - var(--topbar-h) - 16px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-accent" />
            <span className="text-sm font-semibold text-text">Notifications</span>
            {totalUnread > 0 && (
              <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {totalUnread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-bg-2 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-2 pt-2">
          {TABS.map((tab) => {
            const unread = tabUnread(tab.id);
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium transition-colors rounded-t-lg relative ${
                  isActive
                    ? "text-accent"
                    : "text-text-faint hover:text-text-muted"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {unread > 0 && (
                  <span
                    className={`text-[9px] font-bold px-1 py-0.5 rounded-full leading-none ${
                      isActive
                        ? "bg-accent text-white"
                        : "bg-text-faint/30 text-text-faint"
                    }`}
                  >
                    {unread}
                  </span>
                )}
                {/* Active underline */}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        <div className="overflow-y-auto flex-1">
          {tabNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-text-faint">
              <NotificationIcon type={currentTab.types[0]} />
              <p className="text-sm">No {currentTab.label.toLowerCase()} notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tabNotifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
