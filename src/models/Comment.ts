import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema(
  {
    _id: { type: String, required: true },
    post_id: { type: String, required: true },
    family_id: { type: String, required: true },
    author_id: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

commentSchema.index({ post_id: 1, created_at: 1 });

export const Comment =
  mongoose.models.Comment || mongoose.model("Comment", commentSchema);
