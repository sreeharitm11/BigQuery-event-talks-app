/**
 * BigQuery Release Pulse - Frontend Logic
 */

// Global State
let releaseNotesData = [];
let filteredNotesData = [];
let activeCategory = 'all';
let searchQuery = '';
let currentSortOrder = 'desc'; // 'desc' or 'asc'

// Tweet modal current state
let activeItemToTweet = null;

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const spinnerIcon = refreshBtn.querySelector('.spinner-icon');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const categoryFiltersContainer = document.getElementById('category-filters');
const sortSelect = document.getElementById('sort-select');
const streamContent = document.getElementById('stream-content');
const releaseList = document.getElementById('release-list');
const skeletonLoader = document.getElementById('skeleton-loader');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const emptyState = document.getElementById('empty-state');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const toastContainer = document.getElementById('toast-container');
const lastUpdatedTimeEl = document.getElementById('last-updated-time');
const syncStatusTextEl = document.getElementById('sync-status-text');
const syncIndicatorEl = document.querySelector('.status-indicator');
const exportCsvBtn = document.getElementById('export-csv-btn');
const themeToggle = document.getElementById('theme-toggle');

// Stats DOM Elements
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statIssues = document.getElementById('stat-issues');
const statAnnouncements = document.getElementById('stat-announcements');

// Modal DOM Elements
const tweetModal = document.getElementById('tweet-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalItemTypeBadge = document.getElementById('modal-item-type-badge');
const modalItemDate = document.getElementById('modal-item-date');
const modalItemTextPreview = document.getElementById('modal-item-text-preview');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const charWarning = document.getElementById('char-warning');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const publishTweetBtn = document.getElementById('publish-tweet-btn');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes(false);
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    resetFiltersBtn.addEventListener('click', resetFilters);
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
    
    // Search input handlers
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFiltersAndRender();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        applyFiltersAndRender();
    });
    
    // Sort handler
    sortSelect.addEventListener('change', (e) => {
        currentSortOrder = e.target.value;
        applyFiltersAndRender();
    });
    
    // Theme toggle handler
    if (themeToggle) {
        // Load preference from localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            themeToggle.checked = true;
            document.body.classList.add('light-theme');
        }
        
        themeToggle.addEventListener('change', () => {
            if (themeToggle.checked) {
                document.body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
                showToast('Switched to Light Mode', 'success');
            } else {
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
                showToast('Switched to Dark Mode', 'success');
            }
        });
    }
    
    // Modal handlers
    closeModalBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });
    
    tweetTextarea.addEventListener('input', updateTweetCharCount);
    
    copyTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        copyToClipboard(text, 'Tweet text copied to clipboard!');
    });
    
    publishTweetBtn.addEventListener('click', () => {
        const text = encodeURIComponent(tweetTextarea.value);
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${text}`;
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        closeTweetModal();
        showToast('Redirected to X/Twitter draft!', 'success');
    });
    
    // ESC key closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tweetModal.style.display === 'flex') {
            closeTweetModal();
        }
    });
}

// Fetch Feed Data from Flask API
async function fetchReleaseNotes(forceRefresh = false) {
    setLoadingState(true);
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch release notes.');
        }
        
        // Save release notes
        releaseNotesData = data.entries;
        
        // Update Feed Info in UI
        if (data.feed_info) {
            document.getElementById('feed-subtitle').textContent = data.feed_info.subtitle || 'Google Cloud BigQuery release updates';
        }
        
        // Update Timestamp
        updateSyncTime(data.updated_at, data.source);
        
        // Calculate category counts and display
        updateStatsAndCategoryList();
        
        // Apply current filter settings and render stream
        applyFiltersAndRender();
        
        showToast(forceRefresh ? 'Refreshed successfully!' : 'Release stream loaded.', 'success');
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showErrorState(error.message);
    } finally {
        setLoadingState(false);
    }
}

// Set Loading UI State
function setLoadingState(isLoading) {
    if (isLoading) {
        spinnerIcon.classList.add('spinning');
        refreshBtn.disabled = true;
        skeletonLoader.style.display = 'block';
        releaseList.style.display = 'none';
        errorState.style.display = 'none';
        emptyState.style.display = 'none';
        
        syncStatusTextEl.textContent = 'Syncing...';
        syncIndicatorEl.className = 'status-indicator syncing';
    } else {
        spinnerIcon.classList.remove('spinning');
        refreshBtn.disabled = false;
        skeletonLoader.style.display = 'none';
        
        syncStatusTextEl.textContent = 'Synced';
        syncIndicatorEl.className = 'status-indicator live';
    }
}

// Show Error UI State
function showErrorState(msg) {
    errorMessage.textContent = msg || 'Could not fetch release notes feed. Please try again.';
    errorState.style.display = 'flex';
    releaseList.style.display = 'none';
    skeletonLoader.style.display = 'none';
    emptyState.style.display = 'none';
}

// Update last updated timestamp in header
function updateSyncTime(timestamp, source) {
    const date = new Date(timestamp * 1000);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    let sourceLabel = '';
    if (source === 'cached') sourceLabel = ' (cached)';
    else if (source === 'live') sourceLabel = ' (live)';
    else if (source === 'error_fallback') sourceLabel = ' (fallback)';
    
    lastUpdatedTimeEl.textContent = `${dateString} at ${timeString}${sourceLabel}`;
}

// Calculate Stats and Render Category list with Counts
function updateStatsAndCategoryList() {
    const categoryCounts = {
        all: 0,
        feature: 0,
        issue: 0,
        announcement: 0,
        deprecated: 0,
        changed: 0,
        resolved: 0,
        other: 0
    };
    
    // Walk through all entries and inner items
    releaseNotesData.forEach(entry => {
        entry.items.forEach(item => {
            categoryCounts.all++;
            
            const typeLower = item.type.toLowerCase();
            if (typeLower.includes('feature')) categoryCounts.feature++;
            else if (typeLower.includes('issue')) categoryCounts.issue++;
            else if (typeLower.includes('announcement')) categoryCounts.announcement++;
            else if (typeLower.includes('deprecated')) categoryCounts.deprecated++;
            else if (typeLower.includes('change')) categoryCounts.changed++;
            else if (typeLower.includes('resolve')) categoryCounts.resolved++;
            else categoryCounts.other++;
        });
    });
    
    // Update Stats Panel UI
    statTotal.textContent = categoryCounts.all;
    statFeatures.textContent = categoryCounts.feature;
    statIssues.textContent = categoryCounts.issue;
    statAnnouncements.textContent = categoryCounts.announcement;
    
    // Re-render Category Sidebar buttons dynamically
    const categoriesList = [
        { key: 'all', label: 'All Categories', count: categoryCounts.all },
        { key: 'feature', label: 'Features', count: categoryCounts.feature },
        { key: 'issue', label: 'Issues', count: categoryCounts.issue },
        { key: 'announcement', label: 'Announcements', count: categoryCounts.announcement },
        { key: 'deprecated', label: 'Deprecated', count: categoryCounts.deprecated },
        { key: 'changed', label: 'Changed', count: categoryCounts.changed },
        { key: 'resolved', label: 'Resolved', count: categoryCounts.resolved },
        { key: 'other', label: 'Other', count: categoryCounts.other }
    ];
    
    categoryFiltersContainer.innerHTML = '';
    categoriesList.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${activeCategory === cat.key ? 'active' : ''}`;
        btn.setAttribute('data-category', cat.key);
        
        btn.innerHTML = `
            <span>${cat.label}</span>
            <span class="badge">${cat.count}</span>
        `;
        
        btn.addEventListener('click', () => {
            // Remove active classes
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = cat.key;
            applyFiltersAndRender();
        });
        
        categoryFiltersContainer.appendChild(btn);
    });
}

