import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Post } from "@/models/Post";
import { Profile } from "@/models/Profile";
import { Like } from "@/models/Like";
import { Comment } from "@/models/Comment";
import { randomUUID } from "crypto";
import { deleteAllFromCloudinary } from "@/lib/cloudinaryDelete";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const skip = parseInt(searchParams.get("offset") ?? "0");
    const authorId = searchParams.get("author_id") ?? "";
    const tagsParam = searchParams.get("tags") ?? "";
    const fromDate = searchParams.get("from_date") ?? "";
    const toDate = searchParams.get("to_date") ?? "";

    // Update last_seen for the current user (fire-and-forget)
    Profile.updateOne({ _id: userId }, { $set: { last_seen: new Date() } }).catch(() => {});

    // Build query filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { family_id: familyId };
    if (authorId) query.author_id = authorId;
    if (tagsParam) query.tags = { $all: tagsParam.split(",").filter(Boolean) };
    if (fromDate || toDate) {
      query.created_at = {};
      if (fromDate) query.created_at.$gte = new Date(fromDate);
      if (toDate) query.created_at.$lte = new Date(toDate);
    }

    type PostLean = { _id: string; family_id: string; author_id: string; content: string; media_urls: string[]; tags: string[]; created_at: string };
    const posts = await Post.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as unknown as PostLean[];

    const postIds = posts.map((p) => p._id);

    const [authorProfiles, allLikes, allComments] = await Promise.all([
      Profile.find({ _id: { $in: [...new Set(posts.map((p) => p.author_id))] } })
        .select("_id name avatar email")
        .lean() as unknown as Promise<{ _id: string; name: string; avatar?: string }[]>,
      Like.find({ post_id: { $in: postIds } }).lean() as unknown as Promise<{ post_id: string; user_id: string }[]>,
      Comment.find({ post_id: { $in: postIds } }).lean() as unknown as Promise<{ post_id: string }[]>,
    ]);

    const authorMap = Object.fromEntries(authorProfiles.map((a) => [a._id, a]));

    const likeCountMap: Record<string, number> = {};
    const likedByMeMap: Record<string, boolean> = {};
    const likerIdsPerPost: Record<string, string[]> = {};
    for (const like of allLikes) {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1;
      if (like.user_id === userId) likedByMeMap[like.post_id] = true;
      if (!likerIdsPerPost[like.post_id]) likerIdsPerPost[like.post_id] = [];
      if (likerIdsPerPost[like.post_id].length < 3) likerIdsPerPost[like.post_id].push(like.user_id);
    }

    const commentCountMap: Record<string, number> = {};
    for (const c of allComments) {
      commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1;
    }

    const previewLikerIds = [...new Set(Object.values(likerIdsPerPost).flat())];
    const likerProfiles = previewLikerIds.length
      ? await Profile.find({ _id: { $in: previewLikerIds } }).select("_id name avatar").lean() as unknown as { _id: string; name: string; avatar?: string }[]
      : [];
    const likerProfileMap = Object.fromEntries(likerProfiles.map((p) => [p._id, p]));

    return NextResponse.json(
      posts.map((p) => {
        const a = authorMap[p.author_id];
        const likers = (likerIdsPerPost[p._id] ?? []).map((id) => {
          const lp = likerProfileMap[id];
          return lp ? { id: lp._id, name: lp.name, avatar: lp.avatar } : null;
        }).filter(Boolean);
        return {
          id: p._id,
          family_id: p.family_id,
          author_id: p.author_id,
          content: p.content,
          media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
          created_at: p.created_at,
          like_count: likeCountMap[p._id] ?? 0,
          comment_count: commentCountMap[p._id] ?? 0,
          liked_by_me: likedByMeMap[p._id] ?? false,
          likers,
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
    const { content, media_urls, tags } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const post = await Post.create({
      _id: randomUUID(),
      family_id: familyId,
      author_id: userId,
      content: content.trim(),
      media_urls: media_urls ?? [],
      tags: Array.isArray(tags) ? tags : [],
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
      tags: post.tags,
      created_at: post.created_at,
      like_count: 0,
      comment_count: 0,
      liked_by_me: false,
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

    const mediaUrls: string[] = Array.isArray(post.media_urls) ? post.media_urls : [];
    await post.deleteOne();
    void deleteAllFromCloudinary(mediaUrls);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
