export const E2E_TEST_PROJECT_REF = "nazyeklqgcygfuvzzgql";
export const PRODUCTION_PROJECT_REF = "jqdvxmatbmmeubtoogvl";
export const LOCAL_E2E_BASE_URL = "http://127.0.0.1:4173";

export type E2EEnvironment = {
  baseURL: string;
  supabaseURL: string;
  anonKey: string;
  adminEmail: string;
  adminPassword: string;
  driverEmail?: string;
  driverPassword?: string;
};

export type SupabaseDiagnostic = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function sanitizeSupabaseDiagnostic(
  error: SupabaseDiagnostic,
  sensitiveValues: string[] = [],
): Required<SupabaseDiagnostic> {
  const redactText = (value: string | null | undefined) => {
    if (typeof value !== "string") return null;

    let safe = value;
    for (const sensitiveValue of sensitiveValues) {
      if (sensitiveValue.length > 0) safe = safe.split(sensitiveValue).join("[redacted]");
    }

    return safe
      .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
      .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
      .replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b/g, "[redacted-api-key]")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
      .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, "[redacted-id]")
      .replace(/\b(?:\+?\d[\d ().-]{6,}\d)\b/g, "[redacted-phone]")
      .slice(0, 800);
  };

  const code = typeof error.code === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(error.code)
    ? error.code
    : null;

  return {
    code,
    message: redactText(error.message),
    details: redactText(error.details),
    hint: redactText(error.hint),
  };
}

const isPublishableSupabaseKey = (key: string) => {
  if (key.startsWith("sb_publishable_")) return true;
  const segments = key.split(".");
  if (segments.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    return payload.role === "anon";
  } catch {
    return false;
  }
};

export function readE2EEnvironment(): E2EEnvironment {
  const baseURL = (process.env.E2E_BASE_URL || LOCAL_E2E_BASE_URL).trim();
  const supabaseURL = (process.env.E2E_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anonKey = (process.env.E2E_SUPABASE_ANON_KEY || "").trim();
  const adminEmail = (process.env.E2E_ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || "";
  const driverEmail = (process.env.E2E_DRIVER_EMAIL || "").trim().toLowerCase();
  const driverPassword = process.env.E2E_DRIVER_PASSWORD || "";

  const missing = [
    ["E2E_SUPABASE_URL", supabaseURL],
    ["E2E_SUPABASE_ANON_KEY", anonKey],
    ["E2E_ADMIN_EMAIL", adminEmail],
    ["E2E_ADMIN_PASSWORD", adminPassword],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new Error(`E2E environment is incomplete: ${missing.join(", ")}`);
  }

  const parsedBaseURL = new URL(baseURL);
  if (!["127.0.0.1", "localhost"].includes(parsedBaseURL.hostname) || parsedBaseURL.port !== "4173") {
    throw new Error("E2E_BASE_URL must point to the local Playwright Vite server at port 4173.");
  }

  const parsedSupabaseURL = new URL(supabaseURL);
  const projectRef = parsedSupabaseURL.hostname.split(".")[0];
  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error("E2E rejected the production Supabase project.");
  }
  if (projectRef !== E2E_TEST_PROJECT_REF || parsedSupabaseURL.hostname !== `${E2E_TEST_PROJECT_REF}.supabase.co`) {
    throw new Error(`E2E requires the dedicated test Supabase project ${E2E_TEST_PROJECT_REF}.`);
  }
  if (parsedSupabaseURL.protocol !== "https:") {
    throw new Error("E2E_SUPABASE_URL must use HTTPS.");
  }
  if (!isPublishableSupabaseKey(anonKey)) {
    throw new Error("E2E_SUPABASE_ANON_KEY must be a publishable/anon key; secret and service-role keys are rejected.");
  }
  if (!adminEmail.includes("@")) {
    throw new Error("E2E_ADMIN_EMAIL must be a test Auth email address.");
  }
  if (Boolean(driverEmail) !== Boolean(driverPassword)) {
    throw new Error("E2E_DRIVER_EMAIL and E2E_DRIVER_PASSWORD must both be set to enable dispatch browser coverage.");
  }
  if (driverEmail && !driverEmail.includes("@")) {
    throw new Error("E2E_DRIVER_EMAIL must be a test Auth email address.");
  }

  return {
    baseURL,
    supabaseURL,
    anonKey,
    adminEmail,
    adminPassword,
    ...(driverEmail ? { driverEmail, driverPassword } : {}),
  };
}
