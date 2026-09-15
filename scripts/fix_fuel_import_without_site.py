from pathlib import Path

p = Path('src/features/fuel/FuelManagement.tsx')
s = p.read_text()

replacements = [
    (
        'return candidateText.includes("차량번호") && candidateText.includes("합계금액") && candidateText.includes("현장명");',
        'return candidateText.includes("차량번호") && candidateText.includes("합계금액") && (candidateText.includes("현장명") || candidateText.includes("제품명"));',
    ),
    (
        'return normalized.includes("현장명") && normalized.includes("차량번호") && normalized.includes("일자");',
        'return normalized.includes("차량번호") && normalized.includes("일자") && normalized.some((header) => header.includes("제품명"));',
    ),
    (
        'if (headerIndex < 0) throw new Error("현장명·차량번호·일자 헤더를 찾지 못했습니다.");',
        'if (headerIndex < 0) throw new Error("제품명·차량번호·일자 헤더를 찾지 못했습니다.");',
    ),
    (
        'if ([columns.site, columns.product, columns.vehicle, columns.date, columns.quantity, columns.total].some((value) => value < 0)) {',
        'if ([columns.product, columns.vehicle, columns.date, columns.quantity, columns.total].some((value) => value < 0)) {',
    ),
    (
        '  let lastSite = "";\n  let lastProduct = "";',
        '  const hasSiteColumn = columns.site >= 0;\n  let lastSite = hasSiteColumn ? "" : "미지정";\n  let lastProduct = "";',
    ),
    (
        '      memo: "",\n    });',
        '      memo: hasSiteColumn ? "" : "원본 명세서에 현장명 없음",\n    });',
    ),
    (
        'const normalizeHeader = (value: unknown) => text(value).replace(/\\s/g, "").replace(/[()（）]/g, "").toLowerCase();\n',
        'const normalizeHeader = (value: unknown) => text(value).replace(/\\s/g, "").replace(/[()（）]/g, "").toLowerCase();\nconst FACTORY_VEHICLE_SUFFIXES = new Set(["1166", "1184", "1237", "4761", "5907", "6086", "9366"]);\nconst ASSEMBLY_VEHICLE_SUFFIXES = new Set(["4676", "6148", "7151", "7844", "8288", "8408"]);\nconst inferFuelSite = (vehicle: string) => {\n  const digits = String(vehicle || "").replace(/\\D/g, "");\n  const suffix = digits.slice(-4);\n  if (FACTORY_VEHICLE_SUFFIXES.has(suffix)) return "공장";\n  if (ASSEMBLY_VEHICLE_SUFFIXES.has(suffix)) return "국회";\n  return "";\n};\n',
    ),
    (
        '    const site = text(valueAt(columns.site)) || lastSite;\n    const product = text(valueAt(columns.product)) || lastProduct;\n    const vehicle = text(valueAt(columns.vehicle)) || lastVehicle;\n    if (text(valueAt(columns.site))) lastSite = site;\n    if (text(valueAt(columns.product))) lastProduct = product;\n    if (text(valueAt(columns.vehicle))) lastVehicle = vehicle;\n\n    const fuelDate = parseDate(valueAt(columns.date), year, month);\n    if (!fuelDate || !vehicle) return;\n',
        '    const sourceSite = text(valueAt(columns.site)) || lastSite;\n    const product = text(valueAt(columns.product)) || lastProduct;\n    const vehicle = text(valueAt(columns.vehicle)) || lastVehicle;\n    if (text(valueAt(columns.site))) lastSite = sourceSite;\n    if (text(valueAt(columns.product))) lastProduct = product;\n    if (text(valueAt(columns.vehicle))) lastVehicle = vehicle;\n\n    const fuelDate = parseDate(valueAt(columns.date), year, month);\n    if (!fuelDate || !vehicle) return;\n    const autoSite = hasSiteColumn ? "" : inferFuelSite(vehicle);\n    const site = sourceSite && sourceSite !== "미지정" ? sourceSite : autoSite || sourceSite || "미지정";\n',
    ),
    (
        '    const rawFingerprint = [stationName, fuelDate, site, product, vehicle, usageCount, quantity, unitPrice, supply, vat, total].join("|");',
        '    const fingerprintSite = hasSiteColumn ? site : "미지정";\n    const rawFingerprint = [stationName, fuelDate, fingerprintSite, product, vehicle, usageCount, quantity, unitPrice, supply, vat, total].join("|");',
    ),
    (
        '      memo: hasSiteColumn ? "" : "원본 명세서에 현장명 없음",',
        '      memo: hasSiteColumn ? "" : autoSite ? "원본 명세서에 현장명 없음 · 차량번호로 현장 자동지정" : "원본 명세서에 현장명 없음",',
    ),
]

