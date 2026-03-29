ALTER TABLE "users"
  DROP CONSTRAINT IF EXISTS "users_role_check";

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_check"
  CHECK (role IN ('admin', 'manager', 'employee'));

DROP INDEX IF EXISTS "users_company_id_key";

CREATE INDEX IF NOT EXISTS "users_company_id_idx" ON "users" ("company_id");
