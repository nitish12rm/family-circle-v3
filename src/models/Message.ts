import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    _id: { type: String, required: true },
    family_id: { type: String, required: true, index: true },
    sender_id: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

messageSchema.index({ family_id: 1, created_at: 1 });

export const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);
