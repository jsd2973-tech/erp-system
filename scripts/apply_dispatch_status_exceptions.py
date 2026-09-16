from pathlib import Path


dashboard_path = Path("src/features/dispatch/DriverStatusDashboard.tsx")
source = dashboard_path.read_text()

if "driver-exception-panel" not in source:
    if "currentRoundText" not in source:
        raise SystemExit("dispatch progress patch must run before the exception patch")

    state_anchor = '  const [selectedDriverId, setSelectedDriverId] = useState("");'
    state_replacement = '''  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [dailySummaryTab, setDailySummaryTab] = useState<"기사" | "차량">("기사");'''
    if state_anchor not in source:
        raise SystemExit("selected driver state anchor not found")
    source = source.replace(state_anchor, state_replacement, 1)

    helper_anchor = '''const latestTrip = (sourceTrips: DispatchTrip[]) => [...sourceTrips]
  .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at) || b.trip_no - a.trip_no)[0] || null;
'''
    helper_block = '''\n\ntype ExceptionTone = "neutral" | "delay" | "over";
type DispatchException = {
  key: string;
  entityKey: string;
  kind: string;
  subject: string;
  orderText: string;
  detail: string;
  tone: ExceptionTone;
  priority: number;
};
type DailySummary = {
  id: string;
  title: string;
  secondary: string;
  completedCount: number;
  completedVolume: number;
  firstStartedAt: string | null;
  lastActivityAt: string | null;
  lastActivityLabel: ActivityKind | null;
};

const formatElapsed = (minutes: number) => {
  if (minutes < 1) return "1분 미만";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? hours + "시간" + (rest ? " " + rest + "분" : "") : minutes + "분";
};

const latestValue = (values: Array<{ value: string; timestamp: number }>) => [...values]
  .sort((a, b) => b.timestamp - a.timestamp)[0]?.value || null;

const buildDailySummary = (id: string, title: string, secondary: string, sourceTrips: DispatchTrip[]): DailySummary => {
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
'''
    if helper_anchor not in source:
        raise SystemExit("latest trip helper anchor not found")
    source = source.replace(helper_anchor, helper_anchor + helper_block, 1)

    selected_anchor = '  const selectedRow = rows.find((row) => row.driver.id === selectedDriverId) || rows[0] || null;\n\n'
    derived_block = '''  const selectedRow = rows.find((row) => row.driver.id === selectedDriverId) || rows[0] || null;

  const tripIndexes = useMemo(() => {
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
  }, [trips]);

  const ordersByVehicle = useMemo(() => {
    const result = new Map<string, TodayOrder[]>();
    orders.forEach((order) => order.vehicle_ids.forEach((vehicleId) => result.set(vehicleId, [...(result.get(vehicleId) || []), order])));
    return result;
  }, [orders]);

  const exceptionItems = useMemo<DispatchException[]>(() => {
    const result: DispatchException[] = [];
    const now = updatedAt?.getTime() || 0;
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
  }, [drivers, orders, trips, updatedAt, tripIndexes, vehicleById]);

  const dailyDriverSummaries = useMemo<DailySummary[]>(() => drivers
    .filter((driver) => driver.active && (tripIndexes.byDriver.has(driver.id) || Boolean(driver.assigned_vehicle_id && ordersByVehicle.has(driver.assigned_vehicle_id))))
    .map((driver) => buildDailySummary(
      driver.id,
      driver.name,
      driver.assigned_vehicle_id ? vehicleById.get(driver.assigned_vehicle_id)?.vehicle_number || "차량 확인 필요" : "차량 미지정",
      tripIndexes.byDriver.get(driver.id) || [],
    ))
    .sort((left, right) => right.completedVolume - left.completedVolume || right.completedCount - left.completedCount || left.title.localeCompare(right.title, "ko-KR")), [drivers, ordersByVehicle, tripIndexes, vehicleById]);

  const dailyVehicleSummaries = useMemo<DailySummary[]>(() => vehicles
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
    .sort((left, right) => right.completedVolume - left.completedVolume || right.completedCount - left.completedCount || left.title.localeCompare(right.title, "ko-KR")), [drivers, ordersByVehicle, tripIndexes, vehicles]);

  const dailySummaries = dailySummaryTab === "기사" ? dailyDriverSummaries : dailyVehicleSummaries;

'''
    if selected_anchor not in source:
        raise SystemExit("selected row anchor not found")
    source = source.replace(selected_anchor, derived_block, 1)

    workspace_anchor = '    <div className="driver-status-workspace">'
    workspace_replacement = '''    <section className="driver-exception-panel" aria-label="예외 운행 확인">
      <div className="driver-exception-head">
        <div><span>EXCEPTION CHECK</span><h3>예외 운행 확인</h3><p>미출발·상차 후 경과·예정 회차 초과를 빠르게 확인합니다.</p></div>
        <strong className={exceptionItems.length ? "has-exception" : "normal"}>{exceptionItems.length ? exceptionItems.length + "건 확인" : "정상"}</strong>
      </div>
      {!exceptionItems.length ? <div className="driver-exception-empty">현재 확인된 예외 운행이 없습니다.</div> : <div className="driver-exception-list">
        {exceptionItems.map((item) => <article key={item.key} className={"driver-exception-item tone-" + item.tone}>
          <div className="driver-exception-item-head"><span>{item.kind}</span><strong>{item.subject}</strong></div>
          <b>{item.orderText}</b><small>{item.detail}</small>
        </article>)}
      </div>}
      <small className="driver-exception-note">상차 후 경과는 운영 기준이 없는 상태에서 자동 지연 판정 없이 경과시간만 표시합니다.</small>
    </section>

    <section className="driver-daily-summary" aria-label="오늘 기사 차량 요약">
      <div className="driver-daily-head">
        <div><span>DAILY SUMMARY</span><h3>오늘 운행 요약</h3><p>완료 trip의 회차·actual_volume과 오늘 운행 시간 기준입니다.</p></div>
        <div className="driver-daily-tabs" role="tablist" aria-label="오늘 요약 기준">
          {(["기사", "차량"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={dailySummaryTab === tab} className={dailySummaryTab === tab ? "active" : ""} onClick={() => setDailySummaryTab(tab)}>{tab}</button>)}
        </div>
      </div>
      {!dailySummaries.length ? <div className="driver-daily-empty">오늘 운행 기록이 없습니다.</div> : <div className="driver-daily-list">
        {dailySummaries.map((summaryItem) => <article key={summaryItem.id} className="driver-daily-card">
          <div className="driver-daily-card-head"><div><strong>{summaryItem.title}</strong><small>{summaryItem.secondary}</small></div><b>{summaryItem.completedCount}회 완료</b></div>
          <div className="driver-daily-volume">{formatVolume(summaryItem.completedVolume)}</div>
          <div className="driver-daily-times"><span>첫 운행 <b>{koreaTime(summaryItem.firstStartedAt)}</b></span><span>마지막 {summaryItem.lastActivityLabel || "활동"} <b>{koreaTime(summaryItem.lastActivityAt)}</b></span></div>
        </article>)}
      </div>}
    </section>

    <div className="driver-status-workspace">'''
    if workspace_anchor not in source:
        raise SystemExit("workspace anchor not found")
    source = source.replace(workspace_anchor, workspace_replacement, 1)

    dashboard_path.write_text(source)


