<?php
/**
 * Save Query API
 * Saves individual API key query results to the database
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

try {
    $db = Database::getInstance();
    
    // Get POST data
    $apiKey = $_POST['api_key'] ?? '';
    $userId = $_POST['user_id'] ?? null;
    $userEmail = $_POST['user_email'] ?? null;
    $balance = $_POST['balance'] ?? null;
    $status = $_POST['status'] ?? 'active';
    
    // Validate required fields
    if (empty($apiKey)) {
        Response::error('API key is required', 400);
    }
    
    if ($balance === null) {
        Response::error('Balance data is required', 400);
    }
    
    // Generate hash for API key
    $apiKeyHash = Crypto::hash($apiKey);
    
    // Check if this API key exists in tracked_keys
    $trackedKey = $db->queryOne(
        'SELECT id, is_active FROM tracked_keys WHERE api_key_hash = ?',
        [$apiKeyHash]
    );
    
    $trackedKeyId = null;
    
    if ($trackedKey) {
        // Key exists, use its ID
        $trackedKeyId = $trackedKey['id'];
        Logger::info("Using existing tracked_key_id: {$trackedKeyId} for manual query save");
    } else {
        // Key doesn't exist, create a new entry with is_active = 0 (manual query, not auto-tracked)
        $apiKeyEncrypted = Crypto::encrypt($apiKey);
        
        $db->execute(
            'INSERT INTO tracked_keys (api_key_hash, api_key_encrypted, user_id, user_email, is_active, created_at) 
             VALUES (?, ?, ?, ?, 0, NOW())',
            [$apiKeyHash, $apiKeyEncrypted, $userId, $userEmail]
        );
        
        $trackedKeyId = $db->lastInsertId();
        Logger::info("Created new tracked_key_id: {$trackedKeyId} for manual query save (is_active=0)");
    }
    
    // Insert balance history record
    $db->execute(
        'INSERT INTO balance_history (tracked_key_id, balance, status, checked_at) 
         VALUES (?, ?, ?, NOW())',
        [$trackedKeyId, $balance, $status]
    );
    
    $historyId = $db->lastInsertId();
    
    Logger::info("Saved query data to balance_history, ID: {$historyId}, tracked_key_id: {$trackedKeyId}");
    
    Response::success([
        'history_id' => $historyId,
        'tracked_key_id' => $trackedKeyId,
        'balance' => $balance,
        'status' => $status
    ], 'Query data saved successfully');
    
} catch (Exception $e) {
    Logger::error('save_query.php error: ' . $e->getMessage());
    Response::error('Failed to save query data: ' . $e->getMessage(), 500);
}