// Reset Search & Category Filters
function resetFilters() {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    activeCategory = 'all';
    
    // Set all category button to active
    document.querySelectorAll('.filter-btn').forEach(b => {
        if (b.getAttribute('data-category') === 'all') b.classList.add('active');
        else b.classList.remove('active');
    });
    
    applyFiltersAndRender();
}

// Filter, Sort, and Group data client-side
function applyFiltersAndRender() {
    filteredNotesData = [];
    
    // 1. Filter by Search Query & Category
    releaseNotesData.forEach(entry => {
        const matchingItems = entry.items.filter(item => {
            // Category check
            if (activeCategory !== 'all') {
                const typeLower = item.type.toLowerCase();
                if (activeCategory === 'feature' && !typeLower.includes('feature')) return false;
                if (activeCategory === 'issue' && !typeLower.includes('issue')) return false;
                if (activeCategory === 'announcement' && !typeLower.includes('announcement')) return false;
                if (activeCategory === 'deprecated' && !typeLower.includes('deprecated')) return false;
                if (activeCategory === 'changed' && !typeLower.includes('change')) return false;
                if (activeCategory === 'resolved' && !typeLower.includes('resolve')) return false;
                if (activeCategory === 'other' && (
                    typeLower.includes('feature') || typeLower.includes('issue') || 
                    typeLower.includes('announcement') || typeLower.includes('deprecated') || 
                    typeLower.includes('change') || typeLower.includes('resolve')
                )) return false;
            }
            
            // Search text check
            if (searchQuery) {
                const titleMatch = entry.date.toLowerCase().includes(searchQuery);
                const typeMatch = item.type.toLowerCase().includes(searchQuery);
                const textMatch = item.text.toLowerCase().includes(searchQuery);
                if (!titleMatch && !typeMatch && !textMatch) return false;
            }
            
            return true;
        });
        
        if (matchingItems.length > 0) {
            filteredNotesData.push({
                ...entry,
                items: matchingItems
            });
        }
    });
    
    // 2. Sort the Grouped Dates
    filteredNotesData.sort((a, b) => {
        // Compare dates using Javascript Date
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return currentSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    
    // 3. Render
    renderStream();
}

// Render release stream to DOM
function renderStream() {
    releaseList.innerHTML = '';
    
    if (filteredNotesData.length === 0) {
        releaseList.style.display = 'none';
        emptyState.style.display = 'flex';
        document.getElementById('stream-heading').textContent = `Release Stream (0)`;
        return;
    }
    
    emptyState.style.display = 'none';
    releaseList.style.display = 'block';
    
    let totalItemsDisplayed = 0;
    
    filteredNotesData.forEach(entry => {
        const dayGroup = document.createElement('div');
        dayGroup.className = 'day-group';
        
        // Date Header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'day-date-header';
        dateHeader.textContent = entry.date;
        dayGroup.appendChild(dateHeader);
        
        // Updates for this date
        entry.items.forEach(item => {
            totalItemsDisplayed++;
            const itemCard = document.createElement('article');
            itemCard.className = 'update-item-card';
            
            // Set dynamic border color based on category
            const colorVar = getCategoryColorVar(item.type);
            itemCard.style.setProperty('--border-color', `var(${colorVar})`);
            
            // Get clean css class for category badge
            const badgeClass = getBadgeClass(item.type);
            
            itemCard.innerHTML = `
                <div class="update-item-header">
                    <div class="item-badge-row">
                        <span class="cat-badge ${badgeClass}">${item.type}</span>
                        <span class="item-date-text">${entry.date}</span>
                    </div>
                </div>
                <div class="update-item-body">
                    ${item.html}
                </div>
                <div class="update-item-actions">
                    <button class="item-action-btn copy-link-btn" title="Copy link to this section">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        <span>Copy Link</span>
                    </button>
                    <button class="item-action-btn copy-text-btn" title="Copy content to clipboard">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy to Clipboard</span>
                    </button>
                    <button class="item-action-btn tweet-btn" title="Tweet this release note">
                        <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            `;
            
            // Add click events to actions
            itemCard.querySelector('.copy-link-btn').addEventListener('click', () => {
                copyToClipboard(entry.link, 'Direct section link copied!');
            });
            
            itemCard.querySelector('.copy-text-btn').addEventListener('click', () => {
                copyToClipboard(item.text, 'Content copied to clipboard!');
            });
            
            itemCard.querySelector('.tweet-btn').addEventListener('click', () => {
                openTweetModal(entry, item);
            });
            
            dayGroup.appendChild(itemCard);
        });
        
        releaseList.appendChild(dayGroup);
    });
    
    document.getElementById('stream-heading').textContent = `Release Stream (${totalItemsDisplayed})`;
}

// Helpers for Category Badges
function getCategoryColorVar(type) {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('feature')) return '--cat-feature';
    if (typeLower.includes('issue')) return '--cat-issue';
    if (typeLower.includes('announcement')) return '--cat-announcement';
    if (typeLower.includes('deprecated')) return '--cat-deprecated';
    if (typeLower.includes('change')) return '--cat-changed';
    if (typeLower.includes('resolve')) return '--cat-resolved';
    return '--cat-other';
}

function getBadgeClass(type) {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('feature')) return 'cat-badge-feature';
    if (typeLower.includes('issue')) return 'cat-badge-issue';
    if (typeLower.includes('announcement')) return 'cat-badge-announcement';
    if (typeLower.includes('deprecated')) return 'cat-badge-deprecated';
    if (typeLower.includes('change')) return 'cat-badge-changed';
    if (typeLower.includes('resolve')) return 'cat-badge-resolved';
    return 'cat-badge-other';
}

