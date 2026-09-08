import type { DispatchOrderWithVehicles, DispatchVehicle } from "./dispatchTypes";
import { dispatchStatusClass, formatVolume } from "./dispatchUtils";

type DispatchDetailProps = {
  order: DispatchOrderWithVehicles;
  vehicles: DispatchVehicle[];
  onEdit: (order: DispatchOrderWithVehicles) => void;
  onClose?: () => void;
};

export default function DispatchDetail({ order, vehicles, onEdit, onClose }: DispatchDetailProps) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  return (
    <section className="dispatch-detail">
      <div className="dispatch-section-head">
        <div><h2>배차상세</h2><p>{order.dispatch_date} · {order.vendor_name}</p></div>
        <div className="dispatch-detail-actions">{onClose && <button type="button" onClick={onClose}>닫기</button>}<button type="button" className="dispatch-primary" onClick={() => onEdit(order)}>수정</button></div>
      </div>
      <div className="dispatch-detail-grid">
        <div><span>거래처</span><b>{order.vendor_name}</b></div>
        <div><span>품목</span><b>{order.item_name}</b></div>
        <div><span>총 물량</span><b>{formatVolume(order.total_volume)}</b></div>
        <div><span>1대 기준</span><b>{formatVolume(order.volume_per_trip)}</b></div>
        <div><span>예상 운행</span><b>{order.estimated_trip_count}대</b></div>
        <div><span>배정 차량</span><b>{order.vehicle_ids.length}대</b></div>
        <div><span>상차지</span><b>{order.loading_location}</b></div>
        <div><span>하차지</span><b>{order.unloading_location}</b></div>
        <div><span>상태</span><b><span className={`dispatch-status ${dispatchStatusClass(order.status)}`}>{order.status}</span></b></div>
        <div className="dispatch-detail-wide"><span>메모</span><b>{order.memo || "-"}</b></div>
      </div>
      <div className="dispatch-assigned-list">
        <span>배정 차량번호</span>
        <div>{order.vehicle_ids.length ? order.vehicle_ids.map((id) => <strong key={id}>{vehicleById.get(id)?.vehicle_number || "차량 확인 필요"}</strong>) : <em>배정된 차량이 없습니다.</em>}</div>
      </div>
    </section>
  );
}
