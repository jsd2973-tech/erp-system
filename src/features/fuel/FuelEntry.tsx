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
  const [manual, setManual] = useState(emptyManual);
  const [quickVehicle, setQuickVehicle] = useState("");
  const [quickVehicleBackup, setQuickVehicleBackup] = useState<Pick<FuelEntryForm, "vehicle_number" | "site_name" | "product_name" | "unit_price" | "station_name"> | null>(null);
  const [saving, setSaving] = useState(false);
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

  const saveManual = async () => {
    const quantity = asFuelNumber(manual.quantity);
    const unitPrice = asFuelNumber(manual.unit_price);
    if (!manual.fuel_date || !manual.vehicle_number.trim() || quantity <= 0 || unitPrice <= 0) {
      onError("일자, 차량/장비번호, 수량, 단가를 확인해 주세요.");
      return;
    }
    const { supply, vat, total } = calculateFuelAmounts(quantity, unitPrice);
    const payload = {
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
      source_fingerprint: `manual-${crypto.randomUUID()}`,
      memo: manual.memo.trim(),
    };
    setSaving(true);
    const { error: saveError } = await insertFuelRecord(supabase, payload);
    setSaving(false);
    if (saveError) {
      onError(`유류내역 저장에 실패했습니다. (${saveError.message})`);
      return;
    }
    resetEntryFields();
    onClose();
    await onSaved(payload.fuel_date.slice(0, 7));
  };

  return open ? <section className="fuel-manual-panel">
    <div className="fuel-section-title"><div><h3>유류 직접 입력</h3><p>수량 × 단가로 공급가액·부가세·합계금액을 자동 계산합니다.</p></div></div>
    <div className="fuel-manual-grid">
      <label><span>일자 *</span><input type="date" value={manual.fuel_date} onChange={(event) => setManual({ ...manual, fuel_date: event.target.value })} /></label>
      <label><span>현장</span><input list="fuel-site-options" value={manual.site_name} onChange={(event) => setManual({ ...manual, site_name: event.target.value })} placeholder="공장" /><datalist id="fuel-site-options">{allSites.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label><span>유종</span><input list="fuel-product-options" value={manual.product_name} onChange={(event) => setManual({ ...manual, product_name: event.target.value })} placeholder="경유" /><datalist id="fuel-product-options">{allProducts.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label className="fuel-vehicle-entry"><span>차량/장비번호 *</span><input list="fuel-vehicle-options" value={manual.vehicle_number} onChange={(event) => { const value = event.target.value; if (quickVehicle) { setQuickVehicle(""); setQuickVehicleBackup(null); } setManual({ ...manual, vehicle_number: value }); if (vehicleOptions.includes(value)) applyVehicleProfile(value); }} onBlur={() => { if (vehicleOptions.includes(manual.vehicle_number)) applyVehicleProfile(manual.vehicle_number); }} placeholder="번호 입력 또는 선택" /><datalist id="fuel-vehicle-options">{vehicleOptions.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label><span>수량(L) *</span><input inputMode="decimal" value={manual.quantity} onChange={(event) => setManual({ ...manual, quantity: event.target.value })} placeholder="270" /></label>
      <label><span>단가(원/L) *</span><input inputMode="decimal" value={manual.unit_price} onChange={(event) => setManual({ ...manual, unit_price: event.target.value })} placeholder="1820" /></label>
      <label><span>주유처</span><input list="fuel-station-options" value={manual.station_name} onChange={(event) => setManual({ ...manual, station_name: event.target.value })} /><datalist id="fuel-station-options">{allStations.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label><span>메모</span><input value={manual.memo} onChange={(event) => setManual({ ...manual, memo: event.target.value })} placeholder="필요 시 입력" /></label>
    </div>
    {vehicleOptions.length > 0 && !quickVehicle && <div className="fuel-quick-vehicles"><span>차량·장비 빠른 선택</span><div>{vehicleOptions.filter((name) => !manual.vehicle_number.trim() || name.toLowerCase().includes(manual.vehicle_number.trim().toLowerCase())).slice(0, 18).map((name) => <button type="button" key={name} onClick={() => selectQuickVehicle(name)}>{name}</button>)}</div><small>기존 명세서 기준으로 번호를 누르면 최근 현장·유종·단가·주유처를 자동 입력합니다.</small></div>}
    {quickVehicle && <div className="fuel-quick-selected"><div><span>빠른 선택 적용</span><strong>{quickVehicle}</strong><small>최근 현장·유종·단가·주유처가 입력되었습니다.</small></div><button type="button" onClick={cancelQuickVehicle}>선택 취소</button></div>}
    <div className="fuel-manual-total"><span>예상 합계</span><strong>{manual.quantity && manual.unit_price ? `${formatFuelMoney(Math.round(asFuelNumber(manual.quantity) * asFuelNumber(manual.unit_price) * 1.1))}원` : "-"}</strong></div>
    <div className="fuel-form-actions"><button type="button" onClick={() => { resetEntryFields(); onClose(); }}>입력 닫기</button><button type="button" className="fuel-primary" disabled={saving} onClick={() => void saveManual()}>{saving ? "저장 중..." : "저장"}</button></div>
  </section> : null;
}
