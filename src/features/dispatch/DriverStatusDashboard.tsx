import MobileEditor from "./MobileEditor";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import type { DispatchDriver, DispatchTrip, DispatchTripLocation, DispatchVehicle } from "./dispatchTypes";
import { dispatchToday, formatVolume } from "./dispatchUtils";
import { canCorrectDispatchTrips, correctDispatchTripEvent, loadDispatchTripCorrectionHistory } from "./dispatchCorrectionService";
import { loadDispatchStatusSnapshot } from "./dispatchStatusService";
import {
  buildDailyDriverSummaries,
  buildDailyVehicleSummaries,
  buildDispatchExceptions,
  buildDriverStatusRows,
  correctionDateTime,
  correctionDescriptions,
  correctionLabels,
  correctionTypeForTrip,
  groupDriverTripsByOrder,
  indexDispatchOrdersByVehicle,
  indexDispatchTrips,
  summarizeLiveDispatchStatus,
  type CorrectionHistoryItem,
  type CorrectionType,
  type DispatchStatusOrder,
} from "./dispatchModel";
import "./driverStatusDashboard.css";

// COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1

type Props = { drivers: DispatchDriver[]; vehicles: DispatchVehicle[] };
type TodayOrder = DispatchStatusOrder;

const koreaTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
  : "-";

