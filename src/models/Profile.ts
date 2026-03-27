import mongoose, { Schema } from "mongoose";

const profileSchema = new Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    dob: String,
    phone: String,
    avatar: String,
    status: String,
    education: String,
    goals: String,
    gender: { type: String, enum: ["male", "female", "other"], default: null },
    onboarding_complete: { type: Boolean, default: false },
    last_seen: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Profile =
  mongoose.models.Profile || mongoose.model("Profile", profileSchema);
