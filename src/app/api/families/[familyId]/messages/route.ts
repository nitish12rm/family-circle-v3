import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Message } from "@/models/Message";
import { MessageRead } from "@/models/MessageRead";
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

    // Read receipts
    const msgIds = messages.map((m) => m._id as string);
    const readEntries = await MessageRead.find({ message_id: { $in: msgIds } }).lean();
    const readerIds = [...new Set(readEntries.map((r) => r.user_id))];
    const readers = await Profile.find({ _id: { $in: readerIds } })
      .select("_id name avatar")
      .lean() as unknown as { _id: string; name: string; avatar?: string }[];
    const readerMap = Object.fromEntries(readers.map((r) => [r._id, r]));
    const readByMsg: Record<string, { id: string; name: string; avatar?: string }[]> = {};
    for (const entry of readEntries) {
      const r = readerMap[entry.user_id];
      if (!r) continue;
      if (!readByMsg[entry.message_id]) readByMsg[entry.message_id] = [];
      readByMsg[entry.message_id].push({ id: r._id, name: r.name, avatar: r.avatar });
    }

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
          read_by: readByMsg[m._id as string] ?? [],
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
