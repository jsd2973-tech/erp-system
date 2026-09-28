import type { FuelDetailTarget, FuelRecord, FuelViewMode, SummaryRow } from "./fuelTypes";
import { Paperclip, Pencil, Search, Trash2, Upload } from "lucide-react";
import { calculateFuelTotals, formatFuelMoney, formatFuelNumber, summarizeFuelDetailRecords } from "./fuelModel";

type FuelTotals = ReturnType<typeof calculateFuelTotals>;
type FuelDetailTotals = ReturnType<typeof summarizeFuelDetailRecords>;
export type FuelMobileReceiptPreview = { id: string; url: string; mime: string; name: string };

type FuelFiltersProps = {
  month: string;
  site: string;
  sites: string[];
  product: string;
  products: string[];
  vehicleSearch: string;
  onMonthChange: (value: string) => void;
  onSiteChange: (value: string) => void;
  onProductChange: (value: string) => void;
  onVehicleSearchChange: (value: string) => void;
};

export function FuelFilters({
  month,
  site,
  sites,
  product,
  products,
  vehicleSearch,
  onMonthChange,
  onSiteChange,
  onProductChange,
  onVehicleSearchChange,
}: FuelFiltersProps) {
  return <div className="fuel-toolbar">
    <label><span>조회월</span><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
    <label><span>현장</span><select value={site} onChange={(event) => onSiteChange(event.target.value)}><option value="">전체 현장</option>{sites.map((name) => <option key={name}>{name}</option>)}</select></label>
    <label><span>유종</span><select value={product} onChange={(event) => onProductChange(event.target.value)}><option value="">전체 유종</option>{products.map((name) => <option key={name}>{name}</option>)}</select></label>
    <label className="fuel-search"><span>차량/장비</span><div><Search size={15} /><input value={vehicleSearch} onChange={(event) => onVehicleSearchChange(event.target.value)} placeholder="차량번호 검색" /></div></label>
  </div>;
}

export function FuelKpis({ totals }: { totals: FuelTotals }) {
  return <div className="fuel-kpis">
    <article><span>총 유류비</span><strong>{formatFuelMoney(totals.total)}<small>원</small></strong></article>
    <article><span>전체 수량</span><strong>{formatFuelNumber(totals.quantity)}<small>L</small></strong></article>
    <article><span>경유</span><strong>{formatFuelNumber(totals.diesel)}<small>L</small></strong></article>
    <article><span>요소수</span><strong>{formatFuelNumber(totals.urea)}<small>L</small></strong></article>
    <article><span>주유 횟수</span><strong>{formatFuelNumber(totals.count)}<small>회</small></strong></article>
  </div>;
}

export function FuelTabs({ view, onChange }: { view: FuelViewMode; onChange: (view: FuelViewMode) => void }) {
  return <nav className="fuel-tabs" aria-label="유류관리 보기">
    <button type="button" aria-pressed={view === "records"} onClick={() => onChange("records")}>주유내역</button>
    <button type="button" aria-pressed={view === "vehicle"} onClick={() => onChange("vehicle")}>차량·장비별</button>
    <button type="button" aria-pressed={view === "site"} onClick={() => onChange("site")}>현장별</button>
    <button type="button" aria-pressed={view === "station"} onClick={() => onChange("station")}>주유소별</button>
  </nav>;
}

type FuelReceiptActions = {
  onToggleReceipt: (record: FuelRecord) => void;
  onReplaceReceiptForRecord: (record: FuelRecord) => void;
  onDeleteReceiptForRecord: (record: FuelRecord) => void;
};

type FuelRecordActions = FuelReceiptActions & {
  onEdit: (record: FuelRecord) => void;
  onDelete: (record: FuelRecord) => void;
};

type FuelRecordListProps = FuelRecordActions & {
  filtered: FuelRecord[];
  receiptBusy: boolean;
  mobileReceiptPreview: FuelMobileReceiptPreview | null;
};

