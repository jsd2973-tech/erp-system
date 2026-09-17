"""Add company-aware vehicle/driver dispatch behavior after the legacy patches.

The dispatch feature has several historical build-time patches. Keeping this
change as the final patch makes the existing patch chain deterministic while
the source components remain easy to inspect and maintain.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1"


def patch(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text()
    if MARKER in text:
        return
    if old not in text:
        raise SystemExit(f"company dispatch patch anchor not found: {relative}")
    path.write_text(text.replace(old, new, 1))


def append(relative: str, value: str) -> None:
    path = ROOT / relative
    text = path.read_text()
    if MARKER in text:
        return
    path.write_text(text.rstrip() + "\n\n" + value.lstrip() + "\n")


patch(
    "src/features/dispatch/dispatchTypes.ts",
    """export type DispatchVehicle = {
  id: string;
  vehicle_number: string;
  active: boolean;""",
    """export type DispatchVehicle = {
  id: string;
  vehicle_number: string;
  company_name: string;
  active: boolean;""",
)
patch(
    "src/features/dispatch/dispatchTypes.ts",
    """export type DispatchDriver = {
  id: string;
  name: string;
  phone: string;
  assigned_vehicle_id: string | null;""",
    """export type DispatchDriver = {
  id: string;
  name: string;
  phone: string;
  company_name: string;
  assigned_vehicle_id: string | null;""",
)
patch(
    "src/features/dispatch/dispatchTypes.ts",
    """export type DispatchOrderVehicle = {
  id: string;
  order_id: string;
  vehicle_id: string;
  created_at?: string;
};

export type DispatchOrderWithVehicles = DispatchOrder & {
  vehicle_ids: string[];
};

export type DispatchOrderForm = {""",
    """export type DispatchOrderVehicle = {
  id: string;
  order_id: string;
  vehicle_id: string;
  driver_id: string | null;
  created_at?: string;
};

export type DispatchOrderWithVehicles = DispatchOrder & {
  vehicle_ids: string[];
  assignments: DispatchOrderVehicle[];
};

export type DispatchAssignmentForm = {
  company_name: string;
  vehicle_id: string;
  driver_id: string;
};

export type DispatchOrderForm = {""",
)
patch(
    "src/features/dispatch/dispatchTypes.ts",
    """  memo: string;
  vehicle_ids: string[];
};

export type DispatchFilters""",
    """  memo: string;
  vehicle_ids: string[];
  assignments: DispatchAssignmentForm[];
};

// COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1

export type DispatchFilters""",
)

patch(
    "src/features/dispatch/DispatchPage.tsx",
    """import VehicleManagement from "./VehicleManagement";
import type { DispatchCustomer, DispatchDriver, DispatchItem, DispatchLocation, DispatchLocationType, DispatchOrder, DispatchOrderForm, DispatchOrderVehicle, DispatchOrderWithVehicles, DispatchTrip, DispatchTripLocation, DispatchVehicle, DispatchView } from "./dispatchTypes";
import { createDispatchId, dispatchToday, toPositiveNumber, calculateEstimatedTrips } from "./dispatchUtils";""",
    """import VehicleManagement from "./VehicleManagement";
import type { DispatchMasterImportResult, DriverImportRow, VehicleImportRow } from "./DispatchMasterImport";
import type { DispatchCustomer, DispatchDriver, DispatchItem, DispatchLocation, DispatchLocationType, DispatchOrder, DispatchOrderForm, DispatchOrderVehicle, DispatchOrderWithVehicles, DispatchTrip, DispatchTripLocation, DispatchVehicle, DispatchView } from "./dispatchTypes";
import { createDispatchId, dispatchToday, toPositiveNumber, calculateEstimatedTrips, normalizeCompanyName, normalizeVehicleNumber } from "./dispatchUtils";""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """if (canReadVehicles && !vehicleResult.error && vehicleResult.data) {
      setVehicles(vehicleResult.data.map((row) => ({ ...row, id: String(row.id), vehicle_number: String(row.vehicle_number || ""), active: row.active !== false, memo: String(row.memo || "") })) as DispatchVehicle[]);
    }

    if (canReadDrivers && !driverResult.error && driverResult.data) {
      setDrivers(driverResult.data.map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), phone: String(row.phone || ""), assigned_vehicle_id: row.assigned_vehicle_id ? String(row.assigned_vehicle_id) : null, auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null, active: row.active !== false, memo: String(row.memo || "") })) as DispatchDriver[]);
    }""",
    """if (canReadVehicles && !vehicleResult.error && vehicleResult.data) {
      setVehicles(vehicleResult.data.map((row) => ({ ...row, id: String(row.id), vehicle_number: String(row.vehicle_number || ""), company_name: normalizeCompanyName(String(row.company_name || "")), active: row.active !== false, memo: String(row.memo || "") })) as DispatchVehicle[]);
    }

    if (canReadDrivers && !driverResult.error && driverResult.data) {
      setDrivers(driverResult.data.map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), phone: String(row.phone || ""), company_name: normalizeCompanyName(String(row.company_name || "")), assigned_vehicle_id: row.assigned_vehicle_id ? String(row.assigned_vehicle_id) : null, auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null, active: row.active !== false, memo: String(row.memo || "") })) as DispatchDriver[]);
    }""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """    if (canReadOrders && !orderResult.error && !assignmentResult.error && orderResult.data && assignmentResult.data) {
      const assignments = assignmentResult.data.map((row) => ({ ...row, id: String(row.id), order_id: String(row.order_id), vehicle_id: String(row.vehicle_id) })) as DispatchOrderVehicle[];
      const assignmentMap = new Map<string, string[]>();
      assignments.forEach((assignment) => assignmentMap.set(assignment.order_id, [...(assignmentMap.get(assignment.order_id) || []), assignment.vehicle_id]));
      const normalizedOrders = orderResult.data.map((row) => ({""",
    """    if (canReadOrders && !orderResult.error && !assignmentResult.error && orderResult.data && assignmentResult.data) {
      const assignments = assignmentResult.data.map((row) => ({ ...row, id: String(row.id), order_id: String(row.order_id), vehicle_id: String(row.vehicle_id), driver_id: row.driver_id ? String(row.driver_id) : null })) as DispatchOrderVehicle[];
      const assignmentMap = new Map<string, DispatchOrderVehicle[]>();
      assignments.forEach((assignment) => assignmentMap.set(assignment.order_id, [...(assignmentMap.get(assignment.order_id) || []), assignment]));
      const normalizedOrders = orderResult.data.map((row) => ({""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """        vehicle_ids: assignmentMap.get(String(row.id)) || [],
        deleted_at: row.deleted_at ? String(row.deleted_at) : null,""",
    """        assignments: assignmentMap.get(String(row.id)) || [],
        vehicle_ids: (assignmentMap.get(String(row.id)) || []).map((assignment) => assignment.vehicle_id),
        deleted_at: row.deleted_at ? String(row.deleted_at) : null,""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """    const payload = { id: vehicle.id || createDispatchId(), vehicle_number: vehicle.vehicle_number, active: vehicle.active, memo: vehicle.memo };""",
    """    const payload = { id: vehicle.id || createDispatchId(), vehicle_number: normalizeVehicleNumber(vehicle.vehicle_number), company_name: normalizeCompanyName(vehicle.company_name), active: vehicle.active, memo: vehicle.memo };""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """    const payload = { id: driver.id || createDispatchId(), name: driver.name, phone: driver.phone, assigned_vehicle_id: driver.assigned_vehicle_id, auth_user_id: authUserId, active: driver.active, memo: driver.memo };""",
    """    const payload = { id: driver.id || createDispatchId(), name: driver.name, phone: driver.phone, company_name: normalizeCompanyName(driver.company_name), assigned_vehicle_id: driver.assigned_vehicle_id, auth_user_id: authUserId, active: driver.active, memo: driver.memo };""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """    const { error: saveError } = await supabase.rpc("save_dispatch_order", { p_order: orderPayload, p_vehicle_ids: form.vehicle_ids });""",
    """    const { error: saveError } = await supabase.rpc("save_dispatch_order_with_assignments", { p_order: orderPayload, p_assignments: form.assignments });""",
)

patch(
    "src/features/dispatch/DispatchPage.tsx",
    """  const saveCustomer = async (customer: DispatchCustomer) => {""",
    r"""  const importVehicles = async (rows: VehicleImportRow[]): Promise<DispatchMasterImportResult> => {
    setSaving(true);
    setError("");
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let conflicts = 0;
    let failed = false;
    const existingByNumber = new Map(vehicles.map((vehicle) => [normalizeVehicleNumber(vehicle.vehicle_number).toLocaleLowerCase("ko-KR"), vehicle]));
    for (const row of rows) {
      const vehicleNumber = normalizeVehicleNumber(row.vehicle_number);
      const companyName = normalizeCompanyName(row.company_name);
      if (!vehicleNumber || !companyName) { skipped += 1; continue; }
      const existing = existingByNumber.get(vehicleNumber.toLocaleLowerCase("ko-KR"));
      if (existing) {
        if (existing.company_name && normalizeCompanyName(existing.company_name) !== companyName) { conflicts += 1; continue; }
        if (existing.company_name) { skipped += 1; continue; }
        const { error: updateError } = await supabase.from("dispatch_vehicles").update({ company_name: companyName }).eq("id", existing.id);
        if (updateError) { setError("차량 " + vehicleNumber + " 보완 실패: " + updateError.message); failed = true; break; }
        updated += 1;
      } else {
        const { error: insertError } = await supabase.from("dispatch_vehicles").insert({ id: createDispatchId(), vehicle_number: vehicleNumber, company_name: companyName, active: true, memo: "" });
        if (insertError) { setError("차량 " + vehicleNumber + " 등록 실패: " + insertError.message); failed = true; break; }
        inserted += 1;
      }
    }
    setSaving(false);
    await loadDispatchData();
    if (!failed) onNotify("차량 가져오기 완료 · 신규 " + inserted + "건 · 보완 " + updated + "건");
    return { inserted, updated, skipped, conflicts };
  };

  const importDrivers = async (rows: DriverImportRow[]): Promise<DispatchMasterImportResult> => {
    setSaving(true);
    setError("");
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let conflicts = 0;
    let failed = false;
    const phoneKey = (value: string) => value.replace(/[^0-9]/g, "");
    const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
    for (const row of rows) {
      const name = row.name.trim();
      const phone = row.phone.trim();
      const companyName = normalizeCompanyName(row.company_name);
      if (!name || !companyName) { skipped += 1; continue; }
      const incomingPhone = phoneKey(phone);
      const existing = drivers.find((driver) => (incomingPhone && phoneKey(driver.phone) === incomingPhone)
        || (normalizedName(driver.name) === normalizedName(name) && (!driver.company_name || normalizeCompanyName(driver.company_name) === companyName)));
      if (!existing) {
        const { error: insertError } = await supabase.from("dispatch_drivers").insert({ id: createDispatchId(), name, phone, company_name: companyName, assigned_vehicle_id: null, auth_user_id: null, active: true, memo: "" });
        if (insertError) { setError("기사 " + name + " 등록 실패: " + insertError.message); failed = true; break; }
        inserted += 1;
        continue;
      }
      if (existing.company_name && normalizeCompanyName(existing.company_name) !== companyName) { conflicts += 1; continue; }
      if (existing.phone && phone && phoneKey(existing.phone) !== incomingPhone && normalizedName(existing.name) === normalizedName(name)) { conflicts += 1; continue; }
      const payload: Record<string, string> = {};
      if (!existing.company_name && companyName) payload.company_name = companyName;
      if (!existing.phone && phone) payload.phone = phone;
      if (!Object.keys(payload).length) { skipped += 1; continue; }
      const { error: updateError } = await supabase.from("dispatch_drivers").update(payload).eq("id", existing.id);
      if (updateError) { setError("기사 " + name + " 보완 실패: " + updateError.message); failed = true; break; }
      updated += 1;
    }
    setSaving(false);
    await loadDispatchData();
    if (!failed) onNotify("기사 가져오기 완료 · 신규 " + inserted + "건 · 보완 " + updated + "건");
    return { inserted, updated, skipped, conflicts };
  };

  const saveCustomer = async (customer: DispatchCustomer) => {""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """        {view === "dispatch_register" && <><DispatchRegister customers={customers} locations={locations} items={items} vehicles={vehicles} editingOrder={editingOrder} saving={saving} onSave={saveOrder} onCancelEdit={() => setEditingOrder(null)} />""",
    """        {view === "dispatch_register" && <><DispatchRegister customers={customers} locations={locations} items={items} vehicles={vehicles} drivers={drivers} editingOrder={editingOrder} saving={saving} onSave={saveOrder} onCancelEdit={() => setEditingOrder(null)} />""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """        {view === "dispatch_vehicles" && <VehicleManagement vehicles={vehicles} saving={saving} onSave={saveVehicle} />}
        {view === "dispatch_drivers" && <DriverManagement drivers={drivers} vehicles={vehicles} saving={saving} canManageAuthUserId={isAdmin} onSave={saveDriver} />}""",
    """        {view === "dispatch_vehicles" && <VehicleManagement vehicles={vehicles} saving={saving} onSave={saveVehicle} onImport={importVehicles} />}
        {view === "dispatch_drivers" && <DriverManagement drivers={drivers} saving={saving} canManageAuthUserId={isAdmin} onSave={saveDriver} onImport={importDrivers} />}""",
)
patch(
    "src/features/dispatch/DispatchPage.tsx",
    """import "./dispatch.css";""",
    """import "./dispatch.css";

// COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1""",
)

patch(
    "src/features/dispatch/DispatchDetail.tsx",
    """export default function DispatchDetail({ order, vehicles, drivers, trips, tripLocations = [], onEdit, showTrips = true }: DispatchDetailProps) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const assignedVehicleIds = [...order.vehicle_ids].sort((a, b) => (vehicleById.get(a)?.vehicle_number || "").localeCompare(vehicleById.get(b)?.vehicle_number || "", "ko-KR", { numeric: true, sensitivity: "base" }));""",
    """export default function DispatchDetail({ order, vehicles, drivers, trips, tripLocations = [], onEdit, showTrips = true }: DispatchDetailProps) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const assignedRows = [...(order.assignments || [])].sort((left, right) => (vehicleById.get(left.vehicle_id)?.vehicle_number || "").localeCompare(vehicleById.get(right.vehicle_id)?.vehicle_number || "", "ko-KR", { numeric: true, sensitivity: "base" }));
  const assignedVehicleIds = [...order.vehicle_ids].sort((a, b) => (vehicleById.get(a)?.vehicle_number || "").localeCompare(vehicleById.get(b)?.vehicle_number || "", "ko-KR", { numeric: true, sensitivity: "base" }));""",
)
patch(
    "src/features/dispatch/DispatchDetail.tsx",
    """      <div className="dispatch-assigned-list">
        <span>배정 차량</span>
        <div>{order.vehicle_ids.length ? assignedVehicleIds.map((id) => <strong key={id}>{vehicleById.get(id)?.vehicle_number || "차량 확인 필요"}</strong>) : <em>배정된 차량이 없습니다.</em>}</div>
      </div>""",
    """      <div className="dispatch-assigned-list">
        <span>배정 차량·기사</span>
        <div>{assignedRows.length ? assignedRows.map((assignment) => <strong key={assignment.id}>{vehicleById.get(assignment.vehicle_id)?.vehicle_number || "차량 확인 필요"} · {driverById.get(assignment.driver_id || "")?.name || "기사 확인 필요"}</strong>) : order.vehicle_ids.length ? assignedVehicleIds.map((id) => <strong key={id}>{vehicleById.get(id)?.vehicle_number || "차량 확인 필요"} · 기사 확인 필요</strong>) : <em>배정된 차량이 없습니다.</em>}</div>
      </div>

      {/* COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1 */}""",
)

patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """type TodayOrder = { id: string; vendor_name: string; item_name: string; loading_location: string; unloading_location: string; status: string; total_volume: number; estimated_trip_count: number; vehicle_ids: string[] };""",
    """type TodayOrder = { id: string; vendor_name: string; item_name: string; loading_location: string; unloading_location: string; status: string; total_volume: number; estimated_trip_count: number; vehicle_ids: string[]; assignments: Array<{ vehicle_id: string; driver_id: string | null }> };""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """  lastText: string;
};""",
    """  lastText: string;
  vehicleIds: string[];
};""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """      supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id"),""",
    """      supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id,driver_id"),""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """      estimated_trip_count: Number(row.estimated_trip_count || 0),
      vehicle_ids: assignments.filter((a) => String(a.order_id) === String(row.id)).map((a) => String(a.vehicle_id)),""",
    """      estimated_trip_count: Number(row.estimated_trip_count || 0),
      assignments: assignments.filter((a) => String(a.order_id) === String(row.id)).map((a) => ({ vehicle_id: String(a.vehicle_id), driver_id: a.driver_id ? String(a.driver_id) : null })),
      vehicle_ids: assignments.filter((a) => String(a.order_id) === String(row.id)).map((a) => String(a.vehicle_id)),""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """    const assigned = driver.assigned_vehicle_id
      ? orders.filter((order) => order.vehicle_ids.includes(driver.assigned_vehicle_id!))
      : [];
    const activeOrder = active ? orders.find((order) => order.id === active.dispatch_order_id) || null : null;""",
    """    const assigned = orders.filter((order) => order.assignments.some((assignment) => assignment.driver_id === driver.id)
      || Boolean(driver.assigned_vehicle_id && order.vehicle_ids.includes(driver.assigned_vehicle_id)));
    const vehicleIds = [...new Set([
      ...mine.map((trip) => trip.vehicle_id),
      ...assigned.flatMap((order) => order.assignments.filter((assignment) => assignment.driver_id === driver.id).map((assignment) => assignment.vehicle_id)),
      ...(driver.assigned_vehicle_id ? [driver.assigned_vehicle_id] : []),
    ])];
    const activeOrder = active ? orders.find((order) => order.id === active.dispatch_order_id) || null : null;""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """    return { driver, mine, completed, completedVolume, state, currentOrder, progress, currentRoundText, remainingText, lastText };""",
    """    return { driver, mine, completed, completedVolume, state, currentOrder, progress, currentRoundText, remainingText, lastText, vehicleIds };""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """  const dailyDriverSummaries = useMemo<DailySummary[]>(() => drivers
    .filter((driver) => driver.active && (tripIndexes.byDriver.has(driver.id) || Boolean(driver.assigned_vehicle_id && ordersByVehicle.has(driver.assigned_vehicle_id))))
    .map((driver) => buildDailySummary(
      driver.id,
      driver.name,
      driver.assigned_vehicle_id ? vehicleById.get(driver.assigned_vehicle_id)?.vehicle_number || "차량 확인 필요" : "차량 미지정",
      tripIndexes.byDriver.get(driver.id) || [],
    ))
    .sort((left, right) => right.completedVolume - left.completedVolume || right.completedCount - left.completedCount || left.title.localeCompare(right.title, "ko-KR")), [drivers, ordersByVehicle, tripIndexes, vehicleById]);""",
    """  const dailyDriverSummaries = useMemo<DailySummary[]>(() => drivers
    .filter((driver) => {
      const assignedVehicleIds = orders.flatMap((order) => order.assignments.filter((assignment) => assignment.driver_id === driver.id).map((assignment) => assignment.vehicle_id));
      return driver.active && (tripIndexes.byDriver.has(driver.id) || assignedVehicleIds.length > 0 || Boolean(driver.assigned_vehicle_id && ordersByVehicle.has(driver.assigned_vehicle_id)));
    })
    .map((driver) => {
      const assignedVehicleIds = [...new Set([
        ...trips.filter((trip) => trip.driver_id === driver.id).map((trip) => trip.vehicle_id),
        ...orders.flatMap((order) => order.assignments.filter((assignment) => assignment.driver_id === driver.id).map((assignment) => assignment.vehicle_id)),
        ...(driver.assigned_vehicle_id ? [driver.assigned_vehicle_id] : []),
      ])];
      const secondary = assignedVehicleIds.map((id) => vehicleById.get(id)?.vehicle_number || "차량 확인 필요").join(" · ") || "차량 미지정";
      return buildDailySummary(driver.id, driver.name, secondary, tripIndexes.byDriver.get(driver.id) || []);
    })
    .sort((left, right) => right.completedVolume - left.completedVolume || right.completedCount - left.completedCount || left.title.localeCompare(right.title, "ko-KR")), [drivers, orders, ordersByVehicle, trips, tripIndexes, vehicleById]);""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """            const vehicleNumber = row.driver.assigned_vehicle_id
              ? vehicleById.get(row.driver.assigned_vehicle_id)?.vehicle_number || "차량 확인 필요"
              : "차량 미지정";""",
    """            const vehicleNumber = row.vehicleIds.length
              ? row.vehicleIds.map((id) => vehicleById.get(id)?.vehicle_number || "차량 확인 필요").join(" · ")
              : "차량 미지정";""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """                <p>{selectedRow.driver.assigned_vehicle_id ? vehicleById.get(selectedRow.driver.assigned_vehicle_id)?.vehicle_number || "차량 확인 필요" : "차량 미지정"}</p>""",
    """                <p>{selectedRow.vehicleIds.length ? selectedRow.vehicleIds.map((id) => vehicleById.get(id)?.vehicle_number || "차량 확인 필요").join(" · ") : "차량 미지정"}</p>""",
)
patch(
    "src/features/dispatch/DriverStatusDashboard.tsx",
    """import "./driverStatusDashboard.css";""",
    """import "./driverStatusDashboard.css";

// COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1""",
)

def patch_mobile_load() -> None:
    path = ROOT / "src/features/dispatch/DriverMobileApp.tsx"
    text = path.read_text()
    if MARKER in text:
        return
    start = text.index("  const loadOrders = useCallback(async (silent = false) => {")
    end = text.index("\n\n  const loadHistory", start)
    new_load = r"""  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    const legacyVehicleId = driver.assigned_vehicle_id;
    const [assignmentResult, legacyAssignmentResult, tripResult, activeTripResult] = await Promise.all([
      supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id,driver_id").eq("driver_id", driver.id),
      legacyVehicleId
        ? supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id,driver_id").eq("vehicle_id", legacyVehicleId).is("driver_id", null)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).gte("created_at", dispatchToday() + "T00:00:00+09:00").lt("created_at", nextDate(dispatchToday()) + "T00:00:00+09:00").order("created_at", { ascending: false }),
      supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).in("status", ["상차대기", "진행중"]).order("created_at", { ascending: false }),
    ]);
    const loadError = assignmentResult.error || legacyAssignmentResult.error || tripResult.error || activeTripResult.error;
    if (loadError) {
      setError("배차 정보를 불러오지 못했습니다. (" + loadError.message + ")");
      setLoading(false);
      return;
    }

    const assignmentMap = new Map<string, { order_id: string; vehicle_id: string; driver_id: string | null }>();
    [...(assignmentResult.data || []), ...(legacyAssignmentResult.data || [])].forEach((row) => {
      const key = String(row.order_id) + ":" + String(row.vehicle_id);
      if (!assignmentMap.has(key)) assignmentMap.set(key, { order_id: String(row.order_id), vehicle_id: String(row.vehicle_id), driver_id: row.driver_id ? String(row.driver_id) : null });
    });
    const assignments = [...assignmentMap.values()];
    const orderIds = assignments.map((row) => row.order_id);
    const orderResult = orderIds.length
      ? await supabase.from("dispatch_orders").select("*").in("id", orderIds).eq("dispatch_date", dispatchToday()).neq("status", "취소").order("created_at", { ascending: true })
      : { data: [], error: null };
    if (orderResult.error) {
      setError("오늘 배차를 불러오지 못했습니다. (" + orderResult.error.message + ")");
      setLoading(false);
      return;
    }

    const todayOrders = (orderResult.data || []).map((row) => normalizeOrder(row));
    const carryOverTrips = (activeTripResult.data || []).map((row) => normalizeTrip(row));
    const carryOverOrderIds = [...new Set(carryOverTrips.map((trip) => trip.dispatch_order_id).filter((id) => !todayOrders.some((order) => order.id === id)))];
    const carryOverOrderResult = carryOverOrderIds.length
      ? await supabase.from("dispatch_orders").select("*").in("id", carryOverOrderIds).neq("status", "취소")
      : { data: [], error: null };
    if (carryOverOrderResult.error) {
      setError("미완료 운행의 배차를 불러오지 못했습니다. (" + carryOverOrderResult.error.message + ")");
      setLoading(false);
      return;
    }
    const nextOrders = [...todayOrders, ...(carryOverOrderResult.data || []).map((row) => normalizeOrder(row))];
    const relevantOrderIds = nextOrders.map((order) => order.id);
    const allTripResult = relevantOrderIds.length
      ? await supabase.from("dispatch_trips").select("*").in("dispatch_order_id", relevantOrderIds).order("created_at", { ascending: false })
      : { data: [], error: null };
    if (allTripResult.error) {
      setError("전체 운행 진행상황을 불러오지 못했습니다. (" + allTripResult.error.message + ")");
      setLoading(false);
      return;
    }

    const allTrips = (allTripResult.data || []).map((row) => normalizeTrip(row));
    const vehicleIds = [...new Set([...assignments.map((row) => row.vehicle_id), ...allTrips.map((trip) => trip.vehicle_id)])];
    const vehicleResult = vehicleIds.length
      ? await supabase.from("dispatch_vehicles").select("*").in("id", vehicleIds)
      : { data: [], error: null };
    if (vehicleResult.error) {
      setError("차량 정보를 불러오지 못했습니다. (" + vehicleResult.error.message + ")");
      setLoading(false);
      return;
    }
    const nextVehicles = (vehicleResult.data || []).map((row) => ({ ...row, id: String(row.id), vehicle_number: String(row.vehicle_number || ""), company_name: String(row.company_name || ""), active: row.active !== false, memo: String(row.memo || "") } as DispatchVehicle));
    const nextVehicle = nextVehicles[0] || null;
    const nextOrderVehicleIds = new Map<string, string[]>();
    assignments.forEach((row) => nextOrderVehicleIds.set(row.order_id, [...(nextOrderVehicleIds.get(row.order_id) || []), row.vehicle_id]));
    allTrips.forEach((trip) => {
      if (!nextOrderVehicleIds.get(trip.dispatch_order_id)?.includes(trip.vehicle_id)) {
        nextOrderVehicleIds.set(trip.dispatch_order_id, [...(nextOrderVehicleIds.get(trip.dispatch_order_id) || []), trip.vehicle_id]);
      }
    });

    setVehicle(nextVehicle);
    setVehiclesById((current) => new Map([...current, ...nextVehicles.map((item) => [item.id, item] as const)]));
    setOrderVehicleIds(nextOrderVehicleIds);
    setTodayOrders(nextOrders);
    const todayDriverTrips = (tripResult.data || []).map((row) => normalizeTrip(row));
    const relevantDriverTrips = [...todayDriverTrips];
    carryOverTrips.forEach((trip) => { if (!relevantDriverTrips.some((item) => item.id === trip.id)) relevantDriverTrips.push(trip); });
    setTodayTrips(relevantDriverTrips);
    setAllTodayTrips(allTrips);
    setOrdersById((current) => new Map([...current, ...nextOrders.map((order) => [order.id, order] as const)]));
    setLoading(false);
  }, [driver.assigned_vehicle_id, driver.id, supabase]);"""
    path.write_text(text[:start] + new_load + text[end:])


patch_mobile_load()
patch(
    "src/features/dispatch/DriverMobileApp.tsx",
    """  const [ordersById, setOrdersById] = useState<Map<string, DispatchOrder>>(new Map());
  const [vehicle, setVehicle] = useState<DispatchVehicle | null>(null);""",
    """  const [ordersById, setOrdersById] = useState<Map<string, DispatchOrder>>(new Map());
  const [orderVehicleIds, setOrderVehicleIds] = useState<Map<string, string[]>>(new Map());
  const [vehicle, setVehicle] = useState<DispatchVehicle | null>(null);""",
)
patch(
    "src/features/dispatch/DriverMobileApp.tsx",
    """    setVehiclesById((current) => new Map([...current, ...(vehicleResult.data || []).map((row) => [String(row.id), { ...row, id: String(row.id), vehicle_number: String(row.vehicle_number || ""), active: row.active !== false, memo: String(row.memo || "") } as DispatchVehicle] as const)]));""",
    """    setVehiclesById((current) => new Map([...current, ...(vehicleResult.data || []).map((row) => [String(row.id), { ...row, id: String(row.id), vehicle_number: String(row.vehicle_number || ""), company_name: String(row.company_name || ""), active: row.active !== false, memo: String(row.memo || "") } as DispatchVehicle] as const)]));""",
)
patch(
    "src/features/dispatch/DriverMobileApp.tsx",
    """  const sortedTodayOrders = [...todayOrders].sort((left, right) => Number(isOrderCompleted(left)) - Number(isOrderCompleted(right)));""",
    """  const selectedVehicle = activeTrip ? vehiclesById.get(activeTrip.vehicle_id) || null : selectedOrder ? vehiclesById.get(orderVehicleIds.get(selectedOrder.id)?.[0] || "") || vehicle : vehicle;
  const sortedTodayOrders = [...todayOrders].sort((left, right) => Number(isOrderCompleted(left)) - Number(isOrderCompleted(right)));""",
)
patch(
    "src/features/dispatch/DriverMobileApp.tsx",
    """        <div><span>25.5T DUMP</span><h1>{driver.name} 기사님</h1><p>{vehicle?.vehicle_number || "담당 차량 미지정"}</p></div>""",
    """        <div><span>25.5T DUMP</span><h1>{driver.name} 기사님</h1><p>{selectedVehicle?.vehicle_number || "배정 차량 확인 필요"}</p></div>""",
)
patch(
    "src/features/dispatch/DriverMobileApp.tsx",
    """            {!driver.assigned_vehicle_id ? <div className="driver-mobile-empty">관리자가 담당 차량을 지정해야 합니다.</div> : !todayOrders.length ? <div className="driver-mobile-empty">오늘 배정된 배차가 없습니다.</div> : sortedTodayOrders.map((order) => {
              const orderTrips = allTodayTrips.filter((trip) => trip.dispatch_order_id === order.id);""",
    """            {!todayOrders.length ? <div className="driver-mobile-empty">오늘 배정된 배차가 없습니다.</div> : sortedTodayOrders.map((order) => {
              const orderTrips = allTodayTrips.filter((trip) => trip.dispatch_order_id === order.id);
              const orderVehicles = [...new Set([...(orderVehicleIds.get(order.id) || []), ...orderTrips.map((trip) => trip.vehicle_id)])];""",
)
patch(
    "src/features/dispatch/DriverMobileApp.tsx",
    """                <dl><div><dt>상차지</dt><dd>{order.loading_location}</dd></div><div><dt>하차지</dt><dd>{order.unloading_location}</dd></div><div><dt>예정 물량</dt><dd>{formatVolume(order.total_volume)}</dd></div><div><dt>차량</dt><dd>{vehicle?.vehicle_number || "-"}</dd></div></dl>""",
    """                <dl><div><dt>상차지</dt><dd>{order.loading_location}</dd></div><div><dt>하차지</dt><dd>{order.unloading_location}</dd></div><div><dt>예정 물량</dt><dd>{formatVolume(order.total_volume)}</dd></div><div><dt>차량</dt><dd>{orderVehicles.map((id) => vehiclesById.get(id)?.vehicle_number || "차량 확인 필요").join(" · ") || "-"}</dd></div></dl>""",
)
patch(
    "src/features/dispatch/DriverMobileApp.tsx",
    """              <dl><div><dt>상차 → 하차</dt><dd>{selectedOrder.loading_location} → {selectedOrder.unloading_location}</dd></div><div><dt>차량 / 기사</dt><dd>{vehicle?.vehicle_number || "-"} / {driver.name}</dd></div><div><dt>기본 운송량</dt><dd>{formatVolume(selectedOrder.volume_per_trip)}</dd></div></dl>""",
    """              <dl><div><dt>상차 → 하차</dt><dd>{selectedOrder.loading_location} → {selectedOrder.unloading_location}</dd></div><div><dt>차량 / 기사</dt><dd>{selectedVehicle?.vehicle_number || "-"} / {driver.name}</dd></div><div><dt>기본 운송량</dt><dd>{formatVolume(selectedOrder.volume_per_trip)}</dd></div></dl>""",
)
patch(
    "src/features/dispatch/DriverMobileApp.tsx",
    """import "./driverMobile.css";""",
    """import "./driverMobile.css";

// COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1""",
)


append(
    "src/features/dispatch/dispatch.css",
    r"""/* COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1 */
.dispatch-section-head-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dispatch-outline-button{min-height:38px;border:1px solid #c8d7e7;border-radius:10px;padding:0 13px;background:#fff;color:#20598e;font-weight:800;cursor:pointer}.dispatch-outline-button:disabled{opacity:.55;cursor:not-allowed}.dispatch-assignment-picker{margin-top:18px;padding:18px;border:1px solid #d8e3ed;border-radius:16px;background:#f8fbfe}.dispatch-assignment-picker-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.dispatch-assignment-picker-head div{display:grid;gap:4px}.dispatch-assignment-picker-head strong{font-size:15px;color:#183a5a}.dispatch-assignment-picker-head span{font-size:12px;color:#718297}.dispatch-assignment-rows{display:grid;gap:10px}.dispatch-assignment-row{display:grid;grid-template-columns:1fr 1.2fr 1.2fr auto;align-items:end;gap:10px;padding:12px;border:1px solid #dbe6ef;border-radius:12px;background:#fff}.dispatch-assignment-row label{display:grid;gap:5px}.dispatch-assignment-row label span{font-size:11px;font-weight:800;color:#64758a}.dispatch-assignment-row select{min-height:40px;border:1px solid #cbd9e6;border-radius:8px;padding:0 10px;background:#fff;color:#1c344d;font-weight:700}.dispatch-assignment-remove{min-height:40px;border:0;border-radius:8px;padding:0 10px;background:#eef2f6;color:#8a4750;font-weight:800;cursor:pointer}.dispatch-master-import{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dispatch-import-preview{flex-basis:100%;margin-top:12px;padding:12px;border:1px solid #d8e3ed;border-radius:12px;background:#f8fbfe}.dispatch-import-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.dispatch-import-head div{display:grid;gap:3px}.dispatch-import-head strong{color:#193b5b}.dispatch-import-head span{font-size:12px;color:#708195}.dispatch-import-table-wrap{overflow:auto;max-height:320px}.dispatch-import-table{min-width:680px}.dispatch-import-status{display:inline-flex;padding:3px 7px;border-radius:999px;background:#e9f4ec;color:#26714a;font-size:11px;font-weight:800}.dispatch-import-status.new{background:#e8f1ff;color:#2163a3}.dispatch-import-status.conflict{background:#fff0e8;color:#a84d25}.dispatch-import-message{width:100%;margin:0;color:#236b48;font-size:12px;font-weight:800}@media(max-width:760px){.dispatch-section-head-actions{align-items:stretch}.dispatch-section-head-actions .dispatch-master-import{width:100%}.dispatch-section-head-actions .dispatch-master-import>.dispatch-outline-button{width:100%}.dispatch-assignment-picker{padding:13px;border-radius:12px}.dispatch-assignment-picker-head{align-items:flex-start;flex-direction:column}.dispatch-assignment-picker-head .dispatch-outline-button{width:100%}.dispatch-assignment-row{grid-template-columns:1fr 1fr;gap:8px}.dispatch-assignment-row label:first-child{grid-column:1/-1}.dispatch-assignment-remove{grid-column:1/-1}.dispatch-import-head{align-items:stretch;flex-direction:column}.dispatch-import-head .dispatch-primary{width:100%}.dispatch-import-preview{overflow:hidden}}""",
)
