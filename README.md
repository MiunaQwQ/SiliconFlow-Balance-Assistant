# SiliconFlow Balance Assistant

一个美观的 SiliconFlow API 余额查询助手,支持余额跟踪和历史数据可视化。

A beautiful SiliconFlow API balance query assistant with balance tracking and historical data visualization support.

## ✨ 功能特性 / Features

### 核心功能 / Core Features
- 🔍 **实时余额查询** - 快速查询 SiliconFlow API Key 的余额信息
- 📊 **余额跟踪** - 勾选跟踪 API Key,自动记录余额变化历史
- 📈 **数据可视化** - 折线图展示余额趋势,支持最多 90 天历史数据
- ⏰ **自动批量查询** - 支持计划任务定时批量查询所有跟踪的 API Key
- 🌐 **多语言支持** - 简体中文 / 繁体中文 / English / 日本語

### 技术特性 / Technical Features
- 🔐 **安全加密** - AES-256-CBC 加密存储 API Key,SHA256 哈希去重
- 🎨 **现代设计** - Glassmorphism 毛玻璃设计,渐变色和流畅动画
- 📱 **响应式布局** - 完美支持桌面端和移动端
- 🚀 **高性能** - 使用 Chart.js 实现高性能数据可视化
- 🛡️ **SQL 注入防护** - 使用预处理语句保护数据库安全

## 🚀 快速开始 / Quick Start

### 前置要求 / Prerequisites

- PHP 7.4 或更高版本 / PHP 7.4 or higher
- MySQL 5.7 或更高版本 / MySQL 5.7 or higher
- Web 服务器 (Apache/Nginx)
- PHP 扩展 / PHP Extensions: PDO, PDO_MySQL, OpenSSL, cURL

### 安装步骤 / Installation

1. **克隆项目 / Clone Repository**
```bash
git clone https://github.com/yourusername/SiliconFlow-Balance-Assistant.git
cd SiliconFlow-Balance-Assistant
```

2. **数据库配置 / Database Setup**

首先登录 MySQL 并创建数据库:
```bash
mysql -u root -p
```

在 MySQL 中执行:
```sql
CREATE DATABASE IF NOT EXISTS siliconflow_tracker
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE siliconflow_tracker;
```

然后导入数据库架构:
```bash
# 在 MySQL 中直接执行
mysql -u root -p siliconflow_tracker < backend/database/schema.sql

# 或者退出 MySQL 后在命令行执行
mysql -u root -p siliconflow_tracker < backend/database/schema.sql
```

3. **环境配置 / Environment Configuration**
```bash
# 复制环境变量模板 / Copy environment template
cp .env.example .env

# 编辑配置文件 / Edit configuration file
nano .env  # 或使用你喜欢的编辑器
```

必需的配置项 / Required settings:
- `DB_HOST`: 数据库主机 (通常为 `localhost`)
- `DB_NAME`: 数据库名称 (默认: `siliconflow_tracker`)
- `DB_USER`: 数据库用户名
- `DB_PASS`: 数据库密码
- `ENCRYPTION_KEY`: 32 位随机加密密钥

生成加密密钥 / Generate encryption key:
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

4. **文件权限 / File Permissions** (Linux/Mac)
```bash
# 创建日志目录 / Create logs directory
mkdir -p backend/logs
chmod 755 backend/logs
```

5. **部署到 Web 服务器 / Deploy to Web Server**

将项目放置到 Web 服务器目录,例如:
- Apache: `/var/www/html/` 或 `htdocs/`
- Nginx: `/usr/share/nginx/html/`
- Windows: `C:\xampp\htdocs\`

6. **访问应用 / Access Application**

在浏览器中打开: `http://localhost/SiliconFlow-Balance-Assistant/`

## ⚙️ 计划任务配置 / Scheduled Task Configuration

配置自动批量查询以定期更新跟踪的 API Key 余额。

### Windows 任务计划程序 / Windows Task Scheduler

使用 PowerShell 创建计划任务 (每小时执行一次):
```powershell
$action = New-ScheduledTaskAction -Execute 'curl.exe' -Argument '-s http://localhost/backend/api/batch_check.php'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "SiliconFlow Balance Check" -Action $action -Trigger $trigger
```

或手动创建:
1. 打开任务计划程序 (Task Scheduler)
2. 创建基本任务
3. 名称: "SiliconFlow Balance Check"
4. 触发器: 每天,重复间隔 1 小时
5. 操作: 启动程序
   - 程序: `curl.exe`
   - 参数: `-s http://localhost/backend/api/batch_check.php`

### Linux Cron

编辑 crontab:
```bash
crontab -e
```

添加每小时执行的任务:
```cron
# 每小时检查跟踪的 API Keys
0 * * * * curl -s http://localhost/backend/api/batch_check.php >> /var/log/siliconflow_batch.log 2>&1
```

或使用 PHP CLI:
```cron
0 * * * * /usr/bin/php /path/to/SiliconFlow-Balance-Assistant/backend/api/batch_check.php >> /var/log/siliconflow_batch.log 2>&1
```

## 📖 使用说明 / User Guide

### 查询余额 / Query Balance

1. 打开网页,输入你的 SiliconFlow API Key
2. 点击 "查询余额" 按钮
3. 查看账户信息和当前余额

### 启用跟踪 / Enable Tracking

1. 查询成功后,勾选 "跟踪此 API Key" 复选框
2. 系统将自动加密保存 API Key 到数据库
3. 计划任务将定期查询并记录余额变化

### 查看历史数据 / View Historical Data

