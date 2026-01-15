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
        const elapsed = now - lastUpdateTime;
        const refreshInterval = 5 * 60 * 1000; // 5 minutes in ms
        const remaining = refreshInterval - elapsed;

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
                // Update last update time and start countdown
                lastUpdateTime = Date.now();
                startCountdown();
                // Sync heights after render
                setTimeout(syncCardHeights, 100);
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

        // Burn Rate & ETA
        const startTime = new Date(initialRecord.checked_at).getTime();
        const endTime = new Date(latestRecord.checked_at).getTime();
        const hoursDiff = (endTime - startTime) / (1000 * 60 * 60);

        let burnRateStatus = t('minimal');
        let burnRateColor = 'text-green';
        let etaText = t('safe');
        // No dynamic eta color - use default stat-value color
        let etaColor = '';

        if (hoursDiff > 0) {
            const usedAmount = initialBalance - currentBalance;
            const hourlyBurn = usedAmount / hoursDiff;
            // 1% per hour = Fast, 5% per hour = Very Fast
            const hourlyPercentBurn = (hourlyBurn / initialBalance) * 100;

            if (hourlyPercentBurn > 2) {
                burnRateStatus = t('veryFast');
                burnRateColor = 'text-red';
            } else if (hourlyPercentBurn > 0.5) {
                burnRateStatus = t('fast');
                burnRateColor = 'text-orange';
            }

            // ETA Calculation
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

    function syncCardHeights() {
        const card = document.querySelector('.card');
        const sidePanel = document.querySelector('.side-panel');

        // Reset height first
        card.style.minHeight = 'auto';

        if (window.innerWidth >= 1100 && !sidePanel.classList.contains('hidden')) {
            // Get side panel height including its children (Stats + Chart)
            // Note: side-panel is absolute, so its clientHeight should be accurate if content is there
            const sideHeight = sidePanel.offsetHeight;
            const cardHeight = card.offsetHeight;

            // If side panel is taller, stretch card
            if (sideHeight > cardHeight) {
                card.style.minHeight = sideHeight + 'px';
            }
        }
    }

    // Call sync on window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(syncCardHeights, 100);
    });

    // Call sync when chart shows/hides
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'historyChart' || mutation.target.classList.contains('side-panel')) {
                setTimeout(syncCardHeights, 50); // Small delay for rendering
            }
        });
    });

    // Observer config
    observer.observe(historyChart, { attributes: true, attributeFilter: ['class'] });

    function setLoading(isLoading) {
        if (isLoading) {
            checkBtn.classList.add('loading');
            checkBtn.disabled = true;
        } else {
            checkBtn.classList.remove('loading');
            checkBtn.disabled = false;
        }
    }
});
