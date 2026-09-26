-- Create partial unique indexes to enforce at most 1 active E-Pass Admin and 1 active Employee Admin
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_commercial_admin"
ON "users" ("role")
WHERE "role" = 'COMMERCIAL_ADMIN' AND "is_active" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_employee_admin"
ON "users" ("role")
WHERE "role" = 'EMPLOYEE_ADMIN' AND "is_active" = true;
