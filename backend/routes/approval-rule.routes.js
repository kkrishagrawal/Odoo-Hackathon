const express = require("express");

const approvalRuleController = require("../controllers/approval-rule.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { authWriteLimiter } = require("../middleware/rate-limit.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", approvalRuleController.listApprovalRules);
router.post("/", authWriteLimiter, approvalRuleController.createApprovalRule);
router.delete("/:ruleId", authWriteLimiter, approvalRuleController.removeApprovalRule);

module.exports = router;
