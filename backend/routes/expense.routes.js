const express = require("express");

const expenseController = require("../controllers/expense.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", requireRole("employee"), expenseController.list);
router.post("/", requireRole("employee"), expenseController.create);
router.patch("/:id", requireRole("employee"), expenseController.update);
router.post("/:id/submit", requireRole("employee"), expenseController.submit);

router.get("/approvals", requireRole("manager"), expenseController.listApprovals);
router.post("/:id/approve", requireRole("manager"), expenseController.approve);

module.exports = router;
