import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Profile } from "@/models/Profile";
import { Post } from "@/models/Post";
import { Comment } from "@/models/Comment";
import { Like } from "@/models/Like";
import { Document } from "@/models/Document";
import { FamilyMember } from "@/models/FamilyMember";
import { FamilyInvite } from "@/models/FamilyInvite";
import { DirectMessage } from "@/models/DirectMessage";
import { deleteAllFromCloudinary } from "@/lib/cloudinaryDelete";

function toProfile(p: Record<string, unknown>) {
  return {
    id: p._id,
    email: p.email,
    name: p.name,
    dob: p.dob,
    phone: p.phone,
    avatar: p.avatar,
    status: p.status,
    education: p.education,
    goals: p.goals,
    gender: p.gender,
    onboarding_complete: p.onboarding_complete,
    created_at: p.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const profile = await Profile.findById(userId).lean();
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toProfile(profile as Record<string, unknown>));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();

    // Collect Cloudinary assets before deleting records
    const [posts, documents] = await Promise.all([
      Post.find({ author_id: userId }).select("media_urls").lean() as Promise<{ _id: string; media_urls?: string[] }[]>,
      Document.find({ uploaded_by: userId }).select("file_path").lean() as Promise<{ file_path: string }[]>,
    ]);

    const profile = await Profile.findById(userId).select("avatar").lean() as { avatar?: string } | null;
    const cloudinaryUrls = [
      ...(profile?.avatar ? [profile.avatar] : []),
      ...posts.flatMap((p) => p.media_urls ?? []),
      ...documents.map((d) => d.file_path),
    ];

    const postIds = posts.map((p) => p._id);

    // Delete all user records
    await Promise.all([
      Profile.deleteOne({ _id: userId }),
      Post.deleteMany({ author_id: userId }),
      Comment.deleteMany({ author_id: userId }),
      Like.deleteMany({ user_id: userId }),
      Document.deleteMany({ uploaded_by: userId }),
      FamilyMember.deleteMany({ user_id: userId }),
      FamilyInvite.deleteMany({ created_by: userId }),
      DirectMessage.deleteMany({ $or: [{ sender_id: userId }, { recipient_id: userId }] }),
      Like.deleteMany({ post_id: { $in: postIds } }),
      Comment.deleteMany({ post_id: { $in: postIds } }),
    ]);

    void deleteAllFromCloudinary(cloudinaryUrls);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const body = await req.json();
    const allowed = ["name", "dob", "phone", "avatar", "status", "education", "goals", "gender", "onboarding_complete"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const profile = await Profile.findByIdAndUpdate(
      userId,
      { $set: { ...updates, updated_at: new Date() } },
      { new: true, lean: true }
    );
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toProfile(profile as Record<string, unknown>));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
