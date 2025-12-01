// controllers/home.js
// Purpose: prepare data for the homepage (views/index.ejs).
// This file loads recent posts and active recalls from the database,
// cleans up recall titles/reasons for nicer display, chooses an image
// to show for each recall card, and sends the data to the EJS view.
//
// - `Recall.find(...).lean()` returns plain JavaScript objects (not Mongoose documents),
//   which are easier to inspect and modify before passing to templates.
// - Small helper functions below (sanitizeTitle, selectImageFromText, etc.)
//   keep the view simple by preparing display-ready fields.

const Post = require('../models/Post');
const Recall = require('../models/Recall');
const recallsController = require('./recalls');

const categoryImageMap = {
    'poultry': 'https://images.unsplash.com/photo-1587590227264-0ac64ce63ce8?w=800&h=600&fit=crop',
    'beef': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&h=600&fit=crop',
    'pork': 'https://images.unsplash.com/photo-1551028136-8e4ee2c1f9c9?w=800&h=600&fit=crop',
    'seafood': 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&h=600&fit=crop',
    'vegetables': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=600&fit=crop',
    'fruits': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=600&fit=crop',
    'dairy': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop',
    'eggs': 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=800&h=600&fit=crop',
    'nuts': 'https://images.unsplash.com/photo-1608797178974-15b35a64ede9?w=800&h=600&fit=crop',
    'grains': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&h=600&fit=crop',
    'snacks': 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=800&h=600&fit=crop',
    'breakfast': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&h=600&fit=crop',
    'baby-food': 'https://www.foodbusinessnews.net/ext/resources/2020/3/Baby-Food_Lead.webp?height=667&t=1584542595&width=1080',
    'other': '/imgs/placeholder-food.png' // Local fallback
};

const getCategoryImage = (category) => {
    if (!category) return categoryImageMap.other;
    const normalizedCategory = category.toLowerCase().trim();
    return categoryImageMap[normalizedCategory] || categoryImageMap.other;
};


const keywordImageMap = {
    'scrambled eggs': 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=800&h=600&fit=crop',
    'scrambled egg': 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=800&h=600&fit=crop',
    'breakfast burrito': 'https://images.unsplash.com/photo-1574343635105-4cf2ea136b8b?w=800&h=600&fit=crop',
    'chicken eggs': 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=800&h=600&fit=crop', // eggs in carton
    'chicken egg': 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=800&h=600&fit=crop',
    
    crawfish: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&h=600&fit=crop',
    fish: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&h=600&fit=crop',
    crayfish: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&h=600&fit=crop',
    lobster: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&h=600&fit=crop',
    
    scrambled: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=800&h=600&fit=crop',
    egg: 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=800&h=600&fit=crop',
    eggs: 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=800&h=600&fit=crop',
    dairy: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop',
    milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop',
    cheese: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&h=600&fit=crop',
    
    shrimp: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&h=600&fit=crop',
    seafood: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&h=600&fit=crop',
    fish: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&h=600&fit=crop',
    
    beef: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&h=600&fit=crop',
    pork: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=800&h=600&fit=crop',
    chicken: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&h=600&fit=crop',
    poultry: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&h=600&fit=crop',
    
    vegetable: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=600&fit=crop',
    vegetables: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=600&fit=crop',
    fruit: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=600&fit=crop',
    fruits: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=600&fit=crop',
    
    nuts: 'https://images.unsplash.com/photo-1608797178974-15b35a64ede9?w=800&h=600&fit=crop',
    nut: 'https://images.unsplash.com/photo-1608797178974-15b35a64ede9?w=800&h=600&fit=crop',
    almonds: 'https://images.unsplash.com/photo-1608797178974-15b35a64ede9?w=800&h=600&fit=crop',
    
    noodle: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=800&h=600&fit=crop',
    noodles: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=800&h=600&fit=crop',
    pasta: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=800&h=600&fit=crop',
    grain: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&h=600&fit=crop',
    grains: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&h=600&fit=crop',
    wheat: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&h=600&fit=crop',
    
    burrito: 'https://images.unsplash.com/photo-1574343635105-4cf2ea136b8b?w=800&h=600&fit=crop',
    popcorn: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=800&h=600&fit=crop',
    snack: 'https://images.unsplash.com/photo-1582169296194-e3d8ebf6c4cb?w=800&h=600&fit=crop',
    snacks: 'https://images.unsplash.com/photo-1582169296194-e3d8ebf6c4cb?w=800&h=600&fit=crop',
    
    breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&h=600&fit=crop',
    bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop',
    
    baby: 'https://www.foodbusinessnews.net/ext/resources/2020/3/Baby-Food_Lead.webp?height=667&t=1584542595&width=1080'
};

// selectImageFromText(text, fallbackCategory)
// Scans the provided `text` (usually a combination of title, product, brand,
// and category) for keywords defined in `keywordImageMap`. The function tries
// to match longer keywords first so that specific phrases (e.g. "scrambled eggs")
// are preferred over shorter ones (e.g. "egg"). If a keyword is found, the
// corresponding image URL is returned. Otherwise, the category fallback image
// is returned via `getCategoryImage`.
const selectImageFromText = (text, fallbackCategory) => {
    if (!text) return getCategoryImage(fallbackCategory);

    const normalized = text.toLowerCase();

    // Sort keys by length (longer keys first) to prioritize specific matches
    const sortedKeys = Object.keys(keywordImageMap).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
        if (normalized.includes(key)) {
            // Helpful debug log when running locally
            console.log(`Matched keyword "${key}" in text: "${text.substring(0, 50)}..."`);
            return keywordImageMap[key];
        }
    }

    // No keyword matched; use the category-based image
    console.log(`Using category fallback for: "${fallbackCategory}"`);
    return getCategoryImage(fallbackCategory);
};

