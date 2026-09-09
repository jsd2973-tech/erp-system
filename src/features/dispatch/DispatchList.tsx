import { useMemo, useState } from "react";
import DispatchDetail, { DispatchTripHistory } from "./DispatchDetail";
import type { DispatchDriver, DispatchFilters, DispatchOrderWithVehicles, DispatchTrip, DispatchVehicle } from "./dispatchTypes";
import { DISPATCH_STATUSES } from "./dispatchTypes";
import { dispatchStatusClass, formatVolume } from "./dispatchUtils";

type DispatchListProps = {
  orders: DispatchOrderWithVehicles[];
  vehicles: DispatchVehicle[];
  drivers: DispatchDriver[];
  trips: DispatchTrip[];
  onEdit: (order: DispatchOrderWithVehicles) => void;
  onDelete?: (order: DispatchOrderWithVehicles) => Promise<boolean>;
  deletingOrderId?: string;
  compact?: boolean;
};

const emptyFilters: DispatchFilters = { from: "", to: "", vendor: "", item: "", status: "" };

export default function DispatchList({ orders, vehicles, drivers, trips, onEdit, onDelete, deletingOrderId = "", compact = false }: DispatchListProps) {
  const [filters, setFilters] = useState<DispatchFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState("");

  const filtered = useMemo(() => orders.filter((order) =>
    (!filters.from || order.dispatch_date >= filters.from)
    && (!filters.to || order.dispatch_date <= filters.to)
    && (!filters.vendor || order.vendor_name.includes(filters.vendor.trim()))
    && (!filters.item || order.item_name.includes(filters.item.trim()))
    && (!filters.status || order.status === filters.status)
  ).slice(0, compact ? 8 : undefined), [orders, filters, compact]);

  const selectedOrder = orders.find((order) => order.id === selectedId) || (!compact ? filtered[0] : undefined);
  const selectedTrips = selectedOrder ? trips.filter((trip) => trip.dispatch_order_id === selectedOrder.id) : [];

  const requestDelete = async (order: DispatchOrderWithVehicles) => {
    if (!onDelete) return;
    const tripCount = trips.filter((trip) => trip.dispatch_order_id === order.id).length;
    const confirmed = window.confirm(
      `${order.dispatch_date} / ${order.vendor_name} / ${order.item_name} 배차를 삭제할까요?\n\n연결된 운행기록 ${tripCount}건도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;
    const deleted = await onDelete(order);
    if (deleted && selectedId === order.id) setSelectedId("");
  };

  const listPanel = <section className="dispatch-panel dispatch-list-panel">
    <div className="dispatch-section-head">
      <div><h2>{compact ? "최근 배차" : "배차 조회"}</h2><p>{compact ? "최근 등록된 배차를 확인합니다." : "조건으로 배차를 찾고 행을 선택해 상세와 운행기록을 확인합니다."}</p></div>
      <span className="dispatch-count">총 {filtered.length}건</span>
    </div>
    {!compact && <div className="dispatch-filter-grid">
      <label><span>시작일</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
      <label><span>종료일</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      <label><span>거래처</span><input value={filters.vendor} onChange={(event) => setFilters({ ...filters, vendor: event.target.value })} placeholder="거래처 검색" /></label>
      <label><span>품목</span><input value={filters.item} onChange={(event) => setFilters({ ...filters, item: event.target.value })} placeholder="품목 검색" /></label>
      <label><span>상태</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as DispatchFilters["status"] })}><option value="">전체 상태</option>{DISPATCH_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      <button type="button" className="dispatch-filter-reset" onClick={() => setFilters(emptyFilters)}>초기화</button>
    </div>}
    <div className="dispatch-table-wrap">
      <table className="dispatch-table dispatch-order-table">
        <thead><tr><th>No</th><th>상태</th><th>날짜</th><th>거래처</th><th>품목</th><th>총 물량</th><th>1회 기준</th><th>예정 회차</th><th>배정 차량</th><th>메모</th><th>작업</th></tr></thead>
        <tbody>
          {!filtered.length ? <tr><td colSpan={11} className="dispatch-empty">조건에 맞는 배차가 없습니다.</td></tr> : filtered.map((order, index) => (
            <tr key={order.id} className={selectedOrder?.id === order.id ? "selected" : ""} onClick={() => setSelectedId(order.id)}>
              <td className="dispatch-count-cell">{index + 1}</td>
              <td><span className={`dispatch-status ${dispatchStatusClass(order.status)}`}>{order.status}</span></td>
              <td className="dispatch-date-cell">{order.dispatch_date}</td>
              <td className="dispatch-strong">{order.vendor_name}</td>
              <td className="dispatch-item-cell">{order.item_name}</td>
              <td className="dispatch-number-cell">{formatVolume(order.total_volume)}</td>
              <td className="dispatch-number-cell">{formatVolume(order.volume_per_trip)}</td>
              <td className="dispatch-count-cell">{order.estimated_trip_count}회</td>
              <td className="dispatch-count-cell">{order.vehicle_ids.length}대</td>
              <td className="dispatch-memo-cell" title={order.memo || ""}>{order.memo || "-"}</td>
              <td>
                <div className="dispatch-row-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(order.id); }}>상세보기</button>
                  {!compact && onDelete && <button type="button" className="dispatch-delete-button" disabled={deletingOrderId === order.id} onClick={(event) => { event.stopPropagation(); void requestDelete(order); }}>{deletingOrderId === order.id ? "삭제 중..." : "삭제"}</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>;

  if (compact) return <div className="dispatch-compact-list">{listPanel}{selectedOrder && <DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={onEdit} />}</div>;

  return (
    <div className="dispatch-list-workspace dispatch-list-workspace-stacked">
      {listPanel}
      {selectedOrder ? <DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={onEdit} showTrips={false} /> : <div className="dispatch-detail-empty"><strong>배차 상세정보</strong><p>배차를 선택하면 상세정보가 표시됩니다.</p></div>}
      {selectedOrder && <DispatchTripHistory vehicles={vehicles} drivers={drivers} trips={selectedTrips} />}
    </div>
  );
}
