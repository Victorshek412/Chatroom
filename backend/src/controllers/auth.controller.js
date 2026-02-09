import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { ENV } from "../lib/env.js";
import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  // Here you would typically add logic to save the user to the database
  // and handle errors, hashing passwords, etc.

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    } // Basic validation

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long." });
    } // Password length validation
    // res.status(400): sets the HTTP status code to 400 (Bad Request)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    } // Email format validation

    const user = await User.findOne({ email }); // Check if user with the same email already exists
    if (user) {
      return res.status(400).json({ message: "Email already exists." });
    }
    // If user exists, return error
    //res.status(400): sets the HTTP status code to 400 (Bad Request)

    // Hash the password before saving 123456=>$2a$10$EixZaYVK1fsbw1Z
    const salt = await bcrypt.genSalt(10); // Generate a salt
    const hashedPassword = await bcrypt.hash(password, salt); // Hash the password with the salt

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    }); // Create a new user instance

    if (newUser) {
      const savedUser = await newUser.save(); // Save the new user to the database
      generateToken(savedUser._id, res); // A function that generate a token for
      //new user authentication and sends it in the response cookies

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePicture: newUser.profilePicture,
      });
      //res.status(201).json() is used to send a response back to the client indicating that a new resource has been successfully created.

      //welcome email
      try {
        await sendWelcomeEmail(
          savedUser.email,
          savedUser.fullName,
          ENV.CLIENT_URL,
        );
      } catch (error) {
        console.error("Failed to send welcome email:", error);
      }
    } else {
      res.status(400).json({ message: "Invalid user data." }); // If user creation fails, return error
    }
  } catch (error) {
    console.log("error in sign up controller:", error);
    res.status(500).json({ message: "Internal Server error." }); // Handle server errors
  }
};
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  } // Basic validation

  try {
    const user = await User.findOne({ email }); // Find user by email
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    } // If user not found, return error, do not say which one is incorrect for preventing enumeration

    const isPasswordMatch = await bcrypt.compare(password, user.password); // Compare provided password with hashed password
    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    } // If password does not match, return error

    generateToken(user._id, res); // Generate token for authenticated user

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePicture: user.profilePicture,
    }); // Send user data in response
  } catch (error) {
    console.error("error in login controller:", error);
    res.status(500).json({ message: "Internal server error." }); // Handle server errors
  }
};
export const logout = (req, res) => {
  res.cookie("token", "", { maxAge: 0 }); // Clear the token cookie by setting its maxAge to 0
  res.status(200).json({ message: "Logged out successfully." }); // Send success response
};
export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body; // Get profile picture data from request body
    if (!profilePic)
      return res.status(400).json({ message: "No profile picture provided." }); // Validate input
    const userId = req.user._id; // Get user ID from authenticated user (set by protectRoute middleware)

    // Upload profile picture to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(profilePic);
    // Update user's profile picture URL in the database

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: uploadResult.secure_url },
      { new: true },
    ).select("-password"); // Exclude password from returned document
    // Find user by ID and update profilePicture field with new URL

    res.status(200).json(updatedUser); // Send updated user data in response
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error." }); // Handle server errors
  }
};
