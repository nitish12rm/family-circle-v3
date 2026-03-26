import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Post } from "@/models/Post";
import { Profile } from "@/models/Profile";
import { Like } from "@/models/Like";
import { Comment } from "@/models/Comment";
import { deleteAllFromCloudinary } from "@/lib/cloudinaryDelete";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { postId } = await params;
    const { content, media_urls } = await req.json();

    const post = await Post.findById(postId);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (post.author_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Delete Cloudinary assets for removed images
    const removed: string[] = (post.media_urls as string[]).filter(
      (url: string) => !((media_urls ?? []) as string[]).includes(url)
    );
    if (removed.length) void deleteAllFromCloudinary(removed);

    if (content !== undefined) post.content = content.trim();
    if (media_urls !== undefined) post.media_urls = media_urls;
    post.updated_at = new Date();
    await post.save();

    return NextResponse.json({
      id: post._id,
      content: post.content,
      media_urls: post.media_urls,
      updated_at: post.updated_at,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
