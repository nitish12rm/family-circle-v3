import { randomUUID } from "crypto";
import { Notification } from "@/models/Notification";

interface CreateNotificationParams {
  recipientIds: string[];
  actorId: string;
  type:
    | "new_post"
    | "post_like"
    | "post_comment"
    | "new_member"
    | "new_dm"
    | "new_group_message"
    | "new_assignment"
    | "assignment_update";
  entityId?: string;
  familyId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Fire-and-forget notification creation.
 * Filters out the actor so they don't notify themselves.
 */
export async function createNotification({
  recipientIds,
  actorId,
  type,
  entityId,
  familyId,
  meta,
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
}
