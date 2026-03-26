import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { TreeRelationship } from "@/models/TreeRelationship";
import { randomUUID } from "crypto";

const INVERSE: Record<string, string> = {
  parent: "child",
  child: "parent",
  spouse: "spouse",
  sibling: "sibling",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { member_id, related_member_id, type } = await req.json();

    await TreeRelationship.create([
      {
        _id: randomUUID(),
        family_id: familyId,
        member_id,
        related_member_id,
        type,
      },
      {
        _id: randomUUID(),
        family_id: familyId,
        member_id: related_member_id,
        related_member_id: member_id,
        type: INVERSE[type],
      },
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAuth(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const relId = searchParams.get("relId");
    if (!relId)
      return NextResponse.json({ error: "Missing relId" }, { status: 400 });

    const rel = await TreeRelationship.findById(relId).lean();
    if (!rel) return NextResponse.json({ ok: true });

    await TreeRelationship.deleteMany({
      $or: [
        { _id: relId },
        {
          member_id: (rel as Record<string, unknown>).related_member_id,
          related_member_id: (rel as Record<string, unknown>).member_id,
          type: INVERSE[(rel as Record<string, unknown>).type as string],
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
