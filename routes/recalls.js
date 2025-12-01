const express = require('express');
const router = express.Router();
const recallsController = require('../controllers/recalls');
const { seedDatabase } = require('../utils/seedRecalls'); // Make sure this path is correct

// Main recalls page
router.get('/', recallsController.getRecalls);

// Single recall detail page
router.get('/:id', recallsController.getRecall);

// Product lookup API endpoint
router.post('/lookup', recallsController.lookupProduct);

// External API endpoint
router.get('/api/recalls', recallsController.apiGetRecalls);

// Add this route for seeding (remove in production)
router.get('/seed/recalls', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  
  try {
    const count = await seedDatabase();
    res.json({ 
      success: true, 
      message: `Successfully seeded ${count} recalls`,
      recalls: count
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Debug route to check retailers in database
router.get('/debug/retailers', async (req, res) => {
  try {
    const Recall = require('../models/Recall');
    const retailers = await Recall.aggregate([
      { $match: { isActive: true } },
      { $group: { 
        _id: '$retailer', 
        count: { $sum: 1 },
        examples: { $push: { title: '$title', id: '$_id' } }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      retailers: retailers,
      totalRecalls: retailers.reduce((sum, r) => sum + r.count, 0)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;