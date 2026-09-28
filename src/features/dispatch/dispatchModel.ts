import type {
  DispatchCustomer,
  DispatchDriver,
  DispatchItem,
  DispatchLocation,
  DispatchOrder,
  DispatchOrderVehicle,
  DispatchOrderWithVehicles,
  DispatchTrip,
  DispatchTripLocation,
  DispatchVehicle,
} from "./dispatchTypes";
import { formatVolume, normalizeCompanyName } from "./dispatchUtils";

export type DispatchStatusOrder = {
  id: string;
  vendor_name: string;
  item_name: string;
  loading_location: string;
  unloading_location: string;
  status: string;
  total_volume: number;
  estimated_trip_count: number;
  vehicle_ids: string[];
  assignments: Array<{ vehicle_id: string; driver_id: string | null }>;
};

export type DriverState = "운행중" | "상차대기" | "대기" | "운행 완료" | "미사용";
export type ActivityKind = "하차완료" | "상차완료" | "운행시작";
export type DriverProgress = {
  completedCount: number;
  completedVolume: number;
  remainingTrips: number | null;
  remainingVolume: number | null;
};

export type DriverRow = {
  driver: DispatchDriver;
  mine: DispatchTrip[];
  completed: DispatchTrip[];
  completedVolume: number;
  state: DriverState;
  currentOrder: DispatchStatusOrder | null;
  progress: DriverProgress | null;
  currentRoundText: string;
  remainingText: string;
  lastText: string;
  vehicleIds: string[];
};

export type DispatchTripIndexes = {
  byDriver: Map<string, DispatchTrip[]>;
  byVehicle: Map<string, DispatchTrip[]>;
  byOrder: Map<string, DispatchTrip[]>;
  byOrderVehicle: Map<string, DispatchTrip[]>;
};

export type CorrectionType = "start_cancel" | "loading_cancel" | "unloading_cancel";
export type CorrectionHistoryItem = {
  id: string;
  action: string;
  reason: string;
  before_status: string;
  after_status: string;
  corrected_by_email: string;
  corrected_at: string;
};

export type DispatchException = {
  key: string;
  entityKey: string;
  kind: string;
  subject: string;
  orderText: string;
  detail: string;
  tone: "neutral" | "delay" | "over";
  priority: number;
};

export type DailySummary = {
  id: string;
  title: string;
  secondary: string;
  completedCount: number;
  completedVolume: number;
  firstStartedAt: string | null;
  lastActivityAt: string | null;
  lastActivityLabel: ActivityKind | null;
};

export const correctionLabels: Record<CorrectionType, string> = {
  start_cancel: "운행시작 취소",
  loading_cancel: "상차완료 취소",
  unloading_cancel: "하차완료 취소",
};

export const correctionDescriptions: Record<CorrectionType, string> = {
  start_cancel: "운행기록은 남기고 취소 상태로 보관합니다. 기록 생성 시각은 이력으로 유지됩니다.",
  loading_cancel: "상차완료 시간과 상차 GPS를 정리하고 상차대기 상태로 되돌립니다.",
  unloading_cancel: "완료 실적에서 제외하고 하차완료 시간과 하차 GPS를 정리합니다. 실제 운송량은 재처리를 위해 보존합니다.",
};

export const normalizeDispatchCustomer = (row: Record<string, unknown>): DispatchCustomer => ({
  ...row,
  id: String(row.id),
  name: String(row.name || ""),
  active: row.active !== false,
  memo: String(row.memo || ""),
}) as DispatchCustomer;

export const normalizeDispatchItem = (row: Record<string, unknown>): DispatchItem => ({
  ...row,
  id: String(row.id),
  name: String(row.name || ""),
  active: row.active !== false,
  memo: String(row.memo || ""),
}) as DispatchItem;

