const { AppError } = require("./error.middleware");

function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    const role = req.auth?.role;

    if (!role || !allowedRoles.includes(role)) {
      return next(new AppError(403, "Forbidden", "FORBIDDEN"));
    }

    return next();
  };
}

module.exports = {
  requireRole,
};
