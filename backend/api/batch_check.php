<?php
/**
 * Batch Check API
 * For scheduled tasks to check all tracked API keys and record balance history
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

try {
    set_time_limit(0);
    $db = Database::getInstance();
    
    Logger::info('Starting batch check process');
    
    // Get all active tracked keys
    $trackedKeys = $db->query(
        'SELECT id, api_key_encrypted, user_id, last_checked_at FROM tracked_keys WHERE is_active = 1'
    );
    
    if (empty($trackedKeys)) {
        Logger::info('No active tracked keys found');
        Response::success([
            'total' => 0,
            'success' => 0,
            'failed' => 0,
            'results' => []
        ], 'No active tracked keys to check');
    }
    
    $results = [
        'total' => count($trackedKeys),
        'success' => 0,
        'failed' => 0,
        'skipped' => 0,
        'details' => []
    ];
    
    // Process each tracked key
    foreach ($trackedKeys as $trackedKey) {
        $trackedKeyId = $trackedKey['id'];
        $apiKey = Crypto::decrypt($trackedKey['api_key_encrypted']);
        
        try {
            // Check if we should skip this key based on balance change and time
            $shouldCheck = shouldCheckBalance($db, $trackedKeyId, $trackedKey['last_checked_at']);
            
            if (!$shouldCheck) {
                $results['skipped']++;
                Logger::info("Skipping check for tracked_key_id: {$trackedKeyId} (within interval)");
                continue;
            }
            
            // Call SiliconFlow API
            $balance = checkSiliconFlowBalance($apiKey);
            
            if ($balance !== null) {
                // Insert balance history record
                $db->execute(
                    'INSERT INTO balance_history (tracked_key_id, balance, status, checked_at) 
                     VALUES (?, ?, ?, NOW())',
                    [$trackedKeyId, $balance['balance'], $balance['status']]
                );
                
                // Auto-disable tracking if balance is zero or negative
                if ($balance['balance'] <= 0) {
                    $db->execute(
                        'UPDATE tracked_keys SET is_active = 0, last_checked_at = NOW() WHERE id = ?',
                        [$trackedKeyId]
                    );
                    Logger::info("Auto-disabled tracking for tracked_key_id: {$trackedKeyId} (balance is zero)");
                } else {
                    // Update last_checked_at normally
                    $db->execute(
                        'UPDATE tracked_keys SET last_checked_at = NOW() WHERE id = ?',
                        [$trackedKeyId]
                    );
                }
                
                $results['success']++;
                $results['details'][] = [
                    'tracked_key_id' => $trackedKeyId,
                    'status' => 'success',
                    'balance' => $balance['balance']
                ];
                
                Logger::info("Successfully checked balance for tracked_key_id: {$trackedKeyId}");
            } else {
                $results['failed']++;
                $results['details'][] = [
                    'tracked_key_id' => $trackedKeyId,
                    'status' => 'failed',
                    'error' => 'Failed to retrieve balance'
                ];
                
                Logger::error("Failed to check balance for tracked_key_id: {$trackedKeyId}");
            }
            
            // Small delay to avoid rate limiting (only after actual API call)
            usleep(500000); // 0.5 second delay
            
        } catch (Exception $e) {
            $results['failed']++;
            $results['details'][] = [
                'tracked_key_id' => $trackedKeyId,
                'status' => 'error',
                'error' => $e->getMessage()
            ];
            
            Logger::error("Error checking balance for tracked_key_id {$trackedKeyId}: " . $e->getMessage());
            
            // Small delay to avoid rate limiting (only after actual API call)
            usleep(500000); // 0.5 second delay
        }
    }
    
    Logger::info("Batch check completed. Total: {$results['total']}, Success: {$results['success']}, Failed: {$results['failed']}, Skipped: {$results['skipped']}");
    
    // Record batch check execution time for countdown synchronization
    try {
        $db->execute(
            "INSERT INTO system_status (status_key, status_value, updated_at) 
             VALUES ('last_batch_check', NOW(), NOW())
             ON DUPLICATE KEY UPDATE status_value = NOW(), updated_at = NOW()"
        );
        Logger::info("Recorded batch check execution time");
    } catch (Exception $e) {
        Logger::error("Failed to record batch check time: " . $e->getMessage());
        // Don't fail the entire batch if this fails
    }
    
    Response::success($results, 'Batch check completed');
    
} catch (Exception $e) {
    Logger::error('Batch check error: ' . $e->getMessage());
    Response::error('Batch check failed', 500);
}


/**
 * Determine if we should check balance for this key based on:
 * - If balance has changed between last two checks: check every 1 minute
 * - If balance is stable: check every 5 minutes
 * 
 * @param Database $db Database instance
 * @param int $trackedKeyId Tracked key ID
 * @param string|null $lastCheckedAt Last check timestamp
 * @return bool Whether to check balance now
 */
function shouldCheckBalance($db, $trackedKeyId, $lastCheckedAt) {
    // If never checked before, always check
    if (empty($lastCheckedAt)) {
        return true;
    }
    
    // Get recent balance records (fetch enough to cover 6 minutes + predecessors)
    // Assuming max check frequency is 30s, 6 mins = 12 records. LIMIT 15 is safe.
    $recentBalances = $db->query(
        'SELECT balance, checked_at 
         FROM balance_history 
         WHERE tracked_key_id = ? 
         ORDER BY checked_at DESC, id DESC 
         LIMIT 15',
        [$trackedKeyId]
    );
    
    // If less than 2 records, we need more data -> check frequently
    if (count($recentBalances) < 2) {
        return true;
    }
    
    $thresholdTime = time() - (6 * 60); // 6 minutes ago
    $balanceChanged = false;
    
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
            $balanceChanged = true;
            break;
        }
    }
    
    // Calculate minutes since last check (for stable logging)
    $lastCheckedTime = strtotime($lastCheckedAt);
    $currentTime = time();
    $minutesSinceLastCheck = ($currentTime - $lastCheckedTime) / 60;
    
    // Decision logic:
    // - If balance changed recently: check if >= 1 minute has passed
    // - If balance stable: check if >= 5 minutes has passed
    if ($balanceChanged) {
        // Balance is changing, check every 1 minute
        $shouldCheck = $minutesSinceLastCheck >= 1;
        if (!$shouldCheck) {
            Logger::debug("Balance changing for tracked_key_id {$trackedKeyId}, but only {$minutesSinceLastCheck} minutes since last check (need 1 min)");
        }
        return $shouldCheck;
    } else {
        // Balance is stable, check every 5 minutes
        $shouldCheck = $minutesSinceLastCheck >= 5;
        if (!$shouldCheck) {
            Logger::debug("Balance stable for tracked_key_id {$trackedKeyId}, only {$minutesSinceLastCheck} minutes since last check (need 5 min)");
        }
        return $shouldCheck;
    }
}

/**
 * Check balance from SiliconFlow API
 */

function checkSiliconFlowBalance($apiKey) {
    $ch = curl_init();
    
    curl_setopt_array($ch, [
        CURLOPT_URL => SILICONFLOW_API_URL,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    if ($error) {
        Logger::error("cURL error: {$error}");
        return null;
    }
    
    if ($httpCode !== 200) {
        Logger::error("HTTP error: {$httpCode}, Response: {$response}");
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (!$data || $data['code'] !== 20000 || !isset($data['data'])) {
        Logger::error("Invalid API response: {$response}");
        return null;
    }
    
    $userData = $data['data'];
    
    return [
        'balance' => $userData['balance'] ?? $userData['totalBalance'] ?? 0,
        'status' => $userData['status'] ?? 'active'
    ];
}
