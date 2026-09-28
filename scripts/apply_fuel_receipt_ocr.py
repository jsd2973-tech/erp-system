from pathlib import Path


source = Path("src/features/fuel/FuelEntry.tsx")
s = source.read_text()


def add_before(anchor: str, addition: str, label: str):
    global s
    if addition.strip() in s:
        return
    if anchor not in s:
        raise SystemExit(f"{label} anchor not found")
    s = s.replace(anchor, addition + anchor, 1)


if 'import { Camera, Upload } from "lucide-react";' not in s:
    raise SystemExit("fuel OCR icon import anchor not found")

fuel_ocr_type_import = 'import type { FuelReceiptOcrResult } from "./fuelReceiptOcr";\n'
fuel_ocr_named_import = 'import type { FuelReceiptOcrResult } from "./fuelReceiptOcr";\n'
if fuel_ocr_named_import not in s:
    if fuel_ocr_type_import in s:
        s = s.replace(fuel_ocr_type_import, fuel_ocr_named_import, 1)
    else:
        fuel_record_import = 'import type { FuelRecord } from "./fuelTypes";\n'
        if fuel_record_import not in s:
            raise SystemExit("fuel OCR type import anchor not found")
        s = s.replace(fuel_record_import, fuel_record_import + fuel_ocr_named_import, 1)
fuel_ocr_helper_import = '''import {
  applyFuelReceiptOcrResult as mergeFuelReceiptOcrResult,
  compressFuelReceiptImage,
  createFuelOcrTouchedFields,
  fileToFuelDataUrl,
  isFuelReceiptImage,
  isFuelReceiptPdf,
  requestFuelReceiptOcr,
  type FuelOcrField,
} from "./fuelOcr";
'''
if fuel_ocr_helper_import.strip() not in s:
    if fuel_ocr_named_import not in s:
        raise SystemExit("fuel OCR helper import anchor not found")
    s = s.replace(fuel_ocr_named_import, fuel_ocr_named_import + fuel_ocr_helper_import, 1)

manual_anchor = 'export default function FuelEntry('
manual_block = r'''const emptyManualWithOcrFields = () => ({ ...emptyManual(), supply_amount: "", vat_amount: "", total_amount: "" });
type ManualOcrField = FuelOcrField;
type ManualReceipt = { file: File; previewUrl: string; name: string; mime: string };
const newManualOcrTouched = createFuelOcrTouchedFields;

'''
add_before(manual_anchor, manual_block, "fuel OCR manual type")

manual_state = '  const [manual, setManual] = useState(emptyManual);'
if manual_state in s:
    s = s.replace(manual_state, '  const [manual, setManual] = useState(emptyManualWithOcrFields);\n  const [manualReceipt, setManualReceipt] = useState<ManualReceipt | null>(null);\n  const [manualReceiptBusy, setManualReceiptBusy] = useState(false);\n  const [manualOcrState, setManualOcrState] = useState<"idle" | "analyzing" | "success" | "error">("idle");\n  const [manualOcrMessage, setManualOcrMessage] = useState("");', 1)

receipt_ref_anchor = '  const [saving, setSaving] = useState(false);\n'
receipt_ref_block = '''  const manualCameraInput = useRef<HTMLInputElement>(null);
  const manualReceiptInput = useRef<HTMLInputElement>(null);
  const manualReceiptPreviewUrl = useRef("");
  const manualReceiptBusyRef = useRef(false);
  const manualOcrTouched = useRef<Record<ManualOcrField, boolean>>(newManualOcrTouched());

  useEffect(() => () => {
    if (manualReceiptPreviewUrl.current) URL.revokeObjectURL(manualReceiptPreviewUrl.current);
  }, []);
'''
if 'const manualCameraInput = useRef<HTMLInputElement>(null);' not in s:
    if receipt_ref_anchor not in s:
        raise SystemExit("fuel OCR receipt ref anchor not found")
    s = s.replace(receipt_ref_anchor, receipt_ref_anchor + receipt_ref_block, 1)

