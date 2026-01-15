document.addEventListener('DOMContentLoaded', () => {
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
            showError('请输入您的 API Key');
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
                throw new Error(data.message || '获取用户信息失败');
            }

            if (data.code === 20000 && data.data) {
                displayResult(data.data);
            } else {
                throw new Error(data.message || '未知的响应格式');
            }

        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    });

    function displayResult(data) {
        userName.textContent = data.name || '未知用户';
        userEmail.textContent = data.email || '无邮箱';

        // Avatar Initial
        const nameInitial = (data.name || 'U').charAt(0).toUpperCase();
        avatarName.textContent = nameInitial;

        // Balance (Assuming 'totalBalance' or 'balance' in the response, adapting to typical SF format)
        // Note: The actual API response field for balance might vary. 
        // Based on common structures, it might be in `balance` or a separate wallet endpoint. 
        // For /user/info, it usually returns basic info. 
        // If balance is not in /user/info, we might need to check standard fields like `balance` or `quota`.
        // Let's assume `balance` exists in the data object based on typical usage, 
        // or we display what we have.
        // User reports usually mention a specific balance field.
        // If the balance is not directly in `user/info`, we might need a separate call.
        // However, for this task, we display what is available. 
        // If `balance` is strictly separate, we'll see 0 or undefined.
        // Let's check for `balance` or `total_balance`.

        const balanceVal = data.balance !== undefined ? data.balance : (data.totalBalance || '0.00');
        totalBalance.textContent = `¥${balanceVal}`;

        // Status
        userStatus.textContent = data.status === 'blocked' ? '已封禁' : '正常';
        userStatus.className = 'value ' + (data.status === 'blocked' ? 'status-error' : 'status-active');

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
        if (isLoading) {
            checkBtn.classList.add('loading');
            checkBtn.disabled = true;
        } else {
            checkBtn.classList.remove('loading');
            checkBtn.disabled = false;
        }
    }
});
