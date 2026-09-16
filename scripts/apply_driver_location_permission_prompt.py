from pathlib import Path

# Driver: show a first-entry location permission guide. This only checks browser GPS
# permission; it does not save or display the driver's location.
path = Path('src/features/dispatch/DriverMobileApp.tsx')
s = path.read_text()

state_anchor = '  const [error, setError] = useState("");'
state_add = state_anchor + '''\n  const [locationPermissionOpen, setLocationPermissionOpen] = useState(false);\n  const [locationPermissionBusy, setLocationPermissionBusy] = useState(false);\n  const [locationPermissionMessage, setLocationPermissionMessage] = useState("");'''
if 'locationPermissionOpen' not in s:
    if state_anchor not in s:
        raise SystemExit('driver state anchor not found')
    s = s.replace(state_anchor, state_add, 1)

mount_anchor = '  useEffect(() => { void loadOrders(); }, [loadOrders]);'
mount_add = mount_anchor + '''\n\n  useEffect(() => {\n    let cancelled = false;\n    const permissionKey = "tm_driver_location_permission_granted_v1";\n    const checkLocationPermission = async () => {\n      if (!("geolocation" in navigator)) {\n        if (!cancelled) {\n          setLocationPermissionMessage("이 휴대폰에서는 위치 확인을 지원하지 않습니다.");\n          setLocationPermissionOpen(true);\n        }\n        return;\n      }\n      try {\n        if ("permissions" in navigator && navigator.permissions?.query) {\n          const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });\n          if (cancelled) return;\n          if (status.state === "granted") {\n            localStorage.setItem(permissionKey, "1");\n            setLocationPermissionOpen(false);\n            return;\n          }\n          setLocationPermissionOpen(true);\n          if (status.state === "denied") {\n            setLocationPermissionMessage("위치 권한이 차단되어 있습니다. 브라우저 사이트 설정에서 위치 권한을 허용해 주세요.");\n          }\n          return;\n        }\n      } catch {\n        // Some mobile browsers do not expose the Permissions API. Fall back to the saved successful grant.\n      }\n      if (!cancelled) setLocationPermissionOpen(localStorage.getItem(permissionKey) !== "1");\n    };\n    void checkLocationPermission();\n    return () => { cancelled = true; };\n  }, []);\n\n  const requestInitialLocationPermission = () => {\n    const permissionKey = "tm_driver_location_permission_granted_v1";\n    if (!("geolocation" in navigator)) {\n      setLocationPermissionMessage("이 휴대폰에서는 위치 확인을 지원하지 않습니다.");\n      return;\n    }\n    setLocationPermissionBusy(true);\n    setLocationPermissionMessage("");\n    navigator.geolocation.getCurrentPosition(\n      () => {\n        localStorage.setItem(permissionKey, "1");\n        setLocationPermissionBusy(false);\n        setLocationPermissionOpen(false);\n      },\n      (geoError) => {\n        setLocationPermissionBusy(false);\n        setLocationPermissionOpen(true);\n        if (geoError.code === geoError.PERMISSION_DENIED) {\n          setLocationPermissionMessage("위치 권한이 차단되었습니다. 주소창의 사이트 설정 또는 휴대폰 설정에서 이 사이트의 위치 권한을 ‘허용’으로 변경해 주세요.");\n        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {\n          setLocationPermissionMessage("휴대폰 위치 서비스를 켠 뒤 다시 눌러 주세요.");\n        } else {\n          setLocationPermissionMessage("위치 확인 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");\n        }\n      },\n      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },\n    );\n  };'''
if 'requestInitialLocationPermission' not in s:
    if mount_anchor not in s:
        raise SystemExit('driver mount anchor not found')
    s = s.replace(mount_anchor, mount_add, 1)

