import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import { describe, test, after } from 'node:test';
import assert from 'node:assert';

describe('MongoDB Connection', () => {
    after(() => mongoose.disconnect());

    test('should connect to MongoDB successfully', async () => {
        // connectDB logs failures instead of throwing, so check its return value.
        const connected = await connectDB();
        assert.strictEqual(connected, true, 'MongoDB connection failed; see the error logged above');
    });
});
