import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Message } from "@/models/Message";
import { Profile } from "@/models/Profile";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const after = searchParams.get("after");

    const query: Record<string, unknown> = { family_id: familyId };
    if (after) query.created_at = { $gt: new Date(after) };

    const messages = await Message.find(query)
      .sort({ created_at: 1 })
      .limit(limit)
      .lean();

    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const senders = await Profile.find({ _id: { $in: senderIds } })
      .select("_id name avatar")
      .lean();
    const senderMap = Object.fromEntries(senders.map((s) => [s._id, s]));

    return NextResponse.json(
      messages.map((m) => {
        const s = senderMap[m.sender_id] as Record<string, unknown> | undefined;
        return {
          id: m._id,
          family_id: m.family_id,
          sender_id: m.sender_id,
          content: m.content,
          created_at: m.created_at,
          sender: s ? { id: s._id, name: s.name, avatar: s.avatar } : null,
        };
      })
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
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const message = await Message.create({
      _id: randomUUID(),
      family_id: familyId,
      sender_id: userId,
      content: content.trim(),
    });

    const sender = await Profile.findById(userId)
      .select("_id name avatar")
      .lean() as Record<string, unknown> | null;

    return NextResponse.json({
      id: message._id,
      family_id: message.family_id,
      sender_id: message.sender_id,
      content: message.content,
      created_at: message.created_at,
      sender: sender ? { id: sender._id, name: sender.name, avatar: sender.avatar } : null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
