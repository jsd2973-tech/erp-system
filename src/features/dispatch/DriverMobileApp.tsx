import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchDriver, DispatchOrder, DispatchTrip, DispatchVehicle } from "./dispatchTypes";
import { dispatchToday, formatVolume } from "./dispatchUtils";
import { captureTripLocation } from "./dispatchLocationService";
import { loadDriverDispatchSnapshot, loadDriverHistory, saveDriverTripAction } from "./dispatchMobileService";
import "./driverMobile.css";

// COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1

type DriverTab = "today" | "input" | "history";

type DriverMobileAppProps = {
  supabase: SupabaseClient;
  driver: DispatchDriver;
  onLogout: () => void;
};

const koreaDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value))
  : "";

const koreaTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
  : "-";

export default function DriverMobileApp({ supabase, driver, onLogout }: DriverMobileAppProps) {
  const [tab, setTab] = useState<DriverTab>("today");
  const [todayOrders, setTodayOrders] = useState<DispatchOrder[]>([]);
  const [todayTrips, setTodayTrips] = useState<DispatchTrip[]>([]);
  const [allTodayTrips, setAllTodayTrips] = useState<DispatchTrip[]>([]);
  const [historyTrips, setHistoryTrips] = useState<DispatchTrip[]>([]);
  const [ordersById, setOrdersById] = useState<Map<string, DispatchOrder>>(new Map());
  const [orderVehicleIds, setOrderVehicleIds] = useState<Map<string, string[]>>(new Map());
  const [vehicle, setVehicle] = useState<DispatchVehicle | null>(null);
  const [vehiclesById, setVehiclesById] = useState<Map<string, DispatchVehicle>>(new Map());
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [actualVolume, setActualVolume] = useState("17");
  const [historyDate, setHistoryDate] = useState(dispatchToday);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [locationPermissionOpen, setLocationPermissionOpen] = useState(false);
  const [locationPermissionBusy, setLocationPermissionBusy] = useState(false);
  const [locationPermissionMessage, setLocationPermissionMessage] = useState("");

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const snapshot = await loadDriverDispatchSnapshot(supabase, driver);
      setVehicle(snapshot.vehicles[0] || null);
      setVehiclesById((current) => new Map([...current, ...snapshot.vehicles.map((item) => [item.id, item] as const)]));
      setOrderVehicleIds(snapshot.orderVehicleIds);
      setTodayOrders(snapshot.todayOrders);
      setTodayTrips(snapshot.todayTrips);
      setAllTodayTrips(snapshot.allTodayTrips);
      setOrdersById((current) => new Map([...current, ...snapshot.todayOrders.map((order) => [order.id, order] as const)]));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "배차 정보를 불러오지 못했습니다.");
    }
    setLoading(false);
  }, [driver.assigned_vehicle_id, driver.id, supabase]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await loadDriverHistory(supabase, driver.id, historyDate);
      setHistoryTrips(snapshot.trips);
      setOrdersById((current) => new Map([...current, ...snapshot.orders.map((order) => [order.id, order] as const)]));
      setVehiclesById((current) => new Map([...current, ...snapshot.vehicles.map((item) => [item.id, item] as const)]));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "운행기록을 불러오지 못했습니다.");
    }
    setLoading(false);
  }, [driver.id, historyDate, supabase]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  useEffect(() => {
    let cancelled = false;
    const permissionKey = "tm_driver_location_permission_granted_v1";
    const checkLocationPermission = async () => {
      if (!("geolocation" in navigator)) {
        if (!cancelled) {
          setLocationPermissionMessage("이 휴대폰에서는 위치 확인을 지원하지 않습니다.");
          setLocationPermissionOpen(true);
        }
        return;
      }
      try {
        if ("permissions" in navigator && navigator.permissions?.query) {
          const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          if (cancelled) return;
          if (status.state === "granted") {
            localStorage.setItem(permissionKey, "1");
            setLocationPermissionOpen(false);
            return;
          }
          setLocationPermissionOpen(true);
          if (status.state === "denied") {
            setLocationPermissionMessage("위치 권한이 차단되어 있습니다. 브라우저 사이트 설정에서 위치 권한을 허용해 주세요.");
          }
          return;
        }
      } catch {
        // Some mobile browsers do not expose the Permissions API. Fall back to the saved successful grant.
      }
      if (!cancelled) setLocationPermissionOpen(localStorage.getItem(permissionKey) !== "1");
    };
    void checkLocationPermission();
    return () => { cancelled = true; };
  }, []);

  const requestInitialLocationPermission = () => {
    const permissionKey = "tm_driver_location_permission_granted_v1";
    if (!("geolocation" in navigator)) {
      setLocationPermissionMessage("이 휴대폰에서는 위치 확인을 지원하지 않습니다.");
      return;
    }
    setLocationPermissionBusy(true);
    setLocationPermissionMessage("");
    navigator.geolocation.getCurrentPosition(
      () => {
        localStorage.setItem(permissionKey, "1");
        setLocationPermissionBusy(false);
        setLocationPermissionOpen(false);
      },
      (geoError) => {
        setLocationPermissionBusy(false);
        setLocationPermissionOpen(true);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setLocationPermissionMessage("위치 권한이 차단되었습니다. 주소창의 사이트 설정 또는 휴대폰 설정에서 이 사이트의 위치 권한을 ‘허용’으로 변경해 주세요.");
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setLocationPermissionMessage("휴대폰 위치 서비스를 켠 뒤 다시 눌러 주세요.");
        } else {
          setLocationPermissionMessage("위치 확인 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  useEffect(() => { if (tab === "history") void loadHistory(); }, [loadHistory, tab]);

  useEffect(() => {
    if (tab !== "today" && tab !== "input") return;

    const refresh = () => void loadOrders(true);
    const intervalId = window.setInterval(refresh, 10000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadOrders, tab]);

  const selectedOrder = todayOrders.find((order) => order.id === selectedOrderId) || null;
  const activeTrip = todayTrips.find((trip) => trip.dispatch_order_id === selectedOrderId && (trip.status === "상차대기" || trip.status === "진행중")) || null;
  const latestCompletedTrip = todayTrips.find((trip) => trip.dispatch_order_id === selectedOrderId && trip.status === "완료") || null;
  const selectedOrderAllTrips = selectedOrder ? allTodayTrips.filter((trip) => trip.dispatch_order_id === selectedOrder.id) : [];
  const selectedOrderCompleted = selectedOrderAllTrips.filter((trip) => trip.status === "완료").length;
  const selectedOrderRemaining = selectedOrder ? Math.max(selectedOrder.estimated_trip_count - selectedOrderCompleted, 0) : 0;

  const isOrderCompleted = (order: DispatchOrder) => order.status === "완료";

  const selectedVehicle = activeTrip ? vehiclesById.get(activeTrip.vehicle_id) || null : selectedOrder ? vehiclesById.get(orderVehicleIds.get(selectedOrder.id)?.[0] || "") || vehicle : vehicle;
  const sortedTodayOrders = [...todayOrders].sort((left, right) => Number(isOrderCompleted(left)) - Number(isOrderCompleted(right)));

  useEffect(() => {
    if (activeTrip) setActualVolume(String(activeTrip.actual_volume));
    else if (selectedOrder) setActualVolume(String(selectedOrder.volume_per_trip));
  }, [activeTrip?.id, selectedOrder?.id]);

  const runTripAction = async (rpc: string, args: Record<string, unknown>, captureLocation = false) => {
    setSaving(true);
    setError("");
    let rpcName = rpc;
    let rpcArgs = args;
    if (captureLocation) {
      try {
        const location = await captureTripLocation();
        rpcName = rpc === "complete_dispatch_loading" ? "complete_dispatch_loading_with_location" : "complete_dispatch_unloading_with_location";
        rpcArgs = {
          ...args,
          p_latitude: location.latitude,
          p_longitude: location.longitude,
          p_accuracy_m: location.accuracy,
          p_address: location.address,
        };
      } catch (locationError) {
        setSaving(false);
        setError(locationError instanceof Error ? locationError.message : "현재 위치를 확인하지 못했습니다.");
        return;
      }
    }
    const { error: actionError } = await saveDriverTripAction(supabase, rpcName, rpcArgs);
    setSaving(false);
    if (actionError) {
      setError(actionError.message);
      return;
    }
    await loadOrders();
  };

  const chooseOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = todayOrders.find((item) => item.id === orderId);
    if (order) setActualVolume(String(order.volume_per_trip));
    setTab("input");
  };

  return (
    <div className="driver-mobile-app">
      {locationPermissionOpen && (
        <div className="driver-location-permission-backdrop" role="dialog" aria-modal="true" aria-label="운행 위치 권한 설정">
          <div className="driver-location-permission-card">
            <div className="driver-location-permission-icon">📍</div>
            <h2>운행 위치 권한 설정</h2>
            <p>상차완료·하차완료 시간을 정확한 위치와 함께 기록하기 위해 위치 권한이 필요합니다.</p>
            <p className="driver-location-permission-note">기사님 화면에는 주소나 좌표가 표시되지 않습니다.</p>
            {locationPermissionMessage && <div className="driver-location-permission-message">{locationPermissionMessage}</div>}
            <button type="button" onClick={requestInitialLocationPermission} disabled={locationPermissionBusy}>
              {locationPermissionBusy ? "위치 확인 중..." : "위치 허용하기"}
            </button>
          </div>
        </div>
      )}
      <header className="driver-mobile-header">
        <div><span>25.5T DUMP</span><h1>{driver.name} 기사님</h1><p>{selectedVehicle?.vehicle_number || "배정 차량 확인 필요"}</p></div>
        <button type="button" onClick={onLogout}>로그아웃</button>
      </header>

      <main className="driver-mobile-main">
        {error && <div className="driver-mobile-error">{error}</div>}
        {loading && <div className="driver-mobile-loading">자료를 불러오는 중...</div>}

        {!loading && tab === "today" && (
          <section>
            <div className="driver-mobile-title"><div><span>{dispatchToday()}</span><h2>오늘 배차</h2></div><button type="button" onClick={() => void loadOrders()}>새로고침</button></div>
            {!todayOrders.length ? <div className="driver-mobile-empty">오늘 배정된 배차가 없습니다.</div> : sortedTodayOrders.map((order) => {
              const orderTrips = allTodayTrips.filter((trip) => trip.dispatch_order_id === order.id);
              const orderVehicles = [...new Set([...(orderVehicleIds.get(order.id) || []), ...orderTrips.map((trip) => trip.vehicle_id)])];
              const completedTrips = orderTrips.filter((trip) => trip.status === "완료").length;
              const remainingTrips = Math.max(order.estimated_trip_count - completedTrips, 0);
              const myCompletedTrips = todayTrips.filter((trip) => trip.dispatch_order_id === order.id && trip.status === "완료" && koreaDate(trip.created_at) === dispatchToday()).length;
              const myActiveTrip = todayTrips.find((trip) => trip.dispatch_order_id === order.id && (trip.status === "상차대기" || trip.status === "진행중"));
              const orderCompleted = order.status === "완료";
              return <article className="driver-order-card" key={order.id}>
                <div className="driver-order-card-head"><span>{order.status}</span><strong>{order.vendor_name}</strong><em>{order.item_name}</em></div>
                <div className="driver-shared-progress">
                  <div><span>예정</span><strong>{order.estimated_trip_count}<small>회</small></strong></div>
                  <div><span>전체 완료</span><strong>{completedTrips}<small>회</small></strong></div>
                  <div className="remaining"><span>남은 회차</span><strong>{remainingTrips}<small>회</small></strong></div>
                </div>
                <p className="driver-shared-progress-note">배정된 모든 차량의 운행을 합산한 진행상황입니다. · 내 완료 {myCompletedTrips}회</p>
                <dl><div><dt>상차지</dt><dd>{order.loading_location}</dd></div><div><dt>하차지</dt><dd>{order.unloading_location}</dd></div><div><dt>예정 물량</dt><dd>{formatVolume(order.total_volume)}</dd></div><div><dt>차량</dt><dd>{orderVehicles.map((id) => vehiclesById.get(id)?.vehicle_number || "차량 확인 필요").join(" · ") || "-"}</dd></div></dl>
                {order.memo && <p className="driver-order-memo">{order.memo}</p>}
                <button type="button" className="driver-main-action" disabled={orderCompleted && !myActiveTrip} onClick={() => { if (!orderCompleted || myActiveTrip) chooseOrder(order.id); }}>{myActiveTrip ? "미완료 운행 계속" : orderCompleted ? "운행 완료" : "운행 입력"}</button>
              </article>;
            })}
          </section>
        )}

        {!loading && tab === "input" && (
          <section>
            <div className="driver-mobile-title"><div><span>운행 입력</span><h2>{selectedOrder ? `${selectedOrder.vendor_name} · ${selectedOrder.item_name}` : "배차를 선택하세요"}</h2></div></div>
            {!selectedOrder ? <div className="driver-mobile-empty"><p>오늘 배차에서 운행할 배차를 선택해 주세요.</p><button type="button" onClick={() => setTab("today")}>오늘 배차 보기</button></div> : <article className="driver-trip-card">
              <div className="driver-shared-progress driver-shared-progress-compact">
                <div><span>예정</span><strong>{selectedOrder.estimated_trip_count}<small>회</small></strong></div>
                <div><span>전체 완료</span><strong>{selectedOrderCompleted}<small>회</small></strong></div>
                <div className="remaining"><span>남은 회차</span><strong>{selectedOrderRemaining}<small>회</small></strong></div>
              </div>
              <dl><div><dt>상차 → 하차</dt><dd>{selectedOrder.loading_location} → {selectedOrder.unloading_location}</dd></div><div><dt>차량 / 기사</dt><dd>{selectedVehicle?.vehicle_number || "-"} / {driver.name}</dd></div><div><dt>기본 운송량</dt><dd>{formatVolume(selectedOrder.volume_per_trip)}</dd></div></dl>
              {activeTrip ? <>
                <div className="driver-trip-number">제 {activeTrip.trip_no}회 · {activeTrip.status}</div>
                <div className="driver-trip-times"><span>상차 {koreaTime(activeTrip.loading_completed_at)}</span><span>하차 {koreaTime(activeTrip.unloading_completed_at)}</span></div>
                {activeTrip.status === "상차대기" && <button type="button" className="driver-big-button loading" disabled={saving} onClick={() => void runTripAction("complete_dispatch_loading", { p_trip_id: activeTrip.id }, true)}>{saving ? "저장 중..." : "상차 완료"}</button>}
                {activeTrip.status === "진행중" && <><label className="driver-volume-input"><span>실제 운송량(루베)</span><input inputMode="decimal" value={actualVolume} onChange={(event) => setActualVolume(event.target.value)} /></label><button type="button" className="driver-big-button unloading" disabled={saving || !(Number(actualVolume) > 0)} onClick={() => void runTripAction("complete_dispatch_unloading", { p_trip_id: activeTrip.id, p_actual_volume: Number(actualVolume) }, true)}>{saving ? "저장 중..." : "하차 완료"}</button></>}
              </> : <>
                {latestCompletedTrip && <div className="driver-complete-notice">{latestCompletedTrip.trip_no}회 운행을 완료했습니다.</div>}
                <button type="button" className="driver-big-button start" disabled={saving || selectedOrder.status === "완료" || selectedOrder.status === "취소"} onClick={() => void runTripAction("start_dispatch_trip", { p_order_id: selectedOrder.id })}>{saving ? "시작 중..." : latestCompletedTrip ? "다음 운행 시작" : "운행 시작"}</button>
              </>}
            </article>}
          </section>
        )}

        {!loading && tab === "history" && (
          <section>
            <div className="driver-mobile-title"><div><span>나의 기록</span><h2>내 운행</h2></div><input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></div>
            {!historyTrips.length ? <div className="driver-mobile-empty">선택한 날짜의 운행기록이 없습니다.</div> : historyTrips.map((trip) => {
              const order = ordersById.get(trip.dispatch_order_id);
              return <article className="driver-history-card" key={trip.id}>
                <div><strong>{order?.vendor_name || "배차 확인 필요"}</strong><span>제 {trip.trip_no}회 · {trip.status}</span></div>
                <h3>{order?.item_name || "-"}</h3><p>{order ? `${order.loading_location} → ${order.unloading_location}` : "-"}</p>
                <dl><div><dt>날짜</dt><dd>{koreaDate(trip.created_at)}</dd></div><div><dt>차량</dt><dd>{vehiclesById.get(trip.vehicle_id)?.vehicle_number || "-"}</dd></div><div><dt>운송량</dt><dd>{formatVolume(trip.actual_volume)}</dd></div><div><dt>상차/하차</dt><dd>{koreaTime(trip.loading_completed_at)} / {koreaTime(trip.unloading_completed_at)}</dd></div></dl>
              </article>;
            })}
          </section>
        )}
      </main>

      <nav className="driver-mobile-nav">
        <button type="button" className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}><span>오늘</span>오늘 배차</button>
        <button type="button" className={tab === "input" ? "active" : ""} onClick={() => setTab("input")}><span>입력</span>운행 입력</button>
        <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><span>기록</span>내 운행</button>
      </nav>
    </div>
  );
}
