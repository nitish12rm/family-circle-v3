import mongoose, { Schema } from "mongoose";

const documentSchema = new Schema(
  {
    _id: { type: String, required: true },
    family_id: { type: String, required: true, index: true },
    uploaded_by: { type: String, required: true },
    member_id: String,
    name: { type: String, required: true },
    file_path: { type: String, required: true },
    file_size: { type: Number, required: true },
    mime_type: { type: String, required: true },
    description: String,
    category: { type: String, default: "Other" },
    visibility: { type: String, enum: ["public", "private"], default: "private" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const Document =
  mongoose.models.Document || mongoose.model("Document", documentSchema);
