// controllers/home.js
// Purpose: prepare data for the homepage (views/index.ejs).
// Loads recent posts and active recalls (preferring FSIS provider data),
// sanitizes titles/reasons for UI display, selects category images, and
// passes the prepared objects to the EJS view.

const Post = require('../models/Post');
const Recall = require('../models/Recall');
const recallsController = require('./recalls');

// We'll use a small set of local images (placed under `public/imgs/home/`)
// and match them semantically to recall titles/products/brands when possible.
// If no semantic match is found we fall back to cycling through the images.
const localHeroImages = [
    '/imgs/home/burrito.jpg',
    '/imgs/home/cauliflower.jpg',
    '/imgs/home/croquette.jpg',
    '/imgs/home/jerky.jpg',
    '/imgs/home/pulledpork.jpg',
    '/imgs/home/spinach.jpg'
];

// Map each local image to a set of keywords to match against titles/products/brands.
const localImageKeywords = {
    '/imgs/home/burrito.jpg': ['burrito', 'taco', 'wrap'],
    '/imgs/home/cauliflower.jpg': ['cauliflower', 'cauli'],
    '/imgs/home/croquette.jpg': ['croquette', 'croquettes'],
    '/imgs/home/jerky.jpg': ['jerky', 'beef jerky'],
    '/imgs/home/pulledpork.jpg': ['pulled pork', 'pulledpork', 'pulled', 'barbecue', 'bbq'],
    '/imgs/home/spinach.jpg': ['spinach']
};

const findLocalImageForText = (text) => {
    if (!text) return null;
    const normalized = text.toLowerCase();
    // Build list of [image,keyword] sorted by keyword length desc so longer phrases match first
    const candidates = [];
    for (const img of Object.keys(localImageKeywords)) {
        for (const kw of localImageKeywords[img]) candidates.push([img, kw]);
    }
    candidates.sort((a, b) => b[1].length - a[1].length);
    for (const [img, kw] of candidates) {
        if (normalized.includes(kw)) return img;
    }
    return null;
};

// Helpers for cleaning strings
const removeWeightPatterns = (s) => {
    if (!s) return s;
    return s.replace(/\b\d+(?:[\.,]\d+)?\s?(?:lbs?|pounds?|oz|ounces?|kgs?|kg|g)\b/ig, '')
        .replace(/\(\s*\d+(?:[\.,]\d+)?\s?(?:lbs?|pounds?|oz|ounces?|kgs?|kg|g)\s*\)/ig, '');
};

const dedupeCommaParts = (s) => {
    if (!s) return s;
    const parts = s.split(/[,/\-]+/).map(p => p.trim()).filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const p of parts) {
        const key = p.toLowerCase();
        if (!seen.has(key)) { seen.add(key); out.push(p); }
    }
    return out.join(', ');
};

const removeDuplicateAdjacentWords = (s) => {
    if (!s) return s;
    const words = s.split(/\s+/);
    const out = [];
    let last = null;
    for (const w of words) {
        if (w.toLowerCase() !== last) { out.push(w); last = w.toLowerCase(); }
    }
    return out.join(' ');
};

const sanitizeTitle = (title) => {
    if (!title) return title;
    let s = title;
    s = removeWeightPatterns(s);
    s = s.replace(/\s{2,}/g, ' ').trim();
    s = dedupeCommaParts(s);
    s = removeDuplicateAdjacentWords(s);
    s = s.replace(/^[,\-:\s]+|[,\-:\s]+$/g, '');
    return s;
};

const sanitizeReason = (reason, title) => {
    if (!reason) return reason;
    let r = reason;
    r = removeWeightPatterns(r);
    r = r.replace(/\s{2,}/g, ' ').trim();
    if (title && r.toLowerCase().includes(title.toLowerCase())) {
        const m = r.match(/^(.*?\.)\s/);
        if (m) r = m[1];
        if (r.length > 140) r = r.slice(0, 137) + '...';
    }
    return r;
};

