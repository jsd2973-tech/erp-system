import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchDriver, DispatchOrder, DispatchTrip, DispatchVehicle } from "./dispatchTypes";
import { dispatchToday, formatVolume } from "./dispatchUtils";
import "./driverMobile.css";

type DriverTab = "today" | "input" | "history";

type DriverMobileAppProps = {
  supabase: SupabaseClient;
  driver: DispatchDriver;
  onLogout: () => void;
};

const nextDate = (date: string) => {
  const value = new Date(`${date}T12:00:00+09:00`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
};

const koreaDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value))
  : "";

const koreaTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
  : "-";

const normalizeTrip = (row: Record<string, unknown>): DispatchTrip => ({
  id: String(row.id),
  dispatch_order_id: String(row.dispatch_order_id),
  vehicle_id: String(row.vehicle_id),
  driver_id: String(row.driver_id),
  trip_no: Number(row.trip_no || 0),
  actual_volume: Number(row.actual_volume || 0),
  status: row.status as DispatchTrip["status"],
  loading_completed_at: row.loading_completed_at ? String(row.loading_completed_at) : null,
  unloading_completed_at: row.unloading_completed_at ? String(row.unloading_completed_at) : null,
  created_at: String(row.created_at || ""),
  updated_at: row.updated_at ? String(row.updated_at) : undefined,
});

const normalizeOrder = (row: Record<string, unknown>): DispatchOrder => ({
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
  status: row.status as DispatchOrder["status"],
  memo: String(row.memo || ""),
  created_at: row.created_at ? String(row.created_at) : undefined,
});

