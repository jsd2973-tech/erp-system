from pathlib import Path

# Driver mobile: capture GPS/address only when completing loading/unloading.
path = Path('src/features/dispatch/DriverMobileApp.tsx')
s = path.read_text()
helper_anchor = '''const koreaTime = (value: string | null) => value\n  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))\n  : "-";'''
helper_add = helper_anchor + '''\n\ntype TripLocationCapture = { latitude: number; longitude: number; accuracy: number; address: string | null };\n\nconst formatReverseAddress = (data: Record<string, unknown>) => {\n  const address = (data.address || {}) as Record<string, string>;\n  const region = address.state || address.province || address.region || "";\n  const city = address.city || address.county || address.municipality || "";\n  const local = address.town || address.village || address.suburb || address.quarter || address.hamlet || "";\n  const road = address.road || address.pedestrian || address.path || "";\n  const house = address.house_number || "";\n  const landmark = address.bridge || address.building || address.amenity || address.place || "";\n  const parts = [region, city, local, road, house, landmark].map((value) => value?.trim()).filter(Boolean);\n  return [...new Set(parts)].join(" ") || null;\n};\n\nconst captureTripLocation = () => new Promise<TripLocationCapture>((resolve, reject) => {\n  if (!("geolocation" in navigator)) { reject(new Error("이 휴대폰에서는 위치 확인을 지원하지 않습니다.")); return; }\n  navigator.geolocation.getCurrentPosition(async (position) => {\n    const latitude = position.coords.latitude;\n    const longitude = position.coords.longitude;\n    let address: string | null = null;\n    try {\n      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=ko`);\n      if (response.ok) address = formatReverseAddress(await response.json() as Record<string, unknown>);\n    } catch {\n      address = null;\n    }\n    resolve({ latitude, longitude, accuracy: position.coords.accuracy, address });\n  }, (geoError) => {\n    const message = geoError.code === geoError.PERMISSION_DENIED\n      ? "상차·하차 완료 처리를 위해 위치 권한을 허용해 주세요."\n      : geoError.code === geoError.POSITION_UNAVAILABLE\n        ? "현재 위치를 확인할 수 없습니다. 휴대폰 위치 서비스를 켜고 다시 시도해 주세요."\n        : "위치 확인 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";\n    reject(new Error(message));\n  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });\n});'''
if 'type TripLocationCapture' not in s:
    if helper_anchor not in s: raise SystemExit('driver helper anchor not found')
    s = s.replace(helper_anchor, helper_add, 1)

old_action = '''  const runTripAction = async (rpc: string, args: Record<string, unknown>) => {\n    setSaving(true);\n    setError("");\n    const { error: actionError } = await supabase.rpc(rpc, args);\n    setSaving(false);\n    if (actionError) {\n      setError(actionError.message);\n      return;\n    }\n    await loadOrders();\n  };'''
new_action = '''  const runTripAction = async (rpc: string, args: Record<string, unknown>, captureLocation = false) => {\n    setSaving(true);\n    setError("");\n    let rpcName = rpc;\n    let rpcArgs = args;\n    if (captureLocation) {\n      try {\n        const location = await captureTripLocation();\n        rpcName = rpc === "complete_dispatch_loading" ? "complete_dispatch_loading_with_location" : "complete_dispatch_unloading_with_location";\n        rpcArgs = {\n          ...args,\n          p_latitude: location.latitude,\n          p_longitude: location.longitude,\n          p_accuracy_m: location.accuracy,\n          p_address: location.address,\n        };\n      } catch (locationError) {\n        setSaving(false);\n        setError(locationError instanceof Error ? locationError.message : "현재 위치를 확인하지 못했습니다.");\n        return;\n      }\n    }\n    const { error: actionError } = await supabase.rpc(rpcName, rpcArgs);\n    setSaving(false);\n    if (actionError) {\n      setError(actionError.message);\n      return;\n    }\n    await loadOrders();\n  };'''
if 'complete_dispatch_loading_with_location' not in s:
    if old_action not in s: raise SystemExit('driver action anchor not found')
    s = s.replace(old_action, new_action, 1)

s = s.replace('void runTripAction("complete_dispatch_loading", { p_trip_id: activeTrip.id })', 'void runTripAction("complete_dispatch_loading", { p_trip_id: activeTrip.id }, true)')
s = s.replace('void runTripAction("complete_dispatch_unloading", { p_trip_id: activeTrip.id, p_actual_volume: Number(actualVolume) })', 'void runTripAction("complete_dispatch_unloading", { p_trip_id: activeTrip.id, p_actual_volume: Number(actualVolume) }, true)')
path.write_text(s)