handlers_anchor = '  const selectQuickVehicle = (vehicle: string) => {'
handlers_block = r'''  const updateManualField = (field: keyof ReturnType<typeof emptyManualWithOcrFields>, value: string) => {
    if (field in manualOcrTouched.current) manualOcrTouched.current[field as ManualOcrField] = true;
    setManual((current) => ({ ...current, [field]: value }));
  };

  const clearManualReceipt = () => {
    if (manualReceiptPreviewUrl.current) {
      URL.revokeObjectURL(manualReceiptPreviewUrl.current);
      manualReceiptPreviewUrl.current = "";
    }
    setManualReceipt(null);
    setManualOcrState("idle");
    setManualOcrMessage("");
  };

  const resetManualEntry = () => {
    resetEntryFields();
    manualOcrTouched.current = newManualOcrTouched();
    clearManualReceipt();
  };

  const applyFuelOcrResult = (result: FuelReceiptOcrResult) => {
    const merged = mergeFuelReceiptOcrResult(result, manual, manualOcrTouched.current, referenceRecords);
    setManual((current) => ({ ...current, ...merged.patch }));
    setManualOcrState(merged.state);
    setManualOcrMessage(merged.message);
  };

  const analyzeFuelReceipt = async (file: File) => {
    setManualOcrState("analyzing");
    setManualOcrMessage("영수증 분석 중...");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("로그인 세션을 확인하지 못했습니다.");

    const dataUrl = await fileToFuelDataUrl(file);
    const result = await requestFuelReceiptOcr(data.session.access_token, dataUrl);
    applyFuelOcrResult(result);
  };

  const handleManualReceiptChange = async (event: { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || manualReceiptBusyRef.current) return;

    const image = isFuelReceiptImage(file);
    const pdf = isFuelReceiptPdf(file);
    if (!image && !pdf) {
      onError("영수증은 사진 또는 PDF 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError("영수증 파일은 10MB 이하만 올릴 수 있습니다.");
      return;
    }

    manualReceiptBusyRef.current = true;
    setManualReceiptBusy(true);
    onError("");
    if (manualReceiptPreviewUrl.current) URL.revokeObjectURL(manualReceiptPreviewUrl.current);
    const previewUrl = URL.createObjectURL(file);
    manualReceiptPreviewUrl.current = previewUrl;
    setManualReceipt({ file, previewUrl, name: file.name || "영수증", mime: file.type || (pdf ? "application/pdf" : "image/*") });
    setManualOcrState("idle");
    setManualOcrMessage(pdf ? "PDF 영수증은 첨부만 저장하고 OCR은 실행하지 않습니다. 필요한 항목을 직접 확인해 주세요." : "영수증 분석 중...");

    try {
      if (image) await analyzeFuelReceipt(await compressFuelReceiptImage(file));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "영수증 OCR 분석에 실패했습니다.";
      setManualOcrState("error");
      setManualOcrMessage(message + " 직접 입력해 주세요. 첨부파일은 유지됩니다.");
    } finally {
      manualReceiptBusyRef.current = false;
      setManualReceiptBusy(false);
    }
  };

'''
add_before(handlers_anchor, handlers_block, "fuel OCR handlers")

upload_anchor = '  const saveManual = async () => {'
upload_block = r'''  const uploadReceiptForNewRecord = (recordId: string, file: File): Promise<string | null> =>
    uploadFuelReceiptForNewRecord(supabase, recordId, file);

'''
add_before(upload_anchor, upload_block, "fuel OCR upload")

save_start = '  const saveManual = async () => {'
save_end = '\n\n  return open ? <section className="fuel-manual-panel">'
save_start_index = s.find(save_start)
save_end_index = s.find(save_end, save_start_index)
if save_start_index < 0 or save_end_index < 0:
    raise SystemExit("fuel OCR saveManual block not found")
