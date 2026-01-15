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

    async function loadBalanceHistory(apiKey, days = 7) {
        try {
            const response = await fetch(`${BACKEND_URL}/get_history.php?api_key=${encodeURIComponent(apiKey)}&days=${days}`);
            const result = await response.json();

            if (result.success && result.data.is_tracked && result.data.history.length > 0) {
                renderBalanceChart(result.data.history);
                historyChart.classList.remove('hidden');
            } else {
                historyChart.classList.add('hidden');
            }
        } catch (error) {
            console.error('Failed to load balance history:', error);
            historyChart.classList.add('hidden');
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
});
