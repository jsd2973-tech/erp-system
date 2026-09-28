import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchDriver } from "./dispatchTypes";

const toDispatchDriver = (row: Record<string, unknown>): DispatchDriver => ({
  id: String(row.id),
  name: String(row.name || ""),
  phone: String(row.phone || ""),
  company_name: String(row.company_name || ""),
  assigned_vehicle_id: row.assigned_vehicle_id ? String(row.assigned_vehicle_id) : null,
  auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null,
  active: row.active !== false,
  memo: String(row.memo || ""),
  created_at: row.created_at ? String(row.created_at) : undefined,
  updated_at: row.updated_at ? String(row.updated_at) : undefined,
});

export const loadDispatchAccountAccess = async (supabase: SupabaseClient, email: string) => {
  const [adminResult, permissionResult] = await Promise.all([
    supabase.rpc("is_dispatch_admin"),
    email
      ? supabase.from("user_permissions").select("id").eq("email", email).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    isDispatchAdmin: adminResult.data === true,
    hasErpPermission: Boolean(permissionResult.data),
    error: adminResult.error || permissionResult.error,
  };
};

export const loadActiveDispatchDriver = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase
    .from("dispatch_drivers")
    .select("*")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .maybeSingle();
  return { driver: !error && data ? toDispatchDriver(data) : null, error };
};
