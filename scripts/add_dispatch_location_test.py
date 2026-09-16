from pathlib import Path

source = Path('src/features/dispatch/DriverMobileApp.tsx')
s = source.read_text()

state_anchor = '  const [error, setError] = useState("");'
state_new = state_anchor + '''\n  const [locationTesting, setLocationTesting] = useState(false);\n  const [locationTest, setLocationTest] = useState<{ latitude: number; longitude: number; accuracy: number; capturedAt: string } | null>(null);'''
if 'const [locationTesting, setLocationTesting]' not in s:
    if state_anchor not in s:
        raise SystemExit('location state anchor not found')
    s = s.replace(state_anchor, state_new, 1)

function_anchor = '''  const chooseOrder = (orderId: string) => {\n    setSelectedOrderId(orderId);\n    const order = todayOrders.find((item) => item.id === orderId);\n    if (order) setActualVolume(String(order.volume_per_trip));\n    setTab("input");\n  };'''
function_new = function_anchor + '''\n\n  const testCurrentLocation = () => {\n    if (!("geolocation" in navigator)) {\n      setError("이 휴대폰/브라우저에서는 위치 확인을 지원하지 않습니다.");\n      return;\n    }\n    setLocationTesting(true);\n    setError("");\n    navigator.geolocation.getCurrentPosition(\n      (position) => {\n        setLocationTest({\n          latitude: position.coords.latitude,\n          longitude: position.coords.longitude,\n          accuracy: position.coords.accuracy,\n          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),\n        });\n        setLocationTesting(false);\n      },\n      (geoError) => {\n        const message = geoError.code === geoError.PERMISSION_DENIED\n          ? "위치 권한이 거부되었습니다. 브라우저에서 이 사이트의 위치 권한을 허용해 주세요."\n          : geoError.code === geoError.POSITION_UNAVAILABLE\n            ? "현재 위치를 확인할 수 없습니다. GPS/위치 서비스를 켠 뒤 다시 시도해 주세요."\n            : "위치 확인 시간이 초과되었습니다. 실외나 창가에서 다시 시도해 주세요.";\n        setError(message);\n        setLocationTesting(false);\n      },\n      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },\n    );\n  };'''
if 'const testCurrentLocation = () =>' not in s:
    if function_anchor not in s:
        raise SystemExit('location function anchor not found')
    s = s.replace(function_anchor, function_new, 1)

ui_anchor = '''            <div className="driver-mobile-title"><div><span>{dispatchToday()}</span><h2>오늘 배차</h2></div><button type="button" onClick={() => void loadOrders()}>새로고침</button></div>'''
ui_new = ui_anchor + '''\n            <div className="driver-location-test">\n              <div className="driver-location-test-head"><div><strong>현재 위치 테스트</strong><span>저장하지 않고 휴대폰 GPS가 잡히는지만 확인합니다.</span></div><button type="button" disabled={locationTesting} onClick={testCurrentLocation}>{locationTesting ? "위치 확인 중..." : "위치 테스트"}</button></div>\n              {locationTest && <div className="driver-location-test-result"><div><span>위도</span><b>{locationTest.latitude.toFixed(6)}</b></div><div><span>경도</span><b>{locationTest.longitude.toFixed(6)}</b></div><div><span>정확도</span><b>약 {Math.round(locationTest.accuracy)}m</b></div><div><span>확인 시간</span><b>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(locationTest.capturedAt))}</b></div></div>}\n            </div>'''
if 'className="driver-location-test"' not in s:
    if ui_anchor not in s:
        raise SystemExit('location UI anchor not found')
    s = s.replace(ui_anchor, ui_new, 1)

source.write_text(s)

css_path = Path('src/features/dispatch/driverMobile.css')
css = css_path.read_text()
css_add = '''\n.driver-location-test{margin:0 0 14px;padding:14px;border:1px solid #dbe5ee;border-radius:14px;background:#f8fafc}.driver-location-test-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.driver-location-test-head>div{display:grid;gap:3px}.driver-location-test-head strong{font-size:14px;color:#172b3a}.driver-location-test-head span{font-size:11px;color:#6b7b88}.driver-location-test-head button{border:0;border-radius:10px;background:#12324a;color:#fff;padding:10px 13px;font-size:12px;font-weight:800;white-space:nowrap}.driver-location-test-head button:disabled{opacity:.55}.driver-location-test-result{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.driver-location-test-result>div{display:grid;gap:3px;padding:9px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}.driver-location-test-result span{font-size:10px;color:#718096}.driver-location-test-result b{font-size:12px;color:#1e293b;overflow-wrap:anywhere}@media(max-width:420px){.driver-location-test-head{align-items:stretch;flex-direction:column}.driver-location-test-head button{width:100%}}\n'''
if '.driver-location-test{' not in css:
    css += css_add
    css_path.write_text(css)
