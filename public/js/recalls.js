// FoodGuard - Recalls Page JavaScript
// This file handles all the client-side functionality for the recalls page

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Product lookup functionality
    const productLookupForm = document.getElementById('productLookupForm');
    if (productLookupForm) {
        productLookupForm.addEventListener('submit', handleProductLookup);
    }

    // Recall filtering functionality
    // IDs in the page: #search, #category, #retailer, #riskLevel, #sortBy, #sortOrder
    const searchEl = document.getElementById('search');
    const categoryEl = document.getElementById('category');
    const retailerEl = document.getElementById('retailer');
    const riskEl = document.getElementById('riskLevel');
    const sortOrderEl = document.getElementById('sortOrder');

    if (categoryEl) categoryEl.addEventListener('change', handleRecallFilter);
    if (retailerEl) retailerEl.addEventListener('change', handleRecallFilter);
    if (riskEl) riskEl.addEventListener('change', handleRecallFilter);
    if (sortOrderEl) sortOrderEl.addEventListener('change', handleRecallFilter);
    if (searchEl) searchEl.addEventListener('input', debounce(handleRecallFilter, 500));
    // Load recent recall news (right-hand panel)
    try { if (typeof loadRecallNews === 'function') loadRecallNews(); } catch (e) { console.warn('loadRecallNews failed to init', e); }
});

// Handle product lookup form submission
async function handleProductLookup(e) {
    e.preventDefault(); // Prevent form from submitting normally
    
    // Get form data
    const formData = new FormData(e.target);
    const barcode = formData.get('barcode');
    const productName = formData.get('productName');
    
    try {
        // Show loading state
        const resultsDiv = document.getElementById('productResults');
        resultsDiv.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Searching for product information...</div>';
        
        // Send request to our server
        const response = await fetch('/recalls/lookup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ barcode, productName })
        });
        
        // Check if response is OK
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        // Get the response data
        const data = await response.json();
        
        // Display the results
        displayProductResults(data);
    } catch (error) {
        console.error('Product lookup error:', error);
        const resultsDiv = document.getElementById('productResults');
        resultsDiv.innerHTML = `
            <div class="text-center py-4 text-red-600">
                <p>Error searching for product information.</p>
                <p class="text-sm text-gray-600 mt-1">Please try again later.</p>
            </div>
        `;
    }
}