export function FuelRecordList({
  filtered,
  receiptBusy,
  mobileReceiptPreview,
  onEdit,
  onDelete,
  onToggleReceipt,
  onReplaceReceiptForRecord,
  onDeleteReceiptForRecord,
}: FuelRecordListProps) {
  const setEditingRecord = (record: FuelRecord) => onEdit(record);
  const removeRecord = (record: FuelRecord) => onDelete(record);
  const toggleMobileReceipt = (record: FuelRecord) => onToggleReceipt(record);
  const replaceReceiptForRecord = (record: FuelRecord) => onReplaceReceiptForRecord(record);
  const deleteReceiptForRecord = (record: FuelRecord) => onDeleteReceiptForRecord(record);

  return <>
    <div className="fuel-table-wrap">
      <table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계금액</th><th>주유처</th><th></th></tr></thead><tbody>
        {!filtered.length ? <tr><td colSpan={12} className="fuel-empty-cell">조건에 맞는 유류내역이 없습니다.</td></tr> : filtered.map((record) => <tr key={record.id}>
          <td>{record.fuel_date}</td><td>{record.site_name}</td><td>{record.product_name}</td><td className="fuel-strong">{record.vehicle_number}</td><td>{record.usage_count}회</td><td className="fuel-number">{formatFuelNumber(record.quantity)} L</td><td className="fuel-number">{formatFuelMoney(record.unit_price)}</td><td className="fuel-number">{formatFuelMoney(record.supply_amount)}</td><td className="fuel-number">{formatFuelMoney(record.vat_amount)}</td><td className="fuel-number fuel-total">{formatFuelMoney(record.total_amount)}</td><td>{record.station_name}</td><td><div className="fuel-row-actions"><button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button><button className="fuel-icon-button" type="button" title="수정" onClick={() => setEditingRecord({ ...record })}><Pencil size={15} /></button><button className="fuel-icon-button" type="button" title="삭제" onClick={() => void removeRecord(record)}><Trash2 size={15} /></button></div></td>
        </tr>)}
      </tbody></table>
    </div>
    <div className="fuel-mobile-list">{!filtered.length ? <div className="fuel-empty">조건에 맞는 유류내역이 없습니다.</div> : filtered.map((record) => <article key={record.id}>
      <header><div><strong>{record.vehicle_number}</strong><span>{record.site_name} · {record.product_name}</span></div><b>{record.fuel_date}</b></header>
      <div><span>수량 <strong>{formatFuelNumber(record.quantity)} L</strong></span><span>단가 <strong>{formatFuelMoney(record.unit_price)}원</strong></span><span>횟수 <strong>{record.usage_count}회</strong></span><span>합계 <strong>{formatFuelMoney(record.total_amount)}원</strong></span></div>
      <footer><span>{record.station_name}</span><div className="fuel-mobile-actions"><button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증" : "첨부"}</button><button type="button" onClick={() => setEditingRecord({ ...record })}><Pencil size={14} /> 수정</button><button type="button" onClick={() => void removeRecord(record)}><Trash2 size={14} /> 삭제</button></div></footer>
    </article>)}</div>
  </>;
}

type FuelSummaryViewProps = FuelReceiptActions & {
  view: FuelViewMode;
  vehicleSummary: SummaryRow[];
  siteSummary: SummaryRow[];
  stationSummary: SummaryRow[];
  detailTarget: FuelDetailTarget | null;
  detailRows: FuelRecord[];
  detailTotals: FuelDetailTotals;
  onDetailTarget: (target: FuelDetailTarget | null) => void;
  receiptBusy: boolean;
  mobileReceiptPreview: FuelMobileReceiptPreview | null;
};

