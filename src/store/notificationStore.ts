import { create } from "zustand";
import { api } from "@/lib/api";
import { FCMTransport } from "@/lib/notificationTransport";

export type NotificationType =
  | "new_post"
  | "post_like"
  | "post_comment"
  | "new_member"
  | "new_dm"
  | "new_group_message"
  | "new_assignment"
  | "assignment_update";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor_id: string;
  actor?: { name: string; avatar?: string } | null;
  entity_id?: string;
  family_id?: string;
  meta?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

interface MarkReadFilter {
  actor_id?: string;
  family_id?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unread: number;
  fetch: () => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Mark read for specific types, optionally scoped to actor or family */
  markReadWhere: (types: NotificationType[], filter?: MarkReadFilter) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

const transport = new FCMTransport();

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unread: 0,

  fetch: async () => {
    try {
      const data = await api.get<AppNotification[]>("/api/notifications");
      set({ notifications: data, unread: data.filter((n) => !n.read).length });
    } catch { /* silent */ }
  },

  markAllRead: async () => {
    try {
      await api.patch("/api/notifications/read", {});
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unread: 0,
      }));
    } catch { /* silent */ }
  },

  markReadWhere: async (types, filter) => {
    try {
      const params = new URLSearchParams();
      types.forEach((t) => params.append("types", t));
      if (filter?.actor_id)  params.set("actor_id",  filter.actor_id);
      if (filter?.family_id) params.set("family_id", filter.family_id);
      await api.patch(`/api/notifications/read?${params.toString()}`, {});
      set((s) => {
        const updated = s.notifications.map((n) => {
          if (!types.includes(n.type)) return n;
          if (filter?.actor_id  && n.actor_id  !== filter.actor_id)  return n;
          if (filter?.family_id && n.family_id !== filter.family_id) return n;
          return { ...n, read: true };
        });
        return { notifications: updated, unread: updated.filter((n) => !n.read).length };
      });
    } catch { /* silent */ }
  },

  startPolling: () => {
    transport.start(() => get().fetch());
  },

  stopPolling: () => {
    transport.stop();
  },
}));
