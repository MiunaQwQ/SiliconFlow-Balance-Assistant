/**
 * Admin Dashboard JavaScript
 * Handles fetching and displaying all tracked API keys
 */

// State
let keysData = [];
let lastRefreshTime = null;
let countdownInterval = null;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Initialize page
// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n
    const savedLang = localStorage.getItem('selectedLanguage') || 'zh-CN';
    document.getElementById('langSelect').value = savedLang;
    await setLanguage(savedLang);

    // Check Auth
    checkAuth();
});

// Listen for language changes and re-render cards
window.addEventListener('languageChanged', () => {
    if (keysData.length > 0) {
        renderAllKeys();
    }
});

/**
 * Check if user is authenticated
 */
async function checkAuth() {
    try {
        const response = await fetch('backend/api/check_auth.php?t=' + new Date().getTime(), {
            cache: 'no-store'
        });
        const result = await response.json();

        if (result.success && result.data.is_logged_in) {
            // Logged in, load keys
            document.getElementById('loginModal').classList.add('hidden');
            loadAllKeys();
        } else {
            // Not logged in, show modal
            document.getElementById('loginModal').classList.remove('hidden');
            document.getElementById('loadingState').classList.add('hidden');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // Fallback to showing login modal
        document.getElementById('loginModal').classList.remove('hidden');
        document.getElementById('loadingState').classList.add('hidden');
    }
}

/**
 * Handle Login
 */
async function handleLogin() {
    const passwordInput = document.getElementById('adminPassword');
    const errorMsg = document.getElementById('loginError');
    const loginSpinner = document.getElementById('loginSpinner');
    const password = passwordInput.value;

    if (!password) {
        errorMsg.textContent = 'Please enter password';
        errorMsg.classList.remove('hidden');
        return;
    }

    // Show spinner
    loginSpinner.classList.remove('hidden');
    errorMsg.classList.add('hidden');

    try {
        const response = await fetch('backend/api/login.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: password })
        });

        const result = await response.json();

        if (result.success) {
            // Success
            document.getElementById('loginModal').classList.add('hidden');
            loadAllKeys();
        } else {
            // Error
            errorMsg.textContent = 'Invalid password';
            errorMsg.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Login failed:', error);
        errorMsg.textContent = 'Login failed. Please try again.';
        errorMsg.classList.remove('hidden');
    } finally {
        loginSpinner.classList.add('hidden');
    }
}

/**
 * Fetch all tracked keys from backend
 */
async function loadAllKeys() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const cardsGrid = document.getElementById('cardsGrid');

    try {
        // Show loading
        loadingState.classList.remove('hidden');
        emptyState.classList.add('hidden');
        errorState.classList.add('hidden');
        cardsGrid.classList.add('hidden');

        const response = await fetch('backend/api/get_all_keys.php?t=' + new Date().getTime(), {
            cache: 'no-store'
        });
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch keys');
        }

        keysData = result.data.keys || [];

        // Hide loading
        loadingState.classList.add('hidden');

        // Show empty state if no keys
        if (keysData.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        // Render keys
        renderAllKeys();
        cardsGrid.classList.remove('hidden');

        // Start countdown timer
        // Calculate latest update time from keys to sync countdown
        let maxTime = 0;
        keysData.forEach(key => {
            // Check both fields just in case
            const time = new Date(key.last_update || key.last_checked_at).getTime();
            if (!isNaN(time) && time > maxTime) {
                maxTime = time;
            }
        });

        // Determine base time for countdown
        // If we have valid server data, use it. Otherwise fall back to now.
        const targetTime = maxTime > 0 ? maxTime : Date.now();
        const nextRefresh = targetTime + REFRESH_INTERVAL;

        // Safety check: if data is stale (next refresh should have happened already),
        // don't enter a refresh loop. Instead, wait for the next full interval from now.
        // Allow a small buffer (e.g. 10 seconds) for network latency
        if (nextRefresh <= (Date.now() + 10000)) {
            console.warn('Server data appears stale or out of sync. Defaulting to 5m countdown from now.');
            lastRefreshTime = Date.now();
        } else {
            lastRefreshTime = targetTime;
        }

        startCountdown();

    } catch (error) {
        console.error('Error loading keys:', error);
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('errorMessage').textContent = error.message;
        stopCountdown();
    }
}

/**
 * Render all key cards
 */
function renderAllKeys() {
    const cardsGrid = document.getElementById('cardsGrid');
    cardsGrid.innerHTML = '';

    keysData.forEach(keyData => {
        const card = createKeyCard(keyData);
        cardsGrid.appendChild(card);
    });

    // Apply translations to the newly created elements
    if (typeof applyTranslations === 'function') {
        applyTranslations();
    }
}

/**
 * Create a single key card element
 */
