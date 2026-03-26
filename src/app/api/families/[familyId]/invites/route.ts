import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { FamilyInvite } from "@/models/FamilyInvite";
import { randomUUID, randomBytes } from "crypto";

function toInvite(i: Record<string, unknown>) {
  return {
    id: i._id,
    family_id: i.family_id,
    code: i.code,
    created_by: i.created_by,
    expires_at: i.expires_at,
    max_uses: i.max_uses,
    use_count: i.use_count,
    is_active: i.is_active,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const invites = await FamilyInvite.find({
      family_id: familyId,
      is_active: true,
    }).lean();
    return NextResponse.json(invites.map((i) => toInvite(i as Record<string, unknown>)));
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

    const code = randomBytes(6).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await FamilyInvite.create({
      _id: randomUUID(),
      family_id: familyId,
      code,
      created_by: userId,
      expires_at: expiresAt,
    });

    return NextResponse.json(toInvite(invite.toObject() as Record<string, unknown>));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAuth(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get("inviteId");
    if (!inviteId)
      return NextResponse.json({ error: "Missing inviteId" }, { status: 400 });
    await FamilyInvite.findByIdAndUpdate(inviteId, { is_active: false });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
