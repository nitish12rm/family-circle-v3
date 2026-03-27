import mongoose from "mongoose";

const UpdateSchema = new mongoose.Schema(
  {
    user_id:    { type: String, required: true },
    text:       { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const AssignmentSchema = new mongoose.Schema({
  _id:         String,
  family_id:   { type: String, required: true, index: true },
  title:       { type: String, required: true },
  description: { type: String, default: "" },
  assigner_id: { type: String, required: true },
  assignee_id: { type: String, required: true },
  deadline:    { type: Date, default: null },
  status:      { type: String, enum: ["yet_to_start", "in_progress", "finished"], default: "yet_to_start" },
  updates:     [UpdateSchema],
  created_at:  { type: Date, default: Date.now },
  updated_at:  { type: Date, default: Date.now },
});

export const Assignment =
  mongoose.models.Assignment || mongoose.model("Assignment", AssignmentSchema);
