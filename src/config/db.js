const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Nếu không có MONGO_URI, skip MongoDB connection
        if (!process.env.MONGO_URI) {
            console.log('⚠️  No MONGO_URI found. Skipping MongoDB connection. Using JSON file storage instead.');
            return;
        }
        
        console.log('🔄 Attempting to connect to MongoDB...');
        console.log('📍 MongoDB URI:', process.env.MONGO_URI.replace(/\/\/.*:.*@/, '//***:***@')); // Hide credentials
        
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Giảm timeout xuống 5 giây
            connectTimeoutMS: 5000,
            socketTimeoutMS: 5000,
            bufferCommands: false // Tắt buffering để tránh timeout
        });
        
        console.log('✅ MongoDB connected successfully');
        console.log('🏢 Connected to:', conn.connection.host);
        console.log('📊 Database:', conn.connection.name);
        
        // Test connection
        await mongoose.connection.db.admin().ping();
        console.log('🏓 MongoDB ping successful');
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('🔍 Error details:', {
            name: error.name,
            code: error.code,
            codeName: error.codeName
        });
        console.log('📁 Falling back to JSON file storage');
        console.log('💡 To fix this issue:');
        console.log('   1. Install MongoDB: https://www.mongodb.com/try/download/community');
        console.log('   2. Start MongoDB service: mongod');
        console.log('   3. Or use MongoDB Atlas: https://cloud.mongodb.com/');
    }
};

// Connection event listeners
mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('🚨 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('📴 Mongoose disconnected from MongoDB');
});

module.exports = { connectDB };