root_anchor = '    <div className="driver-mobile-app">\n      <header className="driver-mobile-header">'
root_replacement = '''    <div className="driver-mobile-app">\n      {locationPermissionOpen && (\n        <div className="driver-location-permission-backdrop" role="dialog" aria-modal="true" aria-label="운행 위치 권한 설정">\n          <div className="driver-location-permission-card">\n            <div className="driver-location-permission-icon">📍</div>\n            <h2>운행 위치 권한 설정</h2>\n            <p>상차완료·하차완료 시간을 정확한 위치와 함께 기록하기 위해 위치 권한이 필요합니다.</p>\n            <p className="driver-location-permission-note">기사님 화면에는 주소나 좌표가 표시되지 않습니다.</p>\n            {locationPermissionMessage && <div className="driver-location-permission-message">{locationPermissionMessage}</div>}\n            <button type="button" onClick={requestInitialLocationPermission} disabled={locationPermissionBusy}>\n              {locationPermissionBusy ? "위치 확인 중..." : "위치 허용하기"}\n            </button>\n          </div>\n        </div>\n      )}\n      <header className="driver-mobile-header">'''
if 'driver-location-permission-backdrop' not in s:
    if root_anchor not in s:
        raise SystemExit('driver root anchor not found')
    s = s.replace(root_anchor, root_replacement, 1)

path.write_text(s)

# Driver permission modal styling.
path = Path('src/features/dispatch/driverMobile.css')
s = path.read_text()
css = '''\n.driver-location-permission-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(9,24,40,.58);display:flex;align-items:center;justify-content:center;padding:20px}.driver-location-permission-card{width:min(100%,420px);background:#fff;border-radius:24px;padding:28px 22px 22px;box-shadow:0 24px 70px rgba(0,0,0,.24);text-align:center}.driver-location-permission-icon{width:62px;height:62px;margin:0 auto 12px;border-radius:20px;background:#eef6ff;display:flex;align-items:center;justify-content:center;font-size:30px}.driver-location-permission-card h2{margin:0 0 12px;font-size:24px;color:#12263a}.driver-location-permission-card p{margin:0 auto 9px;max-width:340px;color:#4f6173;line-height:1.55;font-size:15px}.driver-location-permission-card .driver-location-permission-note{font-size:13px;color:#718194}.driver-location-permission-message{margin:14px 0 0;padding:12px 14px;border-radius:14px;background:#fff4f2;color:#a23d32;font-size:13px;line-height:1.45;text-align:left}.driver-location-permission-card button{width:100%;margin-top:18px;border:0;border-radius:15px;background:#113b55;color:#fff;font-weight:800;font-size:17px;padding:15px 16px}.driver-location-permission-card button:disabled{opacity:.65}\n'''
if '.driver-location-permission-backdrop{' not in s:
    s += css
path.write_text(s)

# Admin display: turn a nearby place suffix such as '(감성교)' into '· 감성교 인근'.
path = Path('src/features/dispatch/DispatchDetail.tsx')
s = path.read_text()
helper_anchor = 'const koreaDateTime = '
if 'const formatTripLocationDisplay' not in s:
    idx = s.find(helper_anchor)
    if idx < 0:
        raise SystemExit('dispatch detail datetime helper not found')
    helper = '''const formatTripLocationDisplay = (address?: string | null) => {\n  const value = String(address || "").trim();\n  if (!value) return "";\n  return value.replace(/\\s*\\(([^()]+)\\)\\s*$/, " · $1 인근");\n};\n\n'''
    s = s[:idx] + helper + s[idx:]

s = s.replace('📍 {locationByTripEvent.get(`${trip.id}:loading`)?.address}', '📍 {formatTripLocationDisplay(locationByTripEvent.get(`${trip.id}:loading`)?.address)}')
s = s.replace('📍 {locationByTripEvent.get(`${trip.id}:unloading`)?.address}', '📍 {formatTripLocationDisplay(locationByTripEvent.get(`${trip.id}:unloading`)?.address)}')
path.write_text(s)
