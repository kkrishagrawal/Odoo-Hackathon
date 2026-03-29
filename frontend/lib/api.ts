export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";

export type CountryOption = {
  code: string;
  name: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
};

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "manager" | "employee";
  company: {
    id: string;
    name: string;
    countryCode: string;
    baseCurrency: string;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ValidationErrorDetails = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

export function extractValidationDetails(details: unknown): ValidationErrorDetails {
  const parsed: ValidationErrorDetails = {
    formErrors: [],
    fieldErrors: {},
  };

  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return parsed;
  }

  const detailsRecord = details as Record<string, unknown>;
  const formErrors = detailsRecord.formErrors;
  const fieldErrors = detailsRecord.fieldErrors;

  if (Array.isArray(formErrors)) {
    parsed.formErrors = formErrors.filter((value): value is string => typeof value === "string");
  }

  if (fieldErrors && typeof fieldErrors === "object" && !Array.isArray(fieldErrors)) {
    for (const [key, value] of Object.entries(fieldErrors)) {
      if (!Array.isArray(value)) {
        continue;
      }

      const messages = value.filter((entry): entry is string => typeof entry === "string");
      if (messages.length > 0) {
        parsed.fieldErrors[key] = messages;
      }
    }
  }

  return parsed;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipRefresh?: boolean;
};

function shouldAttemptRefresh(path: string, skipRefresh?: boolean) {
  if (skipRefresh) {
    return false;
  }

  const blockedPaths = new Set([
    "/auth/login",
    "/auth/signup",
    "/auth/refresh",
    "/auth/forgot-password",
    "/auth/reset-password",
  ]);

  return !blockedPaths.has(path);
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function refreshSession() {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  return response.ok;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
  hasRetried = false
): Promise<T> {
  const { body, skipRefresh, headers, ...rest } = options;

  const requestHeaders = new Headers(headers || {});

  const isJsonBody = body !== undefined && !(body instanceof FormData);
  if (isJsonBody && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: requestHeaders,
    body: body === undefined ? undefined : isJsonBody ? JSON.stringify(body) : (body as BodyInit),
  });

  if (response.status === 401 && !hasRetried && shouldAttemptRefresh(path, skipRefresh)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
  }

  const parsed = await parseJsonSafe(response);

  if (!response.ok) {
    throw new ApiError(
      (parsed && parsed.message) || "Request failed",
      response.status,
      parsed?.code,
      parsed?.details
    );
  }

  return parsed as T;
}
