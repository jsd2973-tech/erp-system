import type { SupabaseClient } from "@supabase/supabase-js";

export type DispatchE2EFixture = {
  orderId: string;
  vehicleId: string;
  driverId: string;
  driverName: string;
  vendorName: string;
  itemName: string;
  cleanup: () => Promise<void>;
};

export async function createDispatchE2EFixture(
  db: SupabaseClient,
  prefix: string,
  driverAuthUserId: string,
): Promise<DispatchE2EFixture> {
  const orderId = `${prefix}-dispatch-order`;
  const vendorName = `${prefix} E2E 운송거래처`;
  const itemName = `${prefix} E2E 골재`;
  const driverLookup = await db
    .from("dispatch_drivers")
    .select("*")
    .eq("auth_user_id", driverAuthUserId)
    .maybeSingle();
  if (driverLookup.error) throw new Error(`E2E driver fixture lookup failed: ${driverLookup.error.message}`);
  const previousDriver = driverLookup.data;
  if (!previousDriver) throw new Error("E2E driver fixture is missing the dedicated authenticated driver row.");
  if (!previousDriver.active) throw new Error("E2E driver fixture row must be active.");
  const vehicleId = String(previousDriver.assigned_vehicle_id || "");
  if (!vehicleId) throw new Error("E2E driver fixture must have an assigned test vehicle.");
  const vehicleLookup = await db
    .from("dispatch_vehicles")
    .select("id,active")
    .eq("id", vehicleId)
    .maybeSingle();
  if (vehicleLookup.error) throw new Error(`E2E assigned vehicle lookup failed: ${vehicleLookup.error.message}`);
  if (!vehicleLookup.data?.active) throw new Error("E2E assigned test vehicle is missing or inactive.");
  const driverId = String(previousDriver.id);
  const driverName = String(previousDriver.name || "E2E test driver");
  let orderSeeded = false;

  const cleanup = async () => {
    if (orderSeeded) {
      const { data: trips, error: tripsError } = await db
        .from("dispatch_trips")
        .select("id,status,loading_completed_at,unloading_completed_at")
        .eq("dispatch_order_id", orderId);
      if (tripsError) throw new Error(`E2E dispatch trip cleanup lookup failed: ${tripsError.message}`);

      for (const trip of trips || []) {
        if (trip.status === "상차대기") {
          const { error } = await db.rpc("correct_dispatch_trip_event", {
            p_trip_id: trip.id,
            p_correction_type: "start_cancel",
            p_reason: `${prefix} test cleanup`,
          });
          if (error) throw new Error(`E2E dispatch start cleanup failed: ${error.message}`);
        } else if (trip.status === "진행중") {
          if (trip.loading_completed_at && !trip.unloading_completed_at) {
            const { error } = await db.rpc("correct_dispatch_trip_event", {
              p_trip_id: trip.id,
              p_correction_type: "loading_cancel",
              p_reason: `${prefix} test cleanup`,
            });
            if (error) throw new Error(`E2E dispatch loading cleanup failed: ${error.message}`);
          }
          const { data: resetTrip, error: resetError } = await db
            .from("dispatch_trips")
            .select("status")
            .eq("id", trip.id)
            .single();
          if (resetError) throw new Error(`E2E dispatch cleanup status lookup failed: ${resetError.message}`);
          if (resetTrip.status === "상차대기") {
            const { error } = await db.rpc("correct_dispatch_trip_event", {
              p_trip_id: trip.id,
              p_correction_type: "start_cancel",
              p_reason: `${prefix} test cleanup`,
            });
            if (error) throw new Error(`E2E dispatch start cleanup failed: ${error.message}`);
          }
        }
      }

      const { data: order, error: orderLookupError } = await db
        .from("dispatch_orders")
        .select("deleted_at")
        .eq("id", orderId)
        .maybeSingle();
      if (orderLookupError) throw new Error(`E2E dispatch order cleanup lookup failed: ${orderLookupError.message}`);
      if (order) {
        if (!order.deleted_at) {
          const { error } = await db.rpc("delete_dispatch_order", { p_order_id: orderId });
          if (error) throw new Error(`E2E dispatch order trash cleanup failed: ${error.message}`);
        }
        const { error } = await db.rpc("permanently_delete_dispatch_order", { p_order_id: orderId });
        if (error) throw new Error(`E2E dispatch permanent cleanup failed: ${error.message}`);
      }
    }
  };

  try {
    const { error: orderError } = await db.rpc("save_dispatch_order_with_assignments", {
      p_order: {
        id: orderId,
        dispatch_date: new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
        vendor_name: vendorName,
        loading_location: `${prefix} 상차지`,
        unloading_location: `${prefix} 하차지`,
        item_name: itemName,
        total_volume: 51,
        volume_per_trip: 17,
        estimated_trip_count: 3,
        status: "대기",
        memo: prefix,
      },
      p_assignments: [{ vehicle_id: vehicleId, driver_id: driverId }],
    });
    if (orderError) throw new Error(`E2E dispatch order seed failed: ${orderError.message}`);
    orderSeeded = true;

    return { orderId, vehicleId, driverId, driverName, vendorName, itemName, cleanup };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "E2E dispatch fixture seed failed and partial cleanup also failed.");
    }
    throw error;
  }
}
