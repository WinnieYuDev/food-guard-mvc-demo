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

router.get('/posts/create', (req, res) => {
    res.render('create-post', {
        title: 'Create Post - FoodGuard'
    });
});

module.exports = router;