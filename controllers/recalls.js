const Recall = require('../models/Recall');
const recallApiService = require('../services/recallAPI');

// Show recalls and product lookup page
exports.getRecalls = async (req, res) => {
  try {
    console.log('🔍 Query parameters:', req.query);
    
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const riskLevel = req.query.riskLevel;
    const search = req.query.search;
    const category = req.query.category;
    const agency = req.query.agency; // Changed from retailer to agency
    
    let recalls = [];
    let total = 0;

    // Build database query
    const dbQuery = { isActive: true };
    
    if (riskLevel && riskLevel !== 'all') dbQuery.riskLevel = riskLevel;
    if (category && category !== 'all') dbQuery.category = category;
    if (agency && agency !== 'all') dbQuery.agency = agency; // Filter by agency instead of retailer
    
    if (search && search.trim() !== '') {
      dbQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('📋 Database query:', dbQuery);

    // Try database first
    try {
      recalls = await Recall.find(dbQuery)
        .sort({ recallDate: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      total = await Recall.countDocuments(dbQuery);
      console.log(`📊 Database results: ${recalls.length} recalls out of ${total} total`);
    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
    }

    // If no results in database or specifically requesting live data, use API
    if (recalls.length === 0 || req.query.live === 'true') {
      console.log('🔄 Fetching from live APIs...');
      
      try {
        const apiFilters = { 
          search: search || '', 
          limit: 50,
          monthsBack: 6 // Get recalls from last 6 months
        };
        
        // Add specific filters for API calls
        if (category && category !== 'all') apiFilters.category = category;
        if (agency && agency !== 'all') apiFilters.agency = agency;
        
        // Use the recallApiService directly with timeout
        const apiPromise = recallApiService.fetchAllRecalls(apiFilters);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API timeout')), 15000)
        );
        
        let apiRecalls = await Promise.race([apiPromise, timeoutPromise]);
        
        console.log(`🌐 API returned ${apiRecalls ? apiRecalls.length : 0} recalls`);
        
        if (apiRecalls && apiRecalls.length > 0) {
          // Apply additional filters to API data if needed
          if (riskLevel && riskLevel !== 'all') {
            apiRecalls = apiRecalls.filter(recall => recall.riskLevel === riskLevel);
          }

          // Paginate API results
          const startIndex = (page - 1) * limit;
          recalls = apiRecalls.slice(startIndex, startIndex + limit);
          total = apiRecalls.length;
          
          console.log(`📊 Filtered API results: ${recalls.length} recalls`);
          
          // Optional: Save API results to database for caching
          try {
            await this.saveApiResultsToDB(apiRecalls);
          } catch (saveError) {
            console.error('⚠️ Failed to save API results to DB:', saveError.message);
          }
        }
      } catch (apiError) {
        console.error('❌ API fetch error:', apiError.message);
        // Continue with database results or empty array
      }
    }

    // Ensure all recalls have required fields with proper fallbacks
    recalls = recalls.map(recall => {
      return this.normalizeRecallData(recall);
    });

    const totalPages = Math.ceil(total / limit);

    // Define options arrays - updated to match actual data
    const categoryOptions = [
      { value: 'poultry', label: '🐔 Poultry' },
      { value: 'beef', label: '🥩 Beef' },
      { value: 'pork', label: '🐖 Pork' },
      { value: 'seafood', label: '🦐 Seafood' },
      { value: 'vegetables', label: '🥦 Vegetables' },
      { value: 'fruits', label: '🍎 Fruits' },
      { value: 'dairy', label: '🥛 Dairy' },
      { value: 'eggs', label: '🥚 Eggs' },
      { value: 'nuts', label: '🥜 Nuts' },
      { value: 'grains', label: '🌾 Grains' },
      { value: 'snacks', label: '🍪 Snacks' },
      { value: 'baby-food', label: '👶 Baby Food' },
      { value: 'other', label: '📦 Other' }
    ];

    const agencyOptions = [
      { value: 'FDA', label: '🏛️ FDA' },
      { value: 'FSIS', label: '🏛️ USDA FSIS' },
      { value: 'all', label: '🏛️ All Agencies' }
    ];

    const riskLevelOptions = [
      { value: 'high', label: '🔴 High Risk' },
      { value: 'medium', label: '🟡 Medium Risk' },
      { value: 'low', label: '🟢 Low Risk' },
      { value: 'all', label: '📊 All Risk Levels' }
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
        agency: agency || 'all' // Changed from retailer to agency
      },
      categoryOptions,
      agencyOptions,
      riskLevelOptions,
      showLiveData: req.query.live === 'true'
    });
  } catch (error) {
    console.error('❌ Recalls controller error:', error);
    
    // Provide basic structure for the template even on error
    const categoryOptions = [
      { value: 'poultry', label: '🐔 Poultry' },
      { value: 'vegetables', label: '🥦 Vegetables' }
    ];

    const agencyOptions = [
      { value: 'FDA', label: '🏛️ FDA' },
      { value: 'FSIS', label: '🏛️ USDA FSIS' }
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
        agency: 'all'
      },
      categoryOptions,
      agencyOptions,
      riskLevelOptions: [
        { value: 'high', label: '🔴 High Risk' },
        { value: 'medium', label: '🟡 Medium Risk' },
        { value: 'low', label: '🟢 Low Risk' }
      ]
    });
  }
};

// Handle product lookup
exports.lookupProduct = async (req, res) => {
  try {
    const { barcode, productName } = req.body;
    
    console.log('🔍 Product lookup request:', { barcode, productName });

    if (!barcode && !productName) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either a barcode or product name'
      });
    }

    const searchTerm = productName || barcode || '';
    let relatedRecalls = [];

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
              console.error('⚠️ Failed to save search results to DB:', saveError.message);
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
      message: '⚠️ This product has active recalls. Do not consume.',
      riskLevel: relatedRecalls[0].riskLevel,
      totalRecalls: relatedRecalls.length,
      severity: 'high',
      recommendedAction: 'Return product to place of purchase or dispose of properly.'
    } : {
      status: 'NO_RECALLS_FOUND',
      message: '✅ No active recalls found for this product.',
      riskLevel: 'low',
      totalRecalls: 0,
      severity: 'none',
      recommendedAction: 'Continue normal use while monitoring for updates.'
    };

    res.json({
      success: true,
      product: {
        name: productName || 'Product Lookup',
        barcode: barcode || 'N/A',
        searchTerm: searchTerm
      },
      relatedRecalls,
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
      console.log(`🔍 Recall ${req.params.id} not in DB, checking APIs...`);
      
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
    recallDate = new Date(recall.recallDate || recall.releaseDate || recall.date);
    if (isNaN(recallDate.getTime())) {
      recallDate = new Date(); // Fallback to current date
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

  return {
    // Core identification
    _id: recall._id,
    recallId: recall.recallId || recall.recall_number || `RECALL-${Date.now()}`,
    
    // Product information
    title: recall.title || recall.product_description || 'Product Recall',
    description: recall.description || recall.reason_for_recall || 'No description available',
    product: recall.product || recall.product_description || 'Unknown Product',
    brand: recall.brand || recall.recalling_firm || recall.Firm || 'Unknown Brand',
    reason: recall.reason || recall.reason_for_recall || 'Not specified',
    
    // Categorization
    category: recall.category || 'other',
    riskLevel: recall.riskLevel || 'medium',
    
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