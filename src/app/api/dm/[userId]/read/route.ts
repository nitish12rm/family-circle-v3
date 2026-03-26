import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { DirectMessage } from "@/models/DirectMessage";
import { MessageRead } from "@/models/MessageRead";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: me } = requireAuth(req);
    await connectDB();
    const { userId: other } = await params;

    // All DMs sent by other to me
    const dms = await DirectMessage.find({ sender_id: other, recipient_id: me }).lean();
    const messageIds = dms.map((d) => d._id as string);
    if (messageIds.length === 0) return NextResponse.json({ count: 0 });

    // Filter to unread ones
    const existing = await MessageRead.find({ message_id: { $in: messageIds }, user_id: me }).lean();
    const readSet = new Set(existing.map((r) => r.message_id));
    const unread = messageIds.filter((id) => !readSet.has(id));

    if (unread.length > 0) {
      await MessageRead.insertMany(
        unread.map((id) => ({ _id: randomUUID(), message_id: id, user_id: me })),
        { ordered: false }
      );
    }

    return NextResponse.json({ count: unread.length });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
