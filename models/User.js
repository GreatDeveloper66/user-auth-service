// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    password: String,
    googleId: { type: String, unique: true, sparse: true },
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,


    // 🧠 for verification / OTP login
    verificationCode: String,
    codeExpiresAt: Date,

    // Brute-force limits for the 6-digit login code and reset token
    // (see verifyOneTimeSecret in controllers/authController.js).
    verificationAttempts: { type: Number, default: 0 },
    codeSentAt: Date,
    resetPasswordAttempts: { type: Number, default: 0 },
    resetPasswordSentAt: Date,
  },
  { timestamps: true }
);

// Expired codes are rejected by the login handlers. Do not add a TTL index on
// codeExpiresAt: a TTL index deletes the whole user document, not just the code.

export default mongoose.model("User", userSchema);