# Types.
path = Path('src/features/dispatch/dispatchTypes.ts')
s = path.read_text()
if 'export type DispatchTripLocation' not in s:
    s += '''\n\nexport type DispatchTripLocation = {\n  id: string;\n  trip_id: string;\n  event_type: "loading" | "unloading";\n  latitude: number;\n  longitude: number;\n  accuracy_m: number | null;\n  address: string | null;\n  captured_at: string;\n};\n'''
path.write_text(s)

# Dispatch page: load secured trip location rows. RLS returns rows only to admins / explicitly permitted staff.
path = Path('src/features/dispatch/DispatchPage.tsx')
s = path.read_text()
s = s.replace('DispatchOrderWithVehicles, DispatchTrip, DispatchVehicle, DispatchView', 'DispatchOrderWithVehicles, DispatchTrip, DispatchTripLocation, DispatchVehicle, DispatchView')
state_anchor = '  const [trips, setTrips] = useState<DispatchTrip[]>([]);'
if 'const [tripLocations, setTripLocations]' not in s:
    if state_anchor not in s: raise SystemExit('page state anchor not found')
    s = s.replace(state_anchor, state_anchor + '\n  const [tripLocations, setTripLocations] = useState<DispatchTripLocation[]>([]);', 1)
old_promise = 'const [vehicleResult, driverResult, orderResult, assignmentResult, customerResult, locationResult, itemResult, tripResult] = await Promise.all(['
new_promise = 'const [vehicleResult, driverResult, orderResult, assignmentResult, customerResult, locationResult, itemResult, tripResult, tripLocationResult] = await Promise.all(['
if old_promise in s:
    s = s.replace(old_promise, new_promise, 1)
trip_query = '      canReadTrips ? supabase.from("dispatch_trips").select("*").order("created_at", { ascending: false }) : skipped,\n    ]);'
if 'supabase.from("dispatch_trip_locations")' not in s:
    if trip_query not in s: raise SystemExit('page trip query anchor not found')
    s = s.replace(trip_query, '      canReadTrips ? supabase.from("dispatch_trips").select("*").order("created_at", { ascending: false }) : skipped,\n      canReadTrips ? supabase.from("dispatch_trip_locations").select("*").order("captured_at", { ascending: false }) : skipped,\n    ]);', 1)
err_anchor = '      canReadTrips ? tripResult.error : null,\n    ].filter(Boolean);'
if err_anchor in s:
    s = s.replace(err_anchor, '      canReadTrips ? tripResult.error : null,\n      canReadTrips ? tripLocationResult.error : null,\n    ].filter(Boolean);', 1)
set_anchor = '''    if (canReadTrips && !tripResult.error && tripResult.data) {\n      setTrips(tripResult.data.map((row) => ({'''
if 'setTripLocations(' not in s:
    idx = s.find(set_anchor)
    if idx < 0: raise SystemExit('page set trips anchor not found')
    end_marker = '      })) as DispatchTrip[]);\n    }'
    end = s.find(end_marker, idx)
    if end < 0: raise SystemExit('page set trips end not found')
    end += len(end_marker)
    block = '''\n\n    if (canReadTrips && !tripLocationResult.error && tripLocationResult.data) {\n      setTripLocations(tripLocationResult.data.map((row) => ({\n        id: String(row.id), trip_id: String(row.trip_id), event_type: String(row.event_type) as "loading" | "unloading",\n        latitude: Number(row.latitude), longitude: Number(row.longitude), accuracy_m: row.accuracy_m == null ? null : Number(row.accuracy_m),\n        address: row.address ? String(row.address) : null, captured_at: String(row.captured_at || ""),\n      })) as DispatchTripLocation[]);\n    }'''
    s = s[:end] + block + s[end:]
s = s.replace('<DispatchList orders={orders} vehicles={vehicles} drivers={drivers} trips={trips} onEdit={editOrder} compact />', '<DispatchList orders={orders} vehicles={vehicles} drivers={drivers} trips={trips} tripLocations={tripLocations} onEdit={editOrder} compact />')
s = s.replace('<DispatchList orders={orders} deletedOrders={deletedOrders} vehicles={vehicles} drivers={drivers} trips={trips} onEdit={editOrder}', '<DispatchList orders={orders} deletedOrders={deletedOrders} vehicles={vehicles} drivers={drivers} trips={trips} tripLocations={tripLocations} onEdit={editOrder}')
path.write_text(s)

# Dispatch list: pass secured location rows into detail/history.
path = Path('src/features/dispatch/DispatchList.tsx')
s = path.read_text()
s = s.replace('DispatchOrderWithVehicles, DispatchTrip, DispatchVehicle', 'DispatchOrderWithVehicles, DispatchTrip, DispatchTripLocation, DispatchVehicle')
prop_anchor = '  trips: DispatchTrip[];'
if 'tripLocations?: DispatchTripLocation[];' not in s:
    s = s.replace(prop_anchor, prop_anchor + '\n  tripLocations?: DispatchTripLocation[];', 1)
