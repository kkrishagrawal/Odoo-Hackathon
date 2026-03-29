const express = require("express");

const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { authWriteLimiter } = require("../middleware/rate-limit.middleware");

const router = express.Router();

router.post("/signup", authWriteLimiter, authController.signup);
router.post("/login", authWriteLimiter, authController.login);
router.get("/me", requireAuth, authController.me);
router.post("/refresh", authWriteLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.post("/forgot-password", authWriteLimiter, authController.forgotPassword);
router.post("/reset-password", authWriteLimiter, authController.resetPassword);

module.exports = router;
