/**
 * routes/recalls.js
 *
 * Router for recall-related web pages
 */
const express = require('express');
const router = express.Router();
const recallsController = require('../controllers/recalls');

router.get('/', recallsController.getRecalls);

router.get('/news', recallsController.getNews);

router.get('/:id', recallsController.getRecall);

router.post('/lookup', recallsController.lookupProduct);

router.get('/api/recalls', recallsController.apiGetRecalls);

module.exports = router;