import { createClient } from "@supabase/supabase-js";

const PROD_SUPABASE_URL = "https://jqdvxmatbmmeubtoogvl.supabase.co";
const PROD_SUPABASE_KEY = "sb_publishable_83Pb_nHMoZCduendoRwE5w_uJqiuvH7";
const testMode = import.meta.env.VITE_SUPABASE_TEST_MODE === "1";
const e2eMode = import.meta.env.VITE_SUPABASE_E2E_MODE === "1";
const envUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const envKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

const normalizeSupabaseUrl = (value: string) => value.replace(/\/+$/, "").toLowerCase();

if (testMode && (!envUrl || !envKey)) {
  throw new Error("테스트 Supabase 모드에는 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 필요합니다.");
}

if (testMode && normalizeSupabaseUrl(envUrl) === normalizeSupabaseUrl(PROD_SUPABASE_URL)) {
  throw new Error("테스트 Supabase 모드에서는 운영 Supabase URL을 사용할 수 없습니다.");
}

const supabaseUrl = testMode ? envUrl : PROD_SUPABASE_URL;
const supabaseKey = testMode ? envKey : PROD_SUPABASE_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  }
);

// The isolated dispatch QA project intentionally contains only Auth,
// user_permissions and dispatch-related tables. Keep unrelated ERP loaders from
// failing there while leaving all normal/production behavior untouched.
const TEST_MODE_SKIPPED_TABLES = new Set([
  "vendors",
  "warehouse_groups",
  "warehouses",
  "items",
  "purchases",
  "maints",
  "card_uses",
  "permit_renewals",
  "vendor_accounts",
  "receipt_photos",
  "maintenance_photos",
  "maintenance_schedules",
  "site_notices",
  "update_notices",
  "activity_logs",
  "deleted_records",
]);

const E2E_REAL_TABLES = new Set([
  "vendors",
  "warehouse_groups",
  "warehouses",
  "items",
  "purchases",
  "maints",
  "maintenance_purchase_links",
  "activity_logs",
  "deleted_records",
  "user_permissions",
  "dispatch_admin_users",
  "dispatch_vehicles",
  "dispatch_drivers",
  "dispatch_orders",
  "dispatch_order_vehicles",
  "dispatch_customers",
  "dispatch_locations",
  "dispatch_items",
  "dispatch_trips",
  "dispatch_trip_locations",
  "dispatch_trip_corrections",
  "fuel_records",
  "fuel_master_options",
]);

if (testMode) {
  const realFrom = supabase.from.bind(supabase);

  (supabase as any).from = (table: string) => {
    const shouldSkip = e2eMode
      ? !E2E_REAL_TABLES.has(table)
      : TEST_MODE_SKIPPED_TABLES.has(table);

    if (!shouldSkip) {
      return realFrom(table);
    }

    const emptyResult = Promise.resolve({
      data: [],
      error: null,
      count: 0,
      status: 200,
      statusText: "OK",
    });

    let emptyQuery: any;
    emptyQuery = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") return emptyResult.then.bind(emptyResult);
          if (property === "catch") return emptyResult.catch.bind(emptyResult);
          if (property === "finally") return emptyResult.finally.bind(emptyResult);
          return () => emptyQuery;
        },
      }
    );

    return emptyQuery;
  };
}

export const isSupabaseTestMode = testMode;
