<?php
/**
 * Get Latest Balance API
 * Retrieves the most recent balance record from database for a tracked API key
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

try {
    $db = Database::getInstance();
    
    // Get API key parameter
    $apiKey = $_GET['api_key'] ?? '';
    
    if (empty($apiKey)) {
        Response::error('API key is required', 400);
    }
    
    // Get tracked key ID
    $apiKeyHash = Crypto::hash($apiKey);
    $trackedKey = $db->queryOne(
        'SELECT id, user_id, is_active FROM tracked_keys WHERE api_key_hash = ?',
        [$apiKeyHash]
    );
    
    if (!$trackedKey) {
        Response::error('API key is not being tracked', 404);
    }
    
    if ($trackedKey['is_active'] == 0) {
        Response::error('Tracking is disabled for this API key', 403);
    }
    
    // Get the most recent balance record
    $latestBalance = $db->queryOne(
        'SELECT balance, status, checked_at 
         FROM balance_history 
         WHERE tracked_key_id = ? 
         ORDER BY checked_at DESC 
         LIMIT 1',
        [$trackedKey['id']]
    );
    
    if (!$latestBalance) {
        Response::error('No balance records found for this API key', 404);
    }
    
    Logger::info("Retrieved latest balance for tracked_key_id: {$trackedKey['id']}");
    
    Response::success([
        'balance' => floatval($latestBalance['balance']),
        'status' => $latestBalance['status'],
        'checked_at' => $latestBalance['checked_at'],
        'user_id' => $trackedKey['user_id']
    ], 'Latest balance retrieved successfully');
    
} catch (Exception $e) {
    Logger::error('get_latest_balance.php error: ' . $e->getMessage());
    Response::error('Failed to retrieve latest balance', 500);
}