export const normalizeDispatchLocation = (row: Record<string, unknown>): DispatchLocation => ({
  ...row,
  id: String(row.id),
  name: String(row.name || ""),
  location_type: String(row.location_type || "공용") as DispatchLocation["location_type"],
  active: row.active !== false,
  memo: String(row.memo || ""),
}) as DispatchLocation;

export const normalizeDispatchVehicle = (row: Record<string, unknown>): DispatchVehicle => ({
  ...row,
  id: String(row.id),
  vehicle_number: String(row.vehicle_number || ""),
  company_name: normalizeCompanyName(String(row.company_name || "")),
  active: row.active !== false,
  memo: String(row.memo || ""),
}) as DispatchVehicle;

export const normalizeDispatchDriver = (row: Record<string, unknown>): DispatchDriver => ({
  ...row,
  id: String(row.id),
  name: String(row.name || ""),
  phone: String(row.phone || ""),
  company_name: normalizeCompanyName(String(row.company_name || "")),
  assigned_vehicle_id: row.assigned_vehicle_id ? String(row.assigned_vehicle_id) : null,
  auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null,
  active: row.active !== false,
  memo: String(row.memo || ""),
}) as DispatchDriver;

export const normalizeDispatchTrip = (row: Record<string, unknown>): DispatchTrip => ({
  ...row,
  id: String(row.id),
  dispatch_order_id: String(row.dispatch_order_id),
  vehicle_id: String(row.vehicle_id),
  driver_id: String(row.driver_id),
  trip_no: Number(row.trip_no || 0),
  actual_volume: Number(row.actual_volume || 0),
  status: row.status as DispatchTrip["status"],
  loading_completed_at: row.loading_completed_at ? String(row.loading_completed_at) : null,
  unloading_completed_at: row.unloading_completed_at ? String(row.unloading_completed_at) : null,
  created_at: String(row.created_at || ""),
  updated_at: row.updated_at ? String(row.updated_at) : undefined,
}) as DispatchTrip;

export const normalizeDispatchOrder = (row: Record<string, unknown>): DispatchOrder => ({
  ...row,
  id: String(row.id),
  dispatch_date: String(row.dispatch_date || ""),
  vendor_id: row.vendor_id ? String(row.vendor_id) : null,
  vendor_name: String(row.vendor_name || ""),
  loading_location: String(row.loading_location || ""),
  unloading_location: String(row.unloading_location || ""),
  item_id: row.item_id ? String(row.item_id) : null,
  item_name: String(row.item_name || ""),
  total_volume: Number(row.total_volume || 0),
  volume_per_trip: Number(row.volume_per_trip || 0),
  estimated_trip_count: Number(row.estimated_trip_count || 0),
  status: row.status as DispatchOrder["status"],
  memo: String(row.memo || ""),
  created_at: row.created_at ? String(row.created_at) : undefined,
}) as DispatchOrder;

export const normalizeDispatchOrderVehicle = (row: Record<string, unknown>): DispatchOrderVehicle => ({
  ...row,
  id: String(row.id),
  order_id: String(row.order_id),
  vehicle_id: String(row.vehicle_id),
  driver_id: row.driver_id ? String(row.driver_id) : null,
}) as DispatchOrderVehicle;

export const normalizeDispatchTripLocation = (row: Record<string, unknown>): DispatchTripLocation => ({
  ...row,
  id: String(row.id),
  trip_id: String(row.trip_id),
  event_type: String(row.event_type) as DispatchTripLocation["event_type"],
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  accuracy_m: row.accuracy_m == null ? null : Number(row.accuracy_m),
  address: row.address ? String(row.address) : null,
  captured_at: String(row.captured_at || ""),
}) as DispatchTripLocation;

export const normalizeDispatchOrderWithVehicles = (
  row: Record<string, unknown>,
  assignments: DispatchOrderVehicle[],
): DispatchOrderWithVehicles & { deleted_at?: string | null } => ({
  ...row,
  ...normalizeDispatchOrder(row),
  assignments,
  vehicle_ids: assignments.map((assignment) => assignment.vehicle_id),
  deleted_at: row.deleted_at ? String(row.deleted_at) : null,
}) as DispatchOrderWithVehicles & { deleted_at?: string | null };

