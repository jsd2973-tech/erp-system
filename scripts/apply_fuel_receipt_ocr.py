from pathlib import Path


source = Path("src/features/fuel/FuelManagement.tsx")
s = source.read_text()


def add_before(anchor: str, addition: str, label: str):
    global s
    if addition.strip() in s:
        return
    if anchor not in s:
        raise SystemExit(f"{label} anchor not found")
    s = s.replace(anchor, addition + anchor, 1)


lucide_import = 'import { Download, Eye, FileSpreadsheet, Fuel, Paperclip, Pencil, Plus, RefreshCcw, Search, Settings2, Trash2, Upload } from "lucide-react";\n'
if 'import { Camera } from "lucide-react";' not in s:
    if lucide_import not in s:
        raise SystemExit("fuel OCR icon import anchor not found")
    s = s.replace(lucide_import, lucide_import + 'import { Camera } from "lucide-react";\n', 1)

statement_import = 'import { buildFuelStatementWorkbook, type FuelStatementParty, type FuelStatementRecord } from "./fuelStatementExport";\n'
fuel_ocr_type_import = 'import type { FuelReceiptOcrResult } from "./fuelReceiptOcr";\n'
fuel_ocr_named_import = 'import { reconcileFuelReceiptOcr, type FuelReceiptOcrResult } from "./fuelReceiptOcr";\n'
if fuel_ocr_named_import not in s:
    if fuel_ocr_type_import in s:
        s = s.replace(fuel_ocr_type_import, fuel_ocr_named_import, 1)
    else:
        if statement_import not in s:
            raise SystemExit("fuel OCR type import anchor not found")
        s = s.replace(statement_import, statement_import + fuel_ocr_named_import, 1)

helper_anchor = 'const text = (value: unknown)'
helper_block = r'''const isFuelReceiptImage = (file: File) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || "");
const isFuelReceiptPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("이미지를 읽지 못했습니다."));
  reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
  reader.readAsDataURL(file);
});
const compressFuelReceiptImage = (file: File): Promise<File> => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 1800;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return resolve(file);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return resolve(file);
        resolve(new File([blob], "fuel-receipt-" + Date.now() + ".jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.8);
    };
    image.onerror = () => resolve(file);
    image.src = String(reader.result || "");
  };
  reader.onerror = () => resolve(file);
  reader.readAsDataURL(file);
});
const fuelReceiptExtension = (file: File) => {
  const fromName = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 8) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "jpg";
  return "bin";
};
'''
add_before(helper_anchor, helper_block, "fuel OCR helper")

manual_anchor = 'export default function FuelManagement({ supabase, vendors = EMPTY_STATEMENT_PARTIES }: Props) {'
manual_block = r'''const emptyManualWithOcrFields = () => ({ ...emptyManual(), supply_amount: "", vat_amount: "", total_amount: "" });
type ManualOcrField = "fuel_date" | "product_name" | "quantity" | "unit_price" | "supply_amount" | "vat_amount" | "total_amount" | "station_name";
type ManualReceipt = { file: File; previewUrl: string; name: string; mime: string };
const newManualOcrTouched = (): Record<ManualOcrField, boolean> => ({
  fuel_date: false,
  product_name: false,
  quantity: false,
  unit_price: false,
  supply_amount: false,
  vat_amount: false,
  total_amount: false,
  station_name: false,
});

'''
add_before(manual_anchor, manual_block, "fuel OCR manual type")

manual_state = '  const [manual, setManual] = useState(emptyManual);'
if manual_state in s:
    s = s.replace(manual_state, '  const [manual, setManual] = useState(emptyManualWithOcrFields);\n  const [manualReceipt, setManualReceipt] = useState<ManualReceipt | null>(null);\n  const [manualReceiptBusy, setManualReceiptBusy] = useState(false);\n  const [manualOcrState, setManualOcrState] = useState<"idle" | "analyzing" | "success" | "error">("idle");\n  const [manualOcrMessage, setManualOcrMessage] = useState("");', 1)

