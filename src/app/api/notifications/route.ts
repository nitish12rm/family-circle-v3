import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Notification } from "@/models/Notification";
import { Profile } from "@/models/Profile";

type NotificationLean = {
  _id: string;
  recipient_id: string;
  actor_id: string;
  type: string;
  entity_id?: string;
  family_id?: string;
  meta?: Record<string, unknown>;
  read: boolean;
  created_at: Date;
};

/** GET /api/notifications — fetch latest 60 for current user, with actor profile */
export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();

    const notifications = await Notification.find({ recipient_id: userId })
      .sort({ created_at: -1 })
      .limit(60)
      .lean() as unknown as NotificationLean[];

    const actorIds = [...new Set(notifications.map((n) => n.actor_id))];
    const actors = await Profile.find({ _id: { $in: actorIds } })
      .select("_id name avatar")
      .lean() as unknown as { _id: string; name: string; avatar?: string }[];
    const actorMap = Object.fromEntries(actors.map((a) => [a._id, a]));

    return NextResponse.json(
      notifications.map((n) => {
        const actor = actorMap[n.actor_id];
        return {
          id: n._id,
          type: n.type,
          actor_id: n.actor_id,
          actor: actor ? { name: actor.name, avatar: actor.avatar } : null,
          entity_id: n.entity_id,
          family_id: n.family_id,
          meta: n.meta ?? {},
          read: n.read,
          created_at: n.created_at,
        };
      })
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

