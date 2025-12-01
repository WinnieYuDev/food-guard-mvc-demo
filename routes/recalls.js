/**
 * routes/recalls.js
 *
 * Router for recall-related web pages and diagnostic/debug endpoints.
 * Connects HTTP routes to controller actions in `controllers/recalls`.
 * Includes JSON API endpoints and lightweight debug helpers used during
 * development to validate upstream API availability.
 */
const express = require('express');
const router = express.Router();
const recallsController = require('../controllers/recalls');

console.log('Recalls controller loaded:', {
  getRecalls: typeof recallsController.getRecalls,
  getRecall: typeof recallsController.getRecall,
  lookupProduct: typeof recallsController.lookupProduct,
  apiGetRecalls: typeof recallsController.apiGetRecalls
});

router.get('/', recallsController.getRecalls);

router.get('/news', recallsController.getNews);

router.get('/:id', recallsController.getRecall);

router.post('/lookup', recallsController.lookupProduct);

router.get('/api/recalls', recallsController.apiGetRecalls);

router.get('/debug/apis', async (req, res) => {
  try {
    const recallApiService = require('../services/recallAPI');
    const axios = require('axios');
    
    console.log('Testing government APIs...');
    
    let fdaStatus = 'unknown';
    let fdaCount = 0;
    try {
      const fdaResponse = await axios.get('https://api.fda.gov/food/enforcement.json?limit=5', {
        timeout: 10000
      });
      fdaStatus = 'working';
      fdaCount = fdaResponse.data.results?.length || 0;
      console.log('FDA API working:', fdaCount, 'recalls');
    } catch (fdaError) {
      fdaStatus = 'failed: ' + fdaError.message;
      console.log('FDA API failed:', fdaError.message);
    }
    
    let fsisStatus = 'unknown';
    let fsisCount = 0;
    try {
      const fsisResponse = await axios.get('https://www.fsis.usda.gov/fsis/api/recall/v1/recalls', {
        timeout: 15000
      });
      fsisStatus = 'working';
      fsisCount = Array.isArray(fsisResponse.data) ? fsisResponse.data.length : 'unknown';
      console.log('FSIS API working:', fsisCount, 'recalls');
    } catch (fsisError) {
      fsisStatus = 'failed: ' + fsisError.message;
      console.log('FSIS API failed:', fsisError.message);
    }
    
    let serviceStatus = 'unknown';
    let serviceCount = 0;
    try {
      const recalls = await recallApiService.fetchAllRecalls({ limit: 10 });
      serviceStatus = 'working';
      serviceCount = recalls.length;
      console.log('Recall service working:', serviceCount, 'recalls');
    } catch (serviceError) {
      serviceStatus = 'failed: ' + serviceError.message;
      console.log('Recall service failed:', serviceError.message);
    }
    
    res.json({
      success: true,
      apis: {
        fda: { status: fdaStatus, recalls: fdaCount },
        fsis: { status: fsisStatus, recalls: fsisCount },
        service: { status: serviceStatus, recalls: serviceCount }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/debug/current', async (req, res) => {
  try {
    const recallApiService = require('../services/recallAPI');
    
    console.log('Fetching current recalls from APIs...');
    const recalls = await recallApiService.fetchAllRecalls({ limit: 20 });
    
    res.json({
      success: true,
      recalls: recalls.map(recall => ({
        id: recall.recallId,
        title: recall.title,
        product: recall.product,
        brand: recall.brand,
        agency: recall.agency,
        date: recall.recallDate,
        risk: recall.riskLevel,
        source: recall.source
      })),
      total: recalls.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug current error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;