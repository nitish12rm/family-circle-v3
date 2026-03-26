import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Like } from "@/models/Like";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { postId } = await params;

    const existing = await Like.findOne({ post_id: postId, user_id: userId });
    if (existing) {
      await existing.deleteOne();
    } else {
      await Like.create({ _id: randomUUID(), post_id: postId, user_id: userId });
    }

    const like_count = await Like.countDocuments({ post_id: postId });
    return NextResponse.json({ liked: !existing, like_count });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
