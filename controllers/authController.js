// controllers/authController.js
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import emailService from "../services/emailService.js";

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
    //🧠 1️⃣ Identify user by email or phone (only the identifiers actually sent)
    const identifiers = [];
    if (isNonEmptyString(email)) identifiers.push({ email });
    if (isNonEmptyString(phone)) identifiers.push({ phone });
    if (identifiers.length === 0) {
      return res.status(400).json({ message: "Email or phone is required" });
    }
    const user = await User.findOne({ $or: identifiers });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🧠 2️⃣ If login via password
    // 🔐 Password login

    if (isNonEmptyString(password)) {
      const isMatch = isNonEmptyString(user.password) && (await bcrypt.compare(password, user.password));
      if (!isMatch)
        return res.status(400).json({ message: "Invalid credentials" });
    }
    // 🧠 3️⃣ If login via verification code
    // 🔢 Code login
    else if (code !== undefined) {
      if (!isValidOneTimeSecret(code, user.verificationCode, user.codeExpiresAt)) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }
      user.verificationCode = null;
      user.codeExpiresAt = null;
      await user.save();
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
      // Generate a verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const CodeExpiresAt = Date.now() + 15*60*1000; // Code valid for 15 minutes

      // Save the code and its expiration time to the user document
      user.verificationCode = verificationCode;
      user.codeExpiresAt = CodeExpiresAt;
      await user.save();

      // Send the code via email (implementation of sendEmail not shown here)
      // await sendEmail(user.email, "Your Verification Code", `Your code is: ${verificationCode}`);
      await sendEmail(user.email, "Your Verification Code", `<p>Your code is: ${verificationCode}</p>`);
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
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    } else {
      // Verify the code
      if (!isValidOneTimeSecret(code, user.verificationCode, user.codeExpiresAt)) {
        return res.status(400).json({ message: "Invalid or expired code" });
      } else {
        // Clear the code and expiration time
        user.verificationCode = null;
        user.codeExpiresAt = null;
        await user.save();
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
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    } else {
      // Verify the token
      if (!isValidOneTimeSecret(token, user.resetPasswordToken, user.resetPasswordExpiresAt)) {
        return res.status(400).json({ message: "Invalid or expired token" });
      } else {
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update the user's password and clear the reset token
        user.password = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpiresAt = null;
        await user.save();
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
      // Generate a password reset token
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
      const resetTokenExpiresAt = Date.now() + 15 * 60 * 1000; // Token valid for 15 minutes  
      // Save the token and its expiration time to the user document
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiresAt = resetTokenExpiresAt;
      await user.save();
      // Send the token via email
      await sendEmail(
        user.email,
        "Your Password Reset Token",
        `Your password reset token is: ${resetToken}`
      );
      res.json({ message: "Password reset token sent to email" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




