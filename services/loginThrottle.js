// services/loginThrottle.js
// Per-IP limit on failed logins, code logins, and password resets, across all accounts.
// Stored in MongoDB because Vercel's serverless instances do not share memory.
import LoginThrottle from "../models/LoginThrottle.js";

export const MAX_FAILURES_PER_IP = 30;
const WINDOW_MS = 15 * 60 * 1000;

// Vercel sets x-forwarded-for to the real client IP (it overwrites any client-sent value).
// Locally the header can be spoofed, which only matters for local testing.
export const clientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const first = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return first || req.socket?.remoteAddress || "unknown";
};

// Seconds until this IP may try again, or 0 if it is under the limit.
export const ipBlockedSeconds = async (ip) => {
  const doc = await LoginThrottle.findOne({ key: ip }).lean();
  if (!doc || doc.count < MAX_FAILURES_PER_IP) return 0;
  const remaining = new Date(doc.expiresAt).getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

// Counts one failure for this IP. The window starts at the first failure.
export const recordIpFailure = async (ip) => {
  const now = Date.now();
  // The TTL monitor runs about once a minute, so drop an expired window ourselves.
  await LoginThrottle.deleteOne({ key: ip, expiresAt: { $lte: new Date(now) } });
  try {
    await LoginThrottle.updateOne(
      { key: ip },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now + WINDOW_MS) } },
      { upsert: true }
    );
  } catch (err) {
    // Two first failures at once can race on the unique key; retry once as a plain increment.
    if (err.code === 11000) await LoginThrottle.updateOne({ key: ip }, { $inc: { count: 1 } });
    else throw err;
  }
};

// Sends 429 with Retry-After. Returns the response for `return tooManyAttempts(...)`.
export const tooManyAttempts = (res, seconds, message) => {
  res.set("Retry-After", String(seconds));
  return res.status(429).json({ message });
};
