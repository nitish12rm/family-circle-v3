import mongoose, { Schema } from "mongoose";

const dmSchema = new Schema(
  {
    _id: { type: String, required: true },
    sender_id: { type: String, required: true },
    recipient_id: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

dmSchema.index({ sender_id: 1, recipient_id: 1, created_at: 1 });
dmSchema.index({ recipient_id: 1, created_at: 1 });

export const DirectMessage =
  mongoose.models.DirectMessage || mongoose.model("DirectMessage", dmSchema);
