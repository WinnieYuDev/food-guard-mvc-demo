// scripts/tag_recalls.js
// Migration: compute `tags` and ensure `category` for all recalls.
// Supports:
//   --dry-run, -n   : preview changes without writing to DB
//   --backup, -b    : create a JSON backup of existing recalls before updating

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const recallsController = require('../controllers/recalls');
const Recall = require('../models/Recall');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const doBackup = args.includes('--backup') || args.includes('-b');

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const all = await Recall.find({}).lean();
    console.log(`Found ${all.length} recalls; processing${dryRun ? ' (dry-run)' : ''}...`);

    if (doBackup) {
      const backupsDir = path.join(__dirname, '..', 'backups');
      try {
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
      } catch (mkdirErr) {
        console.error('Failed to create backups directory:', mkdirErr && mkdirErr.message);
        if (!dryRun) process.exit(1);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `recalls-backup-${timestamp}.json`);
      try {
        fs.writeFileSync(backupPath, JSON.stringify(all, null, 2), 'utf8');
        console.log(`Backup written to ${backupPath}`);
      } catch (writeErr) {
        console.error('Failed to write backup file:', writeErr && writeErr.message);
        if (!dryRun) process.exit(1);
      }
    }

    let updated = 0;
    const plannedChanges = [];

    for (const r of all) {
      try {
        const normalized = recallsController.normalizeRecallData(r);
        const setObj = {
          category: normalized.category,
          tags: normalized.tags || []
        };

        // Compare to current values to decide whether to update
        const curCategory = (r.category || '').toString();
        const curTags = Array.isArray(r.tags) ? r.tags.map(t => t.toString()) : [];

        const catChanged = setObj.category && setObj.category !== curCategory;
        const tagsChanged = JSON.stringify((setObj.tags || []).sort()) !== JSON.stringify((curTags || []).sort());

        if (catChanged || tagsChanged) {
          plannedChanges.push({ _id: r._id, before: { category: curCategory, tags: curTags }, after: setObj });

          if (!dryRun) {
            await Recall.updateOne({ _id: r._id }, { $set: setObj });
            updated++;
          }
        }
      } catch (err) {
        console.error(`Failed to process ${r._id}:`, err && err.message);
      }
    }

    console.log(`Processing complete. Planned changes: ${plannedChanges.length}${dryRun ? ' (no writes in dry-run)' : `; applied ${updated} updates`}`);

    // Print a short sample of planned changes for review
    if (plannedChanges.length > 0) {
      console.log('\nSample planned changes (first 10):');
      plannedChanges.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. id=${p._id} -> category: '${p.before.category}' => '${p.after.category}', tags: [${p.before.tags.join(', ')}] => [${p.after.tags.join(', ')}]`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error && error.message);
    process.exit(1);
  }
})();
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
