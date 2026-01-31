import mongoose from "mongoose"; // Import Mongoose for MongoDB interaction

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
  },
  { timestamps: true },
); // Automatically manage createdAt & updatedAt fields

const User = mongoose.model("User", userSchema);
export default User; // Export the User model for use in other parts of the application
