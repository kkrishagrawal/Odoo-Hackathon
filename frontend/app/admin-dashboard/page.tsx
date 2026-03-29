"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { ApiError, AuthUser, apiFetch, extractValidationDetails } from "../../lib/api";

type MeResponse = {
  user: AuthUser;
};

type ManagedUser = {
  id: string;
  fullName: string;
  email: string;
  role: "manager" | "employee";
  createdAt: string;
};

type UsersResponse = {
  users: ManagedUser[];
};

type CreateUserResponse = {
  message: string;
  user: ManagedUser;
};

type SendCredentialResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    role: "manager" | "employee";
  };
};

type RemoveUserResponse = {
  message: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: "manager" | "employee";
  };
};

type CreateUserFieldErrors = {
  fullName?: string[];
  email?: string[];
  role?: string[];
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [teamUsers, setTeamUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "employee">("manager");
  const [createError, setCreateError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CreateUserFieldErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [sendingForUserId, setSendingForUserId] = useState<string | null>(null);
  const [removingForUserId, setRemovingForUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAdminView() {
      try {
        const meResponse = await apiFetch<MeResponse>("/auth/me", { method: "GET" });

        if (meResponse.user.role !== "admin") {
          throw new ApiError("Only admin users can access this page", 403, "FORBIDDEN");
        }

        const usersResponse = await apiFetch<UsersResponse>("/users", { method: "GET" });

        if (!isMounted) {
          return;
        }

        setUser(meResponse.user);
        setTeamUsers(usersResponse.users);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        const message =
          requestError instanceof ApiError
            ? requestError.message
            : "Unable to load admin dashboard.";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAdminView();

    return () => {
      isMounted = false;
    };
  }, []);

  async function reloadUsers() {
    const response = await apiFetch<UsersResponse>("/users", { method: "GET" });
    setTeamUsers(response.users);
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setFieldErrors({});
    setIsCreating(true);

    try {
      const response = await apiFetch<CreateUserResponse>("/users", {
        method: "POST",
        body: {
          fullName,
          email,
          role,
        },
      });

      toast.success(response.message);
      setFullName("");
      setEmail("");
      setRole("manager");
      await reloadUsers();
    } catch (requestError) {
      let message = "Unable to create user.";

      if (requestError instanceof ApiError) {
        const validation = extractValidationDetails(requestError.details);
        setFieldErrors({
          fullName: validation.fieldErrors.fullName,
          email: validation.fieldErrors.email,
          role: validation.fieldErrors.role,
        });

        message =
          validation.formErrors[0] ||
          validation.fieldErrors.fullName?.[0] ||
          validation.fieldErrors.email?.[0] ||
          validation.fieldErrors.role?.[0] ||
          requestError.message;
      }

      setCreateError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSendCredentials(targetUserId: string) {
    setSendingForUserId(targetUserId);

    try {
      const response = await apiFetch<SendCredentialResponse>(`/users/${targetUserId}/send-credentials`, {
        method: "POST",
      });

      toast.success(response.message);
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to send credentials.";
      toast.error(message);
    } finally {
      setSendingForUserId(null);
    }
  }

  async function handleRemoveUser(targetUser: ManagedUser) {
    const confirmed = window.confirm(
      `Remove ${targetUser.fullName} (${targetUser.role}) from ${user?.company.name}?`
    );

    if (!confirmed) {
      return;
    }

    setRemovingForUserId(targetUser.id);

    try {
      const response = await apiFetch<RemoveUserResponse>(`/users/${targetUser.id}`, {
        method: "DELETE",
      });

      toast.success(response.message);
      await reloadUsers();
    } catch (requestError) {
      const message =
        requestError instanceof ApiError ? requestError.message : "Unable to remove user.";
      toast.error(message);
    } finally {
      setRemovingForUserId(null);
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
          Loading admin dashboard...
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="min-h-dvh px-4 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h1 className="text-2xl font-semibold text-[var(--chalk)]">Admin dashboard</h1>
          <p className="mt-3 text-sm text-rose-300">{error || "Unable to load admin profile."}</p>
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
              <p className="text-xs font-bold tracking-[0.09em] text-[var(--muted)]">ADMIN VIEW</p>
              <h1 className="mt-2 text-[clamp(1.55rem,2vw,2rem)] font-semibold leading-tight text-[var(--chalk)]">
                Approval rules and team access
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Create managers and employees, send credentials instantly, and keep role ownership with admin.
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

          <div className="mt-4 grid gap-2 text-sm text-[var(--chalk)] sm:grid-cols-2 lg:grid-cols-3">
            <p>
              <strong>Admin:</strong> {user.fullName}
            </p>
            <p>
              <strong>Company:</strong> {user.company.name}
            </p>
            <p>
              <strong>Base currency:</strong> {user.company.baseCurrency}
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-[rgba(8,11,15,0.65)] p-4 text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--chalk)]">Admin view (Approval rules)</p>
            <p className="mt-2">
              Create approval rules, assign managers as approvers, and keep employee requests routed through role-based ownership.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold text-[var(--chalk)]">Create user</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add a manager or employee. Their login credentials will be sent to their email.
          </p>

          <form onSubmit={handleCreateUser} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" noValidate>
            <div className="grid gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="create-full-name">
                Full name
              </label>
              <input
                id="create-full-name"
                className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Marc Evans"
                required
              />
              {fieldErrors.fullName?.length ? (
                <div className="grid gap-0.5">
                  {fieldErrors.fullName.map((fieldError) => (
                    <p key={fieldError} className="text-xs text-rose-300">
                      {fieldError}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="create-email">
                Email
              </label>
              <input
                id="create-email"
                className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="employee@company.com"
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
              <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="create-role">
                Role
              </label>
              <select
                id="create-role"
                className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                value={role}
                onChange={(event) => setRole(event.target.value as "manager" | "employee")}
              >
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
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

            <div className="grid items-end">
              <button
                className="h-[42px] w-full rounded-lg border border-[rgba(138,160,186,0.5)] bg-[linear-gradient(180deg,rgba(138,160,186,0.26),rgba(138,160,186,0.14))] px-4 py-2.5 font-semibold text-[var(--chalk)] transition hover:enabled:-translate-y-px hover:enabled:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create user"}
              </button>
            </div>
          </form>

          {createError ? <p className="mt-2 text-sm text-rose-300">{createError}</p> : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold text-[var(--chalk)]">Managed users</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Click Send password to rotate credentials and email updated login access.
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-[rgba(7,10,14,0.55)] text-left text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {teamUsers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-[var(--muted)]" colSpan={5}>
                      No manager or employee users added yet.
                    </td>
                  </tr>
                ) : (
                  teamUsers.map((teamUser) => (
                    <tr key={teamUser.id} className="text-[var(--chalk)]">
                      <td className="px-4 py-3">{teamUser.fullName}</td>
                      <td className="px-4 py-3 capitalize">{teamUser.role}</td>
                      <td className="px-4 py-3">{teamUser.email}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {new Date(teamUser.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className="rounded-md border border-white/15 bg-[rgba(8,11,15,0.75)] px-3 py-1.5 text-xs font-semibold text-[var(--chalk)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
                            type="button"
                            onClick={() => handleSendCredentials(teamUser.id)}
                            disabled={sendingForUserId === teamUser.id || removingForUserId === teamUser.id}
                          >
                            {sendingForUserId === teamUser.id ? "Sending..." : "Send password"}
                          </button>
                          <button
                            className="rounded-md border border-[rgba(212,160,160,0.55)] bg-[rgba(50,19,23,0.45)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                            type="button"
                            onClick={() => handleRemoveUser(teamUser)}
                            disabled={removingForUserId === teamUser.id || sendingForUserId === teamUser.id}
                          >
                            {removingForUserId === teamUser.id ? "Removing..." : "Remove user"}
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
