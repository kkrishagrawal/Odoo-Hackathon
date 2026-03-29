const express = require("express");

const userController = require("../controllers/user.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { authWriteLimiter } = require("../middleware/rate-limit.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", userController.listUsers);
router.post("/", authWriteLimiter, userController.createUser);
router.post("/:userId/send-credentials", authWriteLimiter, userController.sendCredentials);
router.delete("/:userId", authWriteLimiter, userController.removeUser);

module.exports = router;
