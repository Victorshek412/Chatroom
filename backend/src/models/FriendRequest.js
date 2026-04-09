import mongoose from "mongoose";

export const FRIEND_REQUEST_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

const buildRelationshipKey = (senderId, receiverId) =>
  [senderId, receiverId]
    .map((participantId) => participantId.toString())
    .sort()
    .join(":");

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
    relationshipKey: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

friendRequestSchema.index({ senderId: 1, receiverId: 1, status: 1 });
friendRequestSchema.index(
  { relationshipKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      relationshipKey: { $type: "string" },
      status: {
        $in: [FRIEND_REQUEST_STATUS.PENDING, FRIEND_REQUEST_STATUS.ACCEPTED],
      },
    },
  },
);
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

  if (this.senderId && this.receiverId) {
    this.relationshipKey = buildRelationshipKey(this.senderId, this.receiverId);
  }

  next();
});

const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);

export default FriendRequest;
