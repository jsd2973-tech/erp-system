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
  const importEcountVendorDetails = async (rows: EcountVendorImportRow[]) => {
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!rows.length) {
      setVendorImportMessage("이카운트 파일에 거래처 데이터가 없습니다.");
      return alert("이카운트 파일에서 거래처 데이터를 찾지 못했습니다.");
    }

    const invalidRows = rows.filter((row) => !row.name);
    if (invalidRows.length) {
      const details = invalidRows.slice(0, 8).map((row) => `${row.sourceSheet} ${row.sourceRow}행 (${row.code || "코드 없음"} / 상호 없음)`).join("\n");
      setVendorImportMessage(`이카운트 대조 중단 · 필수값 누락 ${invalidRows.length}건`);
      return alert(`이카운트 거래처 정보 반영을 중단했습니다.\n거래처명이 있어야 ERP 거래처와 연결할 수 있습니다.\n\n${details}${invalidRows.length > 8 ? `\n외 ${invalidRows.length - 8}건` : ""}`);
    }

    const sourceNames = new Set<string>();
    const duplicateRows: EcountVendorImportRow[] = [];
    rows.forEach((row) => {
      if (sourceNames.has(row.name)) duplicateRows.push(row);
      sourceNames.add(row.name);
    });
    if (duplicateRows.length) {
      const details = duplicateRows.slice(0, 8).map((row) => `${row.sourceSheet} ${row.sourceRow}행 ${row.name}`).join("\n");
      setVendorImportMessage(`이카운트 대조 중단 · 중복 거래처 ${duplicateRows.length}건`);
      return alert(`이카운트 거래처 정보 반영을 중단했습니다.\n이름을 기준으로 연결하므로 이카운트 파일에 같은 거래처명이 중복되면 안 됩니다.\n\n${details}${duplicateRows.length > 8 ? `\n외 ${duplicateRows.length - 8}건` : ""}`);
    }

    const vendorResult = await fetchAllRows("vendors", "code", 1000);
    if (vendorResult.error) {
      setVendorImportMessage("이카운트 대조 실패 · 현재 거래처 목록을 불러오지 못했습니다.");
      return alert(`현재 거래처 목록을 불러오지 못해 반영을 중단했습니다. (${vendorResult.error.message})`);
    }

    const currentVendors = (vendorResult.data || []) as Vendor[];
    const matched: { source: EcountVendorImportRow; vendor: Vendor }[] = [];
    const mismatches: { source: EcountVendorImportRow; reason: string }[] = [];

    rows.forEach((source) => {
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
      return alert(`이카운트 거래처 정보 반영을 중단했습니다.\n거래처명이 ERP와 일치하지 않는 행이 있습니다.\n수정된 내용은 저장하지 않았습니다.\n\n${details}${mismatches.length > 8 ? `\n외 ${mismatches.length - 8}건` : ""}`);
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
      return alert(`이카운트 추가정보 저장 실패: ${error.message}`);
    }

    const updatedById = new Map(updates.map((vendor) => [vendor.id, vendor]));
    setVendors(currentVendors.map((vendor) => updatedById.get(vendor.id) || vendor));
    const codeMismatchCount = matched.filter(({ source, vendor }) => source.code !== cleanVendorImportText(vendor.code)).length;
    setVendorImportMessage(`이카운트 ${matched.length}건 상호 일치 · 추가정보 반영 완료${codeMismatchCount ? ` · ERP 코드 유지 ${codeMismatchCount}건` : ""}`);
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


css_anchor = ".upload.upload-busy{background:#f1f5f9;color:#64748b;cursor:wait;pointer-events:none}\n"
css_block = ".vendor-import-actions{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0}\n.vendor-import-actions small{color:#64748b;font-size:11px;text-align:right;line-height:1.35}\n@media(max-width:900px){.vendor-import-actions{width:100%;align-items:stretch}.vendor-import-actions small{text-align:left}}\n"
app = replace_once(app, css_anchor, css_anchor + css_block, "거래처 업로드 CSS")

APP_PATH.write_text(app, encoding="utf-8")
print("Ecount 거래처 추가정보 반영 패치를 적용했습니다.")
