const express = require("express");

const uploadController = require("../controllers/upload.controller");

const router = express.Router();

router.post("/receipt", uploadController.uploadReceipt);

module.exports = router;
