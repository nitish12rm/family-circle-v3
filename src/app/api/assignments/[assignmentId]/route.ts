import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Assignment } from "@/models/Assignment";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { assignmentId } = await params;
    const { title, description, deadline, status } = await req.json();

    const a = await Assignment.findById(assignmentId);
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (a.assigner_id !== userId && a.assignee_id !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (title !== undefined)       a.title       = title.trim();
    if (description !== undefined) a.description = description.trim();
    if (deadline !== undefined)    a.deadline    = deadline ? new Date(deadline) : null;
    if (status !== undefined)      a.status      = status;
    a.updated_at = new Date();
    await a.save();

    return NextResponse.json({ id: a._id, title: a.title, description: a.description,
      deadline: a.deadline, status: a.status, updated_at: a.updated_at });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { assignmentId } = await params;

    const a = await Assignment.findById(assignmentId);
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (a.assigner_id !== userId)
      return NextResponse.json({ error: "Only the assigner can delete" }, { status: 403 });

    await a.deleteOne();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
