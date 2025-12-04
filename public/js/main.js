/**
 * public/js/main.js
 *
 * Lightweight client-side UI helpers used across the site:
 * - mobile menu toggling
 * - flash message fading
 * - simple form validation and like button animation
 * These functions are intentionally minimal and are intended for
 * progressive enhancement of EJS-rendered pages.
 */
// Wait for DOM content to load before initializing
document.addEventListener('DOMContentLoaded', function() {
    initializeMobileMenu();
    initializeFlashMessages();
    initializeFormValidation();
    initializeLikeButtons();
});
// Debounce utility function
function initializeMobileMenu() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const sidebar = document.querySelector('aside');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    
    if (mobileMenuButton && sidebar && sidebarBackdrop) {
        mobileMenuButton.addEventListener('click', function() {
            sidebar.classList.toggle('-translate-x-full');
            sidebarBackdrop.style.display = sidebar.classList.contains('-translate-x-full') ? 'none' : 'block';
        });
        
        sidebarBackdrop.addEventListener('click', function() {
            sidebar.classList.add('-translate-x-full');
            sidebarBackdrop.style.display = 'none';
        });
    }
}
// Flash message auto-fade
function initializeFlashMessages() {
    const flashMessages = document.querySelectorAll('[class*="bg-"].border');
    
    flashMessages.forEach(message => {
        setTimeout(() => {
            message.style.opacity = '0';
            message.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 500);
        }, 5000); // 5 seconds
    });
}
// Simple form validation
function initializeFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    highlightFieldError(field);
                } else {
                    clearFieldError(field);
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                showFormError('Please fill in all required fields.');
            }
        });
    });
}
// Helper functions for form validation
function highlightFieldError(field) {
    field.classList.add('border-red-500');
    field.classList.remove('border-gray-300');
}
// Helper functions for form validation
function clearFieldError(field) {
    field.classList.remove('border-red-500');
    field.classList.add('border-gray-300');
}
// Display form error message
function showFormError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'mb-4 p-4 bg-red-50 border border-red-200 rounded-lg';
    errorDiv.innerHTML = `
        <div class="flex items-center">
            <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
            <span class="text-red-700 text-sm">${message}</span>
        </div>
    `;
    
    const form = document.querySelector('form');
    if (form) {
        form.insertBefore(errorDiv, form.firstChild);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
}
// Like button animation
function initializeLikeButtons() {
    const likeButtons = document.querySelectorAll('form[action*="/like"] button');
    
    likeButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span class="animate-pulse">❤️</span>';
            button.disabled = true;
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.disabled = false;
            }, 1000);
        });
    });
}
// Confirm action dialog
function confirmAction(message) {
    return confirm(message || 'Are you sure you want to proceed?');
}
// Set loading state on button
function setLoadingState(element, isLoading) {
    if (isLoading) {
        element.disabled = true;
        element.classList.add('opacity-50', 'cursor-not-allowed');
        const originalText = element.textContent;
        element.setAttribute('data-original-text', originalText);
        element.textContent = 'Loading...';
    } else {
        element.disabled = false;
        element.classList.remove('opacity-50', 'cursor-not-allowed');
        const originalText = element.getAttribute('data-original-text');
        if (originalText) {
            element.textContent = originalText;
        }
    }
}
// Debounce utility function
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        confirmAction,
        setLoadingState,
        debounce
    };
}