for old, new in replacements:
    if new in s:
        continue
    if old not in s:
        raise SystemExit(f'fuel import patch anchor not found: {old[:60]}')
    s = s.replace(old, new, 1)

receipt_replacements = [
    (
'''  const viewReceipt = async () => {
    if (!receiptTarget?.receipt_path) return;
    setReceiptBusy(true); setError("");
    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(receiptTarget.receipt_path, 300);
    setReceiptBusy(false);
    if (signedError || !data?.signedUrl) { setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };''',
'''  const viewReceipt = async () => {
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
  };'''),
    (
        '<table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계금액</th><th>주유처</th><th></th></tr></thead><tbody>',
        '<table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계금액</th><th>주유처</th><th>영수증</th><th></th></tr></thead><tbody>',
    ),
    (
        '<tr><td colSpan={12} className="fuel-empty-cell">',
        '<tr><td colSpan={13} className="fuel-empty-cell">',
    ),
    (
        '<td>{record.station_name}</td><td><div className="fuel-row-actions"><button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button><button className="fuel-icon-button" type="button" title="수정" onClick={() => setEditingRecord({ ...record })}><Pencil size={15} /></button><button className="fuel-icon-button" type="button" title="삭제" onClick={() => void removeRecord(record)}><Trash2 size={15} /></button></div></td>',
        '<td>{record.station_name}</td><td><button className={`fuel-receipt-state ${record.receipt_path ? "is-attached" : ""}`} type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={13} /> {record.receipt_path ? "첨부됨" : "미첨부"}</button></td><td><div className="fuel-row-actions"><button className="fuel-icon-button" type="button" title="수정" onClick={() => setEditingRecord({ ...record })}><Pencil size={15} /></button><button className="fuel-icon-button" type="button" title="삭제" onClick={() => void removeRecord(record)}><Trash2 size={15} /></button></div></td>',
    ),
    (
        '<td><button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button></td>',
        '<td><button className={`fuel-receipt-state ${record.receipt_path ? "is-attached" : ""}`} type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={13} /> {record.receipt_path ? "첨부됨" : "미첨부"}</button></td>',
    ),
    (
        '<button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증" : "첨부"}</button>',
        '<button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증 보기" : "영수증 첨부"}</button>',
    ),
]

for old, new in receipt_replacements:
    if new in s:
        continue
    if old not in s:
        raise SystemExit(f'fuel receipt patch anchor not found: {old[:80]}')
    s = s.replace(old, new, 1 if 'button type="button" onClick={() => setReceiptTarget' not in old else s.count(old))

mobile_old = '<div><span>수량 <strong>{number(record.quantity)} L</strong></span><span>단가 <strong>{money(record.unit_price)}원</strong></span><span>횟수 <strong>{record.usage_count}회</strong></span><span>합계 <strong>{money(record.total_amount)}원</strong></span></div>'
mobile_new = '<div><span>수량 <strong>{number(record.quantity)} L</strong></span><span>단가 <strong>{money(record.unit_price)}원</strong></span><span>횟수 <strong>{record.usage_count}회</strong></span><span>합계 <strong>{money(record.total_amount)}원</strong></span><span>영수증 <strong className={record.receipt_path ? "fuel-receipt-mobile-attached" : ""}>{record.receipt_path ? "첨부됨" : "미첨부"}</strong></span></div>'
if mobile_new not in s:
    if s.count(mobile_old) < 2:
        raise SystemExit('fuel receipt mobile summary anchors not found')
    s = s.replace(mobile_old, mobile_new, 2)

p.write_text(s)

css_path = Path('src/features/fuel/fuelManagement.css')
css = css_path.read_text()
receipt_css = '\n.fuel-receipt-state{display:inline-flex;align-items:center;gap:4px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.fuel-receipt-state.is-attached{border-color:#99f6e4;background:#f0fdfa;color:#0f766e}.fuel-receipt-state:hover{border-color:#94a3b8}.fuel-receipt-mobile-attached{color:#0f766e!important}\n'
if '.fuel-receipt-state{' not in css:
    css += receipt_css
    css_path.write_text(css)
