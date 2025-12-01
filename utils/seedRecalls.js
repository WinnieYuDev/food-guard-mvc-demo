const Recall = require('../models/Recall');
const mongoose = require('mongoose');

const seedRecalls = [
  {
    recallId: 'FR-0124-2024',
    title: 'Fresh Spinach - Possible E. coli Contamination',
    description: 'Voluntary recall of fresh spinach due to possible E. coli contamination detected during routine testing.',
    product: 'Organic Fresh Spinach',
    brand: 'Green Valley Farms',
    reason: 'Potential E. coli contamination',
    recallDate: new Date('2024-01-15'),
    agency: 'FDA',
    riskLevel: 'high',
    category: 'vegetables',
    retailer: 'whole-foods',
    status: 'Ongoing',
    distribution: 'CA, AZ, NV, OR, WA',
    statesAffected: ['CA', 'AZ', 'NV', 'OR', 'WA'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/green-valley-farms-recalls-organic-fresh-spinach-due-possible-e-coli-contamination',
    isActive: true
  },
  {
    recallId: 'FR-0224-2024',
    title: 'Frozen Chicken Breast - Salmonella Risk',
    description: 'Recall of frozen chicken breast products due to potential salmonella contamination.',
    product: 'Frozen Chicken Breast',
    brand: 'Premium Poultry Co.',
    reason: 'Potential Salmonella contamination',
    recallDate: new Date('2024-02-10'),
    agency: 'FSIS',
    riskLevel: 'high',
    category: 'poultry',
    retailer: 'trader-joes',
    status: 'Ongoing',
    distribution: 'National',
    statesAffected: ['Nationwide'],
    articleLink: 'https://www.fsis.usda.gov/recalls-alerts/premium-poultry-co-recalls-frozen-chicken-breast-products-due-possible-salmonella',
    isActive: true
  },
  {
    recallId: 'FR-0324-2024',
    title: 'Canned Tuna - Quality Concerns',
    description: 'Recall of canned tuna due to potential quality issues and possible spoilage.',
    product: 'Canned Albacore Tuna',
    brand: 'Ocean Harvest',
    reason: 'Quality concerns and potential spoilage',
    recallDate: new Date('2024-03-05'),
    agency: 'FDA',
    riskLevel: 'medium',
    category: 'shellfish',
    retailer: 'kroger',
    status: 'Ongoing',
    distribution: 'TX, LA, OK, AR',
    statesAffected: ['TX', 'LA', 'OK', 'AR'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/ocean-harvest-recalls-canned-albacore-tuna-due-quality-concerns',
    isActive: true
  },
  {
    recallId: 'FR-0424-2024',
    title: 'Ground Beef - E. coli Concerns',
    description: 'Recall of ground beef products due to potential E. coli contamination.',
    product: 'Ground Beef 80/20',
    brand: 'Ranch Fresh Meats',
    reason: 'Potential E. coli contamination',
    recallDate: new Date('2024-04-20'),
    agency: 'FSIS',
    riskLevel: 'high',
    category: 'meat',
    retailer: 'walmart',
    status: 'Ongoing',
    distribution: 'Midwest Region',
    statesAffected: ['IL', 'IN', 'OH', 'MI', 'WI'],
    articleLink: 'https://www.fsis.usda.gov/recalls-alerts/ranch-fresh-meats-recalls-ground-beef-products-due-possible-e-coli-contamination',
    isActive: true
  },
  {
    recallId: 'FR-0524-2024',
    title: 'Organic Milk - Possible Contamination',
    description: 'Voluntary recall of organic milk due to possible bacterial contamination.',
    product: 'Organic Whole Milk',
    brand: 'Pure Dairy',
    reason: 'Potential bacterial contamination',
    recallDate: new Date('2024-05-12'),
    agency: 'FDA',
    riskLevel: 'high',
    category: 'dairy',
    retailer: 'costco',
    status: 'Ongoing',
    distribution: 'National',
    statesAffected: ['Nationwide'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/pure-dairy-recalls-organic-whole-milk-due-possible-bacterial-contamination',
    isActive: true
  },
  {
    recallId: 'FR-0624-2024',
    title: 'Frozen Berries - Hepatitis A Risk',
    description: 'Recall of frozen mixed berries due to potential Hepatitis A contamination.',
    product: 'Frozen Mixed Berries',
    brand: 'Berry Best',
    reason: 'Potential Hepatitis A contamination',
    recallDate: new Date('2024-06-08'),
    agency: 'FDA',
    riskLevel: 'high',
    category: 'fruits',
    retailer: 'target',
    status: 'Ongoing',
    distribution: 'National',
    statesAffected: ['Nationwide'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/berry-best-recalls-frozen-mixed-berries-due-potential-hepatitis-contamination',
    isActive: true
  },
  {
    recallId: 'FR-0724-2024',
    title: 'Eggs - Salmonella Concerns',
    description: 'Recall of eggs due to potential salmonella contamination.',
    product: 'Large Grade A Eggs',
    brand: 'Sunny Farms',
    reason: 'Potential Salmonella contamination',
    recallDate: new Date('2024-07-15'),
    agency: 'FDA',
    riskLevel: 'high',
    category: 'eggs',
    retailer: 'safeway',
    status: 'Ongoing',
    distribution: 'West Coast',
    statesAffected: ['CA', 'OR', 'WA'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/sunny-farms-recalls-eggs-due-potential-salmonella-contamination',
    isActive: true
  },
  {
    recallId: 'FR-0824-2024',
    title: 'Bread Products - Undeclared Allergens',
    description: 'Recall of bread products due to undeclared milk allergens.',
    product: 'Whole Wheat Bread',
    brand: 'Fresh Bake Co.',
    reason: 'Undeclared milk allergens',
    recallDate: new Date('2024-08-22'),
    agency: 'FDA',
    riskLevel: 'medium',
    category: 'grains',
    retailer: 'albertsons',
    status: 'Ongoing',
    distribution: 'Southwest Region',
    statesAffected: ['AZ', 'NM', 'TX'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/fresh-bake-co-recalls-bread-products-due-undeclared-allergens',
    isActive: true
  },
  {
    recallId: 'FR-0924-2024',
    title: 'Frozen Shrimp - Listeria Risk',
    description: 'Recall of frozen shrimp due to potential listeria contamination.',
    product: 'Raw Frozen Shrimp',
    brand: 'Ocean Catch',
    reason: 'Potential Listeria contamination',
    recallDate: new Date('2024-09-05'),
    agency: 'FDA',
    riskLevel: 'high',
    category: 'shellfish',
    retailer: 'whole-foods',
    status: 'Ongoing',
    distribution: 'National',
    statesAffected: ['Nationwide'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/ocean-catch-recalls-frozen-shrimp-due-potential-listeria-contamination',
    isActive: true
  },
  {
    recallId: 'FR-1024-2024',
    title: 'Lunch Meats - Quality Issues',
    description: 'Recall of pre-packaged lunch meats due to quality concerns.',
    product: 'Turkey Breast Slices',
    brand: 'Delicious Deli',
    reason: 'Quality concerns',
    recallDate: new Date('2024-10-18'),
    agency: 'FSIS',
    riskLevel: 'medium',
    category: 'meat',
    retailer: 'trader-joes',
    status: 'Ongoing',
    distribution: 'Northeast Region',
    statesAffected: ['NY', 'NJ', 'CT', 'MA'],
    articleLink: 'https://www.fsis.usda.gov/recalls-alerts/delicious-deli-recalls-lunch-meat-products-due-quality-concerns',
    isActive: true
  },
  {
    recallId: 'FR-1124-2024',
    title: 'Cheese Products - Mold Concerns',
    description: 'Recall of cheese products due to unexpected mold growth.',
    product: 'Cheddar Cheese Blocks',
    brand: 'Cheese Masters',
    reason: 'Unexpected mold growth',
    recallDate: new Date('2024-11-12'),
    agency: 'FDA',
    riskLevel: 'medium',
    category: 'dairy',
    retailer: 'kroger',
    status: 'Ongoing',
    distribution: 'Midwest Region',
    statesAffected: ['IL', 'IN', 'MI', 'OH'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/cheese-masters-recalls-cheddar-cheese-products-due-mold-concerns',
    isActive: true
  },
  {
    recallId: 'FR-1224-2024',
    title: 'Fresh Apples - Pesticide Concerns',
    description: 'Recall of fresh apples due to pesticide residue above acceptable limits.',
    product: 'Red Delicious Apples',
    brand: 'Orchard Fresh',
    reason: 'Pesticide residue concerns',
    recallDate: new Date('2024-12-01'),
    agency: 'FDA',
    riskLevel: 'medium',
    category: 'fruits',
    retailer: 'walmart',
    status: 'Ongoing',
    distribution: 'National',
    statesAffected: ['Nationwide'],
    articleLink: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/orchard-fresh-recalls-apples-due-pesticide-residue-concerns',
    isActive: true
  }
];

const seedDatabase = async () => {
  try {
    await Recall.deleteMany({});
    console.log('Cleared existing recalls');
    
    await Recall.insertMany(seedRecalls);
    console.log(`Seeded ${seedRecalls.length} recalls into database`);
    
    return seedRecalls.length;
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};

if (require.main === module) {
  require('dotenv').config();
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/foodguard')
    .then(() => {
      console.log('Connected to MongoDB');
      return seedDatabase();
    })
    .then(count => {
      console.log(`Successfully seeded ${count} recalls!`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedRecalls, seedDatabase };