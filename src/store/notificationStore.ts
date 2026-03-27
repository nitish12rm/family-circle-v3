import { create } from "zustand";
import { api } from "@/lib/api";
import { PollingTransport } from "@/lib/notificationTransport";

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

interface NotificationState {
  notifications: AppNotification[];
  unread: number;
  fetch: () => Promise<void>;
  markAllRead: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

const transport = new PollingTransport(15_000);

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

  startPolling: () => {
    transport.start(() => get().fetch());
  },

  stopPolling: () => {
    transport.stop();
  },
}));
