"use client";

import { useRef, useState, useCallback, FormEvent } from "react";
import { apiFetch } from "../../lib/api";

/* ── Types ── */
type ExpenseStatus = "Draft" | "Submitted" | "Waiting Approval" | "Approved";

type ApprovalEntry = {
  approver: string;
  status: string;
  time: string;
};

type Expense = {
  id: string;
  employee: string;
  description: string;
  expenseDate: string;
  category: string;
  paidBy: string;
  remarks: string;
  amount: number;
  currency: string;
  status: ExpenseStatus;
  receiptUrl: string;
  approvalHistory: ApprovalEntry[];
};

const CATEGORIES = [
  "Food",
  "Travel",
  "Office Supplies",
  "Utilities",
  "Entertainment",
  "Accommodation",
  "Transport",
  "Medical",
  "Other",
];

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY"];

const EMPTY_FORM = {
  description: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  category: CATEGORIES[0],
  paidBy: "",
  amount: "",
  currency: "INR",
  remarks: "",
  receiptUrl: "",
};

/* ── Helpers ── */
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

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
    default:
      return "badge-draft";
  }
}

/* ──────────────────────────────────────────── */
/*  Component                                    */
/* ──────────────────────────────────────────── */
export default function EmployeeDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  /* dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  /* loading indicators */
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  /* hidden file inputs */
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const receiptFileRef = useRef<HTMLInputElement>(null);

  /* ── Derived summary ── */
  const totalDraft = expenses
    .filter((e) => e.status === "Draft")
    .reduce((s, e) => s + e.amount, 0);

  const totalWaiting = expenses
    .filter((e) => e.status === "Submitted" || e.status === "Waiting Approval")
    .reduce((s, e) => s + e.amount, 0);

  const totalApproved = expenses
    .filter((e) => e.status === "Approved")
    .reduce((s, e) => s + e.amount, 0);

  /* ── Helpers ── */
  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setForm({
      description: expense.description,
      expenseDate: expense.expenseDate,
      category: expense.category,
      paidBy: expense.paidBy,
      amount: String(expense.amount),
      currency: expense.currency,
      remarks: expense.remarks,
      receiptUrl: expense.receiptUrl,
    });
    setEditingId(expense.id);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
  }

  /* ── File → base64 ── */
  function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ── OCR Upload (top-level Upload button) ── */
  const handleOcrFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";

      setOcrLoading(true);
      try {
        const { base64, mimeType } = await fileToBase64(file);

        const ocrResult = await apiFetch<{
          data: {
            description: string;
            expenseDate: string;
            category: string;
            paidBy: string;
            totalAmount: number;
            currency: string;
            remarks: string;
          };
        }>("/ocr/extract-receipt", {
          method: "POST",
          body: { image: base64, mimeType },
        });

        /* Also upload to cloudinary for the receipt link */
        let receiptUrl = "";
        try {
          const uploadResult = await apiFetch<{
            data: { url: string; publicId: string };
          }>("/upload/receipt", {
            method: "POST",
            body: { image: base64, mimeType },
          });
          receiptUrl = uploadResult.data.url;
        } catch {
          /* non-fatal — user can attach receipt later */
        }

        const d = ocrResult.data;
        setForm({
          description: d.description || "",
          expenseDate: d.expenseDate || new Date().toISOString().slice(0, 10),
          category: CATEGORIES.includes(d.category) ? d.category : CATEGORIES[0],
          paidBy: d.paidBy || "",
          amount: d.totalAmount != null ? String(d.totalAmount) : "",
          currency: CURRENCIES.includes(d.currency) ? d.currency : "INR",
          remarks: d.remarks || "",
          receiptUrl,
        });
        setEditingId(null);
        setDialogOpen(true);
      } catch (err) {
        alert("OCR failed. " + (err instanceof Error ? err.message : "Please try again."));
      } finally {
        setOcrLoading(false);
      }
    },
    []
  );

  /* ── Attach Receipt (inside dialog) ── */
  const handleAttachReceipt = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";

      setUploadingReceipt(true);
      try {
        const { base64, mimeType } = await fileToBase64(file);
        const uploadResult = await apiFetch<{
          data: { url: string; publicId: string };
        }>("/upload/receipt", {
          method: "POST",
          body: { image: base64, mimeType },
        });

        setForm((prev) => ({ ...prev, receiptUrl: uploadResult.data.url }));
      } catch (err) {
        alert(
          "Upload failed. " + (err instanceof Error ? err.message : "Please try again.")
        );
      } finally {
        setUploadingReceipt(false);
      }
    },
    []
  );

  /* ── Save expense ── */
  function handleSave(event: FormEvent) {
    event.preventDefault();

    const parsed = parseFloat(form.amount);
    if (!form.description.trim() || isNaN(parsed) || parsed <= 0) {
      alert("Please fill in a valid description and amount.");
      return;
    }

    if (editingId) {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? {
                ...e,
                description: form.description,
                expenseDate: form.expenseDate,
                category: form.category,
                paidBy: form.paidBy,
                amount: parsed,
                currency: form.currency,
                remarks: form.remarks,
                receiptUrl: form.receiptUrl,
              }
            : e
        )
      );
    } else {
      const newExpense: Expense = {
        id: uid(),
        employee: "You",
        description: form.description,
        expenseDate: form.expenseDate,
        category: form.category,
        paidBy: form.paidBy,
        remarks: form.remarks,
        amount: parsed,
        currency: form.currency,
        status: "Draft",
        receiptUrl: form.receiptUrl,
        approvalHistory: [],
      };
      setExpenses((prev) => [newExpense, ...prev]);
    }
    closeDialog();
  }

  /* ── Submit (Draft → Submitted) ── */
  function handleSubmitExpense(id: string) {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: "Submitted" as ExpenseStatus,
              approvalHistory: [
                ...e.approvalHistory,
                {
                  approver: "—",
                  status: "Submitted",
                  time: new Date().toLocaleString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
                },
              ],
            }
          : e
      )
    );
  }

  /* ── Current status for dialog flow indicator ── */
  const currentStatus: ExpenseStatus = editingId
    ? expenses.find((e) => e.id === editingId)?.status ?? "Draft"
    : "Draft";

  /* ──────────────────────── JSX ──────────────────────── */
  return (
    <main className="min-h-dvh px-4 py-8 lg:py-12">
      <div className="mx-auto w-full max-w-[1100px]">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.09em] text-(--muted)">
              EMPLOYEE VIEW
            </p>
            <h1 className="chalk-title mt-1 text-3xl lg:text-4xl">My Expenses</h1>
          </div>

          <div className="btn-group">
            <button
              id="btn-upload-receipt"
              type="button"
              className="btn-secondary btn-upload"
              disabled={ocrLoading}
              onClick={() => ocrFileRef.current?.click()}
            >
              {ocrLoading ? (
                <>
                  <span className="spinner" /> Scanning…
                </>
              ) : (
                <>
                  <UploadIcon /> Upload
                </>
              )}
            </button>

            <button
              id="btn-new-expense"
              type="button"
              className="btn-secondary"
              onClick={openNew}
            >
              <PlusIcon /> New
            </button>
          </div>

          {/* hidden file input for OCR */}
          <input
            ref={ocrFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleOcrFile}
          />
        </div>

        {/* Summary Cards */}
        <section className="dash-cards mb-8" id="summary-cards">
          <div className="dash-card">
            <p className="dash-card-label">To Submit</p>
            <p className="dash-card-amount">{formatCurrency(totalDraft, "INR")}</p>
          </div>
          <div className="dash-card card-warning">
            <p className="dash-card-label">Waiting Approval</p>
            <p className="dash-card-amount">{formatCurrency(totalWaiting, "INR")}</p>
          </div>
          <div className="dash-card card-ok">
            <p className="dash-card-label">Approved</p>
            <p className="dash-card-amount">{formatCurrency(totalApproved, "INR")}</p>
          </div>
        </section>

        {/* Expense Table */}
        <section id="expense-table">
          {expenses.length === 0 ? (
            <div className="empty-state">
              <p>No expenses yet. Click &quot;Upload&quot; or &quot;New&quot; to add one.</p>
            </div>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Paid&nbsp;By</th>
                    <th>Remarks</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{e.employee}</td>
                      <td className="max-w-[180px] truncate">{e.description}</td>
                      <td>{e.expenseDate}</td>
                      <td>{e.category}</td>
                      <td>{e.paidBy || "—"}</td>
                      <td className="max-w-[120px] truncate">{e.remarks || "—"}</td>
                      <td className="font-semibold">
                        {formatCurrency(e.amount, e.currency)}
                      </td>
                      <td>
                        <span className={`status-badge ${statusBadgeClass(e.status)}`}>
                          {e.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {e.status === "Draft" && (
                            <>
                              <button
                                type="button"
                                className="btn-secondary px-2.5! py-1! text-xs!"
                                onClick={() => openEdit(e)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-secondary px-2.5! py-1! text-xs! btn-upload"
                                onClick={() => handleSubmitExpense(e.id)}
                              >
                                Submit
                              </button>
                            </>
                          )}
                          {e.receiptUrl && (
                            <a
                              href={e.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary px-2.5! py-1! text-xs! border-green-400!"
                            >
                              Receipt
                            </a>
                          )}
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

      {/* ──── Expense Dialog ──── */}
      {dialogOpen && (
        <div className="dialog-overlay" onClick={closeDialog}>
          <div className="dialog-panel" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="dialog-header">
              <h2 className="dialog-title">
                {editingId ? "Edit Expense" : "New Expense"}
              </h2>
              <button
                type="button"
                className="dialog-close"
                onClick={closeDialog}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Status Flow */}
            <div className="status-flow">
              {(["Draft", "Waiting Approval", "Approved"] as const).map(
                (step, idx, arr) => (
                  <span key={step} className="flex items-center gap-1.5">
                    <span
                      className={`status-flow-step ${
                        currentStatus === step ? "active" : ""
                      }`}
                    >
                      {step}
                    </span>
                    {idx < arr.length - 1 && (
                      <span className="status-flow-arrow">›</span>
                    )}
                  </span>
                )
              )}
            </div>

            {/* Attach Receipt */}
            <div className="mb-5">
              <button
                type="button"
                className="btn-secondary btn-upload w-full justify-center"
                disabled={uploadingReceipt}
                onClick={() => receiptFileRef.current?.click()}
              >
                {uploadingReceipt ? (
                  <>
                    <span className="spinner" /> Uploading…
                  </>
                ) : (
                  <>
                    <UploadIcon /> Attach Receipt
                  </>
                )}
              </button>
              <input
                ref={receiptFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAttachReceipt}
              />
              {form.receiptUrl && (
                <a
                  href={form.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="receipt-link"
                >
                  <LinkIcon />
                  {form.receiptUrl}
                </a>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="form-grid">
              <div className="form-grid-2">
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="exp-description"
                  >
                    Description
                  </label>
                  <input
                    id="exp-description"
                    className="field-input"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="What was the expense?"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="exp-date"
                  >
                    Expense Date
                  </label>
                  <input
                    id="exp-date"
                    type="date"
                    className="field-input"
                    value={form.expenseDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, expenseDate: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="exp-category"
                  >
                    Category
                  </label>
                  <select
                    id="exp-category"
                    className="field-input"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="exp-paidBy"
                  >
                    Paid By
                  </label>
                  <input
                    id="exp-paidBy"
                    className="field-input"
                    value={form.paidBy}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, paidBy: e.target.value }))
                    }
                    placeholder="Merchant / vendor name"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="exp-amount"
                  >
                    Total Amount
                  </label>
                  <input
                    id="exp-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="field-input"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="exp-currency"
                  >
                    Currency
                  </label>
                  <select
                    id="exp-currency"
                    className="field-input"
                    value={form.currency}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, currency: e.target.value }))
                    }
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="exp-remarks"
                >
                  Remarks
                </label>
                <textarea
                  id="exp-remarks"
                  className="field-input min-h-[70px] resize-y"
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, remarks: e.target.value }))
                  }
                  placeholder="Any additional notes…"
                  rows={2}
                />
              </div>

              {/* Approval History (if editing an existing expense) */}
              {editingId && (
                <div className="mt-2">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-(--muted)">
                    Approval History
                  </p>
                  {(() => {
                    const exp = expenses.find((e) => e.id === editingId);
                    if (!exp || exp.approvalHistory.length === 0) {
                      return (
                        <p className="text-xs text-(--muted)">
                          No approvals yet.
                        </p>
                      );
                    }
                    return (
                      <table className="approval-table">
                        <thead>
                          <tr>
                            <th>Approver</th>
                            <th>Status</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exp.approvalHistory.map((a, i) => (
                            <tr key={i}>
                              <td>{a.approver}</td>
                              <td>{a.status}</td>
                              <td>{a.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}

              <button
                id="btn-save-expense"
                type="submit"
                className="btn-primary mt-2"
              >
                {editingId ? "Save Changes" : "Add Expense"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

/* ── Inline SVG Icons ── */
function UploadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
