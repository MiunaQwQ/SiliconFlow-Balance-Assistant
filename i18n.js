const translations = {
    'en': {
        'title': 'SiliconFlow Balance Assistant',
        'subtitle': 'API Balance Checker',
        'placeholder': 'Enter your API Key (sk-...)',
        'checkBtn': 'Check Balance',
        'checking': 'Checking...',
        'totalBalance': 'Total Balance',
        'status': 'Status',
        'userId': 'User ID',
        'statusActive': 'Active',
        'statusBlocked': 'Blocked',
        'errorEmpty': 'Please enter your API Key',
        'errorGeneric': 'Failed to get user info',
        'errorFormat': 'Unknown response format',
        'unknownUser': 'Unknown User',
        'noEmail': 'No Email',
        'errorTitle': 'Error',
        'userNamePersonal': 'Personal'
    },
    'zh-CN': {
        'title': 'SiliconFlow 余额助手',
        'subtitle': 'API 余额查询工具',
        'placeholder': '输入您的 API Key (sk-...)',
        'checkBtn': '查询余额',
        'checking': '查询中...',
        'totalBalance': '总余额',
        'status': '账号状态',
        'userId': '用户 ID',
        'statusActive': '正常',
        'statusBlocked': '已封禁',
        'errorEmpty': '请输入您的 API Key',
        'errorGeneric': '获取用户信息失败',
        'errorFormat': '未知的响应格式',
        'unknownUser': '未知用户',
        'noEmail': '无邮箱',
        'errorTitle': '错误',
        'userNamePersonal': '个人'
    },
    'zh-TW': {
        'title': 'SiliconFlow 餘額助手',
        'subtitle': 'API 餘額查詢工具',
        'placeholder': '輸入您的 API Key (sk-...)',
        'checkBtn': '查詢餘額',
        'checking': '查詢中...',
        'totalBalance': '總餘額',
        'status': '帳號狀態',
        'userId': '用戶 ID',
        'statusActive': '正常',
        'statusBlocked': '已封禁',
        'errorEmpty': '請輸入您的 API Key',
        'errorGeneric': '獲取用户信息失敗',
        'errorFormat': '未知的響應格式',
        'unknownUser': '未知用戶',
        'noEmail': '無郵箱',
        'errorTitle': '錯誤',
        'userNamePersonal': '個人'
    },
    'ja': {
        'title': 'SiliconFlow 残高アシスタント',
        'subtitle': 'API 残高照会ツール',
        'placeholder': 'APIキーを入力してください (sk-...)',
        'checkBtn': '残高確認',
        'checking': '確認中...',
        'totalBalance': '総残高',
        'status': 'ステータス',
        'userId': 'ユーザーID',
        'statusActive': '有効',
        'statusBlocked': '停止中',
        'errorEmpty': 'APIキーを入力してください',
        'errorGeneric': 'ユーザー情報の取得に失敗しました',
        'errorFormat': '不明な応答形式',
        'unknownUser': '不明なユーザー',
        'noEmail': 'メールなし',
        'errorTitle': 'エラー',
        'userNamePersonal': '個人'
    }
};

let currentLang = 'zh-CN'; // Default to zh-CN as per user content context, or detection

function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('sf_lang', lang);
        applyTranslations();
    }
}

function t(key) {
    return translations[currentLang][key] || key;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                element.placeholder = translations[currentLang][key];
            } else {
                // If the element has children (like the button with loader), we need to be careful not to remove the loader.
                // For the button, looking at index.html, it has <span class="btn-text">Check Balance</span>.
                // We should probably put data-i18n on the span.
                element.textContent = translations[currentLang][key];
            }
        }
    });

    // Update HTML lang attribute
    document.documentElement.lang = currentLang;
}

function initLanguage() {
    const savedLang = localStorage.getItem('sf_lang');
    if (savedLang && translations[savedLang]) {
        currentLang = savedLang;
    } else {
        const browserLang = navigator.language;
        if (browserLang.includes('zh-CN') || browserLang.includes('zh-SG')) {
            currentLang = 'zh-CN';
        } else if (browserLang.includes('zh-TW') || browserLang.includes('zh-HK')) {
            currentLang = 'zh-TW';
        } else if (browserLang.includes('ja')) {
            currentLang = 'ja';
        } else {
            currentLang = 'en';
        }
    }

    // Set the selector value if it exists
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        langSelect.value = currentLang;
    }

    applyTranslations();
}
