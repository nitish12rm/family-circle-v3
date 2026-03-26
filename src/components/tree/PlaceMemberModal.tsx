"use client";
import { useState, useEffect } from "react";
import { ChevronRight, Check, ArrowLeft } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import type { TreeMember, TreeRelationship } from "@/types";

type Step = "root" | "anchor" | "category" | "relation" | "preview";
type RelCategory = "immediate" | "extended" | "distant";
type Relation =
  | "child" | "parent" | "sibling" | "spouse"
  | "uncle_aunt" | "niece_nephew" | "cousin"
  | "2nd_cousin" | "3rd_cousin"
  | "none";

const CATEGORIES: {
  value: RelCategory;
  emoji: string;
  title: string;
  subtitle: string;
  examples: string[];
}[] = [
  {
    value: "immediate",
    emoji: "👨‍👩‍👧",
    title: "Immediate Family",
    subtitle: "You live or grew up together",
    examples: ["Parent", "Child", "Brother / Sister", "Husband / Wife"],
  },
  {
    value: "extended",
    emoji: "👪",
    title: "Extended Family",
    subtitle: "Related but not in the same household",
    examples: ["Uncle / Aunt", "Niece / Nephew", "1st Cousin"],
  },
  {
    value: "distant",
    emoji: "🌐",
    title: "Distant Relative",
    subtitle: "Share a common ancestor further back",
    examples: ["2nd Cousin", "3rd Cousin or beyond"],
  },
];