export default function DriverMobileApp({ supabase, driver, onLogout }: DriverMobileAppProps) {
  const [tab, setTab] = useState<DriverTab>("today");
  const [todayOrders, setTodayOrders] = useState<DispatchOrder[]>([]);
  const [todayTrips, setTodayTrips] = useState<DispatchTrip[]>([]);
  const [allTodayTrips, setAllTodayTrips] = useState<DispatchTrip[]>([]);
  const [historyTrips, setHistoryTrips] = useState<DispatchTrip[]>([]);
  const [ordersById, setOrdersById] = useState<Map<string, DispatchOrder>>(new Map());
  const [vehicle, setVehicle] = useState<DispatchVehicle | null>(null);
  const [vehiclesById, setVehiclesById] = useState<Map<string, DispatchVehicle>>(new Map());
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [actualVolume, setActualVolume] = useState("17");
  const [historyDate, setHistoryDate] = useState(dispatchToday);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    const vehicleId = driver.assigned_vehicle_id;
    if (!vehicleId) {
      setVehicle(null);
      setTodayOrders([]);
      setTodayTrips([]);
      setAllTodayTrips([]);
      setLoading(false);
      return;
    }

    const [vehicleResult, assignmentResult, tripResult] = await Promise.all([
      supabase.from("dispatch_vehicles").select("*").eq("id", vehicleId).maybeSingle(),
      supabase.from("dispatch_order_vehicles").select("order_id").eq("vehicle_id", vehicleId),
      supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).gte("created_at", `${dispatchToday()}T00:00:00+09:00`).lt("created_at", `${nextDate(dispatchToday())}T00:00:00+09:00`).order("created_at", { ascending: false }),
    ]);
    const loadError = vehicleResult.error || assignmentResult.error || tripResult.error;
    if (loadError) {
      setError(`배차 정보를 불러오지 못했습니다. (${loadError.message})`);
      setLoading(false);
      return;
    }

    const orderIds = (assignmentResult.data || []).map((row) => String(row.order_id));
    const orderResult = orderIds.length
      ? await supabase.from("dispatch_orders").select("*").in("id", orderIds).eq("dispatch_date", dispatchToday()).neq("status", "취소").order("created_at", { ascending: true })
      : { data: [], error: null };
    if (orderResult.error) {
      setError(`오늘 배차를 불러오지 못했습니다. (${orderResult.error.message})`);
      setLoading(false);
      return;
    }

    const nextOrders = (orderResult.data || []).map((row) => normalizeOrder(row));
    const todayOrderIds = nextOrders.map((order) => order.id);
    const allTripResult = todayOrderIds.length
      ? await supabase.from("dispatch_trips").select("*").in("dispatch_order_id", todayOrderIds).order("created_at", { ascending: false })
      : { data: [], error: null };
    if (allTripResult.error) {
      setError(`전체 운행 진행상황을 불러오지 못했습니다. (${allTripResult.error.message})`);
      setLoading(false);
      return;
    }

    const nextVehicle = vehicleResult.data ? { ...vehicleResult.data, id: String(vehicleResult.data.id), vehicle_number: String(vehicleResult.data.vehicle_number || ""), active: vehicleResult.data.active !== false, memo: String(vehicleResult.data.memo || "") } as DispatchVehicle : null;
    setVehicle(nextVehicle);
    if (nextVehicle) setVehiclesById((current) => new Map(current).set(nextVehicle.id, nextVehicle));
    setTodayOrders(nextOrders);
    setTodayTrips((tripResult.data || []).map((row) => normalizeTrip(row)));
    setAllTodayTrips((allTripResult.data || []).map((row) => normalizeTrip(row)));
    setOrdersById((current) => new Map([...current, ...nextOrders.map((order) => [order.id, order] as const)]));
    setLoading(false);
  }, [driver.assigned_vehicle_id, driver.id, supabase]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    const tripResult = await supabase.from("dispatch_trips").select("*").eq("driver_id", driver.id).gte("created_at", `${historyDate}T00:00:00+09:00`).lt("created_at", `${nextDate(historyDate)}T00:00:00+09:00`).order("created_at", { ascending: false });
    if (tripResult.error) {
      setError(`운행기록을 불러오지 못했습니다. (${tripResult.error.message})`);
      setLoading(false);
      return;
    }
    const trips = (tripResult.data || []).map((row) => normalizeTrip(row));
    const orderIds = [...new Set(trips.map((trip) => trip.dispatch_order_id))];
    const vehicleIds = [...new Set(trips.map((trip) => trip.vehicle_id))];
    const [orderResult, vehicleResult] = await Promise.all([
      orderIds.length ? supabase.from("dispatch_orders").select("*").in("id", orderIds) : Promise.resolve({ data: [], error: null }),
      vehicleIds.length ? supabase.from("dispatch_vehicles").select("*").in("id", vehicleIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (orderResult.error || vehicleResult.error) {
      setError(`운행 상세를 불러오지 못했습니다. (${(orderResult.error || vehicleResult.error)?.message})`);
      setLoading(false);
      return;
    }
    const historyOrders = (orderResult.data || []).map((row) => normalizeOrder(row));
    setHistoryTrips(trips);
    setOrdersById((current) => new Map([...current, ...historyOrders.map((order) => [order.id, order] as const)]));
    setVehiclesById((current) => new Map([...current, ...(vehicleResult.data || []).map((row) => [String(row.id), { ...row, id: String(row.id), vehicle_number: String(row.vehicle_number || ""), active: row.active !== false, memo: String(row.memo || "") } as DispatchVehicle] as const)]));
    setLoading(false);
  }, [driver.id, historyDate, supabase]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);
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

  useEffect(() => {
    if (activeTrip) setActualVolume(String(activeTrip.actual_volume));
    else if (selectedOrder) setActualVolume(String(selectedOrder.volume_per_trip));
  }, [activeTrip?.id, selectedOrder?.id]);

  const runTripAction = async (rpc: string, args: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    const { error: actionError } = await supabase.rpc(rpc, args);
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
      <header className="driver-mobile-header">
        <div><span>25.5T DUMP</span><h1>{driver.name} 기사님</h1><p>{vehicle?.vehicle_number || "담당 차량 미지정"}</p></div>
        <button type="button" onClick={onLogout}>로그아웃</button>
      </header>

      <main className="driver-mobile-main">
        {error && <div className="driver-mobile-error">{error}</div>}
        {loading && <div className="driver-mobile-loading">자료를 불러오는 중...</div>}

        {!loading && tab === "today" && (
          <section>
            <div className="driver-mobile-title"><div><span>{dispatchToday()}</span><h2>오늘 배차</h2></div><button type="button" onClick={() => void loadOrders()}>새로고침</button></div>
            {!driver.assigned_vehicle_id ? <div className="driver-mobile-empty">관리자가 담당 차량을 지정해야 합니다.</div> : !todayOrders.length ? <div className="driver-mobile-empty">오늘 배정된 배차가 없습니다.</div> : todayOrders.map((order) => {
              const orderTrips = allTodayTrips.filter((trip) => trip.dispatch_order_id === order.id);
              const completedTrips = orderTrips.filter((trip) => trip.status === "완료").length;
              const remainingTrips = Math.max(order.estimated_trip_count - completedTrips, 0);
              const myCompletedTrips = todayTrips.filter((trip) => trip.dispatch_order_id === order.id && trip.status === "완료").length;
              const orderCompleted = order.status === "완료" || remainingTrips <= 0;
              return <article className="driver-order-card" key={order.id}>
                <div className="driver-order-card-head"><span>{order.status}</span><strong>{order.vendor_name}</strong><em>{order.item_name}</em></div>
                <div className="driver-shared-progress">
                  <div><span>예정</span><strong>{order.estimated_trip_count}<small>회</small></strong></div>
                  <div><span>전체 완료</span><strong>{completedTrips}<small>회</small></strong></div>
                  <div className="remaining"><span>남은 회차</span><strong>{remainingTrips}<small>회</small></strong></div>
                </div>
                <p className="driver-shared-progress-note">배정된 모든 차량의 운행을 합산한 진행상황입니다. · 내 완료 {myCompletedTrips}회</p>
                <dl><div><dt>상차지</dt><dd>{order.loading_location}</dd></div><div><dt>하차지</dt><dd>{order.unloading_location}</dd></div><div><dt>예정 물량</dt><dd>{formatVolume(order.total_volume)}</dd></div><div><dt>차량</dt><dd>{vehicle?.vehicle_number || "-"}</dd></div></dl>
                {order.memo && <p className="driver-order-memo">{order.memo}</p>}
                <button type="button" className="driver-main-action" disabled={orderCompleted} onClick={() => { if (!orderCompleted) chooseOrder(order.id); }}>{orderCompleted ? "운행 완료" : "운행 입력"}</button>
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
              <dl><div><dt>상차 → 하차</dt><dd>{selectedOrder.loading_location} → {selectedOrder.unloading_location}</dd></div><div><dt>차량 / 기사</dt><dd>{vehicle?.vehicle_number || "-"} / {driver.name}</dd></div><div><dt>기본 운송량</dt><dd>{formatVolume(selectedOrder.volume_per_trip)}</dd></div></dl>
              {activeTrip ? <>
                <div className="driver-trip-number">제 {activeTrip.trip_no}회 · {activeTrip.status}</div>
                <div className="driver-trip-times"><span>상차 {koreaTime(activeTrip.loading_completed_at)}</span><span>하차 {koreaTime(activeTrip.unloading_completed_at)}</span></div>
                {activeTrip.status === "상차대기" && <button type="button" className="driver-big-button loading" disabled={saving} onClick={() => void runTripAction("complete_dispatch_loading", { p_trip_id: activeTrip.id })}>{saving ? "저장 중..." : "상차 완료"}</button>}
                {activeTrip.status === "진행중" && <><label className="driver-volume-input"><span>실제 운송량(루베)</span><input inputMode="decimal" value={actualVolume} onChange={(event) => setActualVolume(event.target.value)} /></label><button type="button" className="driver-big-button unloading" disabled={saving || !(Number(actualVolume) > 0)} onClick={() => void runTripAction("complete_dispatch_unloading", { p_trip_id: activeTrip.id, p_actual_volume: Number(actualVolume) })}>{saving ? "저장 중..." : "하차 완료"}</button></>}
              </> : <>
                {latestCompletedTrip && <div className="driver-complete-notice">{latestCompletedTrip.trip_no}회 운행을 완료했습니다.</div>}
                <button type="button" className="driver-big-button start" disabled={saving || selectedOrder.status === "완료" || selectedOrder.status === "취소" || selectedOrderRemaining <= 0} onClick={() => void runTripAction("start_dispatch_trip", { p_order_id: selectedOrder.id })}>{saving ? "시작 중..." : selectedOrderRemaining <= 0 ? "전체 운행 완료" : latestCompletedTrip ? "다음 운행 시작" : "운행 시작"}</button>
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
