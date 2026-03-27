import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Comment } from "@/models/Comment";
import { Post } from "@/models/Post";
import { Profile } from "@/models/Profile";
import { randomUUID } from "crypto";
import { createNotification } from "@/lib/createNotification";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { postId } = await params;

    const comments = await Comment.find({ post_id: postId })
      .sort({ created_at: 1 })
      .lean();

    const authorIds = [...new Set(comments.map((c) => c.author_id))];
    const authors = await Profile.find({ _id: { $in: authorIds } })
      .select("_id name avatar")
      .lean() as unknown as { _id: string; name: string; avatar?: string }[];
    const authorMap = Object.fromEntries(authors.map((a) => [a._id, a]));

    return NextResponse.json(
      comments.map((c) => {
        const a = authorMap[c.author_id];
        return {
          id: c._id,
          post_id: c.post_id,
          author_id: c.author_id,
          content: c.content,
          created_at: c.created_at,
          author: a ? { id: a._id, name: a.name, avatar: a.avatar } : null,
        };
      })
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { postId } = await params;
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    const post = await Post.findById(postId).lean() as unknown as { family_id: string; author_id: string } | null;
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const comment = await Comment.create({
      _id: randomUUID(),
      post_id: postId,
      family_id: post.family_id,
      author_id: userId,
      content: content.trim(),
    });

    const author = await Profile.findById(userId).select("_id name avatar").lean() as unknown as { _id: string; name: string; avatar?: string } | null;

    // Fire-and-forget: notify post author of new comment
    createNotification({
      recipientIds: [post.author_id],
      actorId: userId,
      type: "post_comment",
      entityId: postId,
      familyId: post.family_id,
      meta: { comment_preview: content.trim().slice(0, 80) },
    }).catch(() => {});

    return NextResponse.json({
      id: comment._id,
      post_id: comment.post_id,
      author_id: comment.author_id,
      content: comment.content,
      created_at: comment.created_at,
      author: author ? { id: author._id, name: author.name, avatar: author.avatar } : null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    await params;
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");
    if (!commentId) return NextResponse.json({ error: "Missing commentId" }, { status: 400 });

    const comment = await Comment.findById(commentId);
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (comment.author_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await comment.deleteOne();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
