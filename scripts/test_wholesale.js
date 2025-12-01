// scripts/test_wholesale.js
const recallsController = require('../controllers/recalls');

const sample = {
  recallId: 'TEST-WHS-1',
  product_description: 'Fresh Cut Cantaloupe',
  brand: 'WHOLESALE PRODUCE SUPPLY LLC DBA',
  recalling_firm: 'WHOLESALE PRODUCE SUPPLY LLC DBA',
  description: 'Potential Listeria monocytogenes contamination.',
  recallDate: '2025-09-25',
  agency: 'FDA',
  riskLevel: 'high',
  category: 'fruits',
  retailer: 'various-retailers',
  status: 'Terminated',
  distribution: 'Nationwide',
  isActive: true
};

const normalized = recallsController.normalizeRecallData(sample);
console.log('title:', normalized.title);
console.log('brand:', normalized.brand);
console.log('product:', normalized.product);
console.log('status:', normalized.status);
