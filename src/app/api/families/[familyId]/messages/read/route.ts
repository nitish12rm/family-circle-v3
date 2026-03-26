import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Message } from "@/models/Message";
import { MessageRead } from "@/models/MessageRead";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;

    // All group messages not sent by me
    const msgs = await Message.find({ family_id: familyId, sender_id: { $ne: userId } }).lean();
    const messageIds = msgs.map((m) => m._id as string);
    if (messageIds.length === 0) return NextResponse.json({ count: 0 });

    const existing = await MessageRead.find({ message_id: { $in: messageIds }, user_id: userId }).lean();
    const readSet = new Set(existing.map((r) => r.message_id));
    const unread = messageIds.filter((id) => !readSet.has(id));

    if (unread.length > 0) {
      await MessageRead.insertMany(
        unread.map((id) => ({ _id: randomUUID(), message_id: id, user_id: userId })),
        { ordered: false }
      );
    }

    return NextResponse.json({ count: unread.length });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
