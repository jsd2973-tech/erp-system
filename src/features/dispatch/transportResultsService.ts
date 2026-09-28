import type { SupabaseClient } from "@supabase/supabase-js";
import { periodBounds, type ResultOrder, type ResultTrip } from "./transportResults";

export const loadTransportResults = async (
  supabase: SupabaseClient,
  from: string,
  to: string,
  signal: AbortSignal,
): Promise<{ trips: ResultTrip[]; orders: ResultOrder[] }> => {
  const bounds = periodBounds(from, to);
  const collectPrimaryTrips = async () => {
    const collected: ResultTrip[] = [];
    let cursor = "";
    while (true) {
      let query = supabase
        .from("dispatch_trips")
        .select("id,dispatch_order_id,vehicle_id,driver_id,trip_no,status,actual_volume,created_at,loading_completed_at,unloading_completed_at")
        .eq("status", "완료")
        .gte("unloading_completed_at", bounds.start)
        .lt("unloading_completed_at", bounds.end)
        .order("id")
        .limit(500)
        .abortSignal(signal);
      if (cursor) query = query.gt("id", cursor);
      const result = await query;
      if (result.error) throw result.error;
      const page = (result.data || []) as ResultTrip[];
      if (!page.length) break;
      collected.push(...page);
      cursor = page[page.length - 1].id;
    }
    return collected;
  };
  const collectFallbackOrderIds = async () => {
    const collected: string[] = [];
    let cursor = "";
    while (true) {
      let query = supabase
        .from("dispatch_orders")
        .select("id")
        .gte("dispatch_date", from)
        .lte("dispatch_date", to)
        .order("id")
        .limit(500)
        .abortSignal(signal);
      if (cursor) query = query.gt("id", cursor);
      const result = await query;
      if (result.error) throw result.error;
      const page = (result.data || []) as Array<{ id: string }>;
      if (!page.length) break;
      collected.push(...page.map((row) => String(row.id)));
      cursor = String(page[page.length - 1].id);
    }
    return collected;
  };
  const collectFallbackTrips = async (orderIds: string[]) => {
    const collected: ResultTrip[] = [];
    for (let i = 0; i < orderIds.length; i += 100) {
      let cursor = "";
      while (true) {
        let query = supabase
          .from("dispatch_trips")
          .select("id,dispatch_order_id,vehicle_id,driver_id,trip_no,status,actual_volume,created_at,loading_completed_at,unloading_completed_at")
          .eq("status", "완료")
          .is("unloading_completed_at", null)
          .in("dispatch_order_id", orderIds.slice(i, i + 100))
          .order("id")
          .limit(500)
          .abortSignal(signal);
        if (cursor) query = query.gt("id", cursor);
        const result = await query;
        if (result.error) throw result.error;
        const page = (result.data || []) as ResultTrip[];
        if (!page.length) break;
        collected.push(...page);
        cursor = page[page.length - 1].id;
      }
    }
    return collected;
  };

  const [primaryTrips, fallbackOrderIds] = await Promise.all([collectPrimaryTrips(), collectFallbackOrderIds()]);
  const fallbackTrips = fallbackOrderIds.length ? await collectFallbackTrips(fallbackOrderIds) : [];
  const trips = [...primaryTrips, ...fallbackTrips];
  const ids = [...new Set(trips.map((trip) => trip.dispatch_order_id))];
  const orders: ResultOrder[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    let cursor = "";
    while (true) {
      let query = supabase
        .from("dispatch_orders")
        .select("id,dispatch_date,vendor_id,vendor_name,item_id,item_name")
        .in("id", ids.slice(i, i + 100))
        .order("id")
        .limit(100)
        .abortSignal(signal);
      if (cursor) query = query.gt("id", cursor);
      const result = await query;
      if (result.error) throw result.error;
      const page = (result.data || []) as ResultOrder[];
      if (!page.length) break;
      orders.push(...page);
      cursor = page[page.length - 1].id;
    }
  }
  return { trips, orders };
};
