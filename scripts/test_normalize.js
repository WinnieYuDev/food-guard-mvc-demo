// scripts/test_normalize.js
// Quick test for normalizeRecallData output

const recallsController = require('../controllers/recalls');

const sampleRecall = {
  recallId: 'TEST-001',
  product: 'Chicken Caesar Salad and Wrap',
  brand: "Boar's Head",
  description: 'Test description',
  recallDate: new Date().toISOString(),
  agency: 'FDA',
  riskLevel: 'medium',
  category: 'grains',
  retailer: 'various-retailers',
  status: 'Ongoing',
  distribution: 'Nationwide',
  isActive: true
};

const normalized = recallsController.normalizeRecallData(sampleRecall);
console.log('normalized.title:', normalized.title);
console.log('normalized.product:', normalized.product);
console.log('normalized.brand:', normalized.brand);
console.log('\nFull normalized object (trimmed):\n', JSON.stringify({
  title: normalized.title,
  product: normalized.product,
  brand: normalized.brand
}, null, 2));
