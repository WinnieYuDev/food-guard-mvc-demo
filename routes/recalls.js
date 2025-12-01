const express = require('express');
const router = express.Router();
const recallsController = require('../controllers/recalls');
const { isLoggedIn } = require('../middleware/auth');

// Main recalls page with filters
router.get('/', isLoggedIn, recallsController.getRecalls);

// Single recall detail page
router.get('/:id', isLoggedIn, recallsController.getRecall);

// API endpoint for AJAX calls
router.get('/api/search', recallsController.apiGetRecalls);

module.exports = router;