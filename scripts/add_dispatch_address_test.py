from pathlib import Path

source = Path('src/features/dispatch/DriverMobileApp.tsx')
s = source.read_text()

state_old = '  const [locationTest, setLocationTest] = useState<{ latitude: number; longitude: number; accuracy: number; capturedAt: string } | null>(null);'
state_new = '  const [locationTest, setLocationTest] = useState<{ latitude: number; longitude: number; accuracy: number; capturedAt: string; address: string; addressLoading: boolean } | null>(null);'
if state_old in s:
    s = s.replace(state_old, state_new, 1)
elif state_new not in s:
    raise SystemExit('location test state not found')

success_old = '''      (position) => {\n        setLocationTest({\n          latitude: position.coords.latitude,\n          longitude: position.coords.longitude,\n          accuracy: position.coords.accuracy,\n          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),\n        });\n        setLocationTesting(false);\n      },'''
success_new = '''      async (position) => {\n        const latitude = position.coords.latitude;\n        const longitude = position.coords.longitude;\n        const capturedAt = new Date(position.timestamp || Date.now()).toISOString();\n        setLocationTest({ latitude, longitude, accuracy: position.coords.accuracy, capturedAt, address: "", addressLoading: true });\n        setLocationTesting(false);\n\n        try {\n          const params = new URLSearchParams({\n            format: "jsonv2",\n            lat: String(latitude),\n            lon: String(longitude),\n            zoom: "18",\n            addressdetails: "1",\n            "accept-language": "ko",\n          });\n          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {\n            headers: { Accept: "application/json" },\n          });\n          if (!response.ok) throw new Error(`HTTP ${response.status}`);\n          const data = await response.json() as { display_name?: string };\n          const address = String(data.display_name || "").trim();\n          setLocationTest((current) => current ? { ...current, address: address || "주소를 찾지 못했습니다.", addressLoading: false } : current);\n        } catch {\n          setLocationTest((current) => current ? { ...current, address: "주소 변환에 실패했습니다. 위치 좌표는 정상적으로 확인되었습니다.", addressLoading: false } : current);\n        }\n      },'''
if success_old in s:
    s = s.replace(success_old, success_new, 1)
elif 'const latitude = position.coords.latitude;' not in s:
    raise SystemExit('location success callback not found')

ui_old = '''              {locationTest && <div className="driver-location-test-result"><div><span>위도</span><b>{locationTest.latitude.toFixed(6)}</b></div><div><span>경도</span><b>{locationTest.longitude.toFixed(6)}</b></div><div><span>정확도</span><b>약 {Math.round(locationTest.accuracy)}m</b></div><div><span>확인 시간</span><b>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(locationTest.capturedAt))}</b></div></div>}'''
ui_new = '''              {locationTest && <div className="driver-location-test-result"><div className="driver-location-address"><span>현재 주소</span><b>{locationTest.addressLoading ? "주소 확인 중..." : locationTest.address}</b></div><div><span>정확도</span><b>약 {Math.round(locationTest.accuracy)}m</b></div><div><span>확인 시간</span><b>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(locationTest.capturedAt))}</b></div></div>}'''
if ui_old in s:
    s = s.replace(ui_old, ui_new, 1)
elif 'className="driver-location-address"' not in s:
    raise SystemExit('location result UI not found')

source.write_text(s)

css_path = Path('src/features/dispatch/driverMobile.css')
css = css_path.read_text()
css_add = '''\n.driver-location-test-result .driver-location-address{grid-column:1/-1;padding:12px}.driver-location-address b{font-size:14px;line-height:1.55}.driver-location-address span{font-size:11px}\n'''
if '.driver-location-test-result .driver-location-address{' not in css:
    css += css_add
    css_path.write_text(css)
