// models/LoginThrottle.js
import mongoose from "mongoose";

// One document per client IP: failed login-type attempts in the current window.
// The TTL index deletes these counter documents (never users) once the window ends.
const loginThrottleSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

loginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("LoginThrottle", loginThrottleSchema);
