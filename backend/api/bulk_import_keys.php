<?php

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

session_start();

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    Response::error('Unauthorized', 401);
}

try {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!is_array($payload)) {
        Response::error('Invalid JSON payload', 400);
    }

    $keys = $payload['keys'] ?? [];
    if (!is_array($keys) || count($keys) === 0) {
        Response::error('keys must be a non-empty array', 400);
    }

    $saveToServer = parseBooleanValue($payload['save_to_server'] ?? true);
    $trackKeys = parseBooleanValue($payload['track_keys'] ?? true);

    if (!$saveToServer && !$trackKeys) {
        Response::error('At least one of save_to_server or track_keys must be true', 400);
    }

    if ($trackKeys) {
        $saveToServer = true;
    }

    $userId = normalizeOptionalText($payload['user_id'] ?? null);
    $userEmail = normalizeOptionalText($payload['user_email'] ?? null);

    $db = Database::getInstance();
    $results = [];
    $successCount = 0;
    $failedCount = 0;

    foreach ($keys as $rawKey) {
        if (!is_string($rawKey)) {
            $results[] = [
                'key' => '',
                'success' => false,
                'message' => 'Invalid key item'
            ];
            $failedCount++;
            continue;
        }

        $apiKey = trim($rawKey);
        if ($apiKey === '') {
            $results[] = [
                'key' => '',
                'success' => false,
                'message' => 'Empty key is not allowed'
            ];
            $failedCount++;
            continue;
        }

        if (strlen($apiKey) < 10) {
            $results[] = [
                'key' => maskApiKey($apiKey),
                'success' => false,
                'message' => 'Key format seems invalid'
            ];
            $failedCount++;
            continue;
        }

        try {
            $apiKeyHash = Crypto::hash($apiKey);
            $existing = $db->queryOne(
                'SELECT id, is_active, user_id, user_email FROM tracked_keys WHERE api_key_hash = ?',
                [$apiKeyHash]
            );

            if ($existing) {
                $updateFields = [];
                $updateParams = [];

                if ($trackKeys && intval($existing['is_active']) === 0) {
                    $updateFields[] = 'is_active = 1';
                }

                if ($userId !== null && empty($existing['user_id'])) {
                    $updateFields[] = 'user_id = ?';
                    $updateParams[] = $userId;
                }

                if ($userEmail !== null && empty($existing['user_email'])) {
                    $updateFields[] = 'user_email = ?';
                    $updateParams[] = $userEmail;
                }

                if (!empty($updateFields)) {
                    $updateParams[] = $existing['id'];
                    $db->execute(
                        'UPDATE tracked_keys SET ' . implode(', ', $updateFields) . ' WHERE id = ?',
                        $updateParams
                    );
                }

                $statusText = intval($existing['is_active']) === 1 || $trackKeys ? 'already_exists' : 'saved';
                if ($trackKeys && intval($existing['is_active']) === 0) {
                    $statusText = 'reactivated';
                }

                $results[] = [
                    'key' => maskApiKey($apiKey),
                    'success' => true,
                    'tracked_key_id' => intval($existing['id']),
                    'status' => $statusText,
                    'message' => 'Processed successfully'
                ];
                $successCount++;
                continue;
            }

            $apiKeyEncrypted = Crypto::encrypt($apiKey);
            $isActive = $trackKeys ? 1 : 0;

            $db->execute(
                'INSERT INTO tracked_keys (api_key_hash, api_key_encrypted, user_id, user_email, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [$apiKeyHash, $apiKeyEncrypted, $userId, $userEmail, $isActive]
            );

            $insertedId = intval($db->lastInsertId());
            $results[] = [
                'key' => maskApiKey($apiKey),
                'success' => true,
                'tracked_key_id' => $insertedId,
                'status' => $trackKeys ? 'tracked' : 'saved',
                'message' => 'Processed successfully'
            ];
            $successCount++;
        } catch (Exception $e) {
            Logger::error('bulk_import_keys item error: ' . $e->getMessage());
            $results[] = [
                'key' => maskApiKey($apiKey),
                'success' => false,
                'message' => 'Failed to process key'
            ];
            $failedCount++;
        }
    }

    Logger::info('bulk_import_keys completed: total=' . count($keys) . ', success=' . $successCount . ', failed=' . $failedCount);

    Response::success([
        'total' => count($keys),
        'success_count' => $successCount,
        'failed_count' => $failedCount,
        'save_to_server' => $saveToServer,
        'track_keys' => $trackKeys,
        'results' => $results
    ], 'Bulk import completed');
} catch (Exception $e) {
    Logger::error('bulk_import_keys.php error: ' . $e->getMessage());
    Response::error('Bulk import failed', 500);
}

function parseBooleanValue($value)
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_int($value)) {
        return $value === 1;
    }

    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }

    return false;
}

function normalizeOptionalText($value)
{
    if (!is_string($value)) {
        return null;
    }

    $trimmed = trim($value);
    return $trimmed === '' ? null : $trimmed;
}

function maskApiKey($apiKey)
{
    if (!is_string($apiKey)) {
        return '';
    }

    if (strlen($apiKey) <= 11) {
        return $apiKey;
    }

    $prefix = substr($apiKey, 0, 7);
    $suffix = substr($apiKey, -4);
    $middle = str_repeat('*', 8);

    return $prefix . $middle . $suffix;
}
