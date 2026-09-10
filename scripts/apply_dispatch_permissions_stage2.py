from pathlib import Path
import re

# ---- App.tsx: granular dispatch permissions ----
app_path = Path('src/App.tsx')
s = app_path.read_text(encoding='utf-8')

permission_anchor = '  { key: "bid_notices", label: "입찰공고" },\n'
dispatch_permissions = '''  { key: "dispatch_register", label: "운행관리 · 배차등록" },
  { key: "dispatch_list", label: "운행관리 · 배차목록" },
  { key: "dispatch_status", label: "운행관리 · 운행현황" },
  { key: "dispatch_vehicles", label: "운행관리 · 차량관리" },
  { key: "dispatch_drivers", label: "운행관리 · 기사관리" },
  { key: "dispatch_basics", label: "운행관리 · 배차 기초관리" },
'''
if 'key: "dispatch_register", label: "운행관리 · 배차등록"' not in s:
    if permission_anchor not in s:
        raise SystemExit('permission module anchor not found')
    s = s.replace(permission_anchor, permission_anchor + dispatch_permissions, 1)

old_access = '''    if (tab === "activity_logs") return isAdmin;
    if (tab === "trash_bin") return isAdmin;
    if (isAdmin) return true;
    if (currentRole === "office") return !ERP_OFFICE_BLOCKED_TABS.has(tab);
    const permissions = currentUserPermission?.permissions || {};
    return !!permissions[tab];'''
new_access = '''    if (tab === "activity_logs") return isAdmin;
    if (tab === "trash_bin") return isAdmin;
    const permissions = currentUserPermission?.permissions || {};
    if (DISPATCH_VIEWS.includes(tab as DispatchView)) return isAdmin || !!permissions[tab];
    if (isAdmin) return true;
    if (currentRole === "office") return !ERP_OFFICE_BLOCKED_TABS.has(tab);
    return !!permissions[tab];'''
if old_access in s:
    s = s.replace(old_access, new_access, 1)
elif 'DISPATCH_VIEWS.includes(tab as DispatchView)' not in s:
    raise SystemExit('canAccessTab block not found')

old_desktop_gate = '''          {isAdmin && (
            <div className={`menu-group ${openMenuGroup === "dispatch" ? "expanded" : ""}`}>'''
new_desktop_gate = '''          {canShowAny(DISPATCH_VIEWS) && (
            <div className={`menu-group ${openMenuGroup === "dispatch" ? "expanded" : ""}`}>'''
if old_desktop_gate in s:
    s = s.replace(old_desktop_gate, new_desktop_gate, 1)
elif 'canShowAny(DISPATCH_VIEWS)' not in s:
    raise SystemExit('desktop dispatch gate not found')

for tab, label in [
    ('dispatch_register', '배차등록'),
    ('dispatch_list', '배차목록'),
    ('dispatch_status', '운행현황'),
    ('dispatch_vehicles', '차량관리'),
    ('dispatch_drivers', '기사관리'),
    ('dispatch_basics', '배차 기초관리'),
]:
    old = f'{{isAdmin && <button onClick={{() => {{ setMenuTab("{tab}"); setMobileSheet(""); }}}}>{label}</button>}}'
    new = f'{{canAccessTab("{tab}") && <button onClick={{() => {{ setMenuTab("{tab}"); setMobileSheet(""); }}}}>{label}</button>}}'
    if old in s:
        s = s.replace(old, new, 1)
    elif new not in s:
        raise SystemExit(f'mobile dispatch gate not found: {tab}')

# Add allowedViews to DispatchPage without changing admin semantics.
pattern = re.compile(r'(<DispatchPage\b[^>]*?\bisAdmin=\{isAdmin\})([^>]*?/>)', re.S)
if 'allowedViews={DISPATCH_VIEWS.filter((dispatchView) => canAccessTab(dispatchView))}' not in s:
    s, count = pattern.subn(r'\1 allowedViews={DISPATCH_VIEWS.filter((dispatchView) => canAccessTab(dispatchView))}\2', s, count=1)
    if count != 1:
        raise SystemExit('DispatchPage render not found')

app_path.write_text(s, encoding='utf-8')

# ---- DispatchPage.tsx: only expose permitted views, keep destructive actions admin-only ----
page_path = Path('src/features/dispatch/DispatchPage.tsx')
p = page_path.read_text(encoding='utf-8')

