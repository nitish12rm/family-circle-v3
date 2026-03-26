import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { TreeRelationship } from "@/models/TreeRelationship";
import { TreeMember } from "@/models/TreeMember";
import { FamilyMember } from "@/models/FamilyMember";
import { randomUUID } from "crypto";

const INVERSE: Record<string, string> = {
  parent: "child",
  child: "parent",
  spouse: "spouse",
  sibling: "sibling",
  step_parent: "step_child",
  step_child: "step_parent",
};

async function canEditRel(
  userId: string,
  familyId: string,
  memberId: string,
  relatedMemberId: string
): Promise<boolean> {
  const admin = await FamilyMember.findOne({
    family_id: familyId,
    user_id: userId,
    role: "admin",
  }).lean();
  if (admin) return true;
  const myNode = await TreeMember.findOne({
    family_id: familyId,
    profile_id: userId,
    _id: { $in: [memberId, relatedMemberId] },
  }).lean();
  return !!myNode;
}

async function cleanOrphans(familyId: string) {
  const allRels = await TreeRelationship.find({ family_id: familyId }).lean();
  const connected = new Set(allRels.flatMap((r) => [r.member_id, r.related_member_id]));
  await TreeMember.deleteMany({
    family_id: familyId,
    is_placeholder: true,
    _id: { $nin: Array.from(connected) },
  });
}

// POST — create a new relationship pair (admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const admin = await FamilyMember.findOne({ family_id: familyId, user_id: userId, role: "admin" }).lean();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { member_id, related_member_id, type } = await req.json();

    await TreeRelationship.create([
      { _id: randomUUID(), family_id: familyId, member_id, related_member_id, type },
      { _id: randomUUID(), family_id: familyId, member_id: related_member_id, related_member_id: member_id, type: INVERSE[type] },
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = (err as Error).message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

// PATCH — change a relationship type (admin OR member involved)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { relId, new_type } = await req.json() as { relId: string; new_type: string };
    if (!relId || !new_type) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (!INVERSE[new_type]) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

    const rel = await TreeRelationship.findById(relId).lean() as Record<string, string> | null;
    if (!rel) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const allowed = await canEditRel(userId, familyId, rel.member_id, rel.related_member_id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await TreeRelationship.updateOne({ _id: relId }, { $set: { type: new_type } });
    await TreeRelationship.updateOne(
      { family_id: familyId, member_id: rel.related_member_id, related_member_id: rel.member_id },
      { $set: { type: INVERSE[new_type] } }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = (err as Error).message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

// DELETE — remove a relationship pair (admin OR member involved)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { searchParams } = new URL(req.url);
    const relId = searchParams.get("relId");
    if (!relId) return NextResponse.json({ error: "Missing relId" }, { status: 400 });

    const rel = await TreeRelationship.findById(relId).lean() as Record<string, string> | null;
    if (!rel) return NextResponse.json({ ok: true });

    const allowed = await canEditRel(userId, familyId, rel.member_id, rel.related_member_id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await TreeRelationship.deleteMany({
      $or: [
        { _id: relId },
        { family_id: familyId, member_id: rel.related_member_id, related_member_id: rel.member_id },
      ],
    });

    await cleanOrphans(familyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = (err as Error).message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
