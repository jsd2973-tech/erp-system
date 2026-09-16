from pathlib import Path


path = Path("src/features/dispatch/DriverStatusDashboard.tsx")
source = path.read_text()


if "currentRoundText" not in source:
    old_order_type = 'type TodayOrder = { id: string; vendor_name: string; item_name: string; loading_location: string; unloading_location: string; status: string; vehicle_ids: string[] };'
    new_order_type = 'type TodayOrder = { id: string; vendor_name: string; item_name: string; loading_location: string; unloading_location: string; status: string; total_volume: number; estimated_trip_count: number; vehicle_ids: string[] };'
    if old_order_type not in source:
        raise SystemExit("today order type anchor not found")
    source = source.replace(old_order_type, new_order_type, 1)

    old_order_query = 'supabase.from("dispatch_orders").select("id,vendor_name,item_name,loading_location,unloading_location,status").eq("dispatch_date", today).neq("status", "취소")'
    new_order_query = 'supabase.from("dispatch_orders").select("id,vendor_name,item_name,loading_location,unloading_location,status,total_volume,estimated_trip_count").eq("dispatch_date", today).neq("status", "취소")'
    if old_order_query not in source:
        raise SystemExit("today order query anchor not found")
    source = source.replace(old_order_query, new_order_query, 1)

    old_order_mapping = '''      unloading_location: String(row.unloading_location || ""),
      status: String(row.status || ""),
      vehicle_ids: assignments.filter((a) => String(a.order_id) === String(row.id)).map((a) => String(a.vehicle_id)),'''
    new_order_mapping = '''      unloading_location: String(row.unloading_location || ""),
      status: String(row.status || ""),
      total_volume: Number(row.total_volume || 0),
      estimated_trip_count: Number(row.estimated_trip_count || 0),
      vehicle_ids: assignments.filter((a) => String(a.order_id) === String(row.id)).map((a) => String(a.vehicle_id)),'''
    if old_order_mapping not in source:
        raise SystemExit("today order mapping anchor not found")
    source = source.replace(old_order_mapping, new_order_mapping, 1)

    old_row_type = '''type DriverRow = {
  driver: DispatchDriver;
  mine: DispatchTrip[];
  completed: DispatchTrip[];
  state: DriverState;
  currentOrder: TodayOrder | null;
  lastText: string;
};'''
    new_row_type = '''type DriverRow = {
  driver: DispatchDriver;
  mine: DispatchTrip[];
  completed: DispatchTrip[];
  completedVolume: number;
  state: DriverState;
  currentOrder: TodayOrder | null;
  progress: DriverProgress | null;
  currentRoundText: string;
  remainingText: string;
  lastText: string;
};'''
    if old_row_type not in source:
        raise SystemExit("driver row type anchor not found")
    source = source.replace(old_row_type, new_row_type, 1)

    state_anchor = 'const stateRank: Record<DriverState, number> = { "운행중": 0, "상차대기": 1, "대기": 2, "운행 완료": 3, "미사용": 4 };'
    helper_block = '''

type ActivityKind = "하차완료" | "상차완료" | "운행시작";
type DriverActivity = { at: string; label: ActivityKind; timestamp: number };
type DriverProgress = {
  completedCount: number;
  completedVolume: number;
  remainingTrips: number | null;
  remainingVolume: number | null;
};

const activityPriority: Record<ActivityKind, number> = { "하차완료": 3, "상차완료": 2, "운행시작": 1 };
const activeTripStatuses = new Set<DispatchTrip["status"]>(["상차대기", "진행중"]);

const timestampOf = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const activityForTrip = (trip: DispatchTrip): DriverActivity | null => {
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
  .filter((activity): activity is DriverActivity => Boolean(activity))
  .sort((a, b) => b.timestamp - a.timestamp || activityPriority[b.label] - activityPriority[a.label])[0] || null;

const latestTrip = (sourceTrips: DispatchTrip[]) => [...sourceTrips]
  .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at) || b.trip_no - a.trip_no)[0] || null;
'''
    if state_anchor not in source:
        raise SystemExit("state rank anchor not found")
    source = source.replace(state_anchor, state_anchor + helper_block, 1)

    rows_start = source.index("  const rows = useMemo<DriverRow[]>(() =>")
    rows_end = source.index("  useEffect(() => {\n    if (!rows.length)", rows_start)
    new_rows = '''  const rows = useMemo<DriverRow[]>(() => drivers.map((driver) => {
    const mine = trips.filter((trip) => trip.driver_id === driver.id);
    const completed = mine.filter((trip) => trip.status === "완료");
    const completedVolume = completed.reduce((sum, trip) => sum + (Number.isFinite(trip.actual_volume) ? trip.actual_volume : 0), 0);
    const active = mine
      .filter((trip) => activeTripStatuses.has(trip.status))
      .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at) || b.trip_no - a.trip_no)[0] || null;
    const assigned = driver.assigned_vehicle_id
      ? orders.filter((order) => order.vehicle_ids.includes(driver.assigned_vehicle_id!))
      : [];
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
    const lastText = lastActivity ? `${koreaTime(lastActivity.at)} ${lastActivity.label}` : "오늘 활동 없음";

    return { driver, mine, completed, completedVolume, state, currentOrder, progress, currentRoundText, remainingText, lastText };
  }).sort((a, b) => stateRank[a.state] - stateRank[b.state] || a.driver.name.localeCompare(b.driver.name, "ko-KR")), [drivers, orders, trips]);

'''
    source = source[:rows_start] + new_rows + source[rows_end:]

    render_start = source.index("            const vehicleNumber = row.driver.assigned_vehicle_id")
    render_end = source.index("            </button>;", render_start) + len("            </button>;")
    new_render = '''            const vehicleNumber = row.driver.assigned_vehicle_id
              ? vehicleById.get(row.driver.assigned_vehicle_id)?.vehicle_number || "차량 확인 필요"
              : "차량 미지정";
            const isSelected = selectedRow?.driver.id === row.driver.id;
            const dispatchText = row.currentOrder
              ? `${row.currentOrder.vendor_name} · ${row.currentOrder.item_name}`
              : row.state === "운행 완료"
                ? `오늘 ${row.completed.length}회 완료 · ${formatVolume(row.completedVolume)}`
                : "현재 배차 없음";
            return <button
              key={row.driver.id}
              type="button"
              className={`driver-master-item ${isSelected ? "selected" : ""}`}
              onClick={() => { setSelectedDriverId(row.driver.id); setDetailOpen(true); }}
            >
              <span className={`driver-master-state state-${row.state.replace(/\\s/g, "-")}`}><i /></span>
              <span className="driver-master-content">
                <span className="driver-master-name-line">
                  <strong>{row.driver.name}</strong>
                  <b className={`driver-master-status state-${row.state.replace(/\\s/g, "-")}`}>{row.state}</b>
                </span>
                <small className="driver-master-vehicle">{vehicleNumber}</small>
                <small className="driver-master-dispatch">{dispatchText}</small>
                <span className="driver-master-progress">
                  <b>{row.currentRoundText}</b>
                  <small>{row.progress ? `잔여 ${row.remainingText}` : row.state === "운행 완료" ? "오늘 운행 완료" : "-"}</small>
                </span>
                <small className="driver-master-activity">마지막 {row.lastText}</small>
              </span>
            </button>;'''
    source = source[:render_start] + new_render + source[render_end:]