// Display product search results
function displayProductResults(data) {
    const resultsDiv = document.getElementById('productResults');
    
    // Create the results HTML
    resultsDiv.innerHTML = `
        <div class="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 class="text-lg font-semibold mb-4 text-gray-900">Product Information</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <!-- Basic Product Info -->
                <div>
                    <h4 class="font-medium mb-2 text-gray-900">Basic Info</h4>
                    <div class="space-y-2 text-sm">
                        <p><strong>Name:</strong> ${data.product.name}</p>
                        <p><strong>Brand:</strong> ${data.product.brand}</p>
                        <p><strong>Barcode:</strong> ${data.product.barcode}</p>
                    </div>
                </div>
                
                <!-- Allergens -->
                <div>
                    <h4 class="font-medium mb-2 text-gray-900">Allergens</h4>
                    ${data.product.allergens.length > 0 ? 
                        `<ul class="list-disc list-inside text-sm space-y-1">${data.product.allergens.map(a => `<li class="text-gray-700">${a}</li>`).join('')}</ul>` :
                        '<p class="text-sm text-gray-600">No major allergens detected</p>'
                    }
                </div>
            </div>
            
            <!-- Ingredients -->
            <div class="mb-4">
                <h4 class="font-medium mb-2 text-gray-900">Ingredients</h4>
                <p class="text-sm text-gray-700">${data.product.ingredients}</p>
            </div>
            
            <!-- Nutrition Facts (if available) -->
            ${data.product.nutritionFacts ? `
                <div class="mb-4">
                    <h4 class="font-medium mb-2 text-gray-900">Nutrition Facts (per serving)</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><strong>Calories:</strong> ${data.product.nutritionFacts.calories || 'N/A'}</div>
                        <div><strong>Protein:</strong> ${data.product.nutritionFacts.protein || 'N/A'}g</div>
                        <div><strong>Carbs:</strong> ${data.product.nutritionFacts.carbs || 'N/A'}g</div>
                        <div><strong>Fat:</strong> ${data.product.nutritionFacts.fat || 'N/A'}g</div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Recall Status Alert -->
            ${data.hasRecalls ? `
                <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div class="flex items-start">
                            <div>
                                <h4 class="font-medium text-red-800 mb-1">Active Recalls Found</h4>
                                <p class="text-red-700 text-sm">This product has ${data.relatedRecalls.length} active recall(s).</p>
                                <p class="text-red-700 text-sm mt-1 font-medium">Do not consume and follow recall instructions.</p>
                            </div>
                        </div>
                </div>
            ` : `
                <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div class="flex items-start">
                        <div>
                            <h4 class="font-medium text-green-800 mb-1">No Active Recalls</h4>
                            <p class="text-green-700 text-sm">This product has no active recalls at this time.</p>
                            <p class="text-green-700 text-sm mt-1">Always practice food safety when handling and storing products.</p>
                        </div>
                    </div>
                </div>
            `}
            
            <!-- Safety Tips -->
            <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 class="font-medium text-blue-800 mb-2">Food Safety Tips</h4>
                <ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>Always check expiration dates before consumption</li>
                    <li>Store products according to package instructions</li>
                    <li>Wash hands before handling food products</li>
                    <li>Report any suspicious products to the manufacturer</li>
                </ul>
            </div>
        </div>
    `;
}

// Handle recall filtering
function handleRecallFilter() {
    // Read filter values from the page (use same names as server expects)
    const search = (document.getElementById('search') && document.getElementById('search').value) || '';
    const category = (document.getElementById('category') && document.getElementById('category').value) || 'all';
    const retailer = (document.getElementById('retailer') && document.getElementById('retailer').value) || 'all';
    const riskLevel = (document.getElementById('riskLevel') && document.getElementById('riskLevel').value) || 'all';
    // Sorting is always by recallDate; UI only exposes order (asc/desc)
    const sortOrder = (document.getElementById('sortOrder') && document.getElementById('sortOrder').value) || 'desc';

    // Build URL with filter parameters; only include non-default values to keep URLs tidy
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (category !== 'all') params.set('category', category);
    if (retailer !== 'all') params.set('retailer', retailer);
    if (riskLevel !== 'all') params.set('riskLevel', riskLevel);
    // We don't send sortBy; server always sorts by recallDate. Only send order if non-default.
    if (sortOrder && sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    const query = params.toString();
    const target = query ? ('/recalls?' + query) : '/recalls';
    // Navigate to the filtered page
    window.location.href = target;
}

// Utility function to debounce rapid filter changes
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// (Debounced search input attached inside DOMContentLoaded)

// Load recent recall news into the right-hand panel
async function loadRecallNews() {
    const recallNewsList = document.getElementById('recallNewsList');
    if (!recallNewsList) return;

    recallNewsList.innerHTML = 'Loading recent recalls...';

    // Fetch news via server proxy to avoid CORS
    const urlNews = '/recalls/news';

    try {
        const res = await fetch(urlNews);
        const data = await res.json();

        recallNewsList.innerHTML = '';

        if (!data.results || data.results.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No recent food recalls';
            recallNewsList.appendChild(li);
            return;
        }

        for (let i = 0; i < data.results.length; i++) {
            const item = data.results[i];

            // Normalized fields from server: title, articleLink, recallDate, reason, brand, product, distribution
            const titleText = item.title || item.product || 'Recall Notice';
            let date = '';
            if (item.recallDate) {
                const d = new Date(item.recallDate);
                if (!isNaN(d.getTime())) date = d.toLocaleDateString();
            }

            let locationText = item.distribution || '';

            let reasonText = item.reason || item.description || '';
            const li = document.createElement('li');
            li.className = 'recall-news-item';

            // Build direct article link if available, otherwise construct a search link
            // Prefer direct FDA article links when present (recall_url or url). Fallback to FDA search.
            const articleHref = item.articleLink || (item.rawData && (item.rawData.recall_url || item.rawData.url)) || (`https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/${encodeURIComponent(((item.brand || item.recalling_firm) || '').toLowerCase().replace(/[^a-z0-9]+/g,'-'))}-recalls-${encodeURIComponent(((item.product || item.product_description) || '').toLowerCase().replace(/[^a-z0-9]+/g,'-'))}`);
            const a = document.createElement('a');
            a.className = 'fda-news-link';
            a.href = articleHref;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'recall-title fda-title-truncate';
            titleDiv.textContent = titleText;

            a.appendChild(titleDiv);

            const locationDiv = document.createElement('div');
            locationDiv.className = 'recall-location fda-news-meta';
            locationDiv.textContent = locationText;

            const reasonDiv = document.createElement('div');
            reasonDiv.className = 'recall-reason fda-news-reason';
            reasonDiv.textContent = reasonText ? ('Reason: ' + reasonText) : '';

            const dateDiv = document.createElement('div');
            dateDiv.className = 'recall-date fda-news-meta';
            dateDiv.textContent = 'Published: ' + (date || 'N/A');

            li.appendChild(a);
            if (locationDiv.textContent) li.appendChild(locationDiv);
            if (reasonDiv.textContent) li.appendChild(reasonDiv);
            li.appendChild(dateDiv);

            recallNewsList.appendChild(li);
        }
    } catch (err) {
        recallNewsList.innerHTML = '<li>Error loading recall news</li>';
        console.log('Error fetching recent FDA recalls:', err);
    }
}