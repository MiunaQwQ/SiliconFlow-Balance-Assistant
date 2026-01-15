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

    checkBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showError(t('errorEmpty'));
            return;
        }

        // Reset UI
        hideError();
        resultContainer.classList.add('hidden');
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
                // Handle API specific errors
                throw new Error(data.message || t('errorGeneric'));
            }

            if (data.code === 20000 && data.data) {
                displayResult(data.data);
            } else {
                throw new Error(data.message || t('errorFormat'));
            }

        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    });

    function displayResult(data) {
        let displayName = data.name || t('unknownUser');
        if (displayName === '个人') {
            displayName = t('userNamePersonal');
        }

        userName.textContent = displayName;
        userEmail.textContent = data.email || t('noEmail');

        // Avatar Initial
        const nameInitial = (displayName === t('unknownUser') ? 'U' : displayName.charAt(0)).toUpperCase();
        avatarName.textContent = nameInitial;

        // Balance
        const balanceVal = data.balance !== undefined ? data.balance : (data.totalBalance || '0.00');
        totalBalance.textContent = `¥${balanceVal}`;

        // Status
        const statusText = data.status === 'blocked' ? t('statusBlocked') : t('statusActive');
        userStatus.textContent = statusText;
        userStatus.className = 'value ' + (data.status === 'blocked' ? 'status-error' : 'status-active');
        // Add data-i18n for status if it matches standard keys, but since it's dynamic based on value, 
        // we set textContent directly. We could use setAttribute('data-i18n', ...) if we wanted dynamic updates 
        // when language changes while result is shown, but for now we'll just set text.
        // To support dynamic language switch while result is open, we can store the status in a dataset or variable
        // and re-render. Ideally `applyTranslations` could handle this if we set a specific attribute.
        // For simplicity, we might just leave it as textContent. 
        // Better yet: set data-i18n attribute dynamically so language switch effects it immediately.
        if (data.status === 'blocked') {
            userStatus.setAttribute('data-i18n', 'statusBlocked');
        } else {
            userStatus.setAttribute('data-i18n', 'statusActive');
        }

        userId.textContent = data.id || 'N/A';

        resultContainer.classList.remove('hidden');
    }

    function showError(message) {
        errorText.textContent = message;
        errorContainer.classList.remove('hidden');
    }

    function hideError() {
        errorContainer.classList.add('hidden');
    }

    function setLoading(isLoading) {
        // When finding checkBtn, we need to be careful if we replaced its content or text.
        // The HTML structure is <button><span class="btn-text">Check Balance</span><span class="btn-loader"></span></button>
        // We only change class on button.
        if (isLoading) {
            checkBtn.classList.add('loading');
            checkBtn.disabled = true;
        } else {
            checkBtn.classList.remove('loading');
            checkBtn.disabled = false;
        }
    }
});
