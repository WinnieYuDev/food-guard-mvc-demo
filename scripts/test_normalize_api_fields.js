// scripts/test_normalize_api_fields.js
// Quick test for normalizeRecallData with API-style fields

const recallsController = require('../controllers/recalls');

const sampleApiRecall = {
  recallId: 'API-001',
  product_description: 'Fresh Cut Cantaloupe',
  brand_names: ['Harvest Cuts', 'Fresh & Finest'],
  description: 'API-sourced recall',
  recallDate: new Date().toISOString(),
  agency: 'FDA',
  riskLevel: 'medium',
  category: 'fruits',
  retailer: 'various-retailers',
  status: 'Ongoing',
  distribution: 'Nationwide',
  isActive: true
};

const normalized = recallsController.normalizeRecallData(sampleApiRecall);
console.log('normalized.title:', normalized.title);
console.log('normalized.product:', normalized.product);
console.log('normalized.brand:', normalized.brand);
console.log('\nFull normalized object (trimmed):\n', JSON.stringify({
  title: normalized.title,
  product: normalized.product,
  brand: normalized.brand
}, null, 2));
