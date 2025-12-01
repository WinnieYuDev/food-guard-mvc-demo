// scripts/tag_recalls.js
// Small migration: compute `tags` and ensure `category` for all recalls

require('dotenv').config();
const connectDB = require('../config/database');
const recallsController = require('../controllers/recalls');
const Recall = require('../models/Recall');

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const all = await Recall.find({}).lean();
    console.log(`Found ${all.length} recalls; processing...`);

    let updated = 0;
    for (const r of all) {
      try {
        const normalized = recallsController.normalizeRecallData(r);
        const setObj = {
          category: normalized.category,
          tags: normalized.tags || []
        };

        await Recall.updateOne({ _id: r._id }, { $set: setObj });
        updated++;
      } catch (err) {
        console.error(`Failed update ${r._id}:`, err && err.message);
      }
    }

    console.log(`Done. Updated ${updated}/${all.length} recalls.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error && error.message);
    process.exit(1);
  }
})();
