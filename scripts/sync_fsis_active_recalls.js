// scripts/sync_fsis_active_recalls.js
// Usage:
//  node scripts/sync_fsis_active_recalls.js --backup [--dry-run]
// This script will (1) backup existing recalls, (2) remove all recalls
// from the local database, then (3) fetch active recalls from FSIS and
// persist them locally so the app only displays FSIS active recalls.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const recallApi = require('../services/recallAPI');
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
    console.log(`Found ${all.length} existing recalls in DB.`);

    if (doBackup) {
      const backupsDir = path.join(__dirname, '..', 'backups');
      try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (err) {}
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `recalls-full-backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(all, null, 2), 'utf8');
      console.log('Backup written to', backupPath);
    }

    if (dryRun) {
      console.log('Dry-run: no DB changes will be made. Next step would be to delete all recalls and re-populate with active FSIS recalls.');
      process.exit(0);
    }

    // Delete all existing recalls
    console.log('Deleting all existing recalls from database...');
    await Recall.deleteMany({});
    console.log('Deleted existing recalls.');

    // Fetch active FSIS recalls
    console.log('Fetching FSIS recalls (active only)...');
    const fsis = await recallApi.fetchFSISRecalls({ limit: 1000, monthsBack: 12 });
    const active = (fsis || []).filter(r => r.isActive);

    console.log(`Fetched ${fsis.length} FSIS recalls; ${active.length} active will be saved.`);

    // Persist active FSIS recalls into DB using controller helper
    const saved = await recallsController.saveApiResultsToDB(active);
    console.log(`Saved ${saved} new FSIS recalls into the database.`);

    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err && err.message);
    process.exit(1);
  }
})();
