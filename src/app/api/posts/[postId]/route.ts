import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Post } from "@/models/Post";
import { Profile } from "@/models/Profile";
import { Like } from "@/models/Like";
import { Comment } from "@/models/Comment";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { postId } = await params;

    const post = await Post.findById(postId).lean() as Record<string, unknown> | null;
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [author, likeCount, myLike, commentCount] = await Promise.all([
      Profile.findById(post.author_id).select("_id name avatar").lean() as unknown as Promise<Record<string, unknown> | null>,
      Like.countDocuments({ post_id: postId }),
      Like.findOne({ post_id: postId, user_id: userId }).lean(),
      Comment.countDocuments({ post_id: postId }),
    ]);

    return NextResponse.json({
      id: post._id,
      family_id: post.family_id,
      author_id: post.author_id,
      content: post.content,
      media_urls: Array.isArray(post.media_urls) ? post.media_urls : [],
      created_at: post.created_at,
      like_count: likeCount,
      comment_count: commentCount,
      liked_by_me: !!myLike,
      author: author ? { id: author._id, name: author.name, avatar: author.avatar } : null,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
