import express from "express"; // Import Express framework
import path from "path"; // Import path module for handling file paths

import authRoutes from "./routes/auth.route.js"; // Import authentication routes
import messageRoutes from "./routes/message.route.js"; // Import message routes
import { connectDB } from "./lib/db.js"; // Import database connection function
import { ENV } from "./config/env.js"; // Import environment variables

const app = express();
const __dirname = path.resolve(); // Get current directory path

const PORT = ENV.PORT || 3000; // Use PORT from environment or default to 3000

app.use(express.json()); // Parse JSON request bodies

app.use("/api/auth", authRoutes); // Mount authentication routes at /api/auth
app.use("/api/messages", messageRoutes); // Mount message routes at /api/messages

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
