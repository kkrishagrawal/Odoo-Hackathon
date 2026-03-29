const { randomInt, randomUUID } = require("node:crypto");

const { prisma } = require("../data/db");
const { AppError } = require("../middleware/error.middleware");
const { hashPassword } = require("../utils/password");
const { sendUserCredentialsEmail } = require("../utils/mail");

const USER_ROLES = ["manager", "employee"];

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function generateTemporaryPassword(length = 14) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%&*!";
  const allChars = `${upper}${lower}${digits}${symbols}`;

  const picks = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];

  while (picks.length < length) {
    picks.push(allChars[randomInt(allChars.length)]);
  }

  for (let index = picks.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [picks[index], picks[swapIndex]] = [picks[swapIndex], picks[index]];
  }

  return picks.join("");
}

async function assertAdminAccess({ requesterId, companyId }) {
  const admin = await prisma.user.findFirst({
    where: {
      id: requesterId,
      companyId,
      role: "admin",
    },
    include: {
      company: true,
    },
  });

  if (!admin) {
    throw new AppError(403, "Only company admins can manage users", "FORBIDDEN");
  }

  return admin;
}

function mapUserListItem(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function listCompanyUsers({ requesterId, companyId }) {
  await assertAdminAccess({ requesterId, companyId });

  const users = await prisma.user.findMany({
    where: {
      companyId,
      role: {
        in: ["manager", "employee"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return users.map(mapUserListItem);
}

async function createCompanyUser({ requesterId, companyId, input }) {
  const admin = await assertAdminAccess({ requesterId, companyId });

  if (!USER_ROLES.includes(input.role)) {
    throw new AppError(400, "Role must be manager or employee", "INVALID_ROLE");
  }

  const normalizedEmail = normalizeEmail(input.email);

  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
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

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const createdUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      companyId,
      fullName: input.fullName,
      email: normalizedEmail,
      passwordHash,
      role: input.role,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  try {
    await sendUserCredentialsEmail({
      to: createdUser.email,
      fullName: createdUser.fullName,
      companyName: admin.company.name,
      role: createdUser.role,
      temporaryPassword,
      createdBy: admin.fullName,
    });
  } catch (error) {
    await prisma.user.delete({ where: { id: createdUser.id } });
    throw new AppError(
      502,
      "Unable to deliver credentials email. User creation was rolled back.",
      "EMAIL_DELIVERY_FAILED"
    );
  }

  return mapUserListItem(createdUser);
}

async function resendUserCredentials({ requesterId, companyId, userId }) {
  const admin = await assertAdminAccess({ requesterId, companyId });

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      companyId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  if (user.role === "admin") {
    throw new AppError(400, "Cannot reset credentials for admin via this endpoint", "INVALID_ROLE");
  }

  const temporaryPassword = generateTemporaryPassword();
  const nextHash = await hashPassword(temporaryPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: nextHash,
    },
  });

  try {
    await sendUserCredentialsEmail({
      to: user.email,
      fullName: user.fullName,
      companyName: admin.company.name,
      role: user.role,
      temporaryPassword,
      createdBy: admin.fullName,
    });
  } catch (error) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: user.passwordHash,
      },
    });

    throw new AppError(
      502,
      "Unable to deliver credentials email. Password reset was rolled back.",
      "EMAIL_DELIVERY_FAILED"
    );
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

async function removeCompanyUser({ requesterId, companyId, userId }) {
  await assertAdminAccess({ requesterId, companyId });

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      companyId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  if (user.role === "admin") {
    throw new AppError(400, "Cannot remove admin users from this endpoint", "INVALID_ROLE");
  }

  await prisma.user.delete({
    where: {
      id: user.id,
    },
  });

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

module.exports = {
  listCompanyUsers,
  createCompanyUser,
  resendUserCredentials,
  removeCompanyUser,
};
