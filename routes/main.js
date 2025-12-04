/**
 * routes/main.js
 *
 * Primary site routes for the application (home, about, dashboard shortcuts).
 * Keeps routing minimal and forwards rendering responsibilities to the
 * `controllers/home` module where homepage data is prepared.
 */
const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');
const userController = require('../controllers/user');
const { isLoggedIn } = require('../middleware/auth');
// Homepage
router.get('/', homeController.getHome);

router.get('/about', (req, res) => {
    res.render('about', {
        title: 'About FoodGuard',
        stats: [],
        features: [],
        user: req.user
    });
});

router.get('/dashboard', (req, res) => {
    return res.redirect('/');
});

router.get('/tips', homeController.getTips);

// User profile
router.get('/me', isLoggedIn, userController.getProfile);
// Debug: return current user's pinnedRecalls (auth required)
router.get('/debug/my-pins', isLoggedIn, async (req, res) => {
    try {
        const User = require('../models/User');
        const u = await User.findById(req.user.id).populate('pinnedRecalls').lean();
        return res.json({ success: true, userId: req.user.id, pinnedCount: (u.pinnedRecalls || []).length, pinnedRecalls: u.pinnedRecalls || [] });
    } catch (err) {
        console.error('Debug my-pins error:', err && err.message);
        return res.status(500).json({ success: false, error: err && err.message });
    }
});
// Create post page
router.get('/posts/create', (req, res) => {
    res.render('create-post', {
        title: 'Create Post - FoodGuard'
    });
});

module.exports = router;