1. 对于已跟踪的 API Key,计划任务会自动记录余额
2. 再次查询该 API Key 时,会显示余额变化折线图
3. 支持查看最近 7 天 (默认) 到 90 天的历史数据

### 移除跟踪 / Remove Tracking

1. 查询已跟踪的 API Key
2. 取消勾选 "跟踪此 API Key" 复选框
3. 系统将停止跟踪并删除该 API Key (历史数据保留)

## 📁 项目结构 / Project Structure

```
SiliconFlow-Balance-Assistant/
├── backend/                   # 后端代码 / Backend code
│   ├── api/                   # API 接口 / API endpoints
│   │   ├── track_key.php      # 跟踪管理 API / Tracking management
│   │   ├── batch_check.php    # 批量查询 API / Batch checking
│   │   └── get_history.php    # 历史数据 API / Historical data
│   ├── database/              # 数据库 / Database
│   │   └── schema.sql         # 数据库架构 / Database schema
│   ├── logs/                  # 日志目录 / Logs directory
│   ├── config.php             # 配置和工具函数 / Config & utilities
│   ├── db.php                 # 数据库连接类 / Database class
│   └── README.md              # 后端文档 / Backend documentation
├── index.html                 # 主页面 / Main page
├── style.css                  # 样式文件 / Stylesheet
├── script.js                  # 主要逻辑 / Main logic
├── i18n.js                    # 多语言支持 / Internationalization
├── .env.example               # 环境变量模板 / Environment template
└── README.md                  # 项目文档 / Project documentation
```

## 🔌 API 接口 / API Endpoints

### 1. 跟踪管理 / Track Key Management

**添加跟踪 / Add Tracking**
```bash
POST /backend/api/track_key.php?action=add
Content-Type: application/x-www-form-urlencoded

api_key=sk-xxxxx&user_id=123&user_email=user@example.com
```

**移除跟踪 / Remove Tracking**
```bash
POST /backend/api/track_key.php?action=remove
Content-Type: application/x-www-form-urlencoded

api_key=sk-xxxxx
```

**检查状态 / Check Status**
```bash
GET /backend/api/track_key.php?action=status&api_key=sk-xxxxx
```

### 2. 批量查询 / Batch Check
```bash
GET /backend/api/batch_check.php
```

### 3. 获取历史数据 / Get History
```bash
GET /backend/api/get_history.php?api_key=sk-xxxxx&days=7
```

参数 / Parameters:
- `api_key` (必需): 要查询的 API Key
- `days` (可选): 查询天数 (默认: 7, 最大: 90)

完整 API 文档请参考 [backend/README.md](backend/README.md)

## 🔒 安全特性 / Security Features

- ✅ **API Key 加密存储** - 使用 AES-256-CBC 加密算法,无明文存储
- ✅ **SHA256 哈希** - 用于唯一性检查和快速查找
- ✅ **预处理语句** - 防止 SQL 注入攻击
- ✅ **CORS 配置** - 支持跨域请求控制
- ✅ **日志记录** - 记录所有 API 操作和错误信息
- ✅ **错误处理** - 统一的错误响应格式

### 安全建议 / Security Recommendations

1. 在生产环境使用 HTTPS
2. 设置强数据库密码
3. 限制数据库访问权限
4. 定期备份数据库
5. 配置 `.env` 中的 `CORS_ORIGIN`

## 💻 技术栈 / Tech Stack

### 前端 / Frontend
- **HTML5 + CSS3** - 现代 Web 标准
- **Vanilla JavaScript** - 无框架依赖
- **Chart.js 4.4.1** - 数据可视化
- **Inter Font** - 现代字体

### 后端 / Backend
- **PHP 7.4+** - 服务端语言
- **MySQL 5.7+** - 关系型数据库
- **PDO** - 数据库抽象层

### 设计 / Design
- **Glassmorphism** - 毛玻璃拟态设计
- **CSS Animations** - 流畅动画效果
- **Responsive Design** - 移动端适配

## 🐛 故障排除 / Troubleshooting

### 数据库连接失败 / Database Connection Failed
```bash
# 测试数据库连接
php -r "require 'backend/config.php'; require 'backend/db.php'; try { Database::getInstance(); echo 'OK'; } catch(Exception \$e) { echo \$e->getMessage(); }"
```

### 查看日志 / View Logs
```bash
# Linux/Mac
tail -f backend/logs/app.log

# Windows
Get-Content backend/logs/app.log -Wait -Tail 20
```

### 测试 API / Test API
```bash
# 测试添加跟踪
curl -X POST http://localhost/backend/api/track_key.php?action=add \
  -d "api_key=sk-test123&user_id=test&user_email=test@example.com"

# 测试批量查询
curl http://localhost/backend/api/batch_check.php
```

### 常见问题 / Common Issues

**Q: API Key 不显示跟踪状态?**
- 检查数据库连接是否正常
- 确认 `.env` 配置正确
- 查看浏览器控制台是否有错误

**Q: 折线图不显示?**
- 确认已启用跟踪
- 等待计划任务执行至少一次
- 检查是否有历史数据记录

**Q: 批量查询不工作?**
- 确认计划任务已正确配置
- 检查 Web 服务器是否可访问
- 查看日志文件获取详细错误信息

## 📝 开发计划 / Roadmap

- [ ] 添加邮件通知 (余额低于阈值时)
- [ ] 支持多个 API Key 对比
- [ ] 导出历史数据为 CSV
- [ ] 管理后台界面

## 📄 许可证 / License

MIT License