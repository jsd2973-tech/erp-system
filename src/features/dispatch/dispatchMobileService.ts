import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchDriver, DispatchOrder, DispatchTrip, DispatchVehicle } from "./dispatchTypes";
import { dispatchToday } from "./dispatchUtils";
import { normalizeDispatchOrder, normalizeDispatchTrip, normalizeDispatchVehicle } from "./dispatchModel";

const nextDate = (date: string) => {
  const value = new Date(`${date}T12:00:00+09:00`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
};

export type DriverDispatchSnapshot = {
  todayOrders: DispatchOrder[];
  todayTrips: DispatchTrip[];
  allTodayTrips: DispatchTrip[];
  vehicles: DispatchVehicle[];
  orderVehicleIds: Map<string, string[]>;
};

export const loadDriverDispatchSnapshot = async (
  supabase: SupabaseClient,
  driver: Pick<DispatchDriver, "id" | "assigned_vehicle_id">,
): Promise<DriverDispatchSnapshot> => {
  const today = dispatchToday();
  const legacyVehicleId = driver.assigned_vehicle_id;
  const [assignmentResult, legacyAssignmentResult, tripResult, activeTripResult] = await Promise.all([
    supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id,driver_id").eq("driver_id", driver.id),
    legacyVehicleId
      ? supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id,driver_id").eq("vehicle_id", legacyVehicleId).is("driver_id", null)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).gte("created_at", `${today}T00:00:00+09:00`).lt("created_at", `${nextDate(today)}T00:00:00+09:00`).order("created_at", { ascending: false }),
    supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).in("status", ["상차대기", "진행중"]).order("created_at", { ascending: false }),
  ]);
  const loadError = assignmentResult.error || legacyAssignmentResult.error || tripResult.error || activeTripResult.error;
  if (loadError) throw new Error("배차 정보를 불러오지 못했습니다. (" + loadError.message + ")");

  const assignmentMap = new Map<string, { order_id: string; vehicle_id: string; driver_id: string | null }>();
  [...(assignmentResult.data || []), ...(legacyAssignmentResult.data || [])].forEach((row) => {
    const key = String(row.order_id) + ":" + String(row.vehicle_id);
    if (!assignmentMap.has(key)) assignmentMap.set(key, { order_id: String(row.order_id), vehicle_id: String(row.vehicle_id), driver_id: row.driver_id ? String(row.driver_id) : null });
  });
  const assignments = [...assignmentMap.values()];
  const orderIds = assignments.map((row) => row.order_id);
  const orderResult = orderIds.length
    ? await supabase.from("dispatch_orders").select("*").in("id", orderIds).eq("dispatch_date", today).neq("status", "취소").order("created_at", { ascending: true })
    : { data: [], error: null };
  if (orderResult.error) throw new Error("오늘 배차를 불러오지 못했습니다. (" + orderResult.error.message + ")");

  const todayOrders = (orderResult.data || []).map((row) => normalizeDispatchOrder(row));
  const carryOverTrips = (activeTripResult.data || []).map((row) => normalizeDispatchTrip(row));
  const carryOverOrderIds = [...new Set(carryOverTrips.map((trip) => trip.dispatch_order_id).filter((id) => !todayOrders.some((order) => order.id === id)))];
  const carryOverOrderResult = carryOverOrderIds.length
    ? await supabase.from("dispatch_orders").select("*").in("id", carryOverOrderIds).neq("status", "취소")
    : { data: [], error: null };
  if (carryOverOrderResult.error) throw new Error("미완료 운행의 배차를 불러오지 못했습니다. (" + carryOverOrderResult.error.message + ")");
  const nextOrders = [...todayOrders, ...(carryOverOrderResult.data || []).map((row) => normalizeDispatchOrder(row))];
  const relevantOrderIds = nextOrders.map((order) => order.id);
  const allTripResult = relevantOrderIds.length
    ? await supabase.from("dispatch_trips").select("*").in("dispatch_order_id", relevantOrderIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (allTripResult.error) throw new Error("전체 운행 진행상황을 불러오지 못했습니다. (" + allTripResult.error.message + ")");

  const allTrips = (allTripResult.data || []).map((row) => normalizeDispatchTrip(row));
  const vehicleIds = [...new Set([...assignments.map((row) => row.vehicle_id), ...allTrips.map((trip) => trip.vehicle_id)])];
  const vehicleResult = vehicleIds.length
    ? await supabase.from("dispatch_vehicles").select("*").in("id", vehicleIds)
    : { data: [], error: null };
  if (vehicleResult.error) throw new Error("차량 정보를 불러오지 못했습니다. (" + vehicleResult.error.message + ")");
  const vehicles = (vehicleResult.data || []).map((row) => normalizeDispatchVehicle(row));
  const orderVehicleIds = new Map<string, string[]>();
  assignments.forEach((row) => orderVehicleIds.set(row.order_id, [...(orderVehicleIds.get(row.order_id) || []), row.vehicle_id]));
  allTrips.forEach((trip) => {
    if (!orderVehicleIds.get(trip.dispatch_order_id)?.includes(trip.vehicle_id)) {
      orderVehicleIds.set(trip.dispatch_order_id, [...(orderVehicleIds.get(trip.dispatch_order_id) || []), trip.vehicle_id]);
    }
  });

  const todayDriverTrips = (tripResult.data || []).map((row) => normalizeDispatchTrip(row));
  const todayTrips = [...todayDriverTrips];
  carryOverTrips.forEach((trip) => { if (!todayTrips.some((item) => item.id === trip.id)) todayTrips.push(trip); });
  return { todayOrders: nextOrders, todayTrips, allTodayTrips: allTrips, vehicles, orderVehicleIds };
};

export type DriverHistorySnapshot = {
  trips: DispatchTrip[];
  orders: DispatchOrder[];
  vehicles: DispatchVehicle[];
};

export const loadDriverHistory = async (
  supabase: SupabaseClient,
  driverId: string,
  historyDate: string,
): Promise<DriverHistorySnapshot> => {
  const tripResult = await supabase.from("dispatch_trips").select("*").eq("driver_id", driverId).gte("created_at", `${historyDate}T00:00:00+09:00`).lt("created_at", `${nextDate(historyDate)}T00:00:00+09:00`).order("created_at", { ascending: false });
  if (tripResult.error) throw new Error(`운행기록을 불러오지 못했습니다. (${tripResult.error.message})`);
  const trips = (tripResult.data || []).map((row) => normalizeDispatchTrip(row));
  const orderIds = [...new Set(trips.map((trip) => trip.dispatch_order_id))];
  const vehicleIds = [...new Set(trips.map((trip) => trip.vehicle_id))];
  const [orderResult, vehicleResult] = await Promise.all([
    orderIds.length ? supabase.from("dispatch_orders").select("*").in("id", orderIds) : Promise.resolve({ data: [], error: null }),
    vehicleIds.length ? supabase.from("dispatch_vehicles").select("*").in("id", vehicleIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (orderResult.error || vehicleResult.error) throw new Error(`운행 상세를 불러오지 못했습니다. (${(orderResult.error || vehicleResult.error)?.message})`);
  return {
    trips,
    orders: (orderResult.data || []).map((row) => normalizeDispatchOrder(row)),
    vehicles: (vehicleResult.data || []).map((row) => normalizeDispatchVehicle(row)),
  };
};

export const saveDriverTripAction = (supabase: SupabaseClient, rpcName: string, args: Record<string, unknown>) =>
  supabase.rpc(rpcName, args);