p = p.replace('''  isAdmin: boolean;\n  onNavigate: (view: DispatchView) => void;''', '''  isAdmin: boolean;\n  allowedViews: DispatchView[];\n  onNavigate: (view: DispatchView) => void;''', 1)
p = p.replace('''export default function DispatchPage({ view, supabase, isAdmin, onNavigate, onNotify }: DispatchPageProps) {''', '''export default function DispatchPage({ view, supabase, isAdmin, allowedViews, onNavigate, onNotify }: DispatchPageProps) {''', 1)
p = p.replace('''  if (!isAdmin) return <section className="dispatch-panel"><p className="dispatch-error">배차관리는 관리자만 사용할 수 있습니다.</p></section>;''', '''  if (!allowedViews.includes(view)) return <section className="dispatch-panel"><p className="dispatch-error">이 운행관리 메뉴의 사용 권한이 없습니다.</p></section>;''', 1)
p = p.replace('''<nav className="dispatch-tabs">{(Object.keys(viewLabels) as DispatchView[]).map((key) => <button type="button" key={key}''', '''<nav className="dispatch-tabs">{(Object.keys(viewLabels) as DispatchView[]).filter((key) => allowedViews.includes(key)).map((key) => <button type="button" key={key}''', 1)

# Destructive dispatch-list actions remain admin-only. Editing requires dispatch_register permission.
p = p.replace('''{view === "dispatch_list" && <DispatchList orders={orders} deletedOrders={deletedOrders} vehicles={vehicles} drivers={drivers} trips={trips} onEdit={editOrder} onDelete={deleteOrder} onRestore={restoreOrder} onPermanentDelete={permanentlyDeleteOrder} deletingOrderId={deletingOrderId} />}''', '''{view === "dispatch_list" && <DispatchList orders={orders} deletedOrders={isAdmin ? deletedOrders : []} vehicles={vehicles} drivers={drivers} trips={trips} onEdit={editOrder} canEdit={allowedViews.includes("dispatch_register")} onDelete={isAdmin ? deleteOrder : undefined} onRestore={isAdmin ? restoreOrder : undefined} onPermanentDelete={isAdmin ? permanentlyDeleteOrder : undefined} deletingOrderId={deletingOrderId} />}''', 1)
p = p.replace('''{view === "dispatch_register" && <><DispatchRegister customers={customers} locations={locations} items={items} vehicles={vehicles} editingOrder={editingOrder} saving={saving} onSave={saveOrder} onCancelEdit={() => setEditingOrder(null)} /><DispatchList orders={orders} vehicles={vehicles} drivers={drivers} trips={trips} onEdit={editOrder} compact /></>}''', '''{view === "dispatch_register" && <><DispatchRegister customers={customers} locations={locations} items={items} vehicles={vehicles} editingOrder={editingOrder} saving={saving} onSave={saveOrder} onCancelEdit={() => setEditingOrder(null)} /><DispatchList orders={orders} vehicles={vehicles} drivers={drivers} trips={trips} onEdit={editOrder} canEdit compact /></>}''', 1)

if 'allowedViews: DispatchView[]' not in p or 'filter((key) => allowedViews.includes(key))' not in p:
    raise SystemExit('DispatchPage permission patch incomplete')
page_path.write_text(p, encoding='utf-8')

# ---- DispatchList.tsx / DispatchDetail.tsx: hide edit when no register permission ----
list_path = Path('src/features/dispatch/DispatchList.tsx')
l = list_path.read_text(encoding='utf-8')
l = l.replace('''  onEdit: (order: DispatchOrderWithVehicles) => void;\n  onDelete?:''', '''  onEdit: (order: DispatchOrderWithVehicles) => void;\n  canEdit?: boolean;\n  onDelete?:''', 1)
l = l.replace('''export default function DispatchList({ orders, deletedOrders = [], vehicles, drivers, trips, onEdit, onDelete,''', '''export default function DispatchList({ orders, deletedOrders = [], vehicles, drivers, trips, onEdit, canEdit = true, onDelete,''', 1)
l = l.replace('''<DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={onEdit} />''', '''<DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={canEdit ? onEdit : undefined} />''')
l = l.replace('''<DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={onEdit} showTrips={false} />''', '''<DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={canEdit ? onEdit : undefined} showTrips={false} />''')
if 'canEdit?: boolean;' not in l:
    raise SystemExit('DispatchList canEdit patch incomplete')
