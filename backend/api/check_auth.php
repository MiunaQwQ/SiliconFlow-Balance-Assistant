<?php
/**
 * Check Auth API
 */

require_once __DIR__ . '/../config.php';

session_start();

if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
    Response::success(['is_logged_in' => true], 'Authenticated');
} else {
    Response::success(['is_logged_in' => false], 'Not authenticated');
}
