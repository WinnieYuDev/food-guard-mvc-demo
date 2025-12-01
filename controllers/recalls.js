const Recall = require('../models/Recall');

exports.getRecalls = async (req, res) => {
  try {
    const {
      search,
      category,
      retailer,
      riskLevel,
      page = 1,
      sortBy = 'recallDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter query
    const filter = { isActive: true };
    
    // Text search
    if (search) {
      filter.$text = { $search: search };
    }
    
    // Category filter
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    // Retailer filter
    if (retailer && retailer !== 'all') {
      filter.retailer = retailer;
    }
    
    // Risk level filter
    if (riskLevel && riskLevel !== 'all') {
      filter.riskLevel = riskLevel;
    }

    // Pagination
    const limit = 12;
    const skip = (parseInt(page) - 1) * limit;
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get recalls with filters
    const recalls = await Recall.find(filter)
      .sort(sortOptions)
      .limit(limit)
      .skip(skip)
      .lean();

    // Count total for pagination
    const total = await Recall.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    // Get filter counts for UI
    const categoryCounts = await Recall.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const retailerCounts = await Recall.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$retailer', count: { $sum: 1 } } }
    ]);

    const riskCounts = await Recall.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
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
        sortBy,
        sortOrder
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
        riskLevels: riskCounts
      },
      categoryOptions: [
        { value: 'poultry', label: 'Poultry', count: categoryCounts.find(c => c._id === 'poultry')?.count || 0 },
        { value: 'vegetables', label: 'Vegetables', count: categoryCounts.find(c => c._id === 'vegetables')?.count || 0 },
        { value: 'shellfish', label: 'Shellfish', count: categoryCounts.find(c => c._id === 'shellfish')?.count || 0 },
        { value: 'meat', label: 'Meat', count: categoryCounts.find(c => c._id === 'meat')?.count || 0 },
        { value: 'dairy', label: 'Dairy', count: categoryCounts.find(c => c._id === 'dairy')?.count || 0 },
        { value: 'fruits', label: 'Fruits', count: categoryCounts.find(c => c._id === 'fruits')?.count || 0 }
      ],
      retailerOptions: [
        { value: 'trader-joes', label: 'Trader Joe\'s', count: retailerCounts.find(r => r._id === 'trader-joes')?.count || 0 },
        { value: 'whole-foods', label: 'Whole Foods', count: retailerCounts.find(r => r._id === 'whole-foods')?.count || 0 },
        { value: 'kroger', label: 'Kroger', count: retailerCounts.find(r => r._id === 'kroger')?.count || 0 },
        { value: 'walmart', label: 'Walmart', count: retailerCounts.find(r => r._id === 'walmart')?.count || 0 },
        { value: 'costco', label: 'Costco', count: retailerCounts.find(r => r._id === 'costco')?.count || 0 }
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

// API endpoint for JSON responses
exports.apiGetRecalls = async (req, res) => {
  try {
    const { search, category, retailer, riskLevel, limit = 50 } = req.query;
    
    const filter = { isActive: true };
    
    if (search) filter.$text = { $search: search };
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
      total: recalls.length
    });
  } catch (error) {
    console.error('API recall error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recalls'
    });
  }
};