<?php
/**
 * Get Balance History API
 * Retrieves historical balance data for a tracked API key
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

try {
    $db = Database::getInstance();
    
    // Get parameters
    $apiKey = $_GET['api_key'] ?? '';
    $days = intval($_GET['days'] ?? 7);
    
    if (empty($apiKey)) {
        Response::error('API key is required', 400);
    }
    
    // Limit days to reasonable range
    if ($days < 1) $days = 7;
    if ($days > 90) $days = 90;
    
    // Get tracked key ID
    $apiKeyHash = Crypto::hash($apiKey);
    $trackedKey = $db->queryOne(
        'SELECT id, is_active FROM tracked_keys WHERE api_key_hash = ?',
        [$apiKeyHash]
    );
    
    if (!$trackedKey) {
        Response::success([
            'is_tracked' => false,
            'history' => []
        ], 'API key is not being tracked');
    }
    
    if ($trackedKey['is_active'] == 0) {
        Response::success([
            'is_tracked' => false,
            'history' => []
        ], 'Tracking is disabled for this API key');
    }
    
    // Get history data
    $history = $db->query(
        'SELECT balance, status, checked_at 
         FROM balance_history 
         WHERE tracked_key_id = ? 
         AND checked_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         ORDER BY checked_at ASC',
        [$trackedKey['id'], $days]
    );
    
    Logger::info("Retrieved " . count($history) . " history records for tracked_key_id: {$trackedKey['id']}");
    
    Response::success([
        'is_tracked' => true,
        'tracked_key_id' => $trackedKey['id'],
        'days' => $days,
        'count' => count($history),
        'history' => $history
    ], 'History data retrieved successfully');
    
} catch (Exception $e) {
    Logger::error('get_history.php error: ' . $e->getMessage());
    Response::error('Failed to retrieve history data', 500);
}
