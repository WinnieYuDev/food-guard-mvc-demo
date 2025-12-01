/**
 * Recalls Controller
 *
 * Responsible for handling requests related to product recalls. This module
 * provides controller actions used by Express routes (rendering the recalls
 * page, returning JSON for the API, normalizing recall data, and
 * synchronizing/storing API results in the local database).
 *
 * Key exported functions:
 *  - getRecalls(req, res): render the recalls page (supports search, filters)
 *  - normalizeRecallData(recall): normalize / clean incoming recall objects
 *  - saveApiResultsToDB(apiRecalls): persist normalized API results to DB
 *  - reNormalizeAllRecalls(): migration utility to re-run normalization
 *  - getNews(req, res): server-side proxy to fetch recent FDA news
 */
const Recall = require('../models/Recall');
const recallApiService = require('../services/recallAPI');
const axios = require('axios');
const https = require('https');
const dev = process.env.NODE_ENV === 'development';

// === Helpers: Text normalization ===
// Functions that clean and normalize free-form text fields (brand, product)
// so titles and labels can be consistently displayed and indexed.
const cleanBrandName = (brandText) => {
  if (!brandText) return 'Unknown Brand';
  
  let cleaned = brandText;
  
  cleaned = cleaned.replace(/,?\s*\d+\s+[A-Za-z\s]+(?:Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Court|Ct|Place|Pl)\.?[,\s]*/gi, '');
  cleaned = cleaned.replace(/,?\s*[A-Z][a-z]+,\s*[A-Z]{2}\s*\d{5}(-\d{4})?/g, ''); // City, ST 12345
  cleaned = cleaned.replace(/,?\s*[A-Z]{2}\s*\d{5}(-\d{4})?/g, ''); // ST 12345
  // Remove "DBA" or "d/b/a" and anything after it (we want the company name)
  cleaned = cleaned.replace(/\s+(?:d\/b\/a|dba)(?:\s+.*)?$/i, '');
  
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  }
  
  const parts = cleaned.split('.');
  if (parts.length > 1) {
    const companyName = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      
      companyName.push(part);
      
      if (/\b(Inc|LLC|Corp|Corporation|Co|Company|Ltd|Limited)$/i.test(part)) {
        break;
      }
    }
    cleaned = companyName.join('.') + (companyName[companyName.length - 1].match(/\b(Inc|LLC|Corp|Co|Ltd)$/i) ? '.' : '');
  }
  
  cleaned = cleaned.trim();

  // Normalize casing: title-case most words but keep corporate suffixes uppercase
  const suffixPattern = /\b(Inc|LLC|Corp|Corporation|Co|Company|Ltd|Limited)\.?$/i;
  let suffixMatch = cleaned.match(suffixPattern);
  let suffix = '';
  if (suffixMatch) {
    suffix = suffixMatch[1].toUpperCase();
    cleaned = cleaned.replace(suffixPattern, '').trim();
  }

  // Title case remaining words
  cleaned = cleaned.split(/\s+/).map(w => {
    const lower = w.toLowerCase();
    if (['and','of','the','&','for','in','at','by','llc','inc','co','corp','ltd'].includes(lower)) {
      // keep short words lowercase or handled as suffixes
      return (w.length <= 2) ? w.toUpperCase() : (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');

  if (suffix) {
    cleaned = `${cleaned}, ${suffix}.`;
  }

  return cleaned || 'Unknown Brand';
};

const cleanProductTitle = (title) => {
  if (!title) return 'Unknown Product';
  
  let cleaned = title;
  
  const stopPhrases = [
    /\s+(?:bag\s+)?contains:/i,
    /\s+imported\s+by/i,
    /\s+distributed\s+by/i,
    /\s+manufactured\s+for:/i,
    /\.\s*net\s+wt/i,
    /\s+net\s+wt\.?/i,
    /;\s*net\s+wt/i,
    /;\s*ingredients:/i,
    /\.\s*bulk\./i,
    /\s+bulk\./i,
    /\.\s*keep\s+frozen/i,
    /\s+keep\s+frozen/i,
    /;\s*produced\s+on/i,
    /;\s*manufactured\s+by:/i,
    /\.\s*manufactured\s+by:/i,
    /\s+manufactured\s+by:/i,
    /;\s*upc#?\s*/i,
    /\s+upc#?\s*/i,
    /\s+\d+\s+count\/case/i,
    /\bnet\s+weight:/i,
    /\bstates?\s+affected:/i,
    /\bzip\s*codes?:/i,
    /\bdistribution:/i,
    /\bdist\s+by:/i,
    /;\s*\(/,  // semicolon followed by opening paren often indicates extra info
    /\s+product\s+name:/i,
    /\s+product\s+description:/i,
    /\s+pack\/julian\s+date/i,
    /\s+best\s+by\s+date/i
  ];
  
  for (const pattern of stopPhrases) {
    const match = cleaned.match(pattern);
    if (match) {
      cleaned = cleaned.substring(0, match.index);
      break;
    }
  }

  cleaned = cleaned.replace(/\([^)]*(net\s*wt|pkg|pkgs|per\s*case|count\/case|pack)[^)]*\)/ig, '');

  const segments = cleaned.split(/\.|\n/).map(s => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    const sizeSeg = segments.find(s => /\b\d{1,2}\/\d{1,2}\b/.test(s));
    if (sizeSeg) {
      cleaned = sizeSeg;
    } else {
      cleaned = segments[0];
    }
  }
  
  cleaned = cleaned.replace(/\s+(bag|package|box|pack)\s*$/i, '');
  
  cleaned = cleaned.replace(/\s*\d+\s*(count|ct|pack|pk)\s*\/\s*(case|cs|box)\s*/gi, '');
  
  const multipleItemsMatch = cleaned.match(/^(.+?)\s+\d+\.\s+/);
  if (multipleItemsMatch) {
    cleaned = multipleItemsMatch[1];
  }
  
  cleaned = cleaned.replace(/^\d+\.\s+/g, '');
  
  cleaned = cleaned.replace(/^(brand|product)\s+/i, '');
  
  cleaned = cleaned.replace(/^[a-z]+\s+(mf|sku|item|code|#)\s*\d+\s*/i, '');
  
  cleaned = cleaned.replace(/\b(cnfree|cage\s*free)\s+(cage\s*free)\b/gi, 'Cage Free'); // dedupe "cnfree cage free"
  cleaned = cleaned.replace(/\bcnfree\b/gi, 'Cage Free'); // convert cnfree to readable
  cleaned = cleaned.replace(/\biaf\b/gi, 'IAF'); // normalize IAF
  
  cleaned = cleaned.replace(/\b(pure\s+)?alumini?um\s+(made\s+in\s+\w+\s+-\s+)?/gi, '');
  cleaned = cleaned.replace(/\bstainless\s+steel\s+/gi, '');
  cleaned = cleaned.replace(/\bmade\s+in\s+\w+\s+-\s+/gi, '');
  
  cleaned = cleaned.replace(/\b\d+(\.\d+)?\s*(oz|lb|lbs|g|kg|ml|l)\b/gi, '');
  
  cleaned = cleaned.replace(/\b\d+(\.\d+)?\s*(inch|inches|in|cm|mm|ft|feet)\b/gi, '');
  
  cleaned = cleaned.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '');
  cleaned = cleaned.replace(/\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g, '');
  
  cleaned = cleaned.replace(/\bupc[\s:]*([\d\s]+)/gi, '');
  cleaned = cleaned.replace(/\bbarcode[\s:]*([\d\s]+)/gi, '');
  
  cleaned = cleaned.replace(/\s*\.\s*\.\s*/g, ' ');
  cleaned = cleaned.replace(/\.\s*$/g, '');
  
  cleaned = cleaned.replace(/;\s*\(\s*\)/g, '');
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  
  cleaned = cleaned.replace(/\s*[;,]\s*$/g, ''); // trailing semicolons/commas
  cleaned = cleaned.replace(/;\s*;+/g, ''); // double+ semicolons anywhere
  cleaned = cleaned.replace(/;\s*$/g, ''); // trailing semicolons
  cleaned = cleaned.replace(/\s+/g, ' '); // multiple spaces
  cleaned = cleaned.trim();
  
  return cleaned || 'Unknown Product';
};

const isNonFoodItem = (productText, titleText) => {
  const combined = `${productText || ''} ${titleText || ''}`.toLowerCase();
  
  const foodIndicators = [
    'egg', 'eggs', 'milk', 'cheese', 'yogurt', 'butter',
    'chicken', 'beef', 'pork', 'fish', 'shrimp',
    'vegetable', 'fruit', 'bread', 'pasta', 'noodle'
  ];
  
  if (foodIndicators.some(food => combined.includes(food))) {
    const strictNonFoodKeywords = [
      'aluminium pan', 'aluminum pan', 'milk pan', 'kadai', 'wok', 'skillet',
      'stainless steel', 'cookware', 'utensil', 'spatula',
      'cutting board', 'chopping board'
    ];
    return strictNonFoodKeywords.some(keyword => combined.includes(keyword));
  }
  
  const nonFoodKeywords = [
    'aluminium', 'aluminum', 'stainless steel', 'steel',
    'pan', 'pot', 'kadai', 'wok', 'skillet', 'cookware',
    'utensil', 'spoon', 'fork', 'knife', 'spatula',
    'thermos', 'flask',
    'cutting board', 'chopping board',
    'serving tray', 'platter'
  ];
  
  return nonFoodKeywords.some(keyword => combined.includes(keyword));
};

const fetchJson = (url, timeout = 8000) => new Promise((resolve, reject) => {
  const req = https.get(url, { timeout }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
  });
  req.on('error', reject);
  req.on('timeout', () => {
    req.destroy(new Error('Request timed out'));
  });
});

/**
 * getRecalls
 *
 * Renders the recalls listing page. Supports optional query parameters for
 * pagination, search, category, retailer, riskLevel and sorting. The handler
 * will attempt to fetch live API data (FDA/FSIS) quickly and fall back to the
 * local database if the API does not respond in time or when requested.
 *
 * Flow:
 *  - Build filter criteria from request
 *  - Try a short-lived API fetch (non-blocking for page load)
 *  - Apply server-side filtering/sorting and normalize results
 *  - Render the `recalls` template with prepared data (and option lists)
 */
// === Controller Actions ===
// Public route handlers used by Express. These prepare data for rendering
// or return JSON for API consumers.
exports.getRecalls = async (req, res) => {
  try {
    

    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const riskLevel = req.query.riskLevel;
    const search = req.query.search;
    const category = req.query.category;
    const retailer = req.query.retailer; // filter by retailer (from UI)
    const sortBy = req.query.sortBy || 'recallDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let recalls = [];
    let total = 0;

    const apiFilters = {
      search: search || '',
      limit: 100,
      monthsBack: 6
    };
    if (category && category !== 'all') {
      apiFilters.category = category;
    }
    if (retailer && retailer !== 'all') apiFilters.retailer = retailer;

    const categoryKeywords = {
      poultry: ['chicken','turkey','poultry','hen','duck','goose','quail','pheasant','partridge','grouse','guinea fowl','pheasant','partridge','grouse','guinea fowl'],
      beef: ['beef','steak','burger', 'ground beef', 'hamburger', 'beef patty', 'burger patty', 'ground beef patty'],
      pork: ['pork','bacon','sausage','ham', 'pork loin', 'pork chop', 'pork rib', 'pork shoulder', 'pork belly', 'bacon', 'sausage'],
      seafood: ['fish','salmon','tuna','shrimp','shellfish','crabmeat','krab','imitation crab','crab', 'lobster', 'clam', 'oyster', 'mussel', 'scallop', 'squid', 'shrimp', 'crab'],
      vegetables: ['spinach','lettuce','broccoli','vegetable','carrot','salad','onion','green onion','scallion', 'spring onion', 'kale', 'cabbage', 'celery', 'pepper', 'tomato', 'potato', 'cucumber', 'zucchini', 'eggplant', 'asparagus', 'chard', 'beetroot', 'radish', 'turnip', 'okra', 'artichoke', 'collard', 'mustard', 'parsley', 'chives', 'fennel', 'leek', 'shallot', 'garlic', 'shallot', 'garlic', 'onion', 'green onion', 'scallion', 'spring onion', 'kale', 'cabbage', 'celery', 'pepper', 'tomato', 'potato', 'cucumber', 'zucchini', 'eggplant', 'asparagus', 'chard', 'beetroot', 'radish', 'turnip', 'okra', 'artichoke', 'collard', 'mustard', 'parsley', 'chives', 'fennel', 'leek', 'shallot', 'garlic'],
      fruits: ['apple','berry','orange','fruit','melon','cantaloupe','honeydew','watermelon', 'banana', 'grape', 'kiwi', 'mango', 'peach', 'pear', 'pineapple', 'plum', 'pomegranate', 'raspberry', 'strawberry', 'tangerine', 'apricot', 'blueberry', 'blackberry', 'cherry', 'fig', 'grapefruit', 'lemon', 'lime', 'nectarine', 'orange', 'peach', 'pear', 'pineapple', 'plum', 'pomegranate', 'raspberry', 'strawberry', 'tangerine', 'apricot', 'blueberry', 'blackberry', 'cherry', 'fig', 'grapefruit', 'lemon', 'lime', 'nectarine', 'orange', 'peach', 'pear', 'pineapple', 'plum', 'pomegranate', 'raspberry', 'strawberry', 'tangerine', 'apricot', 'blueberry', 'blackberry', 'cherry', 'fig', 'grapefruit', 'lemon', 'lime', 'nectarine', 'orange'],
      dairy: ['milk','cheese','yogurt','dairy','ice cream', 'cream', 'butter', 'cheese', 'yogurt', 'cream', 'curd'],
      eggs: ['egg','eggs','egg product','egg products', 'omelet', 'omelette', 'frittata', 'quiche', 'scramble'],
      nuts: ['nut','peanut','almond','cashew','pistachio','walnut','hazelnut','macadamia','pecan','pistachio','walnut','hazelnut','macadamia','pecan'],
      grains: ['bread','flour','grain','noodle','noodles','pasta','ramen','burrito','sandwich','wrap', 'bakery','cereal','rice','cracker','tortilla','bagel','bun','muffin','croissant','pretzel'],
      snacks: ['cookie','candy','chocolate','snack','chip','cracker','bar','granola','pretzel','popcorn','jerky', 'chips', 'popcorn', 'pretzels', 'crackers', 'cookies', 'candy', 'chocolate', 'snacks', 'chips', 'popcorn', 'pretzels', 'crackers', 'cookies', 'candy', 'chocolate', 'snacks'],
      'baby-food': ['baby','infant','baby food','infant food','baby foods','infant foods','baby food product','infant food product','baby food products','infant food products','baby foods products','infant foods products'],
      other: ['other','miscellaneous','miscellaneous products','miscellaneous foods','other products','other foods','miscellaneous foods','other foods','miscellaneous foods','other foods','miscellaneous foods']
    };

    try {
      const apiPromise = recallApiService.fetchAllRecalls(apiFilters);
      const timeoutMs = 5000; // short wait to keep page load snappy
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));

      let apiRecalls = await Promise.race([apiPromise, timeoutPromise]);

        if (apiRecalls && Array.isArray(apiRecalls) && apiRecalls.length > 0) {
        

        if (riskLevel && riskLevel !== 'all') {
          apiRecalls = apiRecalls.filter(r => r.riskLevel === riskLevel);
        }

        if (search && String(search).trim().length > 0) {
          const s = String(search).toLowerCase();
          apiRecalls = apiRecalls.filter(r => {
            const title = (r.title || '').toString().toLowerCase();
            const product = (r.product || '').toString().toLowerCase();
            const brand = (r.brand || '').toString().toLowerCase();
            const desc = (r.description || '').toString().toLowerCase();

            return title.includes(s) || product.includes(s) || brand.includes(s) || desc.includes(s);
          });
        }

        if (category && category !== 'all') {
          const kws = categoryKeywords[category] || [];
          apiRecalls = apiRecalls.filter(r => {
            const title = (r.title || '').toString().toLowerCase();
            const product = (r.product || '').toString().toLowerCase();
            const desc = (r.description || '').toString().toLowerCase();

            const matchesKeywords = kws.length > 0 && kws.some(k => title.includes(k) || product.includes(k) || desc.includes(k));
            return (r.category === category) || matchesKeywords;
          });
        }

        try {
          apiRecalls.sort((a, b) => {
            const A = (a[sortBy] === undefined || a[sortBy] === null) ? '' : a[sortBy];
            const B = (b[sortBy] === undefined || b[sortBy] === null) ? '' : b[sortBy];
            if (sortBy === 'recallDate') {
              const ta = new Date(A).getTime();
              const tb = new Date(B).getTime();
              return (ta === tb) ? 0 : ((ta < tb) ? -1 * sortOrder : 1 * sortOrder);
            }
            if (typeof A === 'string' && typeof B === 'string') {
              return A.localeCompare(B) * sortOrder;
            }
            if (typeof A === 'number' && typeof B === 'number') {
              return (A - B) * sortOrder;
            }
            return (String(A).localeCompare(String(B))) * sortOrder;
          });
        } catch (sortErr) {
          console.warn('Failed to sort API recalls:', sortErr && sortErr.message);
        }

        total = apiRecalls.length;
        const startIndex = (page - 1) * limit;
        recalls = apiRecalls.slice(startIndex, startIndex + limit);

        exports.saveApiResultsToDB(apiRecalls).catch(err => console.error('Failed to save API results to DB:', err.message));
      } else {
      

        const dbBase = { isActive: true };

        const searchOr = [];
        if (search) {
          searchOr.push(
            { title: { $regex: search, $options: 'i' } },
            { product: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          );
        }

        let categoryOr = [];
        const effectiveCategory = category && category !== 'all' ? category : null;

        if (effectiveCategory) {
          const kws = categoryKeywords[effectiveCategory] || [];
          categoryOr.push({ category: effectiveCategory });

          const keywordOr = [];
          kws.forEach(k => {
            keywordOr.push({ title: { $regex: k, $options: 'i' } });
            keywordOr.push({ product: { $regex: k, $options: 'i' } });
            keywordOr.push({ description: { $regex: k, $options: 'i' } });
          });

          if (keywordOr.length > 0) {
            categoryOr.push({ $or: keywordOr });
          }
        }

        let dbQuery = { ...dbBase };
        if (searchOr.length > 0 && categoryOr.length > 0) {
          dbQuery.$and = [ { $or: searchOr }, { $or: categoryOr } ];
        } else if (searchOr.length > 0) {
          dbQuery.$or = searchOr;
        } else if (categoryOr.length > 0) {
          dbQuery.$or = categoryOr;
        }

        if (retailer && retailer !== 'all') dbQuery.retailer = retailer;
        if (riskLevel && riskLevel !== 'all') dbQuery.riskLevel = riskLevel;

        const dbResults = await Recall.find(dbQuery)
          .sort({ [sortBy]: sortOrder })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        recalls = dbResults;
        total = await Recall.countDocuments(dbQuery);
      }
    } catch (apiError) {
      console.error('API fetch error:', apiError.message);

      const dbBase = { isActive: true };

      const searchOr = [];
      if (search) {
        searchOr.push(
          { title: { $regex: search, $options: 'i' } },
          { product: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        );
      }

      let categoryOr = [];
      const effectiveCategory = category && category !== 'all' ? category : null;

      if (effectiveCategory) {
        const kws = categoryKeywords[effectiveCategory] || [];
        categoryOr.push({ category: effectiveCategory });

        const keywordOr = [];
        kws.forEach(k => {
          keywordOr.push({ title: { $regex: k, $options: 'i' } });
          keywordOr.push({ product: { $regex: k, $options: 'i' } });
          keywordOr.push({ description: { $regex: k, $options: 'i' } });
        });

        if (keywordOr.length > 0) {
          categoryOr.push({ $or: keywordOr });
        }
      }

      let dbQuery = { ...dbBase };
      if (searchOr.length > 0 && categoryOr.length > 0) {
        dbQuery.$and = [ { $or: searchOr }, { $or: categoryOr } ];
      } else if (searchOr.length > 0) {
        dbQuery.$or = searchOr;
      } else if (categoryOr.length > 0) {
        dbQuery.$or = categoryOr;
      }

      if (retailer && retailer !== 'all') dbQuery.retailer = retailer;
      if (riskLevel && riskLevel !== 'all') dbQuery.riskLevel = riskLevel;

      const dbResults = await Recall.find(dbQuery)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      recalls = dbResults;
      total = await Recall.countDocuments(dbQuery);
    }

    recalls = recalls.map(recall => exports.normalizeRecallData(recall));

    const totalPages = Math.ceil(total / limit);

    const categoryOptions = [
      { value: 'poultry', label: 'Poultry' },
      { value: 'beef', label: 'Beef' },
      { value: 'pork', label: 'Pork' },
      { value: 'seafood', label: 'Seafood' },
      { value: 'vegetables', label: 'Vegetables' },
      { value: 'fruits', label: 'Fruits' },
      { value: 'dairy', label: 'Dairy' },
      { value: 'eggs', label: 'Eggs' },
      { value: 'nuts', label: 'Nuts' },
      { value: 'grains', label: 'Grains' },
      { value: 'snacks', label: 'Snacks' },
      { value: 'baby-food', label: 'Baby Food' },
      { value: 'other', label: 'Other' }
    ];


    const agencyOptions = [
      { value: 'FDA', label: 'FDA' },
      { value: 'FSIS', label: 'USDA FSIS' },
      { value: 'all', label: 'All Agencies' }
    ];

    const retailerOptions = [
      { value: 'all', label: 'All Retailers' },
      { value: 'trader-joes', label: 'Trader Joe\'s' },
      { value: 'whole-foods', label: 'Whole Foods' },
      { value: 'kroger', label: 'Kroger' },
      { value: 'walmart', label: 'Walmart' },
      { value: 'costco', label: 'Costco' },
      { value: 'target', label: 'Target' },
      { value: 'safeway', label: 'Safeway' },
      { value: 'albertsons', label: 'Albertsons' },
      { value: 'various-retailers', label: 'Various Retailers' }
    ];

    const riskLevelOptions = [
      { value: 'high', label: 'High Risk' },
      { value: 'medium', label: 'Medium Risk' },
      { value: 'low', label: 'Low Risk' },
      { value: 'all', label: 'All Risk Levels' }
    ];

    res.render('recalls', {
      title: 'Food Recalls & Safety Alerts - FoodGuard',
      recalls,
      user: req.user,
      pagination: {
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        riskLevel: riskLevel || 'all',
        search: search || '',
        category: category || 'all',
        retailer: retailer || 'all',
        sortBy: sortBy || 'recallDate',
        sortOrder: sortOrder === 1 ? 'asc' : 'desc'
      },
      categoryOptions,
      agencyOptions,
      retailerOptions,
      riskLevelOptions,
      showLiveData: req.query.live === 'true'
    });
  } catch (error) {
    console.error('Recalls controller error:', error);
    
    const categoryOptions = [
      { value: 'poultry', label: 'Poultry' },
      { value: 'vegetables', label: 'Vegetables' }
    ];

    const agencyOptions = [
      { value: 'FDA', label: 'FDA' },
      { value: 'FSIS', label: 'USDA FSIS' }
    ];

    const retailerOptions = [
      { value: 'all', label: 'All Retailers' },
      { value: 'trader-joes', label: 'Trader Joe\'s' },
      { value: 'whole-foods', label: 'Whole Foods' },
      { value: 'kroger', label: 'Kroger' },
      { value: 'walmart', label: 'Walmart' },
      { value: 'costco', label: 'Costco' },
      { value: 'target', label: 'Target' },
      { value: 'safeway', label: 'Safeway' },
      { value: 'albertsons', label: 'Albertsons' },
      { value: 'various-retailers', label: 'Various Retailers' }
    ];

    res.render('recalls', {
      title: 'Food Recalls & Safety Alerts - FoodGuard',
      recalls: [],
      user: req.user,
      pagination: { page: 1, totalPages: 1, hasNext: false, hasPrev: false },
      filters: {
        riskLevel: 'all',
        search: '',
        category: 'all',
        retailer: 'all',
        sortBy: 'recallDate',
        sortOrder: 'desc'
      },
      categoryOptions,
      agencyOptions,
      retailerOptions,
      riskLevelOptions: [
        { value: 'high', label: 'High Risk' },
        { value: 'medium', label: 'Medium Risk' },
        { value: 'low', label: 'Low Risk' }
      ]
    });
  }
};

exports.lookupProduct = async (req, res) => {
  try {
    const { barcode, productName } = req.body;
    
    

    if (!barcode && !productName) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either a barcode or product name'
      });
    }

    const searchTerm = productName || barcode || '';
    let relatedRecalls = [];

    let offProduct = null;
    try {
      if (barcode) {
        const offResp = await fetchJson(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`, 8000);
        if (offResp && offResp.status === 1 && offResp.product) {
          offProduct = offResp.product;
        }
      } else if (productName) {
        const params = new URLSearchParams({ search_terms: productName, search_simple: 1, action: 'process', json: 1, page_size: 8 });
        const offResp = await fetchJson(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, 8000);

        if (offResp && Array.isArray(offResp.products) && offResp.products.length > 0) {
          const products = offResp.products;
          let best = null;
          let bestScore = -1;
          for (const p of products) {
            let score = 0;
            if (p.product_name && String(p.product_name).trim().length > 0) score += 5;
            if (p.brands && String(p.brands).trim().length > 0) score += 3;
            if (p.code || p._id) score += 2;
            if (p.ingredients_text || p.ingredients_text_with_allergens) score += 1;
            if (score > bestScore) { best = p; bestScore = score; }
          }
          offProduct = best || products[0];
        } else {
          // No OFF products returned for term
        }
      }
    } catch (offErr) {
      console.warn('OpenFoodFacts lookup failed:', offErr && offErr.message);
      offProduct = null;
    }

    if (searchTerm) {
      relatedRecalls = await Recall.find({
        $or: [
          { product: { $regex: searchTerm, $options: 'i' } },
          { brand: { $regex: searchTerm, $options: 'i' } },
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ],
        isActive: true
      })
      .sort({ recallDate: -1 })
      .limit(10)
      .lean();

      if (relatedRecalls.length === 0) {
        // No database results; searching external APIs
        try {
          const apiRecalls = await recallApiService.searchRecalls(searchTerm, 10);
          relatedRecalls = apiRecalls.map(recall => this.normalizeRecallData(recall));
          
          if (relatedRecalls.length > 0) {
            try {
              await this.saveApiResultsToDB(relatedRecalls);
            } catch (saveError) {
              console.error('Failed to save search results to DB:', saveError.message);
            }
          }
          } catch (apiError) {
          console.error('API search error:', apiError.message);
        }
      }
    }

    relatedRecalls = relatedRecalls.map(recall => this.normalizeRecallData(recall));

    const safetyInfo = relatedRecalls.length > 0 ? {
      status: 'RECALL_ACTIVE',
      message: 'This product has active recalls. Do not consume.',
      riskLevel: relatedRecalls[0].riskLevel,
      totalRecalls: relatedRecalls.length,
      severity: 'high',
      recommendedAction: 'Return product to place of purchase or dispose of properly.'
    } : {
      status: 'NO_RECALLS_FOUND',
      message: 'No active recalls found for this product.',
      riskLevel: 'low',
      totalRecalls: 0,
      severity: 'none',
      recommendedAction: 'Continue normal use while monitoring for updates.'
    };

    let productName_clean = productName || 'Product Lookup';
    let brandName = 'N/A';
    let productBarcode = barcode || 'N/A';
    let productIngredients = 'N/A';
    
    if (offProduct) {
      productName_clean = offProduct.product_name || offProduct.generic_name || offProduct.abbreviated_product_name || productName_clean;
      
      if (offProduct.brands) {
        const brandList = String(offProduct.brands).split(',').map(b => b.trim()).filter(Boolean);
        brandName = brandList[0] || 'N/A';
      } else if (Array.isArray(offProduct.brands_tags) && offProduct.brands_tags.length > 0) {
        brandName = offProduct.brands_tags[0].replace(/^en:/, '').trim();
      }
      
      productBarcode = offProduct.code || offProduct._id || productBarcode;
      
      productIngredients = offProduct.ingredients_text || offProduct.ingredients_text_with_allergens || productIngredients;
    } else if (relatedRecalls && relatedRecalls.length > 0) {
      brandName = relatedRecalls[0].brand || 'N/A';
    }
    
    const productPayload = {
      name: cleanProductTitle(productName_clean),
      barcode: productBarcode,
      brand: brandName,
      allergens: [],
      ingredients: productIngredients,
      nutritionFacts: null,
      searchTerm: searchTerm
    };

    if (offProduct) {
      if (Array.isArray(offProduct.allergens_tags) && offProduct.allergens_tags.length > 0) {
        productPayload.allergens = offProduct.allergens_tags.map(a => a.replace('en:', '').replace('en', '').replace(/^:/, '')).filter(Boolean);
      } else if (offProduct.allergens) {
        productPayload.allergens = String(offProduct.allergens).split(',').map(s => s.trim()).filter(Boolean);
      }

      if (offProduct.nutriments) {
        productPayload.nutritionFacts = {
          calories: offProduct.nutriments['energy-kcal_100g'] || offProduct.nutriments['energy-kcal'] || offProduct.nutriments['energy_100g'] || null,
          protein: offProduct.nutriments['proteins_100g'] || offProduct.nutriments['proteins'] || null,
          carbs: offProduct.nutriments['carbohydrates_100g'] || offProduct.nutriments['carbohydrates'] || null,
          fat: offProduct.nutriments['fat_100g'] || offProduct.nutriments['fat'] || null
        };
      }

    }

    res.json({
      success: true,
      product: productPayload,
      relatedRecalls,
      hasRecalls: relatedRecalls.length > 0,
      safetyInfo,
      search: {
        barcode,
        productName,
        timestamp: new Date().toISOString(),
        resultsCount: relatedRecalls.length
      }
    });

  } catch (error) {
    console.error('Product lookup error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to lookup product information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getRecall = async (req, res) => {
  try {
    let recall = await Recall.findById(req.params.id).lean();
    
    if (!recall) {
      // Recall not in DB; redirecting to recalls list
      return res.redirect('/recalls');
    }

    recall = this.normalizeRecallData(recall);

    const relatedRecalls = await Recall.find({
      _id: { $ne: recall._id },
      $or: [
        { category: recall.category },
        { brand: recall.brand },
        { agency: recall.agency }
      ],
      isActive: true
    })
    .limit(4)
    .lean()
    .map(rec => this.normalizeRecallData(rec));

    res.render('recall-detail', { // Changed from 'post' to 'recall-detail'
      title: `${recall.title} - FoodGuard`,
      recall: recall,
      relatedRecalls,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching recall details:', error);
    res.redirect('/recalls');
  }
};

exports.apiGetRecalls = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      agency, 
      riskLevel,
      limit = 50,
      source = 'all' // 'db', 'api', or 'all'
    } = req.query;

    let recalls = [];

    if (source === 'db' || source === 'all') {
      const dbQuery = { isActive: true };
      
      if (search) {
        dbQuery.$or = [
          { title: { $regex: search, $options: 'i' } },
          { product: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } }
        ];
      }
      if (category && category !== 'all') dbQuery.category = category;
      if (agency && agency !== 'all') dbQuery.agency = agency;
      if (riskLevel && riskLevel !== 'all') dbQuery.riskLevel = riskLevel;

      recalls = await Recall.find(dbQuery)
        .sort({ recallDate: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    if ((recalls.length === 0 && source === 'all') || source === 'api') {
      try {
        const apiFilters = { 
          search: search || '', 
          limit: parseInt(limit),
          monthsBack: 3
        };
        
        if (category && category !== 'all') apiFilters.category = category;
        if (agency && agency !== 'all') apiFilters.agency = agency;
        
        const apiRecalls = await recallApiService.fetchAllRecalls(apiFilters);
        recalls = apiRecalls.map(recall => this.normalizeRecallData(recall));
      } catch (apiError) {
        console.error('API fetch in API endpoint:', apiError.message);
      }
    }

    recalls = recalls.map(recall => this.normalizeRecallData(recall));

    res.json({
      success: true,
      data: recalls,
      total: recalls.length,
      sources: {
        database: recalls.filter(r => r._id).length,
        api: recalls.filter(r => !r._id).length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API recall error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recalls',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.syncRecalls = async (req, res) => {
  try {
    // Manual recall sync requested
    
    const apiRecalls = await recallApiService.fetchAllRecalls({
      limit: 100,
      monthsBack: 6
    });

    const savedCount = await this.saveApiResultsToDB(apiRecalls);
    
    res.json({
      success: true,
      message: `Successfully synced ${savedCount} recalls to database`,
      totalFetched: apiRecalls.length,
      totalSaved: savedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Recall sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync recalls',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * normalizeRecallData(recall)
 *
 * Take a raw recall object (from DB or external API) and produce a
 * normalized plain object with consistent fields used by the UI and DB.
 * Normalization includes:
 *  - parsing/normalizing dates into a JS Date
 *  - cleaning product and brand text
 *  - constructing a readable title (`Product — Brand`)
 *  - inferring a category (with sensible fallbacks)
 *  - generating a safe `articleLink` (prefer explicit link, otherwise an FDA search URL)
 *  - normalizing retailer, distribution and other fields
 */
// === Normalization Utilities ===
// Convert raw recall payloads (from DB or external APIs) into a consistent
// in-memory object shape consumed by templates and persisted to MongoDB.
exports.normalizeRecallData = (recall) => {
  if (!recall) return null;

  let recallDate;
  try {
    let rawDate = recall.recallDate || recall.releaseDate || recall.date || recall.recall_initiation_date || recall.report_date || null;

    if (rawDate && typeof rawDate === 'number') rawDate = String(rawDate);

    if (rawDate && typeof rawDate === 'string' && /^\d{8}$/.test(rawDate)) {
      const y = rawDate.slice(0,4);
      const m = rawDate.slice(4,6);
      const d = rawDate.slice(6,8);
      recallDate = new Date(`${y}-${m}-${d}`);
    } else if (rawDate) {
      recallDate = new Date(rawDate);
    } else {
      recallDate = null;
    }

    if (!recallDate || isNaN(recallDate.getTime())) {
      const alt = (recall && recall.rawData) ? (recall.rawData.recall_initiation_date || recall.rawData.report_date) : null;
      if (alt && /^\d{8}$/.test(String(alt))) {
        const s = String(alt);
        recallDate = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`);
      }
    }

    if (!recallDate || isNaN(recallDate.getTime())) {
      recallDate = new Date(); // final fallback to current date
    }
  } catch (error) {
    recallDate = new Date(); // Fallback to current date
  }

  let articleLink = recall.articleLink || recall.url;
  if (!articleLink || articleLink === '#') {
    const agency = recall.agency || 'FDA';
    const brandSlug = (recall.brand || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const productSlug = (recall.product || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const reasonSlug = (recall.reason || 'safety-concerns').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    if (agency === 'FSIS') {
      articleLink = `https://www.fsis.usda.gov/recalls-alerts/${brandSlug}-recalls-${productSlug}-due-${reasonSlug}`;
    } else {
      const recallNum = recall.recall_number || recall.recallId || (recall.rawData && (recall.rawData.recall_number || recall.rawData.recallNumber));
      const searchQ = (recallNum && String(recallNum).trim()) ? String(recallNum).trim() : `${(recall.brand || '')} ${(recall.product || recall.title || '')}`;
      const fdaSearch = `https://www.fda.gov/search?search_api_fulltext=${encodeURIComponent(searchQ)}&site=Food`;
      articleLink = fdaSearch;
    }
  }

  const possibleRetailer = recall.retailer || recall.recalling_firm || recall.retailerName || '';
  let retailerSlug = (possibleRetailer || 'various-retailers').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!retailerSlug) retailerSlug = 'various-retailers';
  const allowedRetailers = ['trader-joes','whole-foods','kroger','walmart','costco','target','safeway','albertsons','various-retailers'];
  if (!allowedRetailers.includes(retailerSlug)) retailerSlug = 'various-retailers';

  // Prefer explicit API fields when present (some feeds include
  // `product_description` and `brand_names`/`brand_name`). For lookup
  // results we want to display `product_description - brand` instead of
  // trying to parse the announcement title.
  let rawProduct = (recall.product || recall.product_description || recall.title || '').toString();
  let rawBrand = (recall.brand || recall.recalling_firm || recall.Firm || '').toString();

  // Check common API/rawData shapes for brand_names (array) + product_description
  let apiProductDesc = null;
  let apiBrandName = null;
  if (Array.isArray(recall.brand_names) && recall.product_description) {
    apiProductDesc = String(recall.product_description);
    apiBrandName = String(recall.brand_names[0] || '').trim();
  } else if (recall.brand_name && recall.product_description) {
    apiProductDesc = String(recall.product_description);
    apiBrandName = String(recall.brand_name).trim();
  } else if (recall.rawData) {
    const rd = recall.rawData;
    if (Array.isArray(rd.brand_names) && rd.product_description) {
      apiProductDesc = String(rd.product_description);
      apiBrandName = String(rd.brand_names[0] || '').trim();
    } else if (rd.brand_name && rd.product_description) {
      apiProductDesc = String(rd.product_description);
      apiBrandName = String(rd.brand_name).trim();
    }
  }

  if (apiProductDesc) {
    rawProduct = apiProductDesc;
    if (apiBrandName && apiBrandName.length > 0) rawBrand = apiBrandName;
  }

  let cleanedProduct = cleanProductTitle(rawProduct);
  let cleanedBrand = cleanBrandName(rawBrand);

  // If the cleaned product looks like garbage (e.g. just sizes like "6/" or
  // small numeric tokens), try fallbacks from API-specific fields
  const junkProductPattern = /^\s*$|^[\d\-\/\s,:]+$/;
  if (!cleanedProduct || cleanedProduct === 'Unknown Product' || cleanedProduct.length < 3 || junkProductPattern.test(cleanedProduct)) {
    const fallbackCandidates = [];
    if (recall.product_description) fallbackCandidates.push(String(recall.product_description));
    if (recall.rawData && recall.rawData.product_description) fallbackCandidates.push(String(recall.rawData.product_description));
    if (recall.Product) fallbackCandidates.push(String(recall.Product));
    if (recall.field_title) fallbackCandidates.push(String(recall.field_title));
    if (recall.title) fallbackCandidates.push(String(recall.title));

    for (const cand of fallbackCandidates) {
      if (cand && String(cand).trim().length > 3 && !junkProductPattern.test(cand)) {
        cleanedProduct = cleanProductTitle(cand);
        break;
      }
    }
  }
  
  const productLower = cleanedProduct.toLowerCase();
  const brandLower = cleanedBrand.toLowerCase();
  
  // Keep product description and brand as cleaned by their helpers.
  // Do not attempt to extract or strip brand names from the product text —
  // we want the display title to be `Product Description - Brand`.
  
  const titleParts = [];
  if (cleanedProduct && cleanedProduct !== 'Unknown Product') titleParts.push(cleanedProduct);
  if (cleanedBrand && cleanedBrand !== 'Unknown Brand' && cleanedBrand !== cleanedProduct) titleParts.push(cleanedBrand);
  // Use a simple hyphen separator and preserve the cleaned text casing.
  let finalTitle = titleParts.length > 0 ? titleParts.join(' - ') : (recall.title || 'Product Recall');

  // Generate simple tags for searches and filtering. Include inferred
  // category and detected food keywords and notable pathogens.
  const tagSet = new Set();
  if (recall && recall.category) tagSet.add(String(recall.category).toLowerCase());
  const combinedForTags = `${cleanedProduct} ${finalTitle} ${(recall.description || '')}`.toLowerCase();
  const keywordTags = [
    'egg','eggs','milk','cheese','yogurt','butter',
    'chicken','turkey','beef','pork','fish','shrimp','shellfish',
    'spinach','lettuce','broccoli','tomato','onion','apple','banana','mango','grape',
    'peanut','almond','cashew','walnut','pistachio','hazelnut',
    'bread','flour','pasta','noodle','rice','cereal',
    'cookie','candy','chocolate','snack','popcorn',
    'baby','infant'
  ];
  for (const kw of keywordTags) {
    if (combinedForTags.includes(kw)) tagSet.add(kw);
  }
  // detect common pathogens/contaminants
  const reasonText = (recall.reason || recall.reason_for_recall || '').toString().toLowerCase();
  const pathogenTags = ['salmonella','listeria','e coli','e.coli','norovirus','metal','glass','allergen','undeclared'];
  for (const p of pathogenTags) {
    if (reasonText.includes(p) || combinedForTags.includes(p)) tagSet.add(p.replace(/\./g,'').replace(/\s+/g,'-'));
  }

  const tagsArray = Array.from(tagSet);

  return {
    _id: recall._id,
    recallId: recall.recallId || recall.recall_number || `RECALL-${Date.now()}`,
    
    title: finalTitle,
    description: recall.description || recall.reason_for_recall || 'No description available',
    product: cleanedProduct,
    brand: cleanedBrand,
    reason: recall.reason || recall.reason_for_recall || 'Not specified',
    
    category: (() => {
      // Align allowed categories with the Mongoose schema in models/Recall.js
      const allowed = [
        'poultry',
        'vegetables',
        'shellfish',
        'meat',
        'dairy',
        'fruits',
        'eggs',
        'grains',
        'processed-foods',
        'beverages',
        'snacks',
        'breakfast',
        'baby-food',
        'other'
      ];

      if (isNonFoodItem(cleanedProduct, finalTitle)) {
        return 'other';
      }

      const combined = `${cleanedProduct} ${finalTitle}`.toLowerCase();

      let inferred = null;

      if (/\bnoodle\b|\bpasta\b/i.test(combined)) inferred = 'grains';

      if (!inferred && /\bburrito\b|\bbreakfast\ssandwich\b|\bbreakfast\swrap\b|\bsandwich\b|\bwrap\b/i.test(combined)) inferred = 'grains';

      if (!inferred && /\bpopcorn\b|\bsnack\b/i.test(combined)) inferred = 'snacks';

      if (!inferred && /\b(chicken\s+)?eggs?\b|shell\s+eggs?\b|egg\s+product/i.test(combined) && !/burrito|noodle|pasta|sandwich|wrap/i.test(combined)) inferred = 'eggs';

      if (!inferred) {
        if (/\bmilk\b|\bcheese\b|\byogurt\b|\bdairy\b/i.test(combined)) inferred = 'dairy';
        else if (/\bchicken\b|\bturkey\b|\bpoultry\b/i.test(combined)) inferred = 'poultry';
        else if (/\bbeef\b|\bsteak\b/i.test(combined)) inferred = 'meat';
        else if (/\bpork\b|\bbacon\b|\bsausage\b/i.test(combined)) inferred = 'meat';
        else if (/\bfish\b|\bshrimp\b|\bseafood\b|\bsalmon\b/i.test(combined)) inferred = 'shellfish';
        else if (/\bfruit\b|\bapple\b|\borange\b|\bberry\b|\bmelon\b|\bcantaloupe\b|\bhoneydew\b|\bwatermelon\b/i.test(combined)) inferred = 'fruits';
        else if (/\bvegetable\b|\blettuce\b|\bspinach\b|\bsalad\b|\bonion\b|\bgreen\s+onion\b|\bscallion\b|\bspring\s+onion\b/i.test(combined)) inferred = 'vegetables';
        else if (/\bbread\b|\bgrain\b/i.test(combined)) inferred = 'grains';
        else if (/\b(nut|peanut|almond)\b/i.test(combined)) inferred = 'nuts';
        else if (/\bbaby\b|\binfant\b/i.test(combined)) inferred = 'baby-food';
      }

      const existing = (recall.category || '').toString().toLowerCase();
      if (existing && allowed.includes(existing)) return existing;

      if (inferred && allowed.includes(inferred)) return inferred;

      return 'other';
    })(),
    tags: tagsArray,
    riskLevel: recall.riskLevel || 'medium',
    retailer: retailerSlug,
    
    agency: recall.agency || 'FDA',
    status: (() => {
      const rawStatus = (recall.status || recall.Status || (recall.rawData && (recall.rawData.status || recall.rawData.recall_status)) || 'Ongoing').toString();
      const s = rawStatus.trim().toLowerCase();
      if (s === 'terminated' || s === 'completed' || s === 'closed') return 'Completed';
      if (s === 'pending') return 'Pending';
      return 'Ongoing';
    })(),
    source: recall.source || 'database',
    
    distribution: recall.distribution || recall.distribution_pattern || 'Nationwide',
    statesAffected: Array.isArray(recall.statesAffected) ? recall.statesAffected : 
                   (recall.states ? [recall.states] : ['Nationwide']),
    
    recallDate: recallDate,
    
    articleLink: articleLink,
    
    isActive: recall.isActive !== undefined ? recall.isActive : true,
    
    ...(process.env.NODE_ENV === 'development' && { _raw: recall })
  };
};

