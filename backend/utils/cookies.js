const { env } = require("./env");

function getBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  const baseOptions = getBaseCookieOptions();

  res.cookie(env.ACCESS_TOKEN_COOKIE_NAME, accessToken, {
    ...baseOptions,
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
  });

  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...baseOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  const baseOptions = getBaseCookieOptions();

  res.clearCookie(env.ACCESS_TOKEN_COOKIE_NAME, baseOptions);
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, baseOptions);
}

module.exports = {
  setAuthCookies,
  clearAuthCookies,
};
