const { rateLimit } = require("express-rate-limit");

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again later.",
    code: "TOO_MANY_REQUESTS",
  },
});

module.exports = {
  authWriteLimiter,
};