/**
 * saveApiResultsToDB(apiRecalls)
 *
 * Persist an array of normalized recalls into the local MongoDB collection.
 * For each normalized recall the function checks whether a document with the
 * same `recallId` exists; if not it creates one, otherwise it updates the
 * existing document. Returns the count of newly created documents.
 */
// === Persistence Utilities ===
// Functions that persist normalized recalls to the database and perform
// migration-like operations (re-normalization) when normalization logic
// changes.
exports.saveApiResultsToDB = async (apiRecalls) => {
  if (!apiRecalls || !Array.isArray(apiRecalls)) return 0;
  
  let savedCount = 0;
  
  for (const apiRecall of apiRecalls) {
    try {
      const normalizedRecall = this.normalizeRecallData(apiRecall);
      
      const existingRecall = await Recall.findOne({
        recallId: normalizedRecall.recallId
      });

      if (!existingRecall) {
        await Recall.create(normalizedRecall);
        savedCount++;
      } else {
        await Recall.updateOne(
          { recallId: normalizedRecall.recallId },
          { $set: normalizedRecall }
        );
      }
    } catch (error) {
      console.error('Error saving recall to DB:', error.message);
    }
  }
  
  // Saved new recalls count (log removed)
  return savedCount;
};

/**
 * reNormalizeAllRecalls()
 *
 * Migration utility used to re-run the normalization logic against all
 * existing recall documents in the database. This is useful after
 * improving normalization heuristics to persist the cleaned values.
 *
 * WARNING: This iterates all recalls and performs updates in-place.
 */
