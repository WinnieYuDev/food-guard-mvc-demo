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
    const retailer = req.query.retailer;
    
    let recalls = [];
    let total = 0;

    // Build database query
    const dbQuery = { isActive: true };
    
    if (riskLevel && riskLevel !== 'all') dbQuery.riskLevel = riskLevel;
    if (category && category !== 'all') dbQuery.category = category;
    if (retailer && retailer !== 'all') dbQuery.retailer = retailer;
    
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

    // If no results in database, use live API data
    if (recalls.length === 0) {
      console.log('🔄 No database results, fetching from live APIs...');
      
      try {
        const apiFilters = { 
          search: search || '', 
          limit: 50 
        };
        
        // Add overall timeout for API calls
        const apiPromise = recallApiService.fetchAllRecalls(apiFilters);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API timeout')), 15000)
        );
        
        let apiRecalls = await Promise.race([apiPromise, timeoutPromise]);
        
        console.log(`🌐 API returned ${apiRecalls ? apiRecalls.length : 0} recalls`);
        
        if (apiRecalls && apiRecalls.length > 0) {
          // Apply filters to API data
          if (category && category !== 'all') {
            apiRecalls = apiRecalls.filter(recall => recall.category === category);
          }
          if (retailer && retailer !== 'all') {
            apiRecalls = apiRecalls.filter(recall => recall.retailer === retailer);
          }
          if (riskLevel && riskLevel !== 'all') {
            apiRecalls = apiRecalls.filter(recall => recall.riskLevel === riskLevel);
          }

          recalls = apiRecalls.slice(0, limit);
          total = apiRecalls.length;
          
          console.log(`📊 Filtered API results: ${recalls.length} recalls`);
        }
      } catch (apiError) {
        console.error('❌ API fetch error:', apiError.message);
        // Continue with empty recalls rather than hanging
      }
    }

    // Ensure all recalls have required fields with proper fallbacks
    recalls = recalls.map(recall => {
      // Ensure recallDate is a valid Date object
      let recallDate;
      try {
        recallDate = new Date(recall.recallDate);
        if (isNaN(recallDate.getTime())) {
          recallDate = new Date(); // Fallback to current date
        }
      } catch (error) {
        recallDate = new Date(); // Fallback to current date
      }

      // Generate article link if not provided
      let articleLink = recall.articleLink;
      if (!articleLink || articleLink === '#') {
        const agency = recall.agency || 'FDA';
        const brandSlug = (recall.brand || 'unknown').toLowerCase().replace(/\s+/g, '-');
        const productSlug = (recall.product || 'product').toLowerCase().replace(/\s+/g, '-');
        
        if (agency === 'FSIS') {
          articleLink = `https://www.fsis.usda.gov/recalls-alerts/${brandSlug}-recalls-${productSlug}-due-${(recall.reason || 'safety-concerns').toLowerCase().replace(/\s+/g, '-')}`;
        } else {
          articleLink = `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/${brandSlug}-recalls-${productSlug}-due-${(recall.reason || 'safety-concerns').toLowerCase().replace(/\s+/g, '-')}`;
        }
      }

      return {
        // Core identification
        recallId: recall.recallId || `RECALL-${Date.now()}`,
        
        // Product information
        title: recall.title || 'Product Recall',
        description: recall.description || 'No description available',
        product: recall.product || 'Unknown Product',
        brand: recall.brand || 'Unknown Brand',
        reason: recall.reason || 'Not specified',
        
        // Categorization
        category: recall.category || 'processed-foods',
        riskLevel: recall.riskLevel || 'medium',
        retailer: recall.retailer || 'various-retailers',
        
        // Agency and status
        agency: recall.agency || 'FDA',
        status: recall.status || 'Ongoing',
        
        // Distribution
        distribution: recall.distribution || 'Nationwide',
        statesAffected: Array.isArray(recall.statesAffected) ? recall.statesAffected : ['Nationwide'],
        
        // Dates
        recallDate: recallDate,
        
        // External link
        articleLink: articleLink,
        
        // System fields
        isActive: recall.isActive !== undefined ? recall.isActive : true,
        
        // Preserve all original fields
        ...recall
      };
    });

    const totalPages = Math.ceil(total / limit);

    // Define options arrays
    const categoryOptions = [
      { value: 'poultry', label: '🐔 Poultry' },
      { value: 'vegetables', label: '🥦 Vegetables' },
      { value: 'shellfish', label: '🦐 Shellfish' },
      { value: 'meat', label: '🥩 Meat' },
      { value: 'dairy', label: '🥛 Dairy' },
      { value: 'fruits', label: '🍎 Fruits' },
      { value: 'eggs', label: '🥚 Eggs' },
      { value: 'grains', label: '🌾 Grains' }
    ];

    const retailerOptions = [
      { value: 'trader-joes', label: '🛒 Trader Joe\'s' },
      { value: 'whole-foods', label: '🛒 Whole Foods' },
      { value: 'kroger', label: '🛒 Kroger' },
      { value: 'walmart', label: '🛒 Walmart' },
      { value: 'costco', label: '🛒 Costco' },
      { value: 'target', label: '🛒 Target' },
      { value: 'safeway', label: '🛒 Safeway' },
      { value: 'albertsons', label: '🛒 Albertsons' }
    ];

    res.render('recalls', {
      title: 'Recalls & Product Lookup - FoodGuard',
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
        retailer: retailer || 'all'
      },
      categoryOptions,
      retailerOptions
    });
  } catch (error) {
    console.error('❌ Recalls controller error:', error);
    
    // Even on error, provide basic structure for the template
    const categoryOptions = [
      { value: 'poultry', label: '🐔 Poultry' },
      { value: 'vegetables', label: '🥦 Vegetables' }
    ];

    const retailerOptions = [
      { value: 'walmart', label: '🛒 Walmart' },
      { value: 'target', label: '🛒 Target' }
    ];

    res.render('recalls', {
      title: 'Recalls & Product Lookup - FoodGuard',
      recalls: [],
      user: req.user,
      pagination: { page: 1, totalPages: 1, hasNext: false, hasPrev: false },
      filters: {
        riskLevel: 'all',
        search: '',
        category: 'all',
        retailer: 'all'
      },
      categoryOptions,
      retailerOptions
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
    }

    // Ensure recalls have proper article links
    relatedRecalls = relatedRecalls.map(recall => {
      let articleLink = recall.articleLink;
      if (!articleLink || articleLink === '#') {
        const agency = recall.agency || 'FDA';
        const brandSlug = (recall.brand || 'unknown').toLowerCase().replace(/\s+/g, '-');
        const productSlug = (recall.product || 'product').toLowerCase().replace(/\s+/g, '-');
        
        if (agency === 'FSIS') {
          articleLink = `https://www.fsis.usda.gov/recalls-alerts/${brandSlug}-recalls-${productSlug}-due-${(recall.reason || 'safety-concerns').toLowerCase().replace(/\s+/g, '-')}`;
        } else {
          articleLink = `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/${brandSlug}-recalls-${productSlug}-due-${(recall.reason || 'safety-concerns').toLowerCase().replace(/\s+/g, '-')}`;
        }
      }

      return {
        ...recall,
        articleLink: articleLink
      };
    });

    const safetyInfo = relatedRecalls.length > 0 ? {
      status: 'RECALL_ACTIVE',
      message: '⚠️ This product has active recalls. Do not consume.',
      riskLevel: relatedRecalls[0].riskLevel,
      totalRecalls: relatedRecalls.length,
      severity: 'high'
    } : {
      status: 'NO_RECALLS_FOUND',
      message: '✅ No active recalls found for this product.',
      riskLevel: 'low',
      totalRecalls: 0,
      severity: 'none'
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
      error: 'Failed to lookup product information'
    });
  }
};