list_path.write_text(l, encoding='utf-8')

detail_path = Path('src/features/dispatch/DispatchDetail.tsx')
d = detail_path.read_text(encoding='utf-8')
d = d.replace('''  onEdit: (order: DispatchOrderWithVehicles) => void;''', '''  onEdit?: (order: DispatchOrderWithVehicles) => void;''', 1)
d = d.replace('''<div className="dispatch-detail-actions"><span className={`dispatch-status ${dispatchStatusClass(order.status)}`}>{order.status}</span><button type="button" className="dispatch-primary" onClick={() => onEdit(order)}>수정</button></div>''', '''<div className="dispatch-detail-actions"><span className={`dispatch-status ${dispatchStatusClass(order.status)}`}>{order.status}</span>{onEdit && <button type="button" className="dispatch-primary" onClick={() => onEdit(order)}>수정</button>}</div>''', 1)
if 'onEdit?: (order:' not in d:
    raise SystemExit('DispatchDetail optional edit patch incomplete')
detail_path.write_text(d, encoding='utf-8')

# ---- DriverMobileApp.tsx: stage 2 completion and carry-over active trips ----
driver_path = Path('src/features/dispatch/DriverMobileApp.tsx')
r = driver_path.read_text(encoding='utf-8')

old_queries = '''    const [vehicleResult, assignmentResult, tripResult] = await Promise.all([\n      supabase.from("dispatch_vehicles").select("*").eq("id", vehicleId).maybeSingle(),\n      supabase.from("dispatch_order_vehicles").select("order_id").eq("vehicle_id", vehicleId),\n      supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).gte("created_at", `${dispatchToday()}T00:00:00+09:00`).lt("created_at", `${nextDate(dispatchToday())}T00:00:00+09:00`).order("created_at", { ascending: false }),\n    ]);\n    const loadError = vehicleResult.error || assignmentResult.error || tripResult.error;'''
new_queries = '''    const [vehicleResult, assignmentResult, tripResult, activeTripResult] = await Promise.all([\n      supabase.from("dispatch_vehicles").select("*").eq("id", vehicleId).maybeSingle(),\n      supabase.from("dispatch_order_vehicles").select("order_id").eq("vehicle_id", vehicleId),\n      supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).gte("created_at", `${dispatchToday()}T00:00:00+09:00`).lt("created_at", `${nextDate(dispatchToday())}T00:00:00+09:00`).order("created_at", { ascending: false }),\n      supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).in("status", ["상차대기", "진행중"]).order("created_at", { ascending: false }),\n    ]);\n    const loadError = vehicleResult.error || assignmentResult.error || tripResult.error || activeTripResult.error;'''
if old_queries not in r:
    raise SystemExit('DriverMobile query block not found')
r = r.replace(old_queries, new_queries, 1)

old_orders = '''    const nextOrders = (orderResult.data || []).map((row) => normalizeOrder(row));\n    const todayOrderIds = nextOrders.map((order) => order.id);\n    const allTripResult = todayOrderIds.length\n      ? await supabase.from("dispatch_trips").select("*").in("dispatch_order_id", todayOrderIds).order("created_at", { ascending: false })\n      : { data: [], error: null };'''
new_orders = '''    const todayOrders = (orderResult.data || []).map((row) => normalizeOrder(row));\n    const carryOverTrips = (activeTripResult.data || []).map((row) => normalizeTrip(row));\n    const carryOverOrderIds = [...new Set(carryOverTrips.map((trip) => trip.dispatch_order_id).filter((id) => !todayOrders.some((order) => order.id === id)))];\n    const carryOverOrderResult = carryOverOrderIds.length\n      ? await supabase.from("dispatch_orders").select("*").in("id", carryOverOrderIds).neq("status", "취소")\n      : { data: [], error: null };\n    if (carryOverOrderResult.error) {\n      setError(`미완료 운행의 배차를 불러오지 못했습니다. (${carryOverOrderResult.error.message})`);\n      setLoading(false);\n      return;\n    }\n    const nextOrders = [...todayOrders, ...(carryOverOrderResult.data || []).map((row) => normalizeOrder(row))];\n    const relevantOrderIds = nextOrders.map((order) => order.id);\n    const allTripResult = relevantOrderIds.length\n      ? await supabase.from("dispatch_trips").select("*").in("dispatch_order_id", relevantOrderIds).order("created_at", { ascending: false })\n      : { data: [], error: null };'''
if old_orders not in r:
    raise SystemExit('DriverMobile order block not found')
