import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { FamilyMember } from "@/models/FamilyMember";
import { Profile } from "@/models/Profile";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;

    const membership = await FamilyMember.findOne({ family_id: familyId, user_id: userId });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 404 });

    if (membership.role === "admin") {
      const adminCount = await FamilyMember.countDocuments({ family_id: familyId, role: "admin" });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "You are the only admin. Delete the family or make another member admin first." },
          { status: 400 }
        );
      }
    }

    await membership.deleteOne();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { familyId } = await params;

    const members = await FamilyMember.find({ family_id: familyId }).lean();
    const userIds = members.map((m) => m.user_id);
    const profiles = await Profile.find({ _id: { $in: userIds } })
      .select("-password")
      .lean();

    const profileMap = Object.fromEntries(profiles.map((p) => [p._id, p]));

    return NextResponse.json(
      members.map((m) => {
        const p = profileMap[m.user_id] as Record<string, unknown> | undefined;
        return {
          id: m._id,
          family_id: m.family_id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          profile: p
            ? {
                id: p._id,
                name: p.name,
                email: p.email,
                avatar: p.avatar,
                last_seen: p.last_seen ?? null,
              }
            : null,
        };
      })
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
