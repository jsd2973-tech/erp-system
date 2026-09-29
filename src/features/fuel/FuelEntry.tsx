import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asFuelNumber,
  buildFuelVehicleProfiles,
  calculateFuelAmounts,
  formatFuelMoney,
  todayKey,
} from "./fuelModel";
import { insertFuelRecord } from "./fuelService";
import { uploadFuelReceiptForNewRecord } from "./fuelReceiptService";
import type { FuelRecord } from "./fuelTypes";
import type { FuelReceiptOcrResult } from "./fuelReceiptOcr";
import {
  applyFuelReceiptOcrResult as mergeFuelReceiptOcrResult,
  compressFuelReceiptImage,
  createFuelOcrTouchedFields,
  fileToFuelDataUrl,
  isFuelReceiptImage,
  isFuelReceiptPdf,
  requestFuelReceiptOcr,
  type FuelOcrField,
} from "./fuelOcr";

type FuelEntryForm = {
  fuel_date: string;
  site_name: string;
  product_name: string;
  vehicle_number: string;
  quantity: string;
  unit_price: string;
  station_name: string;
  memo: string;
  supply_amount: string;
  vat_amount: string;
  total_amount: string;
};

type FuelEntryProps = {
  supabase: SupabaseClient;
  open: boolean;
  referenceRecords: FuelRecord[];
  allSites: string[];
  allProducts: string[];
  allStations: string[];
  vehicleOptions: string[];
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (month: string) => Promise<void>;
};

const emptyManual = (): FuelEntryForm => ({
  fuel_date: todayKey(),
  site_name: "공장",
  product_name: "경유",
  vehicle_number: "",
  quantity: "",
  unit_price: "",
  station_name: "남세종농협주유소",
  memo: "",
  supply_amount: "",
  vat_amount: "",
  total_amount: "",
});

const emptyManualWithOcrFields = () => ({ ...emptyManual(), supply_amount: "", vat_amount: "", total_amount: "" });
type ManualOcrField = FuelOcrField;
type ManualReceipt = { file: File; previewUrl: string; name: string; mime: string };
const newManualOcrTouched = createFuelOcrTouchedFields;

export default function FuelEntry({
  supabase,
  open,
  referenceRecords,
  allSites,
  allProducts,
  allStations,
  vehicleOptions,
  onClose,
  onError,
  onSaved,
}: FuelEntryProps) {
  const [manual, setManual] = useState(emptyManualWithOcrFields);
  const [manualReceipt, setManualReceipt] = useState<ManualReceipt | null>(null);
  const [manualReceiptBusy, setManualReceiptBusy] = useState(false);
  const [manualOcrState, setManualOcrState] = useState<"idle" | "analyzing" | "success" | "error">("idle");
  const [manualOcrMessage, setManualOcrMessage] = useState("");
  const [quickVehicle, setQuickVehicle] = useState("");
  const [quickVehicleBackup, setQuickVehicleBackup] = useState<Pick<FuelEntryForm, "vehicle_number" | "site_name" | "product_name" | "unit_price" | "station_name"> | null>(null);
  const [saving, setSaving] = useState(false);
  const manualCameraInput = useRef<HTMLInputElement>(null);
  const manualReceiptInput = useRef<HTMLInputElement>(null);
  const manualReceiptPreviewUrl = useRef("");
  const manualReceiptBusyRef = useRef(false);
  const manualOcrTouched = useRef<Record<ManualOcrField, boolean>>(newManualOcrTouched());

  useEffect(() => () => {
    if (manualReceiptPreviewUrl.current) URL.revokeObjectURL(manualReceiptPreviewUrl.current);
  }, []);
  const vehicleProfiles = useMemo(() => buildFuelVehicleProfiles(referenceRecords), [referenceRecords]);
  const applyVehicleProfile = (vehicle: string) => {
    const profile = vehicleProfiles.find(([name]) => name === vehicle)?.[1];
    setManual((current) => ({
      ...current,
      vehicle_number: vehicle,
      site_name: profile?.site_name || current.site_name,
      product_name: profile?.product_name || current.product_name,
      unit_price: profile?.unit_price ? String(profile.unit_price) : current.unit_price,
      station_name: profile?.station_name || current.station_name,
    }));
  };

  const updateManualField = (field: keyof ReturnType<typeof emptyManualWithOcrFields>, value: string) => {
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

  const selectQuickVehicle = (vehicle: string) => {
    setManual((current) => {
      setQuickVehicleBackup({
        vehicle_number: current.vehicle_number,
        site_name: current.site_name,
        product_name: current.product_name,
        unit_price: current.unit_price,
        station_name: current.station_name,
      });
      const profile = vehicleProfiles.find(([name]) => name === vehicle)?.[1];
      return {
        ...current,
        vehicle_number: vehicle,
        site_name: profile?.site_name || current.site_name,
        product_name: profile?.product_name || current.product_name,
        unit_price: profile?.unit_price ? String(profile.unit_price) : current.unit_price,
        station_name: profile?.station_name || current.station_name,
      };
    });
    setQuickVehicle(vehicle);
  };

  const cancelQuickVehicle = () => {
    if (quickVehicleBackup) setManual((current) => ({ ...current, ...quickVehicleBackup }));
    setQuickVehicle("");
    setQuickVehicleBackup(null);
  };

  const resetEntryFields = () => {
    setManual(emptyManual());
    setQuickVehicle("");
    setQuickVehicleBackup(null);
  };

  const uploadReceiptForNewRecord = (recordId: string, file: File): Promise<string | null> =>
    uploadFuelReceiptForNewRecord(supabase, recordId, file);

  const saveManual = async () => {
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


  return open ? <section className="fuel-manual-panel">
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
      <div className="fuel-form-actions"><button type="button" onClick={() => { resetManualEntry(); onClose(); }}>입력 닫기</button><button type="button" className="fuel-primary" disabled={saving || manualReceiptBusy} onClick={() => void saveManual()}>{saving ? "저장 중..." : "확인 후 저장"}</button></div>
  </section> : null;
}
