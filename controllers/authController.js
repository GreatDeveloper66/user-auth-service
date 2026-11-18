// controllers/authController.js
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import emailService from "../services/emailService.js";
import { clientIp, ipBlockedSeconds, recordIpFailure, tooManyAttempts } from "../services/loginThrottle.js";

dotenv.config();

//helper function to create JWT token
const createJwtToken = (userId, expireTime) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: expireTime,
  });
};

// Request fields used in queries or comparisons must be non-empty strings.
// An omitted field would become { field: undefined }, which matches users missing that
// field, and an object such as { "$ne": null } would act as a query operator.
const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;

// A one-time code or token is valid only if one was issued, it matches exactly,
// and it has not expired. Without the first check, a missing code (undefined) would
// match a user who never requested one.
const isValidOneTimeSecret = (submitted, stored, expiresAt) =>
  isNonEmptyString(submitted) &&
  isNonEmptyString(stored) &&
  submitted === stored &&
  expiresAt != null &&
  Date.now() <= new Date(expiresAt).getTime();

// Brute-force limits for 6-digit codes. Counts live on the user document because
// Vercel runs many short-lived instances, so in-memory rate limiting would not hold.
const MAX_SECRET_ATTEMPTS = 5; // wrong guesses allowed per issued code or token
const RESEND_COOLDOWN_MS = 60 * 1000; // at most one new code or token per minute
const SECRET_TTL_MS = 15 * 60 * 1000; // codes and tokens expire after 15 minutes

const SECRET_FIELDS = {
  login: { secret: "verificationCode", expiresAt: "codeExpiresAt", attempts: "verificationAttempts", sentAt: "codeSentAt" },
  reset: { secret: "resetPasswordToken", expiresAt: "resetPasswordExpiresAt", attempts: "resetPasswordAttempts", sentAt: "resetPasswordSentAt" },
};

// Password guessing limit per account (the per-IP limit is in services/loginThrottle.js).
const MAX_PASSWORD_FAILURES = 10;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

const accountLockedSeconds = (user) => {
  if (!user.lockUntil) return 0;
  const remaining = new Date(user.lockUntil).getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

// Counts a wrong password atomically. Returns true if this failure locked the account.
const recordPasswordFailure = async (user) => {
  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $inc: { failedLoginAttempts: 1 } },
    { new: true }
  );
  if (updated && updated.failedLoginAttempts >= MAX_PASSWORD_FAILURES) {
    await User.updateOne(
      { _id: user._id },
      { $set: { lockUntil: new Date(Date.now() + ACCOUNT_LOCK_MS), failedLoginAttempts: 0 } }
    );
    return true;
  }
  return false;
};

const IP_LIMIT_MESSAGE = "Too many failed attempts from this network. Try again later.";

const generateSixDigitCode = () => randomInt(100000, 1000000).toString();

