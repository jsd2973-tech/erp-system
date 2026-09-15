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
    '  const [receiptBusy, setReceiptBusy] = useState(false);\n  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");',
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
  };'''
replace_once(popup_view, inline_view, 'inline viewReceipt')

replace_once(
    '    setReceiptTarget({ ...receiptTarget, ...patch });\n    if (receiptInput.current) receiptInput.current.value = "";',
    '    setReceiptTarget({ ...receiptTarget, ...patch });\n    setReceiptPreviewUrl("");\n    if (receiptInput.current) receiptInput.current.value = "";',
    'upload preview reset',
)

replace_once(
    '    setReceiptTarget({ ...receiptTarget, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });\n    setReceiptBusy(false);',
    '    setReceiptTarget({ ...receiptTarget, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });\n    setReceiptPreviewUrl("");\n    setReceiptBusy(false);',
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

source.write_text(s)

css_path = Path('src/features/fuel/fuelManagement.css')
css = css_path.read_text()
receipt_css = '\n.fuel-receipt-preview{margin-top:12px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fafc;overflow:hidden;display:grid;place-items:center;min-height:220px}.fuel-receipt-preview img{display:block;max-width:100%;max-height:70vh;object-fit:contain;background:#fff}.fuel-receipt-preview iframe{width:100%;height:min(70vh,760px);border:0;background:#fff}@media(max-width:760px){.fuel-receipt-preview{min-height:180px}.fuel-receipt-preview iframe{height:62vh}}\n'
if '.fuel-receipt-preview{' not in css:
    css += receipt_css
    css_path.write_text(css)
