import mongoose from "mongoose";

const TodoSchema = new mongoose.Schema({
  _id: String,
  user_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

export const Todo = mongoose.models.Todo || mongoose.model("Todo", TodoSchema);
