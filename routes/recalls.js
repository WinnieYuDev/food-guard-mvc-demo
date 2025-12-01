const express = require('express');
const router = express.Router();
const recallsController = require('../controllers/recalls');
const { isLoggedIn } = require('../middleware/auth');

// Main recalls page with filters
router.get('/', isLoggedIn, recallsController.getRecalls);

// Single recall detail page
router.get('/:id', isLoggedIn, recallsController.getRecall);

// Sync recalls from APIs
router.post('/sync', isLoggedIn, recallsController.syncRecalls);

// API endpoints
router.get('/api/search', recallsController.apiGetRecalls);

module.exports = router;

//test api endpoint
router.get('/api/test', async (req, res) => {
  try {
    const apiStatus = await recallApiService.testAPIs();
    res.json({
      success: true,
      apis: apiStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});