// Utility to copy to clipboard & show Toast
function copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || 'Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        // Fallback method
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast(successMsg || 'Copied to clipboard!', 'success');
        } catch (e) {
            showToast('Could not copy automatically.', 'error');
        }
        document.body.removeChild(textarea);
    });
}

// Toast Notifications System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconSvg = type === 'success' 
        ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
             <polyline points="22 4 12 14.01 9 11.01"></polyline>
           </svg>`
        : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <circle cx="12" cy="12" r="10"></circle>
             <line x1="12" y1="8" x2="12" y2="12"></line>
             <line x1="12" y1="16" x2="12.01" y2="16"></line>
           </svg>`;
           
    toast.innerHTML = `
        ${iconSvg}
        <span>${message}</span>
        <button class="toast-close">&times;</button>
    `;
    
    // Close button click
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.animation = 'fadeOut 0.2s ease-out forwards';
        setTimeout(() => toast.remove(), 200);
    });
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 3.5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'fadeOut 0.2s ease-out forwards';
            setTimeout(() => toast.remove(), 200);
        }
    }, 3500);
}

// Tweet Modal logic
function openTweetModal(entry, item) {
    activeItemToTweet = { entry, item };
    
    // Setup modal preview elements
    const badgeClass = getBadgeClass(item.type);
    modalItemTypeBadge.className = `preview-label ${badgeClass}`;
    modalItemTypeBadge.textContent = item.type;
    modalItemDate.textContent = entry.date;
    modalItemTextPreview.textContent = item.text;
    
    // Prepare suggested tweet text
    // Example: BigQuery Feature (June 15, 2026): Use Gemini Cloud Assist to analyze SQL... Details: https://docs.cloud.google.com/...
    const dateLabel = entry.date;
    const typeLabel = item.type;
    
    // Format description text cleanly (trim white spaces, limit content)
    let desc = item.text.replace(/\s+/g, ' ').trim();
    
    // Format the URL with section anchors
    const url = entry.link;
    
    // Formulate tweet structure:
    // "🚀 [BigQuery] Feature | Jun 15, 2026\n\nUse Gemini Cloud Assist to analyze your SQL queries...\n\nDetails: https://docs.cloud.google.com/..."
    const prefix = `🚀 [BigQuery] ${typeLabel} (${dateLabel}):\n\n`;
    const suffix = `\n\nDetails: ${url}`;
    
    // Calculate available characters for description
    const totalFixedLength = prefix.length + suffix.length;
    const maxDescLength = 280 - totalFixedLength; // Limit for standard X tweet
    
    let processedDesc = desc;
    if (desc.length > maxDescLength && maxDescLength > 50) {
        processedDesc = desc.substring(0, maxDescLength - 3) + '...';
    }
    
    const defaultTweetText = `${prefix}${processedDesc}${suffix}`;
    
    tweetTextarea.value = defaultTweetText;
    updateTweetCharCount();
    
    // Display Modal
    tweetModal.style.display = 'flex';
    tweetTextarea.focus();
    tweetTextarea.setSelectionRange(0, 0); // Put cursor at start
}

