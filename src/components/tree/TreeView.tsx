"use client";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  MouseEvent,
  WheelEvent,
  TouchEvent,
} from "react";
import { Plus, ZoomIn, ZoomOut, Maximize2, Save } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { api } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import PlaceMemberModal from "@/components/tree/PlaceMemberModal";
import TreeMemberModal from "@/components/tree/TreeMemberModal";
import type { TreeMember, TreeRelationship } from "@/types";

interface TreeData {
  members: TreeMember[];
  relationships: TreeRelationship[];
}

interface NodePosition {
  x: number;
  y: number;
  member: TreeMember;
}

const NODE_W = 120;
const NODE_H = 90;
const GEN_GAP = 170;
const NODE_GAP = 140;

// ── Relationship label computation ────────────────────────────────────────────
const STEP_FROM_REL: Record<string, string> = {
  parent: "child",       // I am parent → they are my child
  child: "parent",       // I am child → they are my parent
  sibling: "sibling",
  spouse: "spouse",
  step_parent: "step_child",
  step_child: "step_parent",
};

type G = string | undefined;
function pick(gender: G, male: string, female: string, neutral: string) {
  return gender === "male" ? male : gender === "female" ? female : neutral;
}

function pathToLabel(path: string[], gender: G): string | null {
  const k = path.join(">");
  const p = pick.bind(null, gender);
  const map: Record<string, string> = {
    "parent":                              p("Father",          "Mother",          "Parent"),
    "child":                               p("Son",             "Daughter",        "Child"),
    "sibling":                             p("Brother",         "Sister",          "Sibling"),
    "spouse":                              p("Husband",         "Wife",            "Partner"),
    "step_parent":                         p("Step-father",     "Step-mother",     "Step-parent"),
    "step_child":                          p("Step-son",        "Step-daughter",   "Step-child"),
    "parent>child":                        p("Brother",         "Sister",          "Sibling"),
    "sibling>sibling":                     p("Brother",         "Sister",          "Sibling"),
    "parent>parent":                       p("Grandfather",     "Grandmother",     "Grandparent"),
    "child>child":                         p("Grandson",        "Granddaughter",   "Grandchild"),
    "parent>sibling":                      p("Uncle",           "Aunt",            "Uncle/Aunt"),
    "sibling>child":                       p("Nephew",          "Niece",           "Niece/Nephew"),
    "parent>child>child":                  p("Nephew",          "Niece",           "Niece/Nephew"),
    "parent>parent>child":                 p("Uncle",           "Aunt",            "Uncle/Aunt"),
    "parent>child>child>child":            p("Grand-nephew",    "Grand-niece",     "Grand-niece/nephew"),
    "parent>parent>child>child":           "1st Cousin",
    "spouse>parent":                       p("Father-in-law",   "Mother-in-law",   "Parent-in-law"),
    "spouse>sibling":                      p("Brother-in-law",  "Sister-in-law",   "Sibling-in-law"),
    "sibling>spouse":                      p("Brother-in-law",  "Sister-in-law",   "Sibling-in-law"),
    "child>spouse":                        p("Son-in-law",      "Daughter-in-law", "Child-in-law"),
    "parent>parent>parent":                p("Great-grandfather","Great-grandmother","Great-grandparent"),
    "child>child>child":                   p("Great-grandson",  "Great-granddaughter","Great-grandchild"),
    "parent>parent>sibling":               p("Great-uncle",     "Great-aunt",      "Great-uncle/aunt"),
    "sibling>child>child":                 p("Grand-nephew",    "Grand-niece",     "Grand-niece/nephew"),
    "parent>sibling>child":                "1st Cousin",
    "parent>sibling>sibling>child":        "1st Cousin",
    "parent>parent>sibling>child":         "1st Cousin once removed",
    "parent>sibling>child>child":          "1st Cousin once removed",
    "parent>parent>sibling>child>child":   "2nd Cousin",
    "parent>sibling>child>child>child":    "2nd Cousin once removed",
    "parent>parent>parent>sibling>child>child": "2nd Cousin",
  };
  if (map[k]) return map[k];
  if (path.length <= 5) return "Relative";
  return null;
}

