import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Notification } from "@/models/Notification";

/** PATCH /api/notifications/read — mark ALL unread notifications as read */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    await Notification.updateMany(
      { recipient_id: userId, read: false },
      { $set: { read: true } }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
