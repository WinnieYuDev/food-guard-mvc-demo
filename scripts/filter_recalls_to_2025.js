// scripts/filter_recalls_to_2025.js
// Usage:
//   node scripts/filter_recalls_to_2025.js --backup [--dry-run] [--apply]
// This script backs up recalls that are NOT published in 2025 and optionally
// deletes them from the database when `--apply` is provided.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const Recall = require('../models/Recall');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const doBackup = args.includes('--backup') || args.includes('-b');
const doApply = args.includes('--apply');

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const start2025 = new Date('2025-01-01T00:00:00Z');
    const start2026 = new Date('2026-01-01T00:00:00Z');

    // Query for recalls NOT in 2025
    const queryNot2025 = {
      $or: [
        { recallDate: { $lt: start2025 } },
        { recallDate: { $gte: start2026 } },
        { recallDate: { $exists: false } }
      ]
    };

    const toRemove = await Recall.find(queryNot2025).lean();
    console.log(`Found ${toRemove.length} recalls outside of 2025.`);

    if (doBackup) {
      const backupsDir = path.join(__dirname, '..', 'backups');
      try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (err) {}
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `recalls-non-2025-backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(toRemove, null, 2), 'utf8');
      console.log('Backup written to', backupPath);
    }

    if (dryRun) {
      console.log('Dry-run mode: no changes applied. Use --apply to delete the records above.');
      process.exit(0);
    }

    if (!doApply) {
      console.log('No --apply flag provided; exiting without deleting records. Use --apply to delete.');
      process.exit(0);
    }

    // Perform deletion
    const ids = toRemove.map(r => r._id);
    if (ids.length === 0) {
      console.log('Nothing to delete.');
      process.exit(0);
    }

    const res = await Recall.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${res.deletedCount || res.n || 0} recall(s) from the database.`);
    process.exit(0);
  } catch (err) {
    console.error('Operation failed:', err && err.message);
    process.exit(1);
  }
})();
