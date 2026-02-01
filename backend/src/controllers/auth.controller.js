import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { ENV } from "../config/env.js";
import { sendWelcomeEmail } from "../emails/emailHandlers.js";

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
        // 1. The function sendWelcomeEmail is called with three arguments: savedUser.email, savedUser.fullName, and ENV.CLIENT_URL.
        // 2. savedUser.email: This is the email address of the newly created user, which is retrieved from the savedUser object after saving it to the database.
        // 3. savedUser.fullName: This is the full name of the newly created user, also retrieved from the savedUser object.
        // 4. ENV.CLIENT_URL: This retrieves the client URL from the environment variables (defined in src/lib/env.js), which is typically the URL of the frontend application.
        // 5. The sendWelcomeEmail function uses these parameters to compose and send a welcome email to the new user, providing them with a personalized greeting and a link to access the client application.
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
