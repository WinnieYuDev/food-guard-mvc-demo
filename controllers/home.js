// controllers/home.js
const Post = require('../models/Post');
const Recall = require('../models/Recall');
const recallsController = require('./recalls');

// ======================
// 1. CATEGORY IMAGE MAPPING
// ======================
const categoryImageMap = {
    'poultry': 'https://images.unsplash.com/photo-1587590227264-0ac64ce63ce8?w=800&h=600&fit=crop',
    'beef': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&h=600&fit=crop',
    'pork': 'https://images.unsplash.com/photo-1551028136-8e4ee2c1f9c9?w=800&h=600&fit=crop',
    'seafood': 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&h=600&fit=crop',
    'vegetables': 'https://images.unsplash.com/photo-1515772319939-5c8cdccdb696?w=800&h=600&fit=crop',
    'fruits': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=600&fit=crop',
    'dairy': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop',
    'eggs': 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&h=600&fit=crop',
    'nuts': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop',
    'grains': 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&h=600&fit=crop',
    'snacks': 'https://images.unsplash.com/photo-1582169296194-e3d8ebf6c4cb?w=800&h=600&fit=crop',
    'baby-food': 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=600&fit=crop',
    'other': '/imgs/placeholder-food.png' // Local fallback
};

// Helper function to get the correct image URL
const getCategoryImage = (category) => {
    if (!category) return categoryImageMap.other;
    const normalizedCategory = category.toLowerCase().trim();
    return categoryImageMap[normalizedCategory] || categoryImageMap.other;
};

// Keep the rest of your controller code the same...

// Keywords -> images (prefer external images when local images aren't available)
const keywordImageMap = {
    // Eggs & Dairy
    egg: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&h=600&fit=crop',
    eggs: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&h=600&fit=crop',
    dairy: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop',
    milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop',
    cheese: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&h=600&fit=crop',
    
    // Meats
    beef: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&h=600&fit=crop',
    pork: 'https://images.unsplash.com/photo-1551028136-8e4ee2c1f9c9?w=800&h=600&fit=crop',
    chicken: 'https://images.unsplash.com/photo-1587590227264-0ac64ce63ce8?w=800&h=600&fit=crop',
    poultry: 'https://images.unsplash.com/photo-1587590227264-0ac64ce63ce8?w=800&h=600&fit=crop',
    
    // Seafood
    shrimp: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&h=600&fit=crop',
    seafood: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&h=600&fit=crop',
    fish: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&h=600&fit=crop',
    
    // Vegetables & Fruits
    vegetable: 'https://images.unsplash.com/photo-1515772319939-5c8cdccdb696?w=800&h=600&fit=crop',
    vegetables: 'https://images.unsplash.com/photo-1515772319939-5c8cdccdb696?w=800&h=600&fit=crop',
    fruit: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=600&fit=crop',
    fruits: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=600&fit=crop',
    
    // Nuts & Grains
    nuts: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop',
    peanut: 'https://images.unsplash.com/photo-1596591606975-97ee5cef3a1e?w=800&h=600&fit=crop',
    peanuts: 'https://images.unsplash.com/photo-1596591606975-97ee5cef3a1e?w=800&h=600&fit=crop',
    
    // Pasta, Noodles & Grains
    noodle: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&h=600&fit=crop',
    noodles: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&h=600&fit=crop',
    pasta: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop',
    grain: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&h=600&fit=crop',
    grains: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&h=600&fit=crop',
    wheat: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&h=600&fit=crop',
    
    // Prepared Foods
    burrito: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&h=600&fit=crop',
    popcorn: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=800&h=600&fit=crop',
    snack: 'https://images.unsplash.com/photo-1582169296194-e3d8ebf6c4cb?w=800&h=600&fit=crop',
    snacks: 'https://images.unsplash.com/photo-1582169296194-e3d8ebf6c4cb?w=800&h=600&fit=crop',
    
    // Breakfast items
    breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&h=600&fit=crop',
    bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop',
    
    // Baby food
    baby: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=600&fit=crop'
};

// Choose an image based on text content (title/product/brand/category)
// Sort keywords by length (longest first) for more specific matches
const selectImageFromText = (text, fallbackCategory) => {
    if (!text) return getCategoryImage(fallbackCategory);
    const normalized = text.toLowerCase();
    
    // Sort keywords by length in descending order for better matches
    // e.g., "breakfast burrito" should match "burrito" before "break"
    const sortedKeys = Object.keys(keywordImageMap).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
        if (normalized.includes(key)) {
            console.log(`🖼️  Matched keyword "${key}" in text: "${text.substring(0, 50)}..."`);
            return keywordImageMap[key];
        }
    }
    return getCategoryImage(fallbackCategory);
};

// Title case every word: make rest lower-case and capitalize first letter of each word
const toTitleCase = (s) => {
    if (!s) return s;
    return s.toLowerCase().replace(/\b(\w)/g, c => c.toUpperCase());
};

// Sanitization helpers
const removeWeightPatterns = (s) => {
    if (!s) return s;
    // Remove patterns like '5 lb', '10 lbs', '12 oz', '2 pounds', '500 g', '1kg', etc.
    return s.replace(/\b\d+(?:[\.,]\d+)?\s?(?:lbs?|pounds?|oz|ounces?|kgs?|kg|g)\b/ig, '')
            .replace(/\(\s*\d+(?:[\.,]\d+)?\s?(?:lbs?|pounds?|oz|ounces?|kgs?|kg|g)\s*\)/ig, '');
};

