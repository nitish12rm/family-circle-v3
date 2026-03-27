"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Trash2, Pencil, X, ListTodo } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import Spinner from "@/components/ui/Spinner";
import type { Todo } from "@/types";

export default function TodoView() {
  const { showToast } = useUIStore();
  const searchParams = useSearchParams();
  const [todos, setTodos]     = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding]   = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef  = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (searchParams.get("new") === "1") setTimeout(() => inputRef.current?.focus(), 150);
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
    } catch {
      showToast("Failed to add", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (todo: Todo) => {
    const next = { ...todo, completed: !todo.completed };
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? next : t)));
    try {
      await api.patch(`/api/todos/${todo.id}`, { completed: next.completed });
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
      showToast("Failed to update", "error");
    }
  };

  const handleEditSave = async (id: string) => {
    if (!editTitle.trim()) { setEditId(null); return; }
    const prev = todos.find((t) => t.id === id);
    setTodos((p) => p.map((t) => (t.id === id ? { ...t, title: editTitle.trim() } : t)));
    setEditId(null);
    try {
      await api.patch(`/api/todos/${id}`, { title: editTitle.trim() });
    } catch {
      if (prev) setTodos((p) => p.map((t) => (t.id === id ? prev : t)));
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
  const done    = todos.filter((t) => t.completed);
  const pct     = todos.length > 0 ? Math.round((done.length / todos.length) * 100) : 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
          <ListTodo size={18} className="text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-text leading-none">My To-Do</h1>
          <p className="text-[11px] text-text-faint mt-0.5">
            {todos.length === 0 ? "Nothing here yet" : `${done.length} of ${todos.length} completed`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {todos.length > 0 && (
        <div className="bg-bg-2 rounded-2xl p-3 border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">Progress</span>
            <span className="font-semibold text-text">{pct}%</span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Add input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Add a new task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 bg-bg-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-purple-500/60 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTitle.trim()}
          className="px-4 py-2.5 bg-purple-500 text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-opacity active:scale-95 shrink-0"
        >
          {adding ? <Spinner size={14} /> : "Add"}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : todos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-bg-2 border border-border flex items-center justify-center mb-1">
            <ListTodo size={22} className="text-text-faint" />
          </div>
          <p className="text-text-muted text-sm font-medium">No tasks yet</p>
          <p className="text-text-faint text-xs">Add your first task above to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Pending */}
          {pending.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold text-text-faint uppercase tracking-widest px-0.5">
                Tasks · {pending.length}
              </span>
              <div className="flex flex-col gap-1.5">
                {pending.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    isEditing={editId === todo.id}
                    editTitle={editTitle}
                    editRef={editRef}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onStartEdit={(t) => { setEditId(t.id); setEditTitle(t.title); }}
                    onEditChange={setEditTitle}
                    onEditSave={handleEditSave}
                    onEditCancel={() => setEditId(null)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {done.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold text-text-faint uppercase tracking-widest px-0.5">
                Done · {done.length}
              </span>
              <div className="flex flex-col gap-1.5">
                {done.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    isEditing={editId === todo.id}
                    editTitle={editTitle}
                    editRef={editRef}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onStartEdit={(t) => { setEditId(t.id); setEditTitle(t.title); }}
                    onEditChange={setEditTitle}
                    onEditSave={handleEditSave}
                    onEditCancel={() => setEditId(null)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TodoItem({
  todo, isEditing, editTitle, editRef,
  onToggle, onDelete, onStartEdit, onEditChange, onEditSave, onEditCancel,
}: {
  todo: Todo;
  isEditing: boolean;
  editTitle: string;
  editRef: React.RefObject<HTMLInputElement | null>;
  onToggle: (t: Todo) => void;
  onDelete: (id: string) => void;
  onStartEdit: (t: Todo) => void;
  onEditChange: (v: string) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl border transition-colors ${
      todo.completed
        ? "bg-bg-2/30 border-border/40"
        : "bg-bg-2 border-border"
    }`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo)}
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
          todo.completed
            ? "bg-purple-500 border-purple-500"
            : "border-border hover:border-purple-400"
        }`}
      >
        {todo.completed && <Check size={10} strokeWidth={3.5} className="text-white" />}
      </button>

      {/* Title / edit input */}
      {isEditing ? (
        <input
          ref={editRef}
          value={editTitle}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSave(todo.id);
            if (e.key === "Escape") onEditCancel();
          }}
          className="flex-1 bg-transparent text-sm text-text focus:outline-none border-b border-purple-500/60 pb-0.5"
        />
      ) : (
        <span className={`flex-1 text-sm leading-snug ${
          todo.completed ? "line-through text-text-faint" : "text-text"
        }`}>
          {todo.title}
        </span>
      )}

      {/* Actions */}
      {isEditing ? (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEditSave(todo.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-purple-400 hover:bg-purple-500/10 transition-colors"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={onEditCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-bg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1 shrink-0">
          {!todo.completed && (
            <button
              onClick={() => onStartEdit(todo)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-faint hover:text-text hover:bg-bg transition-colors"
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            onClick={() => onDelete(todo.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-faint hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
