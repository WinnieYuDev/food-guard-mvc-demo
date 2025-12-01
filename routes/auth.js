const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { isGuest } = require('../middleware/auth');
const { body } = require('express-validator');

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const signupValidation = [
  body('username')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
    .isAlphanumeric().withMessage('Username can only contain letters and numbers'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];


router.get('/login', isGuest, authController.getLogin);

router.post('/login', isGuest, loginValidation, authController.postLogin);

router.get('/signup', isGuest, authController.getSignup);

router.post('/signup', isGuest, signupValidation, authController.postSignup);

router.get('/logout', authController.logout);

module.exports = router;