save_block = r'''  const saveManual = async () => {
    const quantity = asFuelNumber(manual.quantity);
    const unitPrice = asFuelNumber(manual.unit_price);
    if (!manual.fuel_date || !manual.vehicle_number.trim() || quantity <= 0 || unitPrice <= 0) {
      onError("일자, 차량/장비번호, 수량, 단가를 확인해 주세요.");
      return;
    }
    const calculatedSupply = calculateFuelAmounts(quantity, unitPrice).supply;
    const supply = manual.supply_amount.trim() ? Math.round(asFuelNumber(manual.supply_amount)) : calculatedSupply;
    const vat = manual.vat_amount.trim() ? Math.round(asFuelNumber(manual.vat_amount)) : Math.round(supply * 0.1);
    const total = manual.total_amount.trim() ? Math.round(asFuelNumber(manual.total_amount)) : supply + vat;
    const recordId = crypto.randomUUID();
    const payload = {
      id: recordId,
      fuel_date: manual.fuel_date,
      site_name: manual.site_name.trim() || "미지정",
      product_name: manual.product_name.trim() || "경유",
      vehicle_number: manual.vehicle_number.trim(),
      usage_count: 1,
      quantity,
      line_amount: supply,
      unit_price: unitPrice,
      supply_amount: supply,
      vat_amount: vat,
      total_amount: total,
      station_name: manual.station_name.trim() || "직접입력",
      source_file: null,
      source_fingerprint: "manual-" + crypto.randomUUID(),
      memo: manual.memo.trim(),
    };
    setSaving(true);
    const { error: saveError } = await insertFuelRecord(supabase, payload);
    if (saveError) {
      setSaving(false);
      onError("유류내역 저장에 실패했습니다. (" + saveError.message + ")");
      return;
    }
    const receiptError = manualReceipt?.file ? await uploadReceiptForNewRecord(recordId, manualReceipt.file) : null;
    setSaving(false);
    resetManualEntry();
    onClose();
    await onSaved(payload.fuel_date.slice(0, 7));
    if (receiptError) onError("유류내역은 저장됐지만 " + receiptError + " 목록에서 다시 첨부해 주세요.");
  };
'''
s = s[:save_start_index] + save_block + s[save_end_index:]

manual_jsx_start = '  return open ? <section className="fuel-manual-panel">'
manual_jsx_end = '\n  </section> : null;'
manual_jsx_start_index = s.find(manual_jsx_start)
manual_jsx_end_index = s.find(manual_jsx_end, manual_jsx_start_index)
if manual_jsx_start_index < 0 or manual_jsx_end_index < 0:
    raise SystemExit("fuel OCR manual JSX block not found")
