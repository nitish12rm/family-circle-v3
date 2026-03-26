import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Document } from "@/models/Document";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const docs = await Document.find({ family_id: familyId })
      .sort({ created_at: -1 })
      .lean();

    return NextResponse.json(
      docs.map((d) => ({
        id: d._id,
        family_id: d.family_id,
        uploaded_by: d.uploaded_by,
        member_id: d.member_id,
        name: d.name,
        file_path: d.file_path,
        file_size: d.file_size,
        mime_type: d.mime_type,
        description: d.description,
        category: d.category ?? "Other",
        visibility: d.visibility ?? "private",
        created_at: d.created_at,
      }))
    );
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
    const { name, file_path, file_size, mime_type, description, member_id, category, visibility } =
      await req.json();

    if (!name || !file_path) {
      return NextResponse.json(
        { error: "Name and file_path are required" },
        { status: 400 }
      );
    }

    const doc = await Document.create({
      _id: randomUUID(),
      family_id: familyId,
      uploaded_by: userId,
      member_id,
      name,
      file_path,
      file_size: file_size ?? 0,
      mime_type: mime_type ?? "application/octet-stream",
      description,
      category: category ?? "Other",
      visibility: visibility ?? "private",
    });

    return NextResponse.json({
      id: doc._id,
      family_id: doc.family_id,
      name: doc.name,
      file_path: doc.file_path,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      description: doc.description,
      category: doc.category,
      visibility: doc.visibility,
      created_at: doc.created_at,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");
    if (!docId)
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });

    const doc = await Document.findById(docId);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (doc.uploaded_by !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await doc.deleteOne();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
