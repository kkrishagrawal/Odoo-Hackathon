const { z } = require("zod");

const expenseService = require("../services/expense.service");
const { AppError } = require("../middleware/error.middleware");
const { asyncHandler } = require("../utils/async-handler");

const VALID_CATEGORIES = [
  "Food",
  "Travel",
  "Office Supplies",
  "Utilities",
  "Entertainment",
  "Accommodation",
  "Transport",
  "Medical",
  "Other",
];

const VALID_CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY"];

const expenseBodySchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(500, "Description must not exceed 500 characters"),
  expenseDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be in YYYY-MM-DD format"),
  category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({ message: "Invalid category" }),
  }),
  paidBy: z.string().trim().max(200).optional().default(""),
  remarks: z.string().trim().max(1000).optional().default(""),
  amount: z.number().positive("Amount must be greater than zero"),
  currency: z.enum(VALID_CURRENCIES, {
    errorMap: () => ({ message: "Invalid currency" }),
  }),
  receiptUrl: z.string().trim().max(2048).optional().default(""),
});

const idParamSchema = z.object({
  id: z.string().uuid("Invalid expense id"),
});

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new AppError(400, "Validation failed", "VALIDATION_ERROR", parsed.error.flatten());
  }

  return parsed.data;
}

const list = asyncHandler(async (req, res) => {
  const expenses = await expenseService.listUserExpenses(req.auth.userId);
  res.status(200).json({ expenses });
});

const listApprovals = asyncHandler(async (req, res) => {
  const expenses = await expenseService.listManagerApprovalExpenses(
    req.auth.userId,
    req.auth.companyId
  );

  res.status(200).json({ expenses });
});

const create = asyncHandler(async (req, res) => {
  const payload = parseBody(expenseBodySchema, req.body);
  const expense = await expenseService.createExpense(req.auth.userId, payload);

  res.status(201).json({
    message: "Expense created successfully",
    expense,
  });
});

const update = asyncHandler(async (req, res) => {
  const params = parseBody(idParamSchema, req.params);
  const payload = parseBody(expenseBodySchema, req.body);

  const expense = await expenseService.updateExpense(req.auth.userId, params.id, payload);

  res.status(200).json({
    message: "Expense updated successfully",
    expense,
  });
});

const submit = asyncHandler(async (req, res) => {
  const params = parseBody(idParamSchema, req.params);
  const expense = await expenseService.submitExpense(req.auth.userId, params.id);

  res.status(200).json({
    message: "Expense submitted successfully",
    expense,
  });
});

const approve = asyncHandler(async (req, res) => {
  const params = parseBody(idParamSchema, req.params);
  const expense = await expenseService.approveExpenseAsManager(
    req.auth.userId,
    req.auth.companyId,
    params.id
  );

  res.status(200).json({
    message: "Expense approved successfully",
    expense,
  });
});

module.exports = {
  list,
  listApprovals,
  create,
  update,
  submit,
  approve,
};
