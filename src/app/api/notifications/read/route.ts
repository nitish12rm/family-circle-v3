import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Notification } from "@/models/Notification";

/**
 * PATCH /api/notifications/read
 *
 * Without query params → marks ALL unread as read.
 * With query params → scoped mark-read:
 *   ?types=new_dm&types=new_group_message
 *   ?actor_id=<id>        (only notifications from this actor)
 *   ?family_id=<id>       (only notifications for this family)
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const types = searchParams.getAll("types");
    const actor_id = searchParams.get("actor_id");
    const family_id = searchParams.get("family_id");

    const filter: Record<string, unknown> = { recipient_id: userId, read: false };
    if (types.length)  filter.type     = { $in: types };
    if (actor_id)      filter.actor_id  = actor_id;
    if (family_id)     filter.family_id = family_id;

    await Notification.updateMany(filter, { $set: { read: true } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
