const { randomUUID } = require("node:crypto");

const { prisma } = require("../data/db");
const { AppError } = require("../middleware/error.middleware");

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
      fullName: true,
    },
  },
};

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

module.exports = {
  listUserExpenses,
  createExpense,
  updateExpense,
  submitExpense,
};
