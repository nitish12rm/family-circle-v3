import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Assignment } from "@/models/Assignment";
import { Profile } from "@/models/Profile";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { assignmentId } = await params;
    const { text } = await req.json();

    if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });

    const a = await Assignment.findById(assignmentId);
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (a.assigner_id !== userId && a.assignee_id !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    a.updates.push({ user_id: userId, text: text.trim(), created_at: new Date() });
    a.updated_at = new Date();
    await a.save();

    const update = a.updates[a.updates.length - 1];
    const profile = await Profile.findById(userId).select("_id name avatar").lean() as
      { _id: string; name: string; avatar?: string } | null;

    return NextResponse.json({
      id: update._id,
      user_id: update.user_id,
      text: update.text,
      created_at: update.created_at,
      author: profile ? { id: profile._id, name: profile.name, avatar: profile.avatar } : null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
