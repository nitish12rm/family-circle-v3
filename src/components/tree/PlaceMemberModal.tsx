"use client";
import { useState, useEffect } from "react";
import { ChevronRight, Check, ArrowLeft } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import type { TreeMember, TreeRelationship } from "@/types";

type Step = "root" | "anchor" | "relation" | "preview";
type Relation = "child" | "parent" | "sibling" | "spouse";

const RELATIONS: {
  value: Relation;
  label: string;
  desc: string;
  emoji: string;
}[] = [
  { value: "child",   label: "Their child",   desc: "I am their son / daughter", emoji: "🧒" },
  { value: "parent",  label: "Their parent",  desc: "I am their father / mother", emoji: "🧑‍🦳" },
  { value: "sibling", label: "Their sibling", desc: "I am their brother / sister", emoji: "🧑‍🤝‍🧑" },
  { value: "spouse",  label: "Their spouse",  desc: "I am their partner",          emoji: "💍" },
];

interface TreeData {
  members: TreeMember[];
  relationships: TreeRelationship[];
}

interface Props {
  open: boolean;
  familyId: string;
  onComplete: () => void;
  onSkip: () => void;
}

// Compute a human-readable preview of what will happen on the server
function buildPreview(
  anchor: TreeMember,
  relation: Relation,
  data: TreeData
): { lines: string[]; placeholders: string[] } {
  const { members, relationships } = data;
  const lines: string[] = [];
  const placeholders: string[] = [];

  const find = (id: string) => members.find((m) => m.id === id);
  const rels = (memberId: string, type: string) =>
    relationships.filter((r) => r.member_id === memberId && r.type === type);

  if (relation === "child") {
    const spouseRel = rels(anchor.id, "spouse")[0];
    if (spouseRel) {
      const spouse = find(spouseRel.related_member_id);
      lines.push(`Linked as child of ${anchor.name} and ${spouse?.name ?? "their spouse"}.`);
    } else {
      lines.push(`Linked as child of ${anchor.name}.`);
      placeholders.push(`Unknown Parent — ${anchor.name}'s partner`);
    }

  } else if (relation === "parent") {
    const existingParents = rels(anchor.id, "child");
    lines.push(`Linked as parent of ${anchor.name}.`);
    if (existingParents.length === 0) {
      placeholders.push(`Unknown Parent — ${anchor.name}'s other parent`);
    } else if (existingParents.length === 1) {
      const other = find(existingParents[0].related_member_id);
      lines.push(`Set as spouse of ${other?.name ?? "existing parent"}.`);
    }

  } else if (relation === "sibling") {
    lines.push(`Linked as sibling of ${anchor.name}.`);
    const parentRels = rels(anchor.id, "child");
    if (parentRels.length > 0) {
      const names = parentRels.map((pr) => find(pr.related_member_id)?.name ?? "Unknown").join(" & ");
      lines.push(`Will share parents: ${names}.`);
    } else {
      placeholders.push(`Unknown Parent — shared with ${anchor.name}`);
    }

  } else if (relation === "spouse") {
    lines.push(`Linked as spouse of ${anchor.name}.`);
    const children = rels(anchor.id, "parent");
    if (children.length > 0) {
      const names = children.map((cr) => find(cr.related_member_id)?.name ?? "Unknown").join(", ");
      lines.push(`Also linked as parent of: ${names}.`);
    }
  }

  return { lines, placeholders };
}

