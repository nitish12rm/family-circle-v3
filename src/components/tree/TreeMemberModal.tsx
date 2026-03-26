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

interface FamilyMemberEntry {
  user_id: string;
  profile: { id: string; name: string; avatar?: string } | null;
}

interface Props {
  member: TreeMember | null;
  familyId: string;
  treeData: { members: TreeMember[]; relationships: TreeRelationship[] };
  isAdmin: boolean;
  currentUserId?: string;
  familyMembers: FamilyMemberEntry[];
  relLabel?: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdated: (member: TreeMember) => void;
  onRelDeleted: (relId: string) => void;
  onRelTypeChanged: (relId: string, newType: string) => void;
}

const GENDER_COLOR: Record<string, string> = {
  male: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  female: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  other: "bg-accent/20 text-accent border-accent/30",
};

// Human-readable label for a relationship from member → related
function chipLabel(type: string, gender?: string) {
  const m = gender === "male", f = gender === "female";
  if (type === "child")       return m ? "Father"      : f ? "Mother"      : "Parent";
  if (type === "step_child")  return m ? "Step-father" : f ? "Step-mother" : "Step-parent";
  if (type === "parent")      return m ? "Son"         : f ? "Daughter"    : "Child";
  if (type === "step_parent") return m ? "Step-son"    : f ? "Step-daughter" : "Step-child";
  if (type === "sibling")     return m ? "Brother"     : f ? "Sister"      : "Sibling";
  if (type === "spouse")      return m ? "Husband"     : f ? "Wife"        : "Partner";
  return type;
}

// Which type can a given rel be toggled to?
const TYPE_TOGGLE: Record<string, string> = {
  child: "step_child",
  step_child: "child",
  parent: "step_parent",
  step_parent: "parent",
};

// Section heading based on rel type from member's perspective
function sectionLabel(type: string) {
  if (type === "child" || type === "step_child") return "Parents";
  if (type === "parent" || type === "step_parent") return "Children";
  if (type === "sibling") return "Siblings";
  if (type === "spouse") return "Partner";
  return type;
}

interface RelEntry {
  relId: string;
  relType: string;
  member: TreeMember;
}