function closeTweetModal() {
    tweetModal.style.display = 'none';
    activeItemToTweet = null;
}

function updateTweetCharCount() {
    const text = tweetTextarea.value;
    const length = text.length;
    
    charCounter.textContent = `${length} / 280`;
    
    if (length > 280) {
        charCounter.classList.add('exceeded');
        charWarning.style.display = 'block';
    } else {
        charCounter.classList.remove('exceeded');
        charWarning.style.display = 'none';
    }
}

// Export Stream data to CSV
function exportToCSV() {
    if (filteredNotesData.length === 0) {
        showToast('No data available to export.', 'error');
        return;
    }
    
    // CSV Header row
    const headers = ['Date', 'Category', 'Direct URL', 'Content Description'];
    let csvRows = [headers.join(',')];
    
    filteredNotesData.forEach(entry => {
        entry.items.forEach(item => {
            // Helper to clean values for CSV compliance (escaping double quotes & flattening linebreaks)
            const clean = (val) => {
                if (val === null || val === undefined) return '""';
                let stringVal = String(val);
                // Double quotes are escaped by doubling them
                stringVal = stringVal.replace(/"/g, '""');
                // Replace hard returns with spaces to keep CSV formatting intact
                stringVal = stringVal.replace(/\r?\n|\r/g, ' ');
                return `"${stringVal}"`;
            };
            
            const row = [
                clean(entry.date),
                clean(item.type),
                clean(entry.link),
                clean(item.text)
            ];
            
            csvRows.push(row.join(','));
        });
    });
    
    const csvContent = csvRows.join('\n');
    
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('CSV file downloaded successfully!', 'success');
    } catch (error) {
        console.error('CSV Export Error:', error);
        showToast('Failed to export CSV.', 'error');
    }
}
