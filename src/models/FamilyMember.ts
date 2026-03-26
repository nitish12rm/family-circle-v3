import mongoose, { Schema } from "mongoose";

const familyMemberSchema = new Schema(
  {
    _id: { type: String, required: true },
    family_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    joined_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

familyMemberSchema.index({ family_id: 1, user_id: 1 }, { unique: true });

export const FamilyMember =
  mongoose.models.FamilyMember ||
  mongoose.model("FamilyMember", familyMemberSchema);
