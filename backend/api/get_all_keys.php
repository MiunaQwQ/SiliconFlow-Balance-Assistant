<?php
/**
 * Get All Keys API
 * Retrieves all tracked API keys with their latest balance information
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

try {
    $db = Database::getInstance();

    // Check Authentication
    session_start();
    if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        Response::error('Unauthorized', 401);
    }
    
    // Query all tracked keys with their latest balance information
    // Compatible with MySQL 5.7+ (doesn't use window functions)
    $query = "
        SELECT 
            tk.id,
            tk.api_key_encrypted,
            tk.user_id,
            tk.user_email,
            tk.is_active,
            tk.created_at,
            tk.last_checked_at,
            (SELECT balance FROM balance_history 
             WHERE tracked_key_id = tk.id 
             ORDER BY checked_at DESC LIMIT 1) as current_balance,
            (SELECT status FROM balance_history 
             WHERE tracked_key_id = tk.id 
             ORDER BY checked_at DESC LIMIT 1) as account_status,
            (SELECT checked_at FROM balance_history 
             WHERE tracked_key_id = tk.id 
             ORDER BY checked_at DESC LIMIT 1) as last_update,
            (SELECT balance FROM balance_history 
             WHERE tracked_key_id = tk.id 
             ORDER BY checked_at ASC LIMIT 1) as initial_balance,
            (SELECT checked_at FROM balance_history 
             WHERE tracked_key_id = tk.id 
             ORDER BY checked_at ASC LIMIT 1) as initial_check_time
        FROM tracked_keys tk
        WHERE tk.is_active = 1
        ORDER BY tk.last_checked_at DESC
    ";
    
    $keys = $db->query($query);
    
    // Process each key to mask the API key and calculate percentage
    $processedKeys = array_map(function($key) use ($db) {
        // Decrypt and mask API key
        $decryptedKey = Crypto::decrypt($key['api_key_encrypted']);
        $maskedKey = maskApiKey($decryptedKey);
        
        // Calculate percentage remaining
        $percentage = 100;
        if ($key['initial_balance'] && $key['initial_balance'] > 0) {
            $percentage = round(($key['current_balance'] / $key['initial_balance']) * 100, 2);
        }
        
        // Calculate usage
        $used = 0;
        if ($key['initial_balance'] && $key['current_balance']) {
            $used = $key['initial_balance'] - $key['current_balance'];
        }
        
        // Fetch recent 24-hour history for burn rate and usage calculation
        $recentHistoryQuery = "
            SELECT balance, checked_at
            FROM balance_history
            WHERE tracked_key_id = :key_id
            AND checked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY checked_at ASC
        ";
        $recentHistory = $db->query($recentHistoryQuery, ['key_id' => $key['id']]);
        
        // Determine if balance is changing (look at last 6 minutes of records + predecessors)
        $recentBalances = $db->query(
            "SELECT balance, checked_at 
             FROM balance_history 
             WHERE tracked_key_id = ? 
             ORDER BY checked_at DESC, id DESC 
             LIMIT 15",
            [$key['id']]
        );
        
        $isChanging = false;
        
        if (count($recentBalances) < 2) {
             // If less than 2 records in total (or very recent), consider it changing (initial phase or sparse data)
             $isChanging = true;
        } else {
            $thresholdTime = time() - (6 * 60); // 6 minutes ago
            
            // Iterate through records to find any change occurring within the time window
            for ($i = 0; $i < count($recentBalances) - 1; $i++) {
                $currentRecord = $recentBalances[$i];
                $prevRecord = $recentBalances[$i + 1];
                
                // If the current record is older than 6 minutes, we stop looking
                if (strtotime($currentRecord['checked_at']) < $thresholdTime) {
                    break;
                }
                
                // Compare current record with the previous one
                if ($currentRecord['balance'] != $prevRecord['balance']) {
                    $isChanging = true;
                    break;
                }
            }
        }

        return [
            'id' => $key['id'],
            'full_key' => $decryptedKey, // Decrypted key for copy functionality
            'masked_key' => $maskedKey,
            'user_id' => $key['user_id'],
            'user_email' => $key['user_email'],
            'current_balance' => floatval($key['current_balance'] ?? 0),
            'initial_balance' => floatval($key['initial_balance'] ?? 0),
            'used' => floatval($used),
            'percentage' => floatval($percentage),
            'account_status' => $key['account_status'] ?? 'unknown',
            'last_checked_at' => $key['last_checked_at'],
            'last_update' => $key['last_update'],
            'initial_check_time' => $key['initial_check_time'],
            'created_at' => $key['created_at'],
            'balance_changing' => $isChanging, // Added for frontend countdown optimization
            'recent_history' => $recentHistory // 30-minute history for burn rate
        ];
    }, $keys);
    
    Logger::info("Retrieved " . count($processedKeys) . " tracked keys");
    
    // Get last batch check time for countdown synchronization
    $batchCheckTime = $db->queryOne(
        "SELECT status_value as last_batch_check FROM system_status WHERE status_key = 'last_batch_check'"
    );
    
    Response::success([
        'count' => count($processedKeys),
        'keys' => $processedKeys,
        'last_batch_check' => $batchCheckTime['last_batch_check'] ?? null
    ], 'All tracked keys retrieved successfully');
    
} catch (Exception $e) {
    Logger::error('get_all_keys.php error: ' . $e->getMessage());
    Response::error('Failed to retrieve tracked keys', 500);
}

/**
 * Mask API key for display
 * Shows first 7 chars (sk-) and last 4 chars, masks the rest
 */
function maskApiKey($apiKey) {
    if (strlen($apiKey) <= 11) {
        return $apiKey; // Too short to mask safely
    }
    
    $prefix = substr($apiKey, 0, 7); // "sk-xxxx"
    $suffix = substr($apiKey, -4);   // Last 4 chars
    $middle = str_repeat('*', 8);    // 8 asterisks
    
    return $prefix . $middle . $suffix;
}
