import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  console.error("MONGODB URL NOT DEFINED");
  process.exit(1);
}

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const opts = {
    bufferCommands: false,
  };

  try {
    const conn = await mongoose.connect(MONGODB_URI, opts);
    console.log("MongoDB connected successfully");
    return conn;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}
