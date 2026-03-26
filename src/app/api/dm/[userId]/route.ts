import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { DirectMessage } from "@/models/DirectMessage";
import { MessageRead } from "@/models/MessageRead";
import { Profile } from "@/models/Profile";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: me } = requireAuth(req);
    await connectDB();
    const { userId: other } = await params;
    const { searchParams } = new URL(req.url);
    const after = searchParams.get("after");

    const query: Record<string, unknown> = {
      $or: [
        { sender_id: me, recipient_id: other },
        { sender_id: other, recipient_id: me },
      ],
    };
    if (after) query.created_at = { $gt: new Date(after) };

    const messages = await DirectMessage.find(query)
      .sort({ created_at: 1 })
      .limit(100)
      .lean();

    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const senders = await Profile.find({ _id: { $in: senderIds } })
      .select("_id name avatar")
      .lean() as unknown as { _id: string; name: string; avatar?: string }[];
    const senderMap = Object.fromEntries(senders.map((s) => [s._id, s]));

    // Read receipts: who read each message
    const msgIds = messages.map((m) => m._id as string);
    const readEntries = await MessageRead.find({ message_id: { $in: msgIds } }).lean();
    const readerIds = [...new Set(readEntries.map((r) => r.user_id))];
    const readers = await Profile.find({ _id: { $in: readerIds } })
      .select("_id name avatar")
      .lean() as unknown as { _id: string; name: string; avatar?: string }[];
    const readerMap = Object.fromEntries(readers.map((r) => [r._id, r]));
    // Map: messageId → readers
    const readByMsg: Record<string, { id: string; name: string; avatar?: string }[]> = {};
    for (const entry of readEntries) {
      const r = readerMap[entry.user_id];
      if (!r) continue;
      if (!readByMsg[entry.message_id]) readByMsg[entry.message_id] = [];
      readByMsg[entry.message_id].push({ id: r._id, name: r.name, avatar: r.avatar });
    }

    return NextResponse.json(
      messages.map((m) => {
        const s = senderMap[m.sender_id];
        return {
          id: m._id,
          sender_id: m.sender_id,
          recipient_id: m.recipient_id,
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
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: me } = requireAuth(req);
    await connectDB();
    const { userId: other } = await params;
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    const dm = await DirectMessage.create({
      _id: randomUUID(),
      sender_id: me,
      recipient_id: other,
      content: content.trim(),
    });

    const sender = await Profile.findById(me).select("_id name avatar").lean() as unknown as { _id: string; name: string; avatar?: string } | null;

    return NextResponse.json({
      id: dm._id,
      sender_id: dm.sender_id,
      recipient_id: dm.recipient_id,
      content: dm.content,
      created_at: dm.created_at,
      sender: sender ? { id: sender._id, name: sender.name, avatar: sender.avatar } : null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
