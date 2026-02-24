import express from "express";
import {
  signup,
  login,
  logout,
  updateProfile,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import arcjet from "@arcjet/node";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection);

router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", logout);
// why use post for login and signup instead of get?
// POST is used for login and signup because these operations involve sending sensitive information (like passwords) in the request body.
// Using POST helps to keep this information out of the URL, which can be logged or cached, enhancing security.
// Additionally, POST requests are designed for actions that change server state (like creating a new user), whereas GET requests are intended for retrieving data without side effects.

router.put("/update-profile", protectRoute, updateProfile);

router.get("/check", protectRoute, (req, res) => {
  res.status(200).json({ message: "You are logged in.", user: req.user });
});
// The /check route is protected by the protectRoute middleware, which ensures that only authenticated users can access it.
// If the user is authenticated, it responds with a message confirming the login status and includes the user information.
export default router; // Export the router to be used in other parts of the application
