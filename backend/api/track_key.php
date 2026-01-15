<?php
/**
 * API Key Tracking Management API
 * Handles adding and removing API keys from tracking
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

// Get action parameter
$action = $_GET['action'] ?? '';

try {
    $db = Database::getInstance();
    
    switch ($action) {
        case 'add':
            addTracking($db);
            break;
            
        case 'remove':
            removeTracking($db);
            break;
            
        case 'status':
            checkStatus($db);
            break;
            
        default:
            Response::error('Invalid action. Use: add, remove, or status', 400);
    }
    
} catch (Exception $e) {
    Logger::error('track_key.php error: ' . $e->getMessage());
    Response::error('Server error occurred', 500);
}

/**
 * Add API key to tracking
 */
function addTracking($db) {
    // Get POST data
    $apiKey = $_POST['api_key'] ?? '';
    $userId = $_POST['user_id'] ?? null;
    $userEmail = $_POST['user_email'] ?? null;
    
    if (empty($apiKey)) {
        Response::error('API key is required', 400);
    }
    
    // Generate hash for uniqueness check
    $apiKeyHash = Crypto::hash($apiKey);
    
    // Check if already tracked
    $existing = $db->queryOne(
        'SELECT id, is_active FROM tracked_keys WHERE api_key_hash = ?',
        [$apiKeyHash]
    );
    
    if ($existing) {
        // Already exists, update if inactive
        if ($existing['is_active'] == 0) {
            $db->execute(
                'UPDATE tracked_keys SET is_active = 1 WHERE id = ?',
                [$existing['id']]
            );
            Logger::info("Re-activated tracking for key hash: {$apiKeyHash}");
            Response::success([
                'tracked_key_id' => $existing['id'],
                'status' => 'reactivated'
            ], 'Tracking reactivated successfully');
        } else {
            Response::success([
                'tracked_key_id' => $existing['id'],
                'status' => 'already_tracked'
            ], 'API key is already being tracked');
        }
    }
    
    // Encrypt the API key for storage
    $apiKeyEncrypted = Crypto::encrypt($apiKey);
    
    // Insert new tracking record
    $db->execute(
        'INSERT INTO tracked_keys (api_key_hash, api_key_encrypted, user_id, user_email, is_active, created_at) 
         VALUES (?, ?, ?, ?, 1, NOW())',
        [$apiKeyHash, $apiKeyEncrypted, $userId, $userEmail]
    );
    
    $trackedKeyId = $db->lastInsertId();
    Logger::info("Added new tracking for key hash: {$apiKeyHash}, ID: {$trackedKeyId}");
    
    Response::success([
        'tracked_key_id' => $trackedKeyId,
        'status' => 'added'
    ], 'Tracking added successfully');
}

/**
 * Remove API key from tracking (soft delete - set is_active to 0)
 */
function removeTracking($db) {
    // Get POST data
    $apiKey = $_POST['api_key'] ?? '';
    $trackedKeyId = $_POST['tracked_key_id'] ?? null;
    
    if (empty($apiKey) && empty($trackedKeyId)) {
        Response::error('Either api_key or tracked_key_id is required', 400);
    }
    
    if ($trackedKeyId) {
        // Remove by ID
        $result = $db->execute(
            'UPDATE tracked_keys SET is_active = 0 WHERE id = ?',
            [$trackedKeyId]
        );
    } else {
        // Remove by API key hash
        $apiKeyHash = Crypto::hash($apiKey);
        $result = $db->execute(
            'UPDATE tracked_keys SET is_active = 0 WHERE api_key_hash = ?',
            [$apiKeyHash]
        );
    }
    
    if ($result) {
        Logger::info("Deactivated tracking for key");
        Response::success(null, 'Tracking removed successfully');
    } else {
        Response::error('Failed to remove tracking', 500);
    }
}

/**
 * Check if an API key is being tracked
 */
function checkStatus($db) {
    $apiKey = $_GET['api_key'] ?? '';
    
    if (empty($apiKey)) {
        Response::error('API key is required', 400);
    }
    
    $apiKeyHash = Crypto::hash($apiKey);
    
    $tracking = $db->queryOne(
        'SELECT id, is_active, created_at, last_checked_at FROM tracked_keys WHERE api_key_hash = ?',
        [$apiKeyHash]
    );
    
    if ($tracking) {
        Response::success([
            'is_tracked' => $tracking['is_active'] == 1,
            'tracked_key_id' => $tracking['id'],
            'created_at' => $tracking['created_at'],
            'last_checked_at' => $tracking['last_checked_at']
        ]);
    } else {
        Response::success([
            'is_tracked' => false,
            'tracked_key_id' => null,
            'created_at' => null,
            'last_checked_at' => null
        ]);
    }
}
