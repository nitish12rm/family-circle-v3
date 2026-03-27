"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardList, Plus, ArrowRight, Calendar, Clock,
  CheckCircle2, CircleDot, Circle, ChevronDown, Send,
  Pencil, Trash2, X, Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import type { Assignment, AssignmentStatus, FamilyMember } from "@/types";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS: Record<AssignmentStatus, { label: string; icon: typeof Circle; bg: string; text: string; border: string }> = {
  yet_to_start: { label: "Yet to Start", icon: Circle,       bg: "bg-zinc-500/15",   text: "text-zinc-400",   border: "border-zinc-500/25" },
  in_progress:  { label: "In Progress",  icon: CircleDot,   bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/25" },
  finished:     { label: "Finished",     icon: CheckCircle2, bg: "bg-emerald-500/15",text: "text-emerald-400",border: "border-emerald-500/25" },
};

function StatusChip({ status, size = "sm" }: { status: AssignmentStatus; size?: "xs" | "sm" }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 font-medium border rounded-full ${s.bg} ${s.text} ${s.border} ${size === "xs" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"}`}>
      <Icon size={size === "xs" ? 9 : 11} strokeWidth={2} />
      {s.label}
    </span>
  );
}

function formatDeadline(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days < 0)  return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7)  return `Due in ${days}d`;
  return `Due ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

function toInputDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

// ─── Assignment card ──────────────────────────────────────────────────────────
function AssignmentCard({ a, currentUserId, onClick }: {
  a: Assignment; currentUserId: string; onClick: () => void;
}) {
  const isOverdue = a.deadline && a.status !== "finished" && new Date(a.deadline) < new Date();
  const latest = a.updates[a.updates.length - 1];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-2 border border-border rounded-2xl p-4 flex flex-col gap-3 hover:border-accent/30 transition-colors active:scale-[0.99]"
    >
      {/* Assigner → Assignee */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Avatar src={a.assigner?.avatar} name={a.assigner?.name} size={24} />
          <span className="text-xs text-text-muted font-medium">{a.assigner?.name ?? "?"}</span>
        </div>
        <ArrowRight size={12} className="text-text-faint shrink-0" />
        <div className="flex items-center gap-1.5">
          <Avatar src={a.assignee?.avatar} name={a.assignee?.name} size={24} />
          <span className="text-xs text-text-muted font-medium">{a.assignee?.name ?? "?"}</span>
        </div>
        <div className="ml-auto shrink-0">
          <StatusChip status={a.status} size="xs" />
        </div>
      </div>

      {/* Title & description */}
      <div>
        <p className="text-sm font-semibold text-text leading-snug">{a.title}</p>
        {a.description && (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">{a.description}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 flex-wrap">
        {a.deadline && (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? "text-red-400" : "text-text-faint"}`}>
            <Calendar size={10} />
            {formatDeadline(a.deadline)}
          </span>
        )}
        {latest && (
          <span className="flex items-center gap-1 text-[10px] text-text-faint">
            <Clock size={10} />
            <span className="truncate max-w-[180px]">"{latest.text}"</span>
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
function AssignmentDetail({
  a, currentUserId, familyId, onClose, onUpdate,
}: {
  a: Assignment; currentUserId: string; familyId: string;
  onClose: () => void; onUpdate: (updated: Partial<Assignment> & { id: string }) => void;
}) {
  const { showToast } = useUIStore();
  const [updateText, setUpdateText] = useState("");
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(a.title);
  const [editDesc, setEditDesc]   = useState(a.description);
  const [editDeadline, setEditDeadline] = useState(toInputDate(a.deadline));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const updateInputRef = useRef<HTMLInputElement>(null);

  const isAssigner = a.assigner_id === currentUserId;
  const isAssignee = a.assignee_id === currentUserId;
  const canAct     = isAssigner || isAssignee;
  const isOverdue  = a.deadline && a.status !== "finished" && new Date(a.deadline) < new Date();

  const handleStatusChange = async (status: AssignmentStatus) => {
    setStatusOpen(false);
    onUpdate({ id: a.id, status });
    try {
      await api.patch(`/api/assignments/${a.id}`, { status });
    } catch {
      onUpdate({ id: a.id, status: a.status });
      showToast("Failed to update status", "error");
    }
  };

  const handleSendUpdate = async () => {
    if (!updateText.trim()) return;
    setSendingUpdate(true);
    try {
      const u = await api.post<import("@/types").AssignmentUpdate>(`/api/assignments/${a.id}/updates`, { text: updateText.trim() });
      onUpdate({ id: a.id, updates: [...a.updates, u] });
      setUpdateText("");
    } catch {
      showToast("Failed to send update", "error");
    } finally {
      setSendingUpdate(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await api.patch<Partial<Assignment>>(`/api/assignments/${a.id}`, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        deadline: editDeadline || null,
      });
      onUpdate({ id: a.id, ...res });
      setEditing(false);
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this assignment?")) return;
    setDeleting(true);
    try {
      await api.delete(`/api/assignments/${a.id}`);
      onUpdate({ id: a.id, _deleted: true } as never);
      onClose();
    } catch {
      showToast("Failed to delete", "error");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">

      {/* Assigner → Assignee hero */}
      <div className="flex items-center justify-center gap-4 py-2">
        <div className="flex flex-col items-center gap-1.5">
          <Avatar src={a.assigner?.avatar} name={a.assigner?.name} size={44} />
          <span className="text-[11px] text-text-muted font-medium">{a.assigner?.name ?? "?"}</span>
          <span className="text-[9px] text-text-faint">assigner</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-0.5">
            <div className="w-6 h-px bg-border" />
            <ArrowRight size={14} className="text-accent" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Avatar src={a.assignee?.avatar} name={a.assignee?.name} size={44} />
          <span className="text-[11px] text-text-muted font-medium">{a.assignee?.name ?? "?"}</span>
          <span className="text-[9px] text-text-faint">assignee</span>
        </div>
      </div>

      {/* Title / edit */}
      {editing ? (
        <div className="flex flex-col gap-3 bg-bg-2 border border-border rounded-2xl p-3">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
            className="bg-transparent text-sm font-semibold text-text focus:outline-none border-b border-border pb-1"
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="bg-transparent text-sm text-text-muted focus:outline-none resize-none"
          />
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-text-faint">Deadline (optional)</label>
            <input
              type="date"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
              className="bg-bg border border-border rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}
              className="flex-1 py-2 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-40">
              {saving ? <Spinner size={14} /> : "Save"}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-xl border border-border text-sm text-text-muted">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-text">{a.title}</p>
          {a.description && <p className="text-sm text-text-muted leading-relaxed">{a.description}</p>}
          {a.deadline && (
            <span className={`inline-flex items-center gap-1 text-xs mt-1 ${isOverdue ? "text-red-400" : "text-text-faint"}`}>
              <Calendar size={11} /> {formatDeadline(a.deadline)} — {new Date(a.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
        </div>
      )}

      {/* Status selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold text-text-faint uppercase tracking-widest">Status</span>
        <div className="relative">
          <button
            onClick={() => canAct && setStatusOpen((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${STATUS[a.status].border} ${STATUS[a.status].bg} w-full`}
          >
            <StatusChip status={a.status} />
            {canAct && <ChevronDown size={13} className={`ml-auto text-text-muted transition-transform ${statusOpen ? "rotate-180" : ""}`} />}
          </button>
          {statusOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-bg-1 border border-border rounded-xl shadow-xl z-10 overflow-hidden">
              {(Object.keys(STATUS) as AssignmentStatus[]).map((s) => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-bg-2 transition-colors ${a.status === s ? "opacity-60" : ""}`}
                >
                  <StatusChip status={s} size="xs" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Updates timeline */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-text-faint uppercase tracking-widest">
          Updates {a.updates.length > 0 && `· ${a.updates.length}`}
        </span>
        {a.updates.length === 0 ? (
          <p className="text-xs text-text-faint py-2">No updates yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {[...a.updates].reverse().map((u) => (
              <div key={u.id} className="flex gap-2.5">
                <Avatar src={u.author?.avatar} name={u.author?.name} size={24} />
                <div className="flex-1 bg-bg-2 border border-border rounded-xl px-3 py-2">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[11px] font-semibold text-text">{u.author?.name ?? "?"}</span>
                    <span className="text-[9px] text-text-faint">
                      {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{u.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add update */}
        {canAct && (
          <div className="flex gap-2 mt-1">
            <input
              ref={updateInputRef}
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendUpdate()}
              placeholder="Drop an update…"
              className="flex-1 bg-bg-2 border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={handleSendUpdate}
              disabled={sendingUpdate || !updateText.trim()}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40 active:scale-95 transition-all shrink-0"
            >
              {sendingUpdate ? <Spinner size={14} /> : <Send size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      {canAct && !editing && (
        <div className="flex gap-2 pt-1 border-t border-border">
          <button onClick={() => setEditing(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-sm text-text-muted hover:text-text hover:bg-bg-2 transition-colors">
            <Pencil size={13} /> Edit
          </button>
          {isAssigner && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
              {deleting ? <Spinner size={13} /> : <Trash2 size={13} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────
function CreateAssignment({ familyId, members, currentUserId, onCreated, onClose }: {
  familyId: string; members: FamilyMember[]; currentUserId: string;
  onCreated: (a: Assignment) => void; onClose: () => void;
}) {
  const { showToast } = useUIStore();
  const [title, setTitle]         = useState("");
  const [description, setDesc]    = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [deadline, setDeadline]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const otherMembers = members.filter((m) => m.user_id !== currentUserId);

  const handleSubmit = async () => {
    if (!title.trim() || !assigneeId) return;
    setSubmitting(true);
    try {
      const a = await api.post<Assignment>(`/api/families/${familyId}/assignments`, {
        title: title.trim(), description: description.trim(),
        assignee_id: assigneeId, deadline: deadline || null,
      });
      onCreated(a);
      onClose();
      showToast("Assignment created", "success");
    } catch {
      showToast("Failed to create", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Assignee picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-text-faint uppercase tracking-widest">Assign to</label>
        <div className="flex gap-2 flex-wrap">
          {otherMembers.map((m) => {
            const active = assigneeId === m.user_id;
            return (
              <button key={m.user_id} onClick={() => setAssigneeId(active ? "" : m.user_id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${active ? "border-accent bg-accent/10 text-accent" : "border-border bg-bg-2 text-text-muted"}`}>
                <Avatar src={m.profile?.avatar} name={m.profile?.name} size={22} />
                <span className="text-xs font-medium">{m.profile?.name ?? "Member"}</span>
                {active && <Check size={11} strokeWidth={3} />}
              </button>
            );
          })}
          {otherMembers.length === 0 && (
            <p className="text-xs text-text-faint">No other members in this family.</p>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-text-faint uppercase tracking-widest">Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Fix the water pump"
          className="bg-bg-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors" />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-text-faint uppercase tracking-widest">Description</label>
        <textarea value={description} onChange={(e) => setDesc(e.target.value)}
          placeholder="Add details, context, or instructions…"
          rows={3}
          className="bg-bg-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors resize-none" />
      </div>

      {/* Deadline */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-text-faint uppercase tracking-widest">Deadline (optional)</label>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="bg-bg-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-accent transition-colors" />
      </div>

      <button onClick={handleSubmit} disabled={submitting || !title.trim() || !assigneeId}
        className="w-full py-3 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-all">
        {submitting ? <Spinner size={16} /> : "Create Assignment"}
      </button>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export default function AssignmentsView() {
  const { activeFamilyId } = useFamilyStore();
  const { profile } = useAuthStore();
  const { showToast } = useUIStore();
  const searchParams = useSearchParams();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers]         = useState<FamilyMember[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"for_me" | "by_me">("for_me");
  const [createOpen, setCreateOpen]   = useState(false);
  const [detailId, setDetailId]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeFamilyId) return;
    try {
      const [aData, mData] = await Promise.all([
        api.get<Assignment[]>(`/api/families/${activeFamilyId}/assignments`),
        api.get<FamilyMember[]>(`/api/families/${activeFamilyId}/members`),
      ]);
      setAssignments(aData);
      setMembers(mData);
    } catch {
      showToast("Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams]);

  const handleUpdate = (patch: Partial<Assignment> & { id: string } & { _deleted?: boolean }) => {
    if ((patch as { _deleted?: boolean })._deleted) {
      setAssignments((prev) => prev.filter((a) => a.id !== patch.id));
    } else {
      setAssignments((prev) => prev.map((a) =>
        a.id === patch.id ? { ...a, ...patch } : a
      ));
    }
  };

  const forMe = assignments.filter((a) => a.assignee_id === profile?.id);
  const byMe  = assignments.filter((a) => a.assigner_id === profile?.id);
  const shown = tab === "for_me" ? forMe : byMe;
  const detail = assignments.find((a) => a.id === detailId) ?? null;

  if (!activeFamilyId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-20 text-center">
        <p className="text-text-muted text-sm">No family selected.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <ClipboardList size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-text leading-none">Assignments</h1>
          <p className="text-[11px] text-text-faint mt-0.5">
            {assignments.length === 0 ? "Nothing yet" : `${forMe.length} for you · ${byMe.length} by you`}
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="w-8 h-8 rounded-xl bg-bg-2 border border-border flex items-center justify-center text-text-muted hover:text-accent hover:border-accent/40 transition-colors">
          <Plus size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-2 border border-border rounded-2xl p-1">
        {([["for_me", "For Me", forMe], ["by_me", "By Me", byMe]] as const).map(([id, label, list]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${tab === id ? "bg-bg-1 text-text shadow-sm" : "text-text-muted hover:text-text"}`}>
            {label}
            {list.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === id ? "bg-accent/15 text-accent" : "bg-bg text-text-faint"}`}>
                {list.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-bg-2 border border-border flex items-center justify-center mb-1">
            <ClipboardList size={22} className="text-text-faint" />
          </div>
          <p className="text-text-muted text-sm font-medium">
            {tab === "for_me" ? "Nothing assigned to you" : "You haven't assigned anything"}
          </p>
          <p className="text-text-faint text-xs">
            {tab === "for_me" ? "Assignments from others will appear here" : "Tap + to create your first assignment"}
          </p>
          {tab === "by_me" && (
            <button onClick={() => setCreateOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium">
              New Assignment
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((a) => (
            <AssignmentCard key={a.id} a={a} currentUserId={profile?.id ?? ""} onClick={() => setDetailId(a.id)} />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Assignment">
        <CreateAssignment
          familyId={activeFamilyId}
          members={members}
          currentUserId={profile?.id ?? ""}
          onCreated={(a) => setAssignments((prev) => [a, ...prev])}
          onClose={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title="Assignment">
        {detail && (
          <AssignmentDetail
            a={detail}
            currentUserId={profile?.id ?? ""}
            familyId={activeFamilyId}
            onClose={() => setDetailId(null)}
            onUpdate={handleUpdate}
          />
        )}
      </Modal>
    </div>
  );
}
