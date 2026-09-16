from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "src" / "App.tsx"
app = APP_PATH.read_text(encoding="utf-8")

if "const readEcountVendorRows = async" in app:
    print("Ecount 거래처 추가정보 반영 패치가 이미 적용되어 있습니다.")
    raise SystemExit(0)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label} 앵커를 정확히 1개 찾지 못했습니다: {count}개")
    return source.replace(old, new, 1)


vendor_type_anchor = (
    "type Vendor = { id: string; code: string; name: string; owner?: string; phone?: string; "
    "mobile?: string; address?: string; address_detail?: string };\n"
)
vendor_type_block = r'''type EcountVendorImportRow = {
  sourceSheet: string;
  sourceRow: number;
  code: string;
  name: string;
  owner: string;
  phone: string;
  mobile: string;
  address: string;
};
'''
app = replace_once(app, vendor_type_anchor, vendor_type_anchor + vendor_type_block, "Vendor 타입")


excel_reader_anchor = "const downloadExcel = (fileName: string, rows: Record<string, any>[]) => {"
excel_reader_block = r'''
const cleanVendorImportText = (value: unknown) => String(value ?? "").replace(/\u00a0/g, " ").trim();

const isEcountExportTimestamp = (value: string) => /^20\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/.test(value);

const readEcountVendorRows = async (file: File): Promise<EcountVendorImportRow[] | null> => {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array", raw: true });
  const rows: EcountVendorImportRow[] = [];
  let foundEcountHeader = false;

  workbook.SheetNames.forEach((sourceSheet) => {
    const worksheet = workbook.Sheets[sourceSheet];
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true }) as unknown[][];
    const headerIndex = matrix.findIndex((row) => {
      const headers = row.map(cleanVendorImportText);
      return headers.includes("거래처코드") && (headers.includes("거래처명") || headers.includes("상호"));
    });
    if (headerIndex < 0) return;

    foundEcountHeader = true;
    const headers = matrix[headerIndex].map(cleanVendorImportText);
    const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const codeColumn = findColumn("거래처코드");
    const nameColumn = findColumn("거래처명", "상호");
    const ownerColumn = findColumn("대표자명", "대표자");
    const phoneColumn = findColumn("전화", "전화번호", "연락처");
    const mobileColumn = findColumn("모바일", "휴대폰", "휴대전화");
    const addressColumn = findColumn("주소1", "주소", "사업장주소", "소재지");
    const emailColumn = findColumn("Email", "이메일");
    const faxColumn = findColumn("Fax", "팩스");
    const getCell = (row: unknown[], column: number) => (column >= 0 ? cleanVendorImportText(row[column]) : "");

    matrix.slice(headerIndex + 1).forEach((row, index) => {
      const code = getCell(row, codeColumn);
      const name = getCell(row, nameColumn);
      const owner = getCell(row, ownerColumn);
      const phone = getCell(row, phoneColumn);
      const mobile = getCell(row, mobileColumn);
      const address = getCell(row, addressColumn);
      const email = getCell(row, emailColumn);
      const fax = getCell(row, faxColumn);
      const hasMappedValue = [code, name, owner, phone, mobile, address, email, fax].some(Boolean);

      if (!hasMappedValue) return;
      // Ecount appends an export timestamp below the final vendor row. It is metadata, not a vendor.
      if (!name && isEcountExportTimestamp(code) && ![owner, phone, mobile, address, email, fax].some(Boolean)) return;

      rows.push({
        sourceSheet,
        sourceRow: headerIndex + index + 2,
        code,
        name,
        owner,
        phone,
        mobile,
        address,
      });
    });
  });

  return foundEcountHeader ? rows : null;
};

'''
app = replace_once(app, excel_reader_anchor, excel_reader_block + excel_reader_anchor, "엑셀 읽기 함수")


