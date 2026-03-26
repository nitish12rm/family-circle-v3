import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Profile } from "@/models/Profile";

function toProfile(p: Record<string, unknown>) {
  return {
    id: p._id,
    email: p.email,
    name: p.name,
    dob: p.dob,
    phone: p.phone,
    avatar: p.avatar,
    status: p.status,
    education: p.education,
    goals: p.goals,
    gender: p.gender,
    onboarding_complete: p.onboarding_complete,
    created_at: p.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const profile = await Profile.findById(userId).lean();
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toProfile(profile as Record<string, unknown>));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const body = await req.json();
    const allowed = ["name", "dob", "phone", "avatar", "status", "education", "goals", "gender", "onboarding_complete"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const profile = await Profile.findByIdAndUpdate(
      userId,
      { $set: { ...updates, updated_at: new Date() } },
      { new: true, lean: true }
    );
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toProfile(profile as Record<string, unknown>));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
