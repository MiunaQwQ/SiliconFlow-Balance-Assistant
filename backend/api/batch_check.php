<?php
/**
 * Batch Check API
 * For scheduled tasks to check all tracked API keys and record balance history
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

try {
    $db = Database::getInstance();
    
    Logger::info('Starting batch check process');
    
    // Get all active tracked keys
    $trackedKeys = $db->query(
        'SELECT id, api_key_encrypted, user_id FROM tracked_keys WHERE is_active = 1'
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
        'details' => []
    ];
    
    // Process each tracked key
    foreach ($trackedKeys as $trackedKey) {
        $trackedKeyId = $trackedKey['id'];
        $apiKey = Crypto::decrypt($trackedKey['api_key_encrypted']);
        
        try {
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
            
        } catch (Exception $e) {
            $results['failed']++;
            $results['details'][] = [
                'tracked_key_id' => $trackedKeyId,
                'status' => 'error',
                'error' => $e->getMessage()
            ];
            
            Logger::error("Error checking balance for tracked_key_id {$trackedKeyId}: " . $e->getMessage());
        }
        
        // Small delay to avoid rate limiting
        usleep(500000); // 0.5 second delay
    }
    
    Logger::info("Batch check completed. Success: {$results['success']}, Failed: {$results['failed']}");
    
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
