import mongoose from "mongoose"; // Import Mongoose for MongoDB interaction
import { ENV } from "./env.js"; // Import environment variables
export const connectDB = async () => {
  try {
    const { MONGODB_URI } = ENV;
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    } // Check if MONGO_URI is defined in environment variables

    const conn = await mongoose.connect(MONGODB_URI);
    console.log("MONGODB CONNECTED:", conn.connection.host);
  } catch (error) {
    console.error("Error connection to MONGODB:", error);
    process.exit(1); // 1 status code means fail, 0 means success
  }
};
