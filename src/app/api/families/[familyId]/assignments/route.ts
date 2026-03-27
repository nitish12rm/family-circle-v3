import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Assignment } from "@/models/Assignment";
import { Profile } from "@/models/Profile";
import { randomUUID } from "crypto";
import { createNotification } from "@/lib/createNotification";

type ProfileLean = { _id: string; name: string; avatar?: string };

function shape(a: Record<string, unknown>, profileMap: Record<string, ProfileLean>) {
  const asgn = a as {
    _id: string; family_id: string; title: string; description: string;
    assigner_id: string; assignee_id: string; deadline: Date | null;
    status: string; updates: { _id: string; user_id: string; text: string; created_at: Date }[];
    created_at: Date; updated_at: Date;
  };
  return {
    id: asgn._id,
    family_id: asgn.family_id,
    title: asgn.title,
    description: asgn.description,
    assigner_id: asgn.assigner_id,
    assignee_id: asgn.assignee_id,
    deadline: asgn.deadline ?? null,
    status: asgn.status,
    updates: (asgn.updates ?? []).map((u) => {
      const p = profileMap[u.user_id];
      return { id: u._id, user_id: u.user_id, text: u.text, created_at: u.created_at,
        author: p ? { id: p._id, name: p.name, avatar: p.avatar } : null };
    }),
    created_at: asgn.created_at,
    updated_at: asgn.updated_at,
    assigner: profileMap[asgn.assigner_id]
      ? { id: profileMap[asgn.assigner_id]._id, name: profileMap[asgn.assigner_id].name, avatar: profileMap[asgn.assigner_id].avatar }
      : null,
    assignee: profileMap[asgn.assignee_id]
      ? { id: profileMap[asgn.assignee_id]._id, name: profileMap[asgn.assignee_id].name, avatar: profileMap[asgn.assignee_id].avatar }
      : null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;

    // Return assignments where user is assigner or assignee
    const assignments = await Assignment.find({
      family_id: familyId,
      $or: [{ assigner_id: userId }, { assignee_id: userId }],
    }).sort({ created_at: -1 }).lean() as unknown as Record<string, unknown>[];

    const userIds = [...new Set(
      assignments.flatMap((a) => {
        const x = a as { assigner_id: string; assignee_id: string; updates?: { user_id: string }[] };
        return [x.assigner_id, x.assignee_id, ...(x.updates ?? []).map((u) => u.user_id)];
      })
    )];

    const profiles = await Profile.find({ _id: { $in: userIds } })
      .select("_id name avatar").lean() as unknown as ProfileLean[];
    const profileMap = Object.fromEntries(profiles.map((p) => [p._id, p]));

    return NextResponse.json(assignments.map((a) => shape(a, profileMap)));
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
    const { title, description, assignee_id, deadline } = await req.json();

    if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
    if (!assignee_id)   return NextResponse.json({ error: "Assignee required" }, { status: 400 });

    const a = await Assignment.create({
      _id: randomUUID(),
      family_id: familyId,
      title: title.trim(),
      description: description?.trim() ?? "",
      assigner_id: userId,
      assignee_id,
      deadline: deadline ? new Date(deadline) : null,
    });

    const profiles = await Profile.find({ _id: { $in: [userId, assignee_id] } })
      .select("_id name avatar").lean() as unknown as ProfileLean[];
    const profileMap = Object.fromEntries(profiles.map((p) => [p._id, p]));

    // Fire-and-forget: notify assignee of new assignment
    createNotification({
      recipientIds: [assignee_id],
      actorId: userId,
      type: "new_assignment",
      entityId: a._id as string,
      familyId,
      meta: { title: title.trim() },
    }).catch(() => {});

    return NextResponse.json(shape(a.toObject() as Record<string, unknown>, profileMap));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
