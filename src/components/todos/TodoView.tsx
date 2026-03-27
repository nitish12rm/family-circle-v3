"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Trash2, Pencil, X, CheckSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import Spinner from "@/components/ui/Spinner";
import type { Todo } from "@/types";

export default function TodoView() {
  const { showToast } = useUIStore();
  const searchParams = useSearchParams();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Todo[]>("/api/todos");
      setTodos(data);
    } catch {
      showToast("Failed to load todos", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Auto-focus when navigated from FAB with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [searchParams]);

  useEffect(() => {
    if (editId) setTimeout(() => editRef.current?.focus(), 50);
  }, [editId]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const todo = await api.post<Todo>("/api/todos", { title: newTitle.trim() });
      setTodos((prev) => [todo, ...prev]);
      setNewTitle("");
      showToast("Added!", "success");
    } catch {
      showToast("Failed to add", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (todo: Todo) => {
    const updated = { ...todo, completed: !todo.completed };
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    try {
      await api.patch(`/api/todos/${todo.id}`, { completed: updated.completed });
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
      showToast("Failed to update", "error");
    }
  };

  const handleEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    const prev = todos.find((t) => t.id === id);
    setTodos((prevT) => prevT.map((t) => (t.id === id ? { ...t, title: editTitle.trim() } : t)));
    setEditId(null);
    try {
      await api.patch(`/api/todos/${id}`, { title: editTitle.trim() });
    } catch {
      if (prev) setTodos((prevT) => prevT.map((t) => (t.id === id ? prev : t)));
      showToast("Failed to update", "error");
    }
  };

  const handleDelete = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.delete(`/api/todos/${id}`);
    } catch {
      showToast("Failed to delete", "error");
      load();
    }
  };

  const pending = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-text">My To-Do</h1>
        {todos.length > 0 && (
          <span className="ml-auto text-xs text-text-faint">
            {done.length}/{todos.length} done
          </span>
        )}
      </div>

      {/* Add input */}
      <div className="flex gap-2 mb-5">
        <input
          ref={inputRef}
          type="text"
          placeholder="Add a new task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTitle.trim()}
          className="px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          {adding ? <Spinner size={14} /> : "Add"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : todos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-sm">No tasks yet.</p>
          <p className="text-text-faint text-xs mt-1">Add something above to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Pending */}
          {pending.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {pending.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  editId={editId}
                  editTitle={editTitle}
                  editRef={editRef}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onStartEdit={(t) => { setEditId(t.id); setEditTitle(t.title); }}
                  onEditChange={setEditTitle}
                  onEditSubmit={handleEdit}
                  onEditCancel={() => setEditId(null)}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {done.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-medium text-text-faint uppercase tracking-wide px-1 mb-0.5">Completed</p>
              {done.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  editId={editId}
                  editTitle={editTitle}
                  editRef={editRef}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onStartEdit={(t) => { setEditId(t.id); setEditTitle(t.title); }}
                  onEditChange={setEditTitle}
                  onEditSubmit={handleEdit}
                  onEditCancel={() => setEditId(null)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TodoItem({
  todo, editId, editTitle, editRef, onToggle, onDelete, onStartEdit, onEditChange, onEditSubmit, onEditCancel,
}: {
  todo: Todo;
  editId: string | null;
  editTitle: string;
  editRef: React.RefObject<HTMLInputElement | null>;
  onToggle: (t: Todo) => void;
  onDelete: (id: string) => void;
  onStartEdit: (t: Todo) => void;
  onEditChange: (v: string) => void;
  onEditSubmit: (id: string) => void;
  onEditCancel: () => void;
}) {
  const isEditing = editId === todo.id;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${todo.completed ? "bg-bg-2/40 border-border/50" : "bg-bg-2 border-border"}`}>
      <button
        onClick={() => onToggle(todo)}
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${todo.completed ? "bg-accent border-accent" : "border-border hover:border-accent"}`}
      >
        {todo.completed && <Check size={11} strokeWidth={3} className="text-white" />}
      </button>

      {isEditing ? (
        <input
          ref={editRef}
          value={editTitle}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSubmit(todo.id);
            if (e.key === "Escape") onEditCancel();
          }}
          className="flex-1 bg-transparent text-sm text-text focus:outline-none border-b border-accent"
        />
      ) : (
        <span
          className={`flex-1 text-sm leading-snug select-none ${todo.completed ? "line-through text-text-faint" : "text-text"}`}
          onDoubleClick={() => !todo.completed && onStartEdit(todo)}
        >
          {todo.title}
        </span>
      )}

      {isEditing ? (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEditSubmit(todo.id)} className="p-1 rounded-lg text-accent hover:bg-accent/10 transition-colors">
            <Check size={14} />
          </button>
          <button onClick={onEditCancel} className="p-1 rounded-lg text-text-muted hover:bg-bg transition-colors">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {!todo.completed && (
            <button onClick={() => onStartEdit(todo)} className="p-1 rounded-lg text-text-faint hover:text-text hover:bg-bg transition-colors">
              <Pencil size={13} />
            </button>
          )}
          <button onClick={() => onDelete(todo.id)} className="p-1 rounded-lg text-text-faint hover:text-error hover:bg-error/10 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
