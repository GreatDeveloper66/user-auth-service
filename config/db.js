import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// MONGO_URI is the full connection string (the same variable plan-storage uses).
// Temporary fallback: build the old Atlas URI from MONGO_USERNAME/MONGO_PASSWORD so deploys
// keep working until MONGO_URI is set in every environment. Remove it after that.
const getMongoUri = () => {
    if (process.env.MONGO_URI) return process.env.MONGO_URI;
    const userName = process.env.MONGO_USERNAME;
    const password = process.env.MONGO_PASSWORD;
    if (userName && password) {
        console.warn('MONGO_URI is not set; falling back to MONGO_USERNAME/MONGO_PASSWORD and the hardcoded Atlas host.');
        return `mongodb+srv://${userName}:${password}@cluster0.bd45ngl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
    }
    return null;
};

// Logs connection failures instead of exiting, so routes that don't need the database
// (such as /api/health) keep working. Database routes fail with a 500 until it's reachable.
// Returns true if connected, false otherwise. Never log the URI itself: it contains the password.
const connectDB = async () => {
    const uri = getMongoUri();
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
