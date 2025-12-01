const Recall = require('../models/Recall');
const recallApiService = require('../services/recallAPI');

exports.getRecalls = async (req, res) => {
  try {
    const {
      search,
      category,
      retailer,
      riskLevel,
      source,
      page = 1,
      sortBy = 'recallDate',
      sortOrder = 'desc',
      useLiveData = false
    } = req.query;

    let recalls = [];
    let total = 0;

    if (useLiveData === 'true') {
      // Fetch live data from APIs
      console.log('🔍 Fetching live recall data from APIs...');
      const apiFilters = { search, limit: 50 };
      recalls = await recallApiService.fetchAllRecalls(apiFilters);
      total = recalls.length;
      
      // Apply additional filters to API data
      recalls = recalls.filter(recall => {
        if (category && category !== 'all' && recall.category !== category) return false;
        if (retailer && retailer !== 'all' && recall.retailer !== retailer) return false;
        if (riskLevel && riskLevel !== 'all' && recall.riskLevel !== riskLevel) return false;
        if (source && source !== 'all' && recall.source !== source) return false;
        return true;
      });

    } else {
      // Use database data (existing functionality)
      const filter = { isActive: true };
      
      if (search) filter.$text = { $search: search };
      if (category && category !== 'all') filter.category = category;
      if (retailer && retailer !== 'all') filter.retailer = retailer;
      if (riskLevel && riskLevel !== 'all') filter.riskLevel = riskLevel;
      if (source && source !== 'all') filter.source = source;

      const limit = 12;
      const skip = (parseInt(page) - 1) * limit;
      
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      recalls = await Recall.find(filter)
        .sort(sortOptions)
        .limit(limit)
        .skip(skip)
        .lean();

      total = await Recall.countDocuments(filter);
    }

    const totalPages = Math.ceil(total / 12);

    // Get filter counts
    const categoryCounts = await Recall.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const retailerCounts = await Recall.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$retailer', count: { $sum: 1 } } }
    ]);

    const sourceCounts = await Recall.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    res.render('recalls/index', {
      title: 'Food Recalls - FoodGuard',
      recalls,
      user: req.user,
      filters: {
        search: search || '',
        category: category || 'all',
        retailer: retailer || 'all',
        riskLevel: riskLevel || 'all',
        source: source || 'all',
        sortBy,
        sortOrder,
        useLiveData: useLiveData === 'true'
      },
      pagination: {
        page: parseInt(page),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      counts: {
        categories: categoryCounts,
        retailers: retailerCounts,
        sources: sourceCounts
      },
      categoryOptions: [
        { value: 'poultry', label: 'Poultry' },
        { value: 'vegetables', label: 'Vegetables' },
        { value: 'shellfish', label: 'Shellfish' },
        { value: 'meat', label: 'Meat' },
        { value: 'dairy', label: 'Dairy' },
        { value: 'fruits', label: 'Fruits' },
        { value: 'eggs', label: 'Eggs' }
      ],
      retailerOptions: [
        { value: 'trader-joes', label: 'Trader Joe\'s' },
        { value: 'whole-foods', label: 'Whole Foods' },
        { value: 'kroger', label: 'Kroger' },
        { value: 'walmart', label: 'Walmart' },
        { value: 'costco', label: 'Costco' }
      ],
      sourceOptions: [
        { value: 'FDA', label: 'FDA' },
        { value: 'USDA-FSIS', label: 'USDA FSIS' }
      ]
    });
  } catch (error) {
    console.error('Error fetching recalls:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load food recalls'
    });
  }
};

// New method to sync API data to database
exports.syncRecalls = async (req, res) => {
  try {
    console.log('🔄 Syncing recall data from APIs...');
    
    const apiRecalls = await recallApiService.fetchAllRecalls();
    
    let syncedCount = 0;
    let newCount = 0;

    for (const apiRecall of apiRecalls) {
      // Check if recall already exists
      const existingRecall = await Recall.findOne({ 
        recallId: apiRecall.recallId 
      });

      if (existingRecall) {
        // Update existing recall
        await Recall.findByIdAndUpdate(existingRecall._id, apiRecall);
        syncedCount++;
      } else {
        // Create new recall
        await Recall.create(apiRecall);
        newCount++;
      }
    }

    req.flash('success', `Sync completed: ${newCount} new recalls, ${syncedCount} updated`);
    res.redirect('/recalls');
    
  } catch (error) {
    console.error('Sync error:', error);
    req.flash('error', 'Failed to sync recall data');
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
      source,
      limit = 50,
      useLiveData = false 
    } = req.query;

    let recalls;

    if (useLiveData === 'true') {
      recalls = await recallApiService.fetchAllRecalls({ 
        search, 
        limit: parseInt(limit) 
      });
    } else {
      const filter = { isActive: true };
      
      if (search) filter.$text = { $search: search };
      if (category && category !== 'all') filter.category = category;
      if (retailer && retailer !== 'all') filter.retailer = retailer;
      if (riskLevel && riskLevel !== 'all') filter.riskLevel = riskLevel;
      if (source && source !== 'all') filter.source = source;

      recalls = await Recall.find(filter)
        .sort({ recallDate: -1 })
        .limit(parseInt(limit))
        .lean();
    }

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
      error: 'Failed to fetch recalls',
      message: error.message
    });
  }
};

// Get single recall detail
exports.getRecall = async (req, res) => {
  try {
    const recall = await Recall.findById(req.params.id).lean();
    
    if (!recall) {
      req.flash('error', 'Recall not found');
      return res.redirect('/recalls');
    }

    // Get related recalls
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

    res.render('recalls/show', {
      title: `${recall.title} - FoodGuard`,
      recall,
      relatedRecalls,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching recall:', error);
    req.flash('error', 'Failed to load recall details');
    res.redirect('/recalls');
  }
};