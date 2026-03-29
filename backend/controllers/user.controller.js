const { z } = require("zod");

const userService = require("../services/user.service");
const { AppError } = require("../middleware/error.middleware");
const { asyncHandler } = require("../utils/async-handler");

const createUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  role: z.enum(["manager", "employee"], {
    errorMap: () => ({ message: "Role must be manager or employee" }),
  }),
});

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new AppError(400, "Validation failed", "VALIDATION_ERROR", parsed.error.flatten());
  }

  return parsed.data;
}

const listUsers = asyncHandler(async (req, res) => {
  const users = await userService.listCompanyUsers({
    requesterId: req.auth.userId,
    companyId: req.auth.companyId,
  });

  res.status(200).json({ users });
});

const createUser = asyncHandler(async (req, res) => {
  const payload = parseBody(createUserSchema, req.body);

  const user = await userService.createCompanyUser({
    requesterId: req.auth.userId,
    companyId: req.auth.companyId,
    input: payload,
  });

  res.status(201).json({
    message: "User account created and credentials sent successfully",
    user,
  });
});

const sendCredentials = asyncHandler(async (req, res) => {
  const paramsSchema = z.object({
    userId: z.string().uuid("Invalid user id"),
  });

  const parsedParams = paramsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    throw new AppError(400, "Validation failed", "VALIDATION_ERROR", parsedParams.error.flatten());
  }

  const user = await userService.resendUserCredentials({
    requesterId: req.auth.userId,
    companyId: req.auth.companyId,
    userId: parsedParams.data.userId,
  });

  res.status(200).json({
    message: "Credentials email sent successfully",
    user,
  });
});

const removeUser = asyncHandler(async (req, res) => {
  const paramsSchema = z.object({
    userId: z.string().uuid("Invalid user id"),
  });

  const parsedParams = paramsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    throw new AppError(400, "Validation failed", "VALIDATION_ERROR", parsedParams.error.flatten());
  }

  const user = await userService.removeCompanyUser({
    requesterId: req.auth.userId,
    companyId: req.auth.companyId,
    userId: parsedParams.data.userId,
  });

  res.status(200).json({
    message: "User removed successfully",
    user,
  });
});

module.exports = {
  listUsers,
  createUser,
  sendCredentials,
  removeUser,
};