exports.reNormalizeAllRecalls = async () => {
  try {
    // Starting re-normalization of all recalls in database
    const allRecalls = await Recall.find({}).lean();
    
    let updatedCount = 0;
    
    for (const recall of allRecalls) {
      try {
        const normalized = this.normalizeRecallData(recall);
        
        await Recall.updateOne(
          { _id: recall._id },
          { $set: {
            title: normalized.title,
            product: normalized.product,
            brand: normalized.brand,
            description: normalized.description,
            reason: normalized.reason,
            category: normalized.category,
            tags: normalized.tags || []
          }}
        );
        
        updatedCount++;
        } catch (err) {
        console.error(`Failed to update recall ${recall._id}:`, err.message);
      }
    }
    
    // Re-normalization completed (summary log removed)
    return updatedCount;
  } catch (error) {
    console.error('Re-normalization error:', error);
    return 0;
  }
};

/**
 * getNews(req, res)
 *
 * Server-side proxy endpoint to fetch recent FDA recall news. It uses the
 * recall API service to query FDA and returns normalized results suitable
 * for client-side rendering in the news sidebar.
 */
exports.getNews = async (req, res) => {
  try {
    const recallApi = require('../services/recallAPI');
    const fdaRecalls = await recallApi.fetchFDARecalls({ limit: 20, monthsBack: 12 });

    const normalized = (Array.isArray(fdaRecalls) ? fdaRecalls : []).map(r => exports.normalizeRecallData(r));

    return res.json({ success: true, results: normalized });
  } catch (error) {
    console.error('Error fetching news (server proxy):', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch recall news' });
  }
};