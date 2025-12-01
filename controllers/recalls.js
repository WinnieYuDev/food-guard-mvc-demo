const Recall = require('../models/Recall');
const recallApiService = require('../services/recallAPI');
const axios = require('axios');
const https = require('https');

// Small helper to fetch JSON via native https to avoid axios timeouts in some environments
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

// Show recalls and product lookup page
exports.getRecalls = async (req, res) => {
  try {
    console.log('Query parameters:', req.query);

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

    // Prepare API filters
    const apiFilters = {
      search: search || '',
      limit: 100,
      monthsBack: 6
    };
    if (category && category !== 'all') {
      apiFilters.category = category;
    } else if (search && String(search).trim().length > 0) {
      // Try to infer a category from the search term to improve matching (e.g., "chicken" -> poultry)
      try {
        const inferred = recallApiService.determineCategory(search);
        if (inferred && inferred !== 'other') apiFilters.category = inferred;
      } catch (infErr) {
        // ignore
      }
    }
    if (retailer && retailer !== 'all') apiFilters.retailer = retailer;

    // Helper: keywords per category to support flexible matching
    const categoryKeywords = {
      poultry: ['chicken','turkey','poultry','hen'],
      beef: ['beef','steak','burger'],
      pork: ['pork','bacon','sausage','ham'],
      seafood: ['fish','salmon','tuna','shrimp','shellfish'],
      vegetables: ['spinach','lettuce','broccoli','vegetable','carrot','salad'],
      fruits: ['apple','berry','orange','fruit','melon'],
      dairy: ['milk','cheese','yogurt','dairy','ice cream'],
      eggs: ['egg','eggs'],
      nuts: ['nut','peanut','almond'],
      grains: ['bread','flour','grain'],
      snacks: ['cookie','candy','chocolate','snack','chip','cracker','bar','granola','pretzel','popcorn','jerky'],
      'baby-food': ['baby','infant']
    };

    // Try live API fetch first but don't block too long
    try {
      const apiPromise = recallApiService.fetchAllRecalls(apiFilters);
      const timeoutMs = 5000; // short wait to keep page load snappy
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));

      let apiRecalls = await Promise.race([apiPromise, timeoutPromise]);

        if (apiRecalls && Array.isArray(apiRecalls) && apiRecalls.length > 0) {
        console.log(`Live API returned ${apiRecalls.length} recalls (using live data)`);

        // Apply client-side filters
        if (riskLevel && riskLevel !== 'all') {
          apiRecalls = apiRecalls.filter(r => r.riskLevel === riskLevel);
        }

        // If a search term was provided, additionally filter the API results
        // by checking title/product/brand/description to ensure terms like
        // "chicken" match recall titles as well (some API searches can miss matches).
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

        // If category selected, ensure API results match category OR contain category keywords
        if (category && category !== 'all') {
          const kws = categoryKeywords[category] || [];
          apiRecalls = apiRecalls.filter(r => {
            const title = (r.title || '').toString().toLowerCase();
            const product = (r.product || '').toString().toLowerCase();
            const desc = (r.description || '').toString().toLowerCase();

            const matchesKeywords = kws.length > 0 && kws.some(k => title.includes(k) || product.includes(k) || desc.includes(k));
            // Only accept keyword matches when the recall's category is missing/unknown/other
            const categoryMissingOrOther = !r.category || r.category === 'other' || r.category === null;
            return (r.category === category) || (categoryMissingOrOther && matchesKeywords);
          });
        }

        // Apply sorting from UI (works on normalized fields)
        try {
          apiRecalls.sort((a, b) => {
            const A = (a[sortBy] === undefined || a[sortBy] === null) ? '' : a[sortBy];
            const B = (b[sortBy] === undefined || b[sortBy] === null) ? '' : b[sortBy];
            // If sorting by date, coerce to timestamp
            if (sortBy === 'recallDate') {
              const ta = new Date(A).getTime();
              const tb = new Date(B).getTime();
              return (ta === tb) ? 0 : ((ta < tb) ? -1 * sortOrder : 1 * sortOrder);
            }
            // For strings/numbers fallback
            if (typeof A === 'string' && typeof B === 'string') {
              return A.localeCompare(B) * sortOrder;
            }
            if (typeof A === 'number' && typeof B === 'number') {
              return (A - B) * sortOrder;
            }
            // final fallback
            return (String(A).localeCompare(String(B))) * sortOrder;
          });
        } catch (sortErr) {
          console.warn('Failed to sort API recalls:', sortErr && sortErr.message);
        }

        total = apiRecalls.length;
        const startIndex = (page - 1) * limit;
        recalls = apiRecalls.slice(startIndex, startIndex + limit);

        // Save in background (don't block rendering)
        exports.saveApiResultsToDB(apiRecalls).catch(err => console.error('Failed to save API results to DB:', err.message));
      } else {
        console.log('Live API did not return in time; falling back to DB');

        // Build DB query with flexible category matching
        const dbBase = { isActive: true };

        // Search OR conditions (if search provided)
        const searchOr = [];
        if (search) {
          searchOr.push(
            { title: { $regex: search, $options: 'i' } },
            { product: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          );
        }

        // Category matching: either exact category or keywords in title/product/description
        let categoryOr = [];
        let effectiveCategory = category && category !== 'all' ? category : null;
        if (!effectiveCategory && search && String(search).trim().length > 0) {
          try {
            const inferred = recallApiService.determineCategory(search);
            if (inferred && inferred !== 'other') effectiveCategory = inferred;
          } catch (infErr) {}
        }

        if (effectiveCategory) {
          const kws = categoryKeywords[effectiveCategory] || [];
          // Exact category match
          categoryOr.push({ category: effectiveCategory });

          // Build a fallback that only applies keyword matches when category is missing or 'other'
          const keywordOr = [];
          kws.forEach(k => {
            keywordOr.push({ title: { $regex: k, $options: 'i' } });
            keywordOr.push({ product: { $regex: k, $options: 'i' } });
            keywordOr.push({ description: { $regex: k, $options: 'i' } });
          });

          if (keywordOr.length > 0) {
            const fallbackCondition = {
              $and: [
                { $or: [ { category: { $exists: false } }, { category: null }, { category: 'other' } ] },
                { $or: keywordOr }
              ]
            };
            categoryOr.push(fallbackCondition);
          }
        }

        // Combine into final dbQuery
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

      // On API failure, fallback to DB with flexible category matching
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
      let effectiveCategory = category && category !== 'all' ? category : null;
      if (!effectiveCategory && search && String(search).trim().length > 0) {
        try {
          const inferred = recallApiService.determineCategory(search);
          if (inferred && inferred !== 'other') effectiveCategory = inferred;
        } catch (infErr) {}
      }

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
          const fallbackCondition = {
            $and: [
              { $or: [ { category: { $exists: false } }, { category: null }, { category: 'other' } ] },
              { $or: keywordOr }
            ]
          };
          categoryOr.push(fallbackCondition);
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
      // For count, use a simple count on the same query (note: $and/$or supported)
      total = await Recall.countDocuments(dbQuery);
    }

    // Ensure all recalls have required fields with proper fallbacks
    recalls = recalls.map(recall => exports.normalizeRecallData(recall));

    const totalPages = Math.ceil(total / limit);

    // Define options arrays - updated to match actual data
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
    
    // Provide basic structure for the template even on error
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

// Handle product lookup
exports.lookupProduct = async (req, res) => {
  try {
    const { barcode, productName } = req.body;
    
    console.log('Product lookup request:', { barcode, productName });

    if (!barcode && !productName) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either a barcode or product name'
      });
    }

    const searchTerm = productName || barcode || '';
    let relatedRecalls = [];

    // Try to fetch product metadata from Open Food Facts (with debug logs)
    let offProduct = null;
    try {
      if (barcode) {
        // Lookup by barcode
        const offResp = await fetchJson(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`, 8000);
        console.log('OFF barcode lookup response status:', offResp && offResp.status);
        if (offResp && offResp.status === 1 && offResp.product) {
          offProduct = offResp.product;
          console.log('OFF product found by barcode:', offProduct.code || offProduct._id || '(no code)');
        }
      } else if (productName) {
        // Search by product name (attempt to pick the best candidate)
        const params = new URLSearchParams({ search_terms: productName, search_simple: 1, action: 'process', json: 1, page_size: 8 });
        const offResp = await fetchJson(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, 8000);
        console.log('OFF search returned products:', offResp && Array.isArray(offResp.products) ? offResp.products.length : 0);

        if (offResp && Array.isArray(offResp.products) && offResp.products.length > 0) {
          // Choose the best product: prefer those with product_name, brands, and code
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
          console.log('OFF chosen product:', offProduct && (offProduct.product_name || offProduct.generic_name || offProduct.code || '(no identifier)'));
        } else {
          console.log('OFF search returned no products for term:', productName);
        }
      }
    } catch (offErr) {
      console.warn('OpenFoodFacts lookup failed:', offErr && offErr.message);
      offProduct = null;
    }

    // Search in database first
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

      // If no database results, try API search
      if (relatedRecalls.length === 0) {
        console.log('🔄 No database results, searching APIs...');
        try {
          const apiRecalls = await recallApiService.searchRecalls(searchTerm, 10);
          relatedRecalls = apiRecalls.map(recall => this.normalizeRecallData(recall));
          
          // Save API results to database for future searches
          if (relatedRecalls.length > 0) {
            try {
              await this.saveApiResultsToDB(relatedRecalls);
            } catch (saveError) {
              console.error('Failed to save search results to DB:', saveError.message);
            }
          }
        } catch (apiError) {
          console.error('❌ API search error:', apiError.message);
        }
      }
    }

    // Normalize recall data
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

    // Build product payload favoring OpenFoodFacts when available
    const productPayload = {
      name: (offProduct && (offProduct.product_name || offProduct.generic_name)) || productName || 'Product Lookup',
      barcode: (offProduct && (offProduct.code || offProduct._id)) || barcode || 'N/A',
      brand: (offProduct && (offProduct.brands || offProduct.brands_tags && offProduct.brands_tags[0])) || (relatedRecalls && relatedRecalls.length > 0 ? relatedRecalls[0].brand : 'N/A'),
      allergens: [],
      ingredients: (offProduct && (offProduct.ingredients_text || offProduct.ingredients_text_with_allergens)) || 'N/A',
      nutritionFacts: null,
      searchTerm: searchTerm
    };

    // Parse allergens
    if (offProduct) {
      if (Array.isArray(offProduct.allergens_tags) && offProduct.allergens_tags.length > 0) {
        productPayload.allergens = offProduct.allergens_tags.map(a => a.replace('en:', '').replace('en', '').replace(/^:/, '')).filter(Boolean);
      } else if (offProduct.allergens) {
        // sometimes a comma separated string
        productPayload.allergens = String(offProduct.allergens).split(',').map(s => s.trim()).filter(Boolean);
      }

      // Nutrition
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
    console.error('❌ Product lookup error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to lookup product information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single recall details
exports.getRecall = async (req, res) => {
  try {
    let recall = await Recall.findById(req.params.id).lean();
    
    // If recall not found in DB, try to fetch from API
    if (!recall) {
      console.log(`Recall ${req.params.id} not in DB, checking APIs...`);
      
      // This would need additional logic to map IDs between systems
      // For now, redirect to recalls page
      return res.redirect('/recalls');
    }

    // Normalize recall data
    recall = this.normalizeRecallData(recall);

    // Find related recalls
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
    console.error('❌ Error fetching recall details:', error);
    res.redirect('/recalls');
  }
};

// API endpoint for external consumers
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
      // Database query
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

    // If no DB results or specifically requesting API, use API
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
        console.error('❌ API fetch in API endpoint:', apiError.message);
      }
    }

    // Normalize all recall data
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
    console.error('❌ API recall error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recalls',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Sync recalls from APIs to database
exports.syncRecalls = async (req, res) => {
  try {
    console.log('🔄 Manual recall sync requested');
    
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
    console.error('❌ Recall sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync recalls',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper method to normalize recall data
exports.normalizeRecallData = (recall) => {
  if (!recall) return null;

  // Ensure recallDate is a valid Date object
  let recallDate;
  try {
    // Accept several possible date formats: Date object, ISO string, or FDA's YYYYMMDD numeric string
    let rawDate = recall.recallDate || recall.releaseDate || recall.date || recall.recall_initiation_date || recall.report_date || null;

    if (rawDate && typeof rawDate === 'number') rawDate = String(rawDate);

    // Handle YYYYMMDD strings (e.g. '20250920')
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
      // fallback: if rawData contains FDA fields, try those
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

  // Generate article link if not provided
  let articleLink = recall.articleLink || recall.url;
  if (!articleLink || articleLink === '#') {
    const agency = recall.agency || 'FDA';
    const brandSlug = (recall.brand || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const productSlug = (recall.product || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const reasonSlug = (recall.reason || 'safety-concerns').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    if (agency === 'FSIS') {
      articleLink = `https://www.fsis.usda.gov/recalls-alerts/${brandSlug}-recalls-${productSlug}-due-${reasonSlug}`;
    } else {
      articleLink = `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/${brandSlug}-recalls-${productSlug}-due-${reasonSlug}`;
    }
  }

  // Normalize retailer to a slug that matches schema options where possible
  const possibleRetailer = recall.retailer || recall.recalling_firm || recall.retailerName || '';
  let retailerSlug = (possibleRetailer || 'various-retailers').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!retailerSlug) retailerSlug = 'various-retailers';
  // whitelist known retailer slugs; fallback to 'various-retailers' if unknown
  const allowedRetailers = ['trader-joes','whole-foods','kroger','walmart','costco','target','safeway','albertsons','various-retailers'];
  if (!allowedRetailers.includes(retailerSlug)) retailerSlug = 'various-retailers';

  return {
    // Core identification
    _id: recall._id,
    recallId: recall.recallId || recall.recall_number || `RECALL-${Date.now()}`,
    
    // Product information
    // Clean up title/product to avoid duplicated long ingredient lists
    // Prefer product name and brand only
    // We'll sanitize common trailing blocks like INGREDIENTS:, CONTAINS:, UPC, DIST BY:
    title: (function() {
      const prodRaw = (recall.product || recall.product_description || recall.title || '').toString();
      const brandRaw = (recall.brand || recall.recalling_firm || recall.Firm || '').toString();
      // Remove everything from common delimiters onward
      const cleanedProd = prodRaw.replace(/\s*(INGREDIENTS:|CONTAINS:|UPC\b|DIST\s*BY:|DISTRIBUTION:|INGREDIENTS\.)[\s\S]*$/i, '').trim();
      const cleanedBrand = brandRaw.replace(/[\n\r]+/g, ' ').trim();
      const titleParts = [];
      if (cleanedProd) titleParts.push(cleanedProd);
      if (cleanedBrand) titleParts.push(cleanedBrand);
      return titleParts.length > 0 ? titleParts.join(' — ') : (recall.title || 'Product Recall');
    })(),

    description: recall.description || recall.reason_for_recall || 'No description available',
    product: (function() {
      const prodRaw = (recall.product || recall.product_description || '').toString();
      return prodRaw.replace(/\s*(INGREDIENTS:|CONTAINS:|UPC\b|DIST\s*BY:|DISTRIBUTION:|INGREDIENTS\.)[\s\S]*$/i, '').trim() || 'Unknown Product';
    })(),
    brand: (recall.brand || recall.recalling_firm || recall.Firm || 'Unknown Brand'),
    reason: recall.reason || recall.reason_for_recall || 'Not specified',
    
    // Categorization
    category: recall.category || 'other',
    riskLevel: recall.riskLevel || 'medium',
    retailer: retailerSlug,
    
    // Agency and status
    agency: recall.agency || 'FDA',
    status: recall.status || 'Ongoing',
    source: recall.source || 'database',
    
    // Distribution
    distribution: recall.distribution || recall.distribution_pattern || 'Nationwide',
    statesAffected: Array.isArray(recall.statesAffected) ? recall.statesAffected : 
                   (recall.states ? [recall.states] : ['Nationwide']),
    
    // Dates
    recallDate: recallDate,
    
    // External link
    articleLink: articleLink,
    
    // System fields
    isActive: recall.isActive !== undefined ? recall.isActive : true,
    
    // Raw data for debugging
    ...(process.env.NODE_ENV === 'development' && { _raw: recall })
  };
};