vendor_functions_anchor = "  const saveGroup = async () => {"
vendor_functions_block = r'''
  const getEcountVendorRowKey = (row: EcountVendorImportRow) => `${row.sourceSheet}:${row.sourceRow}`;
  const groupEcountVendorRowsByName = (rows: EcountVendorImportRow[]) => {
    const groups = new Map<string, EcountVendorImportRow[]>();
    rows.forEach((row) => {
      const sameNameRows = groups.get(row.name) || [];
      sameNameRows.push(row);
      groups.set(row.name, sameNameRows);
    });
    return Array.from(groups.entries()).filter(([, sameNameRows]) => sameNameRows.length > 1);
  };

  const importEcountVendorDetails = async (rows: EcountVendorImportRow[], selectionOverrides: Record<string, string> | null = null): Promise<boolean> => {
    if (!canCreateRecords) {
      alert("등록 권한이 없습니다.");
      return false;
    }
    if (!rows.length) {
      setVendorImportMessage("이카운트 파일에 거래처 데이터가 없습니다.");
      alert("이카운트 파일에서 거래처 데이터를 찾지 못했습니다.");
      return false;
    }

    const invalidRows = rows.filter((row) => !row.name);
    if (invalidRows.length) {
      const details = invalidRows.slice(0, 8).map((row) => `${row.sourceSheet} ${row.sourceRow}행 (${row.code || "코드 없음"} / 상호 없음)`).join("\n");
      setVendorImportMessage(`이카운트 대조 중단 · 필수값 누락 ${invalidRows.length}건`);
      alert(`이카운트 거래처 정보 반영을 중단했습니다.\n거래처명이 있어야 ERP 거래처와 연결할 수 있습니다.\n\n${details}${invalidRows.length > 8 ? `\n외 ${invalidRows.length - 8}건` : ""}`);
      return false;
    }

    const vendorResult = await fetchAllRows("vendors", "code", 1000);
    if (vendorResult.error) {
      setVendorImportMessage("이카운트 대조 실패 · 현재 거래처 목록을 불러오지 못했습니다.");
      alert(`현재 거래처 목록을 불러오지 못해 반영을 중단했습니다. (${vendorResult.error.message})`);
      return false;
    }

    const currentVendors = (vendorResult.data || []) as Vendor[];
    const matched: { source: EcountVendorImportRow; vendor: Vendor }[] = [];
    const mismatches: { source: EcountVendorImportRow; reason: string }[] = [];

    const rowsByName = new Map<string, EcountVendorImportRow[]>();
    rows.forEach((source) => {
      const sameNameRows = rowsByName.get(source.name) || [];
      sameNameRows.push(source);
      rowsByName.set(source.name, sameNameRows);
    });

    const duplicateGroups = groupEcountVendorRowsByName(rows);
    if (!selectionOverrides && duplicateGroups.length) {
      const defaultSelections: Record<string, string> = {};
      duplicateGroups.forEach(([name, sameNameRows]) => {
        const nameMatches = currentVendors.filter((vendor) => cleanVendorImportText(vendor.name) === name);
        if (nameMatches.length !== 1) return;
        const exactCodeRows = sameNameRows.filter((source) => source.code && cleanVendorImportText(source.code) === cleanVendorImportText(nameMatches[0].code));
        if (exactCodeRows.length === 1) defaultSelections[name] = getEcountVendorRowKey(exactCodeRows[0]);
      });
      setVendorEcountSelections(defaultSelections);
      setVendorEcountReview({ rows, currentVendors });
      setVendorImportMessage(`중복 상호 ${duplicateGroups.length}건 · 반영할 행을 선택해 주세요.`);
      return false;
    }

    const selectedRows = selectionOverrides
      ? Array.from(rowsByName.entries()).flatMap(([name, sameNameRows]) => {
          if (sameNameRows.length === 1) return sameNameRows;
          const selectedKey = selectionOverrides[name];
          return sameNameRows.filter((source) => getEcountVendorRowKey(source) === selectedKey);
        })
      : rows;
    if (!selectedRows.length) {
      setVendorImportMessage(`이카운트 반영 대기 · 선택된 거래처가 없습니다.`);
      alert("반영할 거래처를 하나 이상 선택해 주세요.");
      return false;
    }

    selectedRows.forEach((source) => {
      const nameMatches = currentVendors.filter((vendor) => cleanVendorImportText(vendor.name) === source.name);
      if (!nameMatches.length) {
        const codeMatch = source.code && currentVendors.find((vendor) => cleanVendorImportText(vendor.code) === source.code);
        mismatches.push({
          source,
          reason: codeMatch ? `상호 불일치 (ERP: ${cleanVendorImportText(codeMatch.name) || "-"})` : "ERP 거래처명 없음",
        });
        return;
      }
      if (nameMatches.length > 1) {
        mismatches.push({ source, reason: "ERP 거래처명 중복" });
        return;
      }

      matched.push({ source, vendor: nameMatches[0] });
    });

    if (mismatches.length) {
      const details = mismatches.slice(0, 8).map(({ source, reason }) => `${source.sourceSheet} ${source.sourceRow}행 · ${source.code} / ${source.name} · ${reason}`).join("\n");
      setVendorImportMessage(`이카운트 대조 중단 · 상호 불일치 ${mismatches.length}건`);
      alert(`이카운트 거래처 정보 반영을 중단했습니다.\n거래처명 또는 중복 상호를 ERP와 안전하게 연결하지 못한 행이 있습니다.\n수정된 내용은 저장하지 않았습니다.\n\n${details}${mismatches.length > 8 ? `\n외 ${mismatches.length - 8}건` : ""}`);
      return false;
    }

    const preferExistingWhenPresent = (existing: string | null | undefined, incoming: string) => cleanVendorImportText(existing) || incoming;
    const updates = matched.map(({ source, vendor }) => ({
      id: vendor.id,
      code: vendor.code,
      name: vendor.name,
      owner: preferExistingWhenPresent(vendor.owner, source.owner),
      phone: preferExistingWhenPresent(vendor.phone, source.phone),
      mobile: preferExistingWhenPresent(vendor.mobile, source.mobile),
      address: preferExistingWhenPresent(vendor.address, source.address),
      address_detail: cleanVendorImportText(vendor.address_detail),
    }));

    const { error } = await supabase.from("vendors").upsert(updates, { onConflict: "id" });
    if (error) {
      setVendorImportMessage("이카운트 대조 완료 · 저장 실패");
      alert(`이카운트 추가정보 저장 실패: ${error.message}`);
      return false;
    }

    const updatedById = new Map(updates.map((vendor) => [vendor.id, vendor]));
    setVendors(currentVendors.map((vendor) => updatedById.get(vendor.id) || vendor));
    const codeMismatchCount = matched.filter(({ source, vendor }) => source.code !== cleanVendorImportText(vendor.code)).length;
    const excludedCount = rows.length - selectedRows.length;
    setVendorImportMessage(`이카운트 ${matched.length}건 상호 일치 · 추가정보 반영 완료${codeMismatchCount ? ` · ERP 코드 유지 ${codeMismatchCount}건` : ""}${excludedCount ? ` · 선택 제외 ${excludedCount}건` : ""}`);
    return true;
  };

  const confirmEcountVendorImport = async () => {
    if (!vendorEcountReview) return;
    setVendorEcountImporting(true);
    try {
      const saved = await importEcountVendorDetails(vendorEcountReview.rows, vendorEcountSelections);
      if (saved) {
        setVendorEcountReview(null);
        setVendorEcountSelections({});
      }
    } finally {
      setVendorEcountImporting(false);
    }
  };

  const handleVendorExcelImport = async (file: File) => {
    try {
      const ecountRows = await readEcountVendorRows(file);
      if (ecountRows) {
        await importEcountVendorDetails(ecountRows);
        return;
      }
      await importVendors(file);
    } catch (error: any) {
      alert(`거래처 엑셀 처리 실패: ${error?.message || "파일 형식을 확인해 주세요."}`);
    }
  };

'''
app = replace_once(app, vendor_functions_anchor, vendor_functions_block + vendor_functions_anchor, "거래처 저장 함수")


