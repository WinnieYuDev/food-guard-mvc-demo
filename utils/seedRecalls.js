const mongoose = require('mongoose');
const Recall = require('../models/Recall');
require('dotenv').config();

const sampleRecalls = [
  {
    recallId: 'TJ-2024-001',
    title: 'Trader Joe\'s Chicken Pot Pie Recall',
    description: 'Potential contamination with foreign material in Trader Joe\'s branded chicken pot pies.',
    brand: 'Trader Joe\'s',
    product: 'Chicken Pot Pie',
    category: 'poultry',
    retailer: 'trader-joes',
    reason: 'Potential plastic contamination',
    riskLevel: 'high',
    recallDate: new Date('2024-01-15'),
    statesAffected: ['CA', 'OR', 'WA', 'NY'],
    source: 'FDA'
  },
  {
    recallId: 'WF-2024-002',
    title: 'Whole Foods Organic Spinach Recall',
    description: 'Possible E. coli contamination in organic spinach sold at Whole Foods locations.',
    brand: 'Whole Foods Organic',
    product: 'Fresh Spinach',
    category: 'vegetables',
    retailer: 'whole-foods',
    reason: 'Potential E. coli contamination',
    riskLevel: 'high',
    recallDate: new Date('2024-01-10'),
    statesAffected: ['CA', 'TX', 'FL', 'IL'],
    source: 'FDA'
  },
  {
    recallId: 'KR-2024-003',
    title: 'Kroger Frozen Shrimp Recall',
    description: 'Undeclared shellfish allergen in Kroger brand frozen cooked shrimp.',
    brand: 'Kroger',
    product: 'Frozen Cooked Shrimp',
    category: 'shellfish',
    retailer: 'kroger',
    reason: 'Undeclared allergen',
    riskLevel: 'medium',
    recallDate: new Date('2024-01-08'),
    statesAffected: ['OH', 'KY', 'IN', 'MI'],
    source: 'FDA'
  },
  // Add more sample data as needed
];

const seedRecalls = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Clear existing recalls
    await Recall.deleteMany({});
    console.log('Cleared existing recalls');

    // Insert sample data
    await Recall.insertMany(sampleRecalls);
    console.log('Sample recalls inserted successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding recalls:', error);
    process.exit(1);
  }
};

seedRecalls();