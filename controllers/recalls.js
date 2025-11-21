const Recall = require('../models/Recall');

// Show recalls and product lookup page
exports.getRecalls = async (req, res) => {
  try {
    // Get page number from URL or use page 1
    const page = parseInt(req.query.page) || 1;
    // How many recalls to show per page
    const limit = 12;
    // Filter by risk level if provided
    const riskLevel = req.query.risk;
    // Search term if provided
    const search = req.query.search;
    
    // Build our database query - only show active recalls
    const query = { status: 'Active' };
    
    // Add risk level filter if user selected one
    if (riskLevel && riskLevel !== 'all') {
      query.riskLevel = riskLevel;
    }
    
    // Add search filter if user searched for something
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } }, // Search in title (case insensitive)
        { description: { $regex: search, $options: 'i' } }, // Search in description
        { 'products.name': { $regex: search, $options: 'i' } }, // Search in product names
        { 'products.brand': { $regex: search, $options: 'i' } } // Search in brands
      ];
    }

    // Get recalls from database with our filters
    const recalls = await Recall.find(query)
      .sort({ date: -1 }) // Newest first
      .limit(limit) // Only get limited number
      .skip((page - 1) * limit); // Skip recalls from previous pages

    // Count total recalls for pagination
    const total = await Recall.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Render the recalls page with our data
    res.render('recalls', {
      title: 'Recalls & Product Lookup - FoodGuard',
      recalls,
      pagination: {
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        riskLevel,
        search
      }
    });
  } catch (error) {
    console.error('Recalls controller error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load recalls'
    });
  }
};

// Handle product lookup (API endpoint)
exports.lookupProduct = async (req, res) => {
  try {
    const { barcode, productName } = req.body;
    
    // Mock product data - in real app, this would query OpenFoodFacts API
    const mockProduct = {
      name: productName || 'Sample Product',
      barcode: barcode || '1234567890123',
      brand: 'Sample Brand',
      allergens: ['Milk', 'Soy', 'Wheat'],
      ingredients: 'Wheat Flour, Sugar, Palm Oil, Milk Solids, Soy Lecithin',
      nutritionFacts: {
        calories: 150,
        protein: 3,
        carbs: 25,
        fat: 5
      },
      image: '/imgs/placeholder-product.jpg'
    };

    // Check if this product has any recalls
    const relatedRecalls = await Recall.find({
      'products.name': { $regex: productName || 'sample', $options: 'i' },
      status: 'Active'
    });

    // Send JSON response with product info and recalls
    res.json({
      product: mockProduct,
      relatedRecalls,
      hasRecalls: relatedRecalls.length > 0
    });
  } catch (error) {
    console.error('Product lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup product' });
  }
};