if "driver-detail-current-meta" not in source:
    old_current = '''            {selectedRow.currentOrder && <em>{selectedRow.currentOrder.loading_location || "상차지 미지정"} <b>→</b> {selectedRow.currentOrder.unloading_location || "하차지 미지정"}</em>}
          </div>'''
    new_current = '''            {selectedRow.currentOrder && <em>{selectedRow.currentOrder.loading_location || "상차지 미지정"} <b>→</b> {selectedRow.currentOrder.unloading_location || "하차지 미지정"}</em>}
            {(selectedRow.currentOrder || selectedRow.state === "운행 완료") && <div className="driver-detail-current-meta">
              <strong>{selectedRow.currentRoundText}</strong>
              <span>{selectedRow.progress ? `잔여 ${selectedRow.remainingText}` : `${selectedRow.completed.length}회 완료 · ${formatVolume(selectedRow.completedVolume)}`}</span>
            </div>}
          </div>'''
    if old_current not in source:
        raise SystemExit("detail current anchor not found")
    source = source.replace(old_current, new_current, 1)

path.write_text(source)


css_path = Path("src/features/dispatch/driverStatusDashboard.css")
css = css_path.read_text()
css_marker = ".driver-master-content{"
if css_marker not in css:
    css += '''

/* Driver status summary stays scoped to the live dashboard list. */
.driver-status-dashboard .driver-master-item{grid-template-columns:12px minmax(0,1fr);align-items:start;gap:9px;padding:10px 12px}
.driver-status-dashboard .driver-master-content{display:grid;gap:3px;min-width:0}
.driver-status-dashboard .driver-master-name-line{display:flex;align-items:center;justify-content:space-between;gap:7px;min-width:0}
.driver-status-dashboard .driver-master-name-line>strong{overflow:hidden;color:#24394d;font-size:13px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}
.driver-status-dashboard .driver-master-status{flex:none;border-radius:999px;padding:3px 6px;font-size:10px;font-weight:850;line-height:1.2;white-space:nowrap}
.driver-status-dashboard .driver-master-vehicle{overflow:hidden;color:#7d8b9a;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.driver-status-dashboard .driver-master-dispatch{overflow:hidden;color:#38536d;font-size:11px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.driver-status-dashboard .driver-master-progress{display:flex;align-items:baseline;justify-content:space-between;gap:7px;min-width:0}
.driver-status-dashboard .driver-master-progress>b{overflow:hidden;color:#1d4d78;font-size:11px;font-weight:900;text-overflow:ellipsis;white-space:nowrap}
.driver-status-dashboard .driver-master-progress>small{flex:none;color:#687b8e;font-size:10px;font-weight:750;white-space:nowrap}
.driver-status-dashboard .driver-master-activity{overflow:hidden;color:#7b8997;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.driver-status-dashboard .driver-master-state.state-운행중,.driver-status-dashboard .driver-master-status.state-운행중{background:#e8f2ff;color:#155faa}
.driver-status-dashboard .driver-master-state.state-상차대기,.driver-status-dashboard .driver-master-status.state-상차대기{background:#fff2dc;color:#9b5d09}
.driver-status-dashboard .driver-master-state.state-대기,.driver-status-dashboard .driver-master-status.state-대기{background:#eef2f6;color:#59687a}
.driver-status-dashboard .driver-master-state.state-운행-완료,.driver-status-dashboard .driver-master-status.state-운행-완료{background:#e7f6ee;color:#17764c}
.driver-status-dashboard .driver-master-state.state-미사용,.driver-status-dashboard .driver-master-status.state-미사용{background:#f2f2f2;color:#787878}
.driver-status-dashboard .driver-detail-current-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px}
.driver-status-dashboard .driver-detail-current-meta strong{color:#1d5c8e;font-size:12px}
.driver-status-dashboard .driver-detail-current-meta span{color:#687c8f;font-size:11px;font-weight:750;white-space:nowrap}
@media(max-width:760px){
 .driver-status-dashboard .driver-master-list{max-height:360px}
 .driver-status-dashboard .driver-master-item{padding:9px 10px}
 .driver-status-dashboard .driver-master-name-line>strong{font-size:14px}
 .driver-status-dashboard .driver-master-dispatch{font-size:11px}
 .driver-status-dashboard .driver-master-progress>b{font-size:11px}
 .driver-status-dashboard .driver-master-activity{font-size:10px}
 .driver-status-dashboard .driver-detail-current-meta strong{font-size:12px}
}
'''
    css_path.write_text(css)
