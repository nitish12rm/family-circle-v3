import mongoose, { Schema } from "mongoose";

const familyInviteSchema = new Schema(
  {
    _id: { type: String, required: true },
    family_id: { type: String, required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    created_by: { type: String, required: true },
    expires_at: { type: Date, required: true },
    max_uses: { type: Number, default: 100 },
    use_count: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const FamilyInvite =
  mongoose.models.FamilyInvite ||
  mongoose.model("FamilyInvite", familyInviteSchema);
