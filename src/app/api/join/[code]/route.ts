import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { FamilyInvite } from "@/models/FamilyInvite";
import { FamilyMember } from "@/models/FamilyMember";
import { Family } from "@/models/Family";
import { randomUUID } from "crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await connectDB();
    const { code } = await params;
    const invite = await FamilyInvite.findOne({ code, is_active: true }).lean() as Record<string, unknown> | null;
    if (!invite) return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });

    if (new Date(invite.expires_at as string) < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    const family = await Family.findById(invite.family_id).lean() as Record<string, unknown> | null;
    return NextResponse.json({ invite, family: family ? { id: family._id, name: family.name } : null });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { code } = await params;

    const invite = await FamilyInvite.findOne({ code, is_active: true }) as Record<string, unknown> | null;
    if (!invite) return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });

    if (new Date(invite.expires_at as string) < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    const existing = await FamilyMember.findOne({
      family_id: invite.family_id,
      user_id: userId,
    });
    if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

    await FamilyMember.create({
      _id: randomUUID(),
      family_id: invite.family_id,
      user_id: userId,
      role: "member",
    });

    await FamilyInvite.findByIdAndUpdate(invite._id, {
      $inc: { use_count: 1 },
    });

    const family = await Family.findById(invite.family_id).lean() as Record<string, unknown> | null;
    return NextResponse.json({ family: family ? { id: family._id, name: family.name } : null });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
