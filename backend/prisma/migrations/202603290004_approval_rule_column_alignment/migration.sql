DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_rules' AND column_name = 'manager_id'
  ) THEN
    ALTER TABLE "approval_rules" RENAME COLUMN "manager_id" TO "manager_user_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_rules' AND column_name = 'created_by_id'
  ) THEN
    ALTER TABLE "approval_rules" RENAME COLUMN "created_by_id" TO "created_by_user_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_rules' AND column_name = 'is_manager_approver'
  ) THEN
    ALTER TABLE "approval_rules" RENAME COLUMN "is_manager_approver" TO "include_manager_approver";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_rules' AND column_name = 'approvers_sequence'
  ) THEN
    ALTER TABLE "approval_rules" RENAME COLUMN "approvers_sequence" TO "require_sequential";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_rules' AND column_name = 'minimum_approval_percentage'
  ) THEN
    ALTER TABLE "approval_rules" RENAME COLUMN "minimum_approval_percentage" TO "minimum_approval_percent";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_rule_approvers' AND column_name = 'approver_id'
  ) THEN
    ALTER TABLE "approval_rule_approvers" RENAME COLUMN "approver_id" TO "approver_user_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_rule_approvers' AND column_name = 'sequence'
  ) THEN
    ALTER TABLE "approval_rule_approvers" RENAME COLUMN "sequence" TO "sort_order";
  END IF;
END $$;

ALTER TABLE "approval_rules"
  DROP CONSTRAINT IF EXISTS "approval_rules_manager_id_fkey";

ALTER TABLE "approval_rules"
  DROP CONSTRAINT IF EXISTS "approval_rules_created_by_id_fkey";

ALTER TABLE "approval_rules"
  DROP CONSTRAINT IF EXISTS "approval_rules_manager_user_id_fkey";

ALTER TABLE "approval_rules"
  DROP CONSTRAINT IF EXISTS "approval_rules_created_by_user_id_fkey";

ALTER TABLE "approval_rules"
  ADD CONSTRAINT "approval_rules_manager_user_id_fkey"
  FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_rules"
  ADD CONSTRAINT "approval_rules_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_rule_approvers"
  DROP CONSTRAINT IF EXISTS "approval_rule_approvers_approver_id_fkey";

ALTER TABLE "approval_rule_approvers"
  DROP CONSTRAINT IF EXISTS "approval_rule_approvers_rule_id_fkey";

ALTER TABLE "approval_rule_approvers"
  DROP CONSTRAINT IF EXISTS "approval_rule_approvers_approver_user_id_fkey";

ALTER TABLE "approval_rule_approvers"
  DROP CONSTRAINT IF EXISTS "approval_rule_approvers_approval_rule_id_fkey";

ALTER TABLE "approval_rule_approvers"
  ADD CONSTRAINT "approval_rule_approvers_approval_rule_id_fkey"
  FOREIGN KEY ("approval_rule_id") REFERENCES "approval_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_rule_approvers"
  ADD CONSTRAINT "approval_rule_approvers_approver_user_id_fkey"
  FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "approval_rule_approvers_approver_id_idx";
DROP INDEX IF EXISTS "approval_rule_approvers_rule_approver_unique";
DROP INDEX IF EXISTS "approval_rule_approvers_rule_sequence_unique";

CREATE INDEX IF NOT EXISTS "approval_rules_manager_user_id_idx" ON "approval_rules" ("manager_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_rules_company_target_user_unique_idx" ON "approval_rules" ("company_id", "target_user_id");
CREATE INDEX IF NOT EXISTS "approval_rule_approvers_approver_user_id_idx" ON "approval_rule_approvers" ("approver_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_rule_approvers_rule_approver_unique_idx" ON "approval_rule_approvers" ("approval_rule_id", "approver_user_id");

ALTER TABLE "approval_rules"
  DROP CONSTRAINT IF EXISTS "approval_rules_minimum_approval_percentage_check";

ALTER TABLE "approval_rules"
  DROP CONSTRAINT IF EXISTS "approval_rules_minimum_approval_percent_check";

ALTER TABLE "approval_rules"
  ADD CONSTRAINT "approval_rules_minimum_approval_percent_check"
  CHECK ("minimum_approval_percent" >= 1 AND "minimum_approval_percent" <= 100);
