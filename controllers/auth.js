const User = require('../models/User');
const passport = require('passport');

exports.getLogin = (req, res) => {
  res.render('login', {  // ← Changed from 'auth/login' to 'login'
    title: 'Login - FoodGuard'
  });
};

exports.postLogin = (req, res, next) => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    req.flash('error', 'Login service temporarily unavailable. Please try again later.');
    return res.redirect('/auth/login');
  }

  passport.authenticate('local', {
    successRedirect: '/', // Go to homepage if login works
    failureRedirect: '/auth/login', // Go back to login if fails
    failureFlash: true // Show error messages
  })(req, res, next);
};

exports.getSignup = (req, res) => {
  res.render('signup', {  // ← Changed from 'auth/signup' to 'signup'
    title: 'Sign Up - FoodGuard'
  });
};

exports.postSignup = async (req, res) => {
  try {
    console.log('🔍 SIGNUP: Starting signup process...');
    
    const { username, email, password, confirmPassword } = req.body;

    console.log('🔍 SIGNUP: Form data received', { username, email });

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ SIGNUP: Database not connected');
      req.flash('error', 'Registration service temporarily unavailable. Please try again later.');
      return res.redirect('/auth/signup');
    }

    console.log('🔍 SIGNUP: Database connected, validating input...');

    if (!username || !email || !password || !confirmPassword) {
      req.flash('error', 'All fields are required');
      return res.redirect('/auth/signup');
    }

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

    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });

    console.log('🔍 SIGNUP: Saving user to database...');

    await user.save();
    
    console.log('✅ SIGNUP: User saved successfully:', user._id);

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

exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.flash('success', 'Successfully logged out!');
    res.redirect('/');
  });
};  