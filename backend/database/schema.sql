-- SiliconFlow Balance Tracking Database Schema
-- MySQL 5.7 Compatible
-- 请先手动选择或创建数据库,然后执行此脚本
-- Please manually select or create a database before executing this script

-- --------------------------------------------------------
--
-- 表的结构 `tracked_keys`
--
-- Table: tracked_keys
-- Stores API keys that need to be tracked
CREATE TABLE IF NOT EXISTS tracked_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key_hash VARCHAR(64) NOT NULL UNIQUE COMMENT 'SHA256 hash of API key for uniqueness check',
    api_key_encrypted TEXT NOT NULL COMMENT 'AES encrypted API key for batch checking',
    user_id VARCHAR(100) DEFAULT NULL COMMENT 'User ID from SiliconFlow API',
    user_email VARCHAR(255) DEFAULT NULL COMMENT 'User email from SiliconFlow API',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'Whether tracking is enabled (1=yes, 0=no)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When tracking was added',
    last_checked_at DATETIME DEFAULT NULL COMMENT 'Last time balance was checked',
    INDEX idx_active (is_active),
    INDEX idx_last_checked (last_checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: balance_history
-- Stores historical balance records
CREATE TABLE IF NOT EXISTS balance_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tracked_key_id INT NOT NULL COMMENT 'Foreign key to tracked_keys',
    balance DECIMAL(10, 2) NOT NULL COMMENT 'Balance amount',
    status VARCHAR(20) DEFAULT 'active' COMMENT 'Account status (active/blocked)',
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When this record was created',
    INDEX idx_tracked_key (tracked_key_id),
    INDEX idx_checked_at (checked_at),
    INDEX idx_composite (tracked_key_id, checked_at),
    FOREIGN KEY (tracked_key_id) REFERENCES tracked_keys(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a view for easy querying
CREATE OR REPLACE VIEW v_tracking_status AS
SELECT 
    tk.id,
    tk.api_key_hash,
    tk.user_id,
    tk.user_email,
    tk.is_active,
    tk.created_at,
    tk.last_checked_at,
    COUNT(bh.id) as total_records,
    MAX(bh.checked_at) as latest_record_time,
    (SELECT balance FROM balance_history WHERE tracked_key_id = tk.id ORDER BY checked_at DESC LIMIT 1) as latest_balance
FROM tracked_keys tk
LEFT JOIN balance_history bh ON tk.id = bh.tracked_key_id
GROUP BY tk.id;
