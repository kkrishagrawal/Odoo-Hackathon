CREATE TABLE "approval_rules" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "manager_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "description" TEXT,
  "include_manager_approver" BOOLEAN NOT NULL DEFAULT true,
  "require_sequential" BOOLEAN NOT NULL DEFAULT false,
  "minimum_approval_percent" INTEGER NOT NULL DEFAULT 100,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_rules_minimum_approval_percent_check" CHECK ("minimum_approval_percent" >= 1 AND "minimum_approval_percent" <= 100)
);

CREATE INDEX "approval_rules_company_id_idx" ON "approval_rules" ("company_id");
CREATE INDEX "approval_rules_target_user_id_idx" ON "approval_rules" ("target_user_id");
CREATE INDEX "approval_rules_manager_user_id_idx" ON "approval_rules" ("manager_user_id");
CREATE UNIQUE INDEX "approval_rules_company_target_user_unique_idx" ON "approval_rules" ("company_id", "target_user_id");

CREATE TABLE "approval_rule_approvers" (
  "id" UUID NOT NULL,
  "approval_rule_id" UUID NOT NULL,
  "approver_user_id" UUID NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "approval_rule_approvers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_rule_approvers_rule_id_idx" ON "approval_rule_approvers" ("approval_rule_id");
CREATE INDEX "approval_rule_approvers_approver_user_id_idx" ON "approval_rule_approvers" ("approver_user_id");
CREATE UNIQUE INDEX "approval_rule_approvers_rule_approver_unique_idx" ON "approval_rule_approvers" ("approval_rule_id", "approver_user_id");

ALTER TABLE "approval_rules"
  ADD CONSTRAINT "approval_rules_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_rules"
  ADD CONSTRAINT "approval_rules_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_rules"
  ADD CONSTRAINT "approval_rules_manager_user_id_fkey"
  FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_rules"
  ADD CONSTRAINT "approval_rules_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_rule_approvers"
  ADD CONSTRAINT "approval_rule_approvers_approval_rule_id_fkey"
  FOREIGN KEY ("approval_rule_id") REFERENCES "approval_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_rule_approvers"
  ADD CONSTRAINT "approval_rule_approvers_approver_user_id_fkey"
  FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
