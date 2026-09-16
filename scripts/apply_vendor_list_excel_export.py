from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "src" / "App.tsx"
app = APP_PATH.read_text(encoding="utf-8")

MARKER = "/* ===== Vendor List Excel Export ===== */"
if MARKER in app:
    print("거래처 목록 엑셀 다운로드 패치가 이미 적용되어 있습니다.")
    raise SystemExit(0)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label} 앵커를 정확히 1개 찾지 못했습니다: {count}개")
    return source.replace(old, new, 1)


import_anchor = 'Database, FileCheck2, ClipboardList, ShieldCheck, Truck, Fuel } from "lucide-react";'
app = replace_once(
    app,
    import_anchor,
    'Database, FileCheck2, ClipboardList, ShieldCheck, Truck, Fuel, Download } from "lucide-react";',
    "아이콘 import",
)

export_function = r'''  /* ===== Vendor List Excel Export ===== */
  const downloadVendorsExcel = () => {
    downloadExcel(`거래처목록_${getTodayKey()}`, vendors.map((vendor) => ({
      거래처코드: String(vendor.code || ""),
      상호: String(vendor.name || ""),
      대표자: String(vendor.owner || ""),
      전화번호: String(vendor.phone || ""),
      모바일: String(vendor.mobile || ""),
      기본주소: String(vendor.address || ""),
      상세주소: String(vendor.address_detail || ""),
    })));
  };

'''
app = replace_once(app, "  const saveVendor = async () => {", export_function + "  const saveVendor = async () => {", "거래처 엑셀 함수 위치")

vendor_buttons_anchor = '''                <div className="vendor-import-actions">
                  <label className="upload basic-upload-button">'''
vendor_buttons_replacement = '''                <div className="vendor-import-actions">
                  <div className="vendor-import-buttons">
                    <button type="button" className="basic-download-button" onClick={downloadVendorsExcel}><Download size={16} /> 거래처 엑셀 다운로드</button>
                    <label className="upload basic-upload-button">'''
app = replace_once(app, vendor_buttons_anchor, vendor_buttons_replacement, "거래처 화면 다운로드 버튼")

label_close_anchor = '''                  <label className="upload basic-upload-button"><Upload size={16} /> 거래처 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (file) void handleVendorExcelImport(file); }} /></label>
                  <small>이카운트는 상호로 연결하고, 코드·추가정보는 ERP 입력값을 우선합니다.</small>'''
label_close_replacement = '''                  <label className="upload basic-upload-button"><Upload size={16} /> 거래처 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (file) void handleVendorExcelImport(file); }} /></label>
                  </div>
                  <small>이카운트는 상호로 연결하고, 코드·추가정보는 ERP 입력값을 우선합니다.</small>'''
app = replace_once(app, label_close_anchor, label_close_replacement, "거래처 업로드 버튼 영역")

css_anchor = ".vendor-import-actions{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0}"
css_block = ".vendor-import-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px}.basic-download-button{min-height:40px;border:1px solid #c7d7e8;background:#f8fbff;color:#1e3a5f;font-size:12px;font-weight:900;white-space:nowrap}.basic-download-button:hover{border-color:#93b4d5;background:#eef6ff;color:#1d4ed8}"
app = replace_once(app, css_anchor, css_block + css_anchor, "거래처 다운로드 CSS")

mobile_css_anchor = "@media(max-width:700px){.vendor-import-actions{width:100%;align-items:stretch}"
mobile_css_replacement = "@media(max-width:700px){.vendor-import-actions{width:100%;align-items:stretch}.vendor-import-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px}.vendor-import-buttons .basic-download-button,.vendor-import-buttons .basic-upload-button{width:100%;min-width:0;justify-content:center;padding:8px 6px;font-size:11px}"
app = replace_once(app, mobile_css_anchor, mobile_css_replacement, "거래처 다운로드 모바일 CSS")

APP_PATH.write_text(app, encoding="utf-8")
print("거래처 목록 엑셀 다운로드 패치를 적용했습니다.")
