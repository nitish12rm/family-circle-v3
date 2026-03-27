import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Notification } from "@/models/Notification";

/** PATCH /api/notifications/[id] — mark a single notification as read */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { id } = await params;
    await Notification.updateOne(
      { _id: id, recipient_id: userId },
      { $set: { read: true } }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