s = s.replace('export default function DispatchList({ orders, deletedOrders = [], vehicles, drivers, trips, onEdit,', 'export default function DispatchList({ orders, deletedOrders = [], vehicles, drivers, trips, tripLocations = [], onEdit,')
s = s.replace('trips={selectedTrips} onEdit=', 'trips={selectedTrips} tripLocations={tripLocations} onEdit=')
s = s.replace('trips={selectedTrips} />', 'trips={selectedTrips} tripLocations={tripLocations} />')
path.write_text(s)

# Detail/history: show address only when RLS supplied a location row.
path = Path('src/features/dispatch/DispatchDetail.tsx')
s = path.read_text()
s = s.replace('DispatchOrderWithVehicles, DispatchTrip, DispatchVehicle', 'DispatchOrderWithVehicles, DispatchTrip, DispatchTripLocation, DispatchVehicle')
if 'tripLocations?: DispatchTripLocation[];' not in s:
    s = s.replace('  trips: DispatchTrip[];\n  onEdit?:', '  trips: DispatchTrip[];\n  tripLocations?: DispatchTripLocation[];\n  onEdit?:', 1)
    s = s.replace('  trips: DispatchTrip[];\n};\n\nconst koreaDateTime', '  trips: DispatchTrip[];\n  tripLocations?: DispatchTripLocation[];\n};\n\nconst koreaDateTime', 1)
s = s.replace('export function DispatchTripHistory({ vehicles, drivers, trips }: DispatchTripHistoryProps)', 'export function DispatchTripHistory({ vehicles, drivers, trips, tripLocations = [] }: DispatchTripHistoryProps)')
map_anchor = '  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));'
if 'locationByTripEvent' not in s:
    s = s.replace(map_anchor, map_anchor + '\n  const locationByTripEvent = new Map(tripLocations.map((location) => [`${location.trip_id}:${location.event_type}`, location]));', 1)
old_row = '<td>{koreaDateTime(trip.loading_completed_at)}</td><td>{koreaDateTime(trip.unloading_completed_at)}</td>'
new_row = '<td>{koreaDateTime(trip.loading_completed_at)}{locationByTripEvent.get(`${trip.id}:loading`)?.address && <small className="dispatch-trip-location">📍 {locationByTripEvent.get(`${trip.id}:loading`)?.address}</small>}</td><td>{koreaDateTime(trip.unloading_completed_at)}{locationByTripEvent.get(`${trip.id}:unloading`)?.address && <small className="dispatch-trip-location">📍 {locationByTripEvent.get(`${trip.id}:unloading`)?.address}</small>}</td>'
s = s.replace(old_row, new_row)
old_mobile = '<div><span>상차 완료</span><b>{koreaDateTime(trip.loading_completed_at)}</b></div>\n              <div><span>하차 완료</span><b>{koreaDateTime(trip.unloading_completed_at)}</b></div>'
new_mobile = '<div><span>상차 완료</span><b>{koreaDateTime(trip.loading_completed_at)}</b>{locationByTripEvent.get(`${trip.id}:loading`)?.address && <small className="dispatch-trip-location">📍 {locationByTripEvent.get(`${trip.id}:loading`)?.address}</small>}</div>\n              <div><span>하차 완료</span><b>{koreaDateTime(trip.unloading_completed_at)}</b>{locationByTripEvent.get(`${trip.id}:unloading`)?.address && <small className="dispatch-trip-location">📍 {locationByTripEvent.get(`${trip.id}:unloading`)?.address}</small>}</div>'
s = s.replace(old_mobile, new_mobile)
s = s.replace('export default function DispatchDetail({ order, vehicles, drivers, trips, onEdit, showTrips = true }: DispatchDetailProps)', 'export default function DispatchDetail({ order, vehicles, drivers, trips, tripLocations = [], onEdit, showTrips = true }: DispatchDetailProps)')
s = s.replace('<DispatchTripHistory vehicles={vehicles} drivers={drivers} trips={trips} />', '<DispatchTripHistory vehicles={vehicles} drivers={drivers} trips={trips} tripLocations={tripLocations} />')
path.write_text(s)

# Styling for addresses below timestamps.
path = Path('src/features/dispatch/dispatch.css')
s = path.read_text()
if '.dispatch-trip-location{' not in s:
    s += '\n.dispatch-trip-location{display:block;margin-top:5px;font-size:11px;line-height:1.35;font-weight:600;color:#526579;white-space:normal;max-width:260px}.dispatch-trip-mobile-times .dispatch-trip-location{margin-top:4px;font-size:10px;color:#5f7182}\n'
path.write_text(s)
