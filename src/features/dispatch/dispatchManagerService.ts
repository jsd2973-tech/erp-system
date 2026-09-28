import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchToday } from "./dispatchUtils";

export type DispatchManagerOrder = {
  id: string;
  vendor_name: string;
  item_name: string;
  total_volume: number;
  estimated_trip_count: number;
  status: string;
};

export type DispatchManagerTrip = {
  id: string;
  dispatch_order_id: string;
  vehicle_id: string;
  actual_volume: number;
  status: string;
};

export const loadDispatchManagerOrders = async (supabase: SupabaseClient): Promise<DispatchManagerOrder[]> => {
  const orderResult = await supabase
    .from("dispatch_orders")
    .select("id,vendor_name,item_name,total_volume,estimated_trip_count,status")
    .eq("dispatch_date", dispatchToday())
    .neq("status", "취소")
    .order("created_at", { ascending: true });

  if (orderResult.error) throw new Error(`오늘 배차를 불러오지 못했습니다. (${orderResult.error.message})`);
  return (orderResult.data || []).map((row) => ({
    id: String(row.id),
    vendor_name: String(row.vendor_name || ""),
    item_name: String(row.item_name || ""),
    total_volume: Number(row.total_volume || 0),
    estimated_trip_count: Number(row.estimated_trip_count || 0),
    status: String(row.status || ""),
  } satisfies DispatchManagerOrder));
};

export const loadDispatchManagerTrips = async (supabase: SupabaseClient, orderIds: string[]): Promise<DispatchManagerTrip[]> => {
  const tripResult = await supabase
    .from("dispatch_trips")
    .select("id,dispatch_order_id,vehicle_id,actual_volume,status")
    .in("dispatch_order_id", orderIds);
  if (tripResult.error) throw new Error(`오늘 운행을 불러오지 못했습니다. (${tripResult.error.message})`);
  const trips = (tripResult.data || []).map((row) => ({
    id: String(row.id),
    dispatch_order_id: String(row.dispatch_order_id),
    vehicle_id: String(row.vehicle_id),
    actual_volume: Number(row.actual_volume || 0),
    status: String(row.status || ""),
  } satisfies DispatchManagerTrip));
  return trips;
};
