const express = require('express');
const router = express.Router();
const recallsController = require('../controllers/recalls');
const { isLoggedIn } = require('../middleware/auth');

// Recalls and product lookup page (must be logged in)
router.get('/', isLoggedIn, recallsController.getRecalls);

// Product lookup API endpoint (must be logged in)
router.post('/lookup', isLoggedIn, recallsController.lookupProduct);

module.exports = router;