// Get single recall details
exports.getRecall = async (req, res) => {
  try {
    const recall = await Recall.findById(req.params.id).lean();
    
    if (!recall) {
      return res.redirect('/recalls');
    }

    // Ensure article link exists
    let articleLink = recall.articleLink;
    if (!articleLink || articleLink === '#') {
      const agency = recall.agency || 'FDA';
      const brandSlug = (recall.brand || 'unknown').toLowerCase().replace(/\s+/g, '-');
      const productSlug = (recall.product || 'product').toLowerCase().replace(/\s+/g, '-');
      
      if (agency === 'FSIS') {
        articleLink = `https://www.fsis.usda.gov/recalls-alerts/${brandSlug}-recalls-${productSlug}-due-${(recall.reason || 'safety-concerns').toLowerCase().replace(/\s+/g, '-')}`;
      } else {
        articleLink = `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/${brandSlug}-recalls-${productSlug}-due-${(recall.reason || 'safety-concerns').toLowerCase().replace(/\s+/g, '-')}`;
      }
    }

    const recallWithLink = {
      ...recall,
      articleLink: articleLink
    };

    const relatedRecalls = await Recall.find({
      _id: { $ne: recall._id },
      $or: [
        { category: recall.category },
        { retailer: recall.retailer },
        { brand: recall.brand }
      ],
      isActive: true
    })
    .limit(4)
    .lean();

    res.render('post', {
      title: `${recall.title} - FoodGuard`,
      recall: recallWithLink,
      relatedRecalls,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching recall:', error);
    res.redirect('/recalls');
  }
};

// API endpoint for external consumers
exports.apiGetRecalls = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      retailer, 
      riskLevel,
      limit = 50
    } = req.query;

    const filter = { isActive: true };
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }
    if (category && category !== 'all') filter.category = category;
    if (retailer && retailer !== 'all') filter.retailer = retailer;
    if (riskLevel && riskLevel !== 'all') filter.riskLevel = riskLevel;

    const recalls = await Recall.find(filter)
      .sort({ recallDate: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: recalls,
      total: recalls.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API recall error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recalls'
    });
  }
};