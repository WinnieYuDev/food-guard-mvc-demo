const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { isGuest } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation rules for login form
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Validation rules for signup form
const signupValidation = [
  body('username')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
    .isAlphanumeric().withMessage('Username can only contain letters and numbers'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];

// Auth routes

// Show login page (only for guests - not logged in users)
router.get('/login', isGuest, authController.getLogin);

// Handle login form (only for guests)
router.post('/login', isGuest, loginValidation, authController.postLogin);

// Show signup page (only for guests)
router.get('/signup', isGuest, authController.getSignup);

// Handle signup form (only for guests)
router.post('/signup', isGuest, signupValidation, authController.postSignup);

// Handle logout
router.get('/logout', authController.logout);

module.exports = router;