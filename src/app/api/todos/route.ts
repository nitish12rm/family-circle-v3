import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Todo } from "@/models/Todo";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const todos = await Todo.find({ user_id: userId }).sort({ created_at: -1 }).lean();
    return NextResponse.json(
      todos.map((t) => ({
        id: t._id,
        user_id: t.user_id,
        title: t.title,
        completed: t.completed,
        created_at: t.created_at,
      }))
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { title } = await req.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const todo = await Todo.create({
      _id: randomUUID(),
      user_id: userId,
      title: title.trim(),
    });
    return NextResponse.json({
      id: todo._id,
      user_id: todo.user_id,
      title: todo.title,
      completed: todo.completed,
      created_at: todo.created_at,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
