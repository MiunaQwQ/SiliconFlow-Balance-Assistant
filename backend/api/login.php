<?php
/**
 * Admin Login API
 */

require_once __DIR__ . '/../config.php';

session_start();

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);
$password = $data['password'] ?? '';

// Get admin password from environment
$adminPassword = $_ENV['ADMIN_PASSWORD'] ?? null;

if (!$adminPassword) {
    Response::error('Server configuration error: ADMIN_PASSWORD not set', 500);
}

if ($password === $adminPassword) {
    // Set session
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['login_time'] = time();
    
    Logger::info('Admin logged in successfully');
    Response::success(['status' => 'logged_in'], 'Login successful');
} else {
    Logger::info('Failed admin login attempt');
    Response::error('Invalid password', 401);
}
