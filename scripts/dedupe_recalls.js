// scripts/dedupe_recalls.js
// Deduplicate recall documents in the database.
// Usage:
//   node scripts/dedupe_recalls.js --dry-run --backup
// Options:
//   --apply    : actually apply deletions/merges (default is dry-run)
//   --backup   : write a JSON backup of all recalls before applying
//   --limit N  : only process first N groups (useful for testing)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const Recall = require('../models/Recall');

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const dryRun = !applyChanges;
const doBackup = args.includes('--backup') || args.includes('-b');
const limitArgIndex = args.indexOf('--limit');
const limit = (limitArgIndex !== -1 && args[limitArgIndex + 1]) ? parseInt(args[limitArgIndex + 1], 10) : null;

const normalizeKey = (r) => {
  // Prefer recallId when present
  if (r.recallId && String(r.recallId).trim().length > 0) return `ID::${String(r.recallId).trim().toLowerCase()}`;

  const product = (r.product || r.product_description || r.title || '').toString().toLowerCase().trim();
  const brand = (r.brand || r.recalling_firm || r.Firm || '').toString().toLowerCase().trim();
  const date = (r.recallDate ? new Date(r.recallDate) : (r.releasedate || r.releaseDate ? new Date(r.releaseDate) : null));
  const dateIso = date && !isNaN(date.getTime()) ? date.toISOString().slice(0,10) : 'nodate';
  const p = product.replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
  const b = brand.replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
  return `SIG::${p}||${b}||${dateIso}`;
};

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set; aborting.');
      process.exit(1);
    }

    await connectDB();

    const all = await Recall.find({}).lean();
    console.log(`Found ${all.length} recalls in DB; building groups...`);

    if (doBackup) {
      const backupsDir = path.join(__dirname, '..', 'backups');
      try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (err) {}
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `recalls-full-backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(all, null, 2), 'utf8');
      console.log('Full backup written to', backupPath);
    }

    const groups = new Map();
    for (const r of all) {
      const key = normalizeKey(r);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    const dupeGroups = Array.from(groups.entries()).filter(([k, arr]) => arr.length > 1);
    console.log(`Identified ${dupeGroups.length} groups with duplicates.`);

    let processed = 0;
    const planned = [];

    for (const [key, docs] of dupeGroups) {
      if (limit && processed >= limit) break;
      processed++;

      // Choose keeper: prefer doc with recallId, then most recently updatedAt, then most recent createdAt
      let keeper = docs.find(d => d.recallId && String(d.recallId).trim().length > 0) || null;
      if (!keeper) {
        keeper = docs.slice().sort((a,b) => {
          const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          if (aUpdated !== bUpdated) return bUpdated - aUpdated;
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        })[0];
      }

      const others = docs.filter(d => String(d._id) !== String(keeper._id));

      // Merge tags and other useful fields onto keeper
      const mergedTags = new Set((keeper.tags || []).map(t => String(t)));
      for (const o of others) {
        (o.tags || []).forEach(t => mergedTags.add(String(t)));
      }

      // Choose earliest recallDate? We'll keep the most specific (non-null) earliest date
      const dates = docs.map(d => d.recallDate ? new Date(d.recallDate) : null).filter(Boolean);
      const chosenDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : (keeper.recallDate || null);

      const mergedIsActive = docs.some(d => d.isActive === true) || keeper.isActive === true;

      planned.push({
        key,
        keeper: { _id: keeper._id, recallId: keeper.recallId || null },
        count: docs.length,
        keepFields: {
          tags: Array.from(mergedTags),
          recallDate: chosenDate ? chosenDate.toISOString() : null,
          isActive: mergedIsActive
        },
        toDelete: others.map(o => ({ _id: o._id, recallId: o.recallId || null }))
      });
    }

    if (planned.length === 0) {
      console.log('No duplicates to process.');
      process.exit(0);
    }

    console.log(`Planned operations for ${planned.length} groups. Sample:`);
    planned.slice(0, 20).forEach((p, i) => {
      console.log(`${i+1}. key=${p.key}  keeper=${p.keeper._id}  count=${p.count}  delete=${p.toDelete.map(d => d._id).join(', ')}`);
    });

    if (dryRun) {
      console.log('\nDry-run mode: no changes applied. Use --apply to execute deletions/merges.');
      process.exit(0);
    }

    console.log('\nApplying changes...');
    let totalDeleted = 0;
    let totalUpdated = 0;

    for (const p of planned) {
      const update = {};
      if (p.keepFields.tags) update.tags = p.keepFields.tags;
      if (p.keepFields.recallDate) update.recallDate = new Date(p.keepFields.recallDate);
      if (typeof p.keepFields.isActive === 'boolean') update.isActive = p.keepFields.isActive;

      try {
        await Recall.updateOne({ _id: p.keeper._id }, { $set: update });
        totalUpdated++;
      } catch (err) {
        console.error('Failed to update keeper', p.keeper._id, err && err.message);
      }

      try {
        const ids = p.toDelete.map(d => d._id);
        const delRes = await Recall.deleteMany({ _id: { $in: ids } });
        totalDeleted += delRes.deletedCount || ids.length;
      } catch (err) {
        console.error('Failed to delete duplicates for keeper', p.keeper._id, err && err.message);
      }
    }

    console.log(`Done. Updated ${totalUpdated} keepers. Deleted approximately ${totalDeleted} documents.`);
    process.exit(0);
  } catch (err) {
    console.error('Deduplication failed:', err && err.message);
    process.exit(1);
  }
})();
