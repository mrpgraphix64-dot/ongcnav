# ONGC Navratri Entry Control System

Official event management, digital ticketing, employee registration, and gate admission control portal for the **ONGC Navratri 2026 / EWC Ahmedabad** celebration.

---

## Overview

The **ONGC Navratri Entry Control System** is a unified event web platform that provides:
1. **Public Event Website**: Multi-page official site showcasing schedules, cultural programs, venue directions, FAQs, sponsor stages, and announcements.
2. **Employee & Family Registration**: EWC Ahmedabad portal allowing ONGC staff to register themselves and add dependents with secure photo upload.
3. **Digital Pass Delivery**: Instant issuance of digital pass cards with encrypted, secure QR tokens for gate access.
4. **Live Gate Operations & Admission Scanner**: Camera and hardware barcode scanner support with duplicate entry prevention and live check-in audits.
5. **Admin Control Center**: KPI dashboard, capacity tracker, attendee grouping, CSV bulk uploads, reports, and gate management.

---

## Features

- **Employee & Dependent Registration**: ONGC employee CPF verification, designation/section details, secure photo upload, and multi-family member addition.
- **Dynamic Digital Passes**: High-resolution SVG digital passes with unique Ticket IDs and time/token validation.
- **Real-Time QR Scanner**: High-speed camera scanner powered by HTML5-QRCode with sound effects, vibration, and duplicate check-in detection.
- **Admin Dashboard**: Live capacity meter, attendee counts by category, recent admissions feed, and quick actions.
- **Attendee Grouping & Hierarchy**: Tree view (`├──` / `└──`) linking employees and their registered dependents with search and filter support.
- **Bulk CSV Upload & Export**: Import attendee batches from CSV and export registration data.
- **Sponsor & Cultural Showcase**: Interactive luxury stage and festival timeline preview.

---

## Tech Stack

- **Backend**: PHP 8.3+, Laravel 12.x / 11.x framework
- **Frontend**: Laravel Blade, Tailwind CSS, Alpine.js, Lucide Icons
- **Database**: SQLite (Local / Testing) or MySQL 8.x (Production)
- **QR Generation**: `endroid/qr-code` (v6)
- **Scanning**: HTML5-QRCode library (Client-side camera integration)
- **Testing**: PHPUnit 12.x

---

## Installation & Setup

### Prerequisites
- PHP >= 8.3 with `pdo_sqlite` or `pdo_mysql`, `gd` / `imagick`, `mbstring`, `openssl`, `xml`
- Composer (v2.x)

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/<your-org>/ongcnav.git
cd ongcnav

composer install --optimize-autoloader --no-dev
```

### 2. Configure Environment
```bash
cp .env.example .env
php artisan key:generate
```

### 3. Run Migrations & Seeders
```bash
php artisan migrate --force
php artisan db:seed
```

### 4. Create Storage Link (if needed for public uploads)
```bash
php artisan storage:link
```

---

## Environment Variables

Configure your local or production settings in `.env` based on `.env.example`:

| Variable | Description | Default / Example |
|---|---|---|
| `APP_NAME` | Project title | `"ONGC Navratri"` |
| `APP_ENV` | Environment mode | `production` / `local` |
| `APP_KEY` | Laravel encryption key | Generated via `php artisan key:generate` |
| `APP_DEBUG` | Debug mode | `false` (in production) |
| `APP_URL` | Base website URL | `https://your-domain.com` |
| `DB_CONNECTION` | Database driver | `sqlite` or `mysql` |
| `DB_DATABASE` | Database path or name | `database/database.sqlite` |
| `DEMO_ADMIN_BYPASS` | Enable "Continue as Admin" button | `false` in production (`true` for testing) |
| `ADMIN_DEFAULT_EMAIL` | Admin login identifier | `admin@ongc.co.in` |
| `ADMIN_DEFAULT_PASSWORD`| Admin login password | Set securely in `.env` |

> **IMPORTANT**: Never commit `.env` or real production secrets to version control.

---

## Development & Testing

### Run Development Server
```bash
php artisan serve
# or run with built-in server:
php -S 127.0.0.1:8000 server.php
```

### Run Automated Tests
```bash
php artisan test
# or directly via PHPUnit:
php vendor/phpunit/phpunit/phpunit --no-coverage
```

---

## Application Routes

### Public Routes
- `/` — Homepage & Festival Showcase
- `/about` — About ONGC Navratri
- `/event` — Event Details & Experience
- `/schedule` — Schedule & Program Timings
- `/gallery` — Festival Visuals
- `/faq` — Frequently Asked Questions
- `/contact` — Contact & Venue Map
- `/information` — Guidelines & Code of Conduct
- `/register` / `/ewc-ahmedabad` — EWC Employee & Family Registration
- `/ticket` — Ticket Lookup
- `/tickets/{id}` — Individual Digital Pass View

### Admin Routes (Protected by `admin.auth`)
- `/admin/login` — Admin Login Portal
- `/admin` — Admin Dashboard & KPIs
- `/admin/attendees` — Grouped Attendee Management & Verification
- `/admin/bulk-upload` — CSV Bulk Upload
- `/admin/scanner` — Live Admission Scanner
- `/admin/reports` — Admission Statistics & Printable Reports
- `/admin/settings` — Gate Management & System Configuration

---

## Admin Demo Mode

For staging and QA evaluation, a temporary **"CONTINUE AS ADMIN"** one-click authentication bypass is available on `/admin/login`.

- Controlled by the environment flag: `DEMO_ADMIN_BYPASS`
- **To disable for production deployment**:
  ```ini
  DEMO_ADMIN_BYPASS=false
  ```
- When disabled, only valid credentials configured via `ADMIN_DEFAULT_EMAIL` and `ADMIN_DEFAULT_PASSWORD` (or database user records) are accepted.

---

## Important Security Notes

1. **Protect Secrets**: `.env` and SQLite database files are excluded via `.gitignore`. Never force commit `.env`.
2. **Employee Photo Privacy**: Photos uploaded during employee registration are stored in `storage/app/private/employee_photos/`. They are strictly accessible only by authenticated administrators via the protected route `/admin/employees/{id}/photo` and are never exposed in public directories or digital passes.
3. **Secure QR Tokens**: QR passes generate cryptographic time-stamped URLs. Do not commit attendee datasets, exports, or scan logs to GitHub.
4. **HTTPS Enforcement**: Deploy under HTTPS in production to ensure secure camera streaming and encrypted authentication sessions.
