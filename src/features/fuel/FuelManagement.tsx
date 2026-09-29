import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { Download, Eye, Fuel, Plus, RefreshCcw, Settings2, Trash2, Upload } from "lucide-react";
import { buildFuelStatementWorkbook, type FuelStatementParty } from "./fuelStatementExport";
import {
  buildFuelVehicleProfiles,
  calculateFuelTotals,
  compareFuelNames as natural,
  currentFuelMonth as currentMonth,
  filterFuelDetailRecords,
  filterFuelRecords,
  formatFuelMoney as money,
  formatFuelNumber as number,
  fuelMonthBounds as monthBounds,
  getManagedFuelOptions,
  summarizeFuelDetailRecords,
  summarizeFuelRecords,
  todayKey,
} from "./fuelModel";
import { parseFuelFile } from "./fuelImport";
import { FuelImportPreview } from "./FuelImportPreview";
import FuelEntry from "./FuelEntry";
import { FuelFilters, FuelKpis, FuelRecordEditForm, FuelRecordList, FuelSummaryView, FuelTabs } from "./FuelScreens";
import {
  addFuelMasterOption,
  deleteFuelRecord,
  getFuelMasterOptions,
  getFuelRecords,
  getFuelReferenceRecords,
  getFuelStatementParties,
  importFuelRows,
  renameFuelMasterOption,
  setFuelMasterOptionActive,
  updateFuelRecord,
} from "./fuelService";
import {
  clearFuelRecordReceipt,
  getFuelReceiptSignedUrl,
  removeFuelReceiptObject,
  uploadFuelRecordReceipt,
} from "./fuelReceiptService";
import type {
  FuelDetailTarget,
  FuelManagementProps as Props,
  FuelMasterCategory,
  FuelMasterOption,
  FuelRecord,
  FuelViewMode as ViewMode,
  ParsedFuelRow,
} from "./fuelTypes";
import "./fuelManagement.css";
import "./fuelTableAlignment.css";
import "./fuelQuickSelect.css";

const EMPTY_STATEMENT_PARTIES: FuelStatementParty[] = [];

