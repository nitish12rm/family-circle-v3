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

    // Delete family and all related data
    await Promise.all([
      Family.deleteOne({ _id: familyId }),
      FamilyMember.deleteMany({ family_id: familyId }),
      Post.deleteMany({ family_id: familyId }),
      Comment.deleteMany({ family_id: familyId }),
      Document.deleteMany({ family_id: familyId }),
      Message.deleteMany({ family_id: familyId }),
      FamilyInvite.deleteMany({ family_id: familyId }),
    ]);

    // Clean up orphaned likes for deleted posts
    const remainingPostIds = await Post.find({}).distinct("_id");
    await Like.deleteMany({ post_id: { $nin: remainingPostIds } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
