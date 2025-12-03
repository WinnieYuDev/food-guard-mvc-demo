// scripts/remove_source_field.js
// Usage: node scripts/remove_source_field.js [--backup]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const Recall = require('../models/Recall');

const args = process.argv.slice(2);
const doBackup = args.includes('--backup');

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const all = await Recall.find({}).lean();
    console.log(`Found ${all.length} recalls in DB.`);

    if (doBackup) {
      const backupsDir = path.join(__dirname, '..', 'backups');
      try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (e) { }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `recalls-pre-unset-source-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(all, null, 2), 'utf8');
      console.log(`Backup written to ${backupPath}`);
    }

    const res = await Recall.updateMany({}, { $unset: { source: "" } });
    console.log('Unset `source` field result:', res && (res.modifiedCount || res.nModified || res.ok) ? res : res);
    process.exit(0);
  } catch (err) {
    console.error('Failed to remove source field:', err && err.message);
    process.exit(1);
  }
})();
