import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  _id: String,
  recipient_id: { type: String, required: true, index: true },
  actor_id:     { type: String, required: true },
  type: {
    type: String,
    enum: [
      "new_post",
      "post_like",
      "post_comment",
      "new_member",
      "new_dm",
      "new_group_message",
      "new_assignment",
      "assignment_update",
    ],
    required: true,
  },
  entity_id:  String,
  family_id:  String,
  meta:       mongoose.Schema.Types.Mixed,
  read:       { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

export const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
