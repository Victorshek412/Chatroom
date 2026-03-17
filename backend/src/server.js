import express from "express"; // Import Express framework
import cookieParser from "cookie-parser"; // Import cookie-parser middleware
import path from "path"; // Import path module for handling file paths
import cors from "cors"; // Import CORS middleware to enable Cross-Origin Resource Sharing

import authRoutes from "./routes/auth.route.js"; // Import authentication routes
import messageRoutes from "./routes/message.route.js"; // Import message routes
import { connectDB } from "./lib/db.js"; // Import database connection function
import { ENV } from "./lib/env.js"; // Import environment variables

const app = express();
const __dirname = path.resolve(); // Get current directory path

const PORT = ENV.PORT || 3000; // Use PORT from environment or default to 3000

app.use(express.json({ limit: "5mb" })); // req.body will be parsed as JSON with a size limit of 5mb
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true })); // Enable CORS for the specified client URL with credentials support
app.use(cookieParser()); // Parse cookies from incoming requests

app.use("/api/auth", authRoutes); // Mount authentication routes at /api/auth
app.use("/api/messages", messageRoutes); // Mount message routes at /api/messages

// Error handler for oversized JSON bodies and invalid JSON
app.use((err, req, res, next) => {
  if (
    err.type === "entity.too.large" ||
    err.status === 413 ||
    (err instanceof SyntaxError && err.status === 400)
  ) {
    return res.status(413).json({
      error: "Payload too large: request body must be <= 5mb",
    });
  }
  next(err);
});

// make ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  // Serve static files from React build

  app.get("*", (_, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
  });
} // Handle all other routes by serving the React app

app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
  connectDB(); // Connect to the database when server starts
});
