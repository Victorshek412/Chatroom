import express from "express"; // Import Express framework
import dotenv from "dotenv"; // Load environment variables from .env file

import authRoutes from "./routes/auth.route.js"; // Import authentication routes
import messageRoutes from "./routes/message.route.js"; // Import message routes

dotenv.config(); // Load environment variables

const app = express();

const PORT = process.env.PORT || 3000; // Use PORT from environment or default to 3000

app.use("/api/auth", authRoutes); // Mount authentication routes at /api/auth
app.use("/api/messages", messageRoutes); // Mount message routes at /api/messages

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
