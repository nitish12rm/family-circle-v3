import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { Todo } from "@/models/Todo";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { todoId } = await params;
    const { title, completed } = await req.json();

    const todo = await Todo.findById(todoId);
    if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (todo.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (title !== undefined) todo.title = title.trim();
    if (completed !== undefined) todo.completed = completed;
    await todo.save();

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { todoId } = await params;

    const todo = await Todo.findById(todoId);
    if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (todo.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await todo.deleteOne();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
