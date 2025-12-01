/**
 * config/database.js
 *
 * MongoDB connection helper. Exports `connectDB()` which connects to the
 * database using `process.env.MONGODB_URI`. The function logs success or
 * exits the process on failure to make startup issues clear during dev.
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('MongoDB Connected Successfully!');
    console.log(`Database: ${mongoose.connection.name}`);
    
  } catch (error) {
    console.error('Database Connection Error:', error.message);
    process.exit(1); // Exit with error code (stops the app)
  }
};

module.exports = connectDB;