export const filterDispatchVehiclesForCompany = (vehicles: DispatchVehicle[], company: string, currentId: string) => {
  const normalizedCompany = normalizeCompanyName(company);
  return vehicles.filter((vehicle) => (vehicle.active || vehicle.id === currentId)
    && (!normalizedCompany || normalizeCompanyName(vehicle.company_name) === normalizedCompany));
};

export const filterDispatchDriversForCompany = (drivers: DispatchDriver[], company: string, currentId: string) => {
  const normalizedCompany = normalizeCompanyName(company);
  return drivers.filter((driver) => (driver.active || driver.id === currentId)
    && (!normalizedCompany || normalizeCompanyName(driver.company_name) === normalizedCompany));
};

const stateRank: Record<DriverState, number> = { "운행중": 0, "상차대기": 1, "대기": 2, "운행 완료": 3, "미사용": 4 };
const activityPriority: Record<ActivityKind, number> = { "하차완료": 3, "상차완료": 2, "운행시작": 1 };
const activeTripStatuses = new Set<DispatchTrip["status"]>(["상차대기", "진행중"]);

export const correctionTypeForTrip = (trip: DispatchTrip): CorrectionType | null => {
  if (trip.status === "완료" && trip.loading_completed_at && trip.unloading_completed_at) return "unloading_cancel";
  if (trip.status === "진행중" && trip.loading_completed_at && !trip.unloading_completed_at) return "loading_cancel";
  if (trip.status === "상차대기" && !trip.loading_completed_at && !trip.unloading_completed_at) return "start_cancel";
  return null;
};

export const correctionDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
  : "-";

export const timestampOf = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const formatDispatchKoreaTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
  : "-";

const activityForTrip = (trip: DispatchTrip) => {
  const at = trip.status === "완료"
    ? trip.unloading_completed_at || trip.loading_completed_at || trip.created_at
    : trip.status === "진행중"
      ? trip.loading_completed_at || trip.created_at
      : trip.created_at;
  const label: ActivityKind = trip.status === "완료" && trip.unloading_completed_at
    ? "하차완료"
    : (trip.status === "진행중" || (trip.status === "완료" && trip.loading_completed_at)) && trip.loading_completed_at
      ? "상차완료"
      : "운행시작";
  const timestamp = timestampOf(at);
  return timestamp ? { at, label, timestamp } : null;
};

const latestActivityForTrips = (sourceTrips: DispatchTrip[]) => [...sourceTrips]
  .map(activityForTrip)
  .filter((activity): activity is NonNullable<ReturnType<typeof activityForTrip>> => Boolean(activity))
  .sort((a, b) => b.timestamp - a.timestamp || activityPriority[b.label] - activityPriority[a.label])[0] || null;

const latestTrip = (sourceTrips: DispatchTrip[]) => [...sourceTrips]
  .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at) || b.trip_no - a.trip_no)[0] || null;

