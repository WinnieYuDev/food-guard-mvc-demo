// scripts/query_wholesale.js
require('dotenv').config();
const connectDB = require('../config/database');
const Recall = require('../models/Recall');
const mongoose = require('mongoose');

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('Set MONGODB_URI in .env or environment');
      process.exit(1);
    }
    await connectDB();
    const q = { $or: [ { brand: /wholesale/i }, { title: /wholesale/i }, { product: /cantaloupe/i } ] };
    const docs = await Recall.find(q).lean();
    console.log(`Found ${docs.length} matching recalls`);
    for (const d of docs) {
      console.log('---');
      console.log('id:', d._id);
      console.log('title:', d.title);
      console.log('brand:', d.brand);
      console.log('product:', d.product);
      console.log('recallDate:', d.recallDate);
      console.log('category:', d.category);
      console.log('status:', d.status);
    }
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(2);
  }
})();
