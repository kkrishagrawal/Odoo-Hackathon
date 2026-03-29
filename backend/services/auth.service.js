const { randomUUID } = require("node:crypto");
const { Prisma } = require("@prisma/client");

const { prisma } = require("../data/db");
const { AppError } = require("../middleware/error.middleware");
const { getCountryByCode } = require("../utils/countries");
const { env } = require("../utils/env");
const { hashPassword, verifyPassword } = require("../utils/password");
const { createAccessToken, createOpaqueToken, hashOpaqueToken } = require("../utils/token");

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function mapUserEntity(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    company: {
      id: user.company.id,
      name: user.company.name,
      countryCode: user.company.countryCode,
      baseCurrency: user.company.baseCurrency,
    },
  };
}

function createAccessTokenPayload(user) {
  return {
    id: user.id,
    companyId: user.company.id,
    role: user.role,
    email: user.email,
  };
}

async function createRefreshTokenRecord(userId, queryable) {
  const refreshToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(refreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await queryable.refreshToken.create({
    data: {
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return refreshToken;
}

function isPrismaUniqueViolation(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function signupAdmin(input) {
  const email = normalizeEmail(input.email);
  const country = await getCountryByCode(input.countryCode);

  if (!country) {
    throw new AppError(400, "Invalid country selection", "INVALID_COUNTRY");
  }

  const hashedPassword = await hashPassword(input.password);

  let result;

  try {
    result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        throw new AppError(409, "Email is already registered", "EMAIL_ALREADY_EXISTS");
      }

      const existingCompany = await tx.company.findFirst({
        where: {
          name: {
            equals: input.companyName,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
        },
      });

      if (existingCompany) {
        throw new AppError(409, "Company name is already registered", "COMPANY_ALREADY_EXISTS");
      }

      const company = await tx.company.create({
        data: {
          id: randomUUID(),
          name: input.companyName,
          countryCode: country.code,
          baseCurrency: country.currencyCode,
        },
      });

      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          companyId: company.id,
          fullName: input.fullName,
          email,
          passwordHash: hashedPassword,
          role: "admin",
        },
        include: {
          company: true,
        },
      });

      const refreshToken = await createRefreshTokenRecord(user.id, tx);

      return {
        user: mapUserEntity(user),
        refreshToken,
      };
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target || "");

      if (target.includes("email")) {
        throw new AppError(409, "Email is already registered", "EMAIL_ALREADY_EXISTS");
      }

      if (target.includes("name")) {
        throw new AppError(409, "Company name is already registered", "COMPANY_ALREADY_EXISTS");
      }
    }

    throw error;
  }

  const accessToken = createAccessToken(createAccessTokenPayload(result.user));

  return {
    user: result.user,
    accessToken,
    refreshToken: result.refreshToken,
  };
}

async function loginAdmin(input) {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
      role: input.role,
    },
    include: {
      company: true,
    },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const isValidPassword = await verifyPassword(input.password, user.passwordHash);

  if (!isValidPassword) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const mappedUser = mapUserEntity(user);
  const refreshToken = await createRefreshTokenRecord(mappedUser.id, prisma);
  const accessToken = createAccessToken(createAccessTokenPayload(mappedUser));

  return {
    user: mappedUser,
    accessToken,
    refreshToken,
  };
}

async function refreshSession(refreshToken) {
  if (!refreshToken) {
    throw new AppError(401, "Missing refresh token", "MISSING_REFRESH_TOKEN");
  }

  const tokenHash = hashOpaqueToken(refreshToken);

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!tokenRecord) {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const user = mapUserEntity(tokenRecord.user);

  const nextRefreshToken = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: {
        id: tokenRecord.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return createRefreshTokenRecord(user.id, tx);
  });

  const accessToken = createAccessToken(createAccessTokenPayload(user));

  return {
    user,
    accessToken,
    refreshToken: nextRefreshToken,
  };
}

async function logoutSession(refreshToken) {
  if (!refreshToken) {
    return;
  }

  const tokenHash = hashOpaqueToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

async function requestPasswordReset(emailInput) {
  const email = normalizeEmail(emailInput);

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return { submitted: true };
  }

  const rawToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000
  );

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await tx.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  return {
    submitted: true,
    resetToken: env.NODE_ENV === "production" ? undefined : rawToken,
  };
}

async function resetPassword(input) {
  const tokenHash = hashOpaqueToken(input.token);

  const tokenRecord = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!tokenRecord) {
    throw new AppError(400, "Invalid or expired reset token", "INVALID_RESET_TOKEN");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: tokenRecord.userId,
      },
      data: {
        passwordHash,
        updatedAt: new Date(),
      },
    });

    await tx.passwordResetToken.update({
      where: {
        id: tokenRecord.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        userId: tokenRecord.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  });
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      company: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  return mapUserEntity(user);
}

module.exports = {
  signupAdmin,
  loginAdmin,
  refreshSession,
  logoutSession,
  requestPasswordReset,
  resetPassword,
  getCurrentUser,
};
