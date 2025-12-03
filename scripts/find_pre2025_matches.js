require('dotenv').config();
const connectDB = require('../config/database');
const Recall = require('../models/Recall');

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const start2025 = new Date('2025-01-01T00:00:00Z');

    // Look for any recalls before 2025, missing recallDate, or matching Boar keywords
    const query = {
      $or: [
        { recallDate: { $lt: start2025 } },
        { recallDate: { $exists: false } },
        { title: /Boar/i },
        { product: /Boar/i },
        { brand: /Boar/i }
      ]
    };

    const matches = await Recall.find(query).lean();
    console.log(`Found ${matches.length} matching recall(s).`);
    for (const m of matches) {
      console.log('---');
      console.log('id:', m._id);
      console.log('title:', m.title);
      console.log('product:', m.product);
      console.log('brand:', m.brand);
      console.log('recallDate:', m.recallDate);
      console.log('agency:', m.agency);
      console.log('isActive:', m.isActive);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message);
    process.exit(1);
  }
})();
