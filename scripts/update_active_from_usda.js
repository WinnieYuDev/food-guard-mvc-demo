#!/usr/bin/env node
// scripts/update_active_from_usda.js
// Usage:
//  node scripts/update_active_from_usda.js [--backup] [--dry-run] [--purge-pre2025]
//
// Fetch the FSIS/USDA recall feed and update the local MongoDB Recall
// records' `isActive` flag based strictly on the provider field
// `field_active_notice` (only those where that field is true are marked active).
//
// NOTE: This script now only processes recalls whose publish/recall date
// falls in the calendar year 2025

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const recallApi = require('../services/recallAPI');
const Recall = require('../models/Recall');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const doBackup = args.includes('--backup') || args.includes('-b');
const purgePre2025 = args.includes('--purge-pre2025');
// Main async function to run the update process
(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const allExisting = await Recall.find({}).lean();
    console.log(`DB contains ${allExisting.length} recall records.`);
// Backup existing records if requested
    if (doBackup) {
      const backupsDir = path.join(__dirname, '..', 'backups');
      try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (err) {}
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `recalls-before-active-update-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(allExisting, null, 2), 'utf8');
      console.log('Backup written to', backupPath);
    }

    if (purgePre2025) {
      console.log('Purge flag detected: will back up and remove pre-2025 recalls after update steps.');
    }

    console.log('Fetching FSIS recalls from USDA...');
    // Fetch a generous set (12 months) to ensure we capture items present in DB
    const fetched = await recallApi.fetchFSISRecalls({ limit: 2000, monthsBack: 12 });
    console.log(`Fetched ${fetched.length} FSIS recall entries.`);

    const processedRecallIds = [];
    let skippedCount = 0;

    function recordIsIn2025(rec) {
      // Try normalized date first, then common provider fields in rawData
      const raw = rec.rawData || {};
      const candidates = [rec.recallDate, rec.datePublished, raw.publish_date, raw.recall_date, raw.field_recall_date, raw.recallDate, raw.PublishedDate, raw.publishDate];
      for (const c of candidates) {
        if (!c) continue;
        const d = new Date(c);
        if (!isNaN(d.getTime())) {
          if (d.getFullYear && d.getFullYear() === 2025) return true;
          return false; // date parseable but not 2025
        }
      }
      // If no date could be parsed, conservatively skip the record
      return false;
    }
// Process each fetched recall
    for (const rec of fetched) {
      try {
        // Only process recalls with a publish/recall date in 2025
        if (!recordIsIn2025(rec)) {
          skippedCount++;
          continue;
        }
        // The service returns normalized objects with `rawData` containing original provider fields
        const raw = rec.rawData || {};
        // Interpret field_active_notice: accept boolean true or string 'true' (case-insensitive)
        let activeFlag = false;
        if (raw.hasOwnProperty('field_active_notice')) {
          const v = raw.field_active_notice;
          if (typeof v === 'boolean') activeFlag = v === true;
          else if (typeof v === 'string') activeFlag = v.toLowerCase() === 'true';
        }

        // Fallback: also consider normalized rec.isActive if raw field missing
        if (!raw.hasOwnProperty('field_active_notice')) {
          activeFlag = !!rec.isActive;
        }

        const recallId = rec.recallId;
        if (!recallId) continue;

        processedRecallIds.push(recallId);

        if (dryRun) {
          console.log(`[dry-run] Would set Recall ${recallId} isActive=${activeFlag}`);
        } else {
          const existing = await Recall.findOneAndUpdate({ recallId }, { isActive: activeFlag }, { new: true });
          if (existing) {
            console.log(`Updated ${recallId} -> isActive=${activeFlag}`);
          } else {
            // If recall not present locally, only create minimal record if it's in 2025
            const created = await Recall.create(Object.assign({}, rec, { isActive: activeFlag }));
            console.log(`Created recall ${created.recallId} (isActive=${activeFlag})`);
          }
        }
      } catch (inner) {
        console.error('Error processing recall entry:', inner && inner.message);
      }
    }

    // Any local 2025 recalls not present in fetched list should be marked inactive
    const localAll = await Recall.find({}).select('_id recallId recallDate isActive').lean();
    for (const loc of localAll) {
      try {
        const d = loc.recallDate ? new Date(loc.recallDate) : null;
        const is2025Local = d && !isNaN(d.getTime()) && d.getFullYear && d.getFullYear() === 2025;
        if (!is2025Local) {
          // Skip non-2025 local records
          continue;
        }
        if (!processedRecallIds.includes(loc.recallId)) {
          if (dryRun) {
            console.log(`[dry-run] Would mark missing recall ${loc.recallId} inactive (was ${loc.isActive})`);
          } else {
            if (loc.isActive) {
              await Recall.findByIdAndUpdate(loc._id, { isActive: false });
              console.log(`Marked missing recall ${loc.recallId} inactive`);
            }
          }
        }
      } catch (e) {
        // ignore local processing errors per-record
      }
    }

    if (skippedCount > 0) console.log(`Skipped ${skippedCount} fetched recalls not in 2025.`);

    // If requested, backup and purge pre-2025 records from the DB
    if (purgePre2025) {
      try {
        // Load all recalls and detect pre-2025 using multiple candidate fields
        const allLocals = await Recall.find({}).lean();
        const cutoffYear = 2025;
// Function to determine if a recall is pre-2025 based on available date fields
        function localIsPre2025(loc) {
          const candidates = [];
          if (loc.recallDate) candidates.push(loc.recallDate);
          if (loc.recall_date) candidates.push(loc.recall_date);
          if (loc.publishDate) candidates.push(loc.publishDate);
          if (loc.publishedAt) candidates.push(loc.publishedAt);
          if (loc.createdAt) candidates.push(loc.createdAt);
          if (loc.updatedAt) candidates.push(loc.updatedAt);
          if (loc.rawData) candidates.push(loc.rawData.publish_date || loc.rawData.recall_date || loc.rawData.date);
          if (loc._raw) candidates.push(loc._raw.publish_date || loc._raw.recall_date || loc._raw.date);

          for (const c of candidates) {
            if (!c) continue;
            const d = new Date(c);
            if (!isNaN(d.getTime())) {
              if (d.getFullYear && d.getFullYear() < cutoffYear) return true;
              if (d.getFullYear && d.getFullYear() >= cutoffYear) return false;
            }
          }
          // If no date info, conservatively treat as pre-2025? No — skip.
          return false;
        }

        const pre2025 = allLocals.filter(localIsPre2025);
        console.log(`Detected ${pre2025.length} pre-2025 recalls to archive/purge (based on available date fields).`);
// Backup and delete
        if (pre2025.length > 0) {
          const backupsDir = path.join(__dirname, '..', 'backups');
          try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (err) {}
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const purgeBackupPath = path.join(backupsDir, `recalls-pre2025-backup-${ts}.json`);
          fs.writeFileSync(purgeBackupPath, JSON.stringify(pre2025, null, 2), 'utf8');
          console.log('Pre-2025 backup written to', purgeBackupPath);

          // Show a short sample to the operator
          const sample = pre2025.slice(0, 10).map(r => ({ _id: r._id, recallId: r.recallId, recallDate: r.recallDate }));
          console.log('Sample pre-2025 records:', sample);

          if (dryRun) {
            console.log('[dry-run] Would delete pre-2025 recalls (no changes made).');
          } else {
            const ids = pre2025.map(r => r._id);
            const delRes = await Recall.deleteMany({ _id: { $in: ids } });
            console.log(`Deleted ${delRes.deletedCount || pre2025.length} pre-2025 recall(s) from DB.`);
          }
        }
      } catch (purgeErr) {
        console.error('Failed to purge pre-2025 recalls:', purgeErr && purgeErr.message);
      }
    }

    console.log('Update complete.');
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err && err.message);
    process.exit(1);
  }
})();
