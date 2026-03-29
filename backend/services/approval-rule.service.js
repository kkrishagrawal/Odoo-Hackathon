const { randomUUID } = require("node:crypto");

const { prisma } = require("../data/db");
const { AppError } = require("../middleware/error.middleware");

function mapApprovalRule(rule) {
  return {
    id: rule.id,
    companyId: rule.companyId,
    targetUser: {
      id: rule.targetUser.id,
      fullName: rule.targetUser.fullName,
      email: rule.targetUser.email,
      role: rule.targetUser.role,
    },
    managerUser: rule.managerUser
      ? {
          id: rule.managerUser.id,
          fullName: rule.managerUser.fullName,
          email: rule.managerUser.email,
          role: rule.managerUser.role,
        }
      : null,
    description: rule.description,
    includeManagerApprover: rule.includeManagerApprover,
    requireSequential: rule.requireSequential,
    minimumApprovalPercent: rule.minimumApprovalPercent,
    approvers: rule.approvers.map((approver) => ({
      id: approver.id,
      userId: approver.approverUser.id,
      fullName: approver.approverUser.fullName,
      email: approver.approverUser.email,
      role: approver.approverUser.role,
      isRequired: approver.isRequired,
      sortOrder: approver.sortOrder,
    })),
    createdBy: {
      id: rule.createdByUser.id,
      fullName: rule.createdByUser.fullName,
      email: rule.createdByUser.email,
    },
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

async function assertAdminAccess({ requesterId, companyId }) {
  const admin = await prisma.user.findFirst({
    where: {
      id: requesterId,
      companyId,
      role: "admin",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      companyId: true,
    },
  });

  if (!admin) {
    throw new AppError(403, "Only company admins can manage approval rules", "FORBIDDEN");
  }

  return admin;
}

async function listApprovalRules({ requesterId, companyId }) {
  await assertAdminAccess({ requesterId, companyId });

  const rules = await prisma.approvalRule.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      targetUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      managerUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      approvers: {
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          approverUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  return rules.map(mapApprovalRule);
}

async function validateRuleActors({ companyId, targetUserId, managerUserId, approvers }) {
  const actorIds = new Set([targetUserId, ...approvers.map((approver) => approver.userId)]);

  if (managerUserId) {
    actorIds.add(managerUserId);
  }

  const users = await prisma.user.findMany({
    where: {
      companyId,
      id: {
        in: [...actorIds],
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  const userById = new Map(users.map((user) => [user.id, user]));

  const targetUser = userById.get(targetUserId);
  if (!targetUser) {
    throw new AppError(404, "Target user was not found in your company", "USER_NOT_FOUND");
  }

  if (targetUser.role === "admin") {
    throw new AppError(400, "Cannot assign approval rules to admin users", "INVALID_TARGET_USER");
  }

  if (managerUserId) {
    const managerUser = userById.get(managerUserId);

    if (!managerUser) {
      throw new AppError(404, "Selected manager was not found in your company", "USER_NOT_FOUND");
    }

    if (managerUser.role !== "manager") {
      throw new AppError(400, "Selected manager must have manager role", "INVALID_MANAGER");
    }

    if (managerUserId === targetUserId) {
      throw new AppError(400, "Manager cannot be the same as target user", "INVALID_MANAGER");
    }
  }

  for (const approver of approvers) {
    const approverUser = userById.get(approver.userId);

    if (!approverUser) {
      throw new AppError(404, "One or more approvers were not found in your company", "USER_NOT_FOUND");
    }

    if (approverUser.role !== "manager") {
      throw new AppError(400, "All approvers must have manager role", "INVALID_APPROVER");
    }

    if (approver.userId === targetUserId) {
      throw new AppError(400, "Target user cannot be assigned as an approver", "INVALID_APPROVER");
    }
  }
}

function normalizeApprovers(approvers) {
  const seen = new Set();
  const normalized = [];

  for (const approver of approvers) {
    if (seen.has(approver.userId)) {
      continue;
    }

    seen.add(approver.userId);
    normalized.push({
      userId: approver.userId,
      isRequired: Boolean(approver.isRequired),
    });
  }

  return normalized;
}

async function createApprovalRule({ requesterId, companyId, input }) {
  await assertAdminAccess({ requesterId, companyId });

  const approvers = normalizeApprovers(input.approvers || []);

  if (approvers.length === 0) {
    throw new AppError(400, "At least one approver is required", "INVALID_APPROVERS");
  }

  if (input.includeManagerApprover && !input.managerUserId) {
    throw new AppError(
      400,
      "Manager is required when manager approver is enabled",
      "INVALID_MANAGER"
    );
  }

  await validateRuleActors({
    companyId,
    targetUserId: input.targetUserId,
    managerUserId: input.managerUserId,
    approvers,
  });

  const existingRule = await prisma.approvalRule.findFirst({
    where: {
      companyId,
      targetUserId: input.targetUserId,
    },
    select: {
      id: true,
    },
  });

  if (existingRule) {
    throw new AppError(
      409,
      "An approval rule already exists for this user",
      "APPROVAL_RULE_ALREADY_EXISTS"
    );
  }

  const createdRule = await prisma.approvalRule.create({
    data: {
      id: randomUUID(),
      companyId,
      targetUserId: input.targetUserId,
      managerUserId: input.managerUserId || null,
      createdByUserId: requesterId,
      description: input.description || null,
      includeManagerApprover: input.includeManagerApprover,
      requireSequential: input.requireSequential,
      minimumApprovalPercent: input.minimumApprovalPercent,
      approvers: {
        create: approvers.map((approver, index) => ({
          id: randomUUID(),
          approverUserId: approver.userId,
          isRequired: approver.isRequired,
          sortOrder: index + 1,
        })),
      },
    },
    include: {
      targetUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      managerUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      approvers: {
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          approverUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  return mapApprovalRule(createdRule);
}

async function removeApprovalRule({ requesterId, companyId, approvalRuleId }) {
  await assertAdminAccess({ requesterId, companyId });

  const existingRule = await prisma.approvalRule.findFirst({
    where: {
      id: approvalRuleId,
      companyId,
    },
    include: {
      targetUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!existingRule) {
    throw new AppError(404, "Approval rule not found", "APPROVAL_RULE_NOT_FOUND");
  }

  await prisma.approvalRule.delete({
    where: {
      id: existingRule.id,
    },
  });

  return {
    id: existingRule.id,
    targetUser: {
      id: existingRule.targetUser.id,
      fullName: existingRule.targetUser.fullName,
      email: existingRule.targetUser.email,
      role: existingRule.targetUser.role,
    },
  };
}

module.exports = {
  listApprovalRules,
  createApprovalRule,
  removeApprovalRule,
};
