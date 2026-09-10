from pathlib import Path
import re

page = Path('src/features/dispatch/DispatchPage.tsx')
text = page.read_text(encoding='utf-8')

pattern = re.compile(r'''  const loadDispatchData = useCallback\(async \(\) => \{.*?\n  \}, \[supabase\]\);\n\n  useEffect\(\(\) => \{ void loadDispatchData\(\); \}, \[loadDispatchData\]\);''', re.S)
replacement = '''  const canReadOrders = isAdmin || allowedViews.some((item) => ["dispatch_register", "dispatch_list", "dispatch_status"].includes(item));
  const canReadTrips = canReadOrders;
  const canReadVehicles = isAdmin || allowedViews.some((item) => ["dispatch_register", "dispatch_list", "dispatch_status", "dispatch_vehicles", "dispatch_drivers"].includes(item));
  const canReadDrivers = isAdmin || allowedViews.some((item) => ["dispatch_register", "dispatch_list", "dispatch_status", "dispatch_drivers"].includes(item));
  const canReadMasters = isAdmin || allowedViews.some((item) => ["dispatch_register", "dispatch_basics"].includes(item));

  const loadDispatchData = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) setInitialLoading(true);
    else setRefreshing(true);
    setError("");

    const skipped = Promise.resolve({ data: null, error: null });
    const [vehicleResult, driverResult, orderResult, assignmentResult, customerResult, locationResult, itemResult, tripResult] = await Promise.all([
      canReadVehicles ? supabase.from("dispatch_vehicles").select("*").order("vehicle_number", { ascending: true }) : skipped,
      canReadDrivers ? supabase.from("dispatch_drivers").select("*").order("name", { ascending: true }) : skipped,
      canReadOrders ? supabase.from("dispatch_orders").select("*").order("dispatch_date", { ascending: false }).order("created_at", { ascending: false }) : skipped,
      canReadOrders ? supabase.from("dispatch_order_vehicles").select("*").order("created_at", { ascending: true }) : skipped,
      canReadMasters ? supabase.from("dispatch_customers").select("*").order("name", { ascending: true }) : skipped,
      canReadMasters ? supabase.from("dispatch_locations").select("*").order("name", { ascending: true }) : skipped,
      canReadMasters ? supabase.from("dispatch_items").select("*").order("name", { ascending: true }) : skipped,
      canReadTrips ? supabase.from("dispatch_trips").select("*").order("created_at", { ascending: false }) : skipped,
    ]);

    const requestedErrors = [
      canReadVehicles ? vehicleResult.error : null,
      canReadDrivers ? driverResult.error : null,
      canReadOrders ? orderResult.error : null,
      canReadOrders ? assignmentResult.error : null,
      canReadMasters ? customerResult.error : null,
      canReadMasters ? locationResult.error : null,
      canReadMasters ? itemResult.error : null,
      canReadTrips ? tripResult.error : null,
    ].filter(Boolean);
    if (requestedErrors.length) {
      setError(`허용된 운행관리 자료 중 일부를 불러오지 못했습니다. 기존 화면 자료와 입력값은 유지됩니다. (${requestedErrors[0]?.message || "조회 오류"})`);
    }

    if (canReadVehicles && !vehicleResult.error && vehicleResult.data) {
      setVehicles(vehicleResult.data.map((row) => ({ ...row, id: String(row.id), vehicle_number: String(row.vehicle_number || ""), active: row.active !== false, memo: String(row.memo || "") })) as DispatchVehicle[]);
    }

    if (canReadDrivers && !driverResult.error && driverResult.data) {
      setDrivers(driverResult.data.map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), phone: String(row.phone || ""), assigned_vehicle_id: row.assigned_vehicle_id ? String(row.assigned_vehicle_id) : null, auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null, active: row.active !== false, memo: String(row.memo || "") })) as DispatchDriver[]);
    }

    if (canReadMasters) {
      if (!customerResult.error && customerResult.data) setCustomers(customerResult.data.map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), active: row.active !== false, memo: String(row.memo || "") })) as DispatchCustomer[]);
      if (!locationResult.error && locationResult.data) setLocations(locationResult.data.map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), location_type: String(row.location_type || "공용") as DispatchLocationType, active: row.active !== false, memo: String(row.memo || "") })) as DispatchLocation[]);
      if (!itemResult.error && itemResult.data) setItems(itemResult.data.map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), active: row.active !== false, memo: String(row.memo || "") })) as DispatchItem[]);
    }

    if (canReadOrders && !orderResult.error && !assignmentResult.error && orderResult.data && assignmentResult.data) {
      const assignments = assignmentResult.data.map((row) => ({ ...row, id: String(row.id), order_id: String(row.order_id), vehicle_id: String(row.vehicle_id) })) as DispatchOrderVehicle[];
      const assignmentMap = new Map<string, string[]>();
      assignments.forEach((assignment) => assignmentMap.set(assignment.order_id, [...(assignmentMap.get(assignment.order_id) || []), assignment.vehicle_id]));
      const normalizedOrders = orderResult.data.map((row) => ({
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
        status: row.status,
        memo: String(row.memo || ""),
        vehicle_ids: assignmentMap.get(String(row.id)) || [],
        deleted_at: row.deleted_at ? String(row.deleted_at) : null,
      })) as (DispatchOrderWithVehicles & { deleted_at?: string | null })[];
      setOrders(normalizedOrders.filter((order) => !order.deleted_at));
      if (isAdmin) setDeletedOrders(normalizedOrders.filter((order) => Boolean(order.deleted_at)));
    }

    if (canReadTrips && !tripResult.error && tripResult.data) {
      setTrips(tripResult.data.map((row) => ({
        ...row,
        id: String(row.id),
        dispatch_order_id: String(row.dispatch_order_id),
        vehicle_id: String(row.vehicle_id),
        driver_id: String(row.driver_id),
        trip_no: Number(row.trip_no || 0),
        actual_volume: Number(row.actual_volume || 0),
        status: row.status,
        loading_completed_at: row.loading_completed_at ? String(row.loading_completed_at) : null,
        unloading_completed_at: row.unloading_completed_at ? String(row.unloading_completed_at) : null,
        created_at: String(row.created_at || ""),
      })) as DispatchTrip[]);
    }

    hasLoadedRef.current = true;
    setInitialLoading(false);
    setRefreshing(false);
  }, [supabase, isAdmin, canReadVehicles, canReadDrivers, canReadOrders, canReadMasters, canReadTrips]);

  useEffect(() => { void loadDispatchData(); }, [loadDispatchData]);'''

