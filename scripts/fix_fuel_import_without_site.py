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
        'import { Download, FileSpreadsheet, Fuel, Pencil, Plus, RefreshCcw, Search, Settings2, Trash2, Upload } from "lucide-react";',
        'import { Download, Eye, FileSpreadsheet, Fuel, Paperclip, Pencil, Plus, RefreshCcw, Search, Settings2, Trash2, Upload } from "lucide-react";',
    ),
    (
        '  memo?: string | null;\n  created_at?: string;',
        '  memo?: string | null;\n  receipt_path?: string | null;\n  receipt_name?: string | null;\n  receipt_mime_type?: string | null;\n  receipt_uploaded_at?: string | null;\n  created_at?: string;',
    ),
    (
        '  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);\n  const [editSaving, setEditSaving] = useState(false);\n  const fileInput = useRef<HTMLInputElement>(null);',
        '  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);\n  const [editSaving, setEditSaving] = useState(false);\n  const [receiptTarget, setReceiptTarget] = useState<FuelRecord | null>(null);\n  const [receiptBusy, setReceiptBusy] = useState(false);\n  const fileInput = useRef<HTMLInputElement>(null);\n  const receiptInput = useRef<HTMLInputElement>(null);',
    ),
    (
        '  const previewTotals = useMemo(() => ({ quantity: preview.reduce((sum, row) => sum + row.quantity, 0), total: preview.reduce((sum, row) => sum + row.total_amount, 0) }), [preview]);',
        '''  const uploadReceipt = async (file?: File) => {\n    if (!receiptTarget || !file) return;\n    if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {\n      setError("영수증은 사진 또는 PDF 파일만 올릴 수 있습니다.");\n      return;\n    }\n    if (file.size > 10 * 1024 * 1024) {\n      setError("영수증 파일은 10MB 이하만 올릴 수 있습니다.");\n      return;\n    }\n    setReceiptBusy(true); setError("");\n    const extension = (file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg")).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";\n    const nextPath = `fuel/${receiptTarget.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;\n    const previousPath = receiptTarget.receipt_path || "";\n    const { error: uploadError } = await supabase.storage.from("fuel-receipts").upload(nextPath, file, { upsert: false, contentType: file.type || undefined });\n    if (uploadError) {\n      setReceiptBusy(false);\n      setError(`영수증 업로드에 실패했습니다. (${uploadError.message})`);\n      return;\n    }\n    const patch = { receipt_path: nextPath, receipt_name: file.name, receipt_mime_type: file.type || null, receipt_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() };\n    const { error: updateError } = await supabase.from("fuel_records").update(patch).eq("id", receiptTarget.id);\n    if (updateError) {\n      await supabase.storage.from("fuel-receipts").remove([nextPath]);\n      setReceiptBusy(false);\n      setError(`영수증 정보를 저장하지 못했습니다. (${updateError.message})`);\n      return;\n    }\n    if (previousPath && previousPath !== nextPath) await supabase.storage.from("fuel-receipts").remove([previousPath]);\n    setReceiptTarget({ ...receiptTarget, ...patch });\n    if (receiptInput.current) receiptInput.current.value = "";\n    setReceiptBusy(false);\n    await load();\n  };\n\n  const viewReceipt = async () => {\n    if (!receiptTarget?.receipt_path) return;\n    setReceiptBusy(true); setError("");\n    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(receiptTarget.receipt_path, 300);\n    setReceiptBusy(false);\n    if (signedError || !data?.signedUrl) { setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`); return; }\n    window.open(data.signedUrl, "_blank", "noopener,noreferrer");\n  };\n\n  const deleteReceipt = async () => {\n    if (!receiptTarget?.receipt_path) return;\n    if (!window.confirm(`${receiptTarget.fuel_date} / ${receiptTarget.vehicle_number} 영수증을 삭제할까요?`)) return;\n    const oldPath = receiptTarget.receipt_path;\n    setReceiptBusy(true); setError("");\n    const { error: updateError } = await supabase.from("fuel_records").update({ receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null, updated_at: new Date().toISOString() }).eq("id", receiptTarget.id);\n    if (updateError) { setReceiptBusy(false); setError(`영수증 정보를 삭제하지 못했습니다. (${updateError.message})`); return; }\n    const { error: removeError } = await supabase.storage.from("fuel-receipts").remove([oldPath]);\n    setReceiptTarget({ ...receiptTarget, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });\n    setReceiptBusy(false);\n    if (removeError) setError(`영수증 정보는 삭제됐지만 파일 정리에 실패했습니다. (${removeError.message})`);\n    await load();\n  };\n\n  const previewTotals = useMemo(() => ({ quantity: preview.reduce((sum, row) => sum + row.quantity, 0), total: preview.reduce((sum, row) => sum + row.total_amount, 0) }), [preview]);''',
    ),
    (
        '    const { error: deleteError } = await supabase.from("fuel_records").delete().eq("id", record.id);\n    if (deleteError) return setError(`삭제하지 못했습니다. (${deleteError.message})`);\n    await load();',
        '    const { error: deleteError } = await supabase.from("fuel_records").delete().eq("id", record.id);\n    if (deleteError) return setError(`삭제하지 못했습니다. (${deleteError.message})`);\n    if (record.receipt_path) await supabase.storage.from("fuel-receipts").remove([record.receipt_path]);\n    if (receiptTarget?.id === record.id) setReceiptTarget(null);\n    await load();',
    ),
    (
        '    {view !== "basics" && <>',
        '''    {receiptTarget && <section className="fuel-edit-panel">\n      <div className="fuel-section-title"><div><h3>영수증 첨부</h3><p>{receiptTarget.fuel_date} · {receiptTarget.vehicle_number} · {money(receiptTarget.total_amount)}원</p></div></div>\n      <input ref={receiptInput} type="file" accept="image/*,application/pdf" hidden onChange={(event) => void uploadReceipt(event.target.files?.[0])} />\n      <div className="fuel-manual-total"><span>첨부 상태</span><strong>{receiptTarget.receipt_path ? receiptTarget.receipt_name || "영수증 첨부됨" : "첨부된 영수증 없음"}</strong></div>\n      <div className="fuel-form-actions">\n        <button type="button" disabled={receiptBusy} onClick={() => setReceiptTarget(null)}>닫기</button>\n        {receiptTarget.receipt_path && <button type="button" disabled={receiptBusy} onClick={() => void viewReceipt()}><Eye size={15} /> 보기</button>}\n        {receiptTarget.receipt_path && <button type="button" disabled={receiptBusy} onClick={() => void deleteReceipt()}><Trash2 size={15} /> 영수증 삭제</button>}\n        <button type="button" className="fuel-primary" disabled={receiptBusy} onClick={() => receiptInput.current?.click()}><Upload size={15} /> {receiptTarget.receipt_path ? "영수증 교체" : "영수증 첨부"}</button>\n      </div>\n    </section>}\n\n    {view !== "basics" && <>''',
    ),
    (
        '<div className="fuel-row-actions"><button className="fuel-icon-button" type="button" title="수정" onClick={() => setEditingRecord({ ...record })}><Pencil size={15} /></button><button className="fuel-icon-button" type="button" title="삭제" onClick={() => void removeRecord(record)}><Trash2 size={15} /></button></div>',
        '<div className="fuel-row-actions"><button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button><button className="fuel-icon-button" type="button" title="수정" onClick={() => setEditingRecord({ ...record })}><Pencil size={15} /></button><button className="fuel-icon-button" type="button" title="삭제" onClick={() => void removeRecord(record)}><Trash2 size={15} /></button></div>',
    ),
    (
        '<div className="fuel-mobile-actions"><button type="button" onClick={() => setEditingRecord({ ...record })}><Pencil size={14} /> 수정</button><button type="button" onClick={() => void removeRecord(record)}><Trash2 size={14} /> 삭제</button></div>',
        '<div className="fuel-mobile-actions"><button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증" : "첨부"}</button><button type="button" onClick={() => setEditingRecord({ ...record })}><Pencil size={14} /> 수정</button><button type="button" onClick={() => void removeRecord(record)}><Trash2 size={14} /> 삭제</button></div>',
    ),
    (
        '<div className="fuel-table-wrap"><table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>합계금액</th><th>주유처</th></tr></thead><tbody>{detailRows.map((record) => <tr key={record.id}><td>{record.fuel_date}</td><td>{record.site_name}</td><td>{record.product_name}</td><td className="fuel-strong">{record.vehicle_number}</td><td>{record.usage_count}회</td><td className="fuel-number">{number(record.quantity)} L</td><td className="fuel-number">{money(record.unit_price)}</td><td className="fuel-number fuel-total">{money(record.total_amount)}</td><td>{record.station_name}</td></tr>)}</tbody></table></div>',
        '<div className="fuel-table-wrap"><table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>합계금액</th><th>주유처</th><th>영수증</th></tr></thead><tbody>{detailRows.map((record) => <tr key={record.id}><td>{record.fuel_date}</td><td>{record.site_name}</td><td>{record.product_name}</td><td className="fuel-strong">{record.vehicle_number}</td><td>{record.usage_count}회</td><td className="fuel-number">{number(record.quantity)} L</td><td className="fuel-number">{money(record.unit_price)}</td><td className="fuel-number fuel-total">{money(record.total_amount)}</td><td>{record.station_name}</td><td><button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button></td></tr>)}</tbody></table></div>',
    ),
    (
        '<footer><span>{record.station_name}</span></footer></article>)}</div>',
        '<footer><span>{record.station_name}</span><div className="fuel-mobile-actions"><button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증" : "첨부"}</button></div></footer></article>)}</div>',
    ),
]

for old, new in receipt_replacements:
    if new in s:
        continue
    if old not in s:
        raise SystemExit(f'fuel receipt patch anchor not found: {old[:80]}')
    s = s.replace(old, new, 1)

p.write_text(s)
