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
import { Plus, ZoomIn, ZoomOut, Maximize2, X, Save } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useUIStore } from "@/store/uiStore";
import { api } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
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
const NODE_H = 80;
const GEN_GAP = 160;
const NODE_GAP = 140;

function buildLayout(
  members: TreeMember[],
  relationships: TreeRelationship[]
): NodePosition[] {
  if (members.length === 0) return [];

  // Build adjacency
  const childrenOf: Record<string, string[]> = {};
  const parentsOf: Record<string, string[]> = {};
  for (const m of members) {
    childrenOf[m.id] = [];
    parentsOf[m.id] = [];
  }
  for (const r of relationships) {
    if (r.type === "parent") {
      childrenOf[r.member_id]?.push(r.related_member_id);
    }
    if (r.type === "child") {
      parentsOf[r.member_id]?.push(r.related_member_id);
    }
  }

  // Find roots (no parents)
  const roots = members.filter((m) => parentsOf[m.id]?.length === 0);
  if (roots.length === 0) roots.push(members[0]);

  const positioned = new Map<string, NodePosition>();
  let globalX = 0;

  function placeSubtree(memberId: string, depth: number): number {
    if (positioned.has(memberId)) return 0;
    const member = members.find((m) => m.id === memberId);
    if (!member) return 0;

    const children = childrenOf[memberId] ?? [];
    if (children.length === 0) {
      const x = globalX;
      globalX += NODE_GAP;
      positioned.set(memberId, { x, y: depth * GEN_GAP, member });
      return x;
    }

    const childXs: number[] = [];
    for (const cid of children) {
      childXs.push(placeSubtree(cid, depth + 1));
    }

    const x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    positioned.set(memberId, { x, y: depth * GEN_GAP, member });
    return x;
  }

  for (const root of roots) {
    placeSubtree(root.id, 0);
  }

  // Place any unpositioned members
  const allPositioned = new Set(positioned.keys());
  for (const m of members) {
    if (!allPositioned.has(m.id)) {
      positioned.set(m.id, {
        x: globalX,
        y: 0,
        member: m,
      });
      globalX += NODE_GAP;
    }
  }

  return Array.from(positioned.values());
}

export default function TreeView() {
  const { activeFamilyId } = useFamilyStore();
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
      const data = await api.get<TreeData>(`/api/families/${activeFamilyId}/tree`);
      setTreeData(data);
      const pos = buildLayout(data.members, data.relationships);
      setPositions(pos);

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
  }, [activeFamilyId, showToast]);

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

      {/* Action buttons */}
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

      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      ) : treeData.members.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p className="text-text-muted text-sm">Your family tree is empty.</p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add First Person
          </Button>
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
          {/* Relationship lines */}
          {treeData.relationships
            .filter((r) => r.type === "child" || r.type === "spouse")
            .map((rel) => {
              const from = posMap.get(rel.member_id);
              const to = posMap.get(rel.related_member_id);
              if (!from || !to) return null;
              const x1 = from.x + NODE_W / 2;
              const y1 = from.y + NODE_H;
              const x2 = to.x + NODE_W / 2;
              const y2 = to.y;
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;

              if (rel.type === "spouse") {
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
              }
              return (
                <path
                  key={rel.id}
                  d={`M ${x1} ${y1} C ${x1} ${my} ${x2} ${my} ${x2} ${y2}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1.5}
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

            return (
              <g
                key={member.id}
                className="tree-node cursor-pointer"
                transform={`translate(${x}, ${y})`}
                onClick={() => setSelectedMember(isSelected ? null : member)}
              >
                {/* Card */}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill={isSelected ? "rgba(124,92,252,0.15)" : "rgba(28,28,31,0.95)"}
                  stroke={isSelected ? "#7C5CFC" : "rgba(255,255,255,0.1)"}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                {/* Avatar circle */}
                <circle cx={NODE_W / 2} cy={26} r={18}
                  fill={member.gender === "female" ? "rgba(236,72,153,0.2)" : member.gender === "male" ? "rgba(59,130,246,0.2)" : "rgba(124,92,252,0.2)"}
                  stroke={member.gender === "female" ? "rgba(236,72,153,0.4)" : member.gender === "male" ? "rgba(59,130,246,0.4)" : "rgba(124,92,252,0.4)"}
                  strokeWidth={1}
                />
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
                {/* Name */}
                <text
                  x={NODE_W / 2}
                  y={58}
                  textAnchor="middle"
                  fill="#E8E8EA"
                  fontSize={10}
                  fontWeight={500}
                >
                  {member.name.length > 14 ? member.name.slice(0, 13) + "…" : member.name}
                </text>
                {/* DOB */}
                {member.dob && (
                  <text
                    x={NODE_W / 2}
                    y={70}
                    textAnchor="middle"
                    fill="#48484A"
                    fontSize={8}
                  >
                    {member.dob}
                  </text>
                )}
                {/* Deceased badge */}
                {member.is_deceased && (
                  <rect x={NODE_W - 22} y={4} width={18} height={10} rx={5}
                    fill="rgba(255,255,255,0.1)" />
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* Selected member panel */}
      {selectedMember && (
        <div className="absolute bottom-3 left-3 right-3 bg-bg-2 border border-border rounded-2xl p-4 shadow-card animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-text">{selectedMember.name}</h3>
              {selectedMember.dob && (
                <p className="text-xs text-text-muted mt-0.5">Born: {selectedMember.dob}</p>
              )}
              {selectedMember.status && (
                <p className="text-xs text-text-muted">{selectedMember.status}</p>
              )}
              {selectedMember.notes && (
                <p className="text-xs text-text-faint mt-1">{selectedMember.notes}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteMember(selectedMember.id)}
                className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-error transition-colors"
              >
                <X size={14} />
              </button>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-2 rounded-lg hover:bg-bg-3 text-text-muted transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
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
              <option value="parent">is parent of</option>
              <option value="child">is child of</option>
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
