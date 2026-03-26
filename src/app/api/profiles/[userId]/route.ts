import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Profile } from "@/models/Profile";
import { FamilyMember } from "@/models/FamilyMember";
import { Post } from "@/models/Post";
import { Document } from "@/models/Document";
import { Like } from "@/models/Like";
import { Comment } from "@/models/Comment";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: viewerId } = requireAuth(req);
    await connectDB();
    const { userId } = await params;

    const profile = await Profile.findById(userId)
      .select("name avatar status dob education goals gender created_at")
      .lean() as Record<string, unknown> | null;
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Families the viewer belongs to
    const viewerMemberships = await FamilyMember.find({ user_id: viewerId }).lean() as { family_id: string }[];
    const viewerFamilyIds = viewerMemberships.map((m) => m.family_id);

    // Families the target user belongs to
    const userMemberships = await FamilyMember.find({ user_id: userId }).lean() as { family_id: string }[];
    const userFamilyIds = userMemberships.map((m) => m.family_id);

    // Only show content from shared families
    const sharedFamilyIds = viewerFamilyIds.filter((id) => userFamilyIds.includes(id));

    // Posts by this user in shared families
    const posts = await Post.find({
      author_id: userId,
      family_id: { $in: sharedFamilyIds },
    })
      .sort({ created_at: -1 })
      .limit(30)
      .lean() as Record<string, unknown>[];

    const postIds = posts.map((p) => p._id);
    const [allLikes, allComments] = await Promise.all([
      Like.find({ post_id: { $in: postIds } }).lean() as Promise<{ post_id: string; user_id: string }[]>,
      Comment.find({ post_id: { $in: postIds } }).lean() as Promise<{ post_id: string }[]>,
    ]);

    const likeCountMap: Record<string, number> = {};
    const likedByMeMap: Record<string, boolean> = {};
    for (const like of allLikes) {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1;
      if (like.user_id === viewerId) likedByMeMap[like.post_id] = true;
    }
    const commentCountMap: Record<string, number> = {};
    for (const c of allComments) {
      commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1;
    }

    // Public documents uploaded by this user in shared families
    const documents = await Document.find({
      uploaded_by: userId,
      family_id: { $in: sharedFamilyIds },
      visibility: "public",
    })
      .sort({ created_at: -1 })
      .lean() as Record<string, unknown>[];

    return NextResponse.json({
      profile: {
        id: profile._id,
        name: profile.name,
        avatar: profile.avatar,
        status: profile.status,
        dob: profile.dob,
        education: profile.education,
        goals: profile.goals,
        gender: profile.gender,
        created_at: profile.created_at,
      },
      posts: posts.map((p) => ({
        id: p._id,
        content: p.content,
        media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
        family_id: p.family_id,
        created_at: p.created_at,
        like_count: likeCountMap[p._id as string] ?? 0,
        comment_count: commentCountMap[p._id as string] ?? 0,
        liked_by_me: likedByMeMap[p._id as string] ?? false,
      })),
      documents: documents.map((d) => ({
        id: d._id,
        name: d.name,
        file_path: d.file_path,
        file_size: d.file_size,
        mime_type: d.mime_type,
        description: d.description,
        category: d.category ?? "Other",
        created_at: d.created_at,
      })),
      stats: {
        posts: posts.length,
        families: userFamilyIds.length,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
