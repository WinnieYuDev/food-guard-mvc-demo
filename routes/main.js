const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');

// Homepage/Dashboard
router.get('/', homeController.getHome);

// Create post page (optional - can remove if using modal)
router.get('/posts/create', (req, res) => {
    res.render('create-post', {
        title: 'Create Post - FoodGuard'
    });
});

module.exports = router;