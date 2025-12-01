/**
 * controllers/auth.js
 *
 * Controller actions for user authentication: render login/signup pages,
 * handle signup and login form submissions, and perform logout.
 * This module uses `User` (Mongoose model) and Passport for authentication.
 */
// User model
const User = require('../models/User');
const passport = require('passport');

// Login page
exports.getLogin = (req, res) => {
  res.render('login', {  // Changed from 'auth/login' to 'login'
    title: 'Login - FoodGuard'
  });
};

// Login form submission
exports.postLogin = (req, res, next) => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    req.flash('error', 'Login service temporarily unavailable. Please try again later.');
    return res.redirect('/auth/login');
  }

  // Authenticate user
  passport.authenticate('local', {
    successRedirect: '/', // Go to homepage if login works
    failureRedirect: '/auth/login', // Go back to login if fails
    failureFlash: true // Show error messages
  })(req, res, next);
};

// Signup page
exports.getSignup = (req, res) => {
  res.render('signup', {  // Changed from 'auth/signup' to 'signup'
    title: 'Sign Up - FoodGuard'
  });
};

// Signup form submission
exports.postSignup = async (req, res) => {
  try {
    // Signup flow started
    const { username, email, password, confirmPassword } = req.body;

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      // Database not connected
      req.flash('error', 'Registration service temporarily unavailable. Please try again later.');
      return res.redirect('/auth/signup');
    }
    // Database connected, validating input...

    if (!username || !email || !password || !confirmPassword) {
      req.flash('error', 'All fields are required');
      return res.redirect('/auth/signup');
    }

    if (password !== confirmPassword) {
      // Passwords do not match
      req.flash('error', 'Passwords do not match');
      return res.redirect('/auth/signup');
    }

    if (password.length < 6) {
      // Password too short
      req.flash('error', 'Password must be at least 6 characters');
      return res.redirect('/auth/signup');
    }
    // Checking for existing user

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    // Existing user check result

    if (existingUser) {
      // User already exists
      req.flash('error', 'User already exists with this email or username');
      return res.redirect('/auth/signup');
    }
    // Creating new user

    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });

    await user.save();

    req.login(user, (err) => {
      if (err) {
        console.error('SIGNUP: Auto-login failed:', err);
        req.flash('success', 'Account created! Please log in.');
        return res.redirect('/auth/login');
      }
      // User auto-logged in successfully
      req.flash('success', 'Welcome to FoodGuard!');
      res.redirect('/');
    });

  } catch (error) {
  console.error('SIGNUP: Error in catch block:', error);
    // Error in signup flow
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      req.flash('error', errors[0] || 'Validation error');
    } else if (error.code === 11000) {
      req.flash('error', 'User already exists with this email or username');
    } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
      req.flash('error', 'Database service unavailable. Please try again later.');
    } else {
      req.flash('error', 'Registration failed. Please try again.');
    }
    
    res.redirect('/auth/signup');
  }
};

// Logout
exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.flash('success', 'Successfully logged out!');
    res.redirect('/');
  });
};  