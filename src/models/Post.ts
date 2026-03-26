import mongoose, { Schema } from "mongoose";

const postSchema = new Schema(
  {
    _id: { type: String, required: true },
    family_id: { type: String, required: true, index: true },
    author_id: { type: String, required: true },
    content: { type: String, required: true },
    media_urls: { type: [String], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

postSchema.index({ family_id: 1, created_at: -1 });

export const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
