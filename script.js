// Backend API base URL - Update this to your actual backend URL
const BACKEND_URL = window.location.origin + '/backend/api';

let currentApiKey = null;
let balanceChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Language
    if (typeof initLanguage === 'function') {
        initLanguage();
    }

    const apiKeyInput = document.getElementById('apiKey');
    const checkBtn = document.getElementById('checkBtn');
    const resultContainer = document.getElementById('result');
    const errorContainer = document.getElementById('error');
    const errorText = document.getElementById('errorText');

    // UI Elements for Data
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const avatarName = document.getElementById('avatarName');
    const totalBalance = document.getElementById('totalBalance');
    const userStatus = document.getElementById('userStatus');
    const userId = document.getElementById('userId');

    // Tracking elements
    const trackToggle = document.getElementById('trackToggle');
    const historyChart = document.getElementById('historyChart');
    const balanceCanvas = document.getElementById('balanceCanvas');

    // History toggle element
    const historyToggle = document.getElementById('historyToggle');

    // Model list elements
    const modelList = document.getElementById('modelList');
    const modelsLoading = document.getElementById('modelsLoading');
    const modelsContent = document.getElementById('modelsContent');
    const modelsEmpty = document.getElementById('modelsEmpty');

    // Initialize history toggle from localStorage
    const savedHistoryPreference = localStorage.getItem('sf_record_history');
    if (savedHistoryPreference !== null) {
        historyToggle.checked = savedHistoryPreference === 'true';
    }

    checkBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showError(t('errorEmpty'));
            return;
        }

        // Reset UI
        hideError();
        resultContainer.classList.add('hidden');
        historyChart.classList.add('hidden');

        // Hide tracking container
        const trackingContainer = document.getElementById('trackingContainer');
        if (trackingContainer) {
            trackingContainer.classList.add('hidden');
        }

        setLoading(true);

        try {
            const response = await fetch('https://api.siliconflow.cn/v1/user/info', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || t('errorGeneric'));
            }

            if (data.code === 20000 && data.data) {
                currentApiKey = apiKey;
                displayResult(data.data);
                await checkTrackingStatus(apiKey, data.data);
                // Fetch and display supported models
                await fetchModels(apiKey);
                // Save to query history if enabled
                saveQueryHistory(apiKey);
            } else {
                throw new Error(data.message || t('errorFormat'));
            }

        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    });

    // Tracking toggle handler
    trackToggle.addEventListener('change', async (e) => {
        if (!currentApiKey) return;

        const isChecked = e.target.checked;

        try {
            if (isChecked) {
                await enableTracking(currentApiKey);
            } else {
                await disableTracking(currentApiKey);
            }
        } catch (error) {
            console.error('Tracking toggle error:', error);
            // Revert checkbox state on error
            e.target.checked = !isChecked;
            showError(t('trackingError') || 'Failed to update tracking status');
        }
    });

    // Make entire track-control card clickable
    const trackControl = document.querySelector('.track-control');
    if (trackControl) {
        trackControl.addEventListener('click', (e) => {
            // Don't trigger if clicking directly on checkbox or label (they handle it themselves)
            if (e.target === trackToggle || e.target.closest('.track-checkbox')) {
                return;
            }
            // Toggle the checkbox
            trackToggle.click();
        });
    }

    // History toggle handler
    historyToggle.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        localStorage.setItem('sf_record_history', isChecked.toString());
        console.log('Query history recording:', isChecked ? 'enabled' : 'disabled');
        // Update history display
        updateHistoryDisplay();
    });

    // Save query to history
    function saveQueryHistory(apiKey) {
        // Check if history recording is enabled
        const isHistoryEnabled = localStorage.getItem('sf_record_history') === 'true';
        if (!isHistoryEnabled) {
            return;
        }

        // Get existing history
        let history = [];
        try {
            const stored = localStorage.getItem('sf_query_history');
            if (stored) {
                history = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to parse query history:', e);
            history = [];
        }

        // Remove duplicate if exists
        history = history.filter(item => item.key !== apiKey);

        // Add new entry at the beginning
        history.unshift({
            key: apiKey,
            timestamp: new Date().toISOString(),
            // Mask the key for display (show first 8 and last 4 characters)
            display: apiKey.length > 12 ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : apiKey
        });

        // Keep only latest 10 entries
        if (history.length > 10) {
            history = history.slice(0, 10);
        }

        // Save back to localStorage
        try {
            localStorage.setItem('sf_query_history', JSON.stringify(history));
            updateHistoryDisplay();
        } catch (e) {
            console.error('Failed to save query history:', e);
        }
    }

    // Load and display query history
    function updateHistoryDisplay() {
        const isHistoryEnabled = localStorage.getItem('sf_record_history') === 'true';
        const historyContainer = document.getElementById('queryHistoryList');
        const historyListContainer = document.getElementById('queryHistoryContainer');

        if (!historyContainer || !historyListContainer) return;

        // Don't show history if query result is already displayed
        const resultContainer = document.getElementById('result');
        if (resultContainer && !resultContainer.classList.contains('hidden')) {
            historyListContainer.classList.add('hidden');
            return;
        }

        if (!isHistoryEnabled) {
            historyContainer.innerHTML = '';
            historyListContainer.classList.add('hidden');
            return;
        }

        let history = [];
        try {
            const stored = localStorage.getItem('sf_query_history');
            if (stored) {
                history = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load query history:', e);
        }

        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="history-empty" data-i18n="noHistory">No query history yet</p>';
            historyListContainer.classList.remove('hidden');
            return;
        }

        // Build history list
        historyContainer.innerHTML = '';
        historyListContainer.classList.remove('hidden');

        history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            const keyDisplay = document.createElement('div');
            keyDisplay.className = 'history-key';
            keyDisplay.textContent = item.display;

            const timeDisplay = document.createElement('div');
            timeDisplay.className = 'history-time';
            const itemDate = new Date(item.timestamp);
            timeDisplay.textContent = itemDate.toLocaleString(getCurrentLanguage(), {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const useButton = document.createElement('button');
            useButton.className = 'history-use-btn';
            useButton.textContent = t('use') || 'Use';
            useButton.onclick = () => {
                document.getElementById('apiKey').value = item.key;
            };

            const deleteButton = document.createElement('button');
            deleteButton.className = 'history-delete-btn';
            deleteButton.innerHTML = '×';
            deleteButton.onclick = () => {
                deleteHistoryItem(index);
            };

            historyItem.appendChild(keyDisplay);
            historyItem.appendChild(timeDisplay);
            historyItem.appendChild(useButton);
            historyItem.appendChild(deleteButton);
            historyContainer.appendChild(historyItem);
        });
    }

    // Delete a history item
    function deleteHistoryItem(index) {
        try {
            const stored = localStorage.getItem('sf_query_history');
            if (!stored) return;

            let history = JSON.parse(stored);
            history.splice(index, 1);
            localStorage.setItem('sf_query_history', JSON.stringify(history));
            updateHistoryDisplay();
        } catch (e) {
            console.error('Failed to delete history item:', e);
        }
    }

    // Initialize history display on page load
    updateHistoryDisplay();

    // Make entire history-control card clickable
    const historyControl = document.querySelector('.history-control');
    if (historyControl) {
        historyControl.addEventListener('click', (e) => {
            // Don't trigger if clicking directly on checkbox or label (they handle it themselves)
            if (e.target === historyToggle || e.target.closest('.history-checkbox')) {
                return;
            }
            // Toggle the checkbox
            historyToggle.click();
        });
    }

    function displayResult(data) {
        let displayName = data.name || data.username || data.nickname || '';

        // Handle User Name
        if (!displayName) {
            userName.setAttribute('data-i18n', 'unknownUser');
            userName.textContent = t('unknownUser');
            displayName = 'U';
        } else if (displayName === '个人') {
            userName.setAttribute('data-i18n', 'userNamePersonal');
            userName.textContent = t('userNamePersonal');
        } else {
            userName.removeAttribute('data-i18n');
            userName.textContent = displayName;
        }

        // Handle Email
        if (!data.email) {
            userEmail.setAttribute('data-i18n', 'noEmail');
            userEmail.textContent = t('noEmail');
        } else {
            userEmail.removeAttribute('data-i18n');
            userEmail.textContent = data.email;
        }

        // Avatar Initial
        const nameInitial = (displayName === '个人' || displayName.length === 0) ? 'U' : (userName.textContent || 'U').charAt(0).toUpperCase();
        avatarName.textContent = nameInitial;

        // Balance
        const balanceVal = data.balance !== undefined ? data.balance : (data.totalBalance || '0.00');
        totalBalance.textContent = `¥${balanceVal}`;

        // Status
        const statusText = data.status === 'blocked' ? t('statusBlocked') : t('statusActive');
        userStatus.textContent = statusText;
        userStatus.className = 'value ' + (data.status === 'blocked' ? 'status-error' : 'status-active');

        if (data.status === 'blocked') {
            userStatus.setAttribute('data-i18n', 'statusBlocked');
        } else {
            userStatus.setAttribute('data-i18n', 'statusActive');
        }

        userId.textContent = data.id || 'N/A';

        resultContainer.classList.remove('hidden');

        // Hide query history container when showing results
        const historyListContainer = document.getElementById('queryHistoryContainer');
        if (historyListContainer) {
            historyListContainer.classList.add('hidden');
        }

        // Show tracking container
        const trackingContainer = document.getElementById('trackingContainer');
        if (trackingContainer) {
            trackingContainer.classList.remove('hidden');
        }
    }

    async function checkTrackingStatus(apiKey, userData) {
        try {
            const response = await fetch(`${BACKEND_URL}/track_key.php?action=status&api_key=${encodeURIComponent(apiKey)}`);
            const result = await response.json();

            if (result.success && result.data.is_tracked) {
                trackToggle.checked = true;
                await loadBalanceHistory(apiKey);
            } else {
                trackToggle.checked = false;
            }
        } catch (error) {
            console.error('Failed to check tracking status:', error);
            // Silent fail - user can still manually toggle tracking
        }
    }

    async function enableTracking(apiKey) {
        const formData = new FormData();
        formData.append('api_key', apiKey);
        formData.append('user_id', userId.textContent);
        formData.append('user_email', userEmail.textContent);

        const response = await fetch(`${BACKEND_URL}/track_key.php?action=add`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Failed to enable tracking');
        }

        console.log('Tracking enabled successfully');
        // After enabling, try to load history if any exists
        await loadBalanceHistory(apiKey);
    }

    async function disableTracking(apiKey) {
        const formData = new FormData();
        formData.append('api_key', apiKey);

        const response = await fetch(`${BACKEND_URL}/track_key.php?action=remove`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Failed to disable tracking');
        }

        console.log('Tracking disabled successfully');
        historyChart.classList.add('hidden');
    }

    let currentHistoryData = null;
    let lastUpdateTime = null;
    let countdownInterval = null;
    let refreshCountdownElement = null;

    // Initialize countdown element reference after DOM is ready
    function initCountdownElement() {
        if (!refreshCountdownElement) {
            refreshCountdownElement = document.getElementById('refreshTimer');
        }
    }

    // Listen for language changes to update dynamic content
    window.addEventListener('languageChanged', () => {
        // Re-render chart if data exists
        if (currentHistoryData && currentHistoryData.history) {
            renderBalanceChart(currentHistoryData.history);
        }
        // Re-render stats card if data exists
        if (currentHistoryData && currentApiKey) {
            updateStatsCard(currentHistoryData, currentApiKey);
        }
        // Re-render user status in main card if visible
        if (currentApiKey) {
            const statusElement = document.getElementById('userStatus');
            if (statusElement) {
                const isBlocked = statusElement.classList.contains('status-error');
                statusElement.textContent = isBlocked ? t('statusBlocked') : t('statusActive');
            }
        }
    });

    async function refreshAllData() {
        if (!currentApiKey) return;

        try {
            // Fetch fresh user info from SiliconFlow API
            const response = await fetch('https://api.siliconflow.cn/v1/user/info', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.code === 20000 && data.data) {
                // Update main card
                displayResult(data.data);
                // Refresh tracking status and chart
                await checkTrackingStatus(currentApiKey, data.data);
            }
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }

    function updateCountdown() {
        initCountdownElement();
        if (!lastUpdateTime || !refreshCountdownElement) return;

        const now = Date.now();
        const refreshInterval = 5 * 60 * 1000; // 5 minutes in ms
        const nextRefreshTime = lastUpdateTime + refreshInterval;
        const remaining = nextRefreshTime - now;

        // Debug logging (only log occasionally to avoid spam)
        if (Math.random() < 0.05) { // Log ~5% of the time
            console.log('Countdown Debug:', {
                lastUpdateTime,
                now,
                nextRefreshTime,
                remaining,
                remainingSeconds: Math.floor(remaining / 1000)
            });
        }

        if (remaining <= 0) {
            // Time to refresh - refresh entire page data
            refreshAllData();
            return;
        }

        // Calculate minutes and seconds
        const totalSeconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        // Update display
        refreshCountdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Add warning class if less than 1 minute
        if (totalSeconds < 60) {
            refreshCountdownElement.parentElement.classList.add('warning');
        } else {
            refreshCountdownElement.parentElement.classList.remove('warning');
        }
    }

    function startCountdown() {
        initCountdownElement();
        // Clear any existing interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        // Update immediately
        updateCountdown();
        // Then update every second
        countdownInterval = setInterval(updateCountdown, 1000);
    }

    function stopCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    async function loadBalanceHistory(apiKey, days = 7) {
        try {
            const response = await fetch(`${BACKEND_URL}/get_history.php?api_key=${encodeURIComponent(apiKey)}&days=${days}`);
            const result = await response.json();

            if (result.success && result.data.is_tracked && result.data.history.length > 0) {
                currentHistoryData = result.data; // Store for re-rendering
                renderBalanceChart(result.data.history);
                updateStatsCard(result.data, apiKey);
                historyChart.classList.remove('hidden');
                // Get the actual last update time from the latest record
                const latestRecord = result.data.history[result.data.history.length - 1];
                lastUpdateTime = new Date(latestRecord.checked_at).getTime();

                // Debug logging
                console.log('Latest record checked_at:', latestRecord.checked_at);
                console.log('lastUpdateTime (ms):', lastUpdateTime);
                console.log('Current time (ms):', Date.now());
                console.log('Time difference (seconds):', (Date.now() - lastUpdateTime) / 1000);

                startCountdown();
            } else {
                historyChart.classList.add('hidden');
                currentHistoryData = null;
                stopCountdown();
            }
        } catch (error) {
            console.error('Failed to load balance history:', error);
            historyChart.classList.add('hidden');
            currentHistoryData = null;
            stopCountdown();
        }
    }

    function updateStatsCard(data, apiKey) {
        // Elements
        const statsModelName = document.getElementById('statsModelName');
        const statsPercentage = document.getElementById('statsPercentage');
        const circleProgress = document.getElementById('circleProgress');
        const circleText = document.getElementById('circleText');
        const linearProgress = document.getElementById('linearProgress');
        const linearProgressLabel = document.getElementById('linearProgressLabel');
        const statsUpdateTime = document.getElementById('statsUpdateTime');
        const statsUsed = document.getElementById('statsUsed');
        const statsEta = document.getElementById('statsEta');
        // Find Burn Rate element - it has class 'text-green' and data-i18n="minimal" by default
        const statItems = document.querySelectorAll('.stat-item');
        let statsBurnRateValue = null;
        if (statItems.length >= 2) {
            statsBurnRateValue = statItems[1].querySelector('.stat-value');
        }

        // 1. Model Name / User ID
        const currentUserName = document.getElementById('userName').textContent;
        // Check if generic or translated generic
        const isGeneric = currentUserName === 'User Name' || currentUserName === t('userNamePersonal') || currentUserName === t('unknownUser');
        statsModelName.textContent = !isGeneric ? currentUserName : t('trackedKey');

        // 2. Calculate Percentage
        const history = data.history;
        const initialRecord = data.initial_record || history[0];
        const latestRecord = history[history.length - 1];

        const initialBalance = parseFloat(initialRecord.balance);
        const currentBalance = parseFloat(latestRecord.balance);

        let percentage = 100;
        if (initialBalance > 0) {
            percentage = (currentBalance / initialBalance) * 100;
        }
        percentage = Math.max(0, Math.min(100, percentage));
        const percentStr = Math.round(percentage) + '%';

        // Percentage Color Logic
        let colorClass = 'text-green';
        let colorHex = '#10b981'; // Green
        let bgClass = 'bg-green';

        if (percentage < 20) {
            colorClass = 'text-red';
            colorHex = '#ef4444';
            bgClass = 'bg-red';
        } else if (percentage < 50) {
            colorClass = 'text-orange';
            colorHex = '#f59e0b';
            bgClass = 'bg-orange';
        }

        // 3. Update Visuals
        statsPercentage.className = `stats-percent-text ${colorClass}`;
        statsPercentage.textContent = percentStr;

        circleText.className = colorClass;
        circleText.textContent = percentStr;

        // Circular Progress Conic Gradient
        circleProgress.style.background = `conic-gradient(${colorHex} ${percentage * 3.6}deg, rgba(255, 255, 255, 0.1) 0deg)`;

        // Linear Progress
        linearProgress.className = `progress-bar-fill ${bgClass}`;
        linearProgress.style.width = percentage + '%';
        // Translated "Remaining"
        linearProgressLabel.textContent = `${t('remaining')}: ${Math.round(percentage)}%`;

        // 4. Grid Stats & Calculations

        // Burn Rate & ETA - Using Sliding Window (30 minutes)
        const now = new Date().getTime();
        const windowSize = 30 * 60 * 1000; // 30 minutes in milliseconds
        const windowStart = now - windowSize;

        // Filter records within the 48-hour window
        const recentRecords = history.filter(record => {
            const recordTime = new Date(record.checked_at).getTime();
            return recordTime >= windowStart;
        });

        let burnRateStatus = t('minimal');
        let burnRateColor = 'text-green';
        let etaText = t('safe');
        let etaColor = '';

        // Need at least 2 records in the window to calculate rate
        if (recentRecords.length >= 2) {
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
                const hourlyPercentBurn = (hourlyBurn / initialBalance) * 100;

                if (hourlyPercentBurn > 2) {
                    burnRateStatus = t('veryFast');
                    burnRateColor = 'text-red';
                } else if (hourlyPercentBurn > 0.5) {
                    burnRateStatus = t('fast');
                    burnRateColor = 'text-orange';
                }

                // ETA Calculation based on recent burn rate
                if (hourlyBurn > 0) {
                    const hoursLeft = currentBalance / hourlyBurn;
                    // If extremely long (> 90 days), keep 'Safe'
                    if (hoursLeft < 24 * 90) {
                        const totalMinutes = Math.floor(hoursLeft * 60);
                        const days = Math.floor(totalMinutes / (24 * 60));
                        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                        const minutes = Math.floor(totalMinutes % 60);

                        if (days > 0) {
                            // e.g. ~3d5h
                            etaText = `~${days}${t('days')}${hours}${t('hours')}`;
                        } else if (hours > 0) {
                            // e.g. ~2h4m
                            etaText = `~${hours}${t('hours')}${minutes}${t('minutes')}`;
                        } else {
                            // e.g. ~45m
                            etaText = `~${minutes}${t('minutes')}`;
                        }
                    }
                }
            }
        } else {
            // Fallback: if insufficient recent data, use minimal rate
            // This handles cases where tracking just started or very sparse data
            burnRateStatus = t('minimal');
            burnRateColor = 'text-green';
        }

        // Update Time
        const updateDate = new Date(latestRecord.checked_at);
        statsUpdateTime.textContent = updateDate.toLocaleTimeString(getCurrentLanguage(), { hour: '2-digit', minute: '2-digit' });

        // Total Used
        const usedAmount = initialBalance - currentBalance;
        statsUsed.textContent = '¥' + usedAmount.toFixed(4);

        // Apply Burn Rate & ETA
        if (statsBurnRateValue) {
            statsBurnRateValue.textContent = burnRateStatus;
            statsBurnRateValue.className = `stat-value ${burnRateColor}`;
        }
        if (statsEta) {
            statsEta.textContent = etaText;
            // Ensure no color classes are present, just stat-value
            statsEta.className = `stat-value ${etaColor}`;
        }
    }

    function renderBalanceChart(historyData) {
        if (balanceChart) {
            balanceChart.destroy();
        }

        const ctx = balanceCanvas.getContext('2d');

        // Prepare data
        const labels = historyData.map(item => {
            const date = new Date(item.checked_at);
            return date.toLocaleString(getCurrentLanguage(), {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        });

        const balances = historyData.map(item => parseFloat(item.balance));

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(102, 126, 234, 0.4)');
        gradient.addColorStop(1, 'rgba(102, 126, 234, 0.0)');

        balanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: t('balance') || 'Balance',
                    data: balances,
                    borderColor: '#667eea',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#667eea',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function (context) {
                                return `${t('balance') || 'Balance'}: ¥${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            callback: function (value) {
                                return '¥' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    function getCurrentLanguage() {
        const langSelect = document.getElementById('langSelect');
        return langSelect ? langSelect.value : 'zh-CN';
    }

    function showError(message) {
        errorText.textContent = message;
        errorContainer.classList.remove('hidden');
    }

    function hideError() {
        errorContainer.classList.add('hidden');
    }

    function setLoading(isLoading) {
        if (isLoading) {
            checkBtn.classList.add('loading');
            checkBtn.disabled = true;
        } else {
            checkBtn.classList.remove('loading');
            checkBtn.disabled = false;
        }
    }

    // ===== Model List Functions =====

    async function fetchModels(apiKey) {
        try {
            // Show loading state
            modelList.classList.remove('hidden');
            modelsLoading.classList.remove('hidden');
            modelsContent.classList.add('hidden');
            modelsEmpty.classList.add('hidden');

            const response = await fetch(`${BACKEND_URL}/get_models.php?api_key=${encodeURIComponent(apiKey)}`);
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                displayModels(result.data);
            } else {
                // Show empty state
                modelsLoading.classList.add('hidden');
                modelsEmpty.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            // Hide model list on error
            modelList.classList.add('hidden');
        }
    }

    function displayModels(models) {
        // Hide loading, show content
        modelsLoading.classList.add('hidden');
        modelsContent.classList.remove('hidden');

        // Update count
        const modelCountEl = document.getElementById('modelCount');
        if (modelCountEl) {
            modelCountEl.textContent = models.length;
        }

        // Clear previous content
        modelsContent.innerHTML = '';

        // Group models by type for better organization (optional - currently showing all)
        models.forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            // Copy to clipboard on click
            modelItem.onclick = () => {
                copyToClipboard(model.id);
            };

            const modelName = document.createElement('div');
            modelName.className = 'model-name';
            modelName.textContent = model.id || 'Unknown Model';

            const modelMeta = document.createElement('div');
            modelMeta.className = 'model-meta';

            // Detect model type from id (heuristic approach)
            const typeInfo = detectModelType(model.id);

            if (typeInfo.type) {
                const badge = document.createElement('span');
                badge.className = `model-badge badge-${typeInfo.type}`;
                badge.textContent = t(`type${capitalize(typeInfo.type)}`) || typeInfo.type;
                modelMeta.appendChild(badge);
            }

            // Add owner if available
            if (model.owned_by) {
                const owner = document.createElement('span');
                owner.className = 'model-owner';
                owner.textContent = model.owned_by;
                modelMeta.appendChild(owner);
            }

            modelItem.appendChild(modelName);
            modelItem.appendChild(modelMeta);
            modelsContent.appendChild(modelItem);
        });
    }

    async function copyToClipboard(text) {
        // Fallback for non-secure contexts (HTTP) where navigator.clipboard is missing
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;

                // Ensure it's not visible but part of DOM
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);

                textArea.focus();
                textArea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (successful) {
                    showToast(`${t('copied') || 'Copied'}: ${text}`);
                } else {
                    throw new Error('execCommand copy failed');
                }
            } catch (err) {
                console.error('Fallback copy failed: ', err);
                showToast(t('copyFailed') || 'Failed to copy', 'error');
            }
            return;
        }

        // Modern HTTPS approach
        try {
            await navigator.clipboard.writeText(text);
            showToast(`${t('copied') || 'Copied'}: ${text}`);
        } catch (err) {
            console.error('Failed to copy: ', err);
            showToast(t('copyFailed') || 'Failed to copy', 'error');
        }
    }

    let toastTimeout;
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');

        if (!toast || !toastMessage) return;

        toastMessage.textContent = message;

        // Optional: Change color based on type if needed, currently defaulting to green
        if (type === 'error') {
            toast.style.background = 'rgba(239, 68, 68, 0.95)'; // Red
        } else {
            toast.style.background = ''; // Reset to CSS default (Green)
        }

        toast.classList.add('show');

        if (toastTimeout) clearTimeout(toastTimeout);

        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function detectModelType(modelId) {
        if (!modelId) return { type: null };

        const id = modelId.toLowerCase();

        // Image models
        if (id.includes('flux') || id.includes('stable-diffusion') || id.includes('imagen') ||
            id.includes('dalle') || id.includes('midjourney') || id.includes('kolors') ||
            id.includes('wan') && id.includes('x')) {
            return { type: 'image' };
        }

        // Video models
        if (id.includes('video') || id.includes('kling') || id.includes('mochi')) {
            return { type: 'video' };
        }

        // Audio models
        if (id.includes('whisper') || id.includes('audio') || id.includes('speech') ||
            id.includes('fish') || id.includes('cosyvoice') || id.includes('funaudio')) {
            return { type: 'audio' };
        }

        // Default to text (LLMs, chat models, embeddings, etc.)
        return { type: 'text' };
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
});