function computeRelLabels(
  myId: string,
  members: TreeMember[],
  relationships: TreeRelationship[]
): Map<string, string> {
  const labels = new Map<string, string>();
  labels.set(myId, "You");

  const adj = new Map<string, { id: string; step: string }[]>();
  for (const m of members) adj.set(m.id, []);
  for (const r of relationships) {
    const step = STEP_FROM_REL[r.type];
    if (!step) continue;
    adj.get(r.member_id)?.push({ id: r.related_member_id, step });
  }

  const visited = new Set<string>([myId]);
  const queue: { id: string; path: string[] }[] = [{ id: myId, path: [] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (path.length >= 6) continue;
    for (const { id: nId, step } of adj.get(id) ?? []) {
      if (visited.has(nId)) continue;
      visited.add(nId);
      const newPath = [...path, step];
      const neighbor = members.find((m) => m.id === nId);
      const label = pathToLabel(newPath, neighbor?.gender);
      if (label) labels.set(nId, label);
      queue.push({ id: nId, path: newPath });
    }
  }

  return labels;
}

function buildLayout(
  members: TreeMember[],
  relationships: TreeRelationship[]
): NodePosition[] {
  if (members.length === 0) return [];

  // Build adjacency maps
  const childrenOf: Record<string, string[]> = {};
  const parentsOf: Record<string, string[]> = {};
  const spouseOf: Record<string, string> = {};

  for (const m of members) {
    childrenOf[m.id] = [];
    parentsOf[m.id] = [];
  }
  for (const r of relationships) {
    if (r.type === "parent") childrenOf[r.member_id]?.push(r.related_member_id);
    if (r.type === "child") parentsOf[r.member_id]?.push(r.related_member_id);
    if (r.type === "spouse") spouseOf[r.member_id] = r.related_member_id;
  }

  // For each spouse pair, designate one as "secondary" — it is placed AFTER
  // the main traversal, next to its primary, instead of being traversed independently.
  // This prevents both spouses from independently centering over the same children.
  const secondaryIds = new Set<string>();
  const seenPairs = new Set<string>();
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    const key = [r.member_id, r.related_member_id].sort().join("|");
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    secondaryIds.add(r.related_member_id); // related_member_id is always secondary
  }

  // Roots: no parents and not a secondary spouse
  const roots = members.filter(
    (m) => parentsOf[m.id].length === 0 && !secondaryIds.has(m.id)
  );
  if (roots.length === 0) {
    roots.push(members.find((m) => !secondaryIds.has(m.id)) ?? members[0]);
  }

  const positioned = new Map<string, NodePosition>();
  let globalX = 0;

  function placeSubtree(memberId: string, depth: number): number {
    if (positioned.has(memberId)) return positioned.get(memberId)!.x;
    const member = members.find((m) => m.id === memberId);
    if (!member) return globalX;

    const spouseId = spouseOf[memberId];
    const hasSecondarySpouse = !!spouseId && secondaryIds.has(spouseId);

    // Collect unique children from both this member and their secondary spouse
    const myChildren = childrenOf[memberId] ?? [];
    const spouseChildren = hasSecondarySpouse ? (childrenOf[spouseId] ?? []) : [];
    const allChildren = [...new Set([...myChildren, ...spouseChildren])].filter(
      (cid) => !secondaryIds.has(cid)
    );

    let centerX: number;
    if (allChildren.length === 0) {
      // Leaf — reserve space for two nodes if coupled, one otherwise
      centerX = hasSecondarySpouse ? globalX + NODE_GAP / 2 : globalX;
      globalX += hasSecondarySpouse ? NODE_GAP * 2 : NODE_GAP;
    } else {
      const childXs: number[] = [];
      for (const cid of allChildren) {
        childXs.push(placeSubtree(cid, depth + 1));
      }
      centerX = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    }

    // If paired, place primary to the LEFT of center so spouse slots in to the right
    const x = hasSecondarySpouse ? centerX - NODE_GAP / 2 : centerX;
    positioned.set(memberId, { x, y: depth * GEN_GAP, member });
    return x;
  }

  for (const root of roots) {
    placeSubtree(root.id, 0);
  }

  // Place any non-secondary members that were missed (disconnected nodes)
  for (const m of members) {
    if (!positioned.has(m.id) && !secondaryIds.has(m.id)) {
      positioned.set(m.id, { x: globalX, y: 0, member: m });
      globalX += NODE_GAP;
    }
  }

  // Now place secondary spouses directly beside their primary
  for (const secondaryId of secondaryIds) {
    const primaryId = spouseOf[secondaryId];
    const primaryPos = primaryId ? positioned.get(primaryId) : null;
    const sec = members.find((m) => m.id === secondaryId);
    if (!sec) continue;

    if (primaryPos) {
      positioned.set(secondaryId, {
        x: primaryPos.x + NODE_GAP,
        y: primaryPos.y,
        member: sec,
      });
    } else {
      positioned.set(secondaryId, { x: globalX, y: 0, member: sec });
      globalX += NODE_GAP;
    }
  }

  // Normalize: shift everything so the minimum X is 0 (avoids negative SVG coords)
  const allPos = Array.from(positioned.values());
  const minX = Math.min(...allPos.map((p) => p.x));
  const offset = minX < 0 ? -minX + 20 : 0;
  return offset > 0 ? allPos.map((p) => ({ ...p, x: p.x + offset })) : allPos;
}

