/**
 * routes/auth.js
 *
 * Authentication routes for login, signup and logout. Uses express-validator
 * to validate form input and delegates core auth logic to
 * `controllers/auth` and Passport configuration in `config/passport`.
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { isGuest } = require('../middleware/auth');
const { body } = require('express-validator');
// Login validation rules
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];
// Signup validation rules
const signupValidation = [
  body('username')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
    .isAlphanumeric().withMessage('Username can only contain letters and numbers'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];

// Login routes
router.get('/login', isGuest, authController.getLogin);

router.post('/login', isGuest, loginValidation, authController.postLogin);

router.get('/signup', isGuest, authController.getSignup);

router.post('/signup', isGuest, signupValidation, authController.postSignup);

router.get('/logout', authController.logout);

module.exports = router;