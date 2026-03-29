const express = require("express");

const expenseController = require("../controllers/expense.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(requireAuth, requireRole("employee"));

router.get("/", expenseController.list);
router.post("/", expenseController.create);
router.patch("/:id", expenseController.update);
router.post("/:id/submit", expenseController.submit);

module.exports = router;
