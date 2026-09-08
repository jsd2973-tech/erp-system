import { useMemo, useState } from "react";
import DispatchDetail from "./DispatchDetail";
import type { DispatchDriver, DispatchFilters, DispatchOrderWithVehicles, DispatchTrip, DispatchVehicle } from "./dispatchTypes";
import { DISPATCH_STATUSES } from "./dispatchTypes";
import { dispatchStatusClass, formatVolume } from "./dispatchUtils";

type DispatchListProps = {
  orders: DispatchOrderWithVehicles[];
  vehicles: DispatchVehicle[];
  drivers: DispatchDriver[];
  trips: DispatchTrip[];
  onEdit: (order: DispatchOrderWithVehicles) => void;
  compact?: boolean;
};

const emptyFilters: DispatchFilters = { from: "", to: "", vendor: "", item: "", status: "" };

export default function DispatchList({ orders, vehicles, drivers, trips, onEdit, compact = false }: DispatchListProps) {
  const [filters, setFilters] = useState<DispatchFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState("");

  const filtered = useMemo(() => orders.filter((order) =>
    (!filters.from || order.dispatch_date >= filters.from)
    && (!filters.to || order.dispatch_date <= filters.to)
    && (!filters.vendor || order.vendor_name.includes(filters.vendor.trim()))
    && (!filters.item || order.item_name.includes(filters.item.trim()))
    && (!filters.status || order.status === filters.status)
  ).slice(0, compact ? 8 : undefined), [orders, filters, compact]);
  const selectedOrder = orders.find((order) => order.id === selectedId);

  return (
    <section className="dispatch-panel dispatch-list-panel">
      <div className="dispatch-section-head"><div><h2>{compact ? "최근 배차" : "배차목록"}</h2><p>최신 배차부터 확인할 수 있습니다.</p></div><span className="dispatch-count">{filtered.length}건</span></div>
      {!compact && <div className="dispatch-filter-grid">
        <label><span>시작일</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label><span>종료일</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
        <label><span>거래처</span><input value={filters.vendor} onChange={(event) => setFilters({ ...filters, vendor: event.target.value })} placeholder="거래처 검색" /></label>
        <label><span>품목</span><input value={filters.item} onChange={(event) => setFilters({ ...filters, item: event.target.value })} placeholder="품목 검색" /></label>
        <label><span>상태</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as DispatchFilters["status"] })}><option value="">전체</option>{DISPATCH_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <button type="button" onClick={() => setFilters(emptyFilters)}>초기화</button>
      </div>}
      <div className="dispatch-table-wrap">
        <table className="dispatch-table dispatch-order-table">
          <thead><tr><th>날짜</th><th>거래처</th><th>품목</th><th>총 물량</th><th>1대 기준</th><th>예상</th><th>배정</th><th>상태</th><th>메모</th></tr></thead>
          <tbody>
            {!filtered.length ? <tr><td colSpan={9} className="dispatch-empty">조건에 맞는 배차가 없습니다.</td></tr> : filtered.map((order) => (
              <tr key={order.id} className={selectedId === order.id ? "selected" : ""} onClick={() => setSelectedId(order.id)}>
                <td>{order.dispatch_date}</td><td className="dispatch-strong">{order.vendor_name}</td><td>{order.item_name}</td><td>{formatVolume(order.total_volume)}</td><td>{formatVolume(order.volume_per_trip)}</td><td>{order.estimated_trip_count}대</td><td>{order.vehicle_ids.length}대</td><td><span className={`dispatch-status ${dispatchStatusClass(order.status)}`}>{order.status}</span></td><td>{order.memo || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedOrder && <DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={trips.filter((trip) => trip.dispatch_order_id === selectedOrder.id)} onEdit={onEdit} onClose={() => setSelectedId("")} />}
    </section>
  );
}
