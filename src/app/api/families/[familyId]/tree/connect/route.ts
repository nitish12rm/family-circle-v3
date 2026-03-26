import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { TreeMember } from "@/models/TreeMember";
import { TreeRelationship } from "@/models/TreeRelationship";
import { FamilyMember } from "@/models/FamilyMember";
import { randomUUID } from "crypto";

type RelType = "parent" | "child" | "spouse" | "sibling" | "step_parent" | "step_child";
type ConnectRelType =
  | "parent" | "child" | "spouse" | "sibling"
  | "step_parent" | "step_child"
  | "uncle_aunt" | "niece_nephew" | "cousin" | "2nd_cousin" | "3rd_cousin";

const INVERSE: Record<RelType, RelType> = {
  parent: "child",
  child: "parent",
  spouse: "spouse",
  sibling: "sibling",
  step_parent: "step_child",
  step_child: "step_parent",
};

interface RelDoc {
  _id: string;
  family_id: string;
  member_id: string;
  related_member_id: string;
  type: RelType;
}

// POST — connect an already-placed user node to another node
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { my_member_id, target_member_id, relationship } = await req.json() as {
      my_member_id: string;
      target_member_id: string;
      relationship: ConnectRelType;
    };

    // Auth: must own my_member_id or be admin
    const myNode = await TreeMember.findOne({ _id: my_member_id, family_id: familyId }).lean() as unknown as { _id: string; profile_id?: string } | null;
    if (!myNode) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwn = myNode.profile_id === userId;
    if (!isOwn) {
      const admin = await FamilyMember.findOne({ family_id: familyId, user_id: userId, role: "admin" }).lean();
      if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const anchor = await TreeMember.findOne({ _id: target_member_id, family_id: familyId }).lean() as unknown as { _id: string } | null;
    if (!anchor) return NextResponse.json({ error: "Anchor not found" }, { status: 404 });

    // Load existing rels for deduplication
    const existingRels = await TreeRelationship.find({ family_id: familyId }).lean() as unknown as { member_id: string; related_member_id: string; type: string }[];
    const existingRelSet = new Set(existingRels.map((r) => `${r.member_id}|${r.related_member_id}|${r.type}`));

    const newMemberId = my_member_id;
    const anchorId = target_member_id;
    const rels: RelDoc[] = [];
    const placeholderDocs: object[] = [];

    const addRel = (a: string, b: string, type: RelType) => {
      const inv = INVERSE[type];
      if (
        !existingRelSet.has(`${a}|${b}|${type}`) &&
        !rels.some((r) => r.member_id === a && r.related_member_id === b && r.type === type)
      ) {
        rels.push({ _id: randomUUID(), family_id: familyId, member_id: a, related_member_id: b, type });
      }
      if (
        !existingRelSet.has(`${b}|${a}|${inv}`) &&
        !rels.some((r) => r.member_id === b && r.related_member_id === a && r.type === inv)
      ) {
        rels.push({ _id: randomUUID(), family_id: familyId, member_id: b, related_member_id: a, type: inv });
      }
    };

    const addPlaceholder = (name: string) => {
      const id = randomUUID();
      placeholderDocs.push({ _id: id, family_id: familyId, name, is_placeholder: true, is_deceased: false });
      return id;
    };

    // ── CHILD: I am a child of the anchor ────────────────────────────────────
    if (relationship === "child") {
      addRel(anchorId, newMemberId, "parent");

      const spouseRel = await TreeRelationship.findOne({
        family_id: familyId, member_id: anchorId, type: "spouse",
      }).lean() as unknown as { related_member_id: string } | null;

      let coParentId: string;
      if (spouseRel) {
        coParentId = spouseRel.related_member_id;
        addRel(coParentId, newMemberId, "parent");
      } else {
        const phId = addPlaceholder("Unknown Parent");
        addRel(anchorId, phId, "spouse");
        addRel(phId, newMemberId, "parent");
        coParentId = phId;
      }

      // Auto-sibling with existing children of both parents
      const parentIds = [anchorId, coParentId];
      const existingChildIds = new Set<string>();
      for (const pid of parentIds) {
        const childRels = await TreeRelationship.find({
          family_id: familyId, member_id: pid, type: "parent",
        }).lean() as unknown as { related_member_id: string }[];
        for (const cr of childRels) existingChildIds.add(cr.related_member_id);
      }
      for (const sibId of existingChildIds) {
        if (sibId !== newMemberId) addRel(newMemberId, sibId, "sibling");
      }

    // ── PARENT: I am a parent of the anchor ──────────────────────────────────
    } else if (relationship === "parent") {
      addRel(newMemberId, anchorId, "parent");

      const parentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      if (parentRels.length === 0) {
        const phId = addPlaceholder("Unknown Parent");
        addRel(newMemberId, phId, "spouse");
        addRel(phId, anchorId, "parent");
      } else if (parentRels.length === 1) {
        addRel(newMemberId, parentRels[0].related_member_id, "spouse");
      }

    // ── SIBLING: I am a sibling of the anchor ────────────────────────────────
    } else if (relationship === "sibling") {
      addRel(newMemberId, anchorId, "sibling");

      // Also become sibling of all anchor's existing siblings
      const anchorSiblingRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "sibling",
      }).lean() as unknown as { related_member_id: string }[];
      for (const sr of anchorSiblingRels) {
        if (sr.related_member_id !== newMemberId) addRel(newMemberId, sr.related_member_id, "sibling");
      }

      const parentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      if (parentRels.length > 0) {
        for (const pr of parentRels) {
          addRel(pr.related_member_id, newMemberId, "parent");
        }
      } else {
        const phId = addPlaceholder("Unknown Parent");
        addRel(phId, anchorId, "parent");
        addRel(phId, newMemberId, "parent");
      }

    // ── SPOUSE: I am the spouse of the anchor ────────────────────────────────
    } else if (relationship === "spouse") {
      addRel(newMemberId, anchorId, "spouse");

      const childRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "parent",
      }).lean() as unknown as { related_member_id: string }[];
      for (const cr of childRels) {
        addRel(newMemberId, cr.related_member_id, "parent");
      }

    // ── STEP_PARENT: anchor IS my step-parent, I am their step-child ─────────
    } else if (relationship === "step_parent") {
      addRel(anchorId, newMemberId, "step_parent");

    // ── STEP_CHILD: anchor IS my step-child, I am their step-parent ──────────
    } else if (relationship === "step_child") {
      addRel(newMemberId, anchorId, "step_parent");

    // ── UNCLE / AUNT: I am a sibling of the anchor's parent ──────────────────
    } else if (relationship === "uncle_aunt") {
      const parentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      if (parentRels.length > 0) {
        const anchorParentId = parentRels[0].related_member_id;
        addRel(newMemberId, anchorParentId, "sibling");
        const parentSiblingRels = await TreeRelationship.find({
          family_id: familyId, member_id: anchorParentId, type: "sibling",
        }).lean() as unknown as { related_member_id: string }[];
        for (const sr of parentSiblingRels) {
          if (sr.related_member_id !== newMemberId) addRel(newMemberId, sr.related_member_id, "sibling");
        }
      } else {
        const phParentId = addPlaceholder("Unknown Parent");
        addRel(phParentId, anchorId, "parent");
        addRel(newMemberId, phParentId, "sibling");
      }

    // ── NIECE / NEPHEW: I am a child of the anchor's sibling ─────────────────
    } else if (relationship === "niece_nephew") {
      const siblingRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "sibling",
      }).lean() as unknown as { related_member_id: string }[];

      const phSiblingId = addPlaceholder("Unknown Parent");
      addRel(phSiblingId, anchorId, "sibling");
      for (const sr of siblingRels) {
        addRel(phSiblingId, sr.related_member_id, "sibling");
      }
      addRel(phSiblingId, newMemberId, "parent");

    // ── COUSIN: our parents are siblings ─────────────────────────────────────
    } else if (relationship === "cousin") {
      const parentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      // Check if I already have a parent I can use
      const myParentRels = await TreeRelationship.find({
        family_id: familyId, member_id: newMemberId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      const myParentId = myParentRels.length > 0 ? myParentRels[0].related_member_id : addPlaceholder("Unknown Parent");
      if (myParentRels.length === 0) addRel(myParentId, newMemberId, "parent");

      if (parentRels.length > 0) {
        const anchorParentId = parentRels[0].related_member_id;
        addRel(myParentId, anchorParentId, "sibling");
        const parentSiblingRels = await TreeRelationship.find({
          family_id: familyId, member_id: anchorParentId, type: "sibling",
        }).lean() as unknown as { related_member_id: string }[];
        for (const sr of parentSiblingRels) {
          if (sr.related_member_id !== myParentId) addRel(myParentId, sr.related_member_id, "sibling");
        }
      } else {
        const anchorParentId = addPlaceholder("Unknown Parent");
        addRel(anchorParentId, anchorId, "parent");
        addRel(myParentId, anchorParentId, "sibling");
      }

    // ── 2ND COUSIN: grandparents are siblings ─────────────────────────────────
    } else if (relationship === "2nd_cousin") {
      const anchorParentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      let anchorGParentId: string;
      if (anchorParentRels.length > 0) {
        const anchorParentId = anchorParentRels[0].related_member_id;
        const anchorGPRels = await TreeRelationship.find({
          family_id: familyId, member_id: anchorParentId, type: "child",
        }).lean() as unknown as { related_member_id: string }[];
        if (anchorGPRels.length > 0) {
          anchorGParentId = anchorGPRels[0].related_member_id;
        } else {
          anchorGParentId = addPlaceholder("Unknown Grandparent");
          addRel(anchorGParentId, anchorParentId, "parent");
        }
      } else {
        const phParentId = addPlaceholder("Unknown Parent");
        addRel(phParentId, anchorId, "parent");
        anchorGParentId = addPlaceholder("Unknown Grandparent");
        addRel(anchorGParentId, phParentId, "parent");
      }

      // My branch: use my existing parent/grandparent if available
      const myParentRels = await TreeRelationship.find({
        family_id: familyId, member_id: newMemberId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      let myGParentId: string;
      if (myParentRels.length > 0) {
        const myParentId = myParentRels[0].related_member_id;
        const myGPRels = await TreeRelationship.find({
          family_id: familyId, member_id: myParentId, type: "child",
        }).lean() as unknown as { related_member_id: string }[];
        if (myGPRels.length > 0) {
          myGParentId = myGPRels[0].related_member_id;
        } else {
          myGParentId = addPlaceholder("Unknown Grandparent");
          addRel(myGParentId, myParentId, "parent");
        }
      } else {
        myGParentId = addPlaceholder("Unknown Grandparent");
        const myParentId = addPlaceholder("Unknown Parent");
        addRel(myGParentId, myParentId, "parent");
        addRel(myParentId, newMemberId, "parent");
      }

      addRel(myGParentId, anchorGParentId, "sibling");
      const gParentSiblingRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorGParentId, type: "sibling",
      }).lean() as unknown as { related_member_id: string }[];
      for (const sr of gParentSiblingRels) {
        if (sr.related_member_id !== myGParentId) addRel(myGParentId, sr.related_member_id, "sibling");
      }

    // ── 3RD COUSIN: great-grandparents are siblings ───────────────────────────
    } else if (relationship === "3rd_cousin") {
      // Walk up anchor's lineage 3 levels
      const anchorParentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      let anchorGGParentId: string;
      if (anchorParentRels.length > 0) {
        const anchorParentId = anchorParentRels[0].related_member_id;
        const anchorGPRels = await TreeRelationship.find({
          family_id: familyId, member_id: anchorParentId, type: "child",
        }).lean() as unknown as { related_member_id: string }[];
        if (anchorGPRels.length > 0) {
          const anchorGParentId = anchorGPRels[0].related_member_id;
          const anchorGGPRels = await TreeRelationship.find({
            family_id: familyId, member_id: anchorGParentId, type: "child",
          }).lean() as unknown as { related_member_id: string }[];
          if (anchorGGPRels.length > 0) {
            anchorGGParentId = anchorGGPRels[0].related_member_id;
          } else {
            anchorGGParentId = addPlaceholder("Unknown Great-Grandparent");
            addRel(anchorGGParentId, anchorGParentId, "parent");
          }
        } else {
          const phGParentId = addPlaceholder("Unknown Grandparent");
          addRel(phGParentId, anchorParentId, "parent");
          anchorGGParentId = addPlaceholder("Unknown Great-Grandparent");
          addRel(anchorGGParentId, phGParentId, "parent");
        }
      } else {
        const phParentId = addPlaceholder("Unknown Parent");
        addRel(phParentId, anchorId, "parent");
        const phGParentId = addPlaceholder("Unknown Grandparent");
        addRel(phGParentId, phParentId, "parent");
        anchorGGParentId = addPlaceholder("Unknown Great-Grandparent");
        addRel(anchorGGParentId, phGParentId, "parent");
      }

      // My branch: use existing lineage where possible
      const myParentRels = await TreeRelationship.find({
        family_id: familyId, member_id: newMemberId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      let myGGParentId: string;
      if (myParentRels.length > 0) {
        const myParentId = myParentRels[0].related_member_id;
        const myGPRels = await TreeRelationship.find({
          family_id: familyId, member_id: myParentId, type: "child",
        }).lean() as unknown as { related_member_id: string }[];
        if (myGPRels.length > 0) {
          const myGParentId = myGPRels[0].related_member_id;
          const myGGPRels = await TreeRelationship.find({
            family_id: familyId, member_id: myGParentId, type: "child",
          }).lean() as unknown as { related_member_id: string }[];
          if (myGGPRels.length > 0) {
            myGGParentId = myGGPRels[0].related_member_id;
          } else {
            myGGParentId = addPlaceholder("Unknown Great-Grandparent");
            addRel(myGGParentId, myGParentId, "parent");
          }
        } else {
          const phGParentId = addPlaceholder("Unknown Grandparent");
          addRel(phGParentId, myParentId, "parent");
          myGGParentId = addPlaceholder("Unknown Great-Grandparent");
          addRel(myGGParentId, phGParentId, "parent");
        }
      } else {
        const myParentId = addPlaceholder("Unknown Parent");
        addRel(myParentId, newMemberId, "parent");
        const myGParentId = addPlaceholder("Unknown Grandparent");
        addRel(myGParentId, myParentId, "parent");
        myGGParentId = addPlaceholder("Unknown Great-Grandparent");
        addRel(myGGParentId, myGParentId, "parent");
      }

      addRel(myGGParentId, anchorGGParentId, "sibling");
      const ggParentSiblingRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorGGParentId, type: "sibling",
      }).lean() as unknown as { related_member_id: string }[];
      for (const sr of ggParentSiblingRels) {
        if (sr.related_member_id !== myGGParentId) addRel(myGGParentId, sr.related_member_id, "sibling");
      }
    }

    // Persist placeholders and relationships
    if (placeholderDocs.length > 0) await TreeMember.insertMany(placeholderDocs);
    if (rels.length > 0) await TreeRelationship.insertMany(rels);

    // Clean up any orphaned placeholders
    const allRels = await TreeRelationship.find({ family_id: familyId }).lean() as unknown as { member_id: string; related_member_id: string }[];
    const connectedIds = new Set(allRels.flatMap((r) => [r.member_id, r.related_member_id]));
    await TreeMember.deleteMany({
      family_id: familyId,
      is_placeholder: true,
      _id: { $nin: Array.from(connectedIds) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    const status = (err as Error).message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
