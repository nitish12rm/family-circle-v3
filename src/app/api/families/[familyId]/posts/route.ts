import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Post } from "@/models/Post";
import { Profile } from "@/models/Profile";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const skip = parseInt(searchParams.get("offset") ?? "0");

    const posts = await Post.find({ family_id: familyId })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const authorIds = [...new Set(posts.map((p) => p.author_id))];
    const authors = await Profile.find({ _id: { $in: authorIds } })
      .select("_id name avatar email")
      .lean();
    const authorMap = Object.fromEntries(authors.map((a) => [a._id, a]));

    return NextResponse.json(
      posts.map((p) => {
        const a = authorMap[p.author_id] as Record<string, unknown> | undefined;
        return {
          id: p._id,
          family_id: p.family_id,
          author_id: p.author_id,
          content: p.content,
          media_urls: p.media_urls,
          created_at: p.created_at,
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
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { content, media_urls } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const post = await Post.create({
      _id: randomUUID(),
      family_id: familyId,
      author_id: userId,
      content: content.trim(),
      media_urls: media_urls ?? [],
    });

    const author = await Profile.findById(userId)
      .select("_id name avatar")
      .lean() as Record<string, unknown> | null;

    return NextResponse.json({
      id: post._id,
      family_id: post.family_id,
      author_id: post.author_id,
      content: post.content,
      media_urls: post.media_urls,
      created_at: post.created_at,
      author: author ? { id: author._id, name: author.name, avatar: author.avatar } : null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");
    if (!postId)
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    const post = await Post.findById(postId);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (post.author_id !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await post.deleteOne();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
