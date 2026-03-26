import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { DirectMessage } from "@/models/DirectMessage";
import { MessageRead } from "@/models/MessageRead";
import { Profile } from "@/models/Profile";

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();

    // All DMs involving this user, latest first
    const allDMs = await DirectMessage.find({
      $or: [{ sender_id: userId }, { recipient_id: userId }],
    })
      .sort({ created_at: -1 })
      .lean();

    // Keep only the latest message per conversation partner
    const seen = new Map<string, typeof allDMs[0]>();
    for (const dm of allDMs) {
      const otherId = dm.sender_id === userId ? dm.recipient_id : dm.sender_id;
      if (!seen.has(otherId)) seen.set(otherId, dm);
    }

    const otherIds = [...seen.keys()];
    const profiles = await Profile.find({ _id: { $in: otherIds } })
      .select("_id name avatar")
      .lean() as unknown as { _id: string; name: string; avatar?: string }[];
    const profileMap = Object.fromEntries(profiles.map((p) => [p._id, p]));

    // Unread count: DMs sent to me by each partner that I haven't read
    const incomingIds = allDMs
      .filter((d) => d.recipient_id === userId)
      .map((d) => d._id as string);
    const readEntries = await MessageRead.find({ message_id: { $in: incomingIds }, user_id: userId }).lean();
    const readSet = new Set(readEntries.map((r) => r.message_id));

    // Build per-partner unread count
    const unreadByPartner: Record<string, number> = {};
    for (const dm of allDMs) {
      if (dm.recipient_id !== userId) continue;
      const partner = dm.sender_id;
      if (!readSet.has(dm._id as string)) {
        unreadByPartner[partner] = (unreadByPartner[partner] ?? 0) + 1;
      }
    }

    const conversations = otherIds.map((otherId) => {
      const latest = seen.get(otherId)!;
      const profile = profileMap[otherId];
      return {
        userId: otherId,
        name: profile?.name ?? "Unknown",
        avatar: profile?.avatar ?? null,
        lastMessage: latest.content,
        lastMessageAt: latest.created_at,
        isMe: latest.sender_id === userId,
        unread: unreadByPartner[otherId] ?? 0,
      };
    });

    // Already sorted by latest message desc (seen.set order = insertion order = desc)
    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
