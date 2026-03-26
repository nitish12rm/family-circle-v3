import mongoose, { Schema } from "mongoose";

const treeMemberSchema = new Schema(
  {
    _id: { type: String, required: true },
    family_id: { type: String, required: true, index: true },
    profile_id: String,
    name: { type: String, required: true },
    dob: String,
    dod: String,
    gender: { type: String, enum: ["male", "female", "other"] },
    photo: String,
    status: String,
    notes: String,
    is_placeholder: { type: Boolean, default: false },
    is_deceased: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const TreeMember =
  mongoose.models.TreeMember || mongoose.model("TreeMember", treeMemberSchema);