manual_jsx = r'''  return open ? <section className="fuel-manual-panel">
      <div className="fuel-section-title"><div><h3>유류 직접 입력</h3><p>차량을 먼저 선택한 뒤 영수증 사진을 첨부하면 유류 항목을 자동 입력합니다. 확인·수정 후 저장하세요.</p></div></div>
      <div className="fuel-manual-grid">
        <label><span>주유일자 *</span><input type="date" value={manual.fuel_date} onChange={(event) => updateManualField("fuel_date", event.target.value)} /></label>
        <label><span>현장</span><input list="fuel-site-options" value={manual.site_name} onChange={(event) => updateManualField("site_name", event.target.value)} placeholder="공장" /><datalist id="fuel-site-options">{allSites.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label><span>유종</span><input list="fuel-product-options" value={manual.product_name} onChange={(event) => updateManualField("product_name", event.target.value)} placeholder="경유" /><datalist id="fuel-product-options">{allProducts.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label className="fuel-vehicle-entry"><span>차량/장비번호 *</span><input list="fuel-vehicle-options" value={manual.vehicle_number} onChange={(event) => { const value=event.target.value; if (quickVehicle) { setQuickVehicle(""); setQuickVehicleBackup(null); } setManual({ ...manual, vehicle_number:value }); if (vehicleOptions.includes(value)) applyVehicleProfile(value); }} onBlur={() => { if (vehicleOptions.includes(manual.vehicle_number)) applyVehicleProfile(manual.vehicle_number); }} placeholder="번호 입력 또는 선택" /><datalist id="fuel-vehicle-options">{vehicleOptions.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label><span>주유량(L) *</span><input inputMode="decimal" value={manual.quantity} onChange={(event) => updateManualField("quantity", event.target.value)} placeholder="270" /></label>
        <label><span>단가(원/L) *</span><input inputMode="decimal" value={manual.unit_price} onChange={(event) => updateManualField("unit_price", event.target.value)} placeholder="1820" /></label>
        <label><span>주유처</span><input list="fuel-station-options" value={manual.station_name} onChange={(event) => updateManualField("station_name", event.target.value)} /><datalist id="fuel-station-options">{allStations.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label><span>공급가액</span><input inputMode="numeric" value={manual.supply_amount} onChange={(event) => updateManualField("supply_amount", event.target.value)} placeholder="영수증에서 읽거나 직접 입력" /></label>
        <label><span>부가세</span><input inputMode="numeric" value={manual.vat_amount} onChange={(event) => updateManualField("vat_amount", event.target.value)} placeholder="영수증에서 읽거나 직접 입력" /></label>
        <label><span>합계금액</span><input inputMode="numeric" value={manual.total_amount} onChange={(event) => updateManualField("total_amount", event.target.value)} placeholder="영수증에서 읽거나 직접 입력" /></label>
        <label><span>메모</span><input value={manual.memo} onChange={(event) => updateManualField("memo", event.target.value)} placeholder="필요 시 입력" /></label>
      </div>
      {vehicleOptions.length > 0 && !quickVehicle && <div className="fuel-quick-vehicles"><span>차량·장비 빠른 선택</span><div>{vehicleOptions.filter((name) => !manual.vehicle_number.trim() || name.toLowerCase().includes(manual.vehicle_number.trim().toLowerCase())).slice(0,18).map((name)=><button type="button" key={name} onClick={() => selectQuickVehicle(name)}>{name}</button>)}</div><small>기존 명세서 기준으로 번호를 누르면 최근 현장·유종·단가·주유처를 자동 입력합니다.</small></div>}
      {quickVehicle && <div className="fuel-quick-selected"><div><span>빠른 선택 적용</span><strong>{quickVehicle}</strong><small>최근 현장·유종·단가·주유처가 입력되었습니다.</small></div><button type="button" onClick={cancelQuickVehicle}>선택 취소</button></div>}

      <div className="fuel-receipt-entry">
        <div className="fuel-receipt-entry-head"><div><strong>영수증 첨부</strong><small>사진은 OCR로 주유일자·주유처·유종·주유량·단가·공급가액·부가세·합계금액을 읽습니다. 차량·현장은 선택값을 유지합니다.</small></div></div>
        <input ref={manualCameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(event) => void handleManualReceiptChange(event)} />
        <input ref={manualReceiptInput} type="file" accept="image/*,application/pdf" hidden onChange={(event) => void handleManualReceiptChange(event)} />
        <div className="fuel-receipt-entry-actions">
          <button type="button" disabled={manualReceiptBusy || saving} onClick={() => manualCameraInput.current?.click()}><Camera size={15} /> 영수증 촬영</button>
          <button type="button" disabled={manualReceiptBusy || saving} onClick={() => manualReceiptInput.current?.click()}><Upload size={15} /> 사진/파일 선택</button>
        </div>
        {manualReceipt && <div className="fuel-manual-receipt-preview">
          <div className="fuel-manual-receipt-media">{manualReceipt.mime === "application/pdf" || /\.pdf$/i.test(manualReceipt.name) ? <iframe src={manualReceipt.previewUrl} title="첨부 영수증 PDF 미리보기" /> : <img src={manualReceipt.previewUrl} alt={manualReceipt.name} />}</div>
          <div className="fuel-manual-receipt-meta"><strong>{manualReceipt.name}</strong><button type="button" disabled={manualReceiptBusy || saving} onClick={clearManualReceipt}>첨부 제거</button></div>
        </div>}
        {manualOcrMessage && <div className={"fuel-ocr-status is-" + manualOcrState} role="status">{manualOcrState === "analyzing" && <span className="fuel-ocr-spinner" aria-hidden="true" />}{manualOcrMessage}</div>}
      </div>

      <div className="fuel-manual-total"><span>예상 합계</span><strong>{manual.total_amount.trim() ? formatFuelMoney(asFuelNumber(manual.total_amount)) + "원" : manual.quantity && manual.unit_price ? formatFuelMoney(Math.round(asFuelNumber(manual.quantity) * asFuelNumber(manual.unit_price) * 1.1)) + "원" : "-"}</strong></div>
      <div className="fuel-form-actions"><button type="button" onClick={() => { resetManualEntry(); onClose(); }}>입력 닫기</button><button type="button" className="fuel-primary" disabled={saving || manualReceiptBusy} onClick={() => void saveManual()}>{saving ? "저장 중..." : "확인 후 저장"}</button></div>'''