function createKeyCard(keyData) {
    const card = document.createElement('div');
    card.className = 'key-card stats-card';
    card.dataset.keyId = keyData.id;

    // Calculate Stats
    const stats = calculateStats(keyData);

    // Determine color classes based on percentage
    let colorClass = 'text-green';
    let colorHex = '#10b981';
    let bgClass = 'bg-green';

    if (stats.percentage < 20) {
        colorClass = 'text-red';
        colorHex = '#ef4444';
        bgClass = 'bg-red';
    } else if (stats.percentage < 50) {
        colorClass = 'text-orange';
        colorHex = '#f59e0b';
        bgClass = 'bg-orange';
    }

    // Status Logic
    const statusClasses = getStatusClass(keyData.account_status);
    const statusI18n = getStatusI18nKey(keyData.account_status);
    const statusText = formatStatus(keyData.account_status);

    // Prepare key for copy logic
    // We try to use full_key if available (set by PHP for copy functionality), else masked_key
    const keyToCopy = keyData.full_key || keyData.masked_key;
    const clickTitle = t('clickToCopy') || 'Click to copy';

    card.innerHTML = `
        <div class="stats-header">
            <div class="header-info-group">
                <h3 class="chart-title key-title" title="${clickTitle}" onclick="copyKey('${escapeHtml(keyToCopy)}')">
                    ${escapeHtml(keyData.masked_key)}
                    <svg xmlns="http://www.w3.org/2000/svg" class="copy-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-left: 6px; opacity: 0.7;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </h3>
                <span class="user-email-text" title="${escapeHtml(keyData.user_email)}">${escapeHtml(truncateEmail(keyData.user_email))}</span>
            </div>
            <span class="stats-percent-text ${colorClass}">${stats.percentStr}</span>
        </div>

        <div class="stats-main">
            <div class="circular-progress-container">
                <div class="circular-progress" id="circular-${keyData.id}" 
                     style="background: conic-gradient(${colorHex} ${stats.degrees}deg, rgba(255, 255, 255, 0.1) 0deg)">
                </div>
                <div class="inner-circle">
                    <span class="${colorClass}">${stats.percentStr}</span>
                    <span class="circle-label" data-i18n="remaining">remaining</span>
                </div>
            </div>

            <div class="linear-progress-container">
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${bgClass}" id="linear-${keyData.id}" style="width: ${stats.percentage}%"></div>
                </div>
                <div class="progress-labels">
                    <span>0%</span>
                    <span><span data-i18n="used">Used</span>: ${Math.round(100 - stats.percentage)}%</span>
                    <span>100%</span>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-label" data-i18n="updateTime">Update Time</span>
                <span class="stat-value">${formatTimeAgo(keyData.last_update || keyData.last_checked_at)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label" data-i18n="burnRate">Burn Rate</span>
                <span class="stat-value ${stats.burnRateColor}">${stats.burnRateStatus}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label" data-i18n="etaEmpty">ETA Empty</span>
                <span class="stat-value">${stats.etaText}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label" data-i18n="sessionUsed">Total Used</span>
                <span class="stat-value">¥${stats.usedAmount.toFixed(4)}</span>
            </div>
        </div>
        
        <div class="status-indicator-footer">
             <span class="status-badge ${statusClasses}" data-i18n="${statusI18n}">${statusText}</span>
             <span class="balance-badge">¥${keyData.current_balance.toFixed(2)}</span>
        </div>
    `;

    return card;
}

/**
 * Calculate stats for a key (Burn Rate, ETA, etc.)
 */
function calculateStats(keyData) {
    const currentBalance = keyData.current_balance;
    const initialBalance = keyData.initial_balance;

    // Percentage
    let percentage = 100;
    if (initialBalance > 0) {
        percentage = (currentBalance / initialBalance) * 100;
    }
    percentage = Math.max(0, Math.min(100, percentage));

    // Used Amount
    const usedAmount = Math.max(0, initialBalance - currentBalance);

    // Burn Rate & ETA
    const startTimeStr = keyData.initial_check_time || keyData.created_at;
    const endTimeStr = keyData.last_update || keyData.last_checked_at;

    // Burn Rate & ETA - Using Sliding Window (30 minutes)
    let burnRateStatus = t('minimal') || 'Minimal';
    let burnRateColor = 'text-green';
    let etaText = t('safe') || 'Safe';

    // Check if we have recent history from API (added in get_all_keys.php)
    if (keyData.recent_history && Array.isArray(keyData.recent_history) && keyData.recent_history.length >= 2) {
        const recentRecords = keyData.recent_history;
        const windowFirstRecord = recentRecords[0];
        const windowLastRecord = recentRecords[recentRecords.length - 1];

        const windowStartTime = new Date(windowFirstRecord.checked_at).getTime();
        const windowEndTime = new Date(windowLastRecord.checked_at).getTime();
        const windowHoursDiff = (windowEndTime - windowStartTime) / (1000 * 60 * 60);

        if (windowHoursDiff > 0) {
            const windowStartBalance = parseFloat(windowFirstRecord.balance);
            const windowEndBalance = parseFloat(windowLastRecord.balance);
            const recentUsedAmount = windowStartBalance - windowEndBalance;
            const hourlyBurn = recentUsedAmount / windowHoursDiff;

            // Calculate hourly percentage burn based on initial balance
            // If initial balance is 0 or missing, we can't calculate percentage effectively
            if (initialBalance > 0) {
                const hourlyPercentBurn = (hourlyBurn / initialBalance) * 100;

                if (hourlyPercentBurn > 2) {
                    burnRateStatus = t('veryFast') || 'Very Fast';
                    burnRateColor = 'text-red';
                } else if (hourlyPercentBurn > 0.5) {
                    burnRateStatus = t('fast') || 'Fast';
                    burnRateColor = 'text-orange';
                }
            }

            // ETA Calculation
            if (hourlyBurn > 0) {
                const hoursLeft = currentBalance / hourlyBurn;
                if (hoursLeft < 24 * 90) {
                    const totalMinutes = Math.floor(hoursLeft * 60);
                    const days = Math.floor(totalMinutes / (24 * 60));
                    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                    const minutes = Math.floor(totalMinutes % 60);

                    const unitDays = t('days') || 'd';
                    const unitHours = t('hours') || 'h';
                    const unitMinutes = t('minutes') || 'm';

                    if (days > 0) {
                        etaText = `~${days}${unitDays}${hours}${unitHours}`;
                    } else if (hours > 0) {
                        etaText = `~${hours}${unitHours}${minutes}${unitMinutes}`;
                    } else {
                        etaText = `~${minutes}${unitMinutes}`;
                    }
                }
            }
        }
    } else {
        // Fallback: If no recent history (e.g. data gap), verify if overall usage is zero
        // This prevents showing static "safe" if we genuinely don't know, but "minimal" is safe bet for no data
        burnRateStatus = t('minimal') || 'Minimal';
        burnRateColor = 'text-green';
    }

    return {
        percentage,
        percentStr: Math.round(percentage) + '%',
        degrees: percentage * 3.6,
        usedAmount,
        burnRateStatus,
        burnRateColor,
        etaText
    };
}

