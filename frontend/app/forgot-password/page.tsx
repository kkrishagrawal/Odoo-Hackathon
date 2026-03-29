"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ApiError, apiFetch } from "../../lib/api";

type ForgotPasswordResponse = {
  message: string;
  resetToken?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [resetToken, setResetToken] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setResetToken("");
    setLoading(true);

    try {
      const response = await apiFetch<ForgotPasswordResponse>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });

      setSuccessMessage(response.message);
      if (response.resetToken) {
        setResetToken(response.resetToken);
      }
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to process your request.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh px-4 py-10 lg:py-14">
      <div className="mx-auto w-full max-w-[520px]">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h1 className="mt-1 text-[clamp(1.5rem,2vw,1.9rem)] font-semibold leading-tight text-[var(--chalk)]">
            Forgot password
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter your email and we will generate a reset token for this development build.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {error ? <p className="mt-1 text-sm text-rose-300">{error}</p> : null}
            {successMessage ? <p className="mt-1 text-sm text-[var(--ok)]">{successMessage}</p> : null}

            <button
              className="mt-1 w-full rounded-lg border border-[rgba(138,160,186,0.5)] bg-[linear-gradient(180deg,rgba(138,160,186,0.26),rgba(138,160,186,0.14))] px-4 py-2.5 font-semibold text-[var(--chalk)] transition hover:enabled:-translate-y-px hover:enabled:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Generate reset token"}
            </button>
          </form>

          {resetToken ? (
            <div className="mt-4 rounded-lg border border-[var(--ok)]/60 bg-[rgba(149,182,156,0.08)] p-3 text-sm">
              <p className="text-[var(--ok)]">Development reset token:</p>
              <p className="mt-1 break-all text-[var(--chalk)]">{resetToken}</p>
              <Link
                className="mt-2 inline-block underline underline-offset-4 transition hover:text-[var(--accent)]"
                href={`/reset-password?token=${resetToken}`}
              >
                Open reset page with token
              </Link>
            </div>
          ) : null}

          <p className="mt-5 text-sm text-[var(--chalk)]">
            Back to{" "}
            <Link className="underline underline-offset-4 transition hover:text-[var(--accent)]" href="/signin">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
