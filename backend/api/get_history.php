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
    
    // Note: We still return history even if is_active = 0 (manually saved queries)
    // is_active = 1: actively tracked, auto-updated by batch_check.php
    // is_active = 0: manually saved queries, not auto-tracked
    $isActivelyTracked = ($trackedKey['is_active'] == 1);
    
    // Get history data with dynamic time filter
    $history = $db->query(
        "SELECT balance, status, checked_at 
         FROM balance_history 
         WHERE tracked_key_id = ? 
         AND $timeFilter
         ORDER BY checked_at ASC",
        [$trackedKey['id'], $timeParam]
    );

    // Determine check interval based on balance change (look at last 6 minutes of records + predecessors)
    $recentBalances = $db->query(
        "SELECT balance, checked_at 
         FROM balance_history 
         WHERE tracked_key_id = ? 
         ORDER BY checked_at DESC, id DESC 
         LIMIT 15",
        [$trackedKey['id']]
    );

    $intervalMinutes = 5; // Default stable

    if (count($recentBalances) < 2) {
         // Initial phase or sparse data
         $intervalMinutes = 1;
    } else {
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
        $intervalMinutes = $balanceChanged ? 1 : 5;
    }

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
        'is_actively_tracked' => $isActivelyTracked, // true if is_active=1, false if is_active=0
        'tracked_key_id' => $trackedKey['id'],
        'time_unit' => $timeUnit,
        'time_value' => $timeParam,
        'count' => count($history),
        'interval_minutes' => $intervalMinutes, // Added for frontend countdown optimization
        'initial_record' => $initialRecord,
        'history' => $history
    ], 'History data retrieved successfully');
    
} catch (Exception $e) {
    Logger::error('get_history.php error: ' . $e->getMessage());
    Response::error('Failed to retrieve history data', 500);
}