s = s[:manual_jsx_start_index] + manual_jsx + s[manual_jsx_end_index:]

source.write_text(s)

css_path = Path("src/features/fuel/fuelManagement.css")
css = css_path.read_text()
if ".fuel-receipt-entry{" not in css:
    css += r'''
.fuel-receipt-entry{margin-top:14px;padding:13px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fbfd}.fuel-receipt-entry-head{display:flex;justify-content:space-between;gap:12px}.fuel-receipt-entry-head>div{display:grid;gap:3px}.fuel-receipt-entry-head strong{font-size:14px}.fuel-receipt-entry-head small{color:#64748b;line-height:1.5}.fuel-receipt-entry-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.fuel-receipt-entry-actions button,.fuel-manual-receipt-meta button{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid #cbd8e8;background:#fff;color:#334155;border-radius:9px;padding:8px 11px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.fuel-receipt-entry-actions button:hover,.fuel-manual-receipt-meta button:hover{border-color:#94a3b8;background:#f8fafc}.fuel-receipt-entry-actions button:disabled,.fuel-manual-receipt-meta button:disabled{opacity:.5;cursor:not-allowed}.fuel-manual-receipt-preview{margin-top:11px;border:1px solid #dbe5ee;border-radius:11px;background:#fff;overflow:hidden}.fuel-manual-receipt-media{display:grid;place-items:center;min-height:150px;max-height:420px;background:#f1f5f9}.fuel-manual-receipt-media img{display:block;max-width:100%;max-height:420px;object-fit:contain}.fuel-manual-receipt-media iframe{display:block;width:100%;height:360px;border:0;background:#fff}.fuel-manual-receipt-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-top:1px solid #edf1f5}.fuel-manual-receipt-meta strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.fuel-manual-receipt-meta button{padding:6px 9px;white-space:nowrap}.fuel-ocr-status{display:flex;align-items:flex-start;gap:7px;margin-top:10px;padding:9px 10px;border-radius:9px;font-size:12px;font-weight:700;line-height:1.5}.fuel-ocr-status.is-analyzing{background:#eff6ff;color:#1d4ed8}.fuel-ocr-status.is-success{background:#ecfdf5;color:#047857}.fuel-ocr-status.is-error{background:#fff7ed;color:#c2410c}.fuel-ocr-spinner{width:13px;height:13px;flex:0 0 13px;margin-top:2px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:fuel-ocr-spin .8s linear infinite}@keyframes fuel-ocr-spin{to{transform:rotate(360deg)}}
@media(max-width:560px){.fuel-receipt-entry-actions{display:grid;grid-template-columns:1fr 1fr}.fuel-receipt-entry-actions button{padding:10px 7px}.fuel-manual-receipt-media iframe{height:300px}}
'''
    css_path.write_text(css)
