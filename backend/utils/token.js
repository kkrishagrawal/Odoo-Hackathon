const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { env } = require("./env");

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function createOpaqueToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function hashOpaqueToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  createAccessToken,
  verifyAccessToken,
  createOpaqueToken,
  hashOpaqueToken,
};
