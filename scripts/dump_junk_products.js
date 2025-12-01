// scripts/dump_junk_products.js
require('dotenv').config();
const connectDB = require('../config/database');
const Recall = require('../models/Recall');
const mongoose = require('mongoose');

(async () => {
  try {
    await connectDB();
    const docs = await Recall.find({ product: { $regex: '^\\s*[\\d\\/\\-\\,\\s]{1,10}$' } }).lean();
    console.log(`Found ${docs.length} junk-product recalls`);
    for (const d of docs) {
      console.log('---');
      console.log('id:', d._id);
      console.log('title:', d.title);
      console.log('brand:', d.brand);
      console.log('product:', d.product);
      console.log('rawData keys:', d.rawData ? Object.keys(d.rawData).slice(0,20) : 'no rawData');
      if (d.rawData) console.log('sample rawData.product_description:', d.rawData.product_description || d.rawData.Product || d.rawData.field_title || '---');
      console.log('description (first 200 chars):', d.description ? String(d.description).slice(0,200) : '');
    }
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(2);
  }
})();