export default function TreeView() {
  const { activeFamilyId } = useFamilyStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [treeData, setTreeData] = useState<TreeData>({ members: [], relationships: [] });
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<NodePosition[]>([]);

  // Viewport state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const touchStart = useRef<{ x: number; y: number; dist?: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Admin role + family members for linking
  const [isAdmin, setIsAdmin] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{
    user_id: string;
    profile: { id: string; name: string; avatar?: string } | null;
  }[]>([]);
  // Relation labels keyed by member id
  const [relLabels, setRelLabels] = useState<Map<string, string>>(new Map());

  // Placement
  const [showPlacement, setShowPlacement] = useState(false);

  // Modals
  const [selectedMember, setSelectedMember] = useState<TreeMember | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addRelOpen, setAddRelOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", gender: "", dob: "", notes: "" });
  const [relForm, setRelForm] = useState({ member_id: "", related_member_id: "", type: "child" });
  const [saving, setSaving] = useState(false);

  const loadTree = useCallback(async () => {
    if (!activeFamilyId) return;
    try {
      const [data, members] = await Promise.all([
        api.get<TreeData>(`/api/families/${activeFamilyId}/tree`),
        api.get<{ role: string; user_id: string; profile: { id: string; name: string; avatar?: string } | null }[]>(
          `/api/families/${activeFamilyId}/members`
        ),
      ]);
      if (user?.id) {
        const me = members.find((m) => m.user_id === user.id);
        setIsAdmin(me?.role === "admin");
      }
      setFamilyMembers(members);
      setTreeData(data);
      const pos = buildLayout(data.members, data.relationships);
      setPositions(pos);

      // Compute relation labels from current user's perspective
      if (user?.id) {
        const myNode = data.members.find((m) => m.profile_id === user.id && !m.is_placeholder);
        if (myNode) {
          setRelLabels(computeRelLabels(myNode.id, data.members, data.relationships));
        }
      }

      // Prompt user to place themselves if not in tree
      if (user?.id) {
        const alreadyIn = data.members.some(
          (m) => m.profile_id === user.id && !m.is_placeholder
        );
        if (!alreadyIn) setShowPlacement(true);
      }

      // Center view
      if (pos.length > 0 && containerRef.current) {
        const minX = Math.min(...pos.map((p) => p.x));
        const maxX = Math.max(...pos.map((p) => p.x));
        const midX = (minX + maxX) / 2;
        const { width, height } = containerRef.current.getBoundingClientRect();
        setPan({ x: width / 2 - midX - NODE_W / 2, y: height / 3 });
      }
    } catch {
      showToast("Failed to load tree", "error");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, showToast, user]);

  useEffect(() => {
    setLoading(true);
    loadTree();
  }, [loadTree]);

  // Pan handlers
  const onMouseDown = (e: MouseEvent) => {
    if ((e.target as Element).closest(".tree-node")) return;
    isPanning.current = true;
    lastPan.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!isPanning.current) return;
    setPan({ x: e.clientX - lastPan.current.x, y: e.clientY - lastPan.current.y });
  };
  const onMouseUp = () => { isPanning.current = false; };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(2.5, Math.max(0.3, z * delta)));
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStart.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
        dist: Math.sqrt(dx * dx + dy * dy),
      };
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!touchStart.current) return;
    if (e.touches.length === 1) {
      setPan({ x: e.touches[0].clientX - touchStart.current.x, y: e.touches[0].clientY - touchStart.current.y });
    } else if (e.touches.length === 2 && touchStart.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / touchStart.current.dist;
      setZoom((z) => Math.min(2.5, Math.max(0.3, z * ratio)));
      touchStart.current.dist = dist;
    }
  };

  const handleAddMember = async () => {
    if (!addForm.name.trim() || !activeFamilyId) return;
    setSaving(true);
    try {
      const member = await api.post<TreeMember>(`/api/families/${activeFamilyId}/tree`, addForm);
      const newData = { ...treeData, members: [...treeData.members, member] };
      setTreeData(newData);
      setPositions(buildLayout(newData.members, newData.relationships));
      setAddOpen(false);
      setAddForm({ name: "", gender: "", dob: "", notes: "" });
      showToast("Member added!", "success");
    } catch {
      showToast("Failed to add member", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRelationship = async () => {
    if (!relForm.member_id || !relForm.related_member_id || !activeFamilyId) return;
    setSaving(true);
    try {
      await api.post(`/api/families/${activeFamilyId}/tree/relationships`, relForm);
      await loadTree();
      setAddRelOpen(false);
      setRelForm({ member_id: "", related_member_id: "", type: "child" });
      showToast("Relationship added!", "success");
    } catch {
      showToast("Failed to add relationship", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!activeFamilyId) return;
    try {
      await api.delete(`/api/families/${activeFamilyId}/tree?memberId=${memberId}`);
      const newData = {
        members: treeData.members.filter((m) => m.id !== memberId),
        relationships: treeData.relationships.filter(
          (r) => r.member_id !== memberId && r.related_member_id !== memberId
        ),
      };
      setTreeData(newData);
      setPositions(buildLayout(newData.members, newData.relationships));
      setSelectedMember(null);
      showToast("Removed", "info");
    } catch {
      showToast("Failed to remove", "error");
    }
  };

  if (!activeFamilyId) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-text-muted text-sm">No family selected.</p>
      </div>
    );
  }

  // SVG dimensions
  const svgW = Math.max(800, ...positions.map((p) => p.x + NODE_W + 60));
  const svgH = Math.max(600, ...positions.map((p) => p.y + NODE_H + 60));

  const posMap = new Map(positions.map((p) => [p.member.id, p]));

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: "var(--content-h)" }}
    >
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
          className="w-9 h-9 bg-bg-2 border border-border rounded-xl flex items-center justify-center text-text-muted hover:text-text transition-colors"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
          className="w-9 h-9 bg-bg-2 border border-border rounded-xl flex items-center justify-center text-text-muted hover:text-text transition-colors"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={() => { setZoom(1); if (positions.length > 0 && containerRef.current) { const minX = Math.min(...positions.map((p) => p.x)); const maxX = Math.max(...positions.map((p) => p.x)); const midX = (minX + maxX) / 2; const { width, height } = containerRef.current.getBoundingClientRect(); setPan({ x: width / 2 - midX - NODE_W / 2, y: height / 3 }); } }}
          className="w-9 h-9 bg-bg-2 border border-border rounded-xl flex items-center justify-center text-text-muted hover:text-text transition-colors"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Action buttons — admin only */}
      {isAdmin && (
        <div className="absolute top-3 left-3 z-10 flex gap-2">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Person
          </Button>
          {treeData.members.length >= 2 && (
            <Button size="sm" variant="secondary" onClick={() => setAddRelOpen(true)}>
              Link
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      ) : treeData.members.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p className="text-text-muted text-sm">Your family tree is empty.</p>
          {isAdmin && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Add First Person
            </Button>
          )}
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={svgW}
          height={svgH}
          className="cursor-grab active:cursor-grabbing select-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={() => { touchStart.current = null; }}
        >
          {/* ── Relationship lines ─────────────────────────────────────── */}

          {/* Spouse lines (dashed purple horizontal) */}
          {treeData.relationships
            .filter((r) => r.type === "spouse")
            .map((rel) => {
              const from = posMap.get(rel.member_id);
              const to = posMap.get(rel.related_member_id);
              if (!from || !to || from.x >= to.x) return null;
              return (
                <line
                  key={rel.id}
                  x1={from.x + NODE_W}
                  y1={from.y + NODE_H / 2}
                  x2={to.x}
                  y2={to.y + NODE_H / 2}
                  stroke="rgba(124,92,252,0.4)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              );
            })}

          {/* Couple → children connectors (clean grouped lines) */}
          {(() => {
            // Build childId → [parentId, ...] from "parent" type only (biological)
            const bioParentsOf: Record<string, string[]> = {};
            for (const r of treeData.relationships) {
              if (r.type !== "parent") continue;
              if (!bioParentsOf[r.related_member_id]) bioParentsOf[r.related_member_id] = [];
              bioParentsOf[r.related_member_id].push(r.member_id);
            }
            // Group children by their parent-pair key
            const coupleChildren = new Map<string, string[]>();
            for (const [childId, parentIds] of Object.entries(bioParentsOf)) {
              const key = [...parentIds].sort().join("|");
              if (!coupleChildren.has(key)) coupleChildren.set(key, []);
              coupleChildren.get(key)!.push(childId);
            }

            return Array.from(coupleChildren.entries()).map(([coupleKey, childIds]) => {
              const parentIds = coupleKey.split("|");
              const parentPos = parentIds.map((id) => posMap.get(id)).filter(Boolean) as { x: number; y: number }[];
              const childPos = childIds.map((id) => posMap.get(id)).filter(Boolean) as { x: number; y: number }[];
              if (parentPos.length === 0 || childPos.length === 0) return null;

              const parentBottomY = parentPos[0].y + NODE_H;
              const childTopY = Math.min(...childPos.map((p) => p.y));
              const junctionY = parentBottomY + (childTopY - parentBottomY) * 0.5;

              const stemX =
                parentPos.length === 1
                  ? parentPos[0].x + NODE_W / 2
                  : (Math.min(...parentPos.map((p) => p.x)) + Math.max(...parentPos.map((p) => p.x)) + NODE_W) / 2;

              const childCenterXs = childPos.map((p) => p.x + NODE_W / 2);
              const childMinX = Math.min(...childCenterXs);
              const childMaxX = Math.max(...childCenterXs);

              const lineColor = "rgba(255,255,255,0.2)";

              // Parent-side junction: a short drop from each parent into a horizontal bar
              const parentJunctionY = parentBottomY + 20;

              return (
                <g key={`conn-${coupleKey}`}>
                  {/* Short drops from each parent down to the parent bar */}
                  {parentPos.map((pp, i) => (
                    <line key={`pd-${i}`}
                      x1={pp.x + NODE_W / 2} y1={parentBottomY}
                      x2={pp.x + NODE_W / 2} y2={parentJunctionY}
                      stroke={lineColor} strokeWidth={1.5} />
                  ))}
                  {/* Horizontal bar joining all parents */}
                  {parentPos.length > 1 && (
                    <line
                      x1={Math.min(...parentPos.map((p) => p.x + NODE_W / 2))}
                      y1={parentJunctionY}
                      x2={Math.max(...parentPos.map((p) => p.x + NODE_W / 2))}
                      y2={parentJunctionY}
                      stroke={lineColor} strokeWidth={1.5} />
                  )}
                  {/* Stem from midpoint of parent bar down to children junction */}
                  <line x1={stemX} y1={parentJunctionY} x2={stemX} y2={junctionY}
                    stroke={lineColor} strokeWidth={1.5} />
                  {/* Horizontal bar spanning all children */}
                  {childPos.length > 1 && (
                    <line x1={childMinX} y1={junctionY} x2={childMaxX} y2={junctionY}
                      stroke={lineColor} strokeWidth={1.5} />
                  )}
                  {/* Vertical drops to each child */}
                  {childPos.map((cp, i) => (
                    <line key={`cd-${i}`} x1={cp.x + NODE_W / 2} y1={junctionY} x2={cp.x + NODE_W / 2} y2={cp.y}
                      stroke={lineColor} strokeWidth={1.5} />
                  ))}
                </g>
              );
            });
          })()}

          {/* Step-parent lines (dashed amber) */}
          {treeData.relationships
            .filter((r) => r.type === "step_parent")
            .map((rel) => {
              const from = posMap.get(rel.member_id);
              const to = posMap.get(rel.related_member_id);
              if (!from || !to) return null;
              const x1 = from.x + NODE_W / 2;
              const y1 = from.y + NODE_H;
              const x2 = to.x + NODE_W / 2;
              const y2 = to.y;
              const my = (y1 + y2) / 2;
              return (
                <path
                  key={rel.id}
                  d={`M ${x1} ${y1} C ${x1} ${my} ${x2} ${my} ${x2} ${y2}`}
                  fill="none"
                  stroke="rgba(251,146,60,0.55)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              );
            })}

          {/* Nodes */}
          {positions.map(({ x, y, member }) => {
            const isSelected = selectedMember?.id === member.id;
            const initials = member.name
              .split(" ")
              .slice(0, 2)
              .map((w: string) => w[0])
              .join("")
              .toUpperCase();

            const genderFill = member.gender === "female"
              ? "rgba(236,72,153,0.3)"
              : member.gender === "male"
              ? "rgba(59,130,246,0.3)"
              : "rgba(124,92,252,0.3)";
            const genderStroke = member.gender === "female"
              ? "rgba(236,72,153,0.8)"
              : member.gender === "male"
              ? "rgba(59,130,246,0.8)"
              : "rgba(124,92,252,0.8)";
            const cardTint = member.gender === "female"
              ? "rgba(236,72,153,0.07)"
              : member.gender === "male"
              ? "rgba(59,130,246,0.07)"
              : "rgba(28,28,31,0.95)";
            const clipId = `avatar-${member.id}`;

            return (
              <g
                key={member.id}
                className="tree-node cursor-pointer"
                transform={`translate(${x}, ${y})`}
                onClick={() => setSelectedMember(isSelected ? null : member)}
              >
                <defs>
                  <clipPath id={clipId}>
                    <circle cx={NODE_W / 2} cy={26} r={18} />
                  </clipPath>
                </defs>
                {/* Card */}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill={isSelected ? "rgba(124,92,252,0.15)" : cardTint}
                  stroke={isSelected ? "#7C5CFC" : genderStroke.replace("0.8", "0.25")}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                {/* Avatar circle background */}
                <circle cx={NODE_W / 2} cy={26} r={18}
                  fill={genderFill}
                  stroke={genderStroke}
                  strokeWidth={1.5}
                />
                {/* Profile photo or initials */}
                {member.photo ? (
                  <image
                    href={member.photo}
                    x={NODE_W / 2 - 18}
                    y={8}
                    width={36}
                    height={36}
                    clipPath={`url(#${clipId})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                ) : (
                  <text
                    x={NODE_W / 2}
                    y={31}
                    textAnchor="middle"
                    fill="white"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {initials}
                  </text>
                )}
                {/* Name */}
                <text
                  x={NODE_W / 2}
                  y={56}
                  textAnchor="middle"
                  fill="#E8E8EA"
                  fontSize={10}
                  fontWeight={500}
                >
                  {member.name.length > 14 ? member.name.slice(0, 13) + "…" : member.name}
                </text>
                {/* Relation label */}
                {relLabels.get(member.id) && (
                  <text
                    x={NODE_W / 2}
                    y={68}
                    textAnchor="middle"
                    fill={relLabels.get(member.id) === "You" ? "#7C5CFC" : "#9B86FD"}
                    fontSize={9}
                    fontWeight={relLabels.get(member.id) === "You" ? 700 : 500}
                  >
                    {relLabels.get(member.id)}
                  </text>
                )}
                {/* DOB */}
                {member.dob && (
                  <text
                    x={NODE_W / 2}
                    y={80}
                    textAnchor="middle"
                    fill="#48484A"
                    fontSize={8}
                  >
                    {member.dob}
                  </text>
                )}
                {/* Deceased indicator */}
                {member.is_deceased && (
                  <rect x={NODE_W - 22} y={4} width={18} height={10} rx={5}
                    fill="rgba(255,255,255,0.15)" />
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* Member detail modal */}
      {activeFamilyId && (
        <TreeMemberModal
          member={selectedMember}
          familyId={activeFamilyId}
          treeData={treeData}
          isAdmin={isAdmin}
          currentUserId={user?.id}
          familyMembers={familyMembers}
          relLabel={selectedMember ? relLabels.get(selectedMember.id) : undefined}
          onClose={() => setSelectedMember(null)}
          onDelete={(id) => {
            handleDeleteMember(id);
            setSelectedMember(null);
          }}
          onUpdated={(updated) => {
            const newData = {
              ...treeData,
              members: treeData.members.map((m) =>
                m.id === updated.id ? { ...m, ...updated } : m
              ),
            };
            setTreeData(newData);
            setPositions(buildLayout(newData.members, newData.relationships));
            setSelectedMember((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
          }}
          onRelDeleted={(relId) => {
            const newData = {
              ...treeData,
              relationships: treeData.relationships.filter((r) => r.id !== relId),
            };
            // Also remove the inverse rel (same pair, opposite direction, inverse type)
            const deleted = treeData.relationships.find((r) => r.id === relId);
            const INV: Record<string, string> = {
              parent: "child", child: "parent", spouse: "spouse", sibling: "sibling",
              step_parent: "step_child", step_child: "step_parent",
            };
            const filteredRels = deleted
              ? newData.relationships.filter(
                  (r) =>
                    !(
                      r.member_id === deleted.related_member_id &&
                      r.related_member_id === deleted.member_id &&
                      r.type === INV[deleted.type]
                    )
                )
              : newData.relationships;
            const finalData = { ...treeData, relationships: filteredRels };
            setTreeData(finalData);
            setPositions(buildLayout(finalData.members, finalData.relationships));
          }}
          onRelTypeChanged={(relId, newType) => {
            const INVERSE: Record<string, string> = {
              parent: "child", child: "parent", spouse: "spouse", sibling: "sibling",
              step_parent: "step_child", step_child: "step_parent",
            };
            const changed = treeData.relationships.find((r) => r.id === relId);
            const newRels = treeData.relationships.map((r) => {
              if (r.id === relId) return { ...r, type: newType as typeof r.type };
              if (
                changed &&
                r.member_id === changed.related_member_id &&
                r.related_member_id === changed.member_id
              )
                return { ...r, type: INVERSE[newType] as typeof r.type };
              return r;
            });
            const newData = { ...treeData, relationships: newRels };
            setTreeData(newData);
            setPositions(buildLayout(newData.members, newData.relationships));
          }}
        />
      )}

      {/* Add member modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Person">
        <div className="flex flex-col gap-4">
          <Input
            label="Full Name *"
            placeholder="Jane Smith"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-muted">Gender</label>
            <div className="flex gap-2">
              {["male", "female", "other"].map((g) => (
                <button
                  key={g}
                  onClick={() => setAddForm({ ...addForm, gender: g })}
                  className={`flex-1 py-2 text-sm rounded-xl border transition-all capitalize ${
                    addForm.gender === g
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
            label="Date of Birth"
            type="date"
            value={addForm.dob}
            onChange={(e) => setAddForm({ ...addForm, dob: e.target.value })}
          />
          <Input
            label="Notes"
            placeholder="e.g. Paternal grandfather"
            value={addForm.notes}
            onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
          />
          <Button onClick={handleAddMember} loading={saving} className="w-full">
            <Save size={14} /> Add Person
          </Button>
        </div>
      </Modal>

      {/* Smart placement modal */}
      {activeFamilyId && (
        <PlaceMemberModal
          open={showPlacement}
          familyId={activeFamilyId}
          onComplete={() => { setShowPlacement(false); loadTree(); }}
          onSkip={() => setShowPlacement(false)}
        />
      )}

      {/* Add relationship modal */}
      <Modal open={addRelOpen} onClose={() => setAddRelOpen(false)} title="Link People">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-muted">Person</label>
            <select
              value={relForm.member_id}
              onChange={(e) => setRelForm({ ...relForm, member_id: e.target.value })}
              className="w-full bg-bg-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
            >
              <option value="">Select person</option>
              {treeData.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-muted">Relationship Type</label>
            <select
              value={relForm.type}
              onChange={(e) => setRelForm({ ...relForm, type: e.target.value })}
              className="w-full bg-bg-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
            >
              <option value="parent">is biological parent of</option>
              <option value="child">is biological child of</option>
              <option value="step_parent">is step-parent of</option>
              <option value="step_child">is step-child of</option>
              <option value="spouse">is spouse of</option>
              <option value="sibling">is sibling of</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-muted">Related Person</label>
            <select
              value={relForm.related_member_id}
              onChange={(e) => setRelForm({ ...relForm, related_member_id: e.target.value })}
              className="w-full bg-bg-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
            >
              <option value="">Select person</option>
              {treeData.members
                .filter((m) => m.id !== relForm.member_id)
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
            </select>
          </div>
          <Button onClick={handleAddRelationship} loading={saving} className="w-full">
            Link
          </Button>
        </div>
      </Modal>
    </div>
  );
}
