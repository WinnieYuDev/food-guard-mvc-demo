/**
 * routes/recalls.js
 *
 * Router for recall-related web pages
 */
const express = require('express');
const router = express.Router();
const recallsController = require('../controllers/recalls');
const userController = require('../controllers/user');
const { isLoggedIn } = require('../middleware/auth');
// Recall listing and detail pages
router.get('/', recallsController.getRecalls);

router.get('/news', recallsController.getNews);

router.get('/:id', recallsController.getRecall);

router.post('/lookup', recallsController.lookupProduct);

router.get('/api/recalls', recallsController.apiGetRecalls);

// Pin/unpin recalls (requires auth)
router.post('/:id/pin', isLoggedIn, userController.pinRecall);
router.post('/:id/unpin', isLoggedIn, userController.unpinRecall);
// Pin by provider recallId (create/upsert then pin)
router.post('/pin-by/:recallId', isLoggedIn, userController.pinRecallByRecallId);

module.exports = router;