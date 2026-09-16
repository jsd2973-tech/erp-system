from pathlib import Path

path = Path('src/features/dispatch/DriverStatusDashboard.tsx')
s = path.read_text()

s = s.replace(
    'import type { DispatchDriver, DispatchTrip, DispatchVehicle } from "./dispatchTypes";',
    'import type { DispatchDriver, DispatchTrip, DispatchTripLocation, DispatchVehicle } from "./dispatchTypes";'
)

state_anchor = '  const [trips, setTrips] = useState<DispatchTrip[]>([]);'
if 'const [tripLocations, setTripLocations]' not in s:
    if state_anchor not in s:
        raise SystemExit('trip state anchor not found')
    s = s.replace(state_anchor, state_anchor + '\n  const [tripLocations, setTripLocations] = useState<DispatchTripLocation[]>([]);', 1)

promise_old = '    const [tripResult, orderResult, assignmentResult] = await Promise.all(['
promise_new = '    const [tripResult, orderResult, assignmentResult, tripLocationResult] = await Promise.all(['
if promise_old in s:
    s = s.replace(promise_old, promise_new, 1)

query_anchor = '      supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id"),\n    ]);'
if 'supabase.from("dispatch_trip_locations")' not in s:
    if query_anchor not in s:
        raise SystemExit('location query anchor not found')
    s = s.replace(
        query_anchor,
        '      supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id"),\n'
        '      supabase.from("dispatch_trip_locations").select("*").gte("captured_at", `${today}T00:00:00+09:00`).lt("captured_at", `${tomorrow}T00:00:00+09:00`).order("captured_at", { ascending: false }),\n'
        '    ]);',
        1,
    )

s = s.replace(
    '    const loadError = tripResult.error || orderResult.error || assignmentResult.error;',
    '    const loadError = tripResult.error || orderResult.error || assignmentResult.error || tripLocationResult.error;',
    1,
)

set_trips_end = '    })) as DispatchTrip[]);\n    setError("");'
if 'setTripLocations((tripLocationResult.data || []).map' not in s:
    if set_trips_end not in s:
        raise SystemExit('set trips end anchor not found')
    s = s.replace(
        set_trips_end,
        '    })) as DispatchTrip[]);\n'
        '    setTripLocations((tripLocationResult.data || []).map((row) => ({\n'
        '      id: String(row.id),\n'
        '      trip_id: String(row.trip_id),\n'
        '      event_type: String(row.event_type) as "loading" | "unloading",\n'
        '      latitude: Number(row.latitude),\n'
        '      longitude: Number(row.longitude),\n'
        '      accuracy_m: row.accuracy_m == null ? null : Number(row.accuracy_m),\n'
        '      address: row.address ? String(row.address) : null,\n'
        '      captured_at: String(row.captured_at || ""),\n'
        '    })) as DispatchTripLocation[]);\n'
        '    setError("");',
        1,
    )

map_anchor = '  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);'
if 'locationByTripEvent' not in s:
    if map_anchor not in s:
        raise SystemExit('location map anchor not found')
    s = s.replace(
        map_anchor,
        map_anchor + '\n  const locationByTripEvent = useMemo(() => new Map(tripLocations.map((location) => [`${location.trip_id}:${location.event_type}`, location])), [tripLocations]);',
        1,
    )

old_info = '''                      <div className="driver-trip-info">\n                        <span>시작 <b>{start}</b></span>\n                        <span>상차 <b>{loadingTime}</b></span>\n                        <span>하차 <b>{unloading}</b></span>\n                      </div>'''
new_info = '''                      <div className="driver-trip-info">\n                        <span>시작 <b>{start}</b></span>\n                        <span className="driver-trip-event">상차 <b>{loadingTime}</b>{locationByTripEvent.get(`${trip.id}:loading`)?.address && <small>📍 {locationByTripEvent.get(`${trip.id}:loading`)?.address}</small>}</span>\n                        <span className="driver-trip-event">하차 <b>{unloading}</b>{locationByTripEvent.get(`${trip.id}:unloading`)?.address && <small>📍 {locationByTripEvent.get(`${trip.id}:unloading`)?.address}</small>}</span>\n                      </div>'''
if 'className="driver-trip-event"' not in s:
    if old_info not in s:
        raise SystemExit('trip info anchor not found')
    s = s.replace(old_info, new_info, 1)

path.write_text(s)

css_path = Path('src/features/dispatch/driverStatusDashboard.css')
css = css_path.read_text()
marker = '.driver-trip-event small{'
if marker not in css:
    css += '\n.driver-trip-event{display:flex!important;flex-wrap:wrap;align-items:center;gap:4px}.driver-trip-event small{display:block;flex-basis:100%;margin-top:2px;font-size:11px;line-height:1.35;font-weight:600;color:#5f7182;white-space:normal}.driver-trip-row .driver-trip-event small{max-width:320px}@media(max-width:760px){.driver-trip-event{align-items:flex-start}.driver-trip-event small{font-size:10px;line-height:1.4}}\n'
css_path.write_text(css)
