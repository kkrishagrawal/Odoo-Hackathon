"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ApiError, AuthUser, apiFetch } from "../../lib/api";

type MeResponse = {
  user: AuthUser;
};

type ApprovalExpenseStatus = "Submitted" | "Waiting Approval";

type ApprovalExpense = {
  id: string;
  employee: string;
  description: string;
  expenseDate: string;
  category: string;
  paidBy: string;
  remarks: string;
  amount: number;
  currency: string;
  status: ApprovalExpenseStatus;
  receiptUrl: string;
  createdAt: string;
  updatedAt: string;
};

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function getStatusBadgeClass(status: ApprovalExpenseStatus) {
  if (status === "Waiting Approval") {
    return "border-[rgba(237,176,97,0.45)] bg-[rgba(66,44,20,0.45)] text-[rgba(246,213,162,0.95)]";
  }

  return "border-[rgba(138,160,186,0.45)] bg-[rgba(25,36,49,0.45)] text-[rgba(189,206,226,0.95)]";
}

export default function ManagerDashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [approvals, setApprovals] = useState<ApprovalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingExpenseId, setApprovingExpenseId] = useState<string | null>(null);

  const totalPendingAmount = useMemo(
    () => approvals.reduce((sum, expense) => sum + expense.amount, 0),
    [approvals]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadManagerView() {
      try {
        const meResponse = await apiFetch<MeResponse>("/auth/me", { method: "GET" });

        if (meResponse.user.role !== "manager") {
          throw new ApiError("You do not have access to manager view", 403, "FORBIDDEN");
        }

        const approvalsResponse = await apiFetch<{ expenses: ApprovalExpense[] }>("/expenses/approvals", {
          method: "GET",
        });

        if (!isMounted) {
          return;
        }

        setUser(meResponse.user);
        setApprovals(approvalsResponse.expenses);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        const message =
          requestError instanceof ApiError
            ? requestError.message
            : "Unable to load manager dashboard.";

        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadManagerView();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleApproveExpense(expenseId: string) {
    setApprovingExpenseId(expenseId);

    try {
      const response = await apiFetch<{ message: string; expense: ApprovalExpense }>(
        `/expenses/${expenseId}/approve`,
        {
          method: "POST",
        }
      );

      toast.success(response.message);
      setApprovals((previous) => previous.filter((expense) => expense.id !== expenseId));
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to approve expense.";
      toast.error(message);
    } finally {
      setApprovingExpenseId(null);
    }
  }

  async function handleLogout() {
    await apiFetch<{ message: string }>("/auth/logout", {
      method: "POST",
      skipRefresh: true,
    });

    router.push("/signin");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-dvh px-4 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-[1080px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 text-sm text-[var(--muted)] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          Loading manager dashboard...
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="min-h-dvh px-4 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h1 className="text-2xl font-semibold text-[var(--chalk)]">Manager dashboard</h1>
          <p className="mt-3 text-sm text-rose-300">{error || "Unable to load manager profile."}</p>
          <Link className="mt-4 inline-block underline underline-offset-4 hover:text-[var(--accent)]" href="/signin">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 py-10 lg:py-14">
      <div className="mx-auto grid w-full max-w-[1080px] gap-4">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.09em] text-[var(--muted)]">MANAGER VIEW</p>
              <h1 className="mt-2 text-[clamp(1.55rem,2vw,2rem)] font-semibold leading-tight text-[var(--chalk)]">
                Expense approvals assigned to you
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                You can only see and approve expenses where approval rules assign you as approver.
              </p>
            </div>
            <button
              className="rounded-lg border border-[rgba(138,160,186,0.5)] bg-[linear-gradient(180deg,rgba(138,160,186,0.26),rgba(138,160,186,0.14))] px-4 py-2 text-sm font-semibold text-[var(--chalk)] transition hover:enabled:-translate-y-px hover:enabled:brightness-105"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[rgba(8,11,15,0.62)] px-4 py-3 text-[var(--chalk)]">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Manager</p>
              <p className="mt-1 font-medium">{user.fullName}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[rgba(8,11,15,0.62)] px-4 py-3 text-[var(--chalk)]">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Pending Requests</p>
              <p className="mt-1 font-medium">{approvals.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[rgba(8,11,15,0.62)] px-4 py-3 text-[var(--chalk)]">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Pending Amount</p>
              <p className="mt-1 font-medium">{formatCurrency(totalPendingAmount, user.company.baseCurrency)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold text-[var(--chalk)]">Approval queue</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Requests appear only when the employee's rule includes you as manager or explicit approver.
          </p>

          {approvals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-[rgba(8,11,15,0.65)] p-4 text-sm text-[var(--muted)]">
              No approval requests assigned to you right now.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-[rgba(7,10,14,0.55)] text-left text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {approvals.map((expense) => (
                    <tr key={expense.id} className="text-[var(--chalk)]">
                      <td className="px-4 py-3">{expense.employee}</td>
                      <td className="px-4 py-3">
                        <p className="max-w-[300px] truncate">{expense.description}</p>
                        {expense.remarks ? (
                          <p className="mt-1 max-w-[300px] truncate text-xs text-[var(--muted)]">
                            {expense.remarks}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{expense.expenseDate}</td>
                      <td className="px-4 py-3">{expense.category}</td>
                      <td className="px-4 py-3">{formatCurrency(expense.amount, expense.currency)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(
                            expense.status
                          )}`}
                        >
                          {expense.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {expense.receiptUrl ? (
                            <a
                              className="rounded-md border border-white/15 bg-[rgba(8,11,15,0.75)] px-3 py-1.5 text-xs font-semibold text-[var(--chalk)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              href={expense.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Receipt
                            </a>
                          ) : null}
                          <button
                            className="rounded-md border border-[rgba(114,176,134,0.5)] bg-[rgba(16,54,34,0.45)] px-3 py-1.5 text-xs font-semibold text-[rgba(184,227,196,0.95)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                            type="button"
                            onClick={() => handleApproveExpense(expense.id)}
                            disabled={approvingExpenseId === expense.id}
                          >
                            {approvingExpenseId === expense.id ? "Approving..." : "Approve"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
