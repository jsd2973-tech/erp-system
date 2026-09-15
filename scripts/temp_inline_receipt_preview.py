from pathlib import Path

source = Path('src/features/fuel/FuelManagement.tsx')
s = source.read_text()

old_state = '''  const [receiptTarget, setReceiptTarget] = useState<FuelRecord | null>(null);\n  const [receiptBusy, setReceiptBusy] = useState(false);'''
new_state = '''  const [receiptTarget, setReceiptTarget] = useState<FuelRecord | null>(null);\n  const [receiptBusy, setReceiptBusy] = useState(false);\n  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");'''
if new_state not in s:
    if old_state not in s:
        raise SystemExit('receipt state anchor not found')
    s = s.replace(old_state, new_state, 1)

old_view = '''  const viewReceipt = async () => {\n    if (!receiptTarget?.receipt_path) return;\n    setReceiptBusy(true); setError("");\n    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(receiptTarget.receipt_path, 300);\n    setReceiptBusy(false);\n    if (signedError || !data?.signedUrl) { setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`); return; }\n    window.open(data.signedUrl, "_blank", "noopener,noreferrer");\n  };'''
new_view = '''  const viewReceipt = async () => {\n    if (!receiptTarget?.receipt_path) return;\n    setReceiptBusy(true); setError(""); setReceiptPreviewUrl("");\n    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(receiptTarget.receipt_path, 300);\n    setReceiptBusy(false);\n    if (signedError || !data?.signedUrl) { setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`); return; }\n    setReceiptPreviewUrl(data.signedUrl);\n  };'''
if new_view not in s:
    if old_view not in s:
        raise SystemExit('viewReceipt anchor not found')
    s = s.replace(old_view, new_view, 1)

s = s.replace('''    setReceiptTarget({ ...receiptTarget, ...patch });\n    if (receiptInput.current) receiptInput.current.value = "";''', '''    setReceiptTarget({ ...receiptTarget, ...patch });\n    setReceiptPreviewUrl("");\n    if (receiptInput.current) receiptInput.current.value = "";''', 1)
s = s.replace('''    setReceiptTarget({ ...receiptTarget, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });\n    setReceiptBusy(false);''', '''    setReceiptTarget({ ...receiptTarget, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });\n    setReceiptPreviewUrl("");\n    setReceiptBusy(false);''', 1)
s = s.replace('''        <button type="button" disabled={receiptBusy} onClick={() => setReceiptTarget(null)}>닫기</button>''', '''        <button type="button" disabled={receiptBusy} onClick={() => { setReceiptPreviewUrl(""); setReceiptTarget(null); }}>닫기</button>''', 1)

old_panel = '''      <div className="fuel-manual-total"><span>첨부 상태</span><strong>{receiptTarget.receipt_path ? receiptTarget.receipt_name || "영수증 첨부됨" : "첨부된 영수증 없음"}</strong></div>\n      <div className="fuel-form-actions">'''
new_panel = '''      <div className="fuel-manual-total"><span>첨부 상태</span><strong>{receiptTarget.receipt_path ? receiptTarget.receipt_name || "영수증 첨부됨" : "첨부된 영수증 없음"}</strong></div>\n      {receiptPreviewUrl && <div className="fuel-receipt-preview">\n        {receiptTarget.receipt_mime_type === "application/pdf" || /\\.pdf$/i.test(receiptTarget.receipt_name || "")\n          ? <iframe src={receiptPreviewUrl} title="영수증 PDF 미리보기" />\n          : <img src={receiptPreviewUrl} alt={receiptTarget.receipt_name || "영수증"} />}\n      </div>}\n      <div className="fuel-form-actions">'''
if new_panel not in s:
    if old_panel not in s:
        raise SystemExit('receipt panel anchor not found')
    s = s.replace(old_panel, new_panel, 1)

source.write_text(s)

css_path = Path('src/features/fuel/fuelManagement.css')
css = css_path.read_text()
css_add = '''\n.fuel-receipt-preview{margin-top:12px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fafc;overflow:hidden;display:grid;place-items:center;min-height:220px}.fuel-receipt-preview img{display:block;max-width:100%;max-height:70vh;object-fit:contain;background:#fff}.fuel-receipt-preview iframe{width:100%;height:min(70vh,760px);border:0;background:#fff}@media(max-width:760px){.fuel-receipt-preview{min-height:180px}.fuel-receipt-preview iframe{height:62vh}}\n'''
if '.fuel-receipt-preview{' not in css:
    css += css_add
css_path.write_text(css)

prebuild_path = Path('scripts/fix_fuel_import_without_site.py')
p = prebuild_path.read_text()
old_popup = '''  const viewReceipt = async () => {\n    if (!receiptTarget?.receipt_path) return;\n    const receiptWindow = window.open("about:blank", "_blank");\n    if (!receiptWindow) {\n      setError("브라우저에서 새 창이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러주세요.");\n      return;\n    }\n    receiptWindow.opener = null;\n    receiptWindow.document.title = "영수증 불러오는 중";\n    receiptWindow.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">영수증을 불러오는 중입니다...</p>';\n    setReceiptBusy(true); setError("");\n    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(receiptTarget.receipt_path, 300);\n    setReceiptBusy(false);\n    if (signedError || !data?.signedUrl) {\n      receiptWindow.close();\n      setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`);\n      return;\n    }\n    receiptWindow.location.href = data.signedUrl;\n  };'''
if old_popup not in p:
    raise SystemExit('prebuild popup replacement anchor not found')
p = p.replace(old_popup, new_view, 1)
prebuild_path.write_text(p)