export const buildDriverStatusRows = (drivers: DispatchDriver[], orders: DispatchStatusOrder[], trips: DispatchTrip[]): DriverRow[] => drivers.map((driver) => {
  const mine = trips.filter((trip) => trip.driver_id === driver.id);
  const completed = mine.filter((trip) => trip.status === "완료");
  const completedVolume = completed.reduce((sum, trip) => sum + (Number.isFinite(trip.actual_volume) ? trip.actual_volume : 0), 0);
  const active = mine
    .filter((trip) => activeTripStatuses.has(trip.status))
    .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at) || b.trip_no - a.trip_no)[0] || null;
  const assigned = orders.filter((order) => order.assignments.some((assignment) => assignment.driver_id === driver.id)
    || Boolean(driver.assigned_vehicle_id && order.vehicle_ids.includes(driver.assigned_vehicle_id)));
  const vehicleIds = [...new Set([
    ...mine.map((trip) => trip.vehicle_id),
    ...assigned.flatMap((order) => order.assignments.filter((assignment) => assignment.driver_id === driver.id).map((assignment) => assignment.vehicle_id)),
    ...(driver.assigned_vehicle_id ? [driver.assigned_vehicle_id] : []),
  ])];
  const activeOrder = active ? orders.find((order) => order.id === active.dispatch_order_id) || null : null;
  const currentOrder = activeOrder
    || assigned.find((order) => order.status === "진행중")
    || assigned.find((order) => order.status === "대기")
    || null;
  const allDone = assigned.length > 0 && assigned.every((order) => order.status === "완료");
  const lastActivity = latestActivityForTrips(mine);

  let state: DriverState = "대기";
  if (!driver.active) state = "미사용";
  else if (active?.status === "진행중") state = "운행중";
  else if (active?.status === "상차대기") state = "상차대기";
  else if (allDone || (!currentOrder && completed.length > 0)) state = "운행 완료";

  const orderTrips = currentOrder
    ? trips.filter((trip) => trip.dispatch_order_id === currentOrder.id && trip.status !== "취소")
    : [];
  const completedOrderTrips = orderTrips.filter((trip) => trip.status === "완료");
  const orderCompletedVolume = completedOrderTrips.reduce((sum, trip) => sum + (Number.isFinite(trip.actual_volume) ? trip.actual_volume : 0), 0);
  const progress: DriverProgress | null = currentOrder ? {
    completedCount: completedOrderTrips.length,
    completedVolume: orderCompletedVolume,
    remainingTrips: currentOrder.estimated_trip_count > 0 ? Math.max(currentOrder.estimated_trip_count - completedOrderTrips.length, 0) : null,
    remainingVolume: currentOrder.total_volume > 0 ? Math.max(currentOrder.total_volume - orderCompletedVolume, 0) : null,
  } : null;
  const latestCompleted = latestTrip(completedOrderTrips);
  const currentRoundText = active
    ? `${active.trip_no}회차 진행 중`
    : currentOrder
      ? latestCompleted
        ? `${latestCompleted.trip_no}회차 완료 · 다음 회차 대기`
        : "운행 시작 전"
      : state === "운행 완료"
        ? `${completed.length}회 완료`
        : "-";
  const remainingText = progress
    ? `${progress.remainingTrips == null ? "-" : `${progress.remainingTrips}회`} · ${progress.remainingVolume == null ? "-" : formatVolume(progress.remainingVolume)}`
    : "-";
  const lastText = lastActivity ? `${formatDispatchKoreaTime(lastActivity.at)} ${lastActivity.label}` : "오늘 활동 없음";

  return { driver, mine, completed, completedVolume, state, currentOrder, progress, currentRoundText, remainingText, lastText, vehicleIds };
}).sort((a, b) => stateRank[a.state] - stateRank[b.state] || a.driver.name.localeCompare(b.driver.name, "ko-KR"));

export const indexDispatchTrips = (trips: DispatchTrip[]): DispatchTripIndexes => {
  const byDriver = new Map<string, DispatchTrip[]>();
  const byVehicle = new Map<string, DispatchTrip[]>();
  const byOrder = new Map<string, DispatchTrip[]>();
  const byOrderVehicle = new Map<string, DispatchTrip[]>();
  trips.forEach((trip) => {
    if (trip.status === "취소") return;
    const add = (map: Map<string, DispatchTrip[]>, key: string) => map.set(key, [...(map.get(key) || []), trip]);
    add(byDriver, trip.driver_id);
    add(byVehicle, trip.vehicle_id);
    add(byOrder, trip.dispatch_order_id);
    add(byOrderVehicle, trip.dispatch_order_id + ":" + trip.vehicle_id);
  });
  return { byDriver, byVehicle, byOrder, byOrderVehicle };
};

