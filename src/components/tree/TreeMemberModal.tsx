"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ExternalLink, Save, X, Pencil } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import type { TreeMember, TreeRelationship } from "@/types";

interface Props {
  member: TreeMember | null;
  familyId: string;
  treeData: { members: TreeMember[]; relationships: TreeRelationship[] };
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdated: (member: TreeMember) => void;
}

const GENDER_COLOR: Record<string, string> = {
  male: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  female: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  other: "bg-accent/20 text-accent border-accent/30",
};

function relLabel(type: "parent" | "child" | "spouse" | "sibling", gender?: string) {
  const m = gender === "male", f = gender === "female";
  if (type === "parent")  return m ? "Father" : f ? "Mother" : "Parent";
  if (type === "child")   return m ? "Son"    : f ? "Daughter" : "Child";
  if (type === "sibling") return m ? "Brother": f ? "Sister" : "Sibling";
  if (type === "spouse")  return m ? "Husband": f ? "Wife" : "Partner";
  return type;
}

function RelChip({ name, photo, label }: { name: string; photo?: string; label?: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-bg-3 border border-border rounded-full px-2.5 py-1">
      <Avatar name={name} src={photo} size={18} />
      <span className="text-xs text-text-muted">{label ? `${label} · ` : ""}{name}</span>
    </div>
  );
}

export default function TreeMemberModal({
  member,
  familyId,
  treeData,
  onClose,
  onDelete,
  onUpdated,
}: Props) {
  const router = useRouter();
  const { showToast } = useUIStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    dob: "",
    dod: "",
    gender: "",
    status: "",
    notes: "",
  });

  const openEdit = () => {
    if (!member) return;
    setForm({
      name: member.name,
      dob: member.dob ?? "",
      dod: member.dod ?? "",
      gender: member.gender ?? "",
      status: member.status ?? "",
      notes: member.notes ?? "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    try {
      const updated = await api.patch<TreeMember>(
        `/api/families/${familyId}/tree?memberId=${member.id}`,
        form
      );
      onUpdated(updated);
      setEditing(false);
      showToast("Saved", "success");
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  const { members, relationships } = treeData;
  const find = (id: string) => members.find((m) => m.id === id);

  const parents = relationships
    .filter((r) => r.member_id === member.id && r.type === "child")
    .map((r) => find(r.related_member_id))
    .filter(Boolean) as TreeMember[];

  const spouses = relationships
    .filter((r) => r.member_id === member.id && r.type === "spouse")
    .map((r) => find(r.related_member_id))
    .filter(Boolean) as TreeMember[];

  const children = relationships
    .filter((r) => r.member_id === member.id && r.type === "parent")
    .map((r) => find(r.related_member_id))
    .filter(Boolean) as TreeMember[];

  const siblings = relationships
    .filter((r) => r.member_id === member.id && r.type === "sibling")
    .map((r) => find(r.related_member_id))
    .filter(Boolean) as TreeMember[];

  return (
    <Modal open={!!member} onClose={onClose} title="Family Member">
      {editing ? (
        /* ── Edit mode ─────────────────────────────────── */
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors self-start"
          >
            <X size={13} /> Cancel edit
          </button>
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date of Birth"
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
            <Input
              label="Date of Death"
              type="date"
              value={form.dod}
              onChange={(e) => setForm({ ...form, dod: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-muted">Gender</label>
            <div className="flex gap-2">
              {["male", "female", "other"].map((g) => (
                <button
                  key={g}
                  onClick={() => setForm({ ...form, gender: g })}
                  className={`flex-1 py-2 text-sm rounded-xl border transition-all capitalize ${
                    form.gender === g
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border bg-bg-3 text-text-muted"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Status / Bio"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button onClick={handleSave} loading={saving} className="w-full">
            <Save size={14} /> Save Changes
          </Button>
        </div>
      ) : (
        /* ── View mode ─────────────────────────────────── */
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Avatar name={member.name} src={member.photo} size={56} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-text">{member.name}</h2>
                {member.is_deceased && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-text-faint/20 text-text-faint border border-text-faint/20">
                    Deceased
                  </span>
                )}
              </div>
              {member.gender && (
                <span
                  className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize mt-1 ${
                    GENDER_COLOR[member.gender] ?? GENDER_COLOR.other
                  }`}
                >
                  {member.gender}
                </span>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex gap-1 shrink-0">
              <button
                onClick={openEdit}
                className="p-2 rounded-xl hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => { onDelete(member.id); onClose(); }}
                className="p-2 rounded-xl hover:bg-bg-3 text-text-muted hover:text-error transition-colors"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* Info rows */}
          <div className="flex flex-col gap-2">
            {member.dob && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-faint w-20 shrink-0">Born</span>
                <span className="text-sm text-text">{member.dob}</span>
              </div>
            )}
            {member.dod && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-faint w-20 shrink-0">Died</span>
                <span className="text-sm text-text">{member.dod}</span>
              </div>
            )}
            {member.status && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-text-faint w-20 shrink-0 mt-0.5">Status</span>
                <span className="text-sm text-text">{member.status}</span>
              </div>
            )}
            {member.notes && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-text-faint w-20 shrink-0 mt-0.5">Notes</span>
                <span className="text-sm text-text-muted">{member.notes}</span>
              </div>
            )}
          </div>

          {/* Relationships */}
          {(parents.length > 0 || spouses.length > 0 || children.length > 0 || siblings.length > 0) && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              {parents.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-text-faint uppercase tracking-wide">
                    {parents.length === 1 ? relLabel("parent", parents[0].gender) : "Parents"}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {parents.map((p) => (
                      <RelChip key={p.id} name={p.name} photo={p.photo} label={relLabel("parent", p.gender)} />
                    ))}
                  </div>
                </div>
              )}
              {spouses.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-text-faint uppercase tracking-wide">
                    {relLabel("spouse", spouses[0].gender)}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {spouses.map((s) => (
                      <RelChip key={s.id} name={s.name} photo={s.photo} />
                    ))}
                  </div>
                </div>
              )}
              {children.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-text-faint uppercase tracking-wide">Children</span>
                  <div className="flex flex-wrap gap-1.5">
                    {children.map((c) => (
                      <RelChip key={c.id} name={c.name} photo={c.photo} label={relLabel("child", c.gender)} />
                    ))}
                  </div>
                </div>
              )}
              {siblings.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-text-faint uppercase tracking-wide">Siblings</span>
                  <div className="flex flex-wrap gap-1.5">
                    {siblings.map((s) => (
                      <RelChip key={s.id} name={s.name} photo={s.photo} label={relLabel("sibling", s.gender)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* View Profile link */}
          {member.profile_id && !member.is_placeholder && (
            <button
              onClick={() => { onClose(); router.push(`/profile/${member.profile_id}`); }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-accent/40 bg-accent-muted text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
            >
              <ExternalLink size={14} /> View Full Profile
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
