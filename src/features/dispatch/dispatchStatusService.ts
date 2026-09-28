import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeDispatchTrip,
  normalizeDispatchTripLocation,
  type DispatchStatusOrder,
} from "./dispatchModel";
import type { DispatchTrip, DispatchTripLocation } from "./dispatchTypes";

const nextDate = (date: string) => {
  const value = new Date(`${date}T12:00:00+09:00`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
};

export type DispatchStatusSnapshot = {
  trips: DispatchTrip[];
  orders: DispatchStatusOrder[];
  tripLocations: DispatchTripLocation[];
};

export const loadDispatchStatusSnapshot = async (supabase: SupabaseClient, today: string): Promise<DispatchStatusSnapshot> => {
  const tomorrow = nextDate(today);
  const [tripResult, orderResult, assignmentResult, tripLocationResult] = await Promise.all([
    supabase.from("dispatch_trips").select("*").gte("created_at", `${today}T00:00:00+09:00`).lt("created_at", `${tomorrow}T00:00:00+09:00`).order("created_at", { ascending: false }),
    supabase.from("dispatch_orders").select("id,vendor_name,item_name,loading_location,unloading_location,status,total_volume,estimated_trip_count").eq("dispatch_date", today).neq("status", "취소"),
    supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id,driver_id"),
    supabase.from("dispatch_trip_locations").select("*").gte("captured_at", `${today}T00:00:00+09:00`).lt("captured_at", `${tomorrow}T00:00:00+09:00`).order("captured_at", { ascending: false }),
  ]);
  const loadError = tripResult.error || orderResult.error || assignmentResult.error || tripLocationResult.error;
  if (loadError) throw new Error(`운행현황을 불러오지 못했습니다. (${loadError.message})`);

  const assignments = assignmentResult.data || [];
  const orders = (orderResult.data || []).map((row) => {
    const orderAssignments = assignments.filter((assignment) => String(assignment.order_id) === String(row.id));
    return {
      id: String(row.id),
      vendor_name: String(row.vendor_name || ""),
      item_name: String(row.item_name || ""),
      loading_location: String(row.loading_location || ""),
      unloading_location: String(row.unloading_location || ""),
      status: String(row.status || ""),
      total_volume: Number(row.total_volume || 0),
      estimated_trip_count: Number(row.estimated_trip_count || 0),
      assignments: orderAssignments.map((assignment) => ({ vehicle_id: String(assignment.vehicle_id), driver_id: assignment.driver_id ? String(assignment.driver_id) : null })),
      vehicle_ids: orderAssignments.map((assignment) => String(assignment.vehicle_id)),
    } satisfies DispatchStatusOrder;
  });
  return {
    orders,
    trips: (tripResult.data || []).map((row) => normalizeDispatchTrip(row)),
    tripLocations: (tripLocationResult.data || []).map((row) => normalizeDispatchTripLocation(row)),
  };
};