export const indexDispatchOrdersByVehicle = (orders: DispatchStatusOrder[]) => {
  const result = new Map<string, DispatchStatusOrder[]>();
  orders.forEach((order) => order.vehicle_ids.forEach((vehicleId) => result.set(vehicleId, [...(result.get(vehicleId) || []), order])));
  return result;
};

const formatElapsed = (minutes: number) => {
  if (minutes < 1) return "1분 미만";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? hours + "시간" + (rest ? " " + rest + "분" : "") : minutes + "분";
};

export const buildDispatchExceptions = (args: {
  drivers: DispatchDriver[];
  orders: DispatchStatusOrder[];
  trips: DispatchTrip[];
  now: number;
  tripIndexes: DispatchTripIndexes;
  vehicleById: Map<string, DispatchVehicle>;
}): DispatchException[] => {
  const { drivers, orders, trips, now, tripIndexes, vehicleById } = args;
  const result: DispatchException[] = [];
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const driverByVehicle = new Map(drivers.filter((driver) => driver.active && driver.assigned_vehicle_id).map((driver) => [driver.assigned_vehicle_id as string, driver]));
  const vehicleText = (vehicleId: string) => vehicleById.get(vehicleId)?.vehicle_number || "차량 확인 필요";
  const subjectText = (vehicleId: string, driverName?: string) => vehicleText(vehicleId) + " · " + (driverName || driverByVehicle.get(vehicleId)?.name || "기사 미지정");
  const push = (item: DispatchException) => result.push(item);

  orders.forEach((order) => {
    if (order.status === "완료" || order.status === "취소") return;
    order.vehicle_ids.forEach((vehicleId) => {
      const assignedTrips = tripIndexes.byOrderVehicle.get(order.id + ":" + vehicleId) || [];
      if (assignedTrips.length) return;
      push({
        key: "not-started:" + order.id + ":" + vehicleId,
        entityKey: "vehicle:" + vehicleId,
        kind: "미출발",
        subject: subjectText(vehicleId),
        orderText: order.vendor_name + " · " + order.item_name,
        detail: "오늘 배차에 아직 운행 기록이 없습니다.",
        tone: "neutral",
        priority: 1,
      });
    });
  });

  trips.forEach((trip) => {
    if (trip.status !== "진행중" || !trip.loading_completed_at || trip.unloading_completed_at) return;
    const elapsedMinutes = Math.max(0, Math.floor((now - timestampOf(trip.loading_completed_at)) / 60000));
    const order = orders.find((item) => item.id === trip.dispatch_order_id);
    push({
      key: "loading-elapsed:" + trip.id,
      entityKey: "vehicle:" + trip.vehicle_id,
      kind: "상차 후 경과",
      subject: subjectText(trip.vehicle_id, driverById.get(trip.driver_id)?.name),
      orderText: order ? order.vendor_name + " · " + order.item_name : "배차 정보 확인 필요",
      detail: "상차 " + formatElapsed(elapsedMinutes) + " · 하차완료 대기",
      tone: "delay",
      priority: 2,
    });
  });

  orders.forEach((order) => {
    const orderTrips = tripIndexes.byOrder.get(order.id) || [];
    const completedCount = orderTrips.filter((trip) => trip.status === "완료").length;
    const overflow = completedCount - order.estimated_trip_count;
    if (order.estimated_trip_count <= 0 || overflow <= 0) return;
    const vehicleIds = [...new Set(orderTrips.map((trip) => trip.vehicle_id).concat(order.vehicle_ids))];
    const names = [...new Set(orderTrips.map((trip) => driverById.get(trip.driver_id)?.name).filter((name): name is string => Boolean(name)))];
    const subject = vehicleIds.length === 1
      ? subjectText(vehicleIds[0], names.length === 1 ? names[0] : names.length > 1 ? names.length + "명 운행" : undefined)
      : "배차 전체 · " + vehicleIds.length + "대";
    push({
      key: "overrun:" + order.id,
      entityKey: vehicleIds.length === 1 ? "vehicle:" + vehicleIds[0] : "order:" + order.id,
      kind: "초과 운행",
      subject,
      orderText: order.vendor_name + " · " + order.item_name,
      detail: "예정 " + order.estimated_trip_count + "회 · 완료 " + completedCount + "회 · +" + overflow + "회",
      tone: "over",
      priority: 3,
    });
  });

  const visibleByEntity = new Map<string, number>();
  return result
    .sort((left, right) => right.priority - left.priority || left.subject.localeCompare(right.subject, "ko-KR"))
    .filter((item) => {
      const count = visibleByEntity.get(item.entityKey) || 0;
      if (count >= 2) return false;
      visibleByEntity.set(item.entityKey, count + 1);
      return true;
    })
    .slice(0, 10);
};

