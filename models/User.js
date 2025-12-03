const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
  // Pinned recalls saved by the user for quick access
  pinnedRecalls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recall'
  }],
  isActive: {
    type: Boolean,
    default: true // User account is active
  }
}, { 
  timestamps: true 
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next(); // Move to next middleware
  } catch (error) {
    next(error); // Pass error to next middleware
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password; // Remove password from JSON output
  return user;
};

module.exports = mongoose.model('User', userSchema);