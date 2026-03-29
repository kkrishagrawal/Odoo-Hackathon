const { randomUUID } = require("node:crypto");

const { prisma } = require("../data/db");
const { AppError } = require("../middleware/error.middleware");

const PENDING_APPROVAL_STATUSES = ["Submitted", "Waiting Approval"];

function mapExpense(expense) {
  return {
    id: expense.id,
    employee: expense.user ? expense.user.fullName : "",
    description: expense.description,
    expenseDate: expense.expenseDate,
    category: expense.category,
    paidBy: expense.paidBy,
    remarks: expense.remarks,
    amount: expense.amount,
    currency: expense.currency,
    status: expense.status,
    receiptUrl: expense.receiptUrl,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

const EXPENSE_SELECT = {
  id: true,
  description: true,
  expenseDate: true,
  category: true,
  paidBy: true,
  remarks: true,
  amount: true,
  currency: true,
  status: true,
  receiptUrl: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      companyId: true,
    },
  },
};

function isManagerAuthorizedForRule(rule, managerId) {
  if (!rule) {
    return false;
  }

  const hasManagerAccess =
    rule.includeManagerApprover && rule.managerUserId && rule.managerUserId === managerId;

  const hasApproverAccess = rule.approvers.some(
    (approver) => approver.approverUserId === managerId
  );

  return Boolean(hasManagerAccess || hasApproverAccess);
}

async function assertManagerAccess(managerId, companyId) {
  const manager = await prisma.user.findFirst({
    where: {
      id: managerId,
      companyId,
      role: "manager",
    },
    select: {
      id: true,
    },
  });

  if (!manager) {
    throw new AppError(403, "Only managers can access approval requests", "FORBIDDEN");
  }
}

async function listUserExpenses(userId) {
  const expenses = await prisma.expense.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: EXPENSE_SELECT,
  });

  return expenses.map(mapExpense);
}

async function createExpense(userId, input) {
  const expense = await prisma.expense.create({
    data: {
      id: randomUUID(),
      userId,
      description: input.description,
      expenseDate: input.expenseDate,
      category: input.category,
      paidBy: input.paidBy || "",
      remarks: input.remarks || "",
      amount: input.amount,
      currency: input.currency,
      status: "Draft",
      receiptUrl: input.receiptUrl || "",
    },
    select: EXPENSE_SELECT,
  });

  return mapExpense(expense);
}

async function updateExpense(userId, expenseId, input) {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, userId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new AppError(404, "Expense not found", "EXPENSE_NOT_FOUND");
  }

  if (existing.status !== "Draft") {
    throw new AppError(400, "Only draft expenses can be edited", "EXPENSE_NOT_DRAFT");
  }

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      description: input.description,
      expenseDate: input.expenseDate,
      category: input.category,
      paidBy: input.paidBy ?? "",
      remarks: input.remarks ?? "",
      amount: input.amount,
      currency: input.currency,
      receiptUrl: input.receiptUrl ?? "",
    },
    select: EXPENSE_SELECT,
  });

  return mapExpense(expense);
}

async function submitExpense(userId, expenseId) {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, userId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new AppError(404, "Expense not found", "EXPENSE_NOT_FOUND");
  }

  if (existing.status !== "Draft") {
    throw new AppError(400, "Only draft expenses can be submitted", "EXPENSE_NOT_DRAFT");
  }

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: { status: "Submitted" },
    select: EXPENSE_SELECT,
  });

  return mapExpense(expense);
}

