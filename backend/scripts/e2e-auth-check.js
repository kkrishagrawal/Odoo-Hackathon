require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const base = "http://localhost:3001/api/v1";
const stamp = Date.now();
const email = `qa.${stamp}@example.com`;
const password = "Test@12345";
const companyName = `QA Company ${stamp}`;
const fullName = "QA Admin";
const countryCode = "US";

const cookies = {};

function setCookies(response) {
  const setCookieHeader =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];

  for (const cookie of setCookieHeader) {
    const pair = cookie.split(";")[0];
    const separator = pair.indexOf("=");
    if (separator > 0) {
      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      cookies[key] = value;
    }
  }
}

function cookieHeaderValue() {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function run() {
  const signupResponse = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fullName,
      companyName,
      email,
      password,
      confirmPassword: password,
      countryCode,
    }),
  });

  const signupBody = await parseJsonSafe(signupResponse);
  setCookies(signupResponse);

  if (!signupResponse.ok) {
    throw new Error(`Signup failed (${signupResponse.status}): ${JSON.stringify(signupBody)}`);
  }

  const meResponse = await fetch(`${base}/auth/me`, {
    method: "GET",
    headers: {
      cookie: cookieHeaderValue(),
    },
  });

  const meBody = await parseJsonSafe(meResponse);

  if (!meResponse.ok) {
    throw new Error(`Me endpoint failed (${meResponse.status}): ${JSON.stringify(meBody)}`);
  }

  const dbUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    include: {
      company: true,
    },
  });

  if (!dbUser) {
    throw new Error("User was not found in database after signup.");
  }

  console.log(
    JSON.stringify(
      {
        signupMessage: signupBody?.message,
        meEmail: meBody?.user?.email,
        dbEmail: dbUser.email,
        dbCompany: dbUser.company.name,
        dbCurrency: dbUser.company.baseCurrency,
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
