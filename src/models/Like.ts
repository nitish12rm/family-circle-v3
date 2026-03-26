import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
  {
    _id: { type: String, required: true },
    post_id: { type: String, required: true },
    user_id: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

likeSchema.index({ post_id: 1 });
likeSchema.index({ post_id: 1, user_id: 1 }, { unique: true });

export const Like = mongoose.models.Like || mongoose.model("Like", likeSchema);
