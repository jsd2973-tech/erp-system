from pathlib import Path


dashboard_path = Path("src/features/dispatch/DriverStatusDashboard.tsx")
source = dashboard_path.read_text()

if "driver-correction-backdrop" not in source:
    helper_anchor = 'const activeTripStatuses = new Set<DispatchTrip["status"]>(["상차대기", "진행중"]);'
    helper_block = '''

type CorrectionType = "start_cancel" | "loading_cancel" | "unloading_cancel";
type CorrectionHistoryItem = {
  id: string;
  action: string;
  reason: string;
  before_status: string;
  after_status: string;
  corrected_by_email: string;
  corrected_at: string;
};

const correctionLabels: Record<CorrectionType, string> = {
  start_cancel: "운행시작 취소",
  loading_cancel: "상차완료 취소",
  unloading_cancel: "하차완료 취소",
};
const correctionDescriptions: Record<CorrectionType, string> = {
  start_cancel: "운행기록은 남기고 취소 상태로 보관합니다. 기록 생성 시각은 이력으로 유지됩니다.",
  loading_cancel: "상차완료 시간과 상차 GPS를 정리하고 상차대기 상태로 되돌립니다.",
  unloading_cancel: "완료 실적에서 제외하고 하차완료 시간과 하차 GPS를 정리합니다. 실제 운송량은 재처리를 위해 보존합니다.",
};

const correctionTypeForTrip = (trip: DispatchTrip): CorrectionType | null => {
  if (trip.status === "완료" && trip.loading_completed_at && trip.unloading_completed_at) return "unloading_cancel";
  if (trip.status === "진행중" && trip.loading_completed_at && !trip.unloading_completed_at) return "loading_cancel";
  if (trip.status === "상차대기" && !trip.loading_completed_at && !trip.unloading_completed_at) return "start_cancel";
  return null;
};

const correctionDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
  : "-";
'''
    if helper_anchor not in source:
        raise SystemExit("trip correction status anchor not found")
    source = source.replace(helper_anchor, helper_anchor + helper_block, 1)

    state_anchor = '  const [dailySummaryTab, setDailySummaryTab] = useState<"기사" | "차량">("기사");'
    state_block = '''
  const [canCorrectTrips, setCanCorrectTrips] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<{ trip: DispatchTrip; type: CorrectionType } | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionNotice, setCorrectionNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [historyTripId, setHistoryTripId] = useState("");
  const [correctionHistory, setCorrectionHistory] = useState<CorrectionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);'''
    if state_anchor not in source:
        raise SystemExit("trip correction state anchor not found")
    source = source.replace(state_anchor, state_anchor + state_block, 1)

    rows_anchor = '  const rows = useMemo<DriverRow[]>(() =>'
    permission_effect = '''  useEffect(() => {
    let active = true;
    void supabase.rpc("can_correct_dispatch_trip").then(({ data, error: permissionError }) => {
      if (active) setCanCorrectTrips(!permissionError && data === true);
    });
    return () => { active = false; };
  }, []);

'''
    if rows_anchor not in source:
        raise SystemExit("trip correction permission anchor not found")
    source = source.replace(rows_anchor, permission_effect + rows_anchor, 1)

    selected_anchor = '  const selectedRow = rows.find((row) => row.driver.id === selectedDriverId) || rows[0] || null;\n\n'
    callback_block = '''  const selectedRow = rows.find((row) => row.driver.id === selectedDriverId) || rows[0] || null;

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
    const { error: correctionError } = await supabase.rpc("correct_dispatch_trip_event", {
      p_trip_id: correctionTarget.trip.id,
      p_correction_type: correctionTarget.type,
      p_reason: correctionReason.trim() || null,
    });
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
    const { data, error: historyError } = await supabase
      .from("dispatch_trip_corrections")
      .select("id,action,reason,before_status,after_status,corrected_by_email,corrected_at")
      .eq("trip_id", tripId)
      .order("corrected_at", { ascending: false });
    setHistoryLoading(false);
    if (historyError) {
      setHistoryTripId("");
      setCorrectionNotice({ tone: "error", text: `정정 이력을 불러오지 못했습니다. (${historyError.message})` });
      return;
    }
    setCorrectionHistory((data || []).map((row) => ({
      id: String(row.id),
      action: String(row.action || ""),
      reason: String(row.reason || ""),
      before_status: String(row.before_status || ""),
      after_status: String(row.after_status || ""),
      corrected_by_email: String(row.corrected_by_email || ""),
      corrected_at: String(row.corrected_at || ""),
    })));
  };

'''
    if selected_anchor not in source:
        raise SystemExit("trip correction callback anchor not found")
    source = source.replace(selected_anchor, callback_block, 1)

    message_anchor = '    {error && <div className="driver-status-error">{error}</div>}'
    message_block = '''    {error && <div className="driver-status-error">{error}</div>}
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
'''
    if message_anchor not in source:
        raise SystemExit("trip correction message anchor not found")
    source = source.replace(message_anchor, message_block, 1)

    trip_anchor = '''                    const start = koreaTime(trip.created_at);
                    const loadingTime = koreaTime(trip.loading_completed_at);
                    const unloading = koreaTime(trip.unloading_completed_at);
                    return <div key={trip.id} className="driver-trip-row">'''
    trip_replacement = '''                    const start = koreaTime(trip.created_at);
                    const loadingTime = koreaTime(trip.loading_completed_at);
                    const unloading = koreaTime(trip.unloading_completed_at);
                    const correctionType = correctionTypeForTrip(trip);
                    return <div key={trip.id} className="driver-trip-row">'''
    if trip_anchor not in source:
        raise SystemExit("trip correction row anchor not found")
    source = source.replace(trip_anchor, trip_replacement, 1)

    row_anchor = '''                      <div className="driver-trip-volume">{trip.status === "완료" ? formatVolume(trip.actual_volume) : "-"}</div>
                    </div>;'''
    row_replacement = '''                      <div className="driver-trip-volume">{trip.status === "완료" ? formatVolume(trip.actual_volume) : "-"}</div>
                      {canCorrectTrips && <div className="driver-trip-actions">
                        {correctionType && <button type="button" onClick={() => openCorrection(trip)} title={correctionLabels[correctionType]}>정정</button>}
                        <button type="button" onClick={() => void toggleCorrectionHistory(trip.id)}>{historyTripId === trip.id ? "이력 닫기" : "정정 이력"}</button>
                      </div>}
                      {canCorrectTrips && historyTripId === trip.id && <div className="driver-correction-history">
                        <div className="driver-correction-history-head"><strong>정정 이력</strong><span>{correctionHistory.length}건</span></div>
                        {historyLoading ? <p>이력을 불러오는 중...</p> : !correctionHistory.length ? <p>정정 이력이 없습니다.</p> : <ul>{correctionHistory.map((item) => <li key={item.id}><div><strong>{item.action}</strong><span>{correctionDateTime(item.corrected_at)}</span></div><small>수정자: {item.corrected_by_email || "관리자"}{item.reason ? ` · 사유: ${item.reason}` : ""}</small></li>)}</ul>}
                      </div>}
                    </div>;'''
    if row_anchor not in source:
        raise SystemExit("trip correction action anchor not found")
    source = source.replace(row_anchor, row_replacement, 1)

    dashboard_path.write_text(source)


