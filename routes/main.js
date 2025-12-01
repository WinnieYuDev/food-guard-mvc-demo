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