const dedupeCommaParts = (s) => {
    if (!s) return s;
    // Split on commas, dashes, or slashes and dedupe exact parts preserving order
    const parts = s.split(/[,/\-]+/).map(p => p.trim()).filter(Boolean);
    const seen = new Set();
    const out = [];
    for (let p of parts) {
        const key = p.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            out.push(p);
        }
    }
    return out.join(', ');
};

const removeDuplicateAdjacentWords = (s) => {
    if (!s) return s;
    const words = s.split(/\s+/);
    const out = [];
    let last = null;
    for (const w of words) {
        if (w.toLowerCase() !== last) {
            out.push(w);
            last = w.toLowerCase();
        }
    }
    return out.join(' ');
};

const sanitizeTitle = (title) => {
    if (!title) return title;
    let s = title;
    s = removeWeightPatterns(s);
    s = s.replace(/\s{2,}/g, ' ');
    s = s.trim();
    // Split out comma/dash parts and dedupe those
    s = dedupeCommaParts(s);
    s = removeDuplicateAdjacentWords(s);
    // Remove stray leading/trailing punctuation
    s = s.replace(/^[,\-:\s]+|[,\-:\s]+$/g, '');
    return s;
};

const sanitizeReason = (reason, title) => {
    if (!reason) return reason;
    let r = reason;
    r = removeWeightPatterns(r);
    r = r.replace(/\s{2,}/g, ' ').trim();
    // If reason equals title or contains title verbatim, shorten it
    if (title && r.toLowerCase().includes(title.toLowerCase())) {
        // try to shorten: take first sentence or 120 chars
        const firstSentenceMatch = r.match(/^(.*?\.)\s/);
        if (firstSentenceMatch) r = firstSentenceMatch[1];
        if (r.length > 140) r = r.slice(0, 137) + '...';
    }
    return r;
};

// ======================
// 2. MAIN CONTROLLER
// ======================
exports.getHome = async (req, res) => {
    try {
        console.log('🏠 Home controller called!');

        let activeRecalls = [];
        let recentPosts = [];

        // Check if MongoDB is connected
        const mongoose = require('mongoose');
        const isDbConnected = mongoose.connection.readyState === 1;

        if (isDbConnected) {
            try {
                // Get active recalls
                activeRecalls = await Recall.find({ isActive: true })
                    .sort({ recallDate: -1 })
                    .limit(6)
                    .lean();

                console.log(`📊 Found ${activeRecalls.length} active recalls`);

                // Enhance each recall with cleaned fields and a chosen image
                activeRecalls = activeRecalls.map(recall => {
                    // First normalize the recall using the recalls controller's normalizeRecallData
                    const normalizedRecall = recallsController.normalizeRecallData(recall);
                    
                    const category = normalizedRecall.category || 'other';

                    // Use the already-cleaned title and product from normalization
                    const cleanedTitle = toTitleCase(normalizedRecall.title || normalizedRecall.product || '');
                    const cleanedReason = sanitizeReason(normalizedRecall.reason || normalizedRecall.description || '', cleanedTitle);

                    // Determine locations: prefer statesAffected array, then distribution text
                    let locations = '';
                    if (Array.isArray(normalizedRecall.statesAffected) && normalizedRecall.statesAffected.length > 0) {
                        // dedupe and join
                        const unique = [...new Set(normalizedRecall.statesAffected.map(s => (s || '').trim()).filter(Boolean))];
                        locations = unique.join(', ');
                    } else if (normalizedRecall.distribution) {
                        locations = dedupeCommaParts(normalizedRecall.distribution);
                    }

                    // Choose image based on title/product/brand/category keywords
                    const combinedText = [cleanedTitle, normalizedRecall.product, normalizedRecall.brand, normalizedRecall.category].filter(Boolean).join(' ');
                    const chosenImage = selectImageFromText(combinedText, category);

                    return {
                        ...normalizedRecall,
                        cleanedTitle,
                        cleanedReason,
                        locations: locations,
                        categoryImage: chosenImage,
                        image: chosenImage
                    };
                });

                // Get recent posts
                recentPosts = await Post.find({ isActive: true })
                    .populate('author', 'username')
                    .sort({ createdAt: -1 })
                    .limit(3)
                    .lean();

                console.log(`✅ Homepage data loaded: ${recentPosts.length} posts, ${activeRecalls.length} recalls`);
            } catch (dbError) {
                console.log('Database query failed:', dbError.message);
            }
        } else {
            console.log('MongoDB not connected, using empty data');
        }

        // Render the homepage
        console.log('📤 Rendering index.ejs');
        res.render('index', {
            title: 'FoodGuard - Home',
            recalls: activeRecalls, // This now contains the 'categoryImage' property
            posts: recentPosts,
            user: req.user
        });

    } catch (error) {
        console.error('❌ Home controller error:', error);
        // Safe fallback
        res.render('index', {
            title: 'FoodGuard - Home',
            recalls: [],
            posts: [],
            user: req.user
        });
    }
};