export function FuelSummaryView({
  view,
  vehicleSummary,
  siteSummary,
  stationSummary,
  detailTarget,
  detailRows,
  detailTotals,
  onDetailTarget,
  receiptBusy,
  mobileReceiptPreview,
  onToggleReceipt,
  onReplaceReceiptForRecord,
  onDeleteReceiptForRecord,
}: FuelSummaryViewProps) {
  const toggleMobileReceipt = (record: FuelRecord) => onToggleReceipt(record);
  const replaceReceiptForRecord = (record: FuelRecord) => onReplaceReceiptForRecord(record);
  const deleteReceiptForRecord = (record: FuelRecord) => onDeleteReceiptForRecord(record);
  const summaries = view === "vehicle" ? vehicleSummary : view === "site" ? siteSummary : stationSummary;
  const targetFor = (name: string): FuelDetailTarget => ({
    type: view === "vehicle" ? "vehicle" : view === "site" ? "site" : "station",
    name,
  });

  return <>
    <div className="fuel-summary-list">
      {summaries.length ? summaries.map((row, index) => <article key={row.name} className="fuel-summary-clickable" role="button" tabIndex={0} onClick={() => onDetailTarget(targetFor(row.name))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onDetailTarget(targetFor(row.name)); }}>
        <span className="fuel-rank">{index + 1}</span><div><strong>{row.name}</strong><small>{formatFuelNumber(row.quantity)} L · {row.count}회</small></div><b>{formatFuelMoney(row.total)}원</b>
      </article>) : <div className="fuel-empty">집계할 내역이 없습니다.</div>}
    </div>
    {detailTarget && <section className="fuel-drilldown">
      <header><div><span>{detailTarget.type === "vehicle" ? "차량·장비 상세" : detailTarget.type === "site" ? "현장 상세" : "주유소 상세"}</span><h3>{detailTarget.name}</h3></div><button type="button" onClick={() => onDetailTarget(null)}>닫기</button></header>
      <div className="fuel-drilldown-kpis"><span>주유 <b>{detailTotals.count}회</b></span><span>수량 <b>{formatFuelNumber(detailTotals.quantity)} L</b></span><span>합계 <b>{formatFuelMoney(detailTotals.total)}원</b></span></div>
      <div className="fuel-table-wrap"><table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>합계금액</th><th>주유처</th><th>영수증</th></tr></thead><tbody>{detailRows.map((record) => <tr key={record.id}><td>{record.fuel_date}</td><td>{record.site_name}</td><td>{record.product_name}</td><td className="fuel-strong">{record.vehicle_number}</td><td>{record.usage_count}회</td><td className="fuel-number">{formatFuelNumber(record.quantity)} L</td><td className="fuel-number">{formatFuelMoney(record.unit_price)}</td><td className="fuel-number fuel-total">{formatFuelMoney(record.total_amount)}</td><td>{record.station_name}</td><td><button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button></td></tr>)}</tbody></table></div>
      <div className="fuel-mobile-list">{detailRows.map((record) => <article key={record.id}><header><div><strong>{record.vehicle_number}</strong><span>{record.site_name} · {record.product_name}</span></div><b>{record.fuel_date}</b></header><div><span>수량 <strong>{formatFuelNumber(record.quantity)} L</strong></span><span>단가 <strong>{formatFuelMoney(record.unit_price)}원</strong></span><span>횟수 <strong>{record.usage_count}회</strong></span><span>합계 <strong>{formatFuelMoney(record.total_amount)}원</strong></span></div><footer><span>{record.station_name}</span><div className="fuel-mobile-actions"><button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증" : "첨부"}</button></div></footer></article>)}</div>
    </section>}
  </>;
}

export function FuelRecordEditForm({
  record,
  allSites,
  allProducts,
  allStations,
  vehicleOptions,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  record: FuelRecord;
  allSites: string[];
  allProducts: string[];
  allStations: string[];
  vehicleOptions: string[];
  saving: boolean;
  onChange: (record: FuelRecord) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return <section className="fuel-edit-panel">
    <div className="fuel-section-title"><div><h3>주유내역 수정</h3><p>현장·유종·차량/장비번호·주유처를 수정할 수 있습니다.</p></div></div>
    <div className="fuel-manual-grid">
      <label><span>일자 *</span><input type="date" value={record.fuel_date} onChange={(event) => onChange({ ...record, fuel_date: event.target.value })} /></label>
      <label><span>현장</span><input list="fuel-edit-site-options" value={record.site_name} onChange={(event) => onChange({ ...record, site_name: event.target.value })} /><datalist id="fuel-edit-site-options">{allSites.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label><span>유종</span><input list="fuel-edit-product-options" value={record.product_name} onChange={(event) => onChange({ ...record, product_name: event.target.value })} /><datalist id="fuel-edit-product-options">{allProducts.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label><span>차량/장비번호 *</span><input list="fuel-edit-vehicle-options" value={record.vehicle_number} onChange={(event) => onChange({ ...record, vehicle_number: event.target.value })} /><datalist id="fuel-edit-vehicle-options">{vehicleOptions.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label><span>주유처</span><input list="fuel-edit-station-options" value={record.station_name} onChange={(event) => onChange({ ...record, station_name: event.target.value })} /><datalist id="fuel-edit-station-options">{allStations.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label><span>메모</span><input value={record.memo || ""} onChange={(event) => onChange({ ...record, memo: event.target.value })} /></label>
    </div>
    <div className="fuel-form-actions"><button type="button" onClick={onCancel}>취소</button><button type="button" className="fuel-primary" disabled={saving} onClick={onSave}>{saving ? "저장 중..." : "수정 저장"}</button></div>
  </section>;
}