receipt_ref_anchor = '  const receiptInput = useRef<HTMLInputElement>(null);\n'
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
    setManual(emptyManualWithOcrFields());
    setQuickVehicle("");
    setQuickVehicleBackup(null);
    manualOcrTouched.current = newManualOcrTouched();
    clearManualReceipt();
  };

  const fuelOcrFieldLabels = (result: FuelReceiptOcrResult) => [
    result.fuelDate ? "주유일자" : "",
    result.stationName ? "주유처" : "",
    result.productName ? "유종" : "",
    result.quantity != null ? "주유량" : "",
    result.unitPrice != null ? "단가" : "",
    result.supplyAmount != null ? "공급가액" : "",
    result.vatAmount != null ? "부가세" : "",
    result.totalAmount != null ? "합계금액" : "",
  ].filter(Boolean);

  const applyFuelOcrResult = (result: FuelReceiptOcrResult) => {
    const resultProduct = String(result.productName || manual.product_name || "").trim();
    const contextUnitPrices = [
      Number(manual.unit_price || 0),
      ...referenceRecords
        .filter((record) => !resultProduct || !record.product_name || record.product_name === resultProduct)
        .map((record) => Number(record.unit_price || 0)),
    ];
    const normalizedResult = reconcileFuelReceiptOcr(result, contextUnitPrices);
    const detectedLabels = fuelOcrFieldLabels(normalizedResult);
    const hasAmountContext = result.totalAmount != null || result.supplyAmount != null;
    const rejectedLabels = [
      (result.quantity != null || hasAmountContext) && normalizedResult.quantity == null ? "주유량" : "",
      (result.unitPrice != null || hasAmountContext) && normalizedResult.unitPrice == null ? "단가" : "",
    ].filter(Boolean);
    const manualOcrFieldByLabel: Record<string, ManualOcrField> = {
      주유일자: "fuel_date",
      주유처: "station_name",
      유종: "product_name",
      주유량: "quantity",
      단가: "unit_price",
      공급가액: "supply_amount",
      부가세: "vat_amount",
      합계금액: "total_amount",
    };
    const appliedLabels = detectedLabels.filter((label) => !manualOcrTouched.current[manualOcrFieldByLabel[label]]);
    setManual((current) => ({
      ...current,
      ...(result.fuelDate && !manualOcrTouched.current.fuel_date ? { fuel_date: result.fuelDate } : {}),
      ...(result.stationName && !manualOcrTouched.current.station_name ? { station_name: result.stationName } : {}),
      ...(result.productName && !manualOcrTouched.current.product_name ? { product_name: result.productName } : {}),
      ...(normalizedResult.quantity != null && !manualOcrTouched.current.quantity ? { quantity: String(normalizedResult.quantity) } : {}),
      ...(normalizedResult.unitPrice != null && !manualOcrTouched.current.unit_price ? { unit_price: String(normalizedResult.unitPrice) } : {}),
      ...(normalizedResult.supplyAmount != null && !manualOcrTouched.current.supply_amount ? { supply_amount: String(normalizedResult.supplyAmount) } : {}),
      ...(normalizedResult.vatAmount != null && !manualOcrTouched.current.vat_amount ? { vat_amount: String(normalizedResult.vatAmount) } : {}),
      ...(normalizedResult.totalAmount != null && !manualOcrTouched.current.total_amount ? { total_amount: String(normalizedResult.totalAmount) } : {}),
    }));

    if (!detectedLabels.length) {
      setManualOcrState("error");
      setManualOcrMessage("영수증에서 유류 항목을 확인하지 못했습니다. 차량·현장 선택값은 유지했습니다. 직접 입력해 주세요.");
      return;
    }
    setManualOcrState("success");
    if (rejectedLabels.length) {
      setManualOcrMessage("영수증에서 " + detectedLabels.join("·") + "을(를) 자동 입력했습니다. " + rejectedLabels.join("·") + "은(는) 인쇄값과 금액 관계가 맞지 않아 자동 입력하지 않았습니다. 직접 확인 후 저장해 주세요.");
      return;
    }
    if (!appliedLabels.length) {
      setManualOcrMessage("영수증 분석 완료. 기존에 직접 입력한 값은 유지했습니다. 차량·현장 선택값도 유지했습니다. 확인 후 저장해 주세요.");
      return;
    }
    const missingLabels = detectedLabels.filter((label) => !appliedLabels.includes(label));
    setManualOcrMessage(
      missingLabels.length
        ? "영수증에서 " + appliedLabels.join("·") + "을(를) 자동 입력했습니다. " + missingLabels.join("·") + "은(는) 기존 입력값을 유지했습니다. 차량·현장 선택값은 유지했습니다. 확인 후 저장해 주세요."
        : "영수증에서 주유일자·주유처·유종·주유량·단가·공급가액·부가세·합계금액을 자동 입력했습니다. 차량·현장 선택값은 유지했습니다. 확인 후 저장해 주세요.",
    );
  };

  const analyzeFuelReceipt = async (file: File) => {
    setManualOcrState("analyzing");
    setManualOcrMessage("영수증 분석 중...");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("로그인 세션을 확인하지 못했습니다.");

    const dataUrl = await fileToDataUrl(file);
    const response = await fetch("/api/receipt-ocr", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + data.session.access_token,
      },
      body: JSON.stringify({ dataUrl, mode: "fuel" }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(body?.error || "영수증 OCR 분석에 실패했습니다."));
    applyFuelOcrResult(body as FuelReceiptOcrResult);
  };

  const handleManualReceiptChange = async (event: { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || manualReceiptBusyRef.current) return;

    const image = isFuelReceiptImage(file);
    const pdf = isFuelReceiptPdf(file);
    if (!image && !pdf) {
      setError("영수증은 사진 또는 PDF 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("영수증 파일은 10MB 이하만 올릴 수 있습니다.");
      return;
    }

    manualReceiptBusyRef.current = true;
    setManualReceiptBusy(true);
    setError("");
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
upload_block = r'''  const uploadReceiptForNewRecord = async (recordId: string, file: File): Promise<string | null> => {
    const extension = fuelReceiptExtension(file);
    const nextPath = "fuel/" + recordId + "/" + Date.now() + "-" + crypto.randomUUID() + "." + extension;
    const { error: uploadError } = await supabase.storage.from("fuel-receipts").upload(nextPath, file, {
      upsert: false,
      contentType: file.type || (isFuelReceiptPdf(file) ? "application/pdf" : "image/jpeg"),
    });
    if (uploadError) return "영수증 업로드에 실패했습니다. (" + uploadError.message + ")";

    const patch = {
      receipt_path: nextPath,
      receipt_name: file.name || "영수증",
      receipt_mime_type: file.type || (isFuelReceiptPdf(file) ? "application/pdf" : "image/jpeg"),
      receipt_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from("fuel_records").update(patch).eq("id", recordId);
    if (updateError) {
      await supabase.storage.from("fuel-receipts").remove([nextPath]);
      return "영수증 정보를 저장하지 못했습니다. (" + updateError.message + ")";
    }
    return null;
  };

'''
add_before(upload_anchor, upload_block, "fuel OCR upload")

save_start = '  const saveManual = async () => {'
save_end = '\n  const saveEditedRecord = async () => {'
save_start_index = s.find(save_start)
save_end_index = s.find(save_end, save_start_index)
if save_start_index < 0 or save_end_index < 0:
    raise SystemExit("fuel OCR saveManual block not found")
save_block = r'''  const saveManual = async () => {
    const quantity = asNumber(manual.quantity);
    const unitPrice = asNumber(manual.unit_price);
    if (!manual.fuel_date || !manual.vehicle_number.trim() || quantity <= 0 || unitPrice <= 0) {
      setError("일자, 차량/장비번호, 수량, 단가를 확인해 주세요.");
      return;
    }
    const calculatedSupply = Math.round(quantity * unitPrice);
    const supply = manual.supply_amount.trim() ? Math.round(asNumber(manual.supply_amount)) : calculatedSupply;
    const vat = manual.vat_amount.trim() ? Math.round(asNumber(manual.vat_amount)) : Math.round(supply * 0.1);
    const total = manual.total_amount.trim() ? Math.round(asNumber(manual.total_amount)) : supply + vat;
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
    const { error: saveError } = await supabase.from("fuel_records").insert(payload);
    if (saveError) {
      setSaving(false);
      setError("유류내역 저장에 실패했습니다. (" + saveError.message + ")");
      return;
    }
    const receiptError = manualReceipt?.file ? await uploadReceiptForNewRecord(recordId, manualReceipt.file) : null;
    setSaving(false);
    resetManualEntry();
    setManualOpen(false);
    if (payload.fuel_date.slice(0, 7) !== month) setMonth(payload.fuel_date.slice(0, 7));
    else await load();
    if (receiptError) setError("유류내역은 저장됐지만 " + receiptError + " 목록에서 다시 첨부해 주세요.");
  };
'''
s = s[:save_start_index] + save_block + s[save_end_index:]

manual_jsx_start = '    {manualOpen && <section className="fuel-manual-panel">'
manual_jsx_end = '\n\n    {editingRecord && <section className="fuel-edit-panel">'
manual_jsx_start_index = s.find(manual_jsx_start)
manual_jsx_end_index = s.find(manual_jsx_end, manual_jsx_start_index)
if manual_jsx_start_index < 0 or manual_jsx_end_index < 0:
    raise SystemExit("fuel OCR manual JSX block not found")
manual_jsx = r'''    {manualOpen && <section className="fuel-manual-panel">
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

      <div className="fuel-manual-total"><span>예상 합계</span><strong>{manual.total_amount.trim() ? money(asNumber(manual.total_amount)) + "원" : manual.quantity && manual.unit_price ? money(Math.round(asNumber(manual.quantity) * asNumber(manual.unit_price) * 1.1)) + "원" : "-"}</strong></div>
      <div className="fuel-form-actions"><button type="button" onClick={() => { resetManualEntry(); setManualOpen(false); }}>입력 닫기</button><button type="button" className="fuel-primary" disabled={saving || manualReceiptBusy} onClick={() => void saveManual()}>{saving ? "저장 중..." : "확인 후 저장"}</button></div>
    </section>}'''
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
