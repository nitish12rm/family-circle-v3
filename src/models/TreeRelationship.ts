import mongoose, { Schema } from "mongoose";

const treeRelationshipSchema = new Schema(
  {
    _id: { type: String, required: true },
    family_id: { type: String, required: true, index: true },
    member_id: { type: String, required: true, index: true },
    related_member_id: { type: String, required: true },
    type: {
      type: String,
      enum: ["parent", "child", "spouse", "sibling"],
      required: true,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const TreeRelationship =
  mongoose.models.TreeRelationship ||
  mongoose.model("TreeRelationship", treeRelationshipSchema);
