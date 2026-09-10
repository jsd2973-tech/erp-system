import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import type { DispatchDriver, DispatchTrip, DispatchVehicle } from "./dispatchTypes";
import { dispatchToday, formatVolume } from "./dispatchUtils";
import "./driverStatusDashboard.css";

type Props = { drivers: DispatchDriver[]; vehicles: DispatchVehicle[] };
type TodayOrder = { id: string; vendor_name: string; item_name: string; loading_location: string; unloading_location: string; status: string; vehicle_ids: string[] };
type DriverState = "운행중" | "상차대기" | "대기" | "운행 완료" | "미사용";

type DriverRow = {
  driver: DispatchDriver;
  mine: DispatchTrip[];
  completed: DispatchTrip[];
  state: DriverState;
  currentOrder: TodayOrder | null;
  lastText: string;
};

const nextDate = (date: string) => {
  const value = new Date(`${date}T12:00:00+09:00`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
};

const koreaTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
  : "-";

const stateRank: Record<DriverState, number> = { "운행중": 0, "상차대기": 1, "대기": 2, "운행 완료": 3, "미사용": 4 };

export default function DriverStatusDashboard({ drivers, vehicles }: Props) {
  const [trips, setTrips] = useState<DispatchTrip[]>([]);
  const [orders, setOrders] = useState<TodayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const today = dispatchToday();
    const tomorrow = nextDate(today);
    const [tripResult, orderResult, assignmentResult] = await Promise.all([
      supabase.from("dispatch_trips").select("*").gte("created_at", `${today}T00:00:00+09:00`).lt("created_at", `${tomorrow}T00:00:00+09:00`).order("created_at", { ascending: false }),
      supabase.from("dispatch_orders").select("id,vendor_name,item_name,loading_location,unloading_location,status").eq("dispatch_date", today).neq("status", "취소"),
      supabase.from("dispatch_order_vehicles").select("order_id,vehicle_id"),
    ]);
    const loadError = tripResult.error || orderResult.error || assignmentResult.error;
    if (loadError) {
      setError(`운행현황을 불러오지 못했습니다. (${loadError.message})`);
      setLoading(false);
      return;
    }

    const assignments = assignmentResult.data || [];
    setOrders((orderResult.data || []).map((row) => ({
      id: String(row.id),
      vendor_name: String(row.vendor_name || ""),
      item_name: String(row.item_name || ""),
      loading_location: String(row.loading_location || ""),
      unloading_location: String(row.unloading_location || ""),
      status: String(row.status || ""),
      vehicle_ids: assignments.filter((a) => String(a.order_id) === String(row.id)).map((a) => String(a.vehicle_id)),
    })));
    setTrips((tripResult.data || []).map((row) => ({
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
    setError("");
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 10000);
    const refresh = () => void load(true);
    const visibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load]);

  const rows = useMemo<DriverRow[]>(() => drivers.map((driver) => {
    const mine = trips.filter((trip) => trip.driver_id === driver.id);
    const completed = mine.filter((trip) => trip.status === "완료");
    const active = mine.find((trip) => trip.status === "상차대기" || trip.status === "진행중") || null;
    const assigned = driver.assigned_vehicle_id ? orders.filter((order) => order.vehicle_ids.includes(driver.assigned_vehicle_id!)) : [];
    const currentOrder = active
      ? orders.find((order) => order.id === active.dispatch_order_id) || null
      : assigned.find((order) => order.status !== "완료") || assigned[0] || null;
    const allDone = assigned.length > 0 && assigned.every((order) => order.status === "완료");

    let state: DriverState = "대기";
    if (!driver.active) state = "미사용";
    else if (active?.status === "진행중") state = "운행중";
    else if (active?.status === "상차대기") state = "상차대기";
    else if (allDone) state = "운행 완료";

    const last = mine[0] || null;
    const lastAt = last?.unloading_completed_at || last?.loading_completed_at || last?.created_at;
    const lastText = !last
      ? "오늘 활동 없음"
      : last.status === "완료"
        ? `${koreaTime(lastAt)} 하차완료`
        : last.status === "진행중"
          ? `${koreaTime(lastAt)} 상차완료`
          : `${koreaTime(lastAt)} 운행시작`;

    return { driver, mine, completed, state, currentOrder, lastText };
  }).sort((a, b) => stateRank[a.state] - stateRank[b.state] || a.driver.name.localeCompare(b.driver.name, "ko-KR")), [drivers, orders, trips]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedDriverId("");
      return;
    }
    if (!selectedDriverId || !rows.some((row) => row.driver.id === selectedDriverId)) {
      setSelectedDriverId(rows[0].driver.id);
    }
  }, [rows, selectedDriverId]);

  const selectedRow = rows.find((row) => row.driver.id === selectedDriverId) || rows[0] || null;

  const groupedTrips = useMemo(() => {
    if (!selectedRow) return [];
    const groupMap = new Map<string, DispatchTrip[]>();
    selectedRow.mine.forEach((trip) => {
      const list = groupMap.get(trip.dispatch_order_id) || [];
      list.push(trip);
      groupMap.set(trip.dispatch_order_id, list);
    });

    return [...groupMap.entries()].map(([orderId, groupTrips]) => ({
      orderId,
      order: orderById.get(orderId) || null,
      trips: [...groupTrips].sort((a, b) => a.trip_no - b.trip_no || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      firstAt: Math.min(...groupTrips.map((trip) => new Date(trip.created_at).getTime() || Number.MAX_SAFE_INTEGER)),
    })).sort((a, b) => a.firstAt - b.firstAt);
  }, [selectedRow, orderById]);

  const summary = useMemo(() => ({
    total: drivers.filter((d) => d.active).length,
    running: rows.filter((r) => r.state === "운행중" || r.state === "상차대기").length,
    waiting: rows.filter((r) => r.state === "대기").length,
    trips: trips.filter((t) => t.status === "완료").length,
    volume: trips.filter((t) => t.status === "완료").reduce((sum, t) => sum + (Number.isFinite(t.actual_volume) ? t.actual_volume : 0), 0),
  }), [drivers, rows, trips]);

  const selectedVolume = selectedRow?.completed.reduce((sum, trip) => sum + (Number.isFinite(trip.actual_volume) ? trip.actual_volume : 0), 0) || 0;

  return <section className="driver-status-dashboard">
    <div className="driver-status-head">
      <div>
        <span className="driver-status-eyebrow">LIVE DRIVER CONTROL · {dispatchToday()}</span>
        <h2>운행현황</h2>
        <p>왼쪽에서 기사를 선택하면 오른쪽에서 현재 배차와 오늘 운행내역을 확인할 수 있습니다.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "확인 중..." : "새로고침"}</button>
    </div>

    <div className="driver-status-kpis">
      <div className="kpi-total"><span>전체 기사</span><strong>{summary.total}<small>명</small></strong></div>
      <div className="kpi-running"><span>운행중</span><strong>{summary.running}<small>명</small></strong></div>
      <div className="kpi-waiting"><span>대기</span><strong>{summary.waiting}<small>명</small></strong></div>
      <div className="kpi-trips"><span>오늘 총 운행</span><strong>{summary.trips}<small>회</small></strong></div>
      <div className="kpi-volume"><span>오늘 총 운송량</span><strong>{formatVolume(summary.volume)}</strong></div>
    </div>

    <div className="driver-status-live"><i />실시간 자동 갱신 · 10초{updatedAt ? ` · ${koreaTime(updatedAt.toISOString())} 기준` : ""}</div>
    {error && <div className="driver-status-error">{error}</div>}

    <div className="driver-status-workspace">
      <aside className="driver-master-panel">
        <div className="driver-master-head">
          <strong>기사 목록</strong>
          <span>{rows.length}명</span>
        </div>
        <div className="driver-master-list">
          {rows.map((row) => {
            const vehicleNumber = row.driver.assigned_vehicle_id
              ? vehicleById.get(row.driver.assigned_vehicle_id)?.vehicle_number || "차량 확인 필요"
              : "차량 미지정";
            const isSelected = selectedRow?.driver.id === row.driver.id;
            return <button
              key={row.driver.id}
              type="button"
              className={`driver-master-item ${isSelected ? "selected" : ""}`}
              onClick={() => setSelectedDriverId(row.driver.id)}
            >
              <span className={`driver-master-state state-${row.state.replace(/\s/g, "-")}`}><i /></span>
              <span className="driver-master-identity">
                <strong>{row.driver.name}</strong>
                <small>{vehicleNumber}</small>
              </span>
              <span className="driver-master-summary">
                <b>{row.state}</b>
                <small>{row.completed.length}회</small>
              </span>
            </button>;
          })}
        </div>
      </aside>

      <main className="driver-detail-panel">
        {!selectedRow ? <div className="driver-detail-empty">등록된 기사가 없습니다.</div> : <>
          <div className="driver-detail-hero">
            <div className="driver-detail-person">
              <span className="driver-detail-avatar">{selectedRow.driver.name.trim().slice(0, 1) || "기"}</span>
              <div>
                <div className="driver-detail-name-line">
                  <h3>{selectedRow.driver.name}</h3>
                  <span className={`driver-state state-${selectedRow.state.replace(/\s/g, "-")}`}><i />{selectedRow.state}</span>
                </div>
                <p>{selectedRow.driver.assigned_vehicle_id ? vehicleById.get(selectedRow.driver.assigned_vehicle_id)?.vehicle_number || "차량 확인 필요" : "차량 미지정"}</p>
              </div>
            </div>
            <div className="driver-detail-last"><span>마지막 활동</span><strong>{selectedRow.lastText}</strong></div>
          </div>

          <div className="driver-detail-current">
            <span>현재 배차</span>
            <strong>{selectedRow.currentOrder ? `${selectedRow.currentOrder.vendor_name} · ${selectedRow.currentOrder.item_name}` : "현재 배차 없음"}</strong>
            {selectedRow.currentOrder && <em>{selectedRow.currentOrder.loading_location || "상차지 미지정"} <b>→</b> {selectedRow.currentOrder.unloading_location || "하차지 미지정"}</em>}
          </div>

          <div className="driver-detail-stats">
            <div><span>오늘 완료</span><strong>{selectedRow.completed.length}<small>회</small></strong></div>
            <div><span>오늘 운송량</span><strong>{formatVolume(selectedVolume)}</strong></div>
            <div><span>오늘 전체 기록</span><strong>{selectedRow.mine.length}<small>회</small></strong></div>
          </div>

          <section className="driver-trip-history driver-trip-history-detail">
            <div className="driver-trip-history-head">
              <div><strong>오늘의 운행내역</strong><p>배차별로 묶고 각 배차 안에서 1회차부터 순서대로 표시합니다.</p></div>
              <span>총 {selectedRow.mine.length}회 기록</span>
            </div>

            {!groupedTrips.length ? <div className="driver-trip-empty">오늘 등록된 운행내역이 없습니다.</div> : <div className="driver-trip-groups">
              {groupedTrips.map((group, groupIndex) => <section key={group.orderId} className="driver-trip-group">
                <div className="driver-trip-group-head">
                  <div>
                    <span>배차 {groupIndex + 1}</span>
                    <strong>{group.order ? `${group.order.vendor_name} · ${group.order.item_name}` : "배차 정보 확인 필요"}</strong>
                  </div>
                  <p>{group.order ? `${group.order.loading_location || "상차지 미지정"} → ${group.order.unloading_location || "하차지 미지정"}` : "-"}</p>
                </div>
                <div className="driver-trip-list">
                  {group.trips.map((trip) => {
                    const start = koreaTime(trip.created_at);
                    const loadingTime = koreaTime(trip.loading_completed_at);
                    const unloading = koreaTime(trip.unloading_completed_at);
                    return <div key={trip.id} className="driver-trip-row">
                      <div className="driver-trip-no"><strong>{trip.trip_no}회차</strong><span className={`trip-status trip-${trip.status}`}>{trip.status}</span></div>
                      <div className="driver-trip-info">
                        <span>시작 <b>{start}</b></span>
                        <span>상차 <b>{loadingTime}</b></span>
                        <span>하차 <b>{unloading}</b></span>
                      </div>
                      <div className="driver-trip-volume">{trip.status === "완료" ? formatVolume(trip.actual_volume) : "-"}</div>
                    </div>;
                  })}
                </div>
              </section>)}
            </div>}
          </section>
        </>}
      </main>
    </div>
  </section>;
}