function getRelationsByCategory(
  category: RelCategory,
  gender?: string
): { value: Relation; label: string; desc: string; emoji: string }[] {
  const m = gender === "male";
  const f = gender === "female";

  if (category === "immediate") {
    return [
      {
        value: "child",
        label: m ? "Their son" : f ? "Their daughter" : "Their child",
        desc: m ? "I am their son" : f ? "I am their daughter" : "I am their child",
        emoji: m ? "👦" : f ? "👧" : "🧒",
      },
      {
        value: "parent",
        label: m ? "Their father" : f ? "Their mother" : "Their parent",
        desc: m ? "I am their father" : f ? "I am their mother" : "I am their parent",
        emoji: m ? "👨" : f ? "👩" : "🧑‍🦳",
      },
      {
        value: "sibling",
        label: m ? "Their brother" : f ? "Their sister" : "Their sibling",
        desc: m ? "I am their brother" : f ? "I am their sister" : "I am their sibling",
        emoji: m ? "👱‍♂️" : f ? "👱‍♀️" : "🧑‍🤝‍🧑",
      },
      {
        value: "spouse",
        label: m ? "Their husband" : f ? "Their wife" : "Their spouse",
        desc: m ? "I am their husband" : f ? "I am their wife" : "I am their partner",
        emoji: m ? "🤵" : f ? "👰" : "💍",
      },
    ];
  }

  if (category === "extended") {
    return [
      {
        value: "uncle_aunt",
        label: m ? "Their uncle" : f ? "Their aunt" : "Their uncle / aunt",
        desc: "I am a sibling of their parent",
        emoji: m ? "👨‍🦳" : f ? "👩‍🦳" : "🧓",
      },
      {
        value: "niece_nephew",
        label: m ? "Their nephew" : f ? "Their niece" : "Their niece / nephew",
        desc: "I am a child of their sibling",
        emoji: m ? "👦" : f ? "👧" : "🧒",
      },
      {
        value: "cousin",
        label: "1st Cousin",
        desc: "Our parents are siblings",
        emoji: "🤝",
      },
    ];
  }

  // distant
  return [
    {
      value: "2nd_cousin",
      label: "2nd Cousin",
      desc: "Our grandparents are siblings",
      emoji: "🔗",
    },
    {
      value: "3rd_cousin",
      label: "3rd Cousin / Distant",
      desc: "Our great-grandparents are siblings",
      emoji: "🌐",
    },
  ];
}

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
      lines.push(`Linked as child of ${anchor.name} and ${find(spouseRel.related_member_id)?.name ?? "their spouse"}.`);
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
      lines.push(`Set as spouse of ${find(existingParents[0].related_member_id)?.name ?? "existing parent"}.`);
    }
  } else if (relation === "sibling") {
    lines.push(`Linked as sibling of ${anchor.name}.`);
    const parentRels = rels(anchor.id, "child");
    if (parentRels.length > 0) {
      lines.push(`Will share parents: ${parentRels.map((pr) => find(pr.related_member_id)?.name ?? "Unknown").join(" & ")}.`);
    } else {
      placeholders.push(`Unknown Parent — shared with ${anchor.name}`);
    }
  } else if (relation === "spouse") {
    lines.push(`Linked as spouse of ${anchor.name}.`);
    const children = rels(anchor.id, "parent");
    if (children.length > 0) {
      lines.push(`Also linked as parent of: ${children.map((cr) => find(cr.related_member_id)?.name ?? "Unknown").join(", ")}.`);
    }
  } else if (relation === "uncle_aunt") {
    const parentRels = rels(anchor.id, "child");
    if (parentRels.length > 0) {
      lines.push(`Linked as sibling of ${anchor.name}'s parent (${find(parentRels[0].related_member_id)?.name ?? "existing parent"}).`);
    } else {
      lines.push(`Linked as sibling of ${anchor.name}'s parent.`);
      placeholders.push(`Unknown Parent — ${anchor.name}'s parent`);
    }
  } else if (relation === "niece_nephew") {
    lines.push(`Linked as child of ${anchor.name}'s sibling.`);
    placeholders.push(`Unknown Parent — sibling of ${anchor.name}`);
  } else if (relation === "cousin") {
    const parentRels = rels(anchor.id, "child");
    lines.push(`Linked as 1st cousin of ${anchor.name} (parents are siblings).`);
    placeholders.push("Unknown Parent — your parent");
    if (parentRels.length === 0) placeholders.push(`Unknown Parent — ${anchor.name}'s parent`);
  } else if (relation === "2nd_cousin") {
    const parentRels = rels(anchor.id, "child");
    lines.push(`Linked as 2nd cousin of ${anchor.name} (grandparents are siblings).`);
    placeholders.push("Unknown Grandparent — your grandparent");
    placeholders.push("Unknown Parent — your parent");
    if (parentRels.length > 0) {
      if (rels(parentRels[0].related_member_id, "child").length === 0)
        placeholders.push(`Unknown Grandparent — ${anchor.name}'s grandparent`);
    } else {
      placeholders.push(`Unknown Parent — ${anchor.name}'s parent`);
      placeholders.push(`Unknown Grandparent — ${anchor.name}'s grandparent`);
    }
  } else if (relation === "3rd_cousin") {
    const parentRels = rels(anchor.id, "child");
    lines.push(`Linked as 3rd cousin of ${anchor.name} (great-grandparents are siblings).`);
    placeholders.push("Unknown Great-Grandparent — your side");
    placeholders.push("Unknown Grandparent — your side");
    placeholders.push("Unknown Parent — your side");
    if (parentRels.length === 0) {
      placeholders.push(`Unknown Parent — ${anchor.name}'s side`);
      placeholders.push(`Unknown Grandparent — ${anchor.name}'s side`);
      placeholders.push(`Unknown Great-Grandparent — ${anchor.name}'s side`);
    } else {
      const gp = rels(parentRels[0].related_member_id, "child");
      if (gp.length === 0) {
        placeholders.push(`Unknown Grandparent — ${anchor.name}'s side`);
        placeholders.push(`Unknown Great-Grandparent — ${anchor.name}'s side`);
      } else if (rels(gp[0].related_member_id, "child").length === 0) {
        placeholders.push(`Unknown Great-Grandparent — ${anchor.name}'s side`);
      }
    }
  } else if (relation === "none") {
    lines.push("Added to the tree without a direct connection.");
    lines.push("You or another member can link you to others later.");
  }

  return { lines, placeholders };
}

