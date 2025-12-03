// scripts/delete_inactive_recalls.js
// Usage:
//  node scripts/delete_inactive_recalls.js --backup [--dry-run]
//  node scripts/delete_inactive_recalls.js --backup --apply
// Deletes recalls that are inactive or have a closed/completed/terminated status.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const Recall = require('../models/Recall');

const args = process.argv.slice(2);
const doBackup = args.includes('--backup') || args.includes('-b');
const apply = args.includes('--apply');
const dryRun = !apply;

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const query = {
      $or: [
        { isActive: false },
        { status: { $in: ['Completed', 'completed', 'Closed', 'closed', 'Terminated', 'terminated'] } }
      ]
    };

    const matches = await Recall.find(query).lean();
    console.log(`Found ${matches.length} recalls matching inactive/closed criteria.`);

    if (matches.length === 0) {
      console.log('No inactive/closed recalls to delete.');
      process.exit(0);
    }

    if (doBackup) {
      const backupsDir = path.join(__dirname, '..', 'backups');
      try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (err) {}
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `inactive-recalls-backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(matches, null, 2), 'utf8');
      console.log('Backup written to', backupPath);
    }

    console.log('\nSample (first 20) IDs:');
    matches.slice(0, 20).forEach((m, i) => {
      console.log(`${i+1}. _id=${m._id} recallId=${m.recallId || 'N/A'} status=${m.status || 'N/A'} isActive=${m.isActive}`);
    });

    if (dryRun) {
      console.log('\nDry-run mode: no deletions performed. To delete, run with --apply.');
      process.exit(0);
    }

    const ids = matches.map(m => m._id);
    const delRes = await Recall.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${delRes.deletedCount || ids.length} documents.`);
    process.exit(0);
  } catch (err) {
    console.error('Deletion failed:', err && err.message);
    process.exit(1);
  }
})();
