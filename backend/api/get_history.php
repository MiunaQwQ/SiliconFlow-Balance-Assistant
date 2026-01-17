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
    $days = isset($_GET['days']) ? intval($_GET['days']) : null;
    $hours = isset($_GET['hours']) ? intval($_GET['hours']) : null;
    
    if (empty($apiKey)) {
        Response::error('API key is required', 400);
    }
    
    // Determine time filter
    if ($hours !== null) {
        // Use hours if specified
        if ($hours < 1) $hours = 2;
        if ($hours > 168) $hours = 168; // Max 7 days
        $timeFilter = "checked_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)";
        $timeParam = $hours;
        $timeUnit = 'hours';
    } else {
        // Fallback to days
        if ($days === null) $days = 7;
        if ($days < 1) $days = 7;
        if ($days > 90) $days = 90;
        $timeFilter = "checked_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
        $timeParam = $days;
        $timeUnit = 'days';
    }
    
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
    
    // Get history data with dynamic time filter
    $history = $db->query(
        "SELECT balance, status, checked_at 
         FROM balance_history 
         WHERE tracked_key_id = ? 
         AND $timeFilter
         ORDER BY checked_at ASC",
        [$trackedKey['id'], $timeParam]
    );

    // Get initial record for percentage calculation
    $initialRecord = $db->queryOne(
        'SELECT balance, checked_at FROM balance_history 
         WHERE tracked_key_id = ? 
         ORDER BY checked_at ASC LIMIT 1',
        [$trackedKey['id']]
    );
    
    Logger::info("Retrieved " . count($history) . " history records for tracked_key_id: {$trackedKey['id']}");
    
    Response::success([
        'is_tracked' => true,
        'tracked_key_id' => $trackedKey['id'],
        'time_unit' => $timeUnit,
        'time_value' => $timeParam,
        'count' => count($history),
        'initial_record' => $initialRecord,
        'history' => $history
    ], 'History data retrieved successfully');
    
} catch (Exception $e) {
    Logger::error('get_history.php error: ' . $e->getMessage());
    Response::error('Failed to retrieve history data', 500);
}
