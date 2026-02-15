import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const userName = process.env.MONGO_USERNAME;
const password = process.env.MONGO_PASSWORD;
const uri = `mongodb+srv://${userName}:${password}@cluster0.bd45ngl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

export default connectDB;