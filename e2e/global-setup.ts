import { createClient } from "@supabase/supabase-js";
import { readE2EEnvironment, E2E_TEST_PROJECT_REF, sanitizeSupabaseDiagnostic } from "./safety";

export default async function globalSetup() {
  const env = readE2EEnvironment();
  const supabase = createClient(env.supabaseURL, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: env.adminEmail,
    password: env.adminPassword,
  });
  if (authError || !authData.user) {
    const diagnostic = authError
      ? `: ${JSON.stringify(sanitizeSupabaseDiagnostic(authError, [env.adminEmail, env.adminPassword, env.anonKey]))}`
      : ": no user returned";
    throw new Error(`E2E test account cannot sign in${diagnostic}`);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (sessionError || !session || session.user.id !== authData.user.id || !session.access_token) {
    const diagnostic = sessionError
      ? `: ${JSON.stringify(sanitizeSupabaseDiagnostic(sessionError, [env.adminEmail, env.adminPassword, env.anonKey]))}`
      : ": authenticated session was not available after sign-in";
    throw new Error(`E2E authenticated session was not established${diagnostic}`);
  }

  const { data: verifiedUserData, error: verifiedUserError } = await supabase.auth.getUser(session.access_token);
  if (verifiedUserError || verifiedUserData.user?.id !== authData.user.id) {
    const diagnostic = verifiedUserError
      ? `: ${JSON.stringify(sanitizeSupabaseDiagnostic(verifiedUserError, [env.adminEmail, env.adminPassword, env.anonKey, session.access_token]))}`
      : ": server-verified user did not match the signed-in test account";
    throw new Error(`E2E authenticated session could not be verified${diagnostic}`);
  }

  const { data: permission, error: permissionError } = await supabase
    .from("user_permissions")
    .select("email,role")
    .eq("email", env.adminEmail)
    .maybeSingle();

  if (permissionError || permission?.role !== "admin") {
    throw new Error("E2E account must have role=admin in the isolated test project's user_permissions table.");
  }

  const { data: marker, error: markerError } = await supabase
    .from("e2e_environment")
    .select("project_ref")
    .eq("environment", "test")
    .single();
  if (markerError) {
    const diagnostic = sanitizeSupabaseDiagnostic(markerError, [
      env.adminEmail,
      env.adminPassword,
      env.anonKey,
      session.access_token,
    ]);
    throw new Error(`E2E marker query failed: ${JSON.stringify(diagnostic)}`);
  }
  if (marker?.project_ref !== E2E_TEST_PROJECT_REF) {
    const rawReceived = marker?.project_ref;
    const received = rawReceived == null
      ? "null"
      : typeof rawReceived === "string" && /^[a-z0-9-]{1,64}$/i.test(rawReceived)
        ? rawReceived
        : "[invalid value]";
    throw new Error(`E2E marker mismatch: expected ${E2E_TEST_PROJECT_REF}, received ${received}.`);
  }

  for (const table of [
    "vendors",
    "warehouses",
    "items",
    "purchases",
    "maints",
    "card_uses",
    "activity_logs",
    "deleted_records",
    "maintenance_purchase_links",
    "fuel_records",
    "fuel_master_options",
    "dispatch_admin_users",
    "dispatch_vehicles",
    "dispatch_drivers",
    "dispatch_orders",
    "dispatch_order_vehicles",
    "dispatch_trips",
    "dispatch_trip_locations",
    "dispatch_trip_corrections",
  ]) {
    const { error } = await supabase.from(table).select("*").limit(0);
    if (error) throw new Error(`E2E test schema is not ready (${table}): ${error.message}`);
  }

  await supabase.auth.signOut();
  console.log(`E2E database guard passed for isolated project ${E2E_TEST_PROJECT_REF}.`);
}