// Helper method to save API results to database
exports.saveApiResultsToDB = async (apiRecalls) => {
  if (!apiRecalls || !Array.isArray(apiRecalls)) return 0;
  
  let savedCount = 0;
  
  for (const apiRecall of apiRecalls) {
    try {
      const normalizedRecall = this.normalizeRecallData(apiRecall);
      
      // Check if recall already exists
      const existingRecall = await Recall.findOne({
        recallId: normalizedRecall.recallId
      });

      if (!existingRecall) {
        await Recall.create(normalizedRecall);
        savedCount++;
      } else {
        // Update existing recall
        await Recall.updateOne(
          { recallId: normalizedRecall.recallId },
          { $set: normalizedRecall }
        );
      }
    } catch (error) {
      console.error('❌ Error saving recall to DB:', error.message);
      // Continue with next recall
    }
  }
  
  console.log(`💾 Saved ${savedCount} new recalls to database`);
  return savedCount;
};

// Server-side endpoint to fetch recent FDA recall news (proxy to avoid client CORS)
exports.getNews = async (req, res) => {
  try {
    // Use the recall API service to fetch FDA recalls (limit 20, last 12 months)
    const recallApi = require('../services/recallAPI');
    const fdaRecalls = await recallApi.fetchFDARecalls({ limit: 20, monthsBack: 12 });

    // Normalize each recall so the client has consistent fields (articleLink, title, reason, recallDate)
    const normalized = (Array.isArray(fdaRecalls) ? fdaRecalls : []).map(r => exports.normalizeRecallData(r));

    return res.json({ success: true, results: normalized });
  } catch (error) {
    console.error('❌ Error fetching news (server proxy):', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch recall news' });
  }
};