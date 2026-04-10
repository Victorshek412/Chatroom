import mongoose from "mongoose"; // Import Mongoose for MongoDB interaction
import { generateUniqueFriendId, parseFriendId } from "../lib/friendIds.js";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    friendId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: /^[A-Z0-9]{4}-[A-Z0-9]{4}$/,
    },
  },
  { timestamps: true },
); // Automatically manage createdAt & updatedAt fields

userSchema.pre("validate", async function ensureFriendId(next) {
  if (this.friendId) {
    const parsedFriendId = parseFriendId(this.friendId);

    if (!parsedFriendId) {
      this.invalidate("friendId", "Friend ID must be 8 letters or numbers.");
      return next();
    }

    this.friendId = parsedFriendId;
    return next();
  }

  try {
    this.friendId = await generateUniqueFriendId((candidate) =>
      this.constructor.exists({
        friendId: candidate,
        _id: { $ne: this._id },
      }),
    );
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("User", userSchema);
export default User; // Export the User model for use in other parts of the application
