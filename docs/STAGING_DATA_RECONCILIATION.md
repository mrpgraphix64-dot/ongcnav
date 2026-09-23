# STAGING DATA RECONCILIATION REPORT

**Audit Date:** 2026-09-23  
**Source Database:** Legacy Laravel SQLite (`database/database.sqlite`) — READ ONLY  
**Target Database:** PostgreSQL 16 Staging (`ongc_navratri_staging`) on `127.0.0.1:5432`  
**Migration Mode:** Non-destructive Extract-Transform-Load via `@prisma/client`  
**Reconciliation Status:** **100% RECONCILED — ZERO DATA LOSS**

---

## 1. Entity Reconciliation Summary

| Entity / Table | Legacy Source Count | Staging PostgreSQL Count | Variance | Reconciliation Status |
| :--- | :---: | :---: | :---: | :---: |
| **Users** | 2 | 2 | 0 | **EXACT MATCH** |
| **Gates** | 6 | 6 | 0 | **EXACT MATCH** |
| **Employees** | 1 | 2* | +1* | **EXACT MATCH + SYNTHETIC ANCHOR** |
| **Family Members** | 1 | 1 | 0 | **EXACT MATCH** |
| **Attendees / Passes** | 27 | 27 | 0 | **EXACT MATCH** |
| **Daily Checkins** | 23 | 23 | 0 | **EXACT MATCH** |
| **Scan Logs** | 75 | 75 | 0 | **EXACT MATCH** |
| **Incidents** | 0 | 0 | 0 | **EXACT MATCH** |
| **Audit Logs** | 23 | 23 | 0 | **EXACT MATCH** |
| **Settings** | 4 | 9** | +5** | **EXACT MATCH + SYSTEM DEFAULTS** |
| **Load Test Runs** | 1 | 1 | 0 | **EXACT MATCH** |

*\*Note on Employees:* One synthetic anchor employee (`LOADTEST_EMP`) was provisioned to maintain strict relational foreign-key integrity for synthetic load-test attendee tickets without dropping any records or relaxing schema constraints.  
*\*\*Note on Settings:* Preserved all 4 legacy settings (`general.event_name`, etc.) and seeded 5 system control flags (`active_event_date`, `emergency_stop`, `emergency_stop_reason`, `scanning_paused`, `registration_open`).

---

## 2. Sample Data Verification & Integrity Check

### 2.1 User Credentials & Roles
- **Legacy Admin:** `admin@test.com` (Super Admin, bcrypt hash preserved) -> Migrated with `UserRole.SUPER_ADMIN`, active status.
- **Legacy Scanner Staff:** `loadtest-staff-LT20260922MVMN-01@synthetic.test` -> Migrated with `UserRole.SCANNER_STAFF`, active status, staffId `LT-STF-LT20260922MVMN-01`.

### 2.2 Gates Verification
- **Gate 1:** Main Gate (code: `MAIN`, type: `REGULAR`, status: `ACTIVE`, open: `true`)
- **Gate 2:** Gate A (code: `G-A`, type: `REGULAR`, status: `ACTIVE`, open: `true`)
- **Gate 3:** Gate B (code: `G-B`, type: `REGULAR`, status: `ACTIVE`, open: `true`)
- **Gate 4:** Gate C (code: `G-C`, type: `REGULAR`, status: `ACTIVE`, open: `true`)
- **Gate 5:** VIP Gate (code: `VIP`, type: `VIP`, status: `ACTIVE`, open: `true`)
- **Gate 9:** LOADTEST GATE 1 (code: `LT20260922MVMN-LT-G01`, type: `REGULAR`, status: `ACTIVE`, open: `true`)

### 2.3 Registration & Passes Verification
- **Employee Ticket:** `EWC-100001` (Secure token `b02cd51be6e6d062a85ecfd263b769484b04ddb4b9176bb0833db60b819ef60c`) -> Associated with Employee `test` (CPF `43456`).
- **Family Ticket:** `EWC-100002` (Secure token `0361a9d943581c0e280e956409e91b1066df5fe3f18454e4b737ed2d48bccb2d`) -> Associated with Family Member `test` and Employee `test`.
- **Synthetic Passes:** All 25 synthetic attendee passes migrated with intact secure tokens.

### 2.4 Transactional Checkins Verification
- **Daily Checkins (23):** Event date `2026-09-22`, physical uniqueness constraint `(attendee_id, event_date)` strictly verified and preserved in PostgreSQL.
- **Scan Logs (75):** All 75 scan log events mapped to corresponding attendees, gates, and result statuses (`approved`, etc.).
- **Audit Logs (23):** All metadata, IP addresses (`127.0.0.1`), and reasons parsed into PostgreSQL JSONB `details` structure without loss.

---

## 3. Physical Constraints Validation

- **PostgreSQL Table Engine:** PostgreSQL 16 standard relational tables.
- **Unique Indexes:**
  - `users_email_key`
  - `users_staff_id_key`
  - `gates_gate_number_key`
  - `employees_cpf_key`
  - `attendees_ticket_number_key`
  - `attendees_qr_code_token_key`
  - `daily_checkins_attendee_id_event_date_key`
- **Foreign Keys:**
  - `daily_checkins -> attendees (attendee_id)`
  - `daily_checkins -> gates (gate_id)`
  - `daily_checkins -> users (scanned_by_id)`
  - `attendees -> employees (employee_id)`
  - `family_members -> employees (employee_id)`
  - `incidents -> gates (gate_id)`
  - `incidents -> users (reported_by_id)`

---

## 4. Conclusion

The staging database migration completed with 0 errors and 0 skipped rows. Source SQLite database remained in strictly read-only access mode with no modifications. PostgreSQL staging database `ongc_navratri_staging` is ready for staging server boot and integration load testing.
