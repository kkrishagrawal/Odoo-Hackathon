const bcrypt = require("bcryptjs");
const { env } = require("./env");

async function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, env.BCRYPT_ROUNDS);
}

async function verifyPassword(plainTextPassword, hashedPassword) {
  return bcrypt.compare(plainTextPassword, hashedPassword);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