export default function FuelManagement({ supabase, vendors = EMPTY_STATEMENT_PARTIES }: Props) {
  const [month, setMonth] = useState(currentMonth);
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [referenceRecords, setReferenceRecords] = useState<FuelRecord[]>([]);
  const [masterOptions, setMasterOptions] = useState<FuelMasterOption[]>([]);
  const [masterInputs, setMasterInputs] = useState<Record<FuelMasterCategory, string>>({ vehicle: "", station: "", product: "", site: "" });
  const [masterDrafts, setMasterDrafts] = useState<Record<string, string>>({});
  const [masterSaving, setMasterSaving] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [site, setSite] = useState("");
  const [product, setProduct] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [view, setView] = useState<ViewMode>("records");
  const [detailTarget, setDetailTarget] = useState<FuelDetailTarget | null>(null);
  const [preview, setPreview] = useState<ParsedFuelRow[]>([]);
  const [previewFile, setPreviewFile] = useState("");
  const [importing, setImporting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<FuelRecord | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [mobileReceiptPreview, setMobileReceiptPreview] = useState<{ id: string; url: string; mime: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await getFuelRecords(supabase, month);
    if (loadError) {
      setError(`유류내역을 불러오지 못했습니다. (${loadError.message})`);
      setRecords([]);
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [month]);
  const loadMasters = async () => {
    const { data, error: masterError } = await getFuelMasterOptions(supabase);
    if (masterError) {
      setError(`유류 기초등록을 불러오지 못했습니다. (${masterError.message})`);
      return;
    }
    const rows = data;
    setMasterOptions(rows);
    setMasterDrafts(Object.fromEntries(rows.map((row)=>[row.id,row.name])));
  };
  useEffect(() => { void loadMasters(); }, []);
  useEffect(() => {
    const loadReferences = async () => {
      const { data } = await getFuelReferenceRecords(supabase);
      if (data) setReferenceRecords(data);
    };
    void loadReferences();
  }, [supabase]);

  const sites = useMemo(() => [...new Set(records.map((record) => record.site_name).filter(Boolean))].sort(natural), [records]);
  const products = useMemo(() => [...new Set(records.map((record) => record.product_name).filter(Boolean))].sort(natural), [records]);
  const filtered = useMemo(() => filterFuelRecords(records, { site, product, vehicleSearch }), [records, site, product, vehicleSearch]);
  const totals = useMemo(() => calculateFuelTotals(filtered), [filtered]);
  const vehicleSummary = useMemo(() => summarizeFuelRecords(filtered, "vehicle_number"), [filtered]);
  const siteSummary = useMemo(() => summarizeFuelRecords(filtered, "site_name"), [filtered]);
  const stationSummary = useMemo(() => summarizeFuelRecords(filtered, "station_name"), [filtered]);
  const detailRows = useMemo(() => filterFuelDetailRecords(filtered, detailTarget), [detailTarget, filtered]);
  const detailTotals = useMemo(() => summarizeFuelDetailRecords(detailRows), [detailRows]);
  const vehicleProfiles = useMemo(() => buildFuelVehicleProfiles(referenceRecords), [referenceRecords]);
  const vehicleOptions = useMemo(() => getManagedFuelOptions("vehicle", masterOptions, vehicleProfiles.map(([vehicle]) => vehicle)), [masterOptions, vehicleProfiles]);
  const allSites = useMemo(() => getManagedFuelOptions("site", masterOptions, referenceRecords.map((record) => String(record.site_name || ""))), [masterOptions, referenceRecords]);
  const allProducts = useMemo(() => getManagedFuelOptions("product", masterOptions, referenceRecords.map((record) => String(record.product_name || ""))), [masterOptions, referenceRecords]);
  const allStations = useMemo(() => getManagedFuelOptions("station", masterOptions, ["남세종농협주유소", "믿음주유소", ...referenceRecords.map((record) => String(record.station_name || ""))]), [masterOptions, referenceRecords]);

  const addMasterOption = async (category: FuelMasterCategory) => {
    const name=masterInputs[category].trim();
    if (!name) return;
    setMasterSaving(`add-${category}`); setError("");
    const { error: addError } = await addFuelMasterOption(supabase, category, name);
    setMasterSaving("");
    if (addError) { setError(addError.code === "23505" ? "이미 등록된 항목입니다." : `기초항목을 추가하지 못했습니다. (${addError.message})`); return; }
    setMasterInputs((current)=>({ ...current, [category]:"" }));
    await loadMasters();
  };
  const saveMasterOption = async (row: FuelMasterOption) => {
    const name=(masterDrafts[row.id] ?? row.name).trim();
    if (!name) return;
    setMasterSaving(row.id); setError("");
    const { error: saveError } = await renameFuelMasterOption(supabase, row, name);
    setMasterSaving("");
    if (saveError) { setError(saveError.code === "23505" ? "같은 분류에 이미 등록된 이름입니다." : `기초항목을 수정하지 못했습니다. (${saveError.message})`); return; }
    await loadMasters();
  };
  const toggleMasterOption = async (row: FuelMasterOption) => {
    setMasterSaving(row.id); setError("");
    const { error: toggleError } = await setFuelMasterOptionActive(supabase, row, !row.is_active);
    setMasterSaving("");
    if (toggleError) { setError(`사용 상태를 바꾸지 못했습니다. (${toggleError.message})`); return; }
    await loadMasters();
  };
  const masterGroups: Array<{ category:FuelMasterCategory; title:string; placeholder:string }> = [
    { category:"vehicle", title:"차량·장비번호", placeholder:"예: 세종03가1166 / WA500-8" },
    { category:"station", title:"주유처", placeholder:"예: 믿음주유소" },
    { category:"product", title:"유종", placeholder:"예: 경유 / 요소수" },
    { category:"site", title:"현장", placeholder:"예: 공장 / 국회" },
  ];

  const applyModernSheetStyle = (ws: XLSX.WorkSheet, headerRow: number, lastRow: number, lastCol: number, totalRow?: number) => {
    const thin = { style: "thin", color: { rgb: "D7E0EA" } } as const;
    for (let row = headerRow; row <= lastRow; row += 1) {
      for (let col = 0; col <= lastCol; col += 1) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
        if (!cell) continue;
        const isHeader = row === headerRow;
        const isTotal = totalRow === row;
        const isAlt = !isHeader && !isTotal && (row - headerRow) % 2 === 0;
        cell.s = { font: { name: "맑은 고딕", sz: 10, bold: isHeader || isTotal, color: { rgb: isHeader ? "FFFFFF" : isTotal ? "12324A" : "263746" } }, fill: { patternType: "solid", fgColor: { rgb: isHeader ? "1F4E78" : isTotal ? "DDEBF7" : isAlt ? "F6F9FC" : "FFFFFF" } }, alignment: { vertical: "center", horizontal: isHeader ? "center" : col >= 4 ? "right" : "left", wrapText: true }, border: { top: thin, bottom: thin, left: thin, right: thin } };
      }
    }
    ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({ r: lastRow, c: lastCol })}` };
    ws["!rows"] = Array.from({ length: lastRow + 1 }, (_, index) => ({ hpt: index === headerRow ? 24 : 20 }));
  };
  const exportGeneralExcel = () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const header=["일자","현장","유종","차량/장비번호","횟수","수량(L)","단가(원/L)","공급가액","부가세","합계금액","주유처","메모"];
    const ordered=[...filtered].sort((a,b)=>b.fuel_date.localeCompare(a.fuel_date)||natural(a.vehicle_number,b.vehicle_number));
    const body=ordered.map((record)=>[record.fuel_date,record.site_name,record.product_name,record.vehicle_number,record.usage_count,record.quantity,record.unit_price,record.supply_amount,record.vat_amount,record.total_amount,record.station_name,record.memo||""]);
    const sums=ordered.reduce((acc,record)=>({count:acc.count+record.usage_count,qty:acc.qty+record.quantity,supply:acc.supply+record.supply_amount,vat:acc.vat+record.vat_amount,total:acc.total+record.total_amount}),{count:0,qty:0,supply:0,vat:0,total:0});
    const aoa=[[`${month.replace("-","년 ")}월 유류관리 내역`],["조회기간",`${month}-01 ~ ${monthBounds(month).to}`],["총 주유비",sums.total,"원","총 수량",sums.qty,"L","총 주유횟수",sums.count,"회"],[],header,...body,["합계","","","",sums.count,sums.qty,"",sums.supply,sums.vat,sums.total,"",""]];
    const ws=XLSX.utils.aoa_to_sheet(aoa); ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:11}}]; ws["!cols"]=[12,15,12,18,8,12,14,14,12,15,21,24].map((wch)=>({wch}));
    if(ws["A1"]) ws["A1"].s={font:{name:"맑은 고딕",sz:18,bold:true,color:{rgb:"FFFFFF"}},fill:{patternType:"solid",fgColor:{rgb:"12324A"}},alignment:{horizontal:"left",vertical:"center"}};
    ["A2","A3","D3","G3"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"52677A"}},alignment:{vertical:"center"}}; });
    ["B2","B3","E3","H3"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"12324A"}},alignment:{vertical:"center"}}; });
    ["B3","E3","H3"].forEach((ref)=>{ if(ws[ref]) ws[ref].z="#,##0"; });
    const lastRow=aoa.length-1; applyModernSheetStyle(ws,4,lastRow,11,lastRow); for(let r=5;r<=lastRow;r+=1){ [5,6,7,8,9].forEach((c)=>{ const cell=ws[XLSX.utils.encode_cell({r,c})]; if(cell) cell.z="#,##0"; }); } (ws["!rows"] ||= [])[0]={hpt:32};
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"유류내역"); XLSX.writeFile(wb,`유류내역_${month}.xlsx`);
  };
  const exportStatementExcel = async () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const filterSummary = [
      site ? `현장: ${site}` : "전체 현장",
      product ? `유종: ${product}` : "전체 유종",
      vehicleSearch.trim() ? `차량/장비: ${vehicleSearch.trim()}` : "전체 차량/장비",
    ].join(" · ");
    const { data: freshVendors } = await getFuelStatementParties(supabase);
    const workbook = buildFuelStatementWorkbook(filtered, {
      month,
      issueDate: todayKey(),
      filterSummary,
      parties: freshVendors?.length ? freshVendors : vendors,
    });
    XLSX.writeFile(workbook, `유류거래명세서_${month}.xlsx`);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const rows = await parseFuelFile(file, month);
      setPreview(rows);
      setPreviewFile(file.name);
    } catch (cause) {
      setPreview([]);
      setPreviewFile("");
      setError(cause instanceof Error ? cause.message : "파일을 읽지 못했습니다.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const importPreview = async () => {
    if (!preview.length) return;
    setImporting(true);
    setError("");
    const payload = preview.map((row) => ({ ...row, source_file: previewFile || row.source_file }));
    const { error: importError } = await importFuelRows(supabase, payload);
    setImporting(false);
    if (importError) {
      setError(`파일 등록에 실패했습니다. (${importError.message})`);
      return;
    }
    const importedMonth = preview[0]?.fuel_date.slice(0, 7);
    setPreview([]);
    setPreviewFile("");
    if (importedMonth && importedMonth !== month) setMonth(importedMonth);
    else await load();
  };

  const saveEditedRecord = async () => {
    if (!editingRecord) return;
    if (!editingRecord.fuel_date || !editingRecord.vehicle_number.trim()) { setError("일자와 차량/장비번호를 확인해주세요."); return; }
    setEditSaving(true); setError("");
    const payload = {
      fuel_date: editingRecord.fuel_date,
      site_name: editingRecord.site_name.trim() || "미지정",
      product_name: editingRecord.product_name.trim() || "경유",
      vehicle_number: editingRecord.vehicle_number.trim(),
      station_name: editingRecord.station_name.trim() || "미지정 주유소",
      memo: String(editingRecord.memo || "").trim(),
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await updateFuelRecord(supabase, editingRecord.id, payload);
    setEditSaving(false);
    if (updateError) { setError(`유류내역을 수정하지 못했습니다. (${updateError.message})`); return; }
    setEditingRecord(null);
    await load();
  };

  const removeRecord = async (record: FuelRecord) => {
    if (!window.confirm(`${record.fuel_date} / ${record.vehicle_number} / ${record.product_name} ${number(record.quantity)}L 내역을 삭제할까요?`)) return;
    const { error: deleteError } = await deleteFuelRecord(supabase, record.id);
    if (deleteError) return setError(`삭제하지 못했습니다. (${deleteError.message})`);
    if (record.receipt_path) await removeFuelReceiptObject(supabase, record.receipt_path);
    if (receiptTarget?.id === record.id) setReceiptTarget(null);
    await load();
  };

  const uploadReceipt = async (file?: File) => {
    if (!receiptTarget || !file) return;
    if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
      setError("영수증은 사진 또는 PDF 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("영수증 파일은 10MB 이하만 올릴 수 있습니다.");
      return;
    }
    setReceiptBusy(true); setError("");
    const { patch, error: uploadError } = await uploadFuelRecordReceipt(supabase, receiptTarget, file);
    if (uploadError || !patch) {
      setReceiptBusy(false);
      setError(uploadError || "영수증 정보를 저장하지 못했습니다.");
      return;
    }
    setReceiptTarget({ ...receiptTarget, ...patch });
    setReceiptPreviewUrl("");
    setMobileReceiptPreview(null);
    if (receiptInput.current) receiptInput.current.value = "";
    setReceiptBusy(false);
    await load();
  };

  const viewReceipt = async () => {
    if (!receiptTarget?.receipt_path) return;
    setReceiptBusy(true); setError(""); setReceiptPreviewUrl("");
    const { data, error: signedError } = await getFuelReceiptSignedUrl(supabase, receiptTarget.receipt_path);
    setReceiptBusy(false);
    if (signedError || !data?.signedUrl) { setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`); return; }
    setReceiptPreviewUrl(data.signedUrl);
  };

  const toggleMobileReceipt = async (record: FuelRecord) => {
    if (!record.receipt_path) {
      setMobileReceiptPreview(null);
      setReceiptTarget({ ...record });
      return;
    }
    if (mobileReceiptPreview?.id === record.id) {
      setMobileReceiptPreview(null);
      return;
    }
    setReceiptBusy(true); setError("");
    const { data, error: signedError } = await getFuelReceiptSignedUrl(supabase, record.receipt_path);
    setReceiptBusy(false);
    if (signedError || !data?.signedUrl) { setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`); return; }
    setMobileReceiptPreview({ id: record.id, url: data.signedUrl, mime: record.receipt_mime_type || "", name: record.receipt_name || "영수증" });
  };

  const replaceReceiptForRecord = (record: FuelRecord) => {
    setReceiptTarget({ ...record });
    setError("");
    window.setTimeout(() => receiptInput.current?.click(), 0);
  };

  const deleteReceiptForRecord = async (record: FuelRecord) => {
    if (!record.receipt_path) return;
    if (!window.confirm(`${record.fuel_date} / ${record.vehicle_number} 영수증을 삭제할까요?`)) return;
    const oldPath = record.receipt_path;
    setReceiptBusy(true); setError("");
    const { patch, updateError, removeError } = await clearFuelRecordReceipt(supabase, record.id, oldPath);
    if (updateError || !patch) { setReceiptBusy(false); setError(`영수증 정보를 삭제하지 못했습니다. (${updateError?.message || "알 수 없는 오류"})`); return; }
    if (receiptTarget?.id === record.id) setReceiptTarget({ ...record, ...patch });
    setReceiptPreviewUrl("");
    setMobileReceiptPreview(null);
    setReceiptBusy(false);
    if (removeError) setError(`영수증 정보는 삭제됐지만 파일 정리에 실패했습니다. (${removeError.message})`);
    await load();
  };

  const deleteReceipt = async () => {
    if (!receiptTarget?.receipt_path) return;
    if (!window.confirm(`${receiptTarget.fuel_date} / ${receiptTarget.vehicle_number} 영수증을 삭제할까요?`)) return;
    const oldPath = receiptTarget.receipt_path;
    setReceiptBusy(true); setError("");
    const { patch, updateError, removeError } = await clearFuelRecordReceipt(supabase, receiptTarget.id, oldPath);
    if (updateError || !patch) { setReceiptBusy(false); setError(`영수증 정보를 삭제하지 못했습니다. (${updateError?.message || "알 수 없는 오류"})`); return; }
    setReceiptTarget({ ...receiptTarget, ...patch });
    setReceiptPreviewUrl("");
    setMobileReceiptPreview(null);
    setReceiptBusy(false);
    if (removeError) setError(`영수증 정보는 삭제됐지만 파일 정리에 실패했습니다. (${removeError.message})`);
    await load();
  };

  return <section className="fuel-management">
    <header className="fuel-head">
      <div><span className="fuel-eyebrow">EQUIPMENT FUEL CONTROL</span><h2><Fuel size={25} /> 유류관리</h2><p>장비·차량별 경유/요소수 사용량과 비용을 월별로 관리합니다.</p></div>
      <div className="fuel-head-actions">
        <input ref={fileInput} type="file" accept=".xls,.xlsx,.csv,.html" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
        <button type="button" onClick={() => fileInput.current?.click()}><Upload size={16} /> 명세서 가져오기</button>
        <button type="button" onClick={() => setManualOpen((value) => !value)}><Plus size={16} /> 직접 입력</button>
        <button type="button" className={view === "basics" ? "fuel-basics-action is-active" : "fuel-basics-action"} onClick={() => { setView((current) => current === "basics" ? "records" : "basics"); setDetailTarget(null); }}><Settings2 size={16} /> {view === "basics" ? "주유내역 보기" : "기초등록"}</button>
        <span className="fuel-action-divider" aria-hidden="true" />
        <button type="button" onClick={exportStatementExcel}><Download size={16} /> 명세서 엑셀</button>
        <button type="button" onClick={exportGeneralExcel}><Download size={16} /> 목록 엑셀</button>
        <button type="button" onClick={() => void load()} disabled={loading}><RefreshCcw size={16} /> 새로고침</button>
      </div>
    </header>

    {error && <div className="fuel-error">{error}</div>}

    {preview.length > 0 && <FuelImportPreview
      rows={preview}
      fileName={previewFile}
      importing={importing}
      onCancel={() => { setPreview([]); setPreviewFile(""); }}
      onImport={() => void importPreview()}
    />}

    <FuelEntry
      supabase={supabase}
      open={manualOpen}
      referenceRecords={referenceRecords}
      allSites={allSites}
      allProducts={allProducts}
      allStations={allStations}
      vehicleOptions={vehicleOptions}
      onClose={() => setManualOpen(false)}
      onError={setError}
      onSaved={async (savedMonth) => {
        setManualOpen(false);
        if (savedMonth !== month) setMonth(savedMonth);
        else await load();
      }}
    />

    {editingRecord && <FuelRecordEditForm
      record={editingRecord}
      allSites={allSites}
      allProducts={allProducts}
      allStations={allStations}
      vehicleOptions={vehicleOptions}
      saving={editSaving}
      onChange={setEditingRecord}
      onCancel={() => setEditingRecord(null)}
      onSave={() => void saveEditedRecord()}
    />}

    {receiptTarget && <section className="fuel-edit-panel">
      <div className="fuel-section-title"><div><h3>영수증 첨부</h3><p>{receiptTarget.fuel_date} · {receiptTarget.vehicle_number} · {money(receiptTarget.total_amount)}원</p></div></div>
      <input ref={receiptInput} type="file" accept="image/*,application/pdf" hidden onChange={(event) => void uploadReceipt(event.target.files?.[0])} />
      <div className="fuel-manual-total"><span>첨부 상태</span><strong>{receiptTarget.receipt_path ? receiptTarget.receipt_name || "영수증 첨부됨" : "첨부된 영수증 없음"}</strong></div>
      {receiptPreviewUrl && <div className="fuel-receipt-preview">
        {receiptTarget.receipt_mime_type === "application/pdf" || /\.pdf$/i.test(receiptTarget.receipt_name || "")
          ? <iframe src={receiptPreviewUrl} title="영수증 PDF 미리보기" />
          : <img src={receiptPreviewUrl} alt={receiptTarget.receipt_name || "영수증"} />}
      </div>}
      <div className="fuel-form-actions">
        <button type="button" disabled={receiptBusy} onClick={() => { setReceiptPreviewUrl(""); setReceiptTarget(null); }}>닫기</button>
        {receiptTarget.receipt_path && <button type="button" disabled={receiptBusy} onClick={() => void viewReceipt()}><Eye size={15} /> 보기</button>}
        {receiptTarget.receipt_path && <button type="button" disabled={receiptBusy} onClick={() => void deleteReceipt()}><Trash2 size={15} /> 영수증 삭제</button>}
        <button type="button" className="fuel-primary" disabled={receiptBusy} onClick={() => receiptInput.current?.click()}><Upload size={15} /> {receiptTarget.receipt_path ? "영수증 교체" : "영수증 첨부"}</button>
      </div>
    </section>}

    {view !== "basics" && <>
      <FuelFilters
        month={month}
        site={site}
        sites={sites}
        product={product}
        products={products}
        vehicleSearch={vehicleSearch}
        onMonthChange={setMonth}
        onSiteChange={setSite}
        onProductChange={setProduct}
        onVehicleSearchChange={setVehicleSearch}
      />
      <FuelKpis totals={totals} />
      <FuelTabs view={view} onChange={(nextView) => { setView(nextView); setDetailTarget(null); }} />
    </>}

    {view === "basics" ? <section className="fuel-master-grid">
      {masterGroups.map((group)=><article className="fuel-master-card" key={group.category}>
        <header><div><h3>{group.title}</h3><span>{masterOptions.filter((row)=>row.category===group.category && row.is_active).length}개 사용중</span></div></header>
        <div className="fuel-master-add"><input value={masterInputs[group.category]} onChange={(event)=>setMasterInputs((current)=>({ ...current, [group.category]:event.target.value }))} onKeyDown={(event)=>{ if(event.key==="Enter") void addMasterOption(group.category); }} placeholder={group.placeholder}/><button type="button" disabled={masterSaving===`add-${group.category}`} onClick={()=>void addMasterOption(group.category)}>추가</button></div>
        <div className="fuel-master-list">{masterOptions.filter((row)=>row.category===group.category).sort((a,b)=>Number(b.is_active)-Number(a.is_active)||natural(a.name,b.name)).map((row)=><div className={row.is_active ? "" : "is-inactive"} key={row.id}><input value={masterDrafts[row.id] ?? row.name} onChange={(event)=>setMasterDrafts((current)=>({ ...current, [row.id]:event.target.value }))}/><button type="button" disabled={masterSaving===row.id || (masterDrafts[row.id] ?? row.name).trim()===row.name} onClick={()=>void saveMasterOption(row)}>저장</button><button type="button" className="fuel-master-toggle" disabled={masterSaving===row.id} onClick={()=>void toggleMasterOption(row)}>{row.is_active ? "미사용" : "사용"}</button></div>)}</div>
      </article>)}
    </section> : loading ? <div className="fuel-empty">유류내역을 불러오는 중...</div> : view === "records" ? <FuelRecordList
      filtered={filtered}
      receiptBusy={receiptBusy}
      mobileReceiptPreview={mobileReceiptPreview}
      onEdit={setEditingRecord}
      onDelete={removeRecord}
      onToggleReceipt={toggleMobileReceipt}
      onReplaceReceiptForRecord={replaceReceiptForRecord}
      onDeleteReceiptForRecord={deleteReceiptForRecord}
    /> : <FuelSummaryView
      view={view}
      vehicleSummary={vehicleSummary}
      siteSummary={siteSummary}
      stationSummary={stationSummary}
      detailTarget={detailTarget}
      detailRows={detailRows}
      detailTotals={detailTotals}
      onDetailTarget={setDetailTarget}
      receiptBusy={receiptBusy}
      mobileReceiptPreview={mobileReceiptPreview}
      onToggleReceipt={toggleMobileReceipt}
      onReplaceReceiptForRecord={replaceReceiptForRecord}
      onDeleteReceiptForRecord={deleteReceiptForRecord}
    />}
  </section>;
}