function RelChip({
  entry,
  canEdit,
  onRemove,
  onToggleType,
  removing,
  toggling,
}: {
  entry: RelEntry;
  canEdit: boolean;
  onRemove: () => void;
  onToggleType: () => void;
  removing: boolean;
  toggling: boolean;
}) {
  const label = chipLabel(entry.relType, entry.member.gender);
  const toggleTarget = TYPE_TOGGLE[entry.relType];
  const isStep = entry.relType.startsWith("step_");

  return (
    <div
      className={`flex items-center gap-1.5 border rounded-full px-2.5 py-1 ${
        isStep
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-bg-3 border-border"
      }`}
    >
      <Avatar name={entry.member.name} src={entry.member.photo} size={18} />
      <span className="text-xs text-text-muted">
        {label} · {entry.member.name}
      </span>
      {canEdit && toggleTarget && (
        <button
          onClick={onToggleType}
          disabled={toggling}
          title={`Change to ${TYPE_TOGGLE[entry.relType]?.replace("_", "-")}`}
          className="ml-0.5 text-text-faint hover:text-accent transition-colors disabled:opacity-40"
        >
          <Pencil size={10} />
        </button>
      )}
      {canEdit && (
        <button
          onClick={onRemove}
          disabled={removing}
          title="Remove this link"
          className="text-text-faint hover:text-error transition-colors disabled:opacity-40"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export default function TreeMemberModal({
  member,
  familyId,
  treeData,
  isAdmin,
  currentUserId,
  familyMembers,
  relLabel,
  onClose,
  onDelete,
  onUpdated,
  onRelDeleted,
  onRelTypeChanged,
}: Props) {
  const router = useRouter();
  const { showToast } = useUIStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingRelId, setRemovingRelId] = useState<string | null>(null);
  const [togglingRelId, setTogglingRelId] = useState<string | null>(null);
  const [linkProfileId, setLinkProfileId] = useState("");
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
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

  const handleRemoveRel = async (relId: string) => {
    setRemovingRelId(relId);
    try {
      await api.delete(`/api/families/${familyId}/tree/relationships?relId=${relId}`);
      onRelDeleted(relId);
      showToast("Link removed", "success");
    } catch {
      showToast("Failed to remove link", "error");
    } finally {
      setRemovingRelId(null);
    }
  };

  const handleToggleType = async (relId: string, newType: string) => {
    setTogglingRelId(relId);
    try {
      await api.patch(`/api/families/${familyId}/tree/relationships`, { relId, new_type: newType });
      onRelTypeChanged(relId, newType);
      showToast("Link updated", "success");
    } catch {
      showToast("Failed to update link", "error");
    } finally {
      setTogglingRelId(null);
    }
  };

  const handleLinkProfile = async () => {
    if (!member || !linkProfileId) return;
    setLinking(true);
    try {
      const updated = await api.patch<TreeMember>(
        `/api/families/${familyId}/tree?memberId=${member.id}`,
        { profile_id: linkProfileId, sync_profile: true }
      );
      onUpdated(updated);
      setLinkProfileId("");
      showToast("Profile linked and synced", "success");
    } catch {
      showToast("Failed to link profile", "error");
    } finally {
      setLinking(false);
    }
  };

  const handleSyncProfile = async () => {
    if (!member) return;
    setSyncing(true);
    try {
      const updated = await api.patch<TreeMember>(
        `/api/families/${familyId}/tree?memberId=${member.id}`,
        { sync_profile: true }
      );
      onUpdated(updated);
      showToast("Synced from profile", "success");
    } catch {
      showToast("Failed to sync", "error");
    } finally {
      setSyncing(false);
    }
  };

  if (!member) return null;

  const { members, relationships } = treeData;

  // Family members not yet linked to any tree node
  const linkedProfileIds = new Set(members.map((m) => m.profile_id).filter(Boolean));
  const unlinkedFamilyMembers = familyMembers.filter(
    (fm) => fm.profile && !linkedProfileIds.has(fm.user_id)
  );
  const find = (id: string) => members.find((m) => m.id === id);

  // My own tree member node (for permission check)
  const myMemberId = members.find((m) => m.profile_id === currentUserId)?.id;
  const canEditLinks = isAdmin || member.id === myMemberId;
  const canEditData = isAdmin || member.profile_id === currentUserId;

  // Build typed rel entries (include step types)
  const parentEntries: RelEntry[] = relationships
    .filter((r) => r.member_id === member.id && (r.type === "child" || r.type === "step_child"))
    .map((r) => ({ relId: r.id, relType: r.type, member: find(r.related_member_id)! }))
    .filter((e) => e.member);

  const spouseEntries: RelEntry[] = relationships
    .filter((r) => r.member_id === member.id && r.type === "spouse")
    .map((r) => ({ relId: r.id, relType: r.type, member: find(r.related_member_id)! }))
    .filter((e) => e.member);

  const childEntries: RelEntry[] = relationships
    .filter((r) => r.member_id === member.id && (r.type === "parent" || r.type === "step_parent"))
    .map((r) => ({ relId: r.id, relType: r.type, member: find(r.related_member_id)! }))
    .filter((e) => e.member);

  const siblingEntries: RelEntry[] = relationships
    .filter((r) => r.member_id === member.id && r.type === "sibling")
    .map((r) => ({ relId: r.id, relType: r.type, member: find(r.related_member_id)! }))
    .filter((e) => e.member);

  const hasRels = parentEntries.length > 0 || spouseEntries.length > 0 || childEntries.length > 0 || siblingEntries.length > 0;

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
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {relLabel && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                    {relLabel}
                  </span>
                )}
                {member.gender && (
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${
                      GENDER_COLOR[member.gender] ?? GENDER_COLOR.other
                    }`}
                  >
                    {member.gender}
                  </span>
                )}
              </div>
            </div>
            {/* Action buttons */}
            {canEditData && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={openEdit}
                  className="p-2 rounded-xl hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                  title="Edit details"
                >
                  <Pencil size={15} />
                </button>
                {(isAdmin || member.profile_id === currentUserId) && (
                  <button
                    onClick={() => { onDelete(member.id); onClose(); }}
                    className="p-2 rounded-xl hover:bg-bg-3 text-text-muted hover:text-error transition-colors"
                    title={member.profile_id === currentUserId ? "Remove yourself from tree" : "Delete"}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )}
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
          {hasRels && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              {[
                { label: sectionLabel("child"), entries: parentEntries },
                { label: sectionLabel("spouse"), entries: spouseEntries },
                { label: sectionLabel("parent"), entries: childEntries },
                { label: sectionLabel("sibling"), entries: siblingEntries },
              ].map(({ label, entries }) =>
                entries.length === 0 ? null : (
                  <div key={label} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-text-faint uppercase tracking-wide">
                      {label}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map((entry) => (
                        <RelChip
                          key={entry.relId}
                          entry={entry}
                          canEdit={canEditLinks}
                          onRemove={() => handleRemoveRel(entry.relId)}
                          onToggleType={() =>
                            handleToggleType(entry.relId, TYPE_TOGGLE[entry.relType])
                          }
                          removing={removingRelId === entry.relId}
                          toggling={togglingRelId === entry.relId}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}

              {canEditLinks && (
                <p className="text-[10px] text-text-faint mt-1">
                  Pencil icon changes parent ↔ step-parent · × removes the link
                </p>
              )}
            </div>
          )}

          {/* Admin: link an unlinked node to a family member's profile */}
          {isAdmin && !member.profile_id && unlinkedFamilyMembers.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="text-[11px] font-medium text-text-faint uppercase tracking-wide">
                Link to family member
              </span>
              <p className="text-xs text-text-faint">
                Connect this node to someone already in the group. Their name, photo and gender will be synced automatically.
              </p>
              <select
                value={linkProfileId}
                onChange={(e) => setLinkProfileId(e.target.value)}
                className="w-full bg-bg-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="">Select member…</option>
                {unlinkedFamilyMembers.map((fm) => (
                  <option key={fm.user_id} value={fm.user_id}>
                    {fm.profile!.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleLinkProfile}
                loading={linking}
                disabled={!linkProfileId}
                className="w-full"
              >
                Link &amp; Sync
              </Button>
            </div>
          )}

          {/* Admin: sync linked node from profile */}
          {isAdmin && member.profile_id && (
            <div className="border-t border-border pt-4">
              <Button
                onClick={handleSyncProfile}
                loading={syncing}
                className="w-full"
              >
                Sync from Profile
              </Button>
              <p className="text-[10px] text-text-faint text-center mt-1.5">
                Updates name, photo and gender from their account profile
              </p>
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
