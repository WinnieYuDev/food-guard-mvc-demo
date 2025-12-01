// scripts/test_home_title.js
require('dotenv').config();
const connectDB = require('../config/database');
const Recall = require('../models/Recall');
const recallsController = require('../controllers/recalls');
const mongoose = require('mongoose');

(async () => {
  try {
    await connectDB();
    const doc = await Recall.findOne({ brand: /wholesale/i }).lean();
    if (!doc) { console.log('No wholesale doc found'); process.exit(0); }
    const normalized = recallsController.normalizeRecallData(doc);
    const junkProductPattern = /^\s*$|^[\d\-\/\s,:]+$/;
    let cleanedTitle = '';
    if (normalized.product && !junkProductPattern.test(normalized.product) && normalized.product !== 'Unknown Product') {
      cleanedTitle = (normalized.product + (normalized.brand ? ` - ${normalized.brand}` : '')).trim();
    } else if (normalized.title && !junkProductPattern.test(normalized.title) && String(normalized.title).split(' - ')[0].trim().length > 2) {
      cleanedTitle = normalized.title;
    } else {
      cleanedTitle = normalized.brand || normalized.title || 'Product Recall';
    }

    console.log('DB title:', doc.title);
    console.log('Normalized title:', normalized.title);
    console.log('Computed cleanedTitle for UI:', cleanedTitle);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(2);
  }
})();