// toTitleCase(s)
// Returns a version of the string where the first letter of each word is
// capitalized and the rest of the letters are lower-case. Useful for
// normalizing product and brand names for display.
const toTitleCase = (s) => {
    if (!s) return s;
    return s.toLowerCase().replace(/\b(\w)/g, c => c.toUpperCase());
};

// removeWeightPatterns(s)
// Removes weight and measurement mentions from text, such as "5 lb", "12 oz",
// and parenthesized values like "(2 lbs)". This avoids cluttering titles
// and reasons with irrelevant numeric measurements.
const removeWeightPatterns = (s) => {
    if (!s) return s;
    return s.replace(/\b\d+(?:[\.,]\d+)?\s?(?:lbs?|pounds?|oz|ounces?|kgs?|kg|g)\b/ig, '')
            .replace(/\(\s*\d+(?:[\.,]\d+)?\s?(?:lbs?|pounds?|oz|ounces?|kgs?|kg|g)\s*\)/ig, '');
};

// dedupeCommaParts(s)
// Splits a string on common separators and returns a deduplicated, comma-
// separated string. Useful for cleaning `distribution` fields like
// "CT, FL, IL, CT" -> "CT, FL, IL".
const dedupeCommaParts = (s) => {
    if (!s) return s;
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

// removeDuplicateAdjacentWords(s)
// Removes immediate repeated words, preserving order. Example: "Fresh Fresh Eggs"
// becomes "Fresh Eggs".
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

// sanitizeTitle(title)
// Runs a series of small cleaning steps to produce a compact, readable title:
// - remove measurements, collapse extra whitespace
// - split and dedupe comma/dash parts
// - remove duplicate adjacent words
// - trim stray punctuation
const sanitizeTitle = (title) => {
    if (!title) return title;
    let s = title;
    s = removeWeightPatterns(s);
    s = s.replace(/\s{2,}/g, ' ');
    s = s.trim();
    s = dedupeCommaParts(s);
    s = removeDuplicateAdjacentWords(s);
    s = s.replace(/^[,\-:\s]+|[,\-:\s]+$/g, '');
    return s;
};

// sanitizeReason(reason, title)
// Cleans the reason field by removing measurements and trimming whitespace.
// If the reason repeats the title text, this function shortens the reason
// to avoid duplicate information in the UI (prefers the first sentence).
const sanitizeReason = (reason, title) => {
    if (!reason) return reason;
    let r = reason;
    r = removeWeightPatterns(r);
    r = r.replace(/\s{2,}/g, ' ').trim();
    if (title && r.toLowerCase().includes(title.toLowerCase())) {
        const firstSentenceMatch = r.match(/^(.*?\.)\s/);
        if (firstSentenceMatch) r = firstSentenceMatch[1];
        if (r.length > 140) r = r.slice(0, 137) + '...';
    }
    return r;
};

// getHome controller
// Steps performed:
// 1. Check DB connection and load active recall documents (most recent first).
// 2. For each recall: normalize raw data, compute cleaned title/reason, derive
//    affected locations, and pick an image URL via keyword/category lookup.
// 3. Load recent community posts and render the `index` view with prepared
//    `recalls` and `posts` arrays.
exports.getHome = async (req, res) => {
    try {
        console.log('Home controller called');

        let activeRecalls = [];
        let recentPosts = [];

        const mongoose = require('mongoose');
        const isDbConnected = mongoose.connection.readyState === 1;

        if (isDbConnected) {
            try {
                activeRecalls = await Recall.find({ isActive: true })
                    .sort({ recallDate: -1 })
                    .limit(6)
                    .lean();

                console.log(`Found ${activeRecalls.length} active recalls`);

                activeRecalls = activeRecalls.map(recall => {
                    const normalizedRecall = recallsController.normalizeRecallData(recall);
                    
                    const category = normalizedRecall.category || 'other';

                    const cleanedTitle = normalizedRecall.title || normalizedRecall.product || '';
                    const cleanedReason = sanitizeReason(normalizedRecall.reason || normalizedRecall.description || '', cleanedTitle);

                    let locations = '';
                    if (Array.isArray(normalizedRecall.statesAffected) && normalizedRecall.statesAffected.length > 0) {
                        const unique = [...new Set(normalizedRecall.statesAffected.map(s => (s || '').trim()).filter(Boolean))];
                        locations = unique.join(', ');
                    } else if (normalizedRecall.distribution) {
                        locations = dedupeCommaParts(normalizedRecall.distribution);
                    }

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

                recentPosts = await Post.find({ isActive: true })
                    .populate('author', 'username')
                    .sort({ createdAt: -1 })
                    .limit(3)
                    .lean();

                console.log(`Homepage data loaded: ${recentPosts.length} posts, ${activeRecalls.length} recalls`);
            } catch (dbError) {
                console.log('Database query failed:', dbError.message);
            }
        } else {
            console.log('MongoDB not connected, using empty data');
        }

        console.log('Rendering index.ejs');
        res.render('index', {
            title: 'FoodGuard - Home',
            recalls: activeRecalls, // This now contains the 'categoryImage' property
            posts: recentPosts,
            user: req.user
        });

    } catch (error) {
        console.error('Home controller error:', error);
        res.render('index', {
            title: 'FoodGuard - Home',
            recalls: [],
            posts: [],
            user: req.user
        });
    }
};