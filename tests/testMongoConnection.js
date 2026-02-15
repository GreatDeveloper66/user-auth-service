import connectDB from '../config/db.js';
import { describe, test } from 'node:test';
import assert from 'node:assert';


describe ('MongoDB Connection', () => {
    test('should connect to MongoDB successfully', async () => {
        try {
            await connectDB();
            console.log('MongoDB connection test passed');
            assert.ok(true); // Mark the test as passed
        } catch (error) {
            console.error('MongoDB connection test failed:', error);
            assert.fail('MongoDB connection test failed');
        }
    });
});

// describe('MongoDB Connection', () => {
//     it('should connect to MongoDB successfully', async () => {
//         try {
//             await connectDB();
//             console.log('MongoDB connection test passed');
//         } catch (error) {
//             console.error('MongoDB connection test failed:', error);
//             throw error; // Rethrow the error to fail the test
//         }
//     });
// });