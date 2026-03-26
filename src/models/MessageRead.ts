import mongoose, { Schema } from "mongoose";

const messageReadSchema = new Schema({
  _id: { type: String, required: true },
  message_id: { type: String, required: true },
  user_id: { type: String, required: true },
  read_at: { type: Date, default: Date.now },
});

messageReadSchema.index({ message_id: 1, user_id: 1 }, { unique: true });
messageReadSchema.index({ user_id: 1 });

export const MessageRead =
  mongoose.models.MessageRead || mongoose.model("MessageRead", messageReadSchema);
