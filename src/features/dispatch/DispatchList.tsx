import { useMemo, useState, useRef } from "react";
import DispatchDetail, { DispatchTripHistory } from "./DispatchDetail";
import type { DispatchDriver, DispatchFilters, DispatchOrderWithVehicles, DispatchTrip, DispatchVehicle } from "./dispatchTypes";
import { DISPATCH_STATUSES } from "./dispatchTypes";
import { dispatchStatusClass, formatVolume } from "./dispatchUtils";

type DispatchListProps = {
  orders: DispatchOrderWithVehicles[];
  deletedOrders?: DispatchOrderWithVehicles[];
  vehicles: DispatchVehicle[];
  drivers: DispatchDriver[];
  trips: DispatchTrip[];
  onEdit: (order: DispatchOrderWithVehicles) => void;
  onDelete?: (order: DispatchOrderWithVehicles) => Promise<boolean>;
  onRestore?: (order: DispatchOrderWithVehicles) => Promise<boolean>;
  onPermanentDelete?: (order: DispatchOrderWithVehicles) => Promise<boolean>;
  deletingOrderId?: string;
  compact?: boolean;
};

const emptyFilters: DispatchFilters = { from: "", to: "", vendor: "", item: "", status: "" };

export default function DispatchList({ orders, deletedOrders = [], vehicles, drivers, trips, onEdit, onDelete, onRestore, onPermanentDelete, deletingOrderId = "", compact = false }: DispatchListProps) {
  const [filters, setFilters] = useState<DispatchFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const openDetail = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileDetailOpen(true);
      detailDialog.current?.showModal();
    }
  };
  const closeDetail = () => {
    detailDialog.current?.close();
    setMobileDetailOpen(false);
  };
  const [showTrash, setShowTrash] = useState(false);

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
      `${order.dispatch_date} / ${order.vendor_name} / ${order.item_name} 배차를 휴지통으로 이동할까요?\n\n연결된 운행기록 ${tripCount}건은 삭제하지 않고 그대로 보존됩니다. 휴지통에서 복구할 수 있습니다.`,
    );
    if (!confirmed) return;
    const deleted = await onDelete(order);
    if (deleted && selectedId === order.id) setSelectedId("");
  };

  const listPanel = <section className="dispatch-panel dispatch-list-panel">
    <div className="dispatch-section-head">
      <div><h2>{compact ? "최근 배차" : "배차 조회"}</h2><p>{compact ? "최근 등록된 배차를 확인합니다." : "조건으로 배차를 찾고 행을 선택해 상세와 운행기록을 확인합니다."}</p></div>
      <div className="dispatch-row-actions dispatch-list-head-actions">
        {!compact && <button type="button" className="dispatch-trash-toggle" onClick={() => setShowTrash((value) => !value)}>{showTrash ? "배차목록 보기" : `휴지통 ${deletedOrders.length}건`}</button>}
        <span className="dispatch-count">총 {filtered.length}건</span>
      </div>
    </div>
    {!compact && <label className="dispatch-mobile-search"><span>거래처 검색</span><input value={filters.vendor} onChange={event => setFilters({ ...filters, vendor: event.target.value })} placeholder="거래처 검색" /></label>}
    {!compact && <button type="button" className="dispatch-mobile-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}>검색 조건 {Object.values(filters).filter(Boolean).length > 0 ? `· ${Object.values(filters).filter(Boolean).length}개 적용` : ""}<span>{filtersOpen ? "접기 −" : "펼치기 +"}</span></button>}
    {!compact && <div className={`dispatch-filter-grid dispatch-collapsible-filters ${filtersOpen ? "is-open" : ""}`}>
      <label><span>시작일</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
      <label><span>종료일</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      <label><span>거래처</span><input value={filters.vendor} onChange={(event) => setFilters({ ...filters, vendor: event.target.value })} placeholder="거래처 검색" /></label>
      <label><span>품목</span><input value={filters.item} onChange={(event) => setFilters({ ...filters, item: event.target.value })} placeholder="품목 검색" /></label>
      <label><span>상태</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as DispatchFilters["status"] })}><option value="">전체 상태</option>{DISPATCH_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      <button type="button" className="dispatch-filter-reset" onClick={() => setFilters(emptyFilters)}>초기화</button>
    </div>}
    <div className="dispatch-table-wrap">
      <table className="dispatch-record-table dispatch-table dispatch-order-table">
        <thead><tr><th>No</th><th>상태</th><th>날짜</th><th>거래처</th><th>품목</th><th>총 물량</th><th>1회 기준</th><th>예정 회차</th><th>배정 차량</th><th>메모</th><th>작업</th></tr></thead>
        <tbody>
          {!filtered.length ? <tr><td colSpan={11} className="dispatch-empty">조건에 맞는 배차가 없습니다.</td></tr> : filtered.map((order, index) => (
            <tr key={order.id} className={selectedOrder?.id === order.id ? "selected" : ""} onClick={() => openDetail(order.id)}>
              <td data-label="No" className="dispatch-count-cell">{index + 1}</td>
              <td data-label="상태"><span className={`dispatch-status ${dispatchStatusClass(order.status)}`}>{order.status}</span></td>
              <td data-label="날짜" className="dispatch-date-cell">{order.dispatch_date}</td>
              <td data-label="거래처" className="dispatch-strong">{order.vendor_name}<span className="dispatch-mobile-route">{order.loading_location} → {order.unloading_location}</span></td>
              <td data-label="품목" className="dispatch-item-cell">{order.item_name}</td>
              <td data-label="총 물량" className="dispatch-number-cell">{formatVolume(order.total_volume)}</td>
              <td data-label="1회 기준" className="dispatch-number-cell">{formatVolume(order.volume_per_trip)}</td>
              <td data-label="예정 회차" className="dispatch-count-cell">{order.estimated_trip_count}회</td>
              <td data-label="배정 차량" className="dispatch-count-cell">{order.vehicle_ids.length}대</td>
              <td data-label="메모" className="dispatch-memo-cell" title={order.memo || ""}>{order.memo || "-"}</td>
              <td data-label="작업">
                <div className="dispatch-row-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); openDetail(order.id); }}>상세보기</button>
                  {!compact && onDelete && <button type="button" className="dispatch-delete-button" disabled={deletingOrderId === order.id} onClick={(event) => { event.stopPropagation(); void requestDelete(order); }}>{deletingOrderId === order.id ? "이동 중..." : "휴지통"}</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>;

  const trashPanel = !compact && showTrash ? <section className="dispatch-panel dispatch-list-panel dispatch-trash-panel">
    <div className="dispatch-section-head dispatch-trash-head">
      <div><span className="dispatch-trash-eyebrow">RECYCLE BIN</span><h2>배차 휴지통</h2><p>잘못 삭제한 배차는 복구할 수 있고, 필요할 때만 영구삭제합니다.</p></div>
      <div className="dispatch-trash-head-actions"><button type="button" className="dispatch-trash-back" onClick={() => setShowTrash(false)}>배차목록으로</button><span className="dispatch-count">총 {deletedOrders.length}건</span></div>
    </div>
    <div className="dispatch-table-wrap dispatch-trash-table-wrap">
      <table className="dispatch-record-table dispatch-table dispatch-order-table dispatch-trash-table">
        <thead><tr><th>No</th><th>날짜</th><th>거래처</th><th>품목</th><th>총 물량</th><th>예정 회차</th><th>배정 차량</th><th>작업</th></tr></thead>
        <tbody>
          {!deletedOrders.length ? <tr><td colSpan={8} className="dispatch-empty dispatch-trash-empty"><strong>휴지통이 비어 있습니다.</strong><span>삭제한 배차가 있으면 이곳에서 복구할 수 있습니다.</span></td></tr> : deletedOrders.map((order, index) => (
            <tr key={order.id}>
              <td data-label="No" className="dispatch-count-cell">{index + 1}</td>
              <td data-label="날짜" className="dispatch-date-cell">{order.dispatch_date}</td>
              <td data-label="거래처" className="dispatch-strong">{order.vendor_name}<span className="dispatch-mobile-route">{order.loading_location} → {order.unloading_location}</span></td>
              <td data-label="품목">{order.item_name}</td>
              <td data-label="총 물량" className="dispatch-number-cell">{formatVolume(order.total_volume)}</td>
              <td data-label="예정 회차" className="dispatch-count-cell">{order.estimated_trip_count}회</td>
              <td data-label="배정 차량" className="dispatch-count-cell">{order.vehicle_ids.length}대</td>
              <td data-label="작업"><div className="dispatch-row-actions dispatch-trash-row-actions">
                {onRestore && <button type="button" className="dispatch-restore-button" disabled={deletingOrderId === order.id} onClick={() => void onRestore(order)}>{deletingOrderId === order.id ? "처리 중..." : "복구"}</button>}
                {onPermanentDelete && <button type="button" className="dispatch-delete-button" disabled={deletingOrderId === order.id} onClick={() => {
                  const tripCount = trips.filter((trip) => trip.dispatch_order_id === order.id).length;
                  if (window.confirm(`${order.dispatch_date} / ${order.vendor_name} 배차를 영구삭제할까요?\n\n운행기록 ${tripCount}건도 함께 삭제되며 이후 복구할 수 없습니다.`)) void onPermanentDelete(order);
                }}>영구삭제</button>}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section> : null;

  const mobileDetail = <dialog ref={detailDialog} className="dispatch-mobile-detail-dialog" aria-label="배차 상세정보" onClose={() => setMobileDetailOpen(false)}>
    <header className="dispatch-mobile-detail-header"><button type="button" autoFocus onClick={closeDetail}>← 목록으로</button><strong>배차 상세</strong></header>
    {mobileDetailOpen && selectedOrder && <DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={(order) => { closeDetail(); onEdit(order); }} />}
  </dialog>;

  if (compact) return <div className="dispatch-compact-list">{listPanel}{mobileDetail}<div className="dispatch-desktop-detail">{selectedOrder && <DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={onEdit} />}</div></div>;

  return (
    <div className="dispatch-list-workspace dispatch-list-workspace-stacked">
      {showTrash ? trashPanel : listPanel}
      {mobileDetail}
      <div className="dispatch-desktop-detail">
      {!showTrash && (selectedOrder ? <DispatchDetail order={selectedOrder} vehicles={vehicles} drivers={drivers} trips={selectedTrips} onEdit={onEdit} showTrips={false} /> : <div className="dispatch-detail-empty"><strong>배차 상세정보</strong><p>배차를 선택하면 상세정보가 표시됩니다.</p></div>)}
      {!showTrash && selectedOrder && <DispatchTripHistory vehicles={vehicles} drivers={drivers} trips={selectedTrips} />}
      </div>
    </div>
  );
}

