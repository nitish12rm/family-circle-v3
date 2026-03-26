import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Like } from "@/models/Like";
import { Profile } from "@/models/Profile";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { postId } = await params;

    const likes = await Like.find({ post_id: postId })
      .sort({ created_at: -1 })
      .lean() as { user_id: string }[];

    const userIds = likes.map((l) => l.user_id);
    const profiles = await Profile.find({ _id: { $in: userIds } })
      .select("_id name avatar")
      .lean() as { _id: string; name: string; avatar?: string }[];

    const profileMap = Object.fromEntries(profiles.map((p) => [p._id, p]));

    return NextResponse.json(
      userIds.map((id) => {
        const p = profileMap[id];
        return { id, name: p?.name ?? "Unknown", avatar: p?.avatar ?? null };
      })
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
