import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DispatchCustomer,
  DispatchDriver,
  DispatchItem,
  DispatchLocation,
  DispatchOrder,
  DispatchOrderForm,
  DispatchVehicle,
} from "./dispatchTypes";

export type DispatchReadPermissions = {
  vehicles: boolean;
  drivers: boolean;
  orders: boolean;
  masters: boolean;
  trips: boolean;
};

export const loadDispatchPageData = (supabase: SupabaseClient, permissions: DispatchReadPermissions) => {
  const skipped = Promise.resolve({ data: null, error: null });
  return Promise.all([
    permissions.vehicles ? supabase.from("dispatch_vehicles").select("*").order("vehicle_number", { ascending: true }) : skipped,
    permissions.drivers ? supabase.from("dispatch_drivers").select("*").order("name", { ascending: true }) : skipped,
    permissions.orders ? supabase.from("dispatch_orders").select("*").order("dispatch_date", { ascending: false }).order("created_at", { ascending: false }) : skipped,
    permissions.orders ? supabase.from("dispatch_order_vehicles").select("*").order("created_at", { ascending: true }) : skipped,
    permissions.masters ? supabase.from("dispatch_customers").select("*").order("name", { ascending: true }) : skipped,
    permissions.masters ? supabase.from("dispatch_locations").select("*").order("name", { ascending: true }) : skipped,
    permissions.masters ? supabase.from("dispatch_items").select("*").order("name", { ascending: true }) : skipped,
    permissions.trips ? supabase.from("dispatch_trips").select("*").order("created_at", { ascending: false }) : skipped,
    permissions.trips ? supabase.from("dispatch_trip_locations").select("*").order("captured_at", { ascending: false }) : skipped,
  ]).then(([vehicles, drivers, orders, assignments, customers, locations, items, trips, tripLocations]) => ({
    vehicles, drivers, orders, assignments, customers, locations, items, trips, tripLocations,
  }));
};

export const upsertDispatchVehicle = (supabase: SupabaseClient, record: DispatchVehicle) => supabase.from("dispatch_vehicles").upsert(record);
export const upsertDispatchDriver = (supabase: SupabaseClient, record: DispatchDriver) => supabase.from("dispatch_drivers").upsert(record);
export const updateDispatchVehicleCompany = (supabase: SupabaseClient, id: string, companyName: string) =>
  supabase.from("dispatch_vehicles").update({ company_name: companyName }).eq("id", id);
export const insertDispatchVehicle = (supabase: SupabaseClient, record: DispatchVehicle) => supabase.from("dispatch_vehicles").insert(record);
export const insertDispatchDriver = (supabase: SupabaseClient, record: DispatchDriver) => supabase.from("dispatch_drivers").insert(record);
export const updateDispatchDriver = (supabase: SupabaseClient, id: string, record: Partial<DispatchDriver>) =>
  supabase.from("dispatch_drivers").update(record).eq("id", id);
export const upsertDispatchCustomer = (supabase: SupabaseClient, record: DispatchCustomer) => supabase.from("dispatch_customers").upsert(record);
export const upsertDispatchLocation = (supabase: SupabaseClient, record: DispatchLocation) => supabase.from("dispatch_locations").upsert(record);
export const upsertDispatchItem = (supabase: SupabaseClient, record: DispatchItem) => supabase.from("dispatch_items").upsert(record);
export const insertDispatchCustomer = (supabase: SupabaseClient, record: DispatchCustomer) => supabase.from("dispatch_customers").insert(record);
export const insertDispatchItem = (supabase: SupabaseClient, record: DispatchItem) => supabase.from("dispatch_items").insert(record);
export const insertDispatchLocations = (supabase: SupabaseClient, records: DispatchLocation[]) => supabase.from("dispatch_locations").insert(records);
export const saveDispatchOrderWithAssignments = (supabase: SupabaseClient, order: DispatchOrder, assignments: DispatchOrderForm["assignments"]) =>
  supabase.rpc("save_dispatch_order_with_assignments", { p_order: order, p_assignments: assignments });
export const deleteDispatchOrder = (supabase: SupabaseClient, orderId: string) => supabase.rpc("delete_dispatch_order", { p_order_id: orderId });
export const restoreDispatchOrder = (supabase: SupabaseClient, orderId: string) => supabase.rpc("restore_dispatch_order", { p_order_id: orderId });
export const permanentlyDeleteDispatchOrder = (supabase: SupabaseClient, orderId: string) => supabase.rpc("permanently_delete_dispatch_order", { p_order_id: orderId });
