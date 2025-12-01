const axios = require('axios');

class RecallApiService {
  constructor() {
    this.fdaBaseUrl = 'https://api.fda.gov/food/enforcement.json';
    this.fsisBaseUrl = 'https://www.fsis.usda.gov/fsis/api/recall/v/1';
  }

  async fetchFDARecalls(options = {}) {
    try {
      const { limit = 50, search = '', monthsBack = 5 } = options;
      
      // Build FDA API query with date range
      const queryParams = new URLSearchParams({
        limit: Math.min(limit, 100), // FDA allows up to 1000 but we'll be conservative
        sort: 'report_date:desc'
      });

      // Add date range for recent recalls
      if (monthsBack) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const endDate = new Date();
        
        const formatDate = (date) => {
          return date.toISOString().split('T')[0].replace(/-/g, '');
        };
        
        queryParams.append('search', `report_date:[${formatDate(startDate)}+TO+${formatDate(endDate)}]`);
      }

      // Add search term if provided
      if (search) {
        const existingSearch = queryParams.get('search') || '';
        const newSearch = `product_description:"${search.replace(/"/g, '')}"`;
        queryParams.set('search', existingSearch ? `(${existingSearch})+AND+(${newSearch})` : newSearch);
      }

      const url = `${this.fdaBaseUrl}?${queryParams.toString()}`;
      console.log('🌐 FDA API call:', url);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'FoodSafetyApp/1.0'
        }
      });
      
      const results = response.data.results || [];
      console.log(`✅ FDA API returned ${results.length} recalls`);
      
      return this.transformFDAData(results);
    } catch (error) {
      console.error('❌ FDA API Error:', error.response?.status, error.message);
      return [];
    }
  }

  async fetchFSISRecalls(options = {}) {
    try {
      const { limit = 50, monthsBack = 5 } = options;
      
      console.log('🌐 FSIS API call:', this.fsisBaseUrl);
      
      const response = await axios.get(this.fsisBaseUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'FoodSafetyApp/1.0',
          'Accept': 'application/json'
        }
      });

      let results = response.data || [];
      
      // Filter for recent recalls if we have date data
      if (monthsBack && results.length > 0) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
        
        results = results.filter(recall => {
          const recallDate = this.parseFSISDate(recall.ReleaseDate || recall.Date);
          return recallDate >= cutoffDate;
        });
      }
      
      // Apply limit
      results = results.slice(0, limit);
      
      console.log(`✅ FSIS API returned ${results.length} recalls`);
      
      return this.transformFSISData(results);
    } catch (error) {
      console.error('❌ FSIS API Error:', error.response?.status, error.message);
      return []; // Return empty array instead of throwing
    }
  }

  async fetchAllRecalls(filters = {}) {
    try {
      console.log('🌐 Starting to fetch all recalls...');
      
      const [fdaRecalls, fsisRecalls] = await Promise.allSettled([
        this.fetchFDARecalls(filters),
        this.fetchFSISRecalls(filters)
      ]);

      const recalls = [];

      // Process FDA results
      if (fdaRecalls.status === 'fulfilled') {
        recalls.push(...fdaRecalls.value);
        console.log(`✅ FDA: ${fdaRecalls.value.length} recalls`);
      } else {
        console.log('❌ FDA API failed');
      }

      // Process FSIS results
      if (fsisRecalls.status === 'fulfilled') {
        recalls.push(...fsisRecalls.value);
        console.log(`✅ FSIS: ${fsisRecalls.value.length} recalls`);
      } else {
        console.log('❌ FSIS API failed');
      }

      console.log(`📊 Total API recalls: ${recalls.length}`);
      
      // If both APIs failed, use mock data
      if (recalls.length === 0) {
        console.log('⚠️ Both APIs failed, using mock data');
        return this.getMockRecalls(filters);
      }
      
      return recalls
        .sort((a, b) => new Date(b.recallDate) - new Date(a.recallDate))
        .slice(0, filters.limit || 50);
        
    } catch (error) {
      console.error('❌ Error in fetchAllRecalls:', error);
      return this.getMockRecalls(filters); // Fallback to mock data
    }
  }

  // Helper to parse FSIS date formats
  parseFSISDate(dateString) {
    if (!dateString) return new Date();
    
    // Try different date formats that FSIS might use
    try {
      // Format: "MM/DD/YYYY" or "YYYY-MM-DD"
      if (dateString.includes('/')) {
        const [month, day, year] = dateString.split('/');
        return new Date(year, month - 1, day);
      } else {
        return new Date(dateString);
      }
    } catch {
      return new Date();
    }
  }

  transformFDAData(fdaData) {
    if (!Array.isArray(fdaData)) return [];
    
    return fdaData.map(recall => {
      // Handle various FDA field names
      const productName = recall.product_description || 'Unknown FDA Product';
      const reason = recall.reason_for_recall || 'Not specified';
      const recallDate = recall.recall_initiation_date || recall.report_date || new Date().toISOString();
      const company = recall.recalling_firm || recall.firm_name || 'Unknown Company';
      
      return {
        recallId: recall.recall_number || `FDA-${recall.id || Date.now()}`,
        title: productName,
        description: reason,
        product: productName,
        brand: company,
        reason: reason,
        recallDate: recallDate,
        agency: 'FDA',
        riskLevel: this.determineRiskLevel(reason),
        category: this.determineCategory(productName),
        status: recall.status || recall.recall_status || 'Ongoing',
        distribution: recall.distribution_pattern || 'Nationwide',
        statesAffected: this.extractStates(recall.distribution_pattern),
        source: 'FDA',
        isActive: !recall.termination_date, // Consider active if no termination date
        rawData: recall // Keep original data for reference
      };
    });
  }

  transformFSISData(fsisData) {
    if (!Array.isArray(fsisData)) return [];
    
    return fsisData.map(recall => {
      // Handle various FSIS field names (camelCase and PascalCase)
      const productName = recall.Product || recall.product_name || 'Unknown FSIS Product';
      const reason = recall.Reason || recall.reason || 'Not specified';
      const recallDate = recall.ReleaseDate || recall.Date || recall.recall_date || new Date().toISOString();
      const company = recall.Firm || recall.establishment || recall.company || 'Unknown Company';
      const recallNumber = recall.RecallNumber || recall.recall_number || `FSIS-${Date.now()}`;
      
      return {
        recallId: recallNumber,
        title: productName,
        description: reason,
        product: productName,
        brand: company,
        reason: reason,
        recallDate: this.parseFSISDate(recallDate),
        agency: 'FSIS',
        riskLevel: this.determineRiskLevel(reason),
        category: this.determineCategory(productName),
        status: recall.Status || recall.status || 'Ongoing',
        distribution: recall.Distribution || recall.distribution || 'Nationwide',
        statesAffected: this.extractStates(recall.Distribution || recall.distribution),
        source: 'FSIS',
        isActive: (recall.Status || '').toLowerCase() !== 'completed',
        rawData: recall // Keep original data for reference
      };
    });
  }

  extractStates(distributionPattern) {
    if (!distributionPattern) return ['Nationwide'];
    
    const pattern = String(distributionPattern).toLowerCase();
    
    if (pattern.includes('nationwide') || pattern.includes('national') || pattern.includes('nation wide')) {
      return ['Nationwide'];
    }
    
    if (pattern.includes('multi-state') || pattern.includes('multiple states')) {
      return ['Multiple States'];
    }
    
    // Extract state abbreviations (simple pattern matching)
    const stateAbbreviations = [
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
      'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
      'VA','WA','WV','WI','WY'
    ];
    
    const foundStates = stateAbbreviations.filter(state => 
      new RegExp(`\\b${state}\\b`, 'i').test(distributionPattern)
    );
    
    if (foundStates.length > 0) {
      return foundStates;
    }
    
    return ['Multiple States'];
  }

  determineRiskLevel(reason) {
    if (!reason) return 'medium';
    
    const reasonLower = String(reason).toLowerCase();
    
    // High risk pathogens
    if (reasonLower.includes('salmonella') || 
        reasonLower.includes('e. coli') || 
        reasonLower.includes('listeria') ||
        reasonLower.includes('botulism') ||
        reasonLower.includes('clostridium') ||
        reasonLower.includes('deadly') ||
        reasonLower.includes('fatal')) {
      return 'high';
    }
    
    // Medium risk - allergens, quality issues
    if (reasonLower.includes('allergen') || 
        reasonLower.includes('undeclared') ||
        reasonLower.includes('mislabel') ||
        reasonLower.includes('foreign material') ||
        reasonLower.includes('plastic') ||
        reasonLower.includes('glass') ||
        reasonLower.includes('metal')) {
      return 'medium';
    }
    
    // Low risk - quality, packaging, minor issues
    return 'low';
  }

  determineCategory(productDescription) {
    if (!productDescription) return 'other';
    
    const descLower = String(productDescription).toLowerCase();
    
    // Protein categories
    if (descLower.includes('chicken') || descLower.includes('turkey') || descLower.includes('poultry') || descLower.includes('hen')) 
      return 'poultry';
    if (descLower.includes('beef') || descLower.includes('steak') || descLower.includes('burger')) 
      return 'beef';
    if (descLower.includes('pork') || descLower.includes('bacon') || descLower.includes('sausage') || descLower.includes('ham')) 
      return 'pork';
    if (descLower.includes('fish') || descLower.includes('salmon') || descLower.includes('tuna') || descLower.includes('seafood') || descLower.includes('shrimp')) 
      return 'seafood';
    
    // Produce categories
    if (descLower.includes('spinach') || descLower.includes('lettuce') || descLower.includes('broccoli') || descLower.includes('vegetable') || descLower.includes('carrot')) 
      return 'vegetables';
    if (descLower.includes('apple') || descLower.includes('berry') || descLower.includes('orange') || descLower.includes('fruit') || descLower.includes('melon')) 
      return 'fruits';
    
    // Dairy categories
    if (descLower.includes('milk') || descLower.includes('cheese') || descLower.includes('yogurt') || descLower.includes('dairy') || descLower.includes('ice cream')) 
      return 'dairy';
    if (descLower.includes('egg')) 
      return 'eggs';
    
    // Other categories
    if (descLower.includes('nut') || descLower.includes('peanut') || descLower.includes('almond')) 
      return 'nuts';
    if (descLower.includes('bread') || descLower.includes('flour') || descLower.includes('grain')) 
      return 'grains';
    if (descLower.includes('cookie') || descLower.includes('candy') || descLower.includes('chocolate')) 
      return 'snacks';
    if (descLower.includes('baby') || descLower.includes('infant')) 
      return 'baby-food';
    
    return 'other';
  }

  // Mock data for fallback
  getMockRecalls(filters = {}) {
    const currentDate = new Date();
    const mockRecalls = [
      {
        recallId: `MOCK-FDA-${currentDate.getTime()}-1`,
        title: 'Frozen Chicken Breast - Possible Listeria',
        description: 'Potential Listeria monocytogenes contamination',
        product: 'Frozen Raw Chicken Breast',
        brand: 'ABC Poultry Inc.',
        reason: 'Listeria monocytogenes',
        recallDate: new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
        agency: 'FDA',
        riskLevel: 'high',
        category: 'poultry',
        status: 'Ongoing',
        distribution: 'Nationwide',
        statesAffected: ['Nationwide'],
        source: 'MOCK',
        isActive: true
      },
      {
        recallId: `MOCK-FSIS-${currentDate.getTime()}-2`,
        title: 'Ground Beef Patties - E. coli Risk',
        description: 'Potential E. coli O157:H7 contamination',
        product: 'Fresh Ground Beef Patties',
        brand: 'XYZ Meats',
        reason: 'E. coli O157:H7',
        recallDate: new Date(currentDate.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
        agency: 'FSIS',
        riskLevel: 'high',
        category: 'beef',
        status: 'Ongoing',
        distribution: 'CA, TX, AZ, NV',
        statesAffected: ['CA', 'TX', 'AZ', 'NV'],
        source: 'MOCK',
        isActive: true
      },
      {
        recallId: `MOCK-FDA-${currentDate.getTime()}-3`,
        title: 'Bagged Salad Mix - Undeclared Allergens',
        description: 'May contain undeclared milk allergens',
        product: 'Pre-Washed Salad Mix',
        brand: 'Fresh Greens Co.',
        reason: 'Undeclared Milk Allergens',
        recallDate: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        agency: 'FDA',
        riskLevel: 'medium',
        category: 'vegetables',
        status: 'Ongoing',
        distribution: 'Nationwide',
        statesAffected: ['Nationwide'],
        source: 'MOCK',
        isActive: true
      }
    ];

    // Apply basic filtering to mock data
    let filtered = mockRecalls;
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(recall => 
        recall.product.toLowerCase().includes(searchLower) ||
        recall.reason.toLowerCase().includes(searchLower) ||
        recall.brand.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.slice(0, filters.limit || 50);
  }

  // Health check method
  async healthCheck() {
    const results = {
      fda: { status: 'unknown', responseTime: 0, error: null },
      fsis: { status: 'unknown', responseTime: 0, error: null }
    };

    // Test FDA API
    try {
      const startTime = Date.now();
      await axios.get(`${this.fdaBaseUrl}?limit=1`, { timeout: 5000 });
      results.fda.responseTime = Date.now() - startTime;
      results.fda.status = 'healthy';
    } catch (error) {
      results.fda.status = 'unhealthy';
      results.fda.error = error.message;
    }

    // Test FSIS API
    try {
      const startTime = Date.now();
      await axios.get(this.fsisBaseUrl, { timeout: 5000 });
      results.fsis.responseTime = Date.now() - startTime;
      results.fsis.status = 'healthy';
    } catch (error) {
      results.fsis.status = 'unhealthy';
      results.fsis.error = error.message;
    }

    return results;
  }
}

module.exports = new RecallApiService();