css_path = Path("src/features/dispatch/driverStatusDashboard.css")
css = css_path.read_text()
if ".driver-exception-panel" not in css:
    css += '''

/* Daily driver/vehicle checks stay scoped to the dispatch status dashboard. */
.driver-status-dashboard .driver-exception-panel,.driver-status-dashboard .driver-daily-summary{margin:12px 0;border:1px solid #dfe7ef;border-radius:12px;background:#fff;box-shadow:0 3px 10px rgba(28,55,90,.03)}
.driver-status-dashboard .driver-exception-head,.driver-status-dashboard .driver-daily-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #e8eef4;background:#f8fafc}
.driver-status-dashboard .driver-exception-head>div,.driver-status-dashboard .driver-daily-head>div:first-child{display:grid;gap:2px;min-width:0}
.driver-status-dashboard .driver-exception-head span,.driver-status-dashboard .driver-daily-head span{color:#7187a0;font-size:9px;font-weight:950;letter-spacing:.08em}
.driver-status-dashboard .driver-exception-head h3,.driver-status-dashboard .driver-daily-head h3{margin:0;color:#263b52;font-size:15px;font-weight:900}
.driver-status-dashboard .driver-exception-head p,.driver-status-dashboard .driver-daily-head p{margin:0;color:#8491a0;font-size:10px;line-height:1.35}
.driver-status-dashboard .driver-exception-head>strong{flex:none;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900}
.driver-status-dashboard .driver-exception-head>strong.normal{background:#e8f6ee;color:#17764c}.driver-status-dashboard .driver-exception-head>strong.has-exception{background:#fff1df;color:#a3600b}
.driver-status-dashboard .driver-exception-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px}
.driver-status-dashboard .driver-exception-item{display:grid;gap:4px;min-width:0;padding:9px 10px;border:1px solid #e5eaf0;border-left:3px solid #aeb9c6;border-radius:9px;background:#fff}
.driver-status-dashboard .driver-exception-item.tone-delay{border-left-color:#dfa03a;background:#fffaf2}.driver-status-dashboard .driver-exception-item.tone-over{border-left-color:#8b68bd;background:#faf8ff}
.driver-status-dashboard .driver-exception-item-head{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}.driver-status-dashboard .driver-exception-item-head>span{flex:none;border-radius:999px;padding:3px 6px;background:#eef2f6;color:#5e7083;font-size:9px;font-weight:900}.driver-status-dashboard .driver-exception-item.tone-delay .driver-exception-item-head>span{background:#fff0d3;color:#9b5d09}.driver-status-dashboard .driver-exception-item.tone-over .driver-exception-item-head>span{background:#eee8fa;color:#6e4d9b}
.driver-status-dashboard .driver-exception-item-head>strong{overflow:hidden;color:#263d55;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.driver-status-dashboard .driver-exception-item>b{overflow:hidden;color:#3c536a;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.driver-status-dashboard .driver-exception-item>small{color:#778797;font-size:10px;line-height:1.35}
.driver-status-dashboard .driver-exception-empty,.driver-status-dashboard .driver-daily-empty{padding:17px 14px;color:#7d8b99;text-align:center;font-size:11px}.driver-status-dashboard .driver-exception-note{display:block;padding:0 12px 10px;color:#98a3ae;font-size:9px;line-height:1.35}
.driver-status-dashboard .driver-daily-head{align-items:flex-end}.driver-status-dashboard .driver-daily-tabs{display:flex;flex:none;gap:4px}.driver-status-dashboard .driver-daily-tabs button{border:1px solid #dbe4ed;border-radius:7px;padding:6px 10px;background:#fff;color:#718093;font-size:11px;font-weight:850;cursor:pointer}.driver-status-dashboard .driver-daily-tabs button.active{border-color:#a9c8e4;background:#eaf3fc;color:#1d5d91}
.driver-status-dashboard .driver-daily-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px}.driver-status-dashboard .driver-daily-card{display:grid;gap:7px;min-width:0;padding:10px;border:1px solid #e3eaf1;border-radius:9px;background:#fff}.driver-status-dashboard .driver-daily-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-width:0}.driver-status-dashboard .driver-daily-card-head>div{display:grid;gap:2px;min-width:0}.driver-status-dashboard .driver-daily-card-head strong{overflow:hidden;color:#263d55;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.driver-status-dashboard .driver-daily-card-head small{overflow:hidden;color:#7b8a99;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.driver-status-dashboard .driver-daily-card-head>b{flex:none;color:#5d7891;font-size:10px;white-space:nowrap}.driver-status-dashboard .driver-daily-volume{color:#1c5683;font-size:19px;font-weight:950;letter-spacing:-.03em}.driver-status-dashboard .driver-daily-times{display:flex;flex-wrap:wrap;gap:5px 10px;color:#8996a3;font-size:10px}.driver-status-dashboard .driver-daily-times b{margin-left:2px;color:#526a80;font-weight:850}
@media(max-width:1050px){.driver-status-dashboard .driver-exception-list,.driver-status-dashboard .driver-daily-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.driver-status-dashboard .driver-exception-head,.driver-status-dashboard .driver-daily-head{align-items:flex-start;padding:10px 11px}.driver-status-dashboard .driver-exception-head h3,.driver-status-dashboard .driver-daily-head h3{font-size:14px}.driver-status-dashboard .driver-exception-head p,.driver-status-dashboard .driver-daily-head p{font-size:9px}.driver-status-dashboard .driver-exception-list,.driver-status-dashboard .driver-daily-list{grid-template-columns:1fr;padding:8px}.driver-status-dashboard .driver-exception-item{padding:8px 9px}.driver-status-dashboard .driver-daily-card{padding:9px}.driver-status-dashboard .driver-daily-volume{font-size:18px}.driver-status-dashboard .driver-daily-times{justify-content:space-between;font-size:10px}.driver-status-dashboard .driver-daily-tabs button{min-height:36px;padding:5px 9px}}
@media(max-width:430px){.driver-status-dashboard .driver-exception-head,.driver-status-dashboard .driver-daily-head{display:grid;gap:8px}.driver-status-dashboard .driver-exception-head>strong{justify-self:start}.driver-status-dashboard .driver-daily-head{align-items:start}.driver-status-dashboard .driver-daily-tabs{justify-self:start}}
'''
    css_path.write_text(css)


package_path = Path("package.json")
package_source = package_path.read_text()
patch_command = "python3 scripts/apply_dispatch_status_exceptions.py"
if patch_command not in package_source:
    old = 'python3 scripts/apply_erp_list_design.py"'
    new = 'python3 scripts/apply_erp_list_design.py && python3 scripts/apply_dispatch_status_exceptions.py"'
    if old not in package_source:
        raise SystemExit("prebuild tail anchor not found")
    package_path.write_text(package_source.replace(old, new, 1))
