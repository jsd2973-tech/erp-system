from pathlib import Path

source = Path('src/features/fuel/FuelManagement.tsx')
s = source.read_text()


def replace_once(old: str, new: str, label: str):
    global s
    if new in s:
        return
    if old not in s:
        raise SystemExit(f'{label} anchor not found')
    s = s.replace(old, new, 1)

replace_once(
    '  const [receiptBusy, setReceiptBusy] = useState(false);',
    '  const [receiptBusy, setReceiptBusy] = useState(false);\n  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");\n  const [mobileReceiptPreview, setMobileReceiptPreview] = useState<{ id: string; url: string; mime: string; name: string } | null>(null);',
    'receipt preview state',
)

popup_view = '''  const viewReceipt = async () => {
    if (!receiptTarget?.receipt_path) return;
    const receiptWindow = window.open("about:blank", "_blank");
    if (!receiptWindow) {
      setError("브라우저에서 새 창이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러주세요.");
      return;
    }
    receiptWindow.opener = null;
    receiptWindow.document.title = "영수증 불러오는 중";
    receiptWindow.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">영수증을 불러오는 중입니다...</p>';
    setReceiptBusy(true); setError("");
    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(receiptTarget.receipt_path, 300);
    setReceiptBusy(false);
    if (signedError || !data?.signedUrl) {
      receiptWindow.close();
      setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`);
      return;
    }
    receiptWindow.location.href = data.signedUrl;
  };'''

inline_view = '''  const viewReceipt = async () => {
    if (!receiptTarget?.receipt_path) return;
    setReceiptBusy(true); setError(""); setReceiptPreviewUrl("");
    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(receiptTarget.receipt_path, 300);
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
    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(record.receipt_path, 300);
    setReceiptBusy(false);
    if (signedError || !data?.signedUrl) { setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`); return; }
    setMobileReceiptPreview({ id: record.id, url: data.signedUrl, mime: record.receipt_mime_type || "", name: record.receipt_name || "영수증" });
  };'''
replace_once(popup_view, inline_view, 'inline viewReceipt')

replace_once(
    '    setReceiptTarget({ ...receiptTarget, ...patch });\n    if (receiptInput.current) receiptInput.current.value = "";',
    '    setReceiptTarget({ ...receiptTarget, ...patch });\n    setReceiptPreviewUrl("");\n    setMobileReceiptPreview(null);\n    if (receiptInput.current) receiptInput.current.value = "";',
    'upload preview reset',
)

replace_once(
    '    setReceiptTarget({ ...receiptTarget, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });\n    setReceiptBusy(false);',
    '    setReceiptTarget({ ...receiptTarget, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });\n    setReceiptPreviewUrl("");\n    setMobileReceiptPreview(null);\n    setReceiptBusy(false);',
    'delete preview reset',
)

replace_once(
    '        <button type="button" disabled={receiptBusy} onClick={() => setReceiptTarget(null)}>닫기</button>',
    '        <button type="button" disabled={receiptBusy} onClick={() => { setReceiptPreviewUrl(""); setReceiptTarget(null); }}>닫기</button>',
    'close preview reset',
)

replace_once(
    '      <div className="fuel-manual-total"><span>첨부 상태</span><strong>{receiptTarget.receipt_path ? receiptTarget.receipt_name || "영수증 첨부됨" : "첨부된 영수증 없음"}</strong></div>\n      <div className="fuel-form-actions">',
    '      <div className="fuel-manual-total"><span>첨부 상태</span><strong>{receiptTarget.receipt_path ? receiptTarget.receipt_name || "영수증 첨부됨" : "첨부된 영수증 없음"}</strong></div>\n      {receiptPreviewUrl && <div className="fuel-receipt-preview">\n        {receiptTarget.receipt_mime_type === "application/pdf" || /\\.pdf$/i.test(receiptTarget.receipt_name || "")\n          ? <iframe src={receiptPreviewUrl} title="영수증 PDF 미리보기" />\n          : <img src={receiptPreviewUrl} alt={receiptTarget.receipt_name || "영수증"} />}\n      </div>}\n      <div className="fuel-form-actions">',
    'receipt preview panel',
)

mobile_button_old = '<button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증 보기" : "영수증 첨부"}</button>'
mobile_button_new = '<button type="button" disabled={receiptBusy} onClick={() => void toggleMobileReceipt(record)}><Paperclip size={14} /> {record.receipt_path ? (mobileReceiptPreview?.id === record.id ? "영수증 닫기" : "영수증 보기") : "영수증 첨부"}</button>'
if mobile_button_new not in s:
    if s.count(mobile_button_old) < 2:
        raise SystemExit('mobile receipt buttons not found')
    s = s.replace(mobile_button_old, mobile_button_new, 2)

main_footer_old = '''        <footer><span>{record.station_name}</span><div className="fuel-mobile-actions">{MOBILE_BUTTON}<button type="button" onClick={() => setEditingRecord({ ...record })}><Pencil size={14} /> 수정</button><button type="button" onClick={() => void removeRecord(record)}><Trash2 size={14} /> 삭제</button></div></footer>'''.replace('{MOBILE_BUTTON}', mobile_button_new)
main_footer_new = main_footer_old + '''\n        {mobileReceiptPreview?.id === record.id && <div className="fuel-mobile-receipt-inline">{mobileReceiptPreview.mime === "application/pdf" || /\\.pdf$/i.test(mobileReceiptPreview.name) ? <iframe src={mobileReceiptPreview.url} title="영수증 PDF 미리보기" /> : <img src={mobileReceiptPreview.url} alt={mobileReceiptPreview.name} />}</div>}'''
replace_once(main_footer_old, main_footer_new, 'main mobile inline receipt')

detail_footer_old = '''<footer><span>{record.station_name}</span><div className="fuel-mobile-actions">{MOBILE_BUTTON}</div></footer>'''.replace('{MOBILE_BUTTON}', mobile_button_new)
detail_footer_new = detail_footer_old + '''{mobileReceiptPreview?.id === record.id && <div className="fuel-mobile-receipt-inline">{mobileReceiptPreview.mime === "application/pdf" || /\\.pdf$/i.test(mobileReceiptPreview.name) ? <iframe src={mobileReceiptPreview.url} title="영수증 PDF 미리보기" /> : <img src={mobileReceiptPreview.url} alt={mobileReceiptPreview.name} />}</div>}'''
replace_once(detail_footer_old, detail_footer_new, 'detail mobile inline receipt')

source.write_text(s)

css_path = Path('src/features/fuel/fuelManagement.css')
css = css_path.read_text()
receipt_css = '\n.fuel-receipt-preview{margin-top:12px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fafc;overflow:hidden;display:grid;place-items:center;min-height:220px}.fuel-receipt-preview img{display:block;max-width:100%;max-height:70vh;object-fit:contain;background:#fff}.fuel-receipt-preview iframe{width:100%;height:min(70vh,760px);border:0;background:#fff}@media(max-width:760px){.fuel-receipt-preview{min-height:180px}.fuel-receipt-preview iframe{height:62vh}}\n'
if '.fuel-receipt-preview{' not in css:
    css += receipt_css

mobile_css = '\n.fuel-mobile-receipt-inline{margin:10px 0 2px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fafc;overflow:hidden;display:grid;place-items:center}.fuel-mobile-receipt-inline img{display:block;width:100%;max-height:68vh;object-fit:contain;background:#fff}.fuel-mobile-receipt-inline iframe{display:block;width:100%;height:60vh;border:0;background:#fff}\n'
if '.fuel-mobile-receipt-inline{' not in css:
    css += mobile_css
css_path.write_text(css)
