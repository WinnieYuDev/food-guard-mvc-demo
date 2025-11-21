// Import mongoose and bcrypt for password hashing
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define what a User looks like in our database
// This is called a "schema" - it defines the structure of our data
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'], // Must have username
    unique: true, // No duplicate usernames allowed
    trim: true, // Remove extra spaces
    minlength: [3, 'Username must be at least 3 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // No duplicate emails allowed
    lowercase: true, // Store as lowercase
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  avatar: {
    type: String,
    default: null // Optional profile picture
  },
  isActive: {
    type: Boolean,
    default: true // User account is active
  }
}, { 
  // Automatically add createdAt and updatedAt fields
  timestamps: true 
});

// Hash password before saving user to database
// This runs automatically when we save a user
userSchema.pre('save', async function(next) {
  // Only hash password if it was modified (or new user)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt for hashing (12 rounds is secure but not too slow)
    const salt = await bcrypt.genSalt(12);
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    next(); // Move to next middleware
  } catch (error) {
    next(error); // Pass error to next middleware
  }
});

// Method to check if password is correct during login
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Don't send password when converting user to JSON (for security)
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password; // Remove password from JSON output
  return user;
};

// Create User model from schema
// This creates a "users" collection in MongoDB
module.exports = mongoose.model('User', userSchema);