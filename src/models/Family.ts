import mongoose, { Schema } from "mongoose";

const familySchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    avatar: String,
    created_by: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Family =
  mongoose.models.Family || mongoose.model("Family", familySchema);
