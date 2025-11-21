// Import mongoose - this library helps us talk to MongoDB
const mongoose = require('mongoose');

// Function to connect to our database
const connectDB = async () => {
  try {
    // Try to connect to MongoDB using the URL from .env file
    // Mongoose 8 is smart - it handles options automatically
    await mongoose.connect(process.env.MONGODB_URI);
    
    // If we get here, connection was successful!
    console.log('MongoDB Connected Successfully!');
    console.log(`Database: ${mongoose.connection.name}`);
    
  } catch (error) {
    // If connection fails, show error and stop the app
    console.error('Database Connection Error:', error.message);
    process.exit(1); // Exit with error code (stops the app)
  }
};

// Export the function so server.js can use it
module.exports = connectDB;