import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Profile } from "@/models/Profile";
import { FamilyMember } from "@/models/FamilyMember";
import { Post } from "@/models/Post";
import { Document } from "@/models/Document";
import { TreeMember } from "@/models/TreeMember";

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
