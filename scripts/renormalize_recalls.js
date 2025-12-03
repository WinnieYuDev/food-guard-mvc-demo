// scripts/renormalize_recalls.js
// Run re-normalization of recalls in DB. Usage:
//   node scripts/renormalize_recalls.js [--dry-run|-n] [--backup|-b]

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

    if (dryRun) {
      const planned = [];
      for (const r of all) {
        try {
          const normalized = recallsController.normalizeRecallData(r);
          const changes = {};

          if ((r.title || '') !== (normalized.title || '')) changes.title = { before: r.title, after: normalized.title };
          if ((r.product || '') !== (normalized.product || '')) changes.product = { before: r.product, after: normalized.product };
          if ((r.brand || '') !== (normalized.brand || '')) changes.brand = { before: r.brand, after: normalized.brand };
          if ((r.category || '') !== (normalized.category || '')) changes.category = { before: r.category, after: normalized.category };
          if (JSON.stringify(r.tags || []) !== JSON.stringify(normalized.tags || [])) changes.tags = { before: r.tags || [], after: normalized.tags || [] };

          if (Object.keys(changes).length > 0) {
            planned.push({ _id: r._id, changes });
          }
        } catch (err) {
          console.error(`Failed to normalize ${r._id}:`, err && err.message);
        }
      }

      console.log(`Dry-run complete. Planned updates: ${planned.length}`);
      if (planned.length > 0) {
        console.log('\nSample planned changes (first 20):');
        planned.slice(0, 20).forEach((p, i) => {
          console.log(`${i + 1}. id=${p._id}`);
          Object.keys(p.changes).forEach(k => {
            const c = p.changes[k];
            console.log(`   - ${k}: '${String(c.before)}' => '${String(c.after)}'`);
          });
        });
      }

      process.exit(0);
    }

    // Not a dry run: perform the persistent re-normalization
    console.log('Starting re-normalization and persisting changes to the database...');
    const updatedCount = await recallsController.reNormalizeAllRecalls();
    console.log(`Re-normalization complete. Updated ${updatedCount} records.`);
    process.exit(0);
  } catch (error) {
    console.error('Renormalization failed:', error && error.message);
    process.exit(1);
  }
})();
