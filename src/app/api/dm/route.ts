import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { DirectMessage } from "@/models/DirectMessage";
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
      };
    });

    // Already sorted by latest message desc (seen.set order = insertion order = desc)
    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
