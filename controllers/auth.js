// Import our User model and required packages
const User = require('../models/User');
const passport = require('passport');

// Show login page
exports.getLogin = (req, res) => {
  res.render('login', {  // ← Changed from 'auth/login' to 'login'
    title: 'Login - FoodGuard'
  });
};

// Handle login form submission
exports.postLogin = (req, res, next) => {
  // Check database connection first
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    req.flash('error', 'Login service temporarily unavailable. Please try again later.');
    return res.redirect('/auth/login');
  }

  // Use Passport to authenticate user
  passport.authenticate('local', {
    successRedirect: '/', // Go to homepage if login works
    failureRedirect: '/auth/login', // Go back to login if fails
    failureFlash: true // Show error messages
  })(req, res, next);
};

// Show signup page
exports.getSignup = (req, res) => {
  res.render('signup', {  // ← Changed from 'auth/signup' to 'signup'
    title: 'Sign Up - FoodGuard'
  });
};

// Handle signup form submission
exports.postSignup = async (req, res) => {
  try {
    console.log('🔍 SIGNUP: Starting signup process...');
    
    // Get form data
    const { username, email, password, confirmPassword } = req.body;

    console.log('🔍 SIGNUP: Form data received', { username, email });

    // Check database connection first
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ SIGNUP: Database not connected');
      req.flash('error', 'Registration service temporarily unavailable. Please try again later.');
      return res.redirect('/auth/signup');
    }

    console.log('🔍 SIGNUP: Database connected, validating input...');

    // Basic validation
    if (!username || !email || !password || !confirmPassword) {
      req.flash('error', 'All fields are required');
      return res.redirect('/auth/signup');
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      console.log('❌ SIGNUP: Passwords do not match');
      req.flash('error', 'Passwords do not match');
      return res.redirect('/auth/signup');
    }

    if (password.length < 6) {
      console.log('❌ SIGNUP: Password too short');
      req.flash('error', 'Password must be at least 6 characters');
      return res.redirect('/auth/signup');
    }

    console.log('🔍 SIGNUP: Checking for existing user...');

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    console.log('🔍 SIGNUP: Existing user check result:', existingUser ? 'User exists' : 'No existing user');

    if (existingUser) {
      console.log('❌ SIGNUP: User already exists');
      req.flash('error', 'User already exists with this email or username');
      return res.redirect('/auth/signup');
    }

    console.log('🔍 SIGNUP: Creating new user...');

    // Create new user
    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });

    console.log('🔍 SIGNUP: Saving user to database...');

    // Save user to database
    await user.save();
    
    console.log('✅ SIGNUP: User saved successfully:', user._id);

    // Log the user in after signup
    req.login(user, (err) => {
      if (err) {
        console.error('❌ SIGNUP: Auto-login failed:', err);
        req.flash('success', 'Account created! Please log in.');
        return res.redirect('/auth/login');
      }
      console.log('✅ SIGNUP: User auto-logged in successfully');
      req.flash('success', 'Welcome to FoodGuard!');
      res.redirect('/');
    });

  } catch (error) {
    console.error('❌ SIGNUP: Error in catch block:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      req.flash('error', errors[0] || 'Validation error');
    } else if (error.code === 11000) {
      // MongoDB duplicate key error
      req.flash('error', 'User already exists with this email or username');
    } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
      req.flash('error', 'Database service unavailable. Please try again later.');
    } else {
      req.flash('error', 'Registration failed. Please try again.');
    }
    
    res.redirect('/auth/signup');
  }
};

// Handle user logout
exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.flash('success', 'Successfully logged out!');
    res.redirect('/');
  });
};  