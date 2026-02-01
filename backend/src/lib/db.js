import mongoose from "mongoose"; // Import Mongoose for MongoDB interaction
import { ENV } from "../config/env.js"; // Import environment variables
export const connectDB = async () => {
  try {
    const { MONGO_URI } = ENV;
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    } // Check if MONGO_URI is defined in environment variables

    const conn = await mongoose.connect(ENV.MONGO_URI);
    console.log("MONGODB CONNECTED:", conn.connection.host);
  } catch (error) {
    console.error("Error connection to MONGODB:", error);
    process.exit(1); // 1 status code means fail, 0 means success
  }
};
