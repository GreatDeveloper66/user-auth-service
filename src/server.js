import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  logoutUser,
  deleteUser,
} from "../controllers/authController.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Example route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello, World!" });
});

app.post("/api/register", registerUser);
app.post("/api/login", loginUser);
app.get("/api/profile", getUserProfile); // This route will be protected by auth middleware in a real application
app.patch("/api/update-profile", updateUserProfile); // This route will also be protected by auth middleware in a real application
app.post("/api/logout", logoutUser);
app.delete("/api/delete-user", deleteUser); // This route will also be protected by auth middleware in a real application

export default app;
