import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Logs connection failures instead of exiting, so routes that don't need the database
// (such as /api/health) keep working. Database routes fail with a 500 until it's reachable.
// Returns true if connected, false otherwise. Never log the URI itself: it contains the password.
const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MongoDB not configured: set MONGO_URI.');
        return false;
    }
    try {
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return true;
    } catch (error) {
        console.error(`MongoDB connection failed: ${error.message}`);
        return false;
    }
};

export default connectDB;
