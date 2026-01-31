import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

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
      // todo:send a welcome email to the user
    } else {
      res.status(400).json({ message: "Invalid user data." }); // If user creation fails, return error
    }
  } catch (error) {
    console.log("error in sign up controller:", error);
    res.status(500).json({ message: "Internal Server error." }); // Handle server errors
  }
};
