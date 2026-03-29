"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

type ApprovalRuleApprover = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: "manager";
  isRequired: boolean;
  sortOrder: number;
};

type ApprovalRule = {
  id: string;
  targetUser: {
    id: string;
    fullName: string;
    email: string;
    role: "manager" | "employee";
  };
  managerUser: {
    id: string;
    fullName: string;
    email: string;
    role: "manager";
  } | null;
  description: string | null;
  includeManagerApprover: boolean;
  requireSequential: boolean;
  minimumApprovalPercent: number;
  approvers: ApprovalRuleApprover[];
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
};

type ApprovalRulesResponse = {
  rules: ApprovalRule[];
};

type CreateApprovalRuleResponse = {
  message: string;
  rule: ApprovalRule;
};

type RemoveApprovalRuleResponse = {
  message: string;
  rule: {
    id: string;
    targetUser: {
      id: string;
      fullName: string;
      email: string;
      role: "manager" | "employee";
    };
  };
};

type CreateApprovalRuleFieldErrors = {
  targetUserId?: string[];
  managerUserId?: string[];
  description?: string[];
  minimumApprovalPercent?: string[];
  approvers?: string[];
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [teamUsers, setTeamUsers] = useState<ManagedUser[]>([]);
  const [rules, setRules] = useState<ApprovalRule[]>([]);
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

  const [ruleTargetUserId, setRuleTargetUserId] = useState("");
  const [ruleManagerUserId, setRuleManagerUserId] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [includeManagerApprover, setIncludeManagerApprover] = useState(true);
  const [requireSequential, setRequireSequential] = useState(false);
  const [minimumApprovalPercentInput, setMinimumApprovalPercentInput] = useState("100");
  const [ruleApproverIds, setRuleApproverIds] = useState<string[]>([]);
  const [ruleRequiredApproverIds, setRuleRequiredApproverIds] = useState<string[]>([]);
  const [ruleCreateError, setRuleCreateError] = useState("");
  const [ruleFieldErrors, setRuleFieldErrors] = useState<CreateApprovalRuleFieldErrors>({});
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [removingRuleId, setRemovingRuleId] = useState<string | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);

  const managerUsers = useMemo(
    () => teamUsers.filter((teamUser) => teamUser.role === "manager"),
    [teamUsers]
  );

  const assignableUsers = useMemo(
    () => teamUsers.filter((teamUser) => teamUser.role === "manager" || teamUser.role === "employee"),
    [teamUsers]
  );

  const selectedRuleTargetUser = useMemo(
    () => assignableUsers.find((teamUser) => teamUser.id === ruleTargetUserId) || null,
    [assignableUsers, ruleTargetUserId]
  );

  const activeRuleForSelectedUser = useMemo(
    () => rules.find((rule) => rule.targetUser.id === ruleTargetUserId) || null,
    [ruleTargetUserId, rules]
  );

  const ruleByTargetUserId = useMemo(
    () => new Map(rules.map((rule) => [rule.targetUser.id, rule])),
    [rules]
  );

  const dashboardStats = useMemo(() => {
    const managerCount = teamUsers.filter((teamUser) => teamUser.role === "manager").length;
    const employeeCount = teamUsers.filter((teamUser) => teamUser.role === "employee").length;
    const usersWithRuleCount = teamUsers.filter((teamUser) => ruleByTargetUserId.has(teamUser.id)).length;

    return {
      managerCount,
      employeeCount,
      usersWithRuleCount,
      usersWithoutRuleCount: Math.max(0, teamUsers.length - usersWithRuleCount),
    };
  }, [ruleByTargetUserId, teamUsers]);

  const findFirstManagerCandidate = useCallback(
    (excludeIds: string[] = []) => managerUsers.find((teamUser) => !excludeIds.includes(teamUser.id))?.id || "",
    [managerUsers]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadAdminView() {
      try {
        const meResponse = await apiFetch<MeResponse>("/auth/me", { method: "GET" });

        if (meResponse.user.role !== "admin") {
          throw new ApiError("Only admin users can access this page", 403, "FORBIDDEN");
        }

        const [usersResponse, rulesResponse] = await Promise.all([
          apiFetch<UsersResponse>("/users", { method: "GET" }),
          apiFetch<ApprovalRulesResponse>("/approval-rules", { method: "GET" }),
        ]);

        if (!isMounted) {
          return;
        }

        setUser(meResponse.user);
        setTeamUsers(usersResponse.users);
        setRules(rulesResponse.rules);

        setRuleTargetUserId((previous) => previous || usersResponse.users[0]?.id || "");

        const firstManagerId = usersResponse.users.find((teamUser) => teamUser.role === "manager")?.id || "";
        setRuleManagerUserId((previous) => previous || firstManagerId);

        if (firstManagerId) {
          setRuleApproverIds((previous) => (previous.length ? previous : [firstManagerId]));
          setRuleRequiredApproverIds((previous) => (previous.length ? previous : [firstManagerId]));
        }
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

  async function reloadRules() {
    const response = await apiFetch<ApprovalRulesResponse>("/approval-rules", { method: "GET" });
    setRules(response.rules);
  }

  useEffect(() => {
    if (!assignableUsers.length) {
      if (ruleTargetUserId) {
        setRuleTargetUserId("");
      }
      return;
    }

    const hasSelectedUser = assignableUsers.some((teamUser) => teamUser.id === ruleTargetUserId);
    if (!hasSelectedUser) {
      setRuleTargetUserId(assignableUsers[0]?.id || "");
    }
  }, [assignableUsers, ruleTargetUserId]);

  useEffect(() => {
    if (!managerUsers.length) {
      if (ruleManagerUserId) {
        setRuleManagerUserId("");
      }
      return;
    }

    const hasSelectedManager = managerUsers.some((teamUser) => teamUser.id === ruleManagerUserId);
    if (!hasSelectedManager) {
      setRuleManagerUserId(findFirstManagerCandidate(ruleTargetUserId ? [ruleTargetUserId] : []));
    }
  }, [findFirstManagerCandidate, managerUsers, ruleManagerUserId, ruleTargetUserId]);

  useEffect(() => {
    if (!ruleTargetUserId) {
      return;
    }

    if (ruleManagerUserId === ruleTargetUserId) {
      setRuleManagerUserId(findFirstManagerCandidate([ruleTargetUserId]));
    }

    setRuleApproverIds((previous) => {
      const unique = [...new Set(previous)];
      const next = unique.filter(
        (id) => id !== ruleTargetUserId && managerUsers.some((teamUser) => teamUser.id === id)
      );

      if (next.length === 0) {
        const fallback = findFirstManagerCandidate([ruleTargetUserId]);
        return fallback ? [fallback] : [];
      }

      if (next.length === previous.length && next.every((id, index) => id === previous[index])) {
        return previous;
      }

      return next;
    });

    setRuleRequiredApproverIds((previous) =>
      previous.filter((id) => id !== ruleTargetUserId && managerUsers.some((teamUser) => teamUser.id === id))
    );
  }, [findFirstManagerCandidate, managerUsers, ruleManagerUserId, ruleTargetUserId]);

  useEffect(() => {
    setRuleRequiredApproverIds((previous) => previous.filter((id) => ruleApproverIds.includes(id)));
  }, [ruleApproverIds]);

  useEffect(() => {
    if (!ruleManagerUserId) {
      return;
    }

    if (!includeManagerApprover) {
      setRuleApproverIds((previous) => previous.filter((id) => id !== ruleManagerUserId));
      setRuleRequiredApproverIds((previous) => previous.filter((id) => id !== ruleManagerUserId));
      return;
    }

    setRuleApproverIds((previous) => {
      if (previous.includes(ruleManagerUserId)) {
        return previous;
      }
      return [ruleManagerUserId, ...previous];
    });

    setRuleRequiredApproverIds((previous) => {
      if (previous.includes(ruleManagerUserId)) {
        return previous;
      }
      return [ruleManagerUserId, ...previous];
    });
  }, [includeManagerApprover, ruleManagerUserId]);

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
      await Promise.all([reloadUsers(), reloadRules()]);
    } catch (requestError) {
      const message =
        requestError instanceof ApiError ? requestError.message : "Unable to remove user.";
      toast.error(message);
    } finally {
      setRemovingForUserId(null);
    }
  }

  function toggleApprover(userId: string, enabled: boolean) {
    setRuleApproverIds((previous) => {
      if (enabled) {
        if (previous.includes(userId)) {
          return previous;
        }
        return [...previous, userId];
      }

      return previous.filter((id) => id !== userId);
    });

    if (!enabled) {
      setRuleRequiredApproverIds((previous) => previous.filter((id) => id !== userId));
    }
  }

  function toggleRequiredApprover(userId: string, required: boolean) {
    if (required) {
      setRuleRequiredApproverIds((previous) => {
        if (previous.includes(userId)) {
          return previous;
        }
        return [...previous, userId];
      });
      return;
    }

    setRuleRequiredApproverIds((previous) => previous.filter((id) => id !== userId));
  }

  function openRuleDialogForUser(targetUserId: string) {
    setRuleTargetUserId(targetUserId);
    setRuleCreateError("");
    setRuleFieldErrors({});

    if (!ruleManagerUserId || ruleManagerUserId === targetUserId) {
      setRuleManagerUserId(findFirstManagerCandidate([targetUserId]));
    }

    setIsRuleDialogOpen(true);
  }

  function closeRuleDialog() {
    setIsRuleDialogOpen(false);
    setRuleCreateError("");
    setRuleFieldErrors({});
  }

  async function handleCreateApprovalRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRuleCreateError("");
    setRuleFieldErrors({});

    const parsedMinimumApprovalPercent = Number.parseInt(minimumApprovalPercentInput, 10);
    const minimumApprovalPercent = Number.isNaN(parsedMinimumApprovalPercent)
      ? 100
      : Math.min(100, Math.max(1, parsedMinimumApprovalPercent));

    const approvers = [...new Set(ruleApproverIds)]
      .filter((userId) => userId !== ruleTargetUserId)
      .map((userId) => ({
        userId,
        isRequired: ruleRequiredApproverIds.includes(userId),
      }));

    if (!ruleTargetUserId) {
      setRuleCreateError("Please select a target user.");
      return;
    }

    if (!approvers.length) {
      setRuleCreateError("Select at least one approver.");
      return;
    }

    setIsCreatingRule(true);

    try {
      const response = await apiFetch<CreateApprovalRuleResponse>("/approval-rules", {
        method: "POST",
        body: {
          targetUserId: ruleTargetUserId,
          managerUserId: ruleManagerUserId || null,
          description: ruleDescription,
          includeManagerApprover,
          requireSequential,
          minimumApprovalPercent,
          approvers,
        },
      });

      toast.success(response.message);
      setRuleDescription("");
      setMinimumApprovalPercentInput("100");
      await reloadRules();
      setIsRuleDialogOpen(false);
    } catch (requestError) {
      let message = "Unable to create approval rule.";

      if (requestError instanceof ApiError) {
        const validation = extractValidationDetails(requestError.details);

        setRuleFieldErrors({
          targetUserId: validation.fieldErrors.targetUserId,
          managerUserId: validation.fieldErrors.managerUserId,
          description: validation.fieldErrors.description,
          minimumApprovalPercent: validation.fieldErrors.minimumApprovalPercent,
          approvers: validation.fieldErrors.approvers,
        });

        message =
          validation.formErrors[0] ||
          validation.fieldErrors.targetUserId?.[0] ||
          validation.fieldErrors.managerUserId?.[0] ||
          validation.fieldErrors.minimumApprovalPercent?.[0] ||
          validation.fieldErrors.approvers?.[0] ||
          requestError.message;
      }

      setRuleCreateError(message);
      toast.error(message);
    } finally {
      setIsCreatingRule(false);
    }
  }

  async function handleRemoveApprovalRule(rule: ApprovalRule) {
    const confirmed = window.confirm(`Remove approval rule for ${rule.targetUser.fullName}?`);

    if (!confirmed) {
      return;
    }

    setRemovingRuleId(rule.id);

    try {
      const response = await apiFetch<RemoveApprovalRuleResponse>(`/approval-rules/${rule.id}`, {
        method: "DELETE",
      });

      toast.success(response.message);
      await reloadRules();
    } catch (requestError) {
      const message =
        requestError instanceof ApiError ? requestError.message : "Unable to remove approval rule.";
      toast.error(message);
    } finally {
      setRemovingRuleId(null);
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
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_right,rgba(138,160,186,0.15),transparent_45%)] px-4 py-10 lg:py-14">
      <div className="mx-auto grid w-full max-w-[1140px] gap-5">
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,22,29,0.97),rgba(11,15,20,0.99))] p-6 shadow-[0_18px_36px_rgba(0,0,0,0.34)] lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.09em] text-[var(--muted)]">ADMIN VIEW</p>
              <h1 className="mt-2 text-[clamp(1.7rem,2.4vw,2.25rem)] font-semibold leading-tight text-[var(--chalk)]">
                Approval rules and team access
              </h1>
              <p className="mt-2 max-w-[70ch] text-sm text-[var(--muted)]">
                Create managers and employees, send credentials instantly, and define how requests are approved.
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
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Admin</p>
              <p className="mt-1 font-medium">{user.fullName}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[rgba(8,11,15,0.62)] px-4 py-3 text-[var(--chalk)]">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Company</p>
              <p className="mt-1 font-medium">{user.company.name}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[rgba(8,11,15,0.62)] px-4 py-3 text-[var(--chalk)]">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Base Currency</p>
              <p className="mt-1 font-medium">{user.company.baseCurrency}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-[rgba(8,11,15,0.65)] p-4 text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--chalk)]">Admin view (Approval rules)</p>
            <p className="mt-2">
              Add one approval rule per user, assign managers as approvers, and control sequencing and required approvals.
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-[rgba(12,16,22,0.9)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Managers</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--chalk)]">{dashboardStats.managerCount}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[rgba(12,16,22,0.9)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Employees</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--chalk)]">{dashboardStats.employeeCount}</p>
          </article>
          <article className="rounded-2xl border border-[rgba(114,176,134,0.38)] bg-[rgba(15,32,25,0.58)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
            <p className="text-xs uppercase tracking-[0.08em] text-[rgba(165,209,177,0.84)]">Users with Rules</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--chalk)]">{dashboardStats.usersWithRuleCount}</p>
          </article>
          <article className="rounded-2xl border border-[rgba(237,176,97,0.35)] bg-[rgba(47,34,18,0.5)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
            <p className="text-xs uppercase tracking-[0.08em] text-[rgba(237,202,141,0.85)]">Users without Rules</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--chalk)]">{dashboardStats.usersWithoutRuleCount}</p>
          </article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold text-[var(--chalk)]">Approval rules</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Click any user row in Managed users to open the approval-rule dialog for that user.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[rgba(8,11,15,0.65)] p-4 text-sm text-[var(--muted)]">
              Select a user in the table below to configure approvals in a popup dialog.
            </div>
            <div className="rounded-xl border border-white/10 bg-[rgba(8,11,15,0.65)] p-4 text-sm text-[var(--muted)]">
              Rule coverage is visible in the Managed users table, so you can quickly identify users without an active flow.
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold text-[var(--chalk)]">Saved approval rules</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Each user can have one active approval rule. Remove and recreate to adjust ownership.
          </p>

          {!rules.length ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-[rgba(8,11,15,0.65)] p-4 text-sm text-[var(--muted)]">
              No approval rules created yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {rules.map((rule) => (
                <article
                  key={rule.id}
                  className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,19,25,0.92),rgba(10,13,18,0.88))] p-4 text-sm shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--chalk)]">
                        {rule.targetUser.fullName} ({rule.targetUser.role})
                      </p>
                      <p className="text-[var(--muted)]">{rule.targetUser.email}</p>
                    </div>
                    <button
                      className="rounded-md border border-[rgba(212,160,160,0.55)] bg-[rgba(50,19,23,0.45)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                      type="button"
                      onClick={() => handleRemoveApprovalRule(rule)}
                      disabled={removingRuleId === rule.id}
                    >
                      {removingRuleId === rule.id ? "Removing..." : "Remove rule"}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
                    <p>
                      <strong className="text-[var(--chalk)]">Manager:</strong>{" "}
                      {rule.managerUser ? rule.managerUser.fullName : "-"}
                    </p>
                    <p>
                      <strong className="text-[var(--chalk)]">Sequence:</strong>{" "}
                      {rule.requireSequential ? "Required" : "Parallel allowed"}
                    </p>
                    <p>
                      <strong className="text-[var(--chalk)]">Minimum approval:</strong>{" "}
                      {rule.minimumApprovalPercent}%
                    </p>
                    <p>
                      <strong className="text-[var(--chalk)]">Approvers:</strong> {rule.approvers.length}
                    </p>
                  </div>

                  {rule.description ? (
                    <p className="mt-2 text-[var(--muted)]">{rule.description}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {rule.approvers.map((approver) => (
                      <span
                        key={approver.id}
                        className="rounded-full border border-white/15 bg-[rgba(20,24,30,0.75)] px-3 py-1 text-xs text-[var(--chalk)]"
                      >
                        {approver.fullName}
                        {approver.isRequired ? " (required)" : ""}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
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

        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold text-[var(--chalk)]">Managed users</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Click a user row to open the approval-rule dialog. Use Send password to rotate credentials and email updated login access.
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-[rgba(7,10,14,0.55)] text-left text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Rule</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {teamUsers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-[var(--muted)]" colSpan={6}>
                      No manager or employee users added yet.
                    </td>
                  </tr>
                ) : (
                  teamUsers.map((teamUser) => (
                    <tr
                      key={teamUser.id}
                      className="cursor-pointer text-[var(--chalk)] transition hover:bg-[rgba(255,255,255,0.04)]"
                      onClick={() => openRuleDialogForUser(teamUser.id)}
                    >
                      <td className="px-4 py-3">{teamUser.fullName}</td>
                      <td className="px-4 py-3 capitalize">{teamUser.role}</td>
                      <td className="px-4 py-3">
                        {ruleByTargetUserId.has(teamUser.id) ? (
                          <span className="rounded-full border border-[rgba(114,176,134,0.5)] bg-[rgba(16,54,34,0.45)] px-2.5 py-1 text-[11px] font-semibold text-[rgba(184,227,196,0.95)]">
                            Configured
                          </span>
                        ) : (
                          <span className="rounded-full border border-[rgba(237,176,97,0.45)] bg-[rgba(66,44,20,0.45)] px-2.5 py-1 text-[11px] font-semibold text-[rgba(246,213,162,0.95)]">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{teamUser.email}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {new Date(teamUser.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className="rounded-md border border-[rgba(138,160,186,0.5)] bg-[linear-gradient(180deg,rgba(138,160,186,0.24),rgba(138,160,186,0.14))] px-3 py-1.5 text-xs font-semibold text-[var(--chalk)] transition hover:enabled:-translate-y-px hover:enabled:brightness-105"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRuleDialogForUser(teamUser.id);
                            }}
                            disabled={sendingForUserId === teamUser.id || removingForUserId === teamUser.id}
                          >
                            Configure rule
                          </button>
                          <button
                            className="rounded-md border border-white/15 bg-[rgba(8,11,15,0.75)] px-3 py-1.5 text-xs font-semibold text-[var(--chalk)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSendCredentials(teamUser.id);
                            }}
                            disabled={sendingForUserId === teamUser.id || removingForUserId === teamUser.id}
                          >
                            {sendingForUserId === teamUser.id ? "Sending..." : "Send password"}
                          </button>
                          <button
                            className="rounded-md border border-[rgba(212,160,160,0.55)] bg-[rgba(50,19,23,0.45)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveUser(teamUser);
                            }}
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

        {isRuleDialogOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,6,10,0.72)] px-4 py-6"
            onClick={closeRuleDialog}
            role="presentation"
          >
            <section
              className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.99),rgba(13,17,22,0.99))] p-6 shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--chalk)]">Create approval rule</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {selectedRuleTargetUser
                      ? `Configuring approvals for ${selectedRuleTargetUser.fullName} (${selectedRuleTargetUser.role}).`
                      : "Configure manager approvals for a selected user."}
                  </p>
                </div>
                <button
                  className="rounded-md border border-white/15 bg-[rgba(8,11,15,0.75)] px-3 py-1.5 text-xs font-semibold text-[var(--chalk)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  type="button"
                  onClick={closeRuleDialog}
                >
                  Close
                </button>
              </div>

              {activeRuleForSelectedUser ? (
                <p className="mt-3 rounded-lg border border-[rgba(237,176,97,0.4)] bg-[rgba(60,45,18,0.45)] px-3 py-2 text-xs text-amber-200">
                  A rule already exists for this user. Remove it from Saved approval rules before creating a new one.
                </p>
              ) : null}

              <form onSubmit={handleCreateApprovalRule} className="mt-4 grid gap-3" noValidate>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="rule-target-user">
                      Rule for user
                    </label>
                    <select
                      id="rule-target-user"
                      className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                      value={ruleTargetUserId}
                      onChange={(event) => setRuleTargetUserId(event.target.value)}
                      disabled={!assignableUsers.length}
                    >
                      {assignableUsers.length === 0 ? <option value="">No users available</option> : null}
                      {assignableUsers.map((teamUser) => (
                        <option key={teamUser.id} value={teamUser.id}>
                          {teamUser.fullName} ({teamUser.role})
                        </option>
                      ))}
                    </select>
                    {ruleFieldErrors.targetUserId?.[0] ? (
                      <p className="text-xs text-rose-300">{ruleFieldErrors.targetUserId[0]}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="rule-manager-user">
                      Manager
                    </label>
                    <select
                      id="rule-manager-user"
                      className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                      value={ruleManagerUserId}
                      onChange={(event) => setRuleManagerUserId(event.target.value)}
                      disabled={!managerUsers.length}
                    >
                      {managerUsers.length === 0 ? <option value="">No managers available</option> : null}
                      {managerUsers.map((teamUser) => (
                        <option key={teamUser.id} value={teamUser.id}>
                          {teamUser.fullName}
                        </option>
                      ))}
                    </select>
                    {ruleFieldErrors.managerUserId?.[0] ? (
                      <p className="text-xs text-rose-300">{ruleFieldErrors.managerUserId[0]}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="rule-description">
                    Description (optional)
                  </label>
                  <textarea
                    id="rule-description"
                    className="min-h-[84px] w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                    value={ruleDescription}
                    onChange={(event) => setRuleDescription(event.target.value)}
                    placeholder="Approval routing for travel and procurement requests"
                    maxLength={300}
                  />
                  {ruleFieldErrors.description?.[0] ? (
                    <p className="text-xs text-rose-300">{ruleFieldErrors.description[0]}</p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[rgba(8,11,15,0.65)] px-3 py-2 text-sm text-[var(--chalk)]">
                    <input
                      type="checkbox"
                      checked={includeManagerApprover}
                      onChange={(event) => setIncludeManagerApprover(event.target.checked)}
                    />
                    Include manager approver
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[rgba(8,11,15,0.65)] px-3 py-2 text-sm text-[var(--chalk)]">
                    <input
                      type="checkbox"
                      checked={requireSequential}
                      onChange={(event) => setRequireSequential(event.target.checked)}
                    />
                    Require sequential approvals
                  </label>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="minimum-approval-percent">
                      Minimum approval %
                    </label>
                    <input
                      id="minimum-approval-percent"
                      className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                      type="number"
                      min={1}
                      max={100}
                      value={minimumApprovalPercentInput}
                      onChange={(event) => setMinimumApprovalPercentInput(event.target.value)}
                    />
                    {ruleFieldErrors.minimumApprovalPercent?.[0] ? (
                      <p className="text-xs text-rose-300">{ruleFieldErrors.minimumApprovalPercent[0]}</p>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-[rgba(7,10,14,0.55)] text-left text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 font-medium">Approver</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Include</th>
                        <th className="px-4 py-3 font-medium">Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {managerUsers.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-[var(--muted)]" colSpan={4}>
                            Add manager users first to configure approvers.
                          </td>
                        </tr>
                      ) : (
                        managerUsers
                          .filter((teamUser) => teamUser.id !== ruleTargetUserId)
                          .map((teamUser) => {
                            const isIncluded = ruleApproverIds.includes(teamUser.id);
                            const isRequired = ruleRequiredApproverIds.includes(teamUser.id);
                            const lockedByManagerToggle = includeManagerApprover && teamUser.id === ruleManagerUserId;

                            return (
                              <tr key={teamUser.id} className="text-[var(--chalk)]">
                                <td className="px-4 py-3">{teamUser.fullName}</td>
                                <td className="px-4 py-3 text-[var(--muted)]">{teamUser.email}</td>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={isIncluded}
                                    disabled={lockedByManagerToggle}
                                    onChange={(event) => toggleApprover(teamUser.id, event.target.checked)}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={isRequired}
                                    disabled={!isIncluded}
                                    onChange={(event) =>
                                      toggleRequiredApprover(teamUser.id, event.target.checked)
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>

                {ruleFieldErrors.approvers?.[0] ? (
                  <p className="text-xs text-rose-300">{ruleFieldErrors.approvers[0]}</p>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    className="h-[42px] rounded-lg border border-white/15 bg-[rgba(8,11,15,0.75)] px-4 py-2.5 font-semibold text-[var(--chalk)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    type="button"
                    onClick={closeRuleDialog}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-[42px] rounded-lg border border-[rgba(138,160,186,0.5)] bg-[linear-gradient(180deg,rgba(138,160,186,0.26),rgba(138,160,186,0.14))] px-4 py-2.5 font-semibold text-[var(--chalk)] transition hover:enabled:-translate-y-px hover:enabled:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                    type="submit"
                    disabled={
                      isCreatingRule ||
                      !assignableUsers.length ||
                      !managerUsers.length ||
                      Boolean(activeRuleForSelectedUser)
                    }
                  >
                    {isCreatingRule ? "Saving..." : "Save rule"}
                  </button>
                </div>
              </form>

              {ruleCreateError ? <p className="mt-2 text-sm text-rose-300">{ruleCreateError}</p> : null}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
