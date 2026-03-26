import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { DirectMessage } from "@/models/DirectMessage";
import { Message } from "@/models/Message";
import { MessageRead } from "@/models/MessageRead";
import { FamilyMember } from "@/models/FamilyMember";

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();

    // DM unread: messages sent to me that I haven't read
    const dmMsgs = await DirectMessage.find({ recipient_id: userId }).lean();
    const dmIds = dmMsgs.map((d) => d._id as string);
    const dmRead = await MessageRead.find({ message_id: { $in: dmIds }, user_id: userId }).lean();
    const dmReadSet = new Set(dmRead.map((r) => r.message_id));
    const dmsUnread = dmIds.filter((id) => !dmReadSet.has(id)).length;

    // Group unread: messages in my families not sent by me that I haven't read
    const memberships = await FamilyMember.find({ user_id: userId }).lean();
    const familyIds = memberships.map((m) => m.family_id);
    const groupMsgs = await Message.find({ family_id: { $in: familyIds }, sender_id: { $ne: userId } }).lean();
    const groupIds = groupMsgs.map((m) => m._id as string);
    const groupRead = await MessageRead.find({ message_id: { $in: groupIds }, user_id: userId }).lean();
    const groupReadSet = new Set(groupRead.map((r) => r.message_id));
    const groupUnread = groupIds.filter((id) => !groupReadSet.has(id)).length;

    return NextResponse.json({
      dms: dmsUnread,
      group: groupUnread,
      total: dmsUnread + groupUnread,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