export default function PlaceMemberModal({ open, familyId, onComplete, onSkip }: Props) {
  const { showToast } = useUIStore();
  const [step, setStep] = useState<Step>("anchor");
  const [treeData, setTreeData] = useState<TreeData>({ members: [], relationships: [] });
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState<TreeMember | null>(null);
  const [relation, setRelation] = useState<Relation | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<TreeData>(`/api/families/${familyId}/tree`)
      .then((data) => {
        setTreeData(data);
        if (data.members.filter((m) => !m.is_placeholder).length === 0) {
          setStep("root");
        }
      })
      .catch(() => {
        // On error, default to root placement so the modal stays visible
        setStep("root");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familyId]);

  const reset = () => {
    setStep("anchor");
    setAnchor(null);
    setRelation(null);
  };

  const handleClose = () => {
    reset();
    onSkip();
  };

  const handleConfirmRoot = async () => {
    setPlacing(true);
    try {
      await api.post(`/api/families/${familyId}/tree/place-member`, {
        anchor_member_id: null,
        relationship: null,
      });
      reset();
      showToast("You've been added to the family tree!", "success");
      onComplete();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to place in tree", "error");
    } finally {
      setPlacing(false);
    }
  };

  const handleConfirm = async () => {
    if (!anchor || !relation) return;
    setPlacing(true);
    try {
      await api.post(`/api/families/${familyId}/tree/place-member`, {
        anchor_member_id: anchor.id,
        relationship: relation,
      });
      reset();
      showToast("You've been placed in the family tree!", "success");
      onComplete();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to place in tree", "error");
    } finally {
      setPlacing(false);
    }
  };

  const selectableMembers = treeData.members.filter((m) => !m.is_placeholder);
  const preview = anchor && relation ? buildPreview(anchor, relation, treeData) : null;

  return (
    <Modal open={open} onClose={handleClose} title="Your place in the family tree">
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <>
          {/* ── Root: first member ────────────────────────────────── */}
          {step === "root" && (
            <div className="flex flex-col gap-4 items-center text-center">
              <div className="w-14 h-14 bg-accent-muted border border-accent/30 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🌱</span>
              </div>
              <div>
                <p className="text-sm font-medium text-text">You&apos;ll be the first person in this family tree.</p>
                <p className="text-xs text-text-muted mt-1">Others who join can connect to you from here.</p>
              </div>
              <Button onClick={handleConfirmRoot} loading={placing} className="w-full">
                <Check size={14} /> Add me to the tree
              </Button>
              <button
                onClick={handleClose}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >
                Skip — I&apos;ll do this later
              </button>
            </div>
          )}

          {/* ── Step 1: Pick anchor ───────────────────────────────── */}
          {step === "anchor" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">
                Who in this family are you most directly related to?
              </p>

              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto -mx-1 px-1">
                {selectableMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setAnchor(m);
                      setStep("relation");
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-bg-3 transition-colors text-left"
                  >
                    <Avatar name={m.name} src={m.photo} size={36} />
                    <span className="flex-1 text-sm font-medium text-text">{m.name}</span>
                    <ChevronRight size={14} className="text-text-muted" />
                  </button>
                ))}
              </div>

              <button
                onClick={handleClose}
                className="text-xs text-text-muted hover:text-text text-center mt-1 transition-colors"
              >
                Skip — I&apos;ll place myself later
              </button>
            </div>
          )}

          {/* ── Step 2: Pick relationship ─────────────────────────── */}
          {step === "relation" && anchor && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">
                How are you related to{" "}
                <span className="font-medium text-text">{anchor.name}</span>?
              </p>

              <div className="grid grid-cols-2 gap-2">
                {RELATIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      setRelation(r.value);
                      setStep("preview");
                    }}
                    className="flex flex-col items-center gap-2 p-4 bg-bg-3 hover:bg-bg-4 border border-border hover:border-accent rounded-2xl transition-all"
                  >
                    <span className="text-2xl">{r.emoji}</span>
                    <span className="text-sm font-semibold text-text">{r.label}</span>
                    <span className="text-[11px] text-text-muted text-center leading-tight">
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep("anchor")}
                className="flex items-center justify-center gap-1 text-xs text-text-muted hover:text-text mt-1 transition-colors"
              >
                <ArrowLeft size={12} /> Back
              </button>
            </div>
          )}

          {/* ── Step 3: Preview & confirm ─────────────────────────── */}
          {step === "preview" && anchor && relation && preview && (
            <div className="flex flex-col gap-4">
              {/* Summary card */}
              <div className="bg-bg-3 border border-border rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={anchor.name} src={anchor.photo} size={40} />
                  <div>
                    <p className="text-sm font-semibold text-text">{anchor.name}</p>
                    <p className="text-xs text-text-muted">
                      You are their{" "}
                      <span className="text-accent font-medium">{relation}</span>
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-3 flex flex-col gap-1.5">
                  {preview.lines.map((l, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-text-muted">
                      <Check size={12} className="text-success mt-0.5 shrink-0" />
                      {l}
                    </div>
                  ))}
                  {preview.placeholders.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-text-muted">
                      <span className="text-warning mt-0.5 shrink-0">⬡</span>
                      Placeholder added: <em>{p}</em>
                    </div>
                  ))}
                </div>
              </div>

              {preview.placeholders.length > 0 && (
                <p className="text-xs text-text-faint text-center -mt-1">
                  Placeholders can be edited or claimed by family members later.
                </p>
              )}

              <Button onClick={handleConfirm} loading={placing} className="w-full">
                <Check size={14} /> Confirm
              </Button>

              <button
                onClick={() => setStep("relation")}
                className="flex items-center justify-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
              >
                <ArrowLeft size={12} /> Change relationship
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