// Main: render homepage
exports.getHome = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const isDbConnected = mongoose.connection.readyState === 1;

        let activeRecalls = [];
        let recentPosts = [];

        if (isDbConnected) {
            try {
                // Try FSIS API first (prefer provider titles), filter to 2025, take newest 6
                const recallApi = require('../services/recallAPI');
                try {
                    const fsis = await recallApi.fetchFSISRecalls({ limit: 200, monthsBack: 12 });
                    const activeFsis = (fsis || []).filter(r => r && r.isActive);
                    const start2025 = new Date('2025-01-01T00:00:00Z');
                    const start2026 = new Date('2026-01-01T00:00:00Z');
                    const filtered = activeFsis.filter(r => {
                        const d = r.recallDate ? new Date(r.recallDate) : null;
                        return d && d >= start2025 && d < start2026;
                    });
                    filtered.sort((a, b) => new Date(b.recallDate) - new Date(a.recallDate));
                    const top = filtered.slice(0, 6);
                    activeRecalls = top.map((r, idx) => {
                        const normalized = recallsController.normalizeRecallData(r);
                        const category = normalized.category || (Array.isArray(normalized.categories) && normalized.categories[0]) || 'other';
                        const cleanedTitle = sanitizeTitle(normalized.title || ((normalized.product && normalized.brand) ? `${normalized.product} - ${normalized.brand}` : (normalized.brand || 'Product Recall')));
                        const cleanedReason = sanitizeReason(normalized.reason || normalized.description || '', cleanedTitle);
                        let locations = '';
                        if (Array.isArray(normalized.statesAffected) && normalized.statesAffected.length) {
                            locations = [...new Set(normalized.statesAffected.map(s => (s || '').trim()).filter(Boolean))].join(', ');
                        } else if (normalized.distribution) {
                            locations = dedupeCommaParts(normalized.distribution);
                        }
                        // Try to find a local image semantically matching the title/product/brand
                        const searchText = `${cleanedTitle} ${normalized.product || ''} ${normalized.brand || ''} ${(Array.isArray(normalized.categories) ? normalized.categories.join(' ') : '')}`;
                        const matched = findLocalImageForText(searchText);
                        const chosenImage = matched || localHeroImages[idx % localHeroImages.length] || '/imgs/placeholder-food.png';
                        // Build `urls` array: prefer normalized.articleLink, then any provider/raw data links
                        const urls = [];
                        const pushUrl = (u) => { if (u && typeof u === 'string') { const v = u.trim(); if (v && !urls.includes(v)) urls.push(v); } };
                        pushUrl(normalized.articleLink);
                        if (r && r.articleLink) pushUrl(r.articleLink);
                        if (r && r.rawData) {
                            const rd = r.rawData;
                            pushUrl(rd.field_recall_url || rd.RecallUrl || rd.RecallURL || rd.recall_url || rd.recallUrl || rd.URL || rd.url || rd.link);
                        }

                        return { ...normalized, cleanedTitle, cleanedReason, locations, categoryImage: chosenImage, image: chosenImage, urls };
                    });
                } catch (apiErr) {
                    // Fallback to DB query
                    console.warn('FSIS API failed (homepage); falling back to DB:', apiErr && apiErr.message);
                    const start2025 = new Date('2025-01-01T00:00:00Z');
                    const start2026 = new Date('2026-01-01T00:00:00Z');
                    const recalls = await Recall.find({ isActive: true, agency: 'FSIS', recallDate: { $gte: start2025, $lt: start2026 } })
                        .sort({ recallDate: -1 })
                        .limit(6)
                        .lean();
                    activeRecalls = recalls.map((recall, idx) => {
                        const normalized = recallsController.normalizeRecallData(recall);
                        const category = normalized.category || (Array.isArray(normalized.categories) && normalized.categories[0]) || 'other';
                        const cleanedTitle = sanitizeTitle(normalized.title || ((normalized.product && normalized.brand) ? `${normalized.product} - ${normalized.brand}` : (normalized.brand || 'Product Recall')));
                        const cleanedReason = sanitizeReason(normalized.reason || normalized.description || '', cleanedTitle);
                        let locations = '';
                        if (Array.isArray(normalized.statesAffected) && normalized.statesAffected.length) {
                            locations = [...new Set(normalized.statesAffected.map(s => (s || '').trim()).filter(Boolean))].join(', ');
                        } else if (normalized.distribution) {
                            locations = dedupeCommaParts(normalized.distribution);
                        }
                        const searchText = `${cleanedTitle} ${normalized.product || ''} ${normalized.brand || ''} ${(Array.isArray(normalized.categories) ? normalized.categories.join(' ') : '')}`;
                        const matched = findLocalImageForText(searchText);
                        const chosenImage = matched || localHeroImages[idx % localHeroImages.length] || '/imgs/placeholder-food.png';
                        const urls = [];
                        const pushUrl = (u) => { if (u && typeof u === 'string') { const v = u.trim(); if (v && !urls.includes(v)) urls.push(v); } };
                        pushUrl(normalized.articleLink);
                        if (recall && recall.articleLink) pushUrl(recall.articleLink);
                        if (recall && recall.rawData) {
                            const rd = recall.rawData;
                            pushUrl(rd.field_recall_url || rd.RecallUrl || rd.RecallURL || rd.recall_url || rd.recallUrl || rd.URL || rd.url || rd.link);
                        }
                        return { ...normalized, cleanedTitle, cleanedReason, locations, categoryImage: chosenImage, image: chosenImage, urls };
                    });
                }

                // Load recent posts
                recentPosts = await Post.find({ isActive: true }).populate('author', 'username').sort({ createdAt: -1 }).limit(3).lean();
            } catch (dbErr) {
                console.error('Homepage DB error:', dbErr && dbErr.message);
            }
        } else {
            console.warn('MongoDB not connected — homepage will show no recalls');
        }

        // Fetch latest FSIS recall for banner (best-effort)
        let latestAlert = null;
        try {
            const recallApi = require('../services/recallAPI');
            const fsis = await recallApi.fetchFSISRecalls({ limit: 10, monthsBack: 6 });
            const activeFsis = (fsis || []).filter(r => r && r.isActive);
            if (activeFsis.length) {
                activeFsis.sort((a, b) => new Date(b.recallDate) - new Date(a.recallDate));
                latestAlert = activeFsis[0];
            }
        } catch (e) {
            // ignore
        }

        res.render('index', { title: 'FoodGuard - Home', recalls: activeRecalls, posts: recentPosts, user: req.user, latestAlert });
    } catch (err) {
        console.error('Home controller error:', err && err.message);
        res.render('index', { title: 'FoodGuard - Home', recalls: [], posts: [], user: req.user });
    }
};

    // Render a simple visual Food Safety Tips page (4 steps)
    exports.getTips = (req, res) => {
        try {
            res.render('food-safety', { title: 'Food Safety Tips - FoodGuard', user: req.user });
        } catch (err) {
            console.error('Error rendering tips page:', err && err.message);
            res.render('food-safety', { title: 'Food Safety Tips - FoodGuard', user: req.user });
        }
    };