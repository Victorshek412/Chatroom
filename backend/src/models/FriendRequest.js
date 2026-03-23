import mongoose from "mongoose";

export const FRIEND_REQUEST_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

const friendRequestSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(FRIEND_REQUEST_STATUS),
      default: FRIEND_REQUEST_STATUS.PENDING,
    },
  },
  { timestamps: true },
);

friendRequestSchema.index({ senderId: 1, receiverId: 1, status: 1 });
friendRequestSchema.index({ receiverId: 1, status: 1, createdAt: -1 });
friendRequestSchema.index({ senderId: 1, status: 1, createdAt: -1 });

friendRequestSchema.pre("validate", function validateParticipants(next) {
  if (
    this.senderId &&
    this.receiverId &&
    this.senderId.toString() === this.receiverId.toString()
  ) {
    this.invalidate("receiverId", "You cannot send a friend request to yourself.");
  }

  next();
});

const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);

export default FriendRequest;