export default function DriverStatusDashboard({ drivers, vehicles }: Props) {
  const [trips, setTrips] = useState<DispatchTrip[]>([]);
  const [tripLocations, setTripLocations] = useState<DispatchTripLocation[]>([]);
  const [orders, setOrders] = useState<TodayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [dailySummaryTab, setDailySummaryTab] = useState<"기사" | "차량">("기사");
  const [canCorrectTrips, setCanCorrectTrips] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<{ trip: DispatchTrip; type: CorrectionType } | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionNotice, setCorrectionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [historyTripId, setHistoryTripId] = useState("");
  const [correctionHistory, setCorrectionHistory] = useState<CorrectionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const locationByTripEvent = useMemo(() => new Map(tripLocations.map((location) => [`${location.trip_id}:${location.event_type}`, location])), [tripLocations]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const snapshot = await loadDispatchStatusSnapshot(supabase, dispatchToday());
      setOrders(snapshot.orders);
      setTrips(snapshot.trips);
      setTripLocations(snapshot.tripLocations);
      setError("");
      setUpdatedAt(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "운행현황을 불러오지 못했습니다.");
    }
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

  useEffect(() => {
    let active = true;
    void canCorrectDispatchTrips(supabase).then((canCorrect) => {
      if (active) setCanCorrectTrips(canCorrect);
    });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => buildDriverStatusRows(drivers, orders, trips), [drivers, orders, trips]);

  const selectedRow = rows.find((row) => row.driver.id === selectedDriverId) || rows[0] || null;

  const openCorrection = (trip: DispatchTrip) => {
    const type = correctionTypeForTrip(trip);
    if (!type) return;
    setCorrectionNotice(null);
    setCorrectionReason("");
    setCorrectionTarget({ trip, type });
  };

  const closeCorrection = () => {
    if (!correctionBusy) setCorrectionTarget(null);
  };

  const executeCorrection = async () => {
    if (!correctionTarget || correctionBusy) return;
    setCorrectionBusy(true);
    setCorrectionNotice(null);
    const { error: correctionError } = await correctDispatchTripEvent(supabase, correctionTarget.trip.id, correctionTarget.type, correctionReason.trim() || null);
    setCorrectionBusy(false);
    if (correctionError) {
      setCorrectionNotice({ tone: "error", text: correctionError.message || "정정할 수 없습니다. 현재 상태를 다시 확인해 주세요." });
      return;
    }
    setCorrectionTarget(null);
    setHistoryTripId("");
    setCorrectionHistory([]);
    setCorrectionNotice({ tone: "success", text: `${correctionLabels[correctionTarget.type]} 정정이 완료되었습니다.` });
    await load();
  };

  const toggleCorrectionHistory = async (tripId: string) => {
    if (historyTripId === tripId) {
      setHistoryTripId("");
      setCorrectionHistory([]);
      return;
    }
    setHistoryTripId(tripId);
    setCorrectionHistory([]);
    setHistoryLoading(true);
    try {
      setCorrectionHistory(await loadDispatchTripCorrectionHistory(supabase, tripId));
    } catch (historyError) {
      setHistoryTripId("");
      setCorrectionNotice({ tone: "error", text: `정정 이력을 불러오지 못했습니다. (${historyError instanceof Error ? historyError.message : "조회 오류"})` });
      return;
    } finally {
      setHistoryLoading(false);
    }
  };

  const tripIndexes = useMemo(() => indexDispatchTrips(trips), [trips]);
  const ordersByVehicle = useMemo(() => indexDispatchOrdersByVehicle(orders), [orders]);

  const exceptionItems = useMemo(() => buildDispatchExceptions({
    drivers,
    orders,
    trips,
    now: updatedAt?.getTime() || 0,
    tripIndexes,
    vehicleById,
  }), [drivers, orders, trips, updatedAt, tripIndexes, vehicleById]);

  const dailyDriverSummaries = useMemo(() => buildDailyDriverSummaries({
    drivers,
    orders,
    trips,
    tripIndexes,
    ordersByVehicle,
    vehicleById,
  }), [drivers, orders, ordersByVehicle, trips, tripIndexes, vehicleById]);

  const dailyVehicleSummaries = useMemo(() => buildDailyVehicleSummaries({
    drivers,
    vehicles,
    tripIndexes,
    ordersByVehicle,
  }), [drivers, ordersByVehicle, tripIndexes, vehicles]);

  const dailySummaries = dailySummaryTab === "기사" ? dailyDriverSummaries : dailyVehicleSummaries;
  const groupedTrips = useMemo(() => selectedRow
    ? groupDriverTripsByOrder(selectedRow.mine, orderById)
    : [], [selectedRow, orderById]);

  const summary = useMemo(() => summarizeLiveDispatchStatus(drivers, rows, trips), [drivers, rows, trips]);

  const selectedVolume = selectedRow?.completed.reduce((sum, trip) => sum + (Number.isFinite(trip.actual_volume) ? trip.actual_volume : 0), 0) || 0;

  return <section className="driver-status-dashboard">
    <div className="driver-status-head">
      <div>
        <span className="driver-status-eyebrow">LIVE DRIVER CONTROL · {dispatchToday()}</span>
        <h2>운행현황</h2>
        <p>기사를 선택하면 현재 배차와 오늘 운행내역을 확인할 수 있습니다.</p>
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
    {correctionNotice && <div className={`driver-correction-notice ${correctionNotice.tone}`} role="status">{correctionNotice.text}</div>}

    {correctionTarget && <div className="driver-correction-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCorrection(); }}>
      <div className="driver-correction-dialog" role="dialog" aria-modal="true" aria-labelledby="driver-correction-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="driver-correction-dialog-head">
          <div><span>TRIP CORRECTION</span><h3 id="driver-correction-title">{correctionLabels[correctionTarget.type]}</h3></div>
          <button type="button" onClick={closeCorrection} disabled={correctionBusy} aria-label="정정 창 닫기">×</button>
        </div>
        <p className="driver-correction-target">{correctionTarget.trip.trip_no}회차 · {correctionTarget.trip.status}</p>
        <p className="driver-correction-description">{correctionDescriptions[correctionTarget.type]}</p>
        <label className="driver-correction-reason"><span>정정 사유 <small>(선택)</small></span><input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} maxLength={500} placeholder="오입력, 현장 확인 후 정정 등" /></label>
        <div className="driver-correction-dialog-actions"><button type="button" onClick={closeCorrection} disabled={correctionBusy}>취소</button><button type="button" className="confirm" onClick={() => void executeCorrection()} disabled={correctionBusy}>{correctionBusy ? "정정 중..." : "정정 실행"}</button></div>
      </div>
    </div>}


    <section className="driver-exception-panel" aria-label="예외 운행 확인">
      <div className="driver-exception-head">
        <div><span>EXCEPTION CHECK</span><h3>예외 운행 확인</h3><p>미출발·상차 후 경과·예정 회차 초과를 빠르게 확인합니다.</p></div>
        <strong className={exceptionItems.length ? "has-exception" : "normal"}>{exceptionItems.length ? exceptionItems.length + "건 확인" : "정상"}</strong>
      </div>
      {!exceptionItems.length ? <div className="driver-exception-empty">현재 확인된 예외 운행이 없습니다.</div> : <div className="driver-exception-list">
        {exceptionItems.map((item) => <article key={item.key} className={"driver-exception-item tone-" + item.tone}>
          <div className="driver-exception-item-head"><span>{item.kind}</span><strong>{item.subject}</strong></div>
          <b>{item.orderText}</b><small>{item.detail}</small>
        </article>)}
      </div>}
      <small className="driver-exception-note">상차 후 경과는 운영 기준이 없는 상태에서 자동 지연 판정 없이 경과시간만 표시합니다.</small>
    </section>

    <section className="driver-daily-summary" aria-label="오늘 기사 차량 요약">
      <div className="driver-daily-head">
        <div><span>DAILY SUMMARY</span><h3>오늘 운행 요약</h3><p>완료 trip의 회차·actual_volume과 오늘 운행 시간 기준입니다.</p></div>
        <div className="driver-daily-tabs" role="tablist" aria-label="오늘 요약 기준">
          {(["기사", "차량"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={dailySummaryTab === tab} className={dailySummaryTab === tab ? "active" : ""} onClick={() => setDailySummaryTab(tab)}>{tab}</button>)}
        </div>
      </div>
      {!dailySummaries.length ? <div className="driver-daily-empty">오늘 운행 기록이 없습니다.</div> : <div className="driver-daily-list">
        {dailySummaries.map((summaryItem) => <article key={summaryItem.id} className="driver-daily-card">
          <div className="driver-daily-card-head"><div><strong>{summaryItem.title}</strong><small>{summaryItem.secondary}</small></div><b>{summaryItem.completedCount}회 완료</b></div>
          <div className="driver-daily-volume">{formatVolume(summaryItem.completedVolume)}</div>
          <div className="driver-daily-times"><span>첫 운행 <b>{koreaTime(summaryItem.firstStartedAt)}</b></span><span>마지막 {summaryItem.lastActivityLabel || "활동"} <b>{koreaTime(summaryItem.lastActivityAt)}</b></span></div>
        </article>)}
      </div>}
    </section>

    <div className="driver-status-workspace">
      <aside className="driver-master-panel">
        <div className="driver-master-head">
          <strong>기사 목록</strong>
          <span>{rows.length}명</span>
        </div>
        <div className="driver-master-list">
          {rows.map((row) => {
            const vehicleNumber = row.vehicleIds.length
              ? row.vehicleIds.map((id) => vehicleById.get(id)?.vehicle_number || "차량 확인 필요").join(" · ")
              : "차량 미지정";
            const isSelected = selectedRow?.driver.id === row.driver.id;
            const dispatchText = row.currentOrder
              ? `${row.currentOrder.vendor_name} · ${row.currentOrder.item_name}`
              : row.state === "운행 완료"
                ? `오늘 ${row.completed.length}회 완료 · ${formatVolume(row.completedVolume)}`
                : "현재 배차 없음";
            return <button
              key={row.driver.id}
              type="button"
              className={`driver-master-item ${isSelected ? "selected" : ""}`}
              onClick={() => { setSelectedDriverId(row.driver.id); setDetailOpen(true); }}
            >
              <span className={`driver-master-state state-${row.state.replace(/\s/g, "-")}`}><i /></span>
              <span className="driver-master-content">
                <span className="driver-master-name-line">
                  <strong>{row.driver.name}</strong>
                  <b className={`driver-master-status state-${row.state.replace(/\s/g, "-")}`}>{row.state}</b>
                </span>
                <small className="driver-master-vehicle">{vehicleNumber}</small>
                <small className="driver-master-dispatch">{dispatchText}</small>
                <span className="driver-master-progress">
                  <b>{row.currentRoundText}</b>
                  <small>{row.progress ? `잔여 ${row.remainingText}` : row.state === "운행 완료" ? "오늘 운행 완료" : "-"}</small>
                </span>
                <small className="driver-master-activity">마지막 {row.lastText}</small>
              </span>
            </button>;
          })}
        </div>
      </aside>

      <MobileEditor open={detailOpen} onToggle={() => setDetailOpen(value => !value)} title={selectedRow ? `${selectedRow.driver.name} 운행 상세` : "운행 상세"}>
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
                <p>{selectedRow.vehicleIds.length ? selectedRow.vehicleIds.map((id) => vehicleById.get(id)?.vehicle_number || "차량 확인 필요").join(" · ") : "차량 미지정"}</p>
              </div>
            </div>
            <div className="driver-detail-last"><span>마지막 활동</span><strong>{selectedRow.lastText}</strong></div>
          </div>

          <div className="driver-detail-current">
            <span>현재 배차</span>
            <strong>{selectedRow.currentOrder ? `${selectedRow.currentOrder.vendor_name} · ${selectedRow.currentOrder.item_name}` : "현재 배차 없음"}</strong>
            {selectedRow.currentOrder && <em>{selectedRow.currentOrder.loading_location || "상차지 미지정"} <b>→</b> {selectedRow.currentOrder.unloading_location || "하차지 미지정"}</em>}
            {(selectedRow.currentOrder || selectedRow.state === "운행 완료") && <div className="driver-detail-current-meta">
              <strong>{selectedRow.currentRoundText}</strong>
              <span>{selectedRow.progress ? `잔여 ${selectedRow.remainingText}` : `${selectedRow.completed.length}회 완료 · ${formatVolume(selectedRow.completedVolume)}`}</span>
            </div>}
          </div>

          <div className="driver-detail-stats">
            <div><span>오늘 완료</span><strong>{selectedRow.completed.length}<small>회</small></strong></div>
            <div><span>오늘 운송량</span><strong>{formatVolume(selectedVolume)}</strong></div>
            <div><span>오늘 전체 기록</span><strong>{selectedRow.mine.length}<small>회</small></strong></div>
          </div>

          <MobileEditor open={historyOpen} onToggle={() => setHistoryOpen(value => !value)} title={`오늘의 운행내역 · ${selectedRow.mine.length}회`}>
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
                    const correctionType = correctionTypeForTrip(trip);
                    return <div key={trip.id} className="driver-trip-row">
                      <div className="driver-trip-no"><strong>{trip.trip_no}회차</strong><span className={`trip-status trip-${trip.status}`}>{trip.status}</span></div>
                      <div className="driver-trip-info">
                        <span>시작 <b>{start}</b></span>
                        <span className="driver-trip-event">상차 <b>{loadingTime}</b>{locationByTripEvent.get(`${trip.id}:loading`)?.address && <small>📍 {locationByTripEvent.get(`${trip.id}:loading`)?.address}</small>}</span>
                        <span className="driver-trip-event">하차 <b>{unloading}</b>{locationByTripEvent.get(`${trip.id}:unloading`)?.address && <small>📍 {locationByTripEvent.get(`${trip.id}:unloading`)?.address}</small>}</span>
                      </div>
                      <div className="driver-trip-volume">{trip.status === "완료" ? formatVolume(trip.actual_volume) : "-"}</div>
                      {canCorrectTrips && <div className="driver-trip-actions">
                        {correctionType && <button type="button" onClick={() => openCorrection(trip)} title={correctionLabels[correctionType]}>정정</button>}
                        <button type="button" onClick={() => void toggleCorrectionHistory(trip.id)}>{historyTripId === trip.id ? "이력 닫기" : "정정 이력"}</button>
                      </div>}
                      {canCorrectTrips && historyTripId === trip.id && <div className="driver-correction-history">
                        <div className="driver-correction-history-head"><strong>정정 이력</strong><span>{correctionHistory.length}건</span></div>
                        {historyLoading ? <p>이력을 불러오는 중...</p> : !correctionHistory.length ? <p>정정 이력이 없습니다.</p> : <ul>{correctionHistory.map((item) => <li key={item.id}><div><strong>{item.action}</strong><span>{correctionDateTime(item.corrected_at)}</span></div><small>수정자: {item.corrected_by_email || "관리자"}{item.reason ? ` · 사유: ${item.reason}` : ""}</small></li>)}</ul>}
                      </div>}
                    </div>;
                  })}
                </div>
              </section>)}
            </div>}
          </section>
          </MobileEditor>
        </>}
      </main>
      </MobileEditor>
    </div>
  </section>;
}
