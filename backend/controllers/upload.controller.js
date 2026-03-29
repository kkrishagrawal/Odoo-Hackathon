const cloudinary = require("cloudinary").v2;

const { env } = require("../utils/env");
const { asyncHandler } = require("../utils/async-handler");
const { AppError } = require("../middleware/error.middleware");

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const uploadReceipt = asyncHandler(async (req, res) => {
  const { image, mimeType } = req.body;

  if (!image) {
    throw new AppError(400, "image (base64) is required", "VALIDATION_ERROR");
  }

  const mime = mimeType || "image/jpeg";
  const dataUri = `data:${mime};base64,${image}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "expense-receipts",
    resource_type: "image",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });

  res.status(200).json({
    message: "Receipt uploaded successfully",
    data: {
      url: result.secure_url,
      publicId: result.public_id,
    },
  });
});

module.exports = {
  uploadReceipt,
};
