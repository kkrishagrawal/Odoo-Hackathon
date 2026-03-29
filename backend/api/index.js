const express = require("express");

const authRoutes = require("../routes/auth.routes");
const metaRoutes = require("../routes/meta.routes");
const userRoutes = require("../routes/user.routes");
const ocrRoutes = require("../routes/ocr.routes");
const uploadRoutes = require("../routes/upload.routes");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/meta", metaRoutes);
router.use("/users", userRoutes);
router.use("/ocr", ocrRoutes);
router.use("/upload", uploadRoutes);

module.exports = router;
