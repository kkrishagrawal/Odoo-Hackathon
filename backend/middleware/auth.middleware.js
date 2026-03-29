const { env } = require("../utils/env");
const { AppError } = require("./error.middleware");
const { verifyAccessToken } = require("../utils/token");

function getAccessTokenFromRequest(req) {
  const header = req.get("authorization");
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  return req.cookies?.[env.ACCESS_TOKEN_COOKIE_NAME] || null;
}

function requireAuth(req, _res, next) {
  const token = getAccessTokenFromRequest(req);

  if (!token) {
    return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      companyId: payload.companyId,
      role: payload.role,
      email: payload.email,
    };
    return next();
  } catch (_error) {
    return next(new AppError(401, "Invalid or expired access token", "UNAUTHORIZED"));
  }
}

module.exports = {
  requireAuth,
};
