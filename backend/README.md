# Backend API Documentation

## Overview

This backend provides APIs for tracking SiliconFlow API keys and recording their balance history.

## Environment Requirements

- PHP 7.4 or higher
- MySQL 5.7 or higher
- PHP Extensions: PDO, PDO_MySQL, OpenSSL, cURL

## Installation

### 1. Database Setup

```bash
# Login to MySQL
mysql -u root -p

# Create database and import schema
mysql -u root -p < backend/database/schema.sql
```

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

Required settings:
- `DB_HOST`: MySQL host (usually `localhost`)
- `DB_NAME`: Database name (default: `siliconflow_tracker`)
- `DB_USER`: Database username
- `DB_PASS`: Database password
- `ENCRYPTION_KEY`: Random 32-character key for AES encryption

Generate encryption key:
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 3. File Permissions

```bash
# Create logs directory
mkdir -p backend/logs
chmod 755 backend/logs
```

## API Endpoints

### 1. Track Key Management

**Endpoint**: `POST /backend/api/track_key.php`

#### Add Tracking
```bash
POST /backend/api/track_key.php?action=add
Content-Type: application/x-www-form-urlencoded

api_key=sk-xxxxx&user_id=123&user_email=user@example.com
```

Response:
```json
{
  "success": true,
  "message": "Tracking added successfully",
  "data": {
    "tracked_key_id": 1,
    "status": "added"
  }
}
```

#### Remove Tracking
```bash
POST /backend/api/track_key.php?action=remove
Content-Type: application/x-www-form-urlencoded

api_key=sk-xxxxx
```

#### Check Status
```bash
GET /backend/api/track_key.php?action=status&api_key=sk-xxxxx
```

Response:
```json
{
  "success": true,
  "data": {
    "is_tracked": true,
    "tracked_key_id": 1,
    "created_at": "2026-01-16 03:00:00",
    "last_checked_at": "2026-01-16 03:30:00"
  }
}
```

### 2. Batch Check (Scheduled Task)

**Endpoint**: `GET /backend/api/batch_check.php`

This endpoint should be called by a cron job or scheduled task.

```bash
GET /backend/api/batch_check.php
```

Response:
```json
{
  "success": true,
  "message": "Batch check completed",
  "data": {
    "total": 5,
    "success": 4,
    "failed": 1,
    "details": [...]
  }
}
```

### 3. Get History

**Endpoint**: `GET /backend/api/get_history.php`

```bash
GET /backend/api/get_history.php?api_key=sk-xxxxx&days=7
```

Parameters:
- `api_key` (required): The API key to query
- `days` (optional): Number of days to retrieve (default: 7, max: 90)

Response:
```json
{
  "success": true,
  "message": "History data retrieved successfully",
  "data": {
    "is_tracked": true,
    "tracked_key_id": 1,
    "days": 7,
    "count": 168,
    "history": [
      {
        "balance": "98.50",
        "status": "active",
        "checked_at": "2026-01-16 01:00:00"
      },
      {
        "balance": "97.20",
        "status": "active",
        "checked_at": "2026-01-16 02:00:00"
      }
    ]
  }
}
```

## Scheduled Task Configuration

### Linux (Cron)

Edit crontab:
```bash
crontab -e
```

Add hourly batch check:
```cron
# Check tracked API keys every hour
0 * * * * curl -s http://localhost/backend/api/batch_check.php >> /var/log/siliconflow_batch.log 2>&1
```

Or using PHP CLI:
```cron
0 * * * * /usr/bin/php /path/to/SiliconFlow-Balance-Assistant/backend/api/batch_check.php >> /var/log/siliconflow_batch.log 2>&1
```

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. Name: "SiliconFlow Balance Check"
4. Trigger: Daily, repeat every 1 hour
5. Action: Start a program
   - Program: `curl`
   - Arguments: `-s http://localhost/backend/api/batch_check.php`
   
Or using PowerShell:
```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute 'curl.exe' -Argument '-s http://localhost/backend/api/batch_check.php'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "SiliconFlow Balance Check" -Action $action -Trigger $trigger
```

## Security Notes

1. **API Key Storage**: API keys are encrypted using AES-256-CBC before storage
2. **Hash Comparison**: SHA256 hashes are used for uniqueness checks
3. **CORS**: Configure `CORS_ORIGIN` in `.env` for production
4. **Database**: Use strong passwords and restrict access
5. **HTTPS**: Always use HTTPS in production environments

## Troubleshooting

### Check Database Connection
```bash
php -r "require 'backend/config.php'; require 'backend/db.php'; try { Database::getInstance(); echo 'OK'; } catch(Exception \$e) { echo \$e->getMessage(); }"
```

### View Logs
```bash
tail -f backend/logs/app.log
```

### Test API Endpoints
```bash
# Test with curl
curl -X POST http://localhost/backend/api/track_key.php?action=add \
  -d "api_key=sk-test123&user_id=test&user_email=test@example.com"
```

## File Structure

```
backend/
├── api/
│   ├── track_key.php      # Tracking management
│   ├── batch_check.php    # Scheduled batch checking
│   └── get_history.php    # Historical data retrieval
├── database/
│   └── schema.sql         # Database schema
├── logs/                  # Application logs
├── config.php            # Configuration & utilities
├── db.php                # Database connection class
└── README.md             # This file
```