vendor_state_anchor = "  const [vendorImportMessage, setVendorImportMessage] = useState(\"\");\n"
vendor_state_block = r'''  const [vendorEcountReview, setVendorEcountReview] = useState<{ rows: EcountVendorImportRow[]; currentVendors: Vendor[] } | null>(null);
  const [vendorEcountSelections, setVendorEcountSelections] = useState<Record<string, string>>({});
  const [vendorEcountImporting, setVendorEcountImporting] = useState(false);
'''
app = replace_once(app, vendor_state_anchor, vendor_state_anchor + vendor_state_block, "이카운트 선택 상태")


app = replace_once(
    app,
    "onChange={(e) => e.target.files?.[0] && importVendors(e.target.files[0])}",
    "onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = \"\"; if (file) void handleVendorExcelImport(file); }}",
    "거래처 엑셀 핸들러",
)
app = replace_once(
    app,
    "<span>{vendorImportMessage || `현재 ${vendors.length}개 거래처 등록됨`}</span><label className=\"upload\">",
    "<span>{vendorImportMessage || `현재 ${vendors.length}개 거래처 등록됨`}</span><div className=\"vendor-import-actions\"><label className=\"upload\">",
    "거래처 업로드 시작 태그",
)
app = replace_once(
    app,
    "</label></div><div className=\"grid5 vendor-register-grid\">",
    "</label><small>이카운트는 상호로 연결하고, 코드·추가정보는 ERP 입력값을 우선합니다.</small></div></div><div className=\"grid5 vendor-register-grid\">",
    "거래처 업로드 안내 태그",
)