const latestValue = (values: Array<{ value: string; timestamp: number }>) => [...values]
  .sort((a, b) => b.timestamp - a.timestamp)[0]?.value || null;

export const buildDailySummary = (id: string, title: string, secondary: string, sourceTrips: DispatchTrip[]): DailySummary => {
  const completed = sourceTrips.filter((trip) => trip.status === "완료");
  const completedVolume = completed.reduce((sum, trip) => sum + (Number.isFinite(trip.actual_volume) ? trip.actual_volume : 0), 0);
  const firstStartedAt = [...sourceTrips]
    .filter((trip) => timestampOf(trip.created_at) > 0)
    .sort((a, b) => timestampOf(a.created_at) - timestampOf(b.created_at))[0]?.created_at || null;
  const unloadingValues = completed
    .filter((trip) => timestampOf(trip.unloading_completed_at) > 0)
    .map((trip) => ({ value: trip.unloading_completed_at as string, timestamp: timestampOf(trip.unloading_completed_at) }));
  const loadingValues = sourceTrips
    .filter((trip) => timestampOf(trip.loading_completed_at) > 0)
    .map((trip) => ({ value: trip.loading_completed_at as string, timestamp: timestampOf(trip.loading_completed_at) }));
  const createdValues = sourceTrips
    .filter((trip) => timestampOf(trip.created_at) > 0)
    .map((trip) => ({ value: trip.created_at, timestamp: timestampOf(trip.created_at) }));
  const lastActivityAt = latestValue(unloadingValues) || latestValue(loadingValues) || latestValue(createdValues);
  const lastActivityLabel: ActivityKind | null = unloadingValues.length
    ? "하차완료"
    : loadingValues.length
      ? "상차완료"
      : createdValues.length
        ? "운행시작"
        : null;
  return { id, title, secondary, completedCount: completed.length, completedVolume, firstStartedAt, lastActivityAt, lastActivityLabel };
};

export const buildDailyDriverSummaries = (args: {
  drivers: DispatchDriver[];
  orders: DispatchStatusOrder[];
  trips: DispatchTrip[];
  tripIndexes: DispatchTripIndexes;
  ordersByVehicle: Map<string, DispatchStatusOrder[]>;
  vehicleById: Map<string, DispatchVehicle>;
}): DailySummary[] => {
  const { drivers, orders, trips, tripIndexes, ordersByVehicle, vehicleById } = args;
  return drivers
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
    .sort((left, right) => right.completedVolume - left.completedVolume || right.completedCount - left.completedCount || left.title.localeCompare(right.title, "ko-KR"));
};

