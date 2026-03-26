import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Family } from "@/models/Family";
import { FamilyMember } from "@/models/FamilyMember";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();

    const memberships = await FamilyMember.find({ user_id: userId }).lean();
    const familyIds = memberships.map((m) => m.family_id);
    const families = await Family.find({ _id: { $in: familyIds } }).lean();

    return NextResponse.json(
      families.map((f) => ({
        id: f._id,
        name: f.name,
        description: f.description,
        avatar: f.avatar,
        created_by: f.created_by,
        created_at: f.created_at,
      }))
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();

    const { name, description } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const familyId = randomUUID();
    const family = await Family.create({
      _id: familyId,
      name: name.trim(),
      description: description?.trim(),
      created_by: userId,
    });

    await FamilyMember.create({
      _id: randomUUID(),
      family_id: familyId,
      user_id: userId,
      role: "admin",
    });

    return NextResponse.json({
      id: family._id,
      name: family.name,
      description: family.description,
      avatar: family.avatar,
      created_by: family.created_by,
      created_at: family.created_at,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
