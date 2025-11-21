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
    const riskFilter = document.getElementById('riskFilter');
    const searchFilter = document.getElementById('searchFilter');
    
    if (riskFilter) {
        riskFilter.addEventListener('change', handleRecallFilter);
    }
    
    if (searchFilter) {
        searchFilter.addEventListener('input', handleRecallFilter);
    }
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
                        <span class="text-red-500 text-xl mr-3 mt-1">⚠️</span>
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
                        <span class="text-green-500 text-xl mr-3 mt-1">✅</span>
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
    // Get current filter values
    const riskLevel = document.getElementById('riskFilter').value;
    const search = document.getElementById('searchFilter').value;
    
    // Build URL with filter parameters
    let url = '?';
    if (riskLevel !== 'all') url += `risk=${riskLevel}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    
    // Remove trailing & or ? if no parameters
    if (url.endsWith('&') || url.endsWith('?')) {
        url = url.slice(0, -1);
    }
    
    // Navigate to the filtered page
    if (url !== '?') {
        window.location.href = url;
    } else {
        window.location.href = '/recalls';
    }
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

// Add debouncing to search filter to prevent too many requests
const searchFilter = document.getElementById('searchFilter');
if (searchFilter) {
    searchFilter.addEventListener('input', debounce(handleRecallFilter, 500));
}