async function listManagerApprovalExpenses(managerId, companyId) {
  await assertManagerAccess(managerId, companyId);

  const rules = await prisma.approvalRule.findMany({
    where: {
      companyId,
      OR: [
        {
          includeManagerApprover: true,
          managerUserId: managerId,
        },
        {
          approvers: {
            some: {
              approverUserId: managerId,
            },
          },
        },
      ],
    },
    select: {
      targetUserId: true,
    },
  });

  const targetUserIds = [...new Set(rules.map((rule) => rule.targetUserId))];

  if (!targetUserIds.length) {
    return [];
  }

  const expenses = await prisma.expense.findMany({
    where: {
      userId: {
        in: targetUserIds,
      },
      status: {
        in: PENDING_APPROVAL_STATUSES,
      },
      user: {
        companyId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: EXPENSE_SELECT,
  });

  return expenses.map(mapExpense);
}

async function approveExpenseAsManager(managerId, companyId, expenseId) {
  await assertManagerAccess(managerId, companyId);

  const expense = await prisma.expense.findUnique({
    where: {
      id: expenseId,
    },
    select: {
      id: true,
      userId: true,
      status: true,
      user: {
        select: {
          companyId: true,
        },
      },
    },
  });

  if (!expense || expense.user.companyId !== companyId) {
    throw new AppError(404, "Expense not found", "EXPENSE_NOT_FOUND");
  }

  if (!PENDING_APPROVAL_STATUSES.includes(expense.status)) {
    throw new AppError(
      400,
      "Only submitted expenses can be approved",
      "EXPENSE_NOT_PENDING_APPROVAL"
    );
  }

  const rule = await prisma.approvalRule.findFirst({
    where: {
      companyId,
      targetUserId: expense.userId,
    },
    select: {
      managerUserId: true,
      includeManagerApprover: true,
      approvers: {
        select: {
          approverUserId: true,
        },
      },
    },
  });

  if (!isManagerAuthorizedForRule(rule, managerId)) {
    throw new AppError(
      403,
      "You are not assigned as approver for this expense",
      "NOT_ASSIGNED_APPROVER"
    );
  }

  const approvedExpense = await prisma.expense.update({
    where: {
      id: expenseId,
    },
    data: {
      status: "Approved",
    },
    select: EXPENSE_SELECT,
  });

  return mapExpense(approvedExpense);
}

async function getCompanyExpenseStats(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { baseCurrency: true },
  });

  if (!company) {
    throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
  }

  const baseCurrency = company.baseCurrency;

  const expenses = await prisma.expense.findMany({
    where: {
      user: { companyId },
    },
    select: {
      amount: true,
      currency: true,
      status: true,
    },
  });

  // Build per-currency breakdowns
  const pendingByCurrency = {};
  const approvedByCurrency = {};

  for (const exp of expenses) {
    const cur = exp.currency.trim();

    if (PENDING_APPROVAL_STATUSES.includes(exp.status)) {
      pendingByCurrency[cur] = (pendingByCurrency[cur] || 0) + exp.amount;
    } else if (exp.status === "Approved") {
      approvedByCurrency[cur] = (approvedByCurrency[cur] || 0) + exp.amount;
    }
  }

  // Collect all unique currencies that need conversion
  const allCurrencies = [
    ...new Set([
      ...Object.keys(pendingByCurrency),
      ...Object.keys(approvedByCurrency),
    ]),
  ];

  // Fetch exchange rates for the base currency
  let rates = {};
  if (allCurrencies.length > 0) {
    try {
      const apiKey = process.env.EXCHANGE_RATE_API_KEY;
      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
      );
      const data = await response.json();

      if (data.result === "success") {
        rates = data.conversion_rates;
      }
    } catch (_err) {
      // If API fails, rates stay empty — conversion will use 1:1 fallback
    }
  }

  // Convert each currency amount to baseCurrency
  function convertToBase(amount, fromCurrency) {
    if (fromCurrency === baseCurrency) {
      return amount;
    }

    const fromRate = rates[fromCurrency];
    if (!fromRate || fromRate === 0) {
      return amount; // fallback: 1:1
    }

    // rates are FROM baseCurrency → fromCurrency
    // so to convert FROM fromCurrency → baseCurrency: amount / fromRate
    return amount / fromRate;
  }

  let pendingTotalConverted = 0;
  let approvedTotalConverted = 0;

  for (const [cur, amt] of Object.entries(pendingByCurrency)) {
    pendingTotalConverted += convertToBase(amt, cur);
  }

  for (const [cur, amt] of Object.entries(approvedByCurrency)) {
    approvedTotalConverted += convertToBase(amt, cur);
  }

  return {
    baseCurrency,
    pendingByCurrency,
    approvedByCurrency,
    pendingTotalConverted: Math.round(pendingTotalConverted * 100) / 100,
    approvedTotalConverted: Math.round(approvedTotalConverted * 100) / 100,
  };
}

module.exports = {
  listUserExpenses,
  createExpense,
  updateExpense,
  submitExpense,
  listManagerApprovalExpenses,
  approveExpenseAsManager,
  getCompanyExpenseStats,
};
