"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, AuthUser, apiFetch } from "../../lib/api";

type MeResponse = {
  user: AuthUser;
};

function getDashboardPath(role: AuthUser["role"]) {
  if (role === "admin") {
    return "/admin-dashboard";
  }

  if (role === "employee") {
    return "/employee-dashboard";
  }

  return "/manager-dashboard";
}

export default function ManagerDashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadMe() {
      try {
        const response = await apiFetch<MeResponse>("/auth/me", { method: "GET" });

        if (!isMounted) {
          return;
        }

        if (response.user.role !== "manager") {
          throw new ApiError("You do not have access to manager view", 403, "FORBIDDEN");
        }

        setUser(response.user);
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

    loadMe();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogout() {
    await apiFetch<{ message: string }>("/auth/logout", {
      method: "POST",
      skipRefresh: true,
    });

    router.push("/signin");
    router.refresh();
  }

  return (
    <main className="min-h-dvh px-4 py-10 lg:py-14">
      <div className="mx-auto w-full max-w-[860px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
        <h1 className="text-[clamp(1.5rem,2vw,1.95rem)] font-semibold text-[var(--chalk)]">Manager view</h1>

        {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Loading profile...</p> : null}

        {!loading && error ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-rose-300">{error}</p>
            <Link className="underline underline-offset-4 hover:text-[var(--accent)]" href="/signin">
              Back to sign in
            </Link>
          </div>
        ) : null}

        {!loading && user ? (
          <div className="mt-4 grid gap-2 text-sm text-[var(--chalk)]">
            <p>
              <strong>Manager:</strong> {user.fullName}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Company:</strong> {user.company.name}
            </p>
            <p>
              <strong>Role:</strong> {user.role}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                className="rounded-lg border border-white/15 bg-[rgba(8,11,15,0.75)] px-3 py-2 text-xs font-semibold text-[var(--chalk)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                href={getDashboardPath(user.role)}
              >
                Refresh my view
              </Link>
              <button
                className="rounded-lg border border-[rgba(138,160,186,0.5)] bg-[linear-gradient(180deg,rgba(138,160,186,0.26),rgba(138,160,186,0.14))] px-4 py-2 text-sm font-semibold text-[var(--chalk)] transition hover:enabled:-translate-y-px hover:enabled:brightness-105"
                type="button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
