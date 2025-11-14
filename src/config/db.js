const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Nếu không có MONGO_URI, skip MongoDB connection
        if (!process.env.MONGO_URI) {
            return;
        }
        
        
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Giảm timeout xuống 5 giây
            connectTimeoutMS: 5000,
            socketTimeoutMS: 5000,
            bufferCommands: false // Tắt buffering để tránh timeout
        });
        
        // Test connection
        await mongoose.connection.db.admin().ping();
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('🔍 Error details:', {
            name: error.name,
            code: error.code,
            codeName: error.codeName
        });
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