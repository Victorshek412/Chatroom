import express from "express";

const router = express.Router();

const PORT = process.env.PORT || 3000;

router.get("/signup", (req, res) => {
  res.send("Signup endpoint");
});

router.get("/login", (req, res) => {
  res.send("Login endpoint");
});

router.get("/logout", (req, res) => {
  res.send("Logout endpoint");
});

export default router; // Export the router to be used in other parts of the application
