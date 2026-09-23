import { createClient } from "@supabase/supabase-js";
import { readE2EEnvironment, E2E_TEST_PROJECT_REF } from "./safety";

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
    throw new Error(`E2E test account cannot sign in: ${authError?.message || "no user returned"}`);
  }

  const [{ data: permission, error: permissionError }, { data: marker, error: markerError }] = await Promise.all([
    supabase.from("user_permissions").select("email,role").eq("email", env.adminEmail).maybeSingle(),
    supabase.from("e2e_environment").select("project_ref").eq("environment", "test").single(),
  ]);

  if (permissionError || permission?.role !== "admin") {
    throw new Error("E2E account must have role=admin in the isolated test project's user_permissions table.");
  }
  if (markerError || marker?.project_ref !== E2E_TEST_PROJECT_REF) {
    throw new Error("E2E project marker is missing or does not match the approved test project.");
  }

  for (const table of ["vendors", "warehouses", "items", "purchases", "maints", "maintenance_purchase_links"]) {
    const { error } = await supabase.from(table).select("*").limit(0);
    if (error) throw new Error(`E2E test schema is not ready (${table}): ${error.message}`);
  }

  await supabase.auth.signOut();
  console.log(`E2E database guard passed for isolated project ${E2E_TEST_PROJECT_REF}.`);
}
