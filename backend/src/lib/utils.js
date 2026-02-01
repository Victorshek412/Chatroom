import jwt from "jsonwebtoken";
import { ENV } from "../env.js";
export const generateToken = (userId, res) => {
  const { JWT_SECRET } = ENV;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "7d",
  }); // Token valid for 7 days
  //jwt.sign(): creates a JWT token using the user's ID and a secret key from environment variables.
  //expiresIn: "7d": sets the token to expire in 7 days.

  res.cookie("token", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    httpOnly: true, // Prevent XSS attacks
    sameSite: "strict", // Prevent CSRF attacks
    secure: ENV.NODE_ENV === "development" ? false : true, // explain this line
    // Sets the cookie to be secure (HTTPS) in production, but not in development
    //since development often runs on HTTP.
    // Setting secure to true ensures that the cookie is only sent over HTTPS connections,
    // enhancing security in a production environment.
  });

  return token; // Return the generated token
};
