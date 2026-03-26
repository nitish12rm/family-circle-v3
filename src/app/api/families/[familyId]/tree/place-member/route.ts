import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { TreeMember } from "@/models/TreeMember";
import { TreeRelationship } from "@/models/TreeRelationship";
import { Profile } from "@/models/Profile";
import { randomUUID } from "crypto";

type RelType = "parent" | "child" | "spouse" | "sibling" | "step_parent" | "step_child";
type PlaceRelType =
  | "parent" | "child" | "spouse" | "sibling" | "step_parent"
  | "cousin" | "2nd_cousin" | "3rd_cousin" | "uncle_aunt" | "niece_nephew"
  | "none";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { userId } = requireAuth(req);
    await connectDB();
    const { familyId } = await params;
    const { anchor_member_id, relationship } = await req.json() as {
      anchor_member_id: string | null;
      relationship: PlaceRelType | null;
    };

    // Already placed?
    const existing = await TreeMember.findOne({ family_id: familyId, profile_id: userId }).lean();
    if (existing) return NextResponse.json({ member: existing, placeholders: [] });

    const profile = await Profile.findById(userId).select("name gender avatar").lean() as unknown as { name: string; gender?: string; avatar?: string } | null;
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    // Root node OR "none" placement — no connection needed
    if (!anchor_member_id || !relationship || relationship === "none") {
      const newMember = await TreeMember.create({
        _id: randomUUID(),
        family_id: familyId,
        profile_id: userId,
        name: profile.name,
        gender: profile.gender ?? undefined,
        photo: profile.avatar ?? undefined,
        is_placeholder: false,
        is_deceased: false,
      });
      return NextResponse.json({ member: newMember, placeholders: [] });
    }

    const anchor = await TreeMember.findOne({ _id: anchor_member_id, family_id: familyId }).lean() as unknown as { _id: string } | null;
    if (!anchor) return NextResponse.json({ error: "Anchor not found" }, { status: 404 });

    const newMemberId = randomUUID();
    const rels: RelDoc[] = [];
    const placeholderDocs: object[] = [];

    // Helpers
    const addRel = (a: string, b: string, type: RelType) => {
      rels.push(
        { _id: randomUUID(), family_id: familyId, member_id: a, related_member_id: b, type },
        { _id: randomUUID(), family_id: familyId, member_id: b, related_member_id: a, type: INVERSE[type] }
      );
    };

    const addPlaceholder = (name: string) => {
      const id = randomUUID();
      placeholderDocs.push({
        _id: id,
        family_id: familyId,
        name,
        is_placeholder: true,
        is_deceased: false,
      });
      return id;
    };

    const anchorId = anchor._id as string;

    // ── CHILD: user is child of anchor ────────────────────────────────────────
    if (relationship === "child") {
      addRel(anchorId, newMemberId, "parent");

      const spouseRel = await TreeRelationship.findOne({
        family_id: familyId, member_id: anchorId, type: "spouse",
      }).lean() as unknown as { related_member_id: string } | null;

      if (spouseRel) {
        addRel(spouseRel.related_member_id, newMemberId, "parent");
      } else {
        const phId = addPlaceholder("Unknown Parent");
        addRel(anchorId, phId, "spouse");
        addRel(phId, newMemberId, "parent");
      }

    // ── PARENT: user is parent of anchor ─────────────────────────────────────
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
        // Become spouse of the existing parent
        addRel(newMemberId, parentRels[0].related_member_id, "spouse");
      }
      // 2+ parents → just add the parent edge (step-parent)

    // ── SIBLING: user is sibling of anchor ───────────────────────────────────
    } else if (relationship === "sibling") {
      addRel(newMemberId, anchorId, "sibling");

      const parentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      if (parentRels.length > 0) {
        // Inherit anchor's parents
        for (const pr of parentRels) {
          addRel(pr.related_member_id, newMemberId, "parent");
        }
      } else {
        // Share a new placeholder parent
        const phId = addPlaceholder("Unknown Parent");
        addRel(phId, anchorId, "parent");
        addRel(phId, newMemberId, "parent");
      }

    // ── SPOUSE: user is spouse of anchor ─────────────────────────────────────
    } else if (relationship === "spouse") {
      addRel(newMemberId, anchorId, "spouse");

      const childRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "parent",
      }).lean() as unknown as { related_member_id: string }[];

      for (const cr of childRels) {
        addRel(newMemberId, cr.related_member_id, "parent");
      }

    // ── UNCLE/AUNT: user is a sibling of anchor's parent ─────────────────────
    } else if (relationship === "uncle_aunt") {
      const parentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      if (parentRels.length > 0) {
        // Become sibling of anchor's existing parent
        addRel(newMemberId, parentRels[0].related_member_id, "sibling");
      } else {
        // Create a placeholder parent for anchor; I become sibling of that placeholder
        const phParentId = addPlaceholder("Unknown Parent");
        addRel(phParentId, anchorId, "parent");
        addRel(newMemberId, phParentId, "sibling");
      }

    // ── NIECE/NEPHEW: user is a child of anchor's sibling ────────────────────
    } else if (relationship === "niece_nephew") {
      const siblingRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "sibling",
      }).lean() as unknown as { related_member_id: string }[];

      // Create a placeholder sibling of the anchor (the "unknown parent" side)
      const phSiblingId = addPlaceholder("Unknown Parent");
      addRel(phSiblingId, anchorId, "sibling");
      // Inherit any existing siblings too so the placeholder connects the group
      for (const sr of siblingRels) {
        addRel(phSiblingId, sr.related_member_id, "sibling");
      }
      addRel(phSiblingId, newMemberId, "parent");

    // ── COUSIN: our parents are siblings ─────────────────────────────────────
    } else if (relationship === "cousin") {
      const parentRels = await TreeRelationship.find({
        family_id: familyId, member_id: anchorId, type: "child",
      }).lean() as unknown as { related_member_id: string }[];

      // My placeholder parent
      const myParentId = addPlaceholder("Unknown Parent");
      addRel(myParentId, newMemberId, "parent");

      if (parentRels.length > 0) {
        // My placeholder parent is a sibling of anchor's existing parent
        addRel(myParentId, parentRels[0].related_member_id, "sibling");
      } else {
        // Neither side has parents yet — create placeholder for anchor's parent too
        const anchorParentId = addPlaceholder("Unknown Parent");
        addRel(anchorParentId, anchorId, "parent");
        addRel(myParentId, anchorParentId, "sibling");
      }

    // ── 2ND COUSIN: grandparents are siblings (share a great-grandparent) ────
    } else if (relationship === "2nd_cousin") {
      // Walk up anchor's lineage to find/create a grandparent node
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
          // Anchor already has a grandparent — use it
          anchorGParentId = anchorGPRels[0].related_member_id;
        } else {
          // Anchor's parent has no parent yet — create grandparent placeholder
          anchorGParentId = addPlaceholder("Unknown Grandparent");
          addRel(anchorGParentId, anchorParentId, "parent");
        }
      } else {
        // Anchor has no parent yet — create parent + grandparent chain
        const phParentId = addPlaceholder("Unknown Parent");
        addRel(phParentId, anchorId, "parent");
        anchorGParentId = addPlaceholder("Unknown Grandparent");
        addRel(anchorGParentId, phParentId, "parent");
      }

      // My branch: my grandparent is a sibling of anchor's grandparent
      const myGParentId = addPlaceholder("Unknown Grandparent");
      addRel(myGParentId, anchorGParentId, "sibling");
      const myParentId = addPlaceholder("Unknown Parent");
      addRel(myGParentId, myParentId, "parent");
      addRel(myParentId, newMemberId, "parent");

    // ── 3RD COUSIN: great-grandparents are siblings (share great-great-gp) ─
    } else if (relationship === "3rd_cousin") {
      // Walk up 3 levels from anchor, creating placeholders as needed
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

      // My branch: my great-grandparent is a sibling of anchor's great-grandparent
      const myGGParentId = addPlaceholder("Unknown Great-Grandparent");
      addRel(myGGParentId, anchorGGParentId, "sibling");
      const myGParentId = addPlaceholder("Unknown Grandparent");
      addRel(myGGParentId, myGParentId, "parent");
      const myParentId = addPlaceholder("Unknown Parent");
      addRel(myGParentId, myParentId, "parent");
      addRel(myParentId, newMemberId, "parent");

    // ── STEP_PARENT: user is step-parent of anchor ───────────────────────────
    } else if (relationship === "step_parent") {
      addRel(newMemberId, anchorId, "step_parent");

    // ── NONE: place without any connection ───────────────────────────────────
    } else if (relationship === "none") {
      // No relationships added — node exists unconnected, can be linked later
    }

    // Persist everything
    const newMember = await TreeMember.create({
      _id: newMemberId,
      family_id: familyId,
      profile_id: userId,
      name: profile.name,
      gender: profile.gender ?? undefined,
      photo: profile.avatar ?? undefined,
      is_placeholder: false,
      is_deceased: false,
    });

    const placeholders =
      placeholderDocs.length > 0 ? await TreeMember.insertMany(placeholderDocs) : [];

    if (rels.length > 0) await TreeRelationship.insertMany(rels);

    // Clean up any placeholder nodes that are now fully disconnected
    const allRels = await TreeRelationship.find({ family_id: familyId }).lean();
    const connectedIds = new Set(allRels.flatMap((r) => [r.member_id, r.related_member_id]));
    await TreeMember.deleteMany({
      family_id: familyId,
      is_placeholder: true,
      _id: { $nin: Array.from(connectedIds) },
    });

    return NextResponse.json({ member: newMember, placeholders });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