r = r.replace(old_orders, new_orders, 1)

old_set_trips = '''    setTodayOrders(nextOrders);\n    setTodayTrips((tripResult.data || []).map((row) => normalizeTrip(row)));\n    setAllTodayTrips((allTripResult.data || []).map((row) => normalizeTrip(row)));'''
new_set_trips = '''    setTodayOrders(nextOrders);\n    const todayDriverTrips = (tripResult.data || []).map((row) => normalizeTrip(row));\n    const relevantDriverTrips = [...todayDriverTrips];\n    carryOverTrips.forEach((trip) => { if (!relevantDriverTrips.some((item) => item.id === trip.id)) relevantDriverTrips.push(trip); });\n    setTodayTrips(relevantDriverTrips);\n    setAllTodayTrips((allTripResult.data || []).map((row) => normalizeTrip(row)));'''
if old_set_trips not in r:
    raise SystemExit('DriverMobile set trips block not found')
r = r.replace(old_set_trips, new_set_trips, 1)

old_completed = '''  const isOrderCompleted = (order: DispatchOrder) => {\n    const completedTrips = allTodayTrips.filter((trip) => trip.dispatch_order_id === order.id && trip.status === "완료").length;\n    return order.status === "완료" || Math.max(order.estimated_trip_count - completedTrips, 0) <= 0;\n  };'''
new_completed = '''  const isOrderCompleted = (order: DispatchOrder) => order.status === "완료";'''
if old_completed not in r:
    raise SystemExit('DriverMobile completion helper not found')
r = r.replace(old_completed, new_completed, 1)

old_card = '''              const myCompletedTrips = todayTrips.filter((trip) => trip.dispatch_order_id === order.id && trip.status === "완료").length;\n              const orderCompleted = order.status === "완료" || remainingTrips <= 0;'''
new_card = '''              const myCompletedTrips = todayTrips.filter((trip) => trip.dispatch_order_id === order.id && trip.status === "완료" && koreaDate(trip.created_at) === dispatchToday()).length;\n              const myActiveTrip = todayTrips.find((trip) => trip.dispatch_order_id === order.id && (trip.status === "상차대기" || trip.status === "진행중"));\n              const orderCompleted = order.status === "완료";'''
if old_card not in r:
    raise SystemExit('DriverMobile card completion block not found')
r = r.replace(old_card, new_card, 1)

old_button = '''                <button type="button" className="driver-main-action" disabled={orderCompleted} onClick={() => { if (!orderCompleted) chooseOrder(order.id); }}>{orderCompleted ? "운행 완료" : "운행 입력"}</button>'''
new_button = '''                <button type="button" className="driver-main-action" disabled={orderCompleted && !myActiveTrip} onClick={() => { if (!orderCompleted || myActiveTrip) chooseOrder(order.id); }}>{myActiveTrip ? "미완료 운행 계속" : orderCompleted ? "운행 완료" : "운행 입력"}</button>'''
if old_button not in r:
    raise SystemExit('DriverMobile card button not found')
r = r.replace(old_button, new_button, 1)

old_start = '''                <button type="button" className="driver-big-button start" disabled={saving || selectedOrder.status === "완료" || selectedOrder.status === "취소" || selectedOrderRemaining <= 0} onClick={() => void runTripAction("start_dispatch_trip", { p_order_id: selectedOrder.id })}>{saving ? "시작 중..." : selectedOrderRemaining <= 0 ? "전체 운행 완료" : latestCompletedTrip ? "다음 운행 시작" : "운행 시작"}</button>'''
new_start = '''                <button type="button" className="driver-big-button start" disabled={saving || selectedOrder.status === "완료" || selectedOrder.status === "취소"} onClick={() => void runTripAction("start_dispatch_trip", { p_order_id: selectedOrder.id })}>{saving ? "시작 중..." : latestCompletedTrip ? "다음 운행 시작" : "운행 시작"}</button>'''
if old_start not in r:
    raise SystemExit('DriverMobile start button not found')
r = r.replace(old_start, new_start, 1)

if '.in("status", ["상차대기", "진행중"])' not in r or '미완료 운행 계속' not in r:
    raise SystemExit('DriverMobile stage2 patch incomplete')
driver_path.write_text(r, encoding='utf-8')
