from pathlib import Path

source = Path('src/features/fuel/FuelManagement.tsx')
s = source.read_text()

helper_anchor = '''    setMobileReceiptPreview({ id: record.id, url: data.signedUrl, mime: record.receipt_mime_type || "", name: record.receipt_name || "영수증" });
  };'''
helper_new = helper_anchor + '''

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
    const { error: updateError } = await supabase.from("fuel_records").update({ receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null, updated_at: new Date().toISOString() }).eq("id", record.id);
    if (updateError) { setReceiptBusy(false); setError(`영수증 정보를 삭제하지 못했습니다. (${updateError.message})`); return; }
    const { error: removeError } = await supabase.storage.from("fuel-receipts").remove([oldPath]);
    if (receiptTarget?.id === record.id) setReceiptTarget({ ...record, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });
    setReceiptPreviewUrl("");
    setMobileReceiptPreview(null);
    setReceiptBusy(false);
    if (removeError) setError(`영수증 정보는 삭제됐지만 파일 정리에 실패했습니다. (${removeError.message})`);
    await load();
  };'''
if 'const replaceReceiptForRecord = (record: FuelRecord)' not in s:
    if helper_anchor not in s:
        raise SystemExit('receipt helper anchor not found')
    s = s.replace(helper_anchor, helper_new, 1)

actions = '''<div className="fuel-inline-receipt-actions"><button type="button" disabled={receiptBusy} onClick={() => replaceReceiptForRecord(record)}><Upload size={14} /> 영수증 교체</button><button type="button" className="is-danger" disabled={receiptBusy} onClick={() => void deleteReceiptForRecord(record)}><Trash2 size={14} /> 영수증 삭제</button></div>'''

mobile_old = '''<div className="fuel-mobile-receipt-inline">{mobileReceiptPreview.mime === "application/pdf" || /\\.pdf$/i.test(mobileReceiptPreview.name) ? <iframe src={mobileReceiptPreview.url} title="영수증 PDF 미리보기" /> : <img src={mobileReceiptPreview.url} alt={mobileReceiptPreview.name} />}</div>'''
mobile_new = '''<div className="fuel-inline-receipt-shell">''' + mobile_old + actions + '''</div>'''
if 'fuel-inline-receipt-shell' not in s:
    count = s.count(mobile_old)
    if count < 2:
        raise SystemExit(f'mobile inline receipt anchors not found: {count}')
    s = s.replace(mobile_old, mobile_new, 2)

pc_old = '''<div className="fuel-desktop-receipt-inline">{mobileReceiptPreview.mime === "application/pdf" || /\\.pdf$/i.test(mobileReceiptPreview.name) ? <iframe src={mobileReceiptPreview.url} title="영수증 PDF 미리보기" /> : <img src={mobileReceiptPreview.url} alt={mobileReceiptPreview.name} />}</div>'''
pc_new = '''<div className="fuel-inline-receipt-shell">''' + pc_old + actions + '''</div>'''
if s.count('fuel-inline-receipt-shell') < 4:
    count = s.count(pc_old)
    if count < 2:
        raise SystemExit(f'PC inline receipt anchors not found: {count}')
    s = s.replace(pc_old, pc_new, 2)

source.write_text(s)

css_path = Path('src/features/fuel/fuelManagement.css')
css = css_path.read_text()
css_add = '''
.fuel-inline-receipt-shell{width:100%}.fuel-inline-receipt-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 14px 14px}.fuel-inline-receipt-actions button{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:9px;padding:8px 11px;font-size:12px;font-weight:800;cursor:pointer}.fuel-inline-receipt-actions button:hover{background:#f8fafc}.fuel-inline-receipt-actions button.is-danger{border-color:#fecaca;color:#b91c1c;background:#fff7f7}.fuel-inline-receipt-actions button.is-danger:hover{background:#fef2f2}.fuel-inline-receipt-actions button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:760px){.fuel-inline-receipt-actions{padding:8px 0 2px;display:grid;grid-template-columns:1fr 1fr}.fuel-inline-receipt-actions button{width:100%;padding:10px 8px}}
'''
if '.fuel-inline-receipt-shell{' not in css:
    css += css_add
    css_path.write_text(css)