/**
 * Format time as relative time ago
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return '--';

    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('justNow') || 'Just now';
    if (diffMins < 60) return (t('minutesAgo') || '{0}m ago').replace('{0}', diffMins);
    if (diffHours < 24) return (t('hoursAgo') || '{0}h ago').replace('{0}', diffHours);
    if (diffDays < 7) return (t('daysAgo') || '{0}d ago').replace('{0}', diffDays);

    return time.toLocaleDateString();
}

/**
 * Format account status
 */
function formatStatus(status) {
    if (!status) return 'Unknown';
    const lowerStatus = String(status).toLowerCase();

    // Match logic from script.js: if not blocked, assume active
    if (lowerStatus === 'blocked') {
        return 'Blocked';
    }
    return 'Active';
}

/**
 * Get status CSS class
 */
function getStatusClass(status) {
    if (!status) return 'status-unknown';
    const lowerStatus = String(status).toLowerCase();

    if (lowerStatus === 'blocked') {
        return 'status-error';
    }
    return 'status-active';
}

/**
 * Get status i18n key
 */
function getStatusI18nKey(status) {
    if (!status) return 'statusUnknown';
    const lowerStatus = String(status).toLowerCase();

    if (lowerStatus === 'blocked') {
        return 'statusBlocked';
    }
    return 'statusActive';
}

/**
 * Truncate email for display
 */
function truncateEmail(email) {
    if (!email) return 'N/A';
    if (email.length <= 25) return email;
    return email.substring(0, 22) + '...';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Copy key to clipboard
 */
async function copyKey(key) {
    if (!key) return;

    try {
        await navigator.clipboard.writeText(key);
        showToast(t('copySuccess') || 'Copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = key;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(t('copySuccess') || 'Copied to clipboard!');
        } catch (e) {
            console.error('Fallback copy failed', e);
        }
        document.body.removeChild(textArea);
    }
}

/**
 * Show Toast Notification
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.className = 'toast show';

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

/**
 * Start countdown timer
 */
function startCountdown() {
    const countdownElement = document.getElementById('adminRefreshCountdown');
    const timerElement = document.getElementById('adminRefreshTimer');

    if (!countdownElement || !timerElement) return;

    // Clear any existing interval first (without hiding)
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // Show countdown
    countdownElement.classList.remove('hidden');

    // Update immediately
    updateCountdown();

    // Update every second
    countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Stop countdown timer
 */
function stopCountdown() {
    const countdownElement = document.getElementById('adminRefreshCountdown');

    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (countdownElement) {
        countdownElement.classList.add('hidden');
    }
}

/**
 * Update countdown display
 */
function updateCountdown() {
    const timerElement = document.getElementById('adminRefreshTimer');
    const countdownElement = document.getElementById('adminRefreshCountdown');

    if (!timerElement || !lastRefreshTime) return;

    const now = Date.now();
    const elapsed = now - lastRefreshTime;
    const remaining = REFRESH_INTERVAL - elapsed;

    if (remaining <= 0) {
        // Time to refresh
        loadAllKeys();
        return;
    }

    // Calculate minutes and seconds
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // Update display
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Add warning class if less than 1 minute
    if (countdownElement) {
        if (totalSeconds < 60) {
            countdownElement.classList.add('warning');
        } else {
            countdownElement.classList.remove('warning');
        }
    }
}
