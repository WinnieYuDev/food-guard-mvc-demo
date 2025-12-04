/**
 * RecallApiService
 *
 * Service that fetches recall data from external providers (FDA openFDA
 * and FSIS). It normalizes provider-specific payloads into a consistent
 * application-level object shape used by controllers and the front-end.
 */
const axios = require('axios');
const dev = process.env.NODE_ENV === 'development';

class RecallApiService {
  constructor() {
    this.fdaBaseUrl = 'https://api.fda.gov/food/enforcement.json';
    this.fsisBaseUrl = 'https://www.fsis.usda.gov/fsis/api/recall/v/1';
  }

  /**
   * fetchFDARecalls(options)
   *
   * Query the FDA openFDA enforcement endpoint and return normalized recall
   * objects. `options` may include `limit`, `search`, and `monthsBack` to
   * filter the results. On failure a simpler fallback query is attempted.
   */
  async fetchFDARecalls(options = {}) {
    const { limit = 50, search = '', monthsBack = 5 } = options;
    try {

      const queryParts = [];

      if (monthsBack) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const endDate = new Date();

        const formatDate = (date) => date.toISOString().split('T')[0].replace(/-/g, '');
        queryParts.push(`report_date:[${formatDate(startDate)}+TO+${formatDate(endDate)}]`);
      }

      if (search && String(search).trim() !== '') {
        const s = String(search).replace(/"/g, '').trim();
        const sub = [`product_description:"${s}"`, `recalling_firm:"${s}"`, `reason_for_recall:"${s}"`].join('+OR+');
        queryParts.push(`(${sub})`);
      }

      const searchQuery = queryParts.join('+AND+');
      const url = `${this.fdaBaseUrl}?limit=${Math.min(limit, 100)}&sort=report_date:desc${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`;

      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'FoodSafetyApp/1.0' }
      });

      const results = response.data.results || [];

      return this.transformFDAData(results);
      } catch (error) {
      console.error('FDA API Error (primary query):', error.response?.status, error.message);
      try {
        const fallbackUrl = `${this.fdaBaseUrl}?limit=${Math.min(limit, 100)}&sort=report_date:desc`;
        const fallbackResp = await axios.get(fallbackUrl, { timeout: 10000, headers: { 'User-Agent': 'FoodSafetyApp/1.0' } });
        const fbResults = fallbackResp.data.results || [];
        return this.transformFDAData(fbResults);
      } catch (fbError) {
        console.error('FDA API fallback error:', fbError.response?.status, fbError.message || fbError);
      }

      return [];
    }
  }

  /**
   * searchRecalls(searchTerm, limit)
   *
   * Perform a parallel search against both FDA and FSIS and return a
   * merged, date-sorted list limited to `limit` entries. Used for product
   * lookup features where both sources are relevant.
   */
  async searchRecalls(searchTerm, limit = 20) {
    try {
      // Use FSIS only for searches while FDA data is disabled
      const filters = { search: searchTerm, limit, monthsBack: 12 };
      const fsisRes = await this.fetchFSISRecalls(filters);
      const results = (fsisRes || []).sort((a, b) => new Date(b.recallDate) - new Date(a.recallDate)).slice(0, limit);
      return results;
    } catch (error) {
      console.error('searchRecalls error:', error.message);
      return [];
    }
  }

  /**
   * fetchFSISRecalls(options)
   *
   * Query the FSIS recall API and map results to the normalized recall
   * shape. Supports basic date filtering (`monthsBack`) and text search.
   */
  async fetchFSISRecalls(options = {}) {
    try {
      const { limit = 50, monthsBack = 5, search = '' } = options;
      const response = await axios.get(this.fsisBaseUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'FoodSafetyApp/1.0',
          'Accept': 'application/json'
        }
      });

      let results = response.data || [];
      
      if (monthsBack && results.length > 0) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
        
        results = results.filter(recall => {
          const recallDate = this.parseFSISDate(recall.ReleaseDate || recall.Date);
          return recallDate >= cutoffDate;
        });
      }
      
      if (search && String(search).trim() !== '') {
        const s = String(search).toLowerCase();
        results = results.filter(r => {
          const product = String(r.Product || r.product_name || r.field_title || '').toLowerCase();
          const company = String(r.Firm || r.establishment || r.field_establishment || '').toLowerCase();
          const reason = String(r.Reason || r.reason || r.field_recall_reason || r.field_summary || '').toLowerCase();
          return product.includes(s) || company.includes(s) || reason.includes(s);
        });
      }

      results = results.slice(0, limit);
      return this.transformFSISData(results);
    } catch (error) {
      console.error('FSIS API Error:', error.response?.status, error.message);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * fetchAllRecalls(filters)
   *
   * High-level convenience method that attempts to fetch recalls from both
   * FDA and FSIS, merges the results, sorts by date and returns the top
   * `limit` entries. Falls back to mock data if external APIs fail.
   */
  async fetchAllRecalls(filters = {}) {
    try {
      // Use FSIS only for aggregated recall fetches; exclude FDA for now
      const fsisRecalls = await this.fetchFSISRecalls(filters);
      const recalls = (fsisRecalls && fsisRecalls.length > 0) ? fsisRecalls : this.getMockRecalls(filters);

      return recalls
        .sort((a, b) => new Date(b.recallDate) - new Date(a.recallDate))
        .slice(0, filters.limit || 50);
        
    } catch (error) {
      console.error('Error in fetchAllRecalls:', error);
      return this.getMockRecalls(filters); // Fallback to mock data
    }
  }

  // === Utilities ===
  // Small helper utilities used when transforming/parsing provider data.
  parseFSISDate(dateString) {
    if (!dateString) return new Date();
    
    try {
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

  // === Transformers ===
  // Map provider-specific payloads into the application's normalized recall
  // object shape. These functions isolate field mappings and any cleanup
  // required for each provider.
  transformFDAData(fdaData) {
    if (!Array.isArray(fdaData)) return [];
    
    return fdaData.map(recall => {
      const productName = recall.product_description || 'Unknown FDA Product';
      const reason = recall.reason_for_recall || 'Not specified';
      const recallDate = recall.recall_initiation_date || recall.report_date || new Date().toISOString();
      const company = recall.recalling_firm || recall.firm_name || 'Unknown Company';
      
      const categories = this.determineCategories(productName);
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
        category: categories[0] || 'other',
        categories: categories,
        status: recall.status || recall.recall_status || 'Ongoing',
        distribution: recall.distribution_pattern || 'Nationwide',
        statesAffected: this.extractStates(recall.distribution_pattern),
        isActive: !recall.termination_date, // Consider active if no termination date
        rawData: recall // Keep original data for reference
      };
    });
  }

  // Determine multiple categories (up to maxCount) from product description
  determineCategories(productDescription, maxCount = 3) {
    if (!productDescription) return ['other'];
    const descLower = String(productDescription).toLowerCase();
    const pushIf = (arr, val) => { if (!arr.includes(val)) arr.push(val); };
    const out = [];

    const lists = [
      { cat: 'seafood', kws: ['imitation crab','crabmeat','krab','crab','shrimp','prawn','lobster','oyster','mussel','scallop','clam','fish','salmon','tuna','cod','pollock'] },
      { cat: 'poultry', kws: ['chicken','turkey','poultry','hen','duck','quail'] },
      { cat: 'beef', kws: ['beef','steak','burger','ground beef','hamburger'] },
      { cat: 'pork', kws: ['pork','bacon','sausage','ham'] },
      { cat: 'dairy', kws: ['milk','cheese','yogurt','dairy','ice cream','cream','butter'] },
      { cat: 'eggs', kws: ['egg','eggs','egg product'] },
      { cat: 'nuts', kws: ['nut','peanut','almond','cashew','pistachio','walnut','hazelnut','macadamia','pecan'] },
      { cat: 'grains', kws: ['burrito','wrap','sandwich','noodle','pasta','ramen','bread','flour','tortilla','bagel','bun','muffin','croissant','cereal','rice','cracker'] },
      { cat: 'snacks', kws: ['cookie','biscuit','candy','chocolate','snack','chip','cracker','bar','granola','pretzel','popcorn','jerky'] },
      { cat: 'vegetables', kws: ['spinach','lettuce','broccoli','vegetable','carrot','tomato','onion','pepper','cabbage'] },
      { cat: 'fruits', kws: ['apple','berry','orange','melon','banana','grape','mango','peach','pear','pineapple'] },
      { cat: 'baby-food', kws: ['baby','infant'] }
    ];
// Check each category list for matches
    for (const entry of lists) {
      for (const k of entry.kws) {
        if (descLower.includes(k)) { pushIf(out, entry.cat); break; }
      }
      if (out.length >= maxCount) break;
    }

    if (out.length === 0) out.push('other');
    return out.slice(0, maxCount);
  }
// Transform FSIS recall data into normalized recall objects
  transformFSISData(fsisData) {
    if (!Array.isArray(fsisData)) return [];
    return fsisData.map(recall => {
      const productName = recall.Product || recall.product_name || recall.field_title || recall.field_product_items || recall.field_summary || 'Unknown FSIS Product';
      const reason = recall.Reason || recall.reason || recall.field_recall_reason || recall.field_summary || 'Not specified';
      const recallDateRaw = recall.ReleaseDate || recall.Date || recall.field_recall_date || recall.field_last_modified_date || recall.recall_date || new Date().toISOString();
      const company = recall.Firm || recall.establishment || recall.field_establishment || recall.company || 'Unknown Company';
      const recallNumber = recall.RecallNumber || recall.recall_number || recall.field_recall_number || `FSIS-${Date.now()}`;

      let conciseProduct = productName;
      if (typeof conciseProduct === 'string' && conciseProduct.length > 250) {
        const plain = conciseProduct.replace(/<[^>]*>/g, '').trim();
        conciseProduct = plain.split(/[\.\n]/)[0];
      }
      const rawDistribution = recall.Distribution || recall.distribution || recall.field_distro_list || recall.field_states || '';

      // Normalize distribution -> statesAffected and a clean distribution string
      const derivedStates = this.extractStates(rawDistribution || recall.field_states || recall.field_distro_list);
      let distributionStr = 'Nationwide';
      if (Array.isArray(derivedStates) && derivedStates.length > 0) {
        if (derivedStates.length === 1 && (derivedStates[0] === 'Nationwide' || derivedStates[0] === 'Multiple States')) {
          distributionStr = derivedStates[0];
        } else {
          distributionStr = derivedStates.join(', ');
        }
      } else if (rawDistribution && String(rawDistribution).trim().length > 0) {
        distributionStr = String(rawDistribution).replace(/\b\S+\.(pdf|docx?|xls|xlsx)\b/gi, '').replace(/https?:\/\/[\S]+/gi, '').trim();
        if (!distributionStr) distributionStr = 'Multiple States';
      }

      const categories = this.determineCategories(conciseProduct);

      return {
        recallId: recallNumber,
        title: conciseProduct,
        description: reason || (recall.field_summary || '').replace(/<[^>]*>/g, '').trim() || 'Not specified',
        product: conciseProduct,
        brand: company,
        reason: reason,
        recallDate: this.parseFSISDate(recallDateRaw),
        // prefer a provider-supplied URL field when available
        articleLink: recall.field_recall_url || recall.RecallUrl || recall.RecallURL || recall.recall_url || recall.recallUrl || recall.URL || null,
        agency: 'FSIS',
        riskLevel: this.determineRiskLevel(reason),
        category: categories[0] || 'other',
        categories: categories,
        status: recall.Status || recall.status || recall.field_recall_type || 'Ongoing',
        distribution: distributionStr,
        statesAffected: Array.isArray(derivedStates) && derivedStates.length > 0 ? derivedStates : ['Multiple States'],
        isActive: ((recall.Status || recall.field_active_notice || '') + '').toString().toLowerCase() !== 'false' && ((recall.Status || '') + '').toString().toLowerCase() !== 'completed',
        rawData: recall // Keep original data for reference
      };
    });
  }
// Extract affected states from distribution pattern text
  extractStates(distributionPattern) {
    if (!distributionPattern) return ['Nationwide'];

    // Accept arrays (already parsed) or strings
    if (Array.isArray(distributionPattern)) {
      const arr = distributionPattern.map(s => String(s).trim()).filter(Boolean);
      if (arr.length === 0) return ['Nationwide'];
      const twoLetter = arr.filter(a => /^[A-Za-z]{2}$/.test(a));
      if (twoLetter.length > 0) return twoLetter.map(s => s.toUpperCase());
      return [arr.join(', ')];
    }

    const pattern = String(distributionPattern).toLowerCase();

    if (pattern.includes('nationwide') || pattern.includes('national') || pattern.includes('nation wide')) {
      return ['Nationwide'];
    }

    if (pattern.includes('multi-state') || pattern.includes('multiple states')) {
      return ['Multiple States'];
    }

    const stateAbbreviations = [
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
      'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
      'VA','WA','WV','WI','WY'
    ];

    const foundStates = stateAbbreviations.filter(state => 
      new RegExp(`\b${state}\b`, 'i').test(distributionPattern)
    );

    if (foundStates.length > 0) {
      return foundStates;
    }

    return ['Multiple States'];
  }
// Determine risk level based on reason for recall
  determineRiskLevel(reason) {
    if (!reason) return 'medium';
    
    const reasonLower = String(reason).toLowerCase();
    
    if (reasonLower.includes('salmonella') || 
        reasonLower.includes('e. coli') || 
        reasonLower.includes('listeria') ||
        reasonLower.includes('botulism') ||
        reasonLower.includes('clostridium') ||
        reasonLower.includes('deadly') ||
        reasonLower.includes('fatal')) {
      return 'high';
    }
    
    if (reasonLower.includes('allergen') || 
        reasonLower.includes('undeclared') ||
        reasonLower.includes('mislabel') ||
        reasonLower.includes('foreign material') ||
        reasonLower.includes('plastic') ||
        reasonLower.includes('glass') ||
        reasonLower.includes('metal')) {
      return 'medium';
    }
    
    return 'low';
  }
// Determine single category from product description
  determineCategory(productDescription) {
    if (!productDescription) return 'other';
    
    const descLower = String(productDescription).toLowerCase();
    const kw = (s) => new RegExp(`\\b${s}\\b`, 'i');

    const seafoodList = ['imitation crab', 'crabmeat', 'krab', 'crab', 'shrimp', 'prawn', 'lobster', 'oyster', 'mussel', 'scallop', 'clam', 'fish', 'salmon', 'tuna', 'cod', 'pollock'];
    if (seafoodList.some(k => descLower.includes(k))) return 'seafood';

    const grainsList = ['burrito', 'wrap', 'sandwich', 'noodle', 'pasta', 'ramen', 'bread', 'flour', 'tortilla', 'bagel', 'bun', 'muffin', 'croissant', 'cereal', 'rice', 'cracker', 'tortilla'];
    if (grainsList.some(k => descLower.includes(k))) return 'grains';

    const snacksList = ['cookie','biscuit','candy','chocolate','snack','chip','cracker','bar','granola','pretzel','popcorn','jerky'];
    if (snacksList.some(k => descLower.includes(k))) return 'snacks';

    const dairyList = ['milk','cheese','yogurt','dairy','ice cream','cream','butter'];
    if (dairyList.some(k => descLower.includes(k))) return 'dairy';

    if (kw('egg').test(descLower) || kw('eggs').test(descLower) || descLower.includes('egg product')) return 'eggs';

    if (descLower.includes('chicken') || descLower.includes('turkey') || descLower.includes('poultry') || descLower.includes('hen') || descLower.includes('duck') || descLower.includes('quail')) return 'poultry';
    if (descLower.includes('beef') || descLower.includes('steak') || descLower.includes('burger') || descLower.includes('ground beef')) return 'beef';
    if (descLower.includes('pork') || descLower.includes('bacon') || descLower.includes('sausage') || descLower.includes('ham')) return 'pork';

    const vegList = ['spinach','lettuce','broccoli','vegetable','carrot','onion','green onion','scallion','spring onion','leek','shallot','garlic','kale','cabbage','tomato','potato','cucumber','zucchini','eggplant','asparagus','pepper','celery','radish','turnip','okra','artichoke'];
    if (vegList.some(k => descLower.includes(k))) return 'vegetables';

    const fruitList = ['apple','berry','orange','fruit','melon','cantaloupe','honeydew','watermelon','banana','grape','kiwi','mango','peach','pear','pineapple'];
    if (fruitList.some(k => descLower.includes(k))) return 'fruits';

    const nutList = ['nut','peanut','almond','cashew','pistachio','walnut','hazelnut','macadamia','pecan'];
    if (nutList.some(k => descLower.includes(k))) return 'nuts';

    if (descLower.includes('baby') || descLower.includes('infant')) return 'baby-food';

    return 'other';
  }
// === Mock Data for Testing/Fallback ===
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

  async healthCheck() {
    const results = {
      fda: { status: 'unknown', responseTime: 0, error: null },
      fsis: { status: 'unknown', responseTime: 0, error: null }
    };

    try {
      const startTime = Date.now();
      await axios.get(`${this.fdaBaseUrl}?limit=1`, { timeout: 5000 });
      results.fda.responseTime = Date.now() - startTime;
      results.fda.status = 'healthy';
    } catch (error) {
      results.fda.status = 'unhealthy';
      results.fda.error = error.message;
    }

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