css_path = Path("src/features/dispatch/driverStatusDashboard.css")
css = css_path.read_text()
if ".driver-correction-backdrop" not in css:
    css += '''

/* Trip correction UI is intentionally scoped to the live driver dashboard. */
.driver-status-dashboard .driver-correction-notice{margin:10px 0;padding:10px 12px;border:1px solid #d9e5ef;border-radius:9px;background:#f5f9fd;color:#315d7e;font-size:12px;font-weight:750}.driver-status-dashboard .driver-correction-notice.error{border-color:#f0d1cc;background:#fff4f2;color:#a23d32}.driver-status-dashboard .driver-correction-notice.success{border-color:#cbe7d7;background:#f0fbf4;color:#187148}
.driver-status-dashboard .driver-trip-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:6px;margin-top:-3px}.driver-status-dashboard .driver-trip-actions button{min-height:28px;border:1px solid #d7e1eb;border-radius:7px;padding:4px 8px;background:#f8fafc;color:#5b7083;font-size:10px;font-weight:850;cursor:pointer}.driver-status-dashboard .driver-trip-actions button:hover{border-color:#9ebbd5;background:#edf6ff;color:#1f5f91}.driver-status-dashboard .driver-trip-actions button:first-child{border-color:#e8d1c2;background:#fff8f2;color:#a05f27}
.driver-status-dashboard .driver-correction-history{grid-column:1/-1;padding:9px 10px;border:1px solid #e5ebf1;border-radius:8px;background:#f8fafc}.driver-status-dashboard .driver-correction-history-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:5px;color:#4f667d;font-size:10px}.driver-status-dashboard .driver-correction-history-head span{color:#8795a3}.driver-status-dashboard .driver-correction-history>p{margin:0;color:#8895a2;font-size:10px}.driver-status-dashboard .driver-correction-history ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}.driver-status-dashboard .driver-correction-history li{display:grid;gap:2px;padding-top:6px;border-top:1px solid #e7edf2}.driver-status-dashboard .driver-correction-history li:first-child{padding-top:0;border-top:0}.driver-status-dashboard .driver-correction-history li>div{display:flex;justify-content:space-between;gap:8px}.driver-status-dashboard .driver-correction-history li strong{color:#35526c;font-size:10px}.driver-status-dashboard .driver-correction-history li span,.driver-status-dashboard .driver-correction-history li small{color:#7c8b99;font-size:9px}.driver-status-dashboard .driver-correction-history li small{line-height:1.35}
.driver-status-dashboard .driver-correction-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,27,44,.48)}.driver-status-dashboard .driver-correction-dialog{width:min(100%,420px);padding:18px;border:1px solid #d8e3ed;border-radius:14px;background:#fff;box-shadow:0 20px 60px rgba(11,35,60,.24)}.driver-status-dashboard .driver-correction-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.driver-status-dashboard .driver-correction-dialog-head>div{display:grid;gap:3px}.driver-status-dashboard .driver-correction-dialog-head span{color:#7187a0;font-size:9px;font-weight:950;letter-spacing:.08em}.driver-status-dashboard .driver-correction-dialog h3{margin:0;color:#213c56;font-size:17px}.driver-status-dashboard .driver-correction-dialog-head button{width:30px;height:30px;border:0;border-radius:8px;background:#f2f5f8;color:#617386;font-size:22px;line-height:1;cursor:pointer}.driver-status-dashboard .driver-correction-target{margin:14px 0 5px;color:#31536e;font-size:12px;font-weight:850}.driver-status-dashboard .driver-correction-description{margin:0 0 14px;color:#687b8c;font-size:11px;line-height:1.5}.driver-status-dashboard .driver-correction-reason{display:grid;gap:5px}.driver-status-dashboard .driver-correction-reason>span{color:#66798b;font-size:10px;font-weight:850}.driver-status-dashboard .driver-correction-reason small{color:#9aa5af;font-weight:650}.driver-status-dashboard .driver-correction-reason input{width:100%;box-sizing:border-box;border:1px solid #dbe4ec;border-radius:8px;padding:9px 10px;color:#304b63;font:inherit;font-size:12px;outline:none}.driver-status-dashboard .driver-correction-reason input:focus{border-color:#83afd2;box-shadow:0 0 0 3px rgba(60,128,182,.12)}.driver-status-dashboard .driver-correction-dialog-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:17px}.driver-status-dashboard .driver-correction-dialog-actions button{min-height:36px;border:1px solid #d8e2eb;border-radius:8px;padding:0 13px;background:#fff;color:#5c7082;font-size:12px;font-weight:850;cursor:pointer}.driver-status-dashboard .driver-correction-dialog-actions .confirm{border-color:#c98c67;background:#a95f32;color:#fff}.driver-status-dashboard .driver-correction-dialog-actions button:disabled,.driver-status-dashboard .driver-correction-dialog-head button:disabled{opacity:.55;cursor:wait}
@media(max-width:760px){.driver-status-dashboard .driver-trip-actions{justify-content:center;margin-top:0}.driver-status-dashboard .driver-trip-actions button{min-height:32px;padding:5px 10px;font-size:11px}.driver-status-dashboard .driver-correction-history{padding:9px}.driver-status-dashboard .driver-correction-backdrop{align-items:flex-end;padding:0}.driver-status-dashboard .driver-correction-dialog{width:100%;border-radius:16px 16px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));}.driver-status-dashboard .driver-correction-dialog-actions{display:grid;grid-template-columns:1fr 1fr}.driver-status-dashboard .driver-correction-dialog-actions button{min-height:42px}}
'''
    css_path.write_text(css)
