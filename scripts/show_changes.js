// scripts/show_changes.js
// Usage: node scripts/show_changes.js <backup-file> [count]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const Recall = require('../models/Recall');

async function main() {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node scripts/show_changes.js <backup-file> [count]');
    process.exit(1);
  }

  const backupPath = path.resolve(args[0]);
  const count = parseInt(args[1]) || 10;

  if (!fs.existsSync(backupPath)) {
    console.error('Backup file not found:', backupPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(backupPath, 'utf8');
  let docs = [];
  try { docs = JSON.parse(raw); } catch (e) { console.error('Failed to parse backup JSON:', e.message); process.exit(1); }

  const sample = docs.slice(0, count);
  const ids = sample.map(d => d._id).filter(Boolean);

  await connectDB();

  const current = await Recall.find({ _id: { $in: ids } }).lean();
  const currentById = {};
  for (const c of current) currentById[String(c._id)] = c;

  console.log(`Comparing ${sample.length} records from backup -> current DB state:\n`);

  sample.forEach((before, i) => {
    const id = String(before._id);
    const after = currentById[id];
    console.log(`${i+1}. id=${id}`);
    console.log('   - BEFORE:');
    console.log(`     title: ${before.title}`);
    console.log(`     product: ${before.product}`);
    console.log(`     brand: ${before.brand}`);
    console.log(`     category: ${before.category}`);
    console.log(`     categories: ${JSON.stringify(before.categories || [])}`);
    console.log(`     tags: ${JSON.stringify(before.tags || [])}`);
    if (after) {
      console.log('   - AFTER:');
      console.log(`     title: ${after.title}`);
      console.log(`     product: ${after.product}`);
      console.log(`     brand: ${after.brand}`);
      console.log(`     category: ${after.category}`);
      console.log(`     categories: ${JSON.stringify(after.categories || [])}`);
      console.log(`     tags: ${JSON.stringify(after.tags || [])}`);
    } else {
      console.log('   - AFTER: <not found in DB>');
    }
    console.log('');
  });

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
