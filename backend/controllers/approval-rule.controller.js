const { z } = require("zod");

const approvalRuleService = require("../services/approval-rule.service");
const { AppError } = require("../middleware/error.middleware");
const { asyncHandler } = require("../utils/async-handler");

const createApprovalRuleSchema = z.object({
  targetUserId: z.string().uuid("Target user must be a valid user id"),
  managerUserId: z
    .string()
    .uuid("Manager must be a valid user id")
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  description: z
    .string()
    .trim()
    .max(300, "Description must not exceed 300 characters")
    .optional()
    .transform((value) => value || ""),
  includeManagerApprover: z.boolean().default(true),
  requireSequential: z.boolean().default(false),
  minimumApprovalPercent: z
    .number({
      invalid_type_error: "Minimum approval percent must be a number",
    })
    .int("Minimum approval percent must be a whole number")
    .min(1, "Minimum approval percent must be at least 1")
    .max(100, "Minimum approval percent cannot exceed 100")
    .default(100),
  approvers: z
    .array(
      z.object({
        userId: z.string().uuid("Approver must be a valid user id"),
        isRequired: z.boolean().optional().default(false),
      })
    )
    .min(1, "At least one approver is required"),
});

const paramsSchema = z.object({
  ruleId: z.string().uuid("Invalid approval rule id"),
});

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new AppError(400, "Validation failed", "VALIDATION_ERROR", parsed.error.flatten());
  }

  return parsed.data;
}

function parseParams(schema, params) {
  const parsed = schema.safeParse(params);

  if (!parsed.success) {
    throw new AppError(400, "Validation failed", "VALIDATION_ERROR", parsed.error.flatten());
  }

  return parsed.data;
}

const listApprovalRules = asyncHandler(async (req, res) => {
  const rules = await approvalRuleService.listApprovalRules({
    requesterId: req.auth.userId,
    companyId: req.auth.companyId,
  });

  res.status(200).json({ rules });
});

const createApprovalRule = asyncHandler(async (req, res) => {
  const payload = parseBody(createApprovalRuleSchema, req.body);

  const rule = await approvalRuleService.createApprovalRule({
    requesterId: req.auth.userId,
    companyId: req.auth.companyId,
    input: payload,
  });

  res.status(201).json({
    message: "Approval rule created successfully",
    rule,
  });
});

const removeApprovalRule = asyncHandler(async (req, res) => {
  const { ruleId } = parseParams(paramsSchema, req.params);

  const rule = await approvalRuleService.removeApprovalRule({
    requesterId: req.auth.userId,
    companyId: req.auth.companyId,
    approvalRuleId: ruleId,
  });

  res.status(200).json({
    message: "Approval rule removed successfully",
    rule,
  });
});

module.exports = {
  listApprovalRules,
  createApprovalRule,
  removeApprovalRule,
};
