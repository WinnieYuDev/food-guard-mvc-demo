const axios = require('axios');

class RecallApiService {
  constructor() {
    this.fdaBaseUrl = 'https://api.fda.gov/food/enforcement.json';
    this.fsisBaseUrl = 'https://www.fsis.usda.gov/fsis/api/recall/v/1';
  }

  async fetchFDARecalls(options = {}) {
    try {
      const { limit = 50, search = '' } = options;
      
      let queryParams = `limit=${limit}`;
      
      if (search) {
        queryParams += `&search=product_description:"${encodeURIComponent(search)}"`;
      }

      console.log('🌐 FDA API call:', `${this.fdaBaseUrl}?${queryParams}`);
      const response = await axios.get(`${this.fdaBaseUrl}?${queryParams}`, {
        timeout: 10000 // 10 second timeout
      });
      
      const results = response.data.results || [];
      console.log(`✅ FDA API returned ${results.length} recalls`);
      
      return this.transformFDAData(results);
    } catch (error) {
      console.error('❌ FDA API Error:', error.message);
      return [];
    }
  }

  async fetchFSISRecalls(options = {}) {
    try {
      const { limit = 50, search = '' } = options;
      
      console.log('🌐 FSIS API call:', this.fsisBaseUrl);
      const response = await axios.get(this.fsisBaseUrl, {
        timeout: 5000 // 5 second timeout for FSIS
      });

      const results = response.data || [];
      console.log(`✅ FSIS API returned ${results.length} recalls`);
      
      return this.transformFSISData(results);
    } catch (error) {
      console.error('❌ FSIS API Error:', error.message);
      return []; // Return empty array instead of hanging
    }
  }

  async fetchAllRecalls(filters = {}) {
    try {
      console.log('🌐 Starting to fetch all recalls...');
      
      // Use Promise.race with timeout to prevent hanging
      const fetchWithTimeout = async (promise, timeoutMs) => {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        );
        return Promise.race([promise, timeoutPromise]);
      };

      const [fdaRecalls, fsisRecalls] = await Promise.allSettled([
        this.fetchFDARecalls(filters),
        fetchWithTimeout(this.fetchFSISRecalls(filters), 8000) // 8 second max for FSIS
      ]);

      const recalls = [];

      if (fdaRecalls.status === 'fulfilled' && fdaRecalls.value) {
        recalls.push(...fdaRecalls.value);
        console.log(`✅ FDA: ${fdaRecalls.value.length} recalls`);
      }

      if (fsisRecalls.status === 'fulfilled' && fsisRecalls.value) {
        recalls.push(...fsisRecalls.value);
        console.log(`✅ FSIS: ${fsisRecalls.value.length} recalls`);
      } else {
        console.log('⏰ FSIS API timeout or error, using FDA data only');
      }

      console.log(`📊 Total API recalls: ${recalls.length}`);
      
      return recalls
        .sort((a, b) => new Date(b.recallDate) - new Date(a.recallDate))
        .slice(0, filters.limit || 50);
        
    } catch (error) {
      console.error('❌ Error in fetchAllRecalls:', error);
      return [];
    }
  }

  transformFDAData(fdaData) {
  if (!Array.isArray(fdaData)) return [];
  
  return fdaData.map(recall => ({
    recallId: recall.recall_number || `FDA-${Date.now()}`,
    title: recall.product_description || 'Unknown FDA Product',
    description: recall.reason_for_recall || 'No description available',
    product: recall.product_description || 'Unknown Product',
    brand: recall.responsible_firm || 'Unknown Brand',
    reason: recall.reason_for_recall || 'Not specified',
    recallDate: recall.recall_initiation_date || new Date().toISOString(),
    agency: 'FDA',
    riskLevel: this.determineRiskLevel(recall.reason_for_recall),
    category: this.determineCategory(recall.product_description),
    status: recall.status || 'Ongoing',
    distribution: recall.distribution_pattern || 'Nationwide',
    statesAffected: this.extractStates(recall.distribution_pattern) || ['Nationwide'],
    isActive: true
  }));
}

// In transformFSISData method:
transformFSISData(fsisData) {
  if (!Array.isArray(fsisData)) return [];
  
  return fsisData.map(recall => ({
    recallId: recall.RecallNumber || `FSIS-${Date.now()}`,
    title: recall.Title || 'Unknown FSIS Product',
    description: recall.Description || 'No description available',
    product: recall.Product || 'Unknown Product',
    brand: recall.Firm || 'Unknown Brand',
    reason: recall.Reason || 'Not specified',
    recallDate: recall.ReleaseDate || recall.Date || new Date().toISOString(),
    agency: 'FSIS',
    riskLevel: this.determineRiskLevel(recall.Reason),
    category: this.determineCategory(recall.Product),
    status: recall.Status || 'Ongoing',
    distribution: recall.Distribution || 'Nationwide',
    statesAffected: this.extractStates(recall.Distribution) || ['Nationwide'],
    isActive: true
  }));
}

// Add this helper method to extract states from distribution pattern
extractStates(distributionPattern) {
  if (!distributionPattern) return ['Nationwide'];
  
  const pattern = distributionPattern.toLowerCase();
  
  if (pattern.includes('nationwide') || pattern.includes('national')) {
    return ['Nationwide'];
  }
  
  // Extract state abbreviations (this is a simple example)
  const stateMatches = pattern.match(/\b[A-Z]{2}\b/g);
  if (stateMatches) {
    return stateMatches;
  }
  
  return ['Multiple States'];
}

  determineRiskLevel(reason) {
    if (!reason) return 'medium';
    
    const reasonLower = reason.toLowerCase();
    
    if (reasonLower.includes('salmonella') || 
        reasonLower.includes('e. coli') || 
        reasonLower.includes('listeria') ||
        reasonLower.includes('botulism')) {
      return 'high';
    }
    
    if (reasonLower.includes('allergen') || 
        reasonLower.includes('undeclared') ||
        reasonLower.includes('mislabel')) {
      return 'medium';
    }
    
    return 'low';
  }

  determineCategory(productDescription) {
    if (!productDescription) return 'processed-foods';
    
    const descLower = productDescription.toLowerCase();
    
    if (descLower.includes('chicken') || descLower.includes('turkey') || descLower.includes('poultry')) return 'poultry';
    if (descLower.includes('beef') || descLower.includes('pork') || descLower.includes('meat')) return 'meat';
    if (descLower.includes('fish') || descLower.includes('shrimp') || descLower.includes('salmon') || descLower.includes('shellfish')) return 'shellfish';
    if (descLower.includes('spinach') || descLower.includes('lettuce') || descLower.includes('broccoli') || descLower.includes('vegetable')) return 'vegetables';
    if (descLower.includes('apple') || descLower.includes('berry') || descLower.includes('orange') || descLower.includes('fruit')) return 'fruits';
    if (descLower.includes('milk') || descLower.includes('cheese') || descLower.includes('yogurt') || descLower.includes('dairy')) return 'dairy';
    if (descLower.includes('egg')) return 'eggs';
    return 'processed-foods';
  }
}

module.exports = new RecallApiService();