// Seconds the user must wait before another code or token can be sent, or 0.
const resendWaitSeconds = (user, kind) => {
  const sentAt = user[SECRET_FIELDS[kind].sentAt];
  if (!sentAt) return 0;
  const remaining = new Date(sentAt).getTime() + RESEND_COOLDOWN_MS - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

// Issues a fresh code or token and resets its attempt count.
const issueOneTimeSecret = async (user, kind) => {
  const f = SECRET_FIELDS[kind];
  const secret = generateSixDigitCode();
  user[f.secret] = secret;
  user[f.expiresAt] = Date.now() + SECRET_TTL_MS;
  user[f.attempts] = 0;
  user[f.sentAt] = Date.now();
  await user.save();
  return secret;
};

// Emails a freshly issued code or token. If sending fails, withdraws it and the
// resend cooldown (so the user can retry at once) and returns false.
// Logs only the error message, never the code or the recipient's details.
const deliverOneTimeSecret = async (user, kind, subject, html) => {
  try {
    await sendEmail(user.email, subject, html);
    return true;
  } catch (err) {
    console.error(`Email send failed (${kind}): ${err.message}`);
    const f = SECRET_FIELDS[kind];
    await User.updateOne(
      { _id: user._id },
      { $set: { [f.secret]: null, [f.expiresAt]: null, [f.attempts]: 0, [f.sentAt]: null } }
    );
    return false;
  }
};

const EMAIL_FAILED_MESSAGE = "Could not send the email. Please try again later.";

/**
 * Checks a submitted code or token. Returns "ok", "invalid", or "locked".
 * The attempt counter is incremented atomically before comparing, so parallel
 * guesses cannot exceed MAX_SECRET_ATTEMPTS. On "ok" or "locked" the secret is cleared.
 */
const verifyOneTimeSecret = async (user, kind, submitted) => {
  const f = SECRET_FIELDS[kind];
  const stored = user[f.secret];
  if (!isNonEmptyString(stored)) return "invalid";

  const counted = await User.findOneAndUpdate(
    { _id: user._id, [f.secret]: stored },
    { $inc: { [f.attempts]: 1 } },
    { new: true }
  );
  if (!counted) return "invalid"; // replaced or cleared by another request

  const clear = () =>
    User.updateOne({ _id: user._id }, { $set: { [f.secret]: null, [f.expiresAt]: null, [f.attempts]: 0 } });

  if (counted[f.attempts] > MAX_SECRET_ATTEMPTS) {
    await clear();
    return "locked";
  }
  if (!isValidOneTimeSecret(submitted, counted[f.secret], counted[f.expiresAt])) return "invalid";
  await clear();
  return "ok";
};

// Sends the matching HTTP error for a failed verifyOneTimeSecret result.
const rejectOneTimeSecret = (res, result, kind) => {
  const what = kind === "login" ? "code" : "token";
  if (result === "locked") {
    return res.status(429).json({ message: `Too many attempts. Request a new ${what}.` });
  }
  return res.status(400).json({ message: `Invalid or expired ${what}` });
};

const sendEmail = async (email, subject, message) => {
  // Implement email sending logic here
  await emailService.sendEmail(email, subject, message);
};

export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    if (phone !== undefined && !isNonEmptyString(phone)) {
      return res.status(400).json({ message: "Phone must be a string" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
    });

    //create a token and store it in a cookie or send it in response
    const token = createJwtToken(user._id, "1d");

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Authenticates a user by email or phone using either password or verification code.
 * 
 * @async
 * @function loginUser
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} [req.body.email] - User email address
 * @param {string} [req.body.phone] - User phone number
 * @param {string} [req.body.password] - User password for password-based login
 * @param {string} [req.body.code] - Verification code for code-based login
 * @param {Object} res - Express response object
 * @returns {Object} JSON response containing login status, user details, and JWT token
 * @throws {Error} Returns 404 if user not found
 * @throws {Error} Returns 400 if credentials are invalid, code is expired, or credentials are missing
 * @throws {Error} Returns 500 if server error occurs
 */
export const loginUser = async (req, res) => {
  try {
    const { email, phone, password, code } = req.body;
    const ip = clientIp(req);
    const ipWait = await ipBlockedSeconds(ip);
    if (ipWait > 0) return tooManyAttempts(res, ipWait, IP_LIMIT_MESSAGE);

    //🧠 1️⃣ Identify user by email or phone (only the identifiers actually sent)
    const identifiers = [];
    if (isNonEmptyString(email)) identifiers.push({ email });
    if (isNonEmptyString(phone)) identifiers.push({ phone });
    if (identifiers.length === 0) {
      return res.status(400).json({ message: "Email or phone is required" });
    }
    const user = await User.findOne({ $or: identifiers });
    if (!user) {
      await recordIpFailure(ip);
      return res.status(404).json({ message: "User not found" });
    }

    // 🧠 2️⃣ If login via password
    // 🔐 Password login

    if (isNonEmptyString(password)) {
      // Check the lock before comparing, so a locked account reveals nothing about the password.
      const lockWait = accountLockedSeconds(user);
      if (lockWait > 0) {
        return tooManyAttempts(res, lockWait, "Too many failed attempts. Account temporarily locked; try again later or log in with a code.");
      }
      const isMatch = isNonEmptyString(user.password) && (await bcrypt.compare(password, user.password));
      if (!isMatch) {
        await recordIpFailure(ip);
        if (await recordPasswordFailure(user)) {
          return tooManyAttempts(res, ACCOUNT_LOCK_MS / 1000, "Too many failed attempts. Account temporarily locked; try again later or log in with a code.");
        }
        return res.status(400).json({ message: "Invalid credentials" });
      }
      if (user.failedLoginAttempts || user.lockUntil) {
        await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
      }
    }
    // 🧠 3️⃣ If login via verification code
    // 🔢 Code login
    else if (code !== undefined) {
      const result = await verifyOneTimeSecret(user, "login", code);
      if (result !== "ok") {
        await recordIpFailure(ip);
        return rejectOneTimeSecret(res, result, "login");
      }
    }
    // 🧠 4️⃣ If neither provided
    else {
      return res.status(400).json({ message: "Missing credentials" });
    }
    // 🧠 5️⃣ Create session or token (for example, JWT)
    const token = createJwtToken(user._id, "1d");

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const sendLoginCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!isNonEmptyString(email)) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    } else {
      const wait = resendWaitSeconds(user, "login");
      if (wait > 0) {
        res.set("Retry-After", String(wait));
        return res.status(429).json({ message: `Please wait ${wait} seconds before requesting another code.` });
      }
      // Generate a verification code (valid 15 minutes, 5 attempts)
      const verificationCode = await issueOneTimeSecret(user, "login");

      const sent = await deliverOneTimeSecret(
        user,
        "login",
        "Your KitchenWise login code",
        `<p>Your KitchenWise login code is: <strong>${verificationCode}</strong></p><p>It expires in 15 minutes. If you didn't request it, you can ignore this email.</p>`
      );
      if (!sent) return res.status(502).json({ message: EMAIL_FAILED_MESSAGE });
      res.json({ message: "Verification code sent to email" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export const loginWithCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!isNonEmptyString(email) || !isNonEmptyString(code)) {
      return res.status(400).json({ message: "Email and code are required" });
    }
    const ip = clientIp(req);
    const ipWait = await ipBlockedSeconds(ip);
    if (ipWait > 0) return tooManyAttempts(res, ipWait, IP_LIMIT_MESSAGE);
    const user = await User.findOne({ email });
    if (!user) {
      await recordIpFailure(ip);
      return res.status(404).json({ message: "User not found" });
    } else {
      // Verify the code (clears it on success or after too many attempts)
      const result = await verifyOneTimeSecret(user, "login", code);
      if (result !== "ok") {
        await recordIpFailure(ip);
        return rejectOneTimeSecret(res, result, "login");
      } else {
        // Create a JWT token
        const token = createJwtToken(user._id, "1d");
        res.json({
          message: "Login successful",
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          token,
        });
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    // Invalidate token or session here if using server-side sessions
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      return res
        .status(200)
        .json({ message: "Logout successful: Remove token from client side" });
    } else {
      return res.status(400).json({ message: "No token provided" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
    const id = jwt.verify(token, process.env.JWT_SECRET).id;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phone = phone || user.phone;
    await user.updateOne(user);
    res.json({ message: "Profile updated", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const id = jwt.verify(token, process.env.JWT_SECRET).id;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    await user.deleteOne();
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!isNonEmptyString(email) || !isNonEmptyString(token) || !isNonEmptyString(newPassword)) {
      return res.status(400).json({ message: "Email, token, and newPassword are required" });
    }
    const ip = clientIp(req);
    const ipWait = await ipBlockedSeconds(ip);
    if (ipWait > 0) return tooManyAttempts(res, ipWait, IP_LIMIT_MESSAGE);
    const user = await User.findOne({ email });
    if (!user) {
      await recordIpFailure(ip);
      return res.status(404).json({ message: "User not found" });
    } else {
      // Verify the token (clears it on success or after too many attempts)
      const result = await verifyOneTimeSecret(user, "reset", token);
      if (result !== "ok") {
        await recordIpFailure(ip);
        return rejectOneTimeSecret(res, result, "reset");
      } else {
        // Hash and store the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // A successful reset also clears any password lockout.
        await User.updateOne(
          { _id: user._id },
          { $set: { password: hashedPassword, failedLoginAttempts: 0, lockUntil: null } }
        );
        res.json({ message: "Password reset successful" });
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!isNonEmptyString(email)) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    } else {
      const wait = resendWaitSeconds(user, "reset");
      if (wait > 0) {
        res.set("Retry-After", String(wait));
        return res.status(429).json({ message: `Please wait ${wait} seconds before requesting another token.` });
      }
      // Generate a password reset token (valid 15 minutes, 5 attempts)
      const resetToken = await issueOneTimeSecret(user, "reset");
      const sent = await deliverOneTimeSecret(
        user,
        "reset",
        "Your KitchenWise password reset code",
        `<p>Your KitchenWise password reset code is: <strong>${resetToken}</strong></p><p>It expires in 15 minutes. If you didn't request it, you can ignore this email; your password has not changed.</p>`
      );
      if (!sent) return res.status(502).json({ message: EMAIL_FAILED_MESSAGE });
      res.json({ message: "Password reset token sent to email" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