review_modal_anchor = "        <div className=\"mobile-more-sheet role-mobile-sheet\""
review_modal_block = r'''
        {vendorEcountReview && (
          <div
            className="ecount-review-backdrop"
            onClick={() => {
              if (!vendorEcountImporting) {
                setVendorEcountReview(null);
                setVendorEcountSelections({});
              }
            }}
          >
            <div className="ecount-review-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ecount-review-head">
                <div>
                  <span className="ecount-review-eyebrow">ECOUNT IMPORT</span>
                  <h2>중복 거래처 선택</h2>
                  <p>같은 상호가 여러 건입니다. 반영할 행에 체크하세요. 체크하지 않은 행은 이번 업로드에서 제외됩니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVendorEcountReview(null);
                    setVendorEcountSelections({});
                  }}
                  disabled={vendorEcountImporting}
                >
                  닫기
                </button>
              </div>

              <div className="ecount-review-summary">
                <strong>{groupEcountVendorRowsByName(vendorEcountReview.rows).length}개 중복 상호</strong>
                <span>ERP 코드와 일치하는 행이 자동 선택됩니다. 필요하면 선택을 바꿀 수 있습니다.</span>
              </div>

              <div className="ecount-review-list">
                {groupEcountVendorRowsByName(vendorEcountReview.rows).map(([name, sameNameRows]) => {
                  const nameMatches = vendorEcountReview.currentVendors.filter((vendor) => cleanVendorImportText(vendor.name) === name);
                  const erpVendor = nameMatches.length === 1 ? nameMatches[0] : null;
                  return (
                    <div className="ecount-review-group" key={name}>
                      <div className="ecount-review-group-head">
                        <div>
                          <strong>{name}</strong>
                          <small>{erpVendor ? `ERP 코드 ${erpVendor.code} · ${erpVendor.owner || "대표자 미입력"}` : "ERP 거래처 없음 · 먼저 거래처등록 필요"}</small>
                        </div>
                        <span className={erpVendor ? "ecount-review-connected" : "ecount-review-unavailable"}>{erpVendor ? "ERP 연결됨" : "반영 불가"}</span>
                      </div>
                      <div className="ecount-review-choices">
                        {sameNameRows.map((row) => {
                          const rowKey = getEcountVendorRowKey(row);
                          const checked = vendorEcountSelections[name] === rowKey;
                          const codeMatches = Boolean(erpVendor && cleanVendorImportText(row.code) === cleanVendorImportText(erpVendor.code));
                          return (
                            <label className={`ecount-review-row${checked ? " selected" : ""}${!erpVendor ? " unavailable" : ""}`} key={rowKey}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!erpVendor || vendorEcountImporting}
                                onChange={(e) => {
                                  setVendorEcountSelections((previous) => {
                                    const next = { ...previous };
                                    if (e.target.checked) next[name] = rowKey;
                                    else delete next[name];
                                    return next;
                                  });
                                }}
                              />
                              <span className="ecount-review-choice">
                                <b>{row.code || "코드 없음"}</b>
                                <small>{[row.owner && `대표자 ${row.owner}`, row.address].filter(Boolean).join(" · ") || "추가정보 없음"}</small>
                              </span>
                              <em>{codeMatches ? "ERP 코드 일치" : erpVendor ? "코드 다름 · ERP 코드 유지" : "ERP 연결 불가"}</em>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="ecount-review-actions">
                <span>체크 해제는 ERP 거래처 삭제가 아니라 이번 업로드에서 제외하는 것입니다.</span>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setVendorEcountReview(null);
                      setVendorEcountSelections({});
                    }}
                    disabled={vendorEcountImporting}
                  >
                    취소
                  </button>
                  <button type="button" className="primary" onClick={confirmEcountVendorImport} disabled={vendorEcountImporting}>
                    {vendorEcountImporting ? "반영 중..." : "선택한 행 반영"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

'''
app = replace_once(app, review_modal_anchor, review_modal_block + review_modal_anchor, "이카운트 중복 선택 화면")


