"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { ApiError, CountryOption, apiFetch, extractValidationDetails } from "../../lib/api";

const FALLBACK_COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States", currencyCode: "USD", currencyName: "US Dollar", currencySymbol: "$" },
  { code: "IN", name: "India", currencyCode: "INR", currencyName: "Indian Rupee", currencySymbol: "Rs" },
  { code: "SG", name: "Singapore", currencyCode: "SGD", currencyName: "Singapore Dollar", currencySymbol: "$" },
  { code: "GB", name: "United Kingdom", currencyCode: "GBP", currencyName: "Pound Sterling", currencySymbol: "GBP" },
  { code: "AE", name: "United Arab Emirates", currencyCode: "AED", currencyName: "UAE Dirham", currencySymbol: "AED" },
  { code: "DE", name: "Germany", currencyCode: "EUR", currencyName: "Euro", currencySymbol: "EUR" },
  { code: "FR", name: "France", currencyCode: "EUR", currencyName: "Euro", currencySymbol: "EUR" },
  { code: "CA", name: "Canada", currencyCode: "CAD", currencyName: "Canadian Dollar", currencySymbol: "$" },
  { code: "AU", name: "Australia", currencyCode: "AUD", currencyName: "Australian Dollar", currencySymbol: "$" },
  { code: "JP", name: "Japan", currencyCode: "JPY", currencyName: "Yen", currencySymbol: "JPY" },
];

export default function SignupPage() {
  const router = useRouter();

  type SignUpFieldErrors = {
    fullName?: string[];
    companyName?: string[];
    email?: string[];
    password?: string[];
    confirmPassword?: string[];
    countryCode?: string[];
  };

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countryCode, setCountryCode] = useState("");

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesError, setCountriesError] = useState("");
  const [countriesNotice, setCountriesNotice] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadCountries() {
      try {
        const response = await apiFetch<{ countries: CountryOption[] }>("/meta/countries", {
          method: "GET",
          skipRefresh: true,
        });

        const responseCountries = Array.isArray(response.countries) ? response.countries : [];

        if (responseCountries.length === 0) {
          throw new Error("Empty countries response");
        }

        if (!isActive) {
          return;
        }

        setCountries(responseCountries);
        setCountryCode(responseCountries[0].code);
        setCountriesError("");
        setCountriesNotice("");
      } catch {
        if (isActive) {
          setCountries(FALLBACK_COUNTRIES);
          setCountryCode(FALLBACK_COUNTRIES[0].code);
          setCountriesError("");
          setCountriesNotice("Live country list is unavailable. Showing fallback options.");
          toast.info("Using fallback country list");
        }
      }
    }

    loadCountries();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setFieldErrors({ confirmPassword: ["Passwords do not match."] });
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiFetch<{ message: string }>("/auth/signup", {
        method: "POST",
        body: {
          fullName,
          companyName,
          email,
          password,
          confirmPassword,
          countryCode,
        },
      });

      toast.success("Admin account created successfully");

      router.push("/admin-dashboard");
      router.refresh();
    } catch (requestError) {
      let message = "Unable to complete signup. Please try again.";

      if (requestError instanceof ApiError) {
        const validation = extractValidationDetails(requestError.details);
        setFieldErrors({
          fullName: validation.fieldErrors.fullName,
          companyName: validation.fieldErrors.companyName,
          email: validation.fieldErrors.email,
          password: validation.fieldErrors.password,
          confirmPassword: validation.fieldErrors.confirmPassword,
          countryCode: validation.fieldErrors.countryCode,
        });

        message =
          validation.formErrors[0] ||
          validation.fieldErrors.fullName?.[0] ||
          validation.fieldErrors.companyName?.[0] ||
          validation.fieldErrors.email?.[0] ||
          validation.fieldErrors.password?.[0] ||
          validation.fieldErrors.confirmPassword?.[0] ||
          validation.fieldErrors.countryCode?.[0] ||
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
      <div className="mx-auto w-full max-w-[740px]">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,20,26,0.96),rgba(13,17,22,0.98))] p-6 shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <div className="mb-5">
            <p className="text-xs font-bold tracking-[0.09em] text-[var(--muted)]">ADMIN REGISTRATION</p>
            <h1 className="mt-2 text-[clamp(1.55rem,2vw,1.95rem)] font-semibold leading-tight text-[var(--chalk)]">
              Create account
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Set up your company admin profile in one step.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <div className="grid gap-1.5 self-start">
                <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="fullName">
                  Admin full name
                </label>
                <input
                  id="fullName"
                  className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  placeholder="Jane Carter"
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

              <div className="grid gap-1.5 self-start">
                <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="companyName">
                  Company name
                </label>
                <input
                  id="companyName"
                  className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                  type="text"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Acme Labs"
                  required
                />
                {fieldErrors.companyName?.length ? (
                  <div className="grid gap-0.5">
                    {fieldErrors.companyName.map((fieldError) => (
                      <p key={fieldError} className="text-xs text-rose-300">
                        {fieldError}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
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
                placeholder="admin@company.com"
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

            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <div className="grid gap-1.5 self-start">
                <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
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

              <div className="grid gap-1.5 self-start">
                <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="confirmPassword">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  required
                />
                {fieldErrors.confirmPassword?.length ? (
                  <div className="grid gap-0.5">
                    {fieldErrors.confirmPassword.map((fieldError) => (
                      <p key={fieldError} className="text-xs text-rose-300">
                        {fieldError}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-[var(--chalk)]" htmlFor="countryCode">
                Company country
              </label>
              <select
                id="countryCode"
                className="w-full rounded-lg border border-white/15 bg-[rgba(7,10,14,0.75)] px-3 py-2.5 text-[var(--chalk)] outline-none transition focus:border-[var(--accent)] focus:bg-[rgba(7,10,14,0.92)] focus:ring-2 focus:ring-[rgba(138,160,186,0.22)]"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                disabled={countries.length === 0}
                required
              >
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.currencyCode})
                  </option>
                ))}
              </select>
              {fieldErrors.countryCode?.length ? (
                <div className="grid gap-0.5">
                  {fieldErrors.countryCode.map((fieldError) => (
                    <p key={fieldError} className="text-xs text-rose-300">
                      {fieldError}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <p className="text-xs text-[var(--muted)]">
              Base currency will be assigned from your selected country and used in reporting.
            </p>

            {countriesNotice ? <p className="mt-1 text-sm text-[var(--muted)]">{countriesNotice}</p> : null}
            {countriesError ? <p className="mt-1 text-sm text-rose-300">{countriesError}</p> : null}
            {error ? <p className="mt-1 text-sm text-rose-300">{error}</p> : null}

            <button
              className="mt-1 w-full rounded-lg border border-[rgba(138,160,186,0.5)] bg-[linear-gradient(180deg,rgba(138,160,186,0.26),rgba(138,160,186,0.14))] px-4 py-2.5 font-semibold text-[var(--chalk)] transition hover:enabled:-translate-y-px hover:enabled:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={loading || countries.length === 0}
            >
              {loading ? "Creating account..." : "Create admin account"}
            </button>
          </form>

          <div className="mt-5 text-sm text-[var(--chalk)]">
            <p>
              Already set up?{" "}
              <Link
                className="underline underline-offset-4 transition hover:text-[var(--accent)]"
                href="/signin"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
