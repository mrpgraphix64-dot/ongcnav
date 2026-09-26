# Authentication & Password Reset Security Architecture

## Overview
This document specifies the security controls, cryptographic design, operational constraints, and lifecycle of the self-service Email OTP Password Reset mechanism in the ONGC Navratri QR Entry Control System.

---

## 1. Endpoints & Flow Architecture

The password reset subsystem exposes four unauthenticated REST endpoints under the `/auth` namespace:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/forgot-password` | Initiates the reset flow by email. Always returns a generic response. |
| `POST` | `/auth/resend-reset-otp` | Generates a new OTP with rate limiting & cooldown. Generic response. |
| `POST` | `/auth/verify-reset-otp` | Validates submitted OTP; issues short-lived reset authorization token. |
| `POST` | `/auth/reset-password` | Validates reset token and applies new bcrypt-hashed password. |

### Visual Sequence
```
Client                      Backend API                     PostgreSQL / Redis                  Hostinger Mail API
  |                              |                                  |                                   |
  |-- POST /forgot-password ---->|                                  |                                   |
  |   { email }                  |-- Normalize (trim/lower)         |                                   |
  |                              |-- Enforce Rate Limits ---------->| Check Redis / In-Memory           |
  |                              |-- Query Eligible Account ------->| Check `users` table               |
  |                              |-- (If eligible: Gen 6-digit OTP) |                                   |
  |                              |-- Keyed HMAC-SHA256 Hash ------->| Save in `password_resets`         |
  |                              |-- Send OTP Email --------------------------------------------------->| Dispatch OTP
  |                              |-- (If ineligible: dummy HMAC)    |                                   |
  |<-- Generic 200 OK -----------| (Always returns generic message) |                                   |
  |                              |                                  |                                   |
  |-- POST /verify-reset-otp --->|                                  |                                   |
  |   { email, otp }             |-- Timing-Safe Hash Compare ----->| Verify OTP & attempts < 5         |
  |                              |-- Issue Reset Auth Token (JWT)   | Set `verified_at` & `token_hash`  |
  |<-- 200 { resetToken } -------| (Scoped, 10m expiry, single-use) |                                   |
  |                              |                                  |                                   |
  |-- POST /reset-password ----->|                                  |                                   |
  |   { resetToken, newPass }    |-- Validate Password Policy       |                                   |
  |                              |-- Verify Token & Single-Use ---->| Check `token_hash` & `used_at`    |
  |                              |-- Hash new password (bcrypt 10)->| Update `users.password`           |
  |                              |-- Invalidate Sessions ---------->| Record revocation timestamp       |
  |<-- 200 Success Message ------|                                  |                                   |
```

---

## 2. Security Parameters & Lifetimes

- **OTP Format:** Cryptographically secure random 6 numeric digits generated using `crypto.randomInt(100000, 1000000)` (Node.js CSPRNG). `Math.random()` is prohibited.
- **OTP Lifetime:** 10 minutes (600 seconds) from generation.
- **Verification Attempt Limit:** Maximum 5 attempts. Each invalid attempt increments the counter. On the 5th failed attempt, the OTP is permanently invalidated.
- **Resend Cooldown:** Minimum 60 seconds between OTP requests per email address.
- **Request Rate Limit:** Maximum 3 password reset requests per email address within any 15-minute sliding window.
- **IP Rate Limit:** Maximum 10 password reset requests per client IP address within any 15-minute sliding window.
- **Fail-Closed Rate Limiting:** If Redis is temporarily offline, rate limits and cooldowns remain strictly enforced via PostgreSQL transactional records and in-memory rate-limiter fallback. Redis failure can never create an unlimited OTP generation path.

---

## 3. Cryptographic Storage & Privacy

1. **Zero Plaintext Storage:** The raw 6-digit OTP is never stored in the database, Redis, or memory dumps. Only a keyed HMAC-SHA256 digest is stored:
   $$\text{otpHash} = \text{HMAC-SHA256}(\text{JWT\_SECRET}, \text{otp})$$
2. **Timing-Safe Comparison:** OTP verification uses `crypto.timingSafeEqual` across constant-length buffers, preventing side-channel timing attacks.
3. **No Account Enumeration:** `POST /auth/forgot-password` and `POST /auth/resend-reset-otp` always return the exact generic confirmation:
   > *"If an account exists for this email, a password reset OTP has been sent."*
   Regardless of whether the account exists, is active, inactive, or invalid, no internal information (roles, staff IDs, agent IDs) is ever returned. Constant-time dummy hashing is executed when an email is not found to prevent timing discrepancy enumeration.
4. **Log Masking:** Logs never contain OTPs, reset authorization tokens, plaintext passwords, or unmasked email addresses. All email addresses are masked prior to log output (e.g. `j***e@domain.com`).

---

## 4. Reset Authorization Token Behavior

- **Purpose Scoping:** The token issued upon successful OTP verification is a dedicated JWT signed with `purpose: 'password_reset'`.
- **API Guarding:** `JwtStrategy` validates that incoming requests do not carry `purpose === 'password_reset'`. Reset authorization tokens are explicitly rejected if presented to operational application APIs.
- **Single-Use Enforcement:** The reset token's hash is stored in `password_resets.token_hash`. Upon successful password update, the record is immediately stamped with `used_at = NOW()`, preventing token replay.
- **Decoupled Identity:** The client never passes internal identifiers (`userId`, `staffId`, `role`, `domain`). The backend resolves the target account solely from the internal token claim and database record.

---

## 5. Session Revocation & Password Policy

- **Session Invalidation:** When a password reset succeeds, a revocation timestamp is stored in Redis (`auth:password_changed:${userId}`) and memory. `JwtStrategy` rejects any existing JWT whose issued-at timestamp (`iat`) precedes the password reset event, invalidating active sessions across devices.
- **Password Policy:**
  - Minimum 8 characters.
  - Leading and trailing whitespace is rejected.
  - Confirmation password must match exactly.
  - Stored using standard `bcrypt` with salt rounds = 10 (matching the existing operational system).

---

## 6. Email Provider Integration

- **Hostinger Mail API:** Leverages the existing Hostinger transactional mail service (`/api/v1/mailboxes/{resourceId}/send`).
- **Outgoing Address:** Authenticated sender configured via `HOSTINGER_MAILBOX` (default `ticket@ongcnavratri.tech`).
- **Template Security:** Clean HTML and text templates with ONGC branding, strictly displaying the 6-digit OTP and 10-minute expiry warning. Contains no user PII, roles, or internal account details.
