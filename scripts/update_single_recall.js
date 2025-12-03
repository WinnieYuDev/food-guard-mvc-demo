// scripts/update_single_recall.js
// Usage:
//   node scripts/update_single_recall.js --id <mongoObjectId>
//   node scripts/update_single_recall.js --recallId <recallId>
// Options: --dry-run | --backup

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const recallsController = require('../controllers/recalls');
const Recall = require('../models/Recall');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const doBackup = args.includes('--backup') || args.includes('-b');

const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const id = getArg('--id');
    const recallId = getArg('--recallId');

    if (!id && !recallId) {
      console.error('Please provide --id <mongoId> or --recallId <recallId>');
      process.exit(1);
    }

    let query = {};
    if (id) query._id = id;
    else query.recallId = recallId;

    const doc = await Recall.findOne(query).lean();
    if (!doc) {
      console.error('No recall found for query:', query);
      process.exit(1);
    }

    console.log('Found recall:');
    console.log(`  _id: ${doc._id}`);
    console.log(`  recallId: ${doc.recallId}`);
    console.log(`  title: ${doc.title}`);
    console.log(`  product: ${doc.product}`);
    console.log(`  brand: ${doc.brand}`);
    console.log(`  current category: ${doc.category}`);

    if (doBackup) {
      const backupsDir = path.join(__dirname, '..', 'backups');
      try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (err) {}
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `recall-${doc._id}-backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(doc, null, 2), 'utf8');
      console.log('Backup written to', backupPath);
    }

    const normalized = recallsController.normalizeRecallData(doc);

    console.log('Normalized values:');
    console.log(`  normalized category: ${normalized.category}`);
    console.log(`  normalized title: ${normalized.title}`);

    if (dryRun) {
      console.log('Dry-run: no changes applied.');
      process.exit(0);
    }

    const setObj = {
      title: normalized.title,
      product: normalized.product,
      brand: normalized.brand,
      description: normalized.description,
      reason: normalized.reason,
      category: normalized.category,
      tags: normalized.tags || []
    };

    await Recall.updateOne({ _id: doc._id }, { $set: setObj });
    console.log('Update applied. New category:', normalized.category);
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err && err.message);
    process.exit(1);
  }
})();
