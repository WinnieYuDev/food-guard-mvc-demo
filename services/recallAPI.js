const axios = require('axios');

class RecallApiService {
  constructor() {
    this.fdaBaseUrl = 'https://api.fda.gov/food/enforcement.json';
    this.fsisBaseUrl = 'https://www.fsis.usda.gov/fsis/api/recall/v/1';
  }

  // FDA API - Food Recall Data
  async fetchFDARecalls(options = {}) {
    try {
      const { limit = 100, search = '', skip = 0 } = options;
      
      let queryParams = `limit=${limit}&skip=${skip}`;
      
      if (search) {
        queryParams += `&search=recalling_firm:${encodeURIComponent(search)}` +
                      `+OR+product_description:${encodeURIComponent(search)}` +
                      `+OR+reason_for_recall:${encodeURIComponent(search)}`;
      }

      const response = await axios.get(`${this.fdaBaseUrl}?${queryParams}`);
      
      return this.transformFDAData(response.data.results || []);
    } catch (error) {
      console.error('FDA API Error:', error.message);
      throw new Error('Failed to fetch FDA recall data');
    }
  }

  // FSIS USDA API - Meat, Poultry, Egg Recalls
  async fetchFSISRecalls(options = {}) {
    try {
      const { limit = 100, search = '' } = options;
      
      // Build query parameters for FSIS API
      const params = {
        pageSize: limit,
        pageNumber: 1
      };

      if (search) {
        params.search = search;
      }

      console.log('🔍 Fetching FSIS recalls from:', this.fsisBaseUrl);
      const response = await axios.get(this.fsisBaseUrl, { params });

      // FSIS API returns data in response.data
      const fsisData = response.data || [];
      console.log(`✅ FSIS API returned ${fsisData.length} recalls`);

      return this.transformFSISData(fsisData);
    } catch (error) {
      console.error('FSIS API Error:', error.response?.data || error.message);
      
      // Provide more detailed error information
      if (error.response) {
        console.error('FSIS API Response Status:', error.response.status);
        console.error('FSIS API Response Data:', error.response.data);
      }
      
      throw new Error('Failed to fetch FSIS recall data');
    }
  }

  // Combined recall data from both sources
  async fetchAllRecalls(filters = {}) {
    try {
      const [fdaRecalls, fsisRecalls] = await Promise.allSettled([
        this.fetchFDARecalls(filters),
        this.fetchFSISRecalls(filters)
      ]);

      const recalls = [];

      // Add FDA recalls if successful
      if (fdaRecalls.status === 'fulfilled') {
        recalls.push(...fdaRecalls.value);
        console.log(`✅ FDA: ${fdaRecalls.value.length} recalls`);
      } else {
        console.error('❌ FDA API failed:', fdaRecalls.reason);
      }

      // Add FSIS recalls if successful
      if (fsisRecalls.status === 'fulfilled') {
        recalls.push(...fsisRecalls.value);
        console.log(`✅ FSIS: ${fsisRecalls.value.length} recalls`);
      } else {
        console.error('❌ FSIS API failed:', fsisRecalls.reason);
      }

      console.log(`📊 Total recalls fetched: ${recalls.length}`);

      return recalls
        .sort((a, b) => new Date(b.recallDate) - new Date(a.recallDate))
        .slice(0, filters.limit || 100); // Limit total results
    } catch (error) {
      console.error('Error fetching combined recalls:', error);
      throw error;
    }
  }