text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'loadDispatchData replacement count={count}')

# KPI values must not render as real zeroes when the account cannot read the source data.
text = text.replace('''<div className="dispatch-kpi-value"><strong>{summary.today.toLocaleString("ko-KR")}</strong><small>건</small></div>\n              <span className="dispatch-kpi-caption">오늘 배차일 기준</span>''', '''<div className="dispatch-kpi-value"><strong>{canReadOrders ? summary.today.toLocaleString("ko-KR") : "—"}</strong>{canReadOrders && <small>건</small>}</div>\n              <span className="dispatch-kpi-caption">{canReadOrders ? "오늘 배차일 기준" : "조회 권한 없음"}</span>''')
text = text.replace('''<div className="dispatch-kpi-value"><strong>{summary.active.toLocaleString("ko-KR")}</strong><small>건</small></div>\n              <span className="dispatch-kpi-caption">전체 배차 기준</span>''', '''<div className="dispatch-kpi-value"><strong>{canReadOrders ? summary.active.toLocaleString("ko-KR") : "—"}</strong>{canReadOrders && <small>건</small>}</div>\n              <span className="dispatch-kpi-caption">{canReadOrders ? "전체 배차 기준" : "조회 권한 없음"}</span>''', 1)
text = text.replace('''<div className="dispatch-kpi-value"><strong>{summary.done.toLocaleString("ko-KR")}</strong><small>건</small></div>\n              <span className="dispatch-kpi-caption">전체 배차 기준</span>''', '''<div className="dispatch-kpi-value"><strong>{canReadOrders ? summary.done.toLocaleString("ko-KR") : "—"}</strong>{canReadOrders && <small>건</small>}</div>\n              <span className="dispatch-kpi-caption">{canReadOrders ? "전체 배차 기준" : "조회 권한 없음"}</span>''', 1)
old_volume = '''<div className="dispatch-kpi-value"><strong>{summary.actualVolumeToday.toLocaleString("ko-KR")}</strong><small>루베</small></div>\n              <div className={`dispatch-kpi-delta ${summary.actualVolumeDiff > 0 ? "up" : summary.actualVolumeDiff < 0 ? "down" : "same"}`} title={`전일 실제 운송량 ${summary.actualVolumeYesterday.toLocaleString("ko-KR")}루베 · 한국시간 하차 완료일 기준`}>\n                {summary.actualVolumeDiff > 0 ? <ArrowUp aria-hidden="true" /> : summary.actualVolumeDiff < 0 ? <ArrowDown aria-hidden="true" /> : null}\n                <span>전일 대비 {summary.actualVolumeDiff > 0 ? "+" : ""}{summary.actualVolumeDiff.toLocaleString("ko-KR")}루베</span>\n              </div>'''
new_volume = '''<div className="dispatch-kpi-value"><strong>{canReadTrips ? summary.actualVolumeToday.toLocaleString("ko-KR") : "—"}</strong>{canReadTrips && <small>루베</small>}</div>\n              {canReadTrips ? (\n                <div className={`dispatch-kpi-delta ${summary.actualVolumeDiff > 0 ? "up" : summary.actualVolumeDiff < 0 ? "down" : "same"}`} title={`전일 실제 운송량 ${summary.actualVolumeYesterday.toLocaleString("ko-KR")}루베 · 한국시간 하차 완료일 기준`}>\n                  {summary.actualVolumeDiff > 0 ? <ArrowUp aria-hidden="true" /> : summary.actualVolumeDiff < 0 ? <ArrowDown aria-hidden="true" /> : null}\n                  <span>전일 대비 {summary.actualVolumeDiff > 0 ? "+" : ""}{summary.actualVolumeDiff.toLocaleString("ko-KR")}루베</span>\n                </div>\n              ) : <span className="dispatch-kpi-caption">조회 권한 없음</span>}'''
if old_volume not in text:
    raise SystemExit('volume KPI target not found')
text = text.replace(old_volume, new_volume, 1)

page.write_text(text, encoding='utf-8')

sql_path = Path('supabase/dispatch_office_editor_rls_review.sql')
sql = sql_path.read_text(encoding='utf-8')

for table in ('customers', 'locations', 'items'):
    old = f'''create policy dispatch_{table}_staff_insert\non public.dispatch_{table} for insert to authenticated\nwith check (public.has_dispatch_permission('dispatch_basics'));'''
    new = f'''create policy dispatch_{table}_staff_insert\non public.dispatch_{table} for insert to authenticated\nwith check (\n  public.has_dispatch_permission('dispatch_register')\n  or public.has_dispatch_permission('dispatch_basics')\n);'''
    if old not in sql:
        raise SystemExit(f'{table} insert policy target not found')
    sql = sql.replace(old, new, 1)

sql = sql.replace('-- 배차 기초관리', '-- 배차등록 중 신규 마스터 INSERT 또는 배차 기초관리\n-- 기존 마스터 UPDATE는 아래처럼 dispatch_basics만 허용\n-- 배차 기초관리', 1)
sql_path.write_text(sql, encoding='utf-8')
