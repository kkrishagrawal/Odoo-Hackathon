const express = require("express");

const ocrController = require("../controllers/ocr.controller");

const router = express.Router();

router.post("/extract-receipt", ocrController.extractReceipt);

module.exports = router;
