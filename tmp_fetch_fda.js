(async () => {
  try {
    const recallService = require('./services/recallAPI');
    console.log('Calling fetchFDARecalls...');
    const results = await recallService.fetchFDARecalls({ limit: 10, monthsBack: 12 });
    console.log('Fetched items:', Array.isArray(results) ? results.length : 0);
    console.log(JSON.stringify(results.slice(0,5), null, 2));
  } catch (err) {
    console.error('Error running fetch test:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
