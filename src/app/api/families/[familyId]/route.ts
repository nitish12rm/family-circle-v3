import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Family } from "@/models/Family";
import { FamilyMember } from "@/models/FamilyMember";
import { Post } from "@/models/Post";
import { Comment } from "@/models/Comment";
import { Like } from "@/models/Like";
import { Document } from "@/models/Document";
import { Message } from "@/models/Message";
import { FamilyInvite } from "@/models/FamilyInvite";
import { deleteAllFromCloudinary } from "@/lib/cloudinaryDelete";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;

    const membership = await FamilyMember.findOne({ family_id: familyId, user_id: userId });
    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete a family" }, { status: 403 });
    }

    // Collect all Cloudinary assets before deleting records
    const [posts, documents] = await Promise.all([
      Post.find({ family_id: familyId }).select("media_urls").lean() as Promise<{ media_urls?: string[] }[]>,
      Document.find({ family_id: familyId }).select("file_path").lean() as Promise<{ file_path: string }[]>,
    ]);

    const cloudinaryUrls = [
      ...posts.flatMap((p) => p.media_urls ?? []),
      ...documents.map((d) => d.file_path),
    ];

    // Delete MongoDB records
    await Promise.all([
      Family.deleteOne({ _id: familyId }),
      FamilyMember.deleteMany({ family_id: familyId }),
      Post.deleteMany({ family_id: familyId }),
      Comment.deleteMany({ family_id: familyId }),
      Document.deleteMany({ family_id: familyId }),
      Message.deleteMany({ family_id: familyId }),
      FamilyInvite.deleteMany({ family_id: familyId }),
      Like.deleteMany({ post_id: { $in: posts.map((p: Record<string, unknown>) => (p as { _id: string })._id) } }),
    ]);

    // Delete Cloudinary assets — fire and forget, don't block response
    void deleteAllFromCloudinary(cloudinaryUrls);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
