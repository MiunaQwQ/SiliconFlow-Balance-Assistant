<?php
/**
 * Get Models API
 * Fetches the list of supported models from SiliconFlow API
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Get API key from query parameter
$apiKey = $_GET['api_key'] ?? '';

if (empty($apiKey)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'API key is required'
    ]);
    exit;
}

// Optional filters
$type = $_GET['type'] ?? '';
$subType = $_GET['sub_type'] ?? '';

// Build SiliconFlow API URL
$apiUrl = 'https://api.siliconflow.cn/v1/models';
$queryParams = [];

if (!empty($type)) {
    $queryParams['type'] = $type;
}
if (!empty($subType)) {
    $queryParams['sub_type'] = $subType;
}

if (!empty($queryParams)) {
    $apiUrl .= '?' . http_build_query($queryParams);
}

// Initialize cURL
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => $apiUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true
]);

// Execute request
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

curl_close($ch);

// Handle cURL errors
if ($response === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to connect to SiliconFlow API: ' . $curlError
    ]);
    exit;
}

// Decode response
$data = json_decode($response, true);

// Handle API errors
if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode([
        'success' => false,
        'message' => $data['message'] ?? 'Failed to fetch models',
        'code' => $httpCode
    ]);
    exit;
}

// Return success response
echo json_encode([
    'success' => true,
    'data' => $data['data'] ?? [],
    'total' => count($data['data'] ?? [])
]);
