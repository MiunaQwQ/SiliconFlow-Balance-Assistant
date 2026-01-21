<?php
/**
 * Get Keys by History List
 * This endpoint accepts a list of API keys from client history
 * and returns only the tracked data for those specific keys.
 * This prevents data leakage in history-view mode.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

try {
    // Get JSON input
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!isset($data['keys']) || !is_array($data['keys'])) {
        Response::error('Invalid request. Expected JSON with "keys" array.', 400);
    }

    $historyKeys = $data['keys'];

    // Validate that we have keys to query
    if (empty($historyKeys)) {
        Response::success([
            'keys' => [],
            'count' => 0
        ], 'No keys provided');
    }

    // Sanitize keys - only keep non-empty strings
    $historyKeys = array_filter($historyKeys, function($key) {
        return is_string($key) && strlen(trim($key)) > 0;
    });

    if (empty($historyKeys)) {
        Response::success([
            'keys' => [],
            'count' => 0
        ], 'No valid keys after filtering');
    }

    $db = Database::getInstance();

    // Build query to find tracked keys that match the history list
    // We need to decrypt and compare since API keys are encrypted in database
    $allTrackedKeys = $db->query("
        SELECT 
            id,
            api_key_encrypted,
            user_id,
            user_email,
            is_active,
            created_at,
            last_checked_at,
            (SELECT balance FROM balance_history 
             WHERE tracked_key_id = tracked_keys.id 
             ORDER BY checked_at DESC LIMIT 1) as current_balance,
            (SELECT status FROM balance_history 
             WHERE tracked_key_id = tracked_keys.id 
             ORDER BY checked_at DESC LIMIT 1) as account_status,
            (SELECT checked_at FROM balance_history 
             WHERE tracked_key_id = tracked_keys.id 
             ORDER BY checked_at DESC LIMIT 1) as last_update,
            (SELECT balance FROM balance_history 
             WHERE tracked_key_id = tracked_keys.id 
             ORDER BY checked_at ASC LIMIT 1) as initial_balance,
            (SELECT checked_at FROM balance_history 
             WHERE tracked_key_id = tracked_keys.id 
             ORDER BY checked_at ASC LIMIT 1) as initial_check_time
        FROM tracked_keys
        WHERE is_active = 1
        ORDER BY last_checked_at DESC
    ");

    // Filter to only keys in history list by decrypting and comparing
    $matchedKeys = [];
    foreach ($allTrackedKeys as $trackedKey) {
        $decryptedKey = Crypto::decrypt($trackedKey['api_key_encrypted']);
        
        // Check if this decrypted key is in the history list
        if (in_array($decryptedKey, $historyKeys, true)) {
            // Fetch recent history (last 24 hours) for usage calculation
            $recentHistoryQuery = "
                SELECT balance, checked_at
                FROM balance_history
                WHERE tracked_key_id = :key_id
                AND checked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                ORDER BY checked_at ASC
            ";
            $recentHistory = $db->query($recentHistoryQuery, ['key_id' => $trackedKey['id']]);

            // Mask the API key for display
            $maskedKey = maskApiKey($decryptedKey);

            // Determine if balance is changing (look at last 6 minutes of records + predecessors)
            $recentBalances = $db->query(
                "SELECT balance, checked_at 
                 FROM balance_history 
                 WHERE tracked_key_id = ? 
                 ORDER BY checked_at DESC, id DESC 
                 LIMIT 15",
                [$trackedKey['id']]
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

            $matchedKeys[] = [
                'id' => $trackedKey['id'],
                'masked_key' => $maskedKey,
                'full_key' => $decryptedKey, // Include full key for client-side copy
                'user_id' => $trackedKey['user_id'],
                'user_email' => $trackedKey['user_email'] ?? 'N/A',
                'account_status' => $trackedKey['account_status'] ?? 'active',
                'current_balance' => floatval($trackedKey['current_balance'] ?? 0),
                'initial_balance' => floatval($trackedKey['initial_balance'] ?? 0),
                'initial_check_time' => $trackedKey['initial_check_time'],
                'last_update' => $trackedKey['last_update'],
                'last_checked_at' => $trackedKey['last_update'], // Alias for compatibility
                'is_active' => (bool)$trackedKey['is_active'],
                'created_at' => $trackedKey['created_at'],
                'balance_changing' => $isChanging, // Added for frontend countdown optimization
                'recent_history' => $recentHistory
            ];
        }
    }

    Logger::info("History view mode: Retrieved " . count($matchedKeys) . " matched keys from " . count($historyKeys) . " history keys");

    // Get last batch check time for countdown synchronization
    $batchCheckTime = $db->queryOne(
        "SELECT status_value as last_batch_check FROM system_status WHERE status_key = 'last_batch_check'"
    );

    Response::success([
        'keys' => $matchedKeys,
        'count' => count($matchedKeys),
        'last_batch_check' => $batchCheckTime['last_batch_check'] ?? null
    ], 'Keys retrieved successfully');

} catch (Exception $e) {
    Logger::error('get_history_keys.php error: ' . $e->getMessage());
    Response::error('Failed to retrieve keys', 500);
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
