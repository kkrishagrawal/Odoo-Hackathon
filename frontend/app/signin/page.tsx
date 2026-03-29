"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { ApiError, apiFetch, extractValidationDetails } from "../../lib/api";

type SignInFieldErrors = {
  email?: string[];
  password?: string[];
  role?: string[];
};

type RoleOption = "admin" | "manager" | "employee";

type LoginResponse = {
  message: string;
  user: {
    role: RoleOption;
  };
};

function getRoleDashboardPath(role: RoleOption) {
  if (role === "manager") {
    return "/manager-dashboard";
  }

  if (role === "employee") {
    return "/employee-dashboard";
  }

  return "/admin-dashboard";
}

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleOption>("manager");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password, role },
      });

      toast.success("Signed in successfully");

      router.push(getRoleDashboardPath(response.user.role));
      router.refresh();
    } catch (requestError) {
      let message = "Unable to sign in. Please try again.";

      if (requestError instanceof ApiError) {
        const validation = extractValidationDetails(requestError.details);
        setFieldErrors({
          email: validation.fieldErrors.email,
          password: validation.fieldErrors.password,
          role: validation.fieldErrors.role,
        });

        message =
          validation.formErrors[0] ||
          validation.fieldErrors.role?.[0] ||
          validation.fieldErrors.email?.[0] ||
          validation.fieldErrors.password?.[0] ||
          requestError.message;
      }

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh px-4 py-10 lg:py-14">
      <div className="mx-auto w-full max-w-[520px]">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <div className="mb-5">
            <p className="text-xs font-bold tracking-[0.09em] text-[var(--muted)]">ADMIN ACCESS</p>
            <h1 className="mt-2 text-[clamp(1.55rem,2vw,1.95rem)] font-semibold leading-tight text-[var(--chalk)]">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Use your company admin credentials to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                value={role}
                onChange={(event) => setRole(event.target.value as RoleOption)}
              >
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
              {fieldErrors.role?.length ? (
                <div className="grid gap-0.5">
                  {fieldErrors.role.map((fieldError) => (
                    <p key={fieldError} className="text-xs text-rose-300">
                      {fieldError}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
              {fieldErrors.email?.length ? (
                <div className="grid gap-0.5">
                  {fieldErrors.email.map((fieldError) => (
                    <p key={fieldError} className="text-xs text-rose-300">
                      {fieldError}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
              {fieldErrors.password?.length ? (
                <div className="grid gap-0.5">
                  {fieldErrors.password.map((fieldError) => (
                    <p key={fieldError} className="text-xs text-rose-300">
                      {fieldError}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            {error ? <p className="mt-1 text-sm text-rose-300">{error}</p> : null}

            <button
              className="mt-1 w-full rounded-lg border border-[rgba(138,160,186,0.5)] bg-[linear-gradient(180deg,rgba(138,160,186,0.26),rgba(138,160,186,0.14))] px-4 py-2.5 font-semibold text-[var(--chalk)] transition hover:enabled:-translate-y-px hover:enabled:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
          </form>

          <div className="mt-5 grid gap-2 text-sm text-[var(--chalk)]">
            <p>
              New company?{" "}
              <Link
                className="underline underline-offset-4 transition hover:text-[var(--accent)]"
                href="/signup"
              >
                Create admin account
              </Link>
            </p>
            <p>
              <Link
                className="underline underline-offset-4 transition hover:text-[var(--accent)]"
                href="/forgot-password"
              >
                Forgot your password?
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
