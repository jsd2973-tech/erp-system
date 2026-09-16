import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchView } from "./dispatchTypes";
import { dispatchToday, formatVolume } from "./dispatchUtils";
import "./dispatchManagerDashboard.css";

type Props = {
  supabase: SupabaseClient;
  onNavigate: (view: DispatchView) => void;
};

type OrderRow = {
  id: string;
  vendor_name: string;
  item_name: string;
  total_volume: number;
  estimated_trip_count: number;
  status: string;
};

type TripRow = {
  id: string;
  dispatch_order_id: string;
  vehicle_id: string;
  actual_volume: number;
  status: string;
};

export default function DispatchManagerDashboard({ supabase, onNavigate }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const today = dispatchToday();
    const orderResult = await supabase
      .from("dispatch_orders")
      .select("id,vendor_name,item_name,total_volume,estimated_trip_count,status")
      .eq("dispatch_date", today)
      .neq("status", "취소")
      .order("created_at", { ascending: true });

    if (orderResult.error) {
      setError(`오늘 배차를 불러오지 못했습니다. (${orderResult.error.message})`);
      setLoading(false);
      return;
    }

    const nextOrders = (orderResult.data || []).map((row) => ({
      id: String(row.id),
      vendor_name: String(row.vendor_name || ""),
      item_name: String(row.item_name || ""),
      total_volume: Number(row.total_volume || 0),
      estimated_trip_count: Number(row.estimated_trip_count || 0),
      status: String(row.status || ""),
    }));
    setOrders(nextOrders);

    const orderIds = nextOrders.map((row) => row.id);
    if (!orderIds.length) {
      setTrips([]);
      setLoading(false);
      return;
    }

    const tripResult = await supabase
      .from("dispatch_trips")
      .select("id,dispatch_order_id,vehicle_id,actual_volume,status")
      .in("dispatch_order_id", orderIds);

    if (tripResult.error) {
      setError(`오늘 운행을 불러오지 못했습니다. (${tripResult.error.message})`);
      setLoading(false);
      return;
    }

    setTrips((tripResult.data || []).map((row) => ({
      id: String(row.id),
      dispatch_order_id: String(row.dispatch_order_id),
      vehicle_id: String(row.vehicle_id),
      actual_volume: Number(row.actual_volume || 0),
      status: String(row.status || ""),
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const stats = useMemo(() => {
    const completedTrips = trips.filter((trip) => trip.status === "완료");
    const activeTrips = trips.filter((trip) => trip.status === "진행중" || trip.status === "상차대기");
    const activeVehicles = new Set(activeTrips.map((trip) => trip.vehicle_id).filter(Boolean)).size;
    const completedVolume = completedTrips.reduce((sum, trip) => sum + trip.actual_volume, 0);
    const plannedVolume = orders.reduce((sum, order) => sum + order.total_volume, 0);
    const plannedTrips = orders.reduce((sum, order) => sum + order.estimated_trip_count, 0);
    return {
      orderCount: orders.length,
      activeVehicles,
      completedTrips: completedTrips.length,
      plannedTrips,
      completedVolume,
      remainingVolume: Math.max(plannedVolume - completedVolume, 0),
    };
  }, [orders, trips]);

  const progress = stats.plannedTrips > 0 ? Math.min((stats.completedTrips / stats.plannedTrips) * 100, 100) : 0;

  return (
    <section className="dispatch-manager-dashboard">
      <div className="dispatch-manager-hero">
        <div>
          <span>DISPATCH CONTROL</span>
          <h1>오늘 운행관리</h1>
          <p>{dispatchToday()} · 오늘 배차와 진행상황을 한눈에 확인합니다.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "조회 중" : "새로고침"}</button>
      </div>

      {error && <div className="dispatch-manager-error">{error}</div>}

      <div className="dispatch-manager-kpis">
        <button type="button" onClick={() => onNavigate("dispatch_list")}><span>오늘 배차</span><strong>{stats.orderCount}<em>건</em></strong></button>
        <button type="button" onClick={() => onNavigate("dispatch_status")}><span>진행 중 차량</span><strong>{stats.activeVehicles}<em>대</em></strong></button>
        <button type="button" onClick={() => onNavigate("dispatch_status")}><span>완료 회차</span><strong>{stats.completedTrips}<em>회</em></strong><small>예정 {stats.plannedTrips}회</small></button>
        <button type="button" onClick={() => onNavigate("dispatch_results")}><span>오늘 운송량</span><strong>{formatVolume(stats.completedVolume)}</strong></button>
        <button type="button" onClick={() => onNavigate("dispatch_status")}><span>잔여 물량</span><strong>{formatVolume(stats.remainingVolume)}</strong></button>
      </div>

      <div className="dispatch-manager-progress-card">
        <div><strong>오늘 운행 진행률</strong><span>{Math.round(progress)}%</span></div>
        <div className="dispatch-manager-progress"><i style={{ width: `${progress}%` }} /></div>
        <p>{stats.completedTrips}회 완료 · {Math.max(stats.plannedTrips - stats.completedTrips, 0)}회 남음</p>
      </div>

      <div className="dispatch-manager-actions">
        <button type="button" onClick={() => onNavigate("dispatch_register")}><strong>배차등록</strong><span>오늘 배차 추가·수정</span></button>
        <button type="button" onClick={() => onNavigate("dispatch_status")}><strong>운행현황</strong><span>차량별 진행·잔여 확인</span></button>
        <button type="button" onClick={() => onNavigate("dispatch_list")}><strong>배차목록</strong><span>배차 상세·완료내역 확인</span></button>
        <button type="button" onClick={() => onNavigate("dispatch_results")}><strong>운송실적</strong><span>일자·품목·거래처 실적</span></button>
      </div>

      {!loading && orders.length === 0 && <div className="dispatch-manager-empty">오늘 등록된 배차가 없습니다. 배차등록에서 오늘 배차를 추가해 주세요.</div>}
    </section>
  );
}
