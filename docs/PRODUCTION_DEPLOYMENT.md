# Production Deployment & Operations Guide
## ONGC Navratri QR Entry Control System (Next.js + NestJS + PostgreSQL + Redis)

**Document Version:** 2.0.0  
**Target Environment:** Linux (Ubuntu 22.04 LTS / Hostinger VPS / Cloud VM)  
**Security Level:** Production / High-Security Event Admission  

---

## 1. Prerequisites & System Dependencies

Install required system packages on the production server:

```bash
# Update repository index
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS or 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# Verify versions
node -v   # Expected: v20.x or v22.x
npm -v    # Expected: v10.x+

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Install Redis Server
sudo apt install -y redis-server

# Install Nginx & Certbot for SSL
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 2. PostgreSQL Configuration

1. Secure PostgreSQL and create production database user and database:

```bash
sudo -u postgres psql
```

Execute SQL commands:
```sql
CREATE USER ongc_admin WITH PASSWORD 'SECURE_STRONG_DB_PASSWORD_HERE';
CREATE DATABASE ongc_navratri OWNER ongc_admin;
GRANT ALL PRIVILEGES ON DATABASE ongc_navratri TO ongc_admin;

-- Connect to database and grant schema privileges
\c ongc_navratri
GRANT ALL ON SCHEMA public TO ongc_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ongc_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ongc_admin;
\q
```

2. Optimize PostgreSQL connection settings in `/etc/postgresql/16/main/postgresql.conf`:
```ini
max_connections = 200
shared_buffers = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB
effective_cache_size = 3GB
synchronous_commit = off    # High-throughput check-in optimization (safe for turnstiles)
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
sudo systemctl enable postgresql
```

---

## 3. Redis Configuration

1. Edit `/etc/redis/redis.conf`:
```ini
bind 127.0.0.1 ::1
protected-mode yes
maxmemory 512mb
maxmemory-policy allkeys-lru
save 300 10
save 60 10000
```

2. Restart and enable Redis:
```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test Redis connectivity
redis-cli ping   # Returns: PONG
```

---

## 4. Directory Structure & File Permissions

```bash
# Target production directory
sudo mkdir -p /var/www/ongc-rebuild
sudo chown -R $USER:$USER /var/www/ongc-rebuild

# Private photo storage directory (must NOT be in public web root)
mkdir -p /var/www/ongc-rebuild/apps/api/storage/private/employee_photos
chmod -R 750 /var/www/ongc-rebuild/apps/api/storage/private
```

---

## 5. Environment Variables

### 5.1 NestJS Backend (`apps/api/.env`)
Create `/var/www/ongc-rebuild/apps/api/.env`:
```env
PORT=3001
NODE_ENV=production

# PostgreSQL Connection String
DATABASE_URL="postgresql://ongc_admin:SECURE_STRONG_DB_PASSWORD_HERE@localhost:5432/ongc_navratri?schema=public"

# Redis Distributed Locks & Cache
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Authentication (Generate using: openssl rand -hex 32)
JWT_SECRET=f3b89094e9f3b89a80b19d28e75cf829013e9a784d59bc43890124890128490a
JWT_EXPIRES_IN=24h

# Domain & CORS
APP_URL=https://ongcnavratri.reworkzone.in
CORS_ORIGINS=https://ongcnavratri.reworkzone.in

# Strict Security Controls
DEMO_ADMIN_BYPASS=false
LOAD_TESTING_ENABLED=false

# Emergency Administrator Account
ADMIN_EMAIL=admin@ongc.co.in
ADMIN_PASSWORD=SECURE_INITIAL_PASSWORD_CHANGE_AFTER_LOGIN
```

### 5.2 Next.js Frontend (`apps/web/.env`)
Create `/var/www/ongc-rebuild/apps/web/.env`:
```env
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://ongcnavratri.reworkzone.in/api
NEXT_PUBLIC_APP_URL=https://ongcnavratri.reworkzone.in
```

---

## 6. Build & Migration Execution

Run from repository root:

```bash
cd /var/www/ongc-rebuild

# 1. Shared Types
cd packages/shared-types
npm install
npm run build
cd ../..

# 2. NestJS Backend Build & Migration
cd apps/api
npm install --omit=dev
npx prisma generate
npx prisma migrate deploy

# Seed baseline settings and gates (read-only migration tool)
npx ts-node ../../tools/migrate-mysql-to-postgres.ts

npm run build
cd ../..

# 3. Next.js Frontend Build
cd apps/web
npm install --omit=dev
npm run build
cd ../..
```

---

## 7. Process Management (PM2)

Use the provided `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'ongc-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '1G',
      kill_timeout: 5000,
    },
    {
      name: 'ongc-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
    },
  ],
};
```

Start the application cluster:
```bash
pm2 start ecosystem.config.js
pm2 save
sudo pm2 startup
```

---

## 8. Nginx Reverse Proxy & Sub-50ms Optimization

Create `/etc/nginx/sites-available/ongcnavratri`:

```nginx
# Upstream clusters
upstream ongc_api_cluster {
    server 127.0.0.1:3001;
    keepalive 64;
}

upstream ongc_web_cluster {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name ongcnavratri.reworkzone.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ongcnavratri.reworkzone.in;

    # SSL certificates managed by Certbot
    ssl_certificate /etc/letsencrypt/live/ongcnavratri.reworkzone.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ongcnavratri.reworkzone.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # High performance keepalive & buffer settings
    client_max_body_size 10M;
    keepalive_timeout 65;
    proxy_buffers 16 32k;
    proxy_buffer_size 64k;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # API Proxy (/api/*) -> NestJS Backend
    location /api/ {
        proxy_pass http://ongc_api_cluster;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Scanner Sub-50ms latency optimization
        proxy_connect_timeout 3s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }

    # Static assets caching
    location /_next/static/ {
        proxy_pass http://ongc_web_cluster;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Web Application -> Next.js Frontend
    location / {
        proxy_pass http://ongc_web_cluster;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and obtain SSL certificate:
```bash
sudo ln -sf /etc/nginx/sites-available/ongcnavratri /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d ongcnavratri.reworkzone.in
```

---

## 9. Automated Health Verification

Run health checks:

```bash
# 1. API Status Ping
curl -I https://ongcnavratri.reworkzone.in/api/scanner/ping

# 2. Web Portal Check
curl -I https://ongcnavratri.reworkzone.in/

# 3. PM2 Process Status
pm2 status

# 4. Redis Key Metrics
redis-cli info memory
```

---

## 10. Database Backup Strategy

Create automated backup script `/usr/local/bin/backup-ongc-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/ongc-navratri"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Dump PostgreSQL database
pg_dump -U ongc_admin -h localhost ongc_navratri | gzip > "$BACKUP_DIR/ongc_db_$TIMESTAMP.sql.gz"

# Retain last 14 days
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
```

Add to cron (`sudo crontab -e`):
```cron
# Backup database every hour during festival hours (6 PM - 2 AM)
0 18-23,0-2 * * * /usr/local/bin/backup-ongc-db.sh
```

---

## 11. Rollback Procedure

If any unexpected blocker occurs during production cutover:

1. **Re-route Nginx to Legacy Laravel:**
```bash
sudo ln -sf /etc/nginx/sites-available/ongc-laravel.conf /etc/nginx/sites-enabled/ongcnavratri
sudo nginx -t && sudo systemctl reload nginx
```
2. **Stop New Processes:**
```bash
pm2 stop ecosystem.config.js
```
3. Because the legacy database was never modified, legacy operations resume with zero data loss.