export const buildDailyVehicleSummaries = (args: {
  drivers: DispatchDriver[];
  vehicles: DispatchVehicle[];
  tripIndexes: DispatchTripIndexes;
  ordersByVehicle: Map<string, DispatchStatusOrder[]>;
}): DailySummary[] => {
  const { drivers, vehicles, tripIndexes, ordersByVehicle } = args;
  return vehicles
    .filter((vehicle) => vehicle.active && (tripIndexes.byVehicle.has(vehicle.id) || ordersByVehicle.has(vehicle.id)))
    .map((vehicle) => {
      const sourceTrips = tripIndexes.byVehicle.get(vehicle.id) || [];
      const names = [...new Set(sourceTrips.map((trip) => drivers.find((driver) => driver.id === trip.driver_id)?.name).filter((name): name is string => Boolean(name)))];
      if (!names.length) {
        const assignedDriver = drivers.find((driver) => driver.active && driver.assigned_vehicle_id === vehicle.id);
        if (assignedDriver) names.push(assignedDriver.name);
      }
      const secondary = names.length > 1 ? names.length + "명 운행" : names[0] || "기사 미지정";
      return buildDailySummary(vehicle.id, vehicle.vehicle_number, secondary, sourceTrips);
    })
    .sort((left, right) => right.completedVolume - left.completedVolume || right.completedCount - left.completedCount || left.title.localeCompare(right.title, "ko-KR"));
};

export const groupDriverTripsByOrder = (selectedTrips: DispatchTrip[], orderById: Map<string, DispatchStatusOrder>) => {
  const groupMap = new Map<string, DispatchTrip[]>();
  selectedTrips.forEach((trip) => {
    const list = groupMap.get(trip.dispatch_order_id) || [];
    list.push(trip);
    groupMap.set(trip.dispatch_order_id, list);
  });

  return [...groupMap.entries()].map(([orderId, groupTrips]) => ({
    orderId,
    order: orderById.get(orderId) || null,
    trips: [...groupTrips].sort((a, b) => a.trip_no - b.trip_no || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    firstAt: Math.min(...groupTrips.map((trip) => new Date(trip.created_at).getTime() || Number.MAX_SAFE_INTEGER)),
  })).sort((a, b) => a.firstAt - b.firstAt);
};

export const summarizeLiveDispatchStatus = (drivers: DispatchDriver[], rows: DriverRow[], trips: DispatchTrip[]) => ({
  total: drivers.filter((driver) => driver.active).length,
  running: rows.filter((row) => row.state === "운행중" || row.state === "상차대기").length,
  waiting: rows.filter((row) => row.state === "대기").length,
  trips: trips.filter((trip) => trip.status === "완료").length,
  volume: trips.filter((trip) => trip.status === "완료").reduce((sum, trip) => sum + (Number.isFinite(trip.actual_volume) ? trip.actual_volume : 0), 0),
});

export const summarizeDispatchOverview = (orders: DispatchOrderWithVehicles[], trips: DispatchTrip[], today: string) => {
  const yesterday = new Date(Date.parse(today + "T00:00:00+09:00") - 86400000);
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const dateKey = (date: Date) => {
    const parts = Object.fromEntries(dateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const yesterdayKey = dateKey(yesterday);
  let actualVolumeToday = 0;
  let actualVolumeYesterday = 0;
  for (const trip of trips) {
    if (trip.status !== "완료" || !trip.unloading_completed_at) continue;
    const completedAt = new Date(trip.unloading_completed_at);
    if (!Number.isFinite(completedAt.getTime()) || !Number.isFinite(trip.actual_volume)) continue;
    const completedDay = dateKey(completedAt);
    if (completedDay === today) actualVolumeToday += trip.actual_volume;
    else if (completedDay === yesterdayKey) actualVolumeYesterday += trip.actual_volume;
  }
  actualVolumeToday = Math.round(actualVolumeToday * 100) / 100;
  actualVolumeYesterday = Math.round(actualVolumeYesterday * 100) / 100;
  return {
    today: orders.filter((order) => order.dispatch_date === today).length,
    active: orders.filter((order) => order.status === "진행중").length,
    done: orders.filter((order) => order.status === "완료").length,
    actualVolumeToday,
    actualVolumeYesterday,
    actualVolumeDiff: Math.round((actualVolumeToday - actualVolumeYesterday) * 100) / 100,
  };
};
