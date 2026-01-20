<?php
/**
 * Configuration file for SiliconFlow Balance Tracker
 */

// Load environment variables from .env file
function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
        // Parse KEY=VALUE
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            if (!array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $value;
            }
        }
    }
}

// Load .env file
loadEnv(__DIR__ . '/../.env');

// Database Configuration
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'siliconflow_tracker');
define('DB_USER', $_ENV['DB_USER'] ?? 'root');
define('DB_PASS', $_ENV['DB_PASS'] ?? '');
define('DB_PORT', $_ENV['DB_PORT'] ?? '3306');
define('DB_CHARSET', 'utf8mb4');

// Security Configuration
define('ENCRYPTION_KEY', $_ENV['ENCRYPTION_KEY'] ?? 'change_this_to_random_32_chars');
define('ENCRYPTION_METHOD', 'AES-256-CBC');

// API Configuration
define('SILICONFLOW_API_URL', $_ENV['SILICONFLOW_API_URL'] ?? 'https://api.siliconflow.cn/v1/user/info');

// CORS Configuration
define('CORS_ORIGIN', $_ENV['CORS_ORIGIN'] ?? '*');

// Error Reporting (set to 0 in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

// Timezone
date_default_timezone_set('Asia/Shanghai');

/**
 * Encryption Helper Functions
 */
class Crypto {
    /**
     * Encrypt data using AES-256-CBC
     */
    public static function encrypt($data) {
        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length(ENCRYPTION_METHOD));
        $encrypted = openssl_encrypt($data, ENCRYPTION_METHOD, ENCRYPTION_KEY, 0, $iv);
        return base64_encode($encrypted . '::' . $iv);
    }
    
    /**
     * Decrypt data using AES-256-CBC
     */
    public static function decrypt($data) {
        list($encrypted_data, $iv) = explode('::', base64_decode($data), 2);
        return openssl_decrypt($encrypted_data, ENCRYPTION_METHOD, ENCRYPTION_KEY, 0, $iv);
    }
    
    /**
     * Generate SHA256 hash
     */
    public static function hash($data) {
        return hash('sha256', $data);
    }
}

/**
 * JSON Response Helper Functions
 */
class Response {
    /**
     * Send JSON success response
     */
    public static function success($data = null, $message = 'Success') {
        self::json([
            'success' => true,
            'message' => $message,
            'data' => $data
        ]);
    }
    
    /**
     * Send JSON error response
     */
    public static function error($message = 'Error', $code = 400, $data = null) {
        http_response_code($code);
        self::json([
            'success' => false,
            'message' => $message,
            'data' => $data
        ]);
    }
    
    /**
     * Send JSON response
     */
    private static function json($data) {
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        
        // Handle preflight requests
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
        
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

/**
 * Logger Helper
 */
class Logger {
    private static $logFile = null;
    
    public static function init() {
        $logDir = __DIR__ . '/logs';
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        self::$logFile = $logDir . '/app.log';
    }
    
    public static function log($message, $level = 'INFO') {
        if (self::$logFile === null) {
            self::init();
        }
        
        $timestamp = date('Y-m-d H:i:s');
        $logMessage = "[{$timestamp}] [{$level}] {$message}" . PHP_EOL;
        file_put_contents(self::$logFile, $logMessage, FILE_APPEND);
    }
    
    public static function error($message) {
        self::log($message, 'ERROR');
    }
    
    public static function info($message) {
        self::log($message, 'INFO');
    }
    
    public static function debug($message) {
        self::log($message, 'DEBUG');
    }
}

// Initialize logger
Logger::init();
