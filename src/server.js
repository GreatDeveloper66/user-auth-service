import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";
import connectDB from "../config/db.js";
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  logoutUser,
  deleteUser,
  forgotPassword,
  resetPassword,
  sendLoginCode,
  loginWithCode
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
app.post("/api/forgot-password", forgotPassword);
app.post("/api/reset-password", resetPassword);
app.post("/api/send-login-code", sendLoginCode);
app.post("/api/login-with-code", loginWithCode);

// Vercel imports this file and serves the exported app. When run directly
// (npm run dev / npm start), listen on PORT so the service works locally.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

export default app;
