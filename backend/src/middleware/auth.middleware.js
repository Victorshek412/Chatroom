import jwt from "jsonwebtoken"; // Import jsonwebtoken for handling JWTs
import User from "../models/User.js"; // Import User model
import { ENV } from "../lib/env.js"; // Import environment variables

// Middleware to protect routes and ensure the user is authenticated
export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.token; // Get token from cookies
    if (!token) {
      return res
        .status(401)
        .json({ message: "unauthorized, no token provided" });
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET); // Verify token
    if (!decoded) {
      return res.status(401).json({ message: "unauthorized, invalid token" });
    } //why need decoded?
    // Decoded contains the payload of the token, which includes user information such as userId.
    // This information is necessary to identify the user making the request and to fetch their details from the database.

    const user = await User.findById(decoded.userId).select("-password"); // Find user by ID and exclude password field
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // Attach user object to request
    next(); // Continue to the next middleware or route handler
  } catch (error) {
    console.error("Error in protectRoute middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Middleware to restrict access based on user roles
