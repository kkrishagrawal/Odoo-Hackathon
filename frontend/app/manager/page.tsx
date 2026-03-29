"use client";

import { useState } from "react";
import { AuthUser } from "../../lib/api"; // For future use when integrated with backend

/* ── Types (Mocked for now) ── */
type ExpenseStatus = "Draft" | "Submitted" | "Waiting Approval" | "Approved" | "Rejected";

type ApprovalRequest = {
  id: string;
  subject: string;
  owner: string;
  category: string;
  status: ExpenseStatus;
  amount: number;
  originalCurrency: string;
  companyCurrency: string;
  convertedAmount: number;
};

/* ── Empty State ── */
const MOCK_APPROVALS: ApprovalRequest[] = [];

/* ── Helpers ── */
function statusBadgeClass(status: ExpenseStatus) {
  switch (status) {
    case "Draft":
      return "badge-draft";
    case "Submitted":
      return "badge-submitted";
    case "Waiting Approval":
      return "badge-waiting";
    case "Approved":
      return "badge-approved";
    case "Rejected":
      return "badge-rejected bg-red-500/10 text-red-400 border border-red-500/20"; // Adding custom class for rejected
    default:
      return "badge-draft";
  }
}

export default function ManagerDashboard() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(MOCK_APPROVALS);

  // Mock functions for actions
  const handleApprove = (id: string) => {
    setApprovals((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: "Approved" } : req))
    );
  };

  const handleReject = (id: string) => {
    setApprovals((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: "Rejected" } : req))
    );
  };

  return (
    <main className="min-h-dvh px-4 py-8 lg:py-12">
      <div className="mx-auto w-full max-w-[1100px]">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.09em] text-(--muted)">
            MANAGER VIEW
          </p>
          <h1 className="chalk-title mt-1 text-3xl lg:text-4xl">Manager&apos;s View</h1>
        </div>

        {/* Approvals Section */}
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h2 className="text-xl font-semibold text-foreground mb-6 pb-4 border-b border-white/10">
            Approvals to review
          </h2>

          <div className="dash-table-wrap">
            <table className="dash-table w-full">
              <thead>
                <tr>
                  <th>Approval Subject</th>
                  <th>Request Owner</th>
                  <th>Category</th>
                  <th>Request Status</th>
                  <th>Total amount (in company&apos;s currency)</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-(--muted) py-8">
                      No approvals pending.
                    </td>
                  </tr>
                ) : (
                  approvals.map((req) => (
                    <tr key={req.id}>
                      <td className="text-(--muted)">{req.subject}</td>
                      <td>{req.owner}</td>
                      <td>{req.category}</td>
                      <td>
                        <span className={`status-badge ${statusBadgeClass(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="font-mono text-sm">
                        <span className="text-rose-400 font-semibold text-base">
                          {req.amount} {req.originalCurrency}
                        </span>{" "}
                        <span className="text-(--muted)">
                          (in {req.companyCurrency})
                        </span>{" "}
                        = {req.convertedAmount}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="btn-secondary px-3! py-1.5! text-xs! border-green-500/50! text-green-400! hover:bg-green-500/10! hover:border-green-500! transition-all"
                            onClick={() => handleApprove(req.id)}
                            disabled={req.status === "Approved"}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-secondary px-3! py-1.5! text-xs! border-red-500/50! text-red-400! hover:bg-red-500/10! hover:border-red-500! transition-all"
                            onClick={() => handleReject(req.id)}
                            disabled={req.status === "Rejected"}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
