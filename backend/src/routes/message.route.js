import express from "express";

const router = express.Router();

router.get("/send", (req, res) => {
  res.send("Send Messages endpoint");
});

export default router; // Export the router to be used in other parts of the application