css_anchor = ".upload.upload-busy{background:#f1f5f9;color:#64748b;cursor:wait;pointer-events:none}\n"
css_block = ".vendor-import-actions{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0}\n.vendor-import-actions small{color:#64748b;font-size:11px;text-align:right;line-height:1.35}\n.ecount-review-backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.48)}\n.ecount-review-modal{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;width:min(720px,100%);max-height:min(840px,calc(100vh - 40px));overflow:hidden;border:1px solid #dbe4ef;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.24)}\n.ecount-review-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px 22px 16px;border-bottom:1px solid #e8eef5}.ecount-review-head>div{min-width:0}.ecount-review-eyebrow{display:block;margin-bottom:5px;color:#2563eb;font-size:10px;font-weight:900;letter-spacing:.12em}.ecount-review-head h2{margin:0 0 6px;color:#1f2f46;font-size:20px}.ecount-review-head p{max-width:570px;margin:0;color:#64748b;font-size:12px;line-height:1.55}.ecount-review-head>button{flex:none;min-width:52px}\n.ecount-review-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 22px;background:#f8fafc;color:#64748b;font-size:12px}.ecount-review-summary strong{color:#1d4ed8;font-size:13px;white-space:nowrap}\n.ecount-review-list{display:grid;gap:10px;overflow:auto;padding:14px 22px;background:#fff}.ecount-review-group{overflow:hidden;border:1px solid #dce5f0;border-radius:12px}.ecount-review-group-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;background:#f8fafc}.ecount-review-group-head>div{display:grid;gap:3px;min-width:0}.ecount-review-group-head strong{overflow:hidden;color:#24364f;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.ecount-review-group-head small{overflow:hidden;color:#718096;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.ecount-review-connected,.ecount-review-unavailable{flex:none;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:900}.ecount-review-connected{background:#e8f2ff;color:#1d4ed8}.ecount-review-unavailable{background:#fff1f2;color:#b42318}\n.ecount-review-choices{display:grid}.ecount-review-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 13px;border-top:1px solid #edf1f6;cursor:pointer}.ecount-review-row:hover,.ecount-review-row.selected{background:#f0f7ff}.ecount-review-row.unavailable{cursor:not-allowed;opacity:.64}.ecount-review-row input{width:16px;height:16px;margin:0;accent-color:#2563eb}.ecount-review-choice{display:grid;gap:3px;min-width:0}.ecount-review-choice b{color:#334155;font-size:12px}.ecount-review-choice small{overflow:hidden;color:#718096;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.ecount-review-row em{padding:3px 6px;border-radius:6px;background:#f1f5f9;color:#64748b;font-size:10px;font-style:normal;font-weight:800;white-space:nowrap}.ecount-review-row.selected em{background:#dbeafe;color:#1d4ed8}\n.ecount-review-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 22px;border-top:1px solid #e8eef5;background:#fff}.ecount-review-actions>span{color:#718096;font-size:11px;line-height:1.4}.ecount-review-actions>div{display:flex;gap:8px;flex:none}.ecount-review-actions button{min-width:82px}\n@media(max-width:700px){.vendor-import-actions{width:100%;align-items:stretch}.vendor-import-actions small{text-align:left}.ecount-review-backdrop{align-items:end;padding:0}.ecount-review-modal{width:100%;max-height:calc(100vh - 18px);border-radius:18px 18px 0 0}.ecount-review-head{padding:18px 16px 14px}.ecount-review-head h2{font-size:18px}.ecount-review-head p{font-size:11px}.ecount-review-summary{align-items:flex-start;flex-direction:column;gap:3px;padding:10px 16px}.ecount-review-list{padding:12px 16px}.ecount-review-group-head{padding:10px}.ecount-review-row{grid-template-columns:auto minmax(0,1fr);padding:10px}.ecount-review-row em{grid-column:2;justify-self:start}.ecount-review-actions{align-items:stretch;flex-direction:column;padding:12px 16px}.ecount-review-actions>div{display:grid;grid-template-columns:1fr 1fr}.ecount-review-actions button{width:100%}}\n"
app = replace_once(app, css_anchor, css_anchor + css_block, "거래처 업로드 CSS")

APP_PATH.write_text(app, encoding="utf-8")
print("Ecount 거래처 추가정보 반영 패치를 적용했습니다.")
