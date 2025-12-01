// scripts/renormalize.js
// Small utility to reconnect to the app's MongoDB and run reNormalizeAllRecalls()

require('dotenv').config();
const connectDB = require('../config/database');
const recallsController = require('../controllers/recalls');
const mongoose = require('mongoose');
const Recall = require('../models/Recall');

const USAGE = `Usage: node scripts/renormalize.js [--dry-run|-n]
Options:
  --dry-run, -n   Preview changes without writing to the database
`;

(async () => {
  try {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('-n');
    const backupFlag = args.includes('--backup') || args.includes('-b');

    console.log(dryRun ? 'Running re-normalization in DRY-RUN mode (no writes)...' : 'Starting re-normalization of recalls...');

    if (args.includes('--help') || args.includes('-h')) {
      console.log(USAGE);
      process.exit(0);
    }

    if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI is not set in environment. Set it in .env or the shell.');
      console.log(USAGE);
      process.exit(1);
    }

    await connectDB();

    const allRecalls = await Recall.find({}).lean();
    console.log(`Found ${allRecalls.length} recall(s) in database.`);

    let wouldChange = 0;
    let actuallyUpdated = 0;
    const diffs = [];

    for (const rec of allRecalls) {
      try {
        const normalized = recallsController.normalizeRecallData(rec);

        const fieldsToCheck = ['title', 'product', 'brand', 'description', 'reason', 'category'];
        const before = {};
        const after = {};
        let changed = false;

        for (const f of fieldsToCheck) {
          before[f] = (rec[f] === undefined || rec[f] === null) ? '' : String(rec[f]);
          after[f] = (normalized[f] === undefined || normalized[f] === null) ? '' : String(normalized[f]);
          if (before[f].trim() !== after[f].trim()) changed = true;
        }

        if (changed) {
          wouldChange++;
          diffs.push({ _id: rec._id, before, after });
          if (!dryRun) {
            // If backup requested, we'll export diffs before making changes
            await Recall.updateOne({ _id: rec._id }, { $set: {
              title: normalized.title,
              product: normalized.product,
              brand: normalized.brand,
              description: normalized.description,
              reason: normalized.reason,
              category: normalized.category,
              status: normalized.status
            }});
            actuallyUpdated++;
          }
        }
      } catch (innerErr) {
        console.error(`Failed to normalize recall ${rec._id}:`, innerErr && innerErr.message ? innerErr.message : innerErr);
      }
    }

    if (dryRun) {
      console.log(`\nDRY-RUN Summary: ${wouldChange} recall(s) WOULD be updated.`);
      console.log('Showing up to 10 sample diffs:');
      diffs.slice(0, 10).forEach((d, i) => {
        console.log(`\n#${i+1} id=${d._id}`);
        for (const k of Object.keys(d.before)) {
          if (d.before[k].trim() !== d.after[k].trim()) {
            console.log(`  - ${k}:`);
            console.log(`      BEFORE: ${d.before[k]}`);
            console.log(`      AFTER:  ${d.after[k]}`);
          }
        }
      });
    } else {
      // If not a dry-run and backup requested, write the affected records to a JSON file
      if (backupFlag && diffs.length > 0) {
        const fs = require('fs');
        const path = require('path');
        const backupsDir = path.join(__dirname, '..', 'backups');
        try {
          if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFile = path.join(backupsDir, `recalls-backup-${ts}.json`);
          // Fetch full records for those diffs to back up complete documents
          const ids = diffs.map(d => d._id);
          const fullRecords = await Recall.find({ _id: { $in: ids } }).lean();
          fs.writeFileSync(backupFile, JSON.stringify(fullRecords, null, 2), 'utf8');
          console.log(`Backup written to: ${backupFile}`);
        } catch (bkErr) {
          console.error('Failed to write backup file:', bkErr && bkErr.message ? bkErr.message : bkErr);
        }
      }

      console.log(`\nRe-normalization complete. Updated ${actuallyUpdated} recall(s).`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Re-normalization failed:', err && err.message ? err.message : err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(2);
  }
})();
