"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { ApiError, apiFetch } from "../../lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialToken = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: {
          token,
          newPassword,
          confirmPassword,
        },
      });

      setSuccess(response.message);
      setTimeout(() => {
        router.push("/signin");
      }, 1200);
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to reset password.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-grid">
        <section className="auth-card">
          <h1 className="chalk-title text-4xl">Reset Password</h1>

          <form onSubmit={handleSubmit} className="mt-5">
            <div className="field">
              <label className="field-label" htmlFor="token">
                Reset token
              </label>
              <input
                id="token"
                className="field-input"
                type="text"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="newPassword">
                New password
              </label>
              <input
                id="newPassword"
                className="field-input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                className="field-input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="status-error">{error}</p> : null}
            {success ? <p className="status-ok">{success}</p> : null}

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Updating..." : "Reset password"}
            </button>
          </form>

          <p className="mt-5 text-sm">
            Back to <Link className="auth-link" href="/signin">Signin</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
