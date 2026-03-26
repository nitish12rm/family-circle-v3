import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { TreeMember } from "@/models/TreeMember";
import { TreeRelationship } from "@/models/TreeRelationship";
import { FamilyMember } from "@/models/FamilyMember";
import { randomUUID } from "crypto";

async function requireAdmin(req: NextRequest, familyId: string) {
  const { userId } = requireAuth(req);
  await connectDB();
  const membership = await FamilyMember.findOne({ family_id: familyId, user_id: userId, role: "admin" }).lean();
  if (!membership) throw new Error("Forbidden");
  return { userId };
}

async function cleanOrphanedPlaceholders(familyId: string) {
  const connected = await TreeRelationship.find({ family_id: familyId }).lean();
  const connectedIds = new Set(connected.flatMap((r) => [r.member_id, r.related_member_id]));
  await TreeMember.deleteMany({
    family_id: familyId,
    is_placeholder: true,
    _id: { $nin: Array.from(connectedIds) },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { familyId } = await params;

    const [members, relationships] = await Promise.all([
      TreeMember.find({ family_id: familyId }).lean(),
      TreeRelationship.find({ family_id: familyId }).lean(),
    ]);

    return NextResponse.json({
      members: members.map((m) => ({
        id: m._id,
        family_id: m.family_id,
        profile_id: m.profile_id,
        name: m.name,
        dob: m.dob,
        dod: m.dod,
        gender: m.gender,
        photo: m.photo,
        status: m.status,
        notes: m.notes,
        is_placeholder: m.is_placeholder,
        is_deceased: m.is_deceased,
      })),
      relationships: relationships.map((r) => ({
        id: r._id,
        family_id: r.family_id,
        member_id: r.member_id,
        related_member_id: r.related_member_id,
        type: r.type,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const body = await req.json();

    const member = await TreeMember.create({
      _id: randomUUID(),
      family_id: familyId,
      name: body.name,
      dob: body.dob,
      dod: body.dod,
      gender: body.gender,
      photo: body.photo,
      status: body.status,
      notes: body.notes,
      profile_id: body.profile_id,
      is_placeholder: body.is_placeholder ?? false,
      is_deceased: body.is_deceased ?? false,
    });

    return NextResponse.json({ id: member._id, ...member.toObject() });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId)
      return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

    // Allow self-edit or admin
    const target = await TreeMember.findOne({ _id: memberId, family_id: familyId }).lean();
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isSelf = (target as { profile_id?: string }).profile_id === userId;
    if (!isSelf) {
      const adminMembership = await FamilyMember.findOne({ family_id: familyId, user_id: userId, role: "admin" }).lean();
      if (!adminMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ["name", "dob", "dod", "gender", "photo", "status", "notes", "is_deceased"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const member = await TreeMember.findOneAndUpdate(
      { _id: memberId, family_id: familyId },
      { $set: updates },
      { new: true, lean: true }
    ) as Record<string, unknown> | null;
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const m = member;
    return NextResponse.json({
      id: m._id, family_id: m.family_id, profile_id: m.profile_id,
      name: m.name, dob: m.dob, dod: m.dod, gender: m.gender,
      photo: m.photo, status: m.status, notes: m.notes,
      is_placeholder: m.is_placeholder, is_deceased: m.is_deceased,
    });
  } catch (err) {
    const status = (err as Error).message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId)
      return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

    const target = await TreeMember.findOne({ _id: memberId, family_id: familyId }).lean();
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isSelf = (target as { profile_id?: string }).profile_id === userId;
    if (!isSelf) {
      const adminMembership = await FamilyMember.findOne({ family_id: familyId, user_id: userId, role: "admin" }).lean();
      if (!adminMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await TreeMember.findByIdAndDelete(memberId);
    await TreeRelationship.deleteMany({
      family_id: familyId,
      $or: [{ member_id: memberId }, { related_member_id: memberId }],
    });

    // Remove any placeholder nodes that are now disconnected
    await cleanOrphanedPlaceholders(familyId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = (err as Error).message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
