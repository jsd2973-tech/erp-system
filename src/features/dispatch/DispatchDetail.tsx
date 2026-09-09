import { ArrowRight } from "lucide-react";
import type { DispatchDriver, DispatchOrderWithVehicles, DispatchTrip, DispatchVehicle } from "./dispatchTypes";
import { dispatchStatusClass, formatVolume } from "./dispatchUtils";

type DispatchDetailProps = {
  order: DispatchOrderWithVehicles;
  vehicles: DispatchVehicle[];
  drivers: DispatchDriver[];
  trips: DispatchTrip[];
  onEdit: (order: DispatchOrderWithVehicles) => void;
  showTrips?: boolean;
};

type DispatchTripHistoryProps = {
  vehicles: DispatchVehicle[];
  drivers: DispatchDriver[];
  trips: DispatchTrip[];
};

const koreaDateTime = (value: string | null) => value ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "-";

export function DispatchTripHistory({ vehicles, drivers, trips }: DispatchTripHistoryProps) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));

  return (
    <section className="dispatch-trip-history">
      <div className="dispatch-trip-history-head"><div><h3>실제 운행 내역</h3><p>기사 모바일에서 등록된 실제 회차별 운행 정보입니다.</p></div><span>{trips.length}건</span></div>
      <div className="dispatch-table-wrap">
        <table className="dispatch-table">
          <thead><tr><th>No</th><th>차량번호</th><th>기사</th><th>회차</th><th>상차 완료시간</th><th>하차 완료시간</th><th>실제 운송량</th><th>상태</th></tr></thead>
          <tbody>{!trips.length ? <tr><td colSpan={8} className="dispatch-empty">등록된 운행기록이 없습니다.</td></tr> : trips.map((trip, index) => <tr key={trip.id}>
            <td className="dispatch-count-cell">{index + 1}</td><td className="dispatch-strong">{vehicleById.get(trip.vehicle_id)?.vehicle_number || "차량 확인 필요"}</td><td>{driverById.get(trip.driver_id)?.name || "기사 확인 필요"}</td><td className="dispatch-count-cell">{trip.trip_no}회</td><td>{koreaDateTime(trip.loading_completed_at)}</td><td>{koreaDateTime(trip.unloading_completed_at)}</td><td className="dispatch-number-cell">{formatVolume(trip.actual_volume)}</td><td><span className={`dispatch-trip-status ${trip.status === "완료" ? "done" : trip.status === "진행중" ? "active" : "waiting"}`}>{trip.status}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export default function DispatchDetail({ order, vehicles, drivers, trips, onEdit, showTrips = true }: DispatchDetailProps) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const completedTrips = trips.filter((trip) => trip.status === "완료");
  const activeTrips = trips.filter((trip) => trip.status === "상차대기" || trip.status === "진행중");
  const actualVolume = completedTrips.reduce((sum, trip) => sum + trip.actual_volume, 0);

  return (
    <section className="dispatch-detail">
      <div className="dispatch-detail-titlebar">
        <div><span className="dispatch-detail-eyebrow">배차 상세정보</span><h2>{order.vendor_name}</h2><p>{order.item_name}</p></div>
        <div className="dispatch-detail-actions"><span className={`dispatch-status ${dispatchStatusClass(order.status)}`}>{order.status}</span><button type="button" className="dispatch-primary" onClick={() => onEdit(order)}>수정</button></div>
      </div>

      <div className="dispatch-detail-kv">
        <div><span>배차일</span><b>{order.dispatch_date}</b></div>
        <div><span>거래처</span><b>{order.vendor_name}</b></div>
        <div><span>품목</span><b>{order.item_name}</b></div>
      </div>

      <div className="dispatch-route">
        <div><span>상차지</span><b>{order.loading_location}</b></div>
        <i aria-hidden="true"><ArrowRight size={16} /></i>
        <div><span>하차지</span><b>{order.unloading_location}</b></div>
      </div>

      <div className="dispatch-detail-grid">
        <div><span>총 물량</span><b>{formatVolume(order.total_volume)}</b></div>
        <div><span>1회 기준</span><b>{formatVolume(order.volume_per_trip)}</b></div>
        <div><span>예정 총 회차</span><b>{order.estimated_trip_count}회</b></div>
        <div><span>배정 차량</span><b>{order.vehicle_ids.length}대</b></div>
        <div><span>완료 회차</span><b>{completedTrips.length}회</b></div>
        <div><span>진행 중 회차</span><b>{activeTrips.length}회</b></div>
        <div className="dispatch-detail-emphasis"><span>실제 운송량</span><b>{formatVolume(actualVolume)}</b></div>
      </div>

      <div className="dispatch-assigned-list">
        <span>배정 차량</span>
        <div>{order.vehicle_ids.length ? order.vehicle_ids.map((id) => <strong key={id}>{vehicleById.get(id)?.vehicle_number || "차량 확인 필요"}</strong>) : <em>배정된 차량이 없습니다.</em>}</div>
      </div>

      <div className="dispatch-detail-note"><span>메모</span><p>{order.memo || "-"}</p></div>
      {showTrips && <DispatchTripHistory vehicles={vehicles} drivers={drivers} trips={trips} />}
    </section>
  );
}
