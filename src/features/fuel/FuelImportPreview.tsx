import { useMemo } from "react";
import { FileSpreadsheet } from "lucide-react";
import { formatFuelMoney, formatFuelNumber } from "./fuelModel";
import type { ParsedFuelRow } from "./fuelTypes";

type FuelImportPreviewProps = {
  rows: ParsedFuelRow[];
  fileName: string;
  importing: boolean;
  onCancel: () => void;
  onImport: () => void;
};

export function FuelImportPreview({ rows, fileName, importing, onCancel, onImport }: FuelImportPreviewProps) {
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    quantity: sum.quantity + row.quantity,
    total: sum.total + row.total_amount,
  }), { quantity: 0, total: 0 }), [rows]);

  return <section className="fuel-import-preview">
    <div className="fuel-preview-title"><div><FileSpreadsheet size={20} /><span><strong>{fileName}</strong><small>{rows.length}건을 찾았습니다.</small></span></div><button type="button" onClick={onCancel}>취소</button></div>
    <div className="fuel-preview-kpis"><span>수량 <b>{formatFuelNumber(totals.quantity)} L</b></span><span>합계 <b>{formatFuelMoney(totals.total)}원</b></span></div>
    <div className="fuel-preview-list">{rows.slice(0, 8).map((row, index) => <div key={`${row.source_fingerprint}-${index}`}><span>{row.fuel_date}</span><strong>{row.vehicle_number}</strong><span>{row.product_name}</span><span>{formatFuelNumber(row.quantity)}L</span><b>{formatFuelMoney(row.total_amount)}원</b></div>)}</div>
    {rows.length > 8 && <p>외 {rows.length - 8}건</p>}
    <button className="fuel-primary" type="button" disabled={importing} onClick={onImport}>{importing ? "등록 중..." : `${rows.length}건 등록`}</button>
  </section>;
}
