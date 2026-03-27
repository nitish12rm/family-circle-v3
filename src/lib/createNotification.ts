import { randomUUID } from "crypto";
import { Notification } from "@/models/Notification";
import { Profile } from "@/models/Profile";

export type NotificationType =
  | "new_post"
  | "post_like"
  | "post_comment"
  | "new_member"
  | "new_dm"
  | "new_group_message"
  | "new_assignment"
  | "assignment_update";

interface CreateNotificationParams {
  recipientIds: string[];
  actorId: string;
  type: NotificationType;
  entityId?: string;
  familyId?: string;
  meta?: Record<string, unknown>;
}

// ── Push text helpers ─────────────────────────────────────────────────────────

function getPushText(
  type: NotificationType,
  meta: Record<string, unknown>,
  actorName: string
): { title: string; body: string } {
  const m = meta;
  switch (type) {
    case "new_post":
      return { title: "Family Circle", body: `${actorName} shared a new post` };
    case "post_like":
      return { title: "Family Circle", body: `${actorName} liked your post` };
    case "post_comment":
      return { title: "Family Circle", body: `${actorName} commented on your post` };
    case "new_member":
      return { title: "Family Circle", body: `${actorName} joined the family` };
    case "new_dm":
      return {
        title: `Message from ${actorName}`,
        body: m.preview ? String(m.preview) : "Sent you a message",
      };
    case "new_group_message":
      return {
        title: "Family Circle",
        body: `${actorName}: ${m.preview ? String(m.preview) : "New group message"}`,
      };
    case "new_assignment":
      return {
        title: `Task assigned by ${actorName}`,
        body: m.title ? String(m.title) : "You have a new assignment",
      };
    case "assignment_update":
      return {
        title: "Assignment update",
        body: m.status_change
          ? `${actorName}: ${String(m.status_change)}`
          : `${actorName} added a note${m.title ? ` on "${String(m.title)}"` : ""}`,
      };
    default:
      return { title: "Family Circle", body: "You have a new notification" };
  }
}

function getDeepLinkUrl(type: NotificationType, entityId?: string): string {
  switch (type) {
    case "new_post":
    case "post_like":
    case "post_comment":
      return entityId ? `/post/${entityId}` : "/feed";
    case "new_member":
      return "/family";
    case "new_dm":
      return "/chat";
    case "new_group_message":
      return "/chat";
    case "new_assignment":
    case "assignment_update":
      return entityId ? `/assignments?open=${entityId}` : "/assignments";
    default:
      return "/";
  }
}

// ── FCM push (fire-and-forget) ────────────────────────────────────────────────

async function sendFcmPush(
  targets: string[],
  actorId: string,
  type: NotificationType,
  entityId: string | undefined,
  meta: Record<string, unknown>
) {
  const { getAdminMessaging } = await import("@/lib/firebaseAdmin");
  const adminMessaging = getAdminMessaging();
  if (!adminMessaging) return; // Firebase not configured — skip silently

  // Fetch actor name + all recipient FCM tokens in parallel
  const [actorProfile, recipientProfiles] = await Promise.all([
    Profile.findById(actorId).select("name").lean() as Promise<{ name: string } | null>,
    Profile.find({ _id: { $in: targets }, fcm_tokens: { $exists: true, $ne: [] } })
      .select("fcm_tokens")
      .lean() as Promise<{ fcm_tokens: string[] }[]>,
  ]);

  const tokens = recipientProfiles.flatMap((p) => p.fcm_tokens ?? []);
  if (!tokens.length) return;

  const actorName = actorProfile?.name ?? "Someone";
  const { title, body } = getPushText(type, meta, actorName);
  const url = getDeepLinkUrl(type, entityId);

  await adminMessaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { url },
    webpush: {
      notification: {
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        requireInteraction: false,
      },
      fcmOptions: { link: url },
    },
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fire-and-forget notification creation.
 * Inserts to DB, then sends FCM push in background.
 * Filters out the actor so they don't notify themselves.
 */
export async function createNotification({
  recipientIds,
  actorId,
  type,
  entityId,
  familyId,
  meta = {},
}: CreateNotificationParams): Promise<void> {
  const targets = [...new Set(recipientIds)].filter((id) => id !== actorId);
  if (targets.length === 0) return;

  await Notification.insertMany(
    targets.map((recipient_id) => ({
      _id: randomUUID(),
      recipient_id,
      actor_id: actorId,
      type,
      entity_id: entityId,
      family_id: familyId,
      meta,
      read: false,
    }))
  );

  // Send FCM push in background — never blocks the API response
  sendFcmPush(targets, actorId, type, entityId, meta).catch(() => {});
}