// Step breadcrumb
function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i === current
              ? "w-4 h-1.5 bg-accent"
              : i < current
              ? "w-1.5 h-1.5 bg-accent/40"
              : "w-1.5 h-1.5 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export default function PlaceMemberModal({ open, familyId, onComplete, onSkip }: Props) {
  const { showToast } = useUIStore();
  const { profile } = useAuthStore();
  const [step, setStep] = useState<Step>("anchor");
  const [treeData, setTreeData] = useState<TreeData>({ members: [], relationships: [] });
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState<TreeMember | null>(null);
  const [category, setCategory] = useState<RelCategory | null>(null);
  const [relation, setRelation] = useState<Relation | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<TreeData>(`/api/families/${familyId}/tree`)
      .then((data) => {
        setTreeData(data);
        if (data.members.filter((m) => !m.is_placeholder).length === 0) setStep("root");
      })
      .catch(() => setStep("root"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familyId]);

  const reset = () => {
    setStep("anchor");
    setAnchor(null);
    setCategory(null);
    setRelation(null);
  };

  const handleClose = () => { reset(); onSkip(); };

  const handleConfirmRoot = async () => {
    setPlacing(true);
    try {
      await api.post(`/api/families/${familyId}/tree/place-member`, { anchor_member_id: null, relationship: null });
      reset();
      showToast("You've been added to the family tree!", "success");
      onComplete();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to place in tree", "error");
    } finally { setPlacing(false); }
  };

  const handleConfirmNone = async () => {
    setPlacing(true);
    try {
      await api.post(`/api/families/${familyId}/tree/place-member`, { anchor_member_id: null, relationship: "none" });
      reset();
      showToast("Added to the tree! Connect yourself to others when ready.", "success");
      onComplete();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to place in tree", "error");
    } finally { setPlacing(false); }
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
    } finally { setPlacing(false); }
  };

  const selectableMembers = treeData.members.filter((m) => !m.is_placeholder);
  const categoryRelations = category ? getRelationsByCategory(category, profile?.gender) : [];
  const preview = anchor && relation && relation !== "none" ? buildPreview(anchor, relation, treeData) : null;

  // Map step to dot index
  const dotIndex = { root: 0, anchor: 0, category: 1, relation: 2, preview: 3 }[step] ?? 0;

  return (
    <Modal open={open} onClose={handleClose} title="Your place in the family tree">
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <>
          {/* ── Root: first member ────────────────────────────────────── */}
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
              <button onClick={handleClose} className="text-xs text-text-muted hover:text-text transition-colors">
                Skip — I&apos;ll do this later
              </button>
            </div>
          )}

          {/* ── Step 1: Pick anchor ───────────────────────────────────── */}
          {step === "anchor" && (
            <div className="flex flex-col gap-3">
              <StepDots current={dotIndex} />
              <div>
                <p className="text-sm font-medium text-text mb-1">Pick one person you&apos;re related to</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Even if you know multiple people here, pick the{" "}
                  <span className="font-medium text-text">one you&apos;re closest to</span>.
                  The tree works out your connection to everyone else automatically.
                </p>
              </div>
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto -mx-1 px-1">
                {selectableMembers.map((m) => {
                  const selected = anchor?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setAnchor(selected ? null : m)}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left border ${
                        selected ? "bg-accent/10 border-accent/40" : "border-transparent hover:bg-bg-3"
                      }`}
                    >
                      <Avatar name={m.name} src={m.photo} size={36} />
                      <span className="flex-1 text-sm font-medium text-text">{m.name}</span>
                      {selected
                        ? <Check size={15} className="text-accent shrink-0" />
                        : <ChevronRight size={14} className="text-text-muted shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <Button onClick={() => setStep("category")} disabled={!anchor} className="w-full">
                Next
              </Button>
              <button onClick={handleClose} className="text-xs text-text-muted hover:text-text text-center transition-colors">
                Skip — I&apos;ll place myself later
              </button>
            </div>
          )}

          {/* ── Step 2: Pick closeness category ──────────────────────── */}
          {step === "category" && anchor && (
            <div className="flex flex-col gap-3">
              <StepDots current={dotIndex} />
              <div>
                <p className="text-sm font-medium text-text mb-0.5">
                  How closely are you related to{" "}
                  <span className="text-accent">{anchor.name}</span>?
                </p>
                <p className="text-xs text-text-muted">
                  Read the examples under each option before choosing.
                </p>
              </div>

              {/* Decision tip */}
              <div className="bg-accent/8 border border-accent/20 rounded-xl px-3 py-2.5 flex gap-2.5 items-start">
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <p className="text-xs text-text-muted leading-relaxed">
                  <span className="font-semibold text-text">Not sure where to start?</span>{" "}
                  Try <span className="text-accent font-medium">Immediate</span> first — parent, child, sibling, or spouse.
                  If none of those fit, move to <span className="text-accent font-medium">Extended</span>.
                  If more than one option in Extended could work, just pick the closest one.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => { setCategory(cat.value); setStep("relation"); }}
                    className="flex items-start gap-3 p-4 bg-bg-3 hover:bg-bg-4 border border-border hover:border-accent/50 rounded-2xl transition-all text-left"
                  >
                    <span className="text-2xl mt-0.5 shrink-0">{cat.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text">{cat.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">{cat.subtitle}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {cat.examples.map((ex) => (
                          <span key={ex} className="text-[10px] bg-bg-2 border border-border rounded-full px-2 py-0.5 text-text-faint">
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={15} className="text-text-muted shrink-0 mt-1" />
                  </button>
                ))}

                {/* Not sure option — places immediately */}
                <button
                  onClick={handleConfirmNone}
                  disabled={placing}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-border hover:border-text-muted hover:bg-bg-3 transition-all text-left"
                >
                  <span className="text-xl shrink-0">❓</span>
                  <div>
                    <p className="text-sm font-medium text-text-muted">Not sure yet</p>
                    <p className="text-xs text-text-faint">Add me to the tree — I&apos;ll connect later</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setStep("anchor")}
                className="flex items-center justify-center gap-1 text-xs text-text-muted hover:text-text transition-colors mt-1"
              >
                <ArrowLeft size={12} /> Back
              </button>
            </div>
          )}

          {/* ── Step 3: Pick specific relation ────────────────────────── */}
          {step === "relation" && anchor && category && (
            <div className="flex flex-col gap-3">
              <StepDots current={dotIndex} />
              <div>
                <p className="text-sm font-medium text-text mb-0.5">
                  Which{" "}
                  {category === "immediate" ? "immediate" : category === "extended" ? "extended" : "distant"}{" "}
                  relation are you?
                </p>
                <p className="text-xs text-text-muted">
                  In relation to{" "}
                  <span className="font-medium text-text">{anchor.name}</span>
                </p>
              </div>

              {category === "extended" && (
                <div className="bg-bg-3 border border-border rounded-xl px-3 py-2 flex gap-2 items-start">
                  <span className="text-sm shrink-0 mt-0.5">ℹ️</span>
                  <p className="text-xs text-text-muted leading-relaxed">
                    If more than one option fits, pick any — the tree will still place you correctly relative to {anchor.name}.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {categoryRelations.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => { setRelation(r.value); setStep("preview"); }}
                    className="flex flex-col items-center gap-2 p-4 bg-bg-3 hover:bg-bg-4 border border-border hover:border-accent rounded-2xl transition-all"
                  >
                    <span className="text-2xl">{r.emoji}</span>
                    <span className="text-sm font-semibold text-text text-center">{r.label}</span>
                    <span className="text-[11px] text-text-muted text-center leading-tight">{r.desc}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => { setRelation(null); setStep("category"); }}
                className="flex items-center justify-center gap-1 text-xs text-text-muted hover:text-text transition-colors mt-1"
              >
                <ArrowLeft size={12} /> Back
              </button>
            </div>
          )}

          {/* ── Step 4: Preview & confirm ─────────────────────────────── */}
          {step === "preview" && anchor && relation && preview && (
            <div className="flex flex-col gap-4">
              <StepDots current={dotIndex} />
              <div className="bg-bg-3 border border-border rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={anchor.name} src={anchor.photo} size={40} />
                  <div>
                    <p className="text-sm font-semibold text-text">{anchor.name}</p>
                    <p className="text-xs text-text-muted">
                      {categoryRelations.find((r) => r.value === relation)?.label ?? relation}
                    </p>
                  </div>
                </div>
                <div className="border-t border-border pt-3 flex flex-col gap-1.5">
                  {preview.lines.map((l, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-text-muted">
                      <Check size={12} className="text-success mt-0.5 shrink-0" />{l}
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
