const { GoogleGenerativeAI } = require("@google/generative-ai");

const { env } = require("../utils/env");
const { asyncHandler } = require("../utils/async-handler");
const { AppError } = require("../middleware/error.middleware");

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are an expert receipt / invoice OCR assistant.
Given an image of a receipt or invoice, extract the following fields and return ONLY a valid JSON object with no markdown formatting, no code fences, and no extra text:

{
  "description": "Brief description of what was purchased or the service rendered",
  "expenseDate": "Date on the receipt in YYYY-MM-DD format. If unclear, use today's date.",
  "category": "One of: Food, Travel, Office Supplies, Utilities, Entertainment, Accommodation, Transport, Medical, Other",
  "paidBy": "If specified on bill then get the name of the persopn who has paid for it or keep this empty",
  "totalAmount": <number — the total amount as a plain number, no currency symbol>,
  "currency": "3-letter ISO currency code (e.g. USD, INR, EUR, GBP)",
  "remarks": "Any notable details like tax breakdown, tip, or special notes. Empty string if none."
}

Rules:
- Return ONLY the JSON object, nothing else.
- If a field cannot be determined, use a reasonable default or empty string.
- For totalAmount, always return a number (not a string).
- For currency, infer from symbols ($ = USD, ₹ = INR, € = EUR, £ = GBP) or context.`;

const extractReceipt = asyncHandler(async (req, res) => {
  const { image, mimeType } = req.body;

  if (!image) {
    throw new AppError(400, "image (base64) is required", "VALIDATION_ERROR");
  }

  const mime = mimeType || "image/jpeg";

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    {
      inlineData: {
        mimeType: mime,
        data: image,
      },
    },
  ]);

  const responseText = result.response.text();

  let extracted;
  try {
    const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    extracted = JSON.parse(cleaned);
  } catch {
    throw new AppError(
      500,
      "Failed to parse Gemini response as JSON",
      "OCR_PARSE_ERROR",
      { rawResponse: responseText }
    );
  }

  res.status(200).json({
    message: "Receipt extracted successfully",
    data: extracted,
  });
});

module.exports = {
  extractReceipt,
};
