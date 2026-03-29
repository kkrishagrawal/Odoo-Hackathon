const { z } = require("zod");

const authService = require("../services/auth.service");
const { env } = require("../utils/env");
const { asyncHandler } = require("../utils/async-handler");
const { clearAuthCookies, setAuthCookies } = require("../utils/cookies");
const { AppError } = require("../middleware/error.middleware");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must not exceed 72 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must not exceed 100 characters"),
    companyName: z
      .string()
      .trim()
      .min(2, "Company name must be at least 2 characters")
      .max(120, "Company name must not exceed 120 characters"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    countryCode: z.string().trim().length(2, "Please select a valid country"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["admin", "manager", "employee"], {
    errorMap: () => ({ message: "Please select a valid role" }),
  }),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new AppError(400, "Validation failed", "VALIDATION_ERROR", parsed.error.flatten());
  }

  return parsed.data;
}

const signup = asyncHandler(async (req, res) => {
  const payload = parseBody(signupSchema, req.body);

  const result = await authService.signupAdmin(payload);
  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  res.status(201).json({
    message: "Admin account created successfully",
    user: result.user,
  });
});

const login = asyncHandler(async (req, res) => {
  const payload = parseBody(loginSchema, req.body);

  const result = await authService.loginAdmin(payload);
  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  res.status(200).json({
    message: "Signed in successfully",
    user: result.user,
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.auth.userId);
  res.status(200).json({ user });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];
  const result = await authService.refreshSession(refreshToken);

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  res.status(200).json({
    message: "Session refreshed",
    user: result.user,
  });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];
  await authService.logoutSession(refreshToken);

  clearAuthCookies(res);
  res.status(200).json({ message: "Signed out successfully" });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const payload = parseBody(forgotPasswordSchema, req.body);
  const result = await authService.requestPasswordReset(payload.email);

  res.status(200).json({
    message:
      "If an account with that email exists, password reset instructions have been generated.",
    ...(result.resetToken ? { resetToken: result.resetToken } : {}),
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const payload = parseBody(resetPasswordSchema, req.body);
  await authService.resetPassword(payload);

  clearAuthCookies(res);
  res.status(200).json({ message: "Password has been reset successfully" });
});

module.exports = {
  signup,
  login,
  me,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