  // Transform FDA API data to our schema
  transformFDAData(fdaData) {
    if (!fdaData || !Array.isArray(fdaData)) return [];

    return fdaData.map(item => {
      // Determine category based on product description
      const category = this.categorizeProduct(item.product_description || '');
      
      // Determine retailer from recalling firm
      const retailer = this.identifyRetailer(item.recalling_firm || '');
      
      // Determine risk level
      const riskLevel = this.assessRiskLevel(item.reason_for_recall || '');

      return {
        recallId: item.recall_number || `FDA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: item.product_description || 'Food Product Recall',
        description: item.reason_for_recall || 'No description available',
        brand: this.extractBrand(item.product_description || ''),
        product: item.product_description || 'Unknown Product',
        category: category,
        retailer: retailer,
        reason: item.reason_for_recall || 'Unknown reason',
        riskLevel: riskLevel,
        recallDate: new Date(item.recall_initiation_date || item.report_date || Date.now()),
        statesAffected: item.distribution_pattern ? 
          item.distribution_pattern.split(',').map(s => s.trim()) : ['Nationwide'],
        source: 'FDA',
        isActive: true,
        originalData: item // Keep original for reference
      };
    });
  }

  // Transform FSIS API data based on actual FSIS API structure
  transformFSISData(fsisData) {
    if (!fsisData || !Array.isArray(fsisData)) {
      console.log('⚠️ No FSIS data received or invalid format');
      return [];
    }

    return fsisData.map(item => {
      try {
        // Extract data based on FSIS API structure
        // Note: Adjust these field mappings based on actual FSIS API response
        const recallDate = item.recall_date || item.release_date || item.created_date;
        const productName = item.product_name || item.title || 'FSIS Recall';
        const company = item.company || item.establishment || item.recalling_firm || 'Unknown Company';
        const reason = item.reason || item.hazard || item.reason_for_recall || 'Public Health Alert';

        return {
          recallId: item.recall_number || item.id || `FSIS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: productName,
          description: reason,
          brand: company,
          product: productName,
          category: this.categorizeProduct(productName),
          retailer: this.identifyRetailer(company),
          reason: reason,
          riskLevel: this.assessRiskLevel(reason),
          recallDate: new Date(recallDate || Date.now()),
          statesAffected: item.states || item.states_affected || ['Nationwide'],
          source: 'USDA-FSIS',
          isActive: true,
          originalData: item
        };
      } catch (error) {
        console.error('Error transforming FSIS item:', error, item);
        return null;
      }
    }).filter(item => item !== null); // Remove any failed transformations
  }

  // Enhanced product categorization
  categorizeProduct(description) {
    const desc = description.toLowerCase();
    
    // Poultry
    if (desc.includes('chicken') || desc.includes('turkey') || desc.includes('poultry') || 
        desc.includes('duck') || desc.includes('goose')) {
      return 'poultry';
    }
    // Meat
    else if (desc.includes('beef') || desc.includes('pork') || desc.includes('meat') || 
             desc.includes('steak') || desc.includes('burger') || desc.includes('sausage')) {
      return 'meat';
    }
    // Shellfish/Seafood
    else if (desc.includes('fish') || desc.includes('shrimp') || desc.includes('shellfish') || 
             desc.includes('seafood') || desc.includes('salmon') || desc.includes('tuna') ||
             desc.includes('crab') || desc.includes('lobster')) {
      return 'shellfish';
    }
    // Vegetables
    else if (desc.includes('vegetable') || desc.includes('spinach') || desc.includes('lettuce') || 
             desc.includes('broccoli') || desc.includes('carrot') || desc.includes('potato')) {
      return 'vegetables';
    }
    // Fruits
    else if (desc.includes('fruit') || desc.includes('apple') || desc.includes('berry') || 
             desc.includes('orange') || desc.includes('banana') || desc.includes('melon')) {
      return 'fruits';
    }
    // Dairy
    else if (desc.includes('dairy') || desc.includes('milk') || desc.includes('cheese') || 
             desc.includes('yogurt') || desc.includes('butter') || desc.includes('cream')) {
      return 'dairy';
    }
    // Eggs
    else if (desc.includes('egg')) {
      return 'eggs';
    }
    // Processed foods
    else if (desc.includes('frozen') || desc.includes('canned') || desc.includes('processed') ||
             desc.includes('meal') || desc.includes('dinner')) {
      return 'processed-foods';
    }
    else {
      return 'other';
    }
  }

  // Enhanced retailer identification
  identifyRetailer(companyName) {
    if (!companyName) return 'other';
    
    const name = companyName.toLowerCase();
    
    const retailerMappings = {
      'trader joe': 'trader-joes',
      'whole food': 'whole-foods',
      'kroger': 'kroger',
      'walmart': 'walmart',
      'costco': 'costco',
      'target': 'target',
      'safeway': 'safeway',
      'albertson': 'albertsons',
      'publix': 'publix',
      'wegmans': 'wegmans',
      'aldi': 'aldi',
      'lidl': 'lidl',
      'harris teeter': 'harris-teeter'
    };

    for (const [keyword, retailer] of Object.entries(retailerMappings)) {
      if (name.includes(keyword)) {
        return retailer;
      }
    }

    return 'other';
  }

  // Enhanced risk assessment
  assessRiskLevel(reason) {
    if (!reason) return 'medium';
    
    const reasonLower = reason.toLowerCase();
    
    // High risk indicators
    const highRiskIndicators = [
      'listeria', 'e. coli', 'salmonella', 'botulism', 'deadly', 'fatal',
      'hospitalization', 'outbreak', 'contamination'
    ];
    
    // Medium risk indicators
    const mediumRiskIndicators = [
      'allergen', 'undeclared', 'misbranded', 'labeling', 'packaging',
      'quality', 'foreign material'
    ];
    
    // Low risk indicators
    const lowRiskIndicators = [
      'voluntary', 'precaution', 'quality control', 'routine'
    ];

    if (highRiskIndicators.some(indicator => reasonLower.includes(indicator))) {
      return 'high';
    } else if (mediumRiskIndicators.some(indicator => reasonLower.includes(indicator))) {
      return 'medium';
    } else if (lowRiskIndicators.some(indicator => reasonLower.includes(indicator))) {
      return 'low';
    } else {
      return 'medium'; // Default to medium if uncertain
    }
  }

  // Enhanced brand extraction
  extractBrand(description) {
    if (!description) return 'Unknown Brand';
    
    const brands = [
      'Trader Joe\'s', 'Whole Foods', 'Kroger', 'Walmart', 'Costco', 
      'Target', 'Safeway', 'Albertsons', 'Publix', 'Wegmans',
      'Aldi', 'Lidl', 'Harris Teeter', 'Generic', 'Store Brand'
    ];
    
    for (const brand of brands) {
      if (description.includes(brand)) {
        return brand;
      }
    }
    
    // Try to extract first few words as brand
    const words = description.split(' ');
    if (words.length > 2) {
      return words.slice(0, 2).join(' ');
    }
    
    return 'Unknown Brand';
  }

  // Test API connectivity
  async testAPIs() {
    try {
      console.log('🧪 Testing API connectivity...');
      
      const [fdaTest, fsisTest] = await Promise.allSettled([
        axios.get(`${this.fdaBaseUrl}?limit=1`),
        axios.get(`${this.fsisBaseUrl}?pageSize=1`)
      ]);

      return {
        fda: fdaTest.status === 'fulfilled',
        fsis: fsisTest.status === 'fulfilled',
        fdaError: fdaTest.status === 'rejected' ? fdaTest.reason.message : null,
        fsisError: fsisTest.status === 'rejected' ? fsisTest.reason.message : null
      };
    } catch (error) {
      console.error('API test error:', error);
      return {
        fda: false,
        fsis: false,
        error: error.message
      };
    }
  }
}

module.exports = new RecallApiService();