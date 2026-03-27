import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Profile } from "@/models/Profile";

/** POST /api/profile/fcm-token — add a token (upsert, max 5 per user) */
export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }
    // Add token if not already present; keep at most 5 (oldest dropped)
    await Profile.updateOne(
      { _id: userId },
      [
        {
          $set: {
            fcm_tokens: {
              $slice: [
                { $setUnion: [{ $ifNull: ["$fcm_tokens", []] }, [token]] },
                -5,
              ],
            },
          },
        },
      ]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** DELETE /api/profile/fcm-token — remove a stale token */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
    await Profile.updateOne({ _id: userId }, { $pull: { fcm_tokens: token } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
