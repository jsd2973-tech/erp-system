import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { createClient } from "@supabase/supabase-js";
import { Save, RotateCcw, Plus, Trash2, Pencil, Upload } from "lucide-react";

type Vendor = { id: string; code: string; name: string; owner?: string; phone?: string; mobile?: string };
type Group = { id: string; code: string; name: string };
type Warehouse = { id: string; code: string; group: string; name: string };
type Item = { id: string; code: string; name: string; spec?: string; unit?: string; price?: number };
type PurchaseRow = { id: string; item: string; spec: string; qty: string | number; price: string | number; supply: number; vat: number; total: number };
type Purchase = { id: string; date: string; vendor: string; warehouse: string; rows: PurchaseRow[]; supplyTotal: number; vatTotal: number; total: number; itemSummary: string; image_urls?: string[]; image_url?: string };
type MaintItem = { id: string; item: string; spec: string; qty: string | number; price: string | number; supply: number; vat: number; total: number };
type Maint = { id: string; date: string; warehouse: string; manager: string; title: string; detail: string; cost: number | string;
  image_url?: string;
  image_urls?: string[]; items?: MaintItem[]; supplyTotal?: number; vatTotal?: number; total?: number };
type CardUse = { id: string; date: string; user_name: string; place: string; amount: number | string; memo?: string;
  image_url?: string;
  image_urls?: string[]; created_at?: string };
type PermitRenewal = {
  id: string;
  company: string;
  title: string;
  agency?: string;
  contact?: string;
  expiry_date?: string;
  check_note?: string;
  memo?: string;
  cycle?: string;
  status?: string;
  document_urls?: string[];
  created_at?: string;
};

type VendorAccount = {
  id: string;
  vendor_name: string;
  bank_code?: string;
  bank_name?: string;
  account_name?: string;
  customer_display_name?: string;
  account_number?: string;
  memo?: string;
};

type BulkTransferRow = {
  id: string;
  vendor: string;
  amount: number;
  bank_code: string;
  bank_name: string;
  account_name: string;
  customer_display_name: string;
  account_number: string;
  memo: string;
  matched: boolean;
};

type ReceiptPhoto = {
  id: string;
  receipt_date: string;
  vendor_name: string;
  memo?: string;
  image_urls?: string[];
  created_by?: string;
  is_processed?: boolean;
  created_at?: string;
};


type MaintenanceSchedule = {
  id: string;
  schedule_date: string;
  equipment_name: string;
  work_detail: string;
  worker_name?: string;
  priority?: string;
  status?: string;
  memo?: string;
  created_at?: string;
};

type MaintenancePhoto = {
  id: string;
  maint_date: string;
  equipment_name: string;
  memo?: string;
  image_urls?: string[];
  created_by?: string;
  is_processed?: boolean;
  is_urgent?: boolean;
  created_at?: string;
};



const supabase = createClient(
  "https://jqdvxmatbmmeubtoogvl.supabase.co",
  "sb_publishable_83Pb_nHMoZCduendoRwE5w_uJqiuvH7",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  }
);

const toPurchase = (p: any): Purchase => ({
  id: p.id,
  date: p.date || "",
  vendor: p.vendor || "",
  warehouse: p.warehouse || "",
  rows: p.rows || [],
  supplyTotal: Number(p.supplytotal ?? p.supplyTotal ?? 0),
  vatTotal: Number(p.vattotal ?? p.vatTotal ?? 0),
  total: Number(p.total || 0),
  itemSummary: p.itemsummary ?? p.itemSummary ?? "",
  image_url: p.image_url || "",
  image_urls: p.image_urls || (p.image_url ? [p.image_url] : []),
});

const fromPurchase = (p: Purchase) => ({
  id: p.id,
  date: p.date,
  vendor: p.vendor,
  warehouse: p.warehouse,
  rows: p.rows,
  supplytotal: p.supplyTotal,
  vattotal: p.vatTotal,
  total: p.total,
  itemsummary: p.itemSummary,
  image_url: (p.image_urls || [])[0] || p.image_url || "",
  image_urls: p.image_urls || (p.image_url ? [p.image_url] : []),
});

const KEY = {
  vendors: "erp_vendors_v2",
  groups: "erp_groups_v2",
  warehouses: "erp_warehouses_v2",
  items: "erp_items_v2",
  purchases: "erp_purchases_v2",
  maints: "erp_maints_v2",
};


const AUTH_PREF_KEY = "erp_auth_preferences_v1";

const readAuthPrefs = () => {
  try {
    const saved = localStorage.getItem(AUTH_PREF_KEY);
    return saved ? JSON.parse(saved) : { saveEmail: false, autoLogin: false, email: "" };
  } catch {
    return { saveEmail: false, autoLogin: false, email: "" };
  }
};

const writeAuthPrefs = (prefs: { saveEmail: boolean; autoLogin: boolean; email: string }) => {
  localStorage.setItem(AUTH_PREF_KEY, JSON.stringify(prefs));
};

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const nextCode = (arr: { code?: string }[]) => String(arr.length + 1).padStart(4, "0");

const formatInputDate = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 8);

  if (numbers.length === 6) {
    return `20${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 6)}`;
  }

  if (numbers.length === 8) {
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
  }

  return value;
};

const money = (v: number | string | undefined) => Number(v || 0).toLocaleString("ko-KR");

const getPurchaseItemSummary = (purchase: Pick<Purchase, "itemSummary" | "rows">) => {
  const itemNames = (purchase.rows || [])
    .map((row) => String(row.item || "").trim())
    .filter(Boolean);

  if (!itemNames.length) return purchase.itemSummary || "-";

  const firstItem = itemNames[0];
  const extraCount = itemNames.length - 1;

  return extraCount > 0 ? `${firstItem} 외 ${extraCount}건` : firstItem;
};



const parseExcelLikeDate = (value: any) => {
  if (!value && value !== 0) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return excelEpoch.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const formatted = formatInputDate(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return "";
};

const getDday = (date?: string) => {
  if (!date) return null;
  const today = new Date(getTodayKey());
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const permitStableId = (company: string, title: string) => {
  return `permit-${company}-${title}`.replace(/\s+/g, "-").slice(0, 180);
};


const normalizeVendorName = (value: string) =>
  String(value || "")
    .replace(/[\s㈜\(\)\[\]주식회사]/g, "")
    .toLowerCase();

const bankCodeByName = (name: string) => {
  const raw = String(name || "").replace(/\s/g, "");
  if (raw.includes("농협") || raw.includes("NH")) return "11";
  if (raw.includes("국민")) return "04";
  if (raw.includes("기업") || raw.includes("IBK") || raw.includes("중소기업")) return "03";
  if (raw.includes("하나")) return "81";
  if (raw.includes("우리")) return "20";
  if (raw.includes("신한")) return "88";
  if (raw.includes("신협")) return "48";
  if (raw.includes("SC") || raw.includes("제일")) return "23";
  if (raw.includes("카카오")) return "090";
  return "";
};

const cleanAccountNumber = (value: string) => String(value || "").replace(/[^0-9]/g, "");

const pick = (obj: Record<string, any>, keys: string[]) => {
  const found = Object.keys(obj).find((k) => keys.some((x) => k.includes(x)));
  return found ? obj[found] : "";
};

async function readExcelRows(file: File) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
}

const downloadExcel = (fileName: string, rows: Record<string, any>[]) => {
  if (!rows.length) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }

  const headers = Object.keys(rows[0] || {});
  const body = rows.map((row) => headers.map((h) => row[h] ?? ""));
  const sheetData = [headers, ...body];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const lastRow = sheetData.length;
  const lastColIndex = Math.max(headers.length - 1, 0);
  const lastCol = XLSX.utils.encode_col(lastColIndex);

  worksheet["!autofilter"] = { ref: `A1:${lastCol}${lastRow}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  worksheet["!cols"] = headers.map((h, colIndex) => {
    const maxLength = sheetData.reduce((max, row) => {
      const value = row[colIndex] == null ? "" : String(row[colIndex]);
      return Math.max(max, value.length);
    }, String(h).length);

    const header = String(h);
    if (header.includes("일자") || header.includes("관리번호")) return { wch: 18 };
    if (header.includes("거래처") || header.includes("사용처")) return { wch: 24 };
    if (header.includes("품목") || header.includes("제목") || header.includes("내용") || header.includes("메모")) return { wch: 28 };
    if (header.includes("영수증")) return { wch: 34 };
    if (["수량", "단가", "공급가액", "부가세", "부가세액", "합계", "금액"].some((x) => header.includes(x))) return { wch: 14 };

    return { wch: Math.min(Math.max(maxLength + 3, 12), 30) };
  });

  worksheet["!rows"] = [{ hpt: 24 }, ...body.map(() => ({ hpt: 20 }))];

  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "1F4E78" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "BFBFBF" } },
      bottom: { style: "thin", color: { rgb: "BFBFBF" } },
      left: { style: "thin", color: { rgb: "BFBFBF" } },
      right: { style: "thin", color: { rgb: "BFBFBF" } },
    },
  };

  const totalStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } },
    font: { bold: true, color: { rgb: "7F6000" } },
    alignment: { vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "C9B458" } },
      bottom: { style: "thin", color: { rgb: "C9B458" } },
      left: { style: "thin", color: { rgb: "C9B458" } },
      right: { style: "thin", color: { rgb: "C9B458" } },
    },
  };

  const normalBorder = {
    top: { style: "thin", color: { rgb: "E5E7EB" } },
    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
    left: { style: "thin", color: { rgb: "E5E7EB" } },
    right: { style: "thin", color: { rgb: "E5E7EB" } },
  };

  for (let r = 1; r <= lastRow; r++) {
    const isHeader = r === 1;
    const firstCell = worksheet[XLSX.utils.encode_cell({ r: r - 1, c: 0 })];
    const isTotalRow = !isHeader && String(firstCell?.v || "").includes("총합계");

    for (let c = 0; c <= lastColIndex; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: r - 1, c });
      const cell = worksheet[cellAddress];
      if (!cell) continue;

      const header = headers[c] || "";

      if (isHeader) {
        cell.t = "s";
        cell.s = headerStyle;
        continue;
      }

      if (["수량", "단가", "공급가액", "부가세", "부가세액", "합계", "금액"].some((x) => header.includes(x))) {
        const num = Number(cell.v || 0);
        if (!Number.isNaN(num)) {
          cell.v = num;
          cell.t = "n";
          cell.z = "#,##0";
        }
      }

      cell.s = {
        border: normalBorder,
        alignment: { vertical: "center" },
      };

      if (isTotalRow) {
        cell.s = totalStyle;
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: fileName,
    Subject: "태명산업개발 ERP 다운로드",
    Author: "태명산업개발",
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(workbook, worksheet, "자료");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};


const downloadPdf = (fileName: string, title: string, rows: Record<string, any>[]) => {
  if (!rows.length) {
    alert("출력할 데이터가 없습니다.");
    return;
  }

  const escapeHtml = (value: any) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const headers = Object.keys(rows[0] || {});
  const totalIndex = rows.findIndex((row) => String(row[headers[0]] || "").includes("총합계"));

  const tableHead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const tableBody = rows
    .map((row, rowIndex) => {
      const isTotal = rowIndex === totalIndex || String(row[headers[0]] || "").includes("총합계");
      const cells = headers
        .map((h) => {
          const raw = row[h];
          const isNumber = typeof raw === "number" || ["금액", "합계", "공급가액", "부가세", "부가세액", "수량", "단가"].some((key) => h.includes(key));
          const value = isNumber && raw !== "" && raw != null && !Number.isNaN(Number(raw))
            ? Number(raw).toLocaleString("ko-KR")
            : raw;
          return `<td class="${isNumber ? "right" : ""}">${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr class="${isTotal ? "total" : ""}">${cells}</tr>`;
    })
    .join("");

  const printable = window.open("", "_blank", "width=1200,height=800");
  if (!printable) {
    alert("팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 출력하세요.");
    return;
  }

  printable.document.open();
  printable.document.write(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(fileName)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif;
      color: #111827;
      background: #ffffff;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 800;
    }
    .meta {
      margin-bottom: 12px;
      font-size: 11px;
      color: #475569;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      font-size: 10px;
    }
    th {
      background: #e8f1fb;
      color: #111827;
      font-weight: 800;
      border: 1px solid #cbd5e1;
      padding: 6px 5px;
      text-align: center;
      white-space: nowrap;
    }
    td {
      border: 1px solid #e5e7eb;
      padding: 5px;
      vertical-align: middle;
      word-break: keep-all;
    }
    td.right { text-align: right; }
    tr.total td {
      background: #fff2cc;
      font-weight: 800;
      border-color: #c9b458;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">출력일: ${todayText()}</div>
  <table>
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${tableBody}</tbody>
  </table>
  <script>
    window.onload = () => {
      setTimeout(() => window.print(), 250);
    };
  </script>
</body>
</html>`);
  printable.document.close();
};


const todayText = () => new Date().toISOString().slice(0, 10);

const withTotalRow = (rows: Record<string, any>[], totalRow: Record<string, any>) => {
  return rows.length ? [...rows, totalRow] : rows;
};


const upsertInChunks = async (table: string, rows: any[], chunkSize = 500) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) return error;
  }
  return null;
};


const fetchAllRows = async (table: string, orderColumn = "code", pageSize = 1000) => {
  let allRows: any[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: true })
      .range(from, to);

    if (error) return { data: allRows, error };

    const rows = data || [];
    allRows = [...allRows, ...rows];

    if (rows.length < pageSize) break;

    from += pageSize;
  }

  return { data: allRows, error: null };
};



const UPDATE_NOTICE_HIDE_KEY = "erp_update_notice_hide_until";

type UpdateNotice = {
  id: string;
  notice_date: string;
  content: string;
  is_active?: boolean;
  created_at?: string;
};

type SiteNotice = {
  id: string;
  notice_date: string;
  title: string;
  content: string;
  priority?: string;
  is_active?: boolean;
  target_roles?: string[];
  target_emails?: string[];
  created_at?: string;
};

type UserRole = "admin" | "office" | "field";

type UserPermission = {
  id: string;
  email: string;
  role: UserRole;
  permissions?: Record<string, boolean>;
  created_at?: string;
  updated_at?: string;
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getYesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const isRecentNotice = (notice: UpdateNotice) => {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();
  return notice.notice_date === today || notice.notice_date === yesterday;
};

const updateNoticeHideValue = () => getTodayKey();


const ERP_PERMISSION_MODULES = [
  { key: "home", label: "홈" },
  { key: "site_notices", label: "공지" },
  { key: "layout", label: "생산라인" },
  { key: "new", label: "구매입력" },
  { key: "list", label: "구매조회" },
  { key: "status", label: "구매현황" },
  { key: "bulk_transfer", label: "대량이체" },
  { key: "receipt_photos", label: "입고사진등록" },
  { key: "vendor_accounts", label: "업체계좌관리" },
  { key: "card_use", label: "카드사용" },
  { key: "card_list", label: "카드조회" },
  { key: "card_stats", label: "카드통계" },
  { key: "maint_new", label: "정비등록" },
  { key: "maint_list", label: "정비조회" },
  { key: "maint_stats", label: "정비통계" },
  { key: "maintenance_photos", label: "정비사진등록" },
  { key: "maintenance_schedule_new", label: "정비일정등록" },
  { key: "maintenance_schedules", label: "정비일정조회" },
  { key: "vendors", label: "거래처등록" },
  { key: "warehouse_groups", label: "창고등록" },
  { key: "items", label: "품목등록" },
  { key: "permits", label: "허가관리" },
];

const ERP_OFFICE_BLOCKED_TABS = new Set(["update_notices", "backup_permissions"]);

const dedupeUpdateNotices = (notices: UpdateNotice[]) => {
  const seen = new Set<string>();

  return notices.filter((notice) => {
    const key = `${notice.notice_date}|${String(notice.content || "").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};





function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  options: any[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const normalized = useMemo(() => {
    return (options || [])
      .map((o) => {
        if (typeof o === "string") {
          const text = String(o || "").trim();
          return { label: text, value: text, search: text.toLowerCase() };
        }
        const label = String(o?.label || o?.name || o?.value || "").trim();
        const value = String(o?.value || o?.name || o?.label || "").trim();
        const code = String(o?.code || "").trim();
        const name = String(o?.name || "").trim();
        const search = `${label} ${value} ${code} ${name}`.toLowerCase();
        return { label, value, search };
      })
      .filter((o) => o.label || o.value);
  }, [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized.slice(0, 50);
    return normalized.filter((o) => o.search.includes(q)).slice(0, 80);
  }, [query, normalized]);

  return (
    <div className="search-wrap" style={{ zIndex: open ? 9999 : 1 }}>
      {label && <label>{label}</label>}

      <input
        value={query}
        placeholder={value || placeholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length === 1) {
              onChange(filtered[0].value);
              setQuery("");
              setOpen(false);
            } else {
              setOpen(true);
            }
          }
          if (e.key === "Escape") {
            setQuery("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setQuery("");
            setOpen(false);
          }, 150);
        }}
      />

      {open && (
        <div className="dropdown">
          {filtered.length ? (
            filtered.map((o, i) => (
              <div
                key={`${o.value}-${i}`}
                className="dropdown-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {o.label}
              </div>
            ))
          ) : (
            <div className="dropdown-empty">검색 결과 없음</div>
          )}
        </div>
      )}
    </div>
  );
}

const emptyRow = (): PurchaseRow => ({ id: uid(), item: "", spec: "", qty: "", price: "", supply: 0, vat: 0, total: 0 });
const emptyMaintItem = (): MaintItem => ({ id: uid(), item: "", spec: "", qty: "", price: "", supply: 0, vat: 0, total: 0 });


const loginCss = `
html, body, #root {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
}

.login-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.35), transparent 28%),
    radial-gradient(circle at 80% 80%, rgba(79, 70, 229, 0.28), transparent 32%),
    linear-gradient(135deg, #0f172a 0%, #111827 50%, #1e293b 100%);
  padding: 24px;
  box-sizing: border-box;
  font-family: Arial, 'Malgun Gothic', sans-serif;
}

.login-card {
  width: min(430px, 94vw);
  background: rgba(255, 255, 255, 0.98);
  border-radius: 30px;
  padding: 42px 36px;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.login-badge {
  width: max-content;
  margin: 0 auto 8px;
  padding: 7px 14px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 1px;
}

.login-card h1 {
  margin: 0;
  text-align: center;
  font-size: 44px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #111827;
}

.login-card p {
  margin: 0 0 20px;
  text-align: center;
  color: #64748b;
  font-size: 15px;
  font-weight: 800;
}

.login-card label {
  font-size: 13px;
  font-weight: 800;
  color: #334155;
}

.login-card input {
  width: 100%;
  height: 52px;
  border-radius: 14px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  padding: 0 16px;
  font-size: 15px;
  box-sizing: border-box;
}

.login-card input:focus {
  outline: none;
  border-color: #2563eb;
  background: white;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}

.login-button {
  width: 100%;
  height: 54px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(90deg, #2563eb, #4f46e5);
  color: white;
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
  margin-top: 8px;
}


.login-options {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 4px 0 2px;
}

.login-options label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
  color: #334155;
  cursor: pointer;
}

.login-options input {
  width: 16px;
  height: 16px;
  min-height: 0;
  padding: 0;
  accent-color: #2563eb;
}

.login-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 12px;
  font-size: 13px;
  font-weight: 700;
}
.receipt-preview{
  font-size:14px;
  color:#64748b;
}
.receipt-preview a{
  color:#2563eb;
  font-weight:800;
  text-decoration:none;
}


.site-notice-target-box{
  margin:14px 0 4px;
  padding:14px;
  border:1px solid #dbeafe;
  border-radius:16px;
  background:#f8fafc;
}
.site-notice-target-box>strong{
  display:block;
  margin-bottom:10px;
  color:#0f172a;
  font-weight:1000;
}
.site-notice-target-checks,
.site-notice-target-emails{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}
.site-notice-target-emails{
  margin-top:10px;
}
.site-notice-target-checks label,
.site-notice-target-emails label{
  display:inline-flex;
  align-items:center;
  gap:7px;
  margin:0;
  padding:8px 10px;
  border:1px solid #e2e8f0;
  border-radius:999px;
  background:white;
  color:#334155;
  font-size:12px;
  font-weight:900;
}
.site-notice-target-checks input,
.site-notice-target-emails input{
  width:auto;
  accent-color:#2563eb;
}
.site-notice-target-emails em{
  color:#64748b;
  font-style:normal;
}
.site-notice-modern-card-top small{
  color:#64748b;
  font-size:12px;
  font-weight:900;
}

`;

export default function App() {
  const [vendors, setVendors] = useState<Vendor[]>(() =>
    read(KEY.vendors, [
      { id: uid(), code: "V001", name: "수산세보틱스", owner: "", phone: "", mobile: "" },
      { id: uid(), code: "V002", name: "영재카", owner: "", phone: "", mobile: "" },
    ])
  );
  const [groups, setGroups] = useState<Group[]>(() =>
    read(KEY.groups, [
      { id: uid(), code: "0001", name: "크라샤" },
      { id: uid(), code: "0002", name: "폐목" },
    ])
  );
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() =>
    read(KEY.warehouses, [
      { id: uid(), code: "0001", group: "크라샤", name: "로더" },
      { id: uid(), code: "0002", group: "크라샤", name: "암프" },
    ])
  );
  const [items, setItems] = useState<Item[]>(() =>
    read(KEY.items, [
      { id: uid(), code: "0001", name: "유압호스", spec: "A형", unit: "ea", price: 50000 },
      { id: uid(), code: "0002", name: "베어링", spec: "B형", unit: "ea", price: 20000 },
      { id: uid(), code: "0003", name: "타이어", spec: "29인치", unit: "ea", price: 300000 },
    ])
  );
  const [purchases, setPurchases] = useState<Purchase[]>(() => read(KEY.purchases, []));
  const [maints, setMaints] = useState<Maint[]>(() => read(KEY.maints, []));
  const [cardUses, setCardUses] = useState<CardUse[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authPrefs, setAuthPrefs] = useState(() => readAuthPrefs());
  const [loginForm, setLoginForm] = useState(() => ({ email: readAuthPrefs().email || "", password: "" }));
  const [loginError, setLoginError] = useState("");
  const adminEmails = ["jsd2973@gmail.com"];
  const userEmail = session?.user?.email || "";
  const isAdmin = adminEmails.includes(userEmail);

  const [menuTab, setMenuTab] = useState("home");
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [hideUpdateToday, setHideUpdateToday] = useState(false);
  const [updateNotices, setUpdateNotices] = useState<UpdateNotice[]>([]);
  const [siteNotices, setSiteNotices] = useState<SiteNotice[]>([]);
  const [siteNoticeForm, setSiteNoticeForm] = useState({ title: "", content: "", priority: "보통", is_active: true, target_roles: ["all"], target_emails: [] as string[] });
  const [editingSiteNoticeId, setEditingSiteNoticeId] = useState("");
  const [siteNoticeError, setSiteNoticeError] = useState("");

  const recentUpdateItems = updateNotices.filter(isRecentNotice).slice(0, 3);
  const [updateNoticeForm, setUpdateNoticeForm] = useState({ notice_date: getTodayKey(), content: "" });
  const [editingUpdateNoticeId, setEditingUpdateNoticeId] = useState("");
  const [updateNoticeError, setUpdateNoticeError] = useState("");
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [permissionForm, setPermissionForm] = useState<UserPermission>({
    id: uid(),
    email: "",
    role: "field",
    permissions: {},
  });
  const currentUserPermission = userPermissions.find((item) => item.email === userEmail);
  const currentRole: UserRole = isAdmin ? "admin" : (currentUserPermission?.role || "office");
  const canCreateRecords = currentRole === "admin" || currentRole === "office";
  const canEditDeleteRecords = currentRole === "admin";
  const canAccessTab = (tab: string) => {
    if (!tab) return true;
    if (tab === "site_notices") return true;
    if (isAdmin) return true;
    if (currentRole === "office") return !ERP_OFFICE_BLOCKED_TABS.has(tab);
    const permissions = currentUserPermission?.permissions || {};
    return !!permissions[tab];
  };

  const getFirstAllowedTab = () => {
    if (isAdmin || currentRole === "office") return "home";
    const permissions = currentUserPermission?.permissions || {};
    const first = ERP_PERMISSION_MODULES.find((module) => permissions[module.key]);
    return first?.key || "home";
  };
  const canShowAny = (tabs: string[]) => tabs.some((tab) => canAccessTab(tab));
  const menuButton = (tab: string, label: string) =>
    canAccessTab(tab) ? <button onMouseDown={() => setMenuTab(tab)}>{label}</button> : null;
  const mobileMenuButton = (tab: string, label: string) =>
    canAccessTab(tab) ? <button onClick={() => { setMenuTab(tab); setMobileSheet(""); }}>{label}</button> : null;

  const visibleSiteNotices = useMemo(() => {
    return (siteNotices || []).filter((notice) => {
      if (isAdmin) return true;
      const roles = Array.isArray(notice.target_roles) ? notice.target_roles : ["all"];
      const emails = Array.isArray(notice.target_emails) ? notice.target_emails : [];
      if (!roles.length && !emails.length) return true;
      if (roles.includes("all")) return true;
      if (roles.includes(currentRole)) return true;
      if (userEmail && emails.includes(userEmail)) return true;
      return false;
    });
  }, [siteNotices, isAdmin, currentRole, userEmail]);

  const [mobileSheet, setMobileSheet] = useState<"" | "buy" | "card" | "maint" | "more">("");
  const [showMobileQuickStart, setShowMobileQuickStart] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 900 : false
  );
  const openMobileQuickMenu = (target: string) => {
    setMenuTab(target as any);
    setMobileSheet("");
    setShowMobileQuickStart(false);
  };
  const [purchaseHeader, setPurchaseHeader] = useState({ date: "", vendor: "", warehouse: "", image_urls: [] as string[] });
  const [rows, setRows] = useState<PurchaseRow[]>([emptyRow()]);
  const [editingPurchaseId, setEditingPurchaseId] = useState("");
  const [purchaseSearch, setPurchaseSearch] = useState({ from: "", to: "", vendor: "", warehouse: "", item: "" });

  const [vendorForm, setVendorForm] = useState({ code: `V${String(vendors.length + 1).padStart(3, "0")}`, name: "", owner: "", phone: "", mobile: "" });
  const [vendorImportMessage, setVendorImportMessage] = useState("");
  const [editingVendorId, setEditingVendorId] = useState("");
  const [groupForm, setGroupForm] = useState({ code: nextCode(groups), name: "" });
  const [warehouseForm, setWarehouseForm] = useState({ group: "", code: nextCode(warehouses), name: "" });
  const [editingGroupId, setEditingGroupId] = useState("");
  const [editingWarehouseId, setEditingWarehouseId] = useState("");
  const [itemForm, setItemForm] = useState({ code: nextCode(items), name: "", spec: "", unit: "", price: "" });
  const [itemImportMessage, setItemImportMessage] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [maintForm, setMaintForm] = useState({ date: "", warehouse: "", manager: "", title: "", detail: "", cost: "", image_urls: [] as string[] });
  const [maintItems, setMaintItems] = useState<MaintItem[]>([emptyMaintItem()]);
  const [editingMaintId, setEditingMaintId] = useState("");
  const [maintSearch, setMaintSearch] = useState({ from: "", to: "", warehouse: "", keyword: "" });
  const [newItemModal, setNewItemModal] = useState<{ open: boolean; rowIndex: number | null }>({ open: false, rowIndex: null });
  const [newItemForm, setNewItemForm] = useState({ name: "", spec: "", unit: "", price: "" });
  const [cardForm, setCardForm] = useState({ date: "", user_name: "", place: "", amount: "", memo: "", image_url: "", image_urls: [] as string[] });
  const [editingCardUseId, setEditingCardUseId] = useState("");
  const [cardSearch, setCardSearch] = useState({ from: "", to: "", user_name: "", place: "" });
  const [receiptPhotos, setReceiptPhotos] = useState<ReceiptPhoto[]>([]);
  const [receiptPhotoForm, setReceiptPhotoForm] = useState({ receipt_date: getTodayKey(), vendor_name: "", memo: "" });
  const [receiptPhotoFiles, setReceiptPhotoFiles] = useState<File[]>([]);
  const [receiptPhotoPreviewOpen, setReceiptPhotoPreviewOpen] = useState<ReceiptPhoto | null>(null);
  const [maintenancePhotos, setMaintenancePhotos] = useState<MaintenancePhoto[]>([]);
  const [maintenancePhotoForm, setMaintenancePhotoForm] = useState({
    maint_date: getTodayKey(),
    equipment_name: "",
    memo: "",
    is_urgent: false,
  });
  const [maintenancePhotoFiles, setMaintenancePhotoFiles] = useState<File[]>([]);
  const [maintenancePhotoPreviewOpen, setMaintenancePhotoPreviewOpen] = useState<MaintenancePhoto | null>(null);
  const [linkingReceiptPhotoId, setLinkingReceiptPhotoId] = useState("");
  const [linkingMaintenancePhotoId, setLinkingMaintenancePhotoId] = useState("");
  const [receiptPhotoSaving, setReceiptPhotoSaving] = useState(false);
  const [maintenancePhotoSaving, setMaintenancePhotoSaving] = useState(false);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>([]);
  const [maintenanceScheduleForm, setMaintenanceScheduleForm] = useState({
    schedule_date: getTodayKey(),
    equipment_name: "",
    work_detail: "",
    worker_name: "",
    priority: "보통",
    status: "예정",
    memo: "",
  });
  const [editingMaintenanceScheduleId, setEditingMaintenanceScheduleId] = useState("");

  const [photoLinkModal, setPhotoLinkModal] = useState<{
    mode: "" | "purchase" | "maint" | "recordPurchase" | "recordMaint";
    targetId: string;
    search: string;
  }>({ mode: "", targetId: "", search: "" });


  const [vendorAccounts, setVendorAccounts] = useState<VendorAccount[]>([]);
  const [transferMonth, setTransferMonth] = useState(() => getTodayKey().slice(0, 7));
  const [transferVendorSearch, setTransferVendorSearch] = useState("");
  const [bulkTransferEdits, setBulkTransferEdits] = useState<Record<string, Partial<BulkTransferRow>>>({});
  const [bulkTransferSelectOpen, setBulkTransferSelectOpen] = useState(false);
  const [selectedBulkTransferIds, setSelectedBulkTransferIds] = useState<string[]>([]);
  const [permits, setPermits] = useState<PermitRenewal[]>([]);
  const [permitSearch, setPermitSearch] = useState({ company: "", keyword: "", status: "" });
  const [permitForm, setPermitForm] = useState({
    company: "태명",
    title: "",
    agency: "",
    contact: "",
    expiry_date: "",
    check_note: "",
    memo: "",
    cycle: "",
    status: "진행",
  });
  const [editingPermitId, setEditingPermitId] = useState("");


  const loadVendorAccounts = async () => {
    const { data, error } = await supabase
      .from("vendor_accounts")
      .select("*")
      .order("vendor_name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setVendorAccounts(((data || []) as any[]).map((row) => ({
      ...row,
      id: String(row.id),
      vendor_name: row.vendor_name || "",
      bank_code: row.bank_code || bankCodeByName(row.bank_name || ""),
      bank_name: row.bank_name || "",
      account_name: row.account_name || "",
      account_number: row.account_number || "",
      memo: row.memo || "",
    })) as VendorAccount[]);
  };

  const importVendorAccountsExcel = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const rows: VendorAccount[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const ws = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      json.forEach((r) => {
        const vendorName = String(pick(r, ["거래처명", "업체명", "상호"]) || "").trim();
        if (!vendorName) return;

        const bankName = String(pick(r, ["은행명", "은행"]) || "").trim();
        const bankCode = String(pick(r, ["코드명", "은행코드", "코드"]) || bankCodeByName(bankName)).trim();
        const accountName = String(pick(r, ["이름", "예금주", "입금자명"]) || "").trim();
        const customerDisplayName = String(pick(r, ["고객관리성명", "고객관리명"]) || accountName || vendorName).trim();
        const accountNumber = String(pick(r, ["계좌번호", "계좌"]) || "").trim();

        rows.push({
          id: `account-${normalizeVendorName(vendorName)}`,
          vendor_name: vendorName,
          bank_code: bankCode,
          bank_name: bankName,
          account_name: accountName,
          customer_display_name: customerDisplayName,
          account_number: accountNumber,
          memo: sheetName,
        });
      });
    });

    if (!rows.length) return alert("계좌 엑셀에서 거래처 계좌 정보를 찾지 못했습니다.");

    const dedupedMap = new Map<string, VendorAccount>();
    rows.forEach((row) => {
      const key = row.id || `account-${normalizeVendorName(row.vendor_name)}`;
      const prev = dedupedMap.get(key);

      dedupedMap.set(key, {
        ...(prev || {}),
        ...row,
        id: key,
        bank_code: row.bank_code || prev?.bank_code || bankCodeByName(row.bank_name || prev?.bank_name || ""),
        bank_name: row.bank_name || prev?.bank_name || "",
        account_name: row.account_name || prev?.account_name || "",
        customer_display_name: row.customer_display_name || prev?.customer_display_name || row.account_name || prev?.account_name || row.vendor_name,
        account_number: row.account_number || prev?.account_number || "",
      });
    });

    const dedupedRows = Array.from(dedupedMap.values());

    const { error } = await supabase.from("vendor_accounts").upsert(dedupedRows, { onConflict: "id" });
    if (error) return alert(`거래처 계좌 업로드 실패: ${error.message}`);

    await loadVendorAccounts();
    alert(`거래처 계좌 ${dedupedRows.length}건을 인터넷 DB에 저장했습니다. 중복 ${rows.length - dedupedRows.length}건은 자동 정리했습니다.`);
  };

  const findVendorAccount = (vendorName: string) => {
    const key = normalizeVendorName(vendorName);
    if (!key) return undefined;

    return vendorAccounts.find((a) => normalizeVendorName(a.vendor_name) === key)
      || vendorAccounts.find((a) => key.includes(normalizeVendorName(a.vendor_name)) || normalizeVendorName(a.vendor_name).includes(key));
  };

  const applyBulkTransferEdits = (rows: BulkTransferRow[]) =>
    rows.map((row) => {
      const edit = bulkTransferEdits[row.id] || {};
      const merged = { ...row, ...edit };
      return {
        ...merged,
        amount: Number(merged.amount || 0),
        bank_code: String(merged.bank_code || ""),
        bank_name: String(merged.bank_name || ""),
        account_name: String(merged.account_name || ""),
        customer_display_name: String(merged.customer_display_name || merged.account_name || merged.vendor || ""),
        account_number: String(merged.account_number || ""),
        memo: String(merged.memo || ""),
        matched: !!(merged.bank_code && merged.account_number),
      };
    });

  const updateBulkTransferEdit = (id: string, key: keyof BulkTransferRow, value: any) => {
    setBulkTransferEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: key === "amount" ? Number(String(value).replace(/,/g, "") || 0) : value,
      },
    }));
  };

  const getBulkTransferRows = (): BulkTransferRow[] => {
    const month = transferMonth;
    const vendorFilter = transferVendorSearch.trim();

    const grouped = new Map<string, { vendor: string; amount: number; memoItems: string[] }>();

    purchases
      .filter((p) => !month || String(p.date || "").startsWith(month))
      .filter((p) => !vendorFilter || String(p.vendor || "").includes(vendorFilter))
      .forEach((p) => {
        const vendor = p.vendor || "거래처 미입력";
        const prev = grouped.get(vendor) || { vendor, amount: 0, memoItems: [] };
        prev.amount += Number(p.total || 0);
        if (p.itemSummary) prev.memoItems.push(p.itemSummary);
        grouped.set(vendor, prev);
      });

    return Array.from(grouped.values())
      .map((row) => {
        const account = findVendorAccount(row.vendor);
        const bankName = account?.bank_name || "";
        const bankCode = account?.bank_code || bankCodeByName(bankName);
        const memoItem = row.memoItems[0] || "구매";
        const monthLabel = transferMonth ? transferMonth.slice(5) : "";

        return {
          id: row.vendor,
          vendor: row.vendor,
          amount: row.amount,
          bank_code: bankCode,
          bank_name: bankName,
          account_name: account?.account_name || "",
          customer_display_name: account?.customer_display_name || account?.account_name || row.vendor,
          account_number: account?.account_number || "",
          memo: `${memoItem}/${row.vendor}${monthLabel}`,
          matched: !!(account?.account_number && bankCode),
        };
      })
      .sort((a, b) => {
        if (a.matched !== b.matched) return a.matched ? 1 : -1;
        return a.vendor.localeCompare(b.vendor);
      });
  };

  const createBulkTransferExcel = (targetRows?: BulkTransferRow[]) => {
    const rows = targetRows || applyBulkTransferEdits(getBulkTransferRows());
    if (!rows.length) return alert("대량이체로 만들 구매내역이 없습니다.");

    const missing = rows.filter((row) => !row.matched);
    if (missing.length) {
      const ok = confirm(`계좌 매칭 안 된 거래처가 ${missing.length}건 있습니다. 그래도 다운로드할까요?`);
      if (!ok) return;
    }

    const header = ["*입금은행", "*입금계좌", "*입금액", "고객관리성명", "입금통장표시내용", "출금통장표시내용", "입금인코드", "비고", "업체사용key"];
    const dataRows = rows.map((row) => [
      String(row.bank_code || ""),
      cleanAccountNumber(row.account_number),
      Number(row.amount || 0),
      row.customer_display_name || row.account_name || row.vendor,
      "(주)태명산업개발",
      row.memo,
      "",
      "",
      "",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 24 },
      { wch: 15 },
      { wch: 30 },
      { wch: 24 },
      { wch: 34 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
    ];

    worksheet["!rows"] = [
      { hpt: 22 },
      ...dataRows.map(() => ({ hpt: 22 })),
    ];

    worksheet["!autofilter"] = { ref: `A1:I${dataRows.length + 1}` };

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:I1");

    const border = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    };

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[addr] || { v: "", t: "s" };
        worksheet[addr] = cell;

        const isHeader = r === 0;

        cell.s = {
          fill: {
            patternType: "solid",
            fgColor: { rgb: isHeader ? "B8CCE4" : "D9D9D9" },
          },
          font: {
            name: "Arial",
            sz: 12,
            bold: false,
            color: { rgb: "000000" },
          },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: false,
          },
          border,
        };

        if (c === 2 && r > 0) {
          cell.t = "n";
          cell.z = "#,##0";
        }

        if ((c === 0 || c === 1) && r > 0) {
          cell.t = "s";
          cell.z = "@";
          cell.v = String(cell.v || "");
        }

        if (c === 1 && r > 0) {
          cell.t = "s";
          cell.z = "@";
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: `${transferMonth || getTodayKey().slice(0, 7)} 대량이체`,
      Subject: "태명산업개발 대량이체",
      Author: "태명산업개발",
      CreatedDate: new Date(),
    };

    XLSX.utils.book_append_sheet(workbook, worksheet, "대량이체 미입금분");
    XLSX.writeFile(workbook, `${transferMonth || getTodayKey().slice(0, 7)}_대량이체.xlsx`, { bookType: "xlsx", cellStyles: true });
  };

  const openBulkTransferDownloadPopup = () => {
    const rows = applyBulkTransferEdits(getBulkTransferRows());
    if (!rows.length) return alert("대량이체로 만들 구매내역이 없습니다.");
    setSelectedBulkTransferIds(rows.map((row) => row.id));
    setBulkTransferSelectOpen(true);
  };

  const downloadSelectedBulkTransferExcel = () => {
    const rows = bulkTransferRows.filter((row) => selectedBulkTransferIds.includes(row.id));
    createBulkTransferExcel(rows);
    setBulkTransferSelectOpen(false);
  };

  const toggleBulkTransferSelection = (id: string) => {
    setSelectedBulkTransferIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };


  const loadPermits = async () => {
    const { data, error } = await supabase
      .from("permit_renewals")
      .select("*")
      .order("expiry_date", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setPermits(((data || []) as any[]).map((p) => ({
      ...p,
      id: String(p.id),
      expiry_date: p.expiry_date ? String(p.expiry_date).slice(0, 10) : "",
      document_urls: p.document_urls || [],
    })) as PermitRenewal[]);
  };

  const resetPermitForm = () => {
    setEditingPermitId("");
    setPermitForm({
      company: "태명",
      title: "",
      agency: "",
      contact: "",
      expiry_date: "",
      check_note: "",
      memo: "",
      cycle: "",
      status: "진행",
    });
  };

  const savePermit = async () => {
    if (editingPermitId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!permitForm.title.trim()) return alert("허가/신고명을 입력하세요.");

    const id = editingPermitId || permitStableId(permitForm.company, permitForm.title.trim());
    const payload = {
      id,
      company: permitForm.company,
      title: permitForm.title.trim(),
      agency: permitForm.agency,
      contact: permitForm.contact,
      expiry_date: permitForm.expiry_date || null,
      check_note: permitForm.check_note,
      memo: permitForm.memo,
      cycle: permitForm.cycle,
      status: permitForm.status || "진행",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("permit_renewals").upsert(payload);

    if (error) return alert(`허가/갱신 저장 실패: ${error.message}`);

    await loadPermits();
    resetPermitForm();
  };

  const editPermit = (permit: PermitRenewal) => {
    setEditingPermitId(permit.id);
    setPermitForm({
      company: permit.company || "태명",
      title: permit.title || "",
      agency: permit.agency || "",
      contact: permit.contact || "",
      expiry_date: permit.expiry_date || "",
      check_note: permit.check_note || "",
      memo: permit.memo || "",
      cycle: permit.cycle || "",
      status: permit.status || "진행",
    });
    setMenuTab("permits");
  };

  const deletePermit = async (id: string) => {
    if (!confirm("허가/갱신 항목을 삭제할까요?")) return;

    const { error } = await supabase.from("permit_renewals").delete().eq("id", id);
    if (error) return alert(`허가/갱신 삭제 실패: ${error.message}`);

    await loadPermits();
  };

  const importPermitExcel = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const rows: any[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const ws = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
      const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell || "").trim() === "내용"));
      if (headerIndex < 0) return;

      matrix.slice(headerIndex + 1).forEach((row) => {
        const title = String(row[0] || "").trim();
        if (!title) return;

        const permit = {
          id: permitStableId(sheetName, title),
          company: sheetName,
          title,
          agency: String(row[1] || "").trim(),
          contact: String(row[2] || "").trim(),
          expiry_date: parseExcelLikeDate(row[3]) || null,
          check_note: String(row[5] || "").trim(),
          memo: String(row[5] || "").trim(),
          cycle: String(row[6] || "").trim(),
          status: "진행",
          updated_at: new Date().toISOString(),
        };

        rows.push(permit);
      });
    });

    if (!rows.length) return alert("엑셀에서 등록할 허가/갱신 항목을 찾지 못했습니다.");

    const { error } = await supabase.from("permit_renewals").upsert(rows, { onConflict: "id" });

    if (error) return alert(`허가/갱신 엑셀 업로드 실패: ${error.message}`);

    await loadPermits();
    alert(`허가/갱신 항목 ${rows.length}건을 인터넷 DB에 저장했습니다.`);
  };


  const loadAll = async () => {
    setLoading(true);
    const [vRes, gRes, wRes, pRes, mRes, cRes] = await Promise.all([
      supabase.from("vendors").select("*").order("code", { ascending: true }),
      supabase.from("warehouse_groups").select("*").order("code", { ascending: true }),
      supabase.from("warehouses").select("*").order("code", { ascending: true }),
      supabase.from("purchases").select("*").order("date", { ascending: false }),
      supabase.from("maints").select("*").order("date", { ascending: false }),
      supabase.from("card_uses").select("*").order("date", { ascending: false }),
    ]);

    const iRes = await fetchAllRows("items", "code", 1000);

    if (vRes.error || gRes.error || wRes.error || iRes.error || pRes.error || mRes.error || cRes.error) {
      console.error(vRes.error || gRes.error || wRes.error || iRes.error || pRes.error || mRes.error || cRes.error);
      alert("Supabase 데이터를 불러오지 못했습니다. .env와 RLS 정책을 확인하세요.");
      setLoading(false);
      return;
    }

    const nextVendors = (vRes.data || []) as Vendor[];
    const nextGroups = (gRes.data || []) as Group[];
    const nextWarehouses = (wRes.data || []) as Warehouse[];
    const nextItems = ((iRes.data || []) as any[]).map((x) => ({ ...x, price: Number(x.price || 0) })) as Item[];

    setVendors(nextVendors);
    setGroups(nextGroups);
    setWarehouses(nextWarehouses);
    setItems(nextItems);
    setPurchases(((pRes.data || []) as any[]).map(toPurchase));
    setMaints(((mRes.data || []) as any[]).map((m) => ({ ...m, cost: Number(m.cost || 0), items: m.items || [] })));
    setCardUses(((cRes.data || []) as any[]).map((c) => ({ ...c, amount: Number(c.amount || 0) })));

    setVendorForm({ code: `V${String(nextVendors.length + 1).padStart(3, "0")}`, name: "", owner: "", phone: "", mobile: "" });
    setGroupForm({ code: nextCode(nextGroups), name: "" });
    setWarehouseForm({ group: "", code: nextCode(nextWarehouses), name: "" });
    setItemForm({ code: nextCode(nextItems), name: "", spec: "", unit: "", price: "" });
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;

    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      setAuthLoading(false);
    };

    restoreSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === "SIGNED_OUT" || !nextSession) {
        setSession(null);
        setAuthLoading(false);
        return;
      }

      setSession(nextSession);
      setAuthLoading(false);
    });

    const keepAlive = window.setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
      }
    }, 10 * 60 * 1000);

    return () => {
      alive = false;
      window.clearInterval(keepAlive);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadAll();
      loadPermits();
      loadVendorAccounts();
      loadReceiptPhotos();
      loadMaintenancePhotos();
      loadMaintenanceSchedules();
      loadSiteNotices();
      loadUserPermissions();
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;

    if (["new", "list", "status", "bulk_transfer", "card_use", "card_list", "card_stats", "maint_new", "maint_list", "maint_stats", "home"].includes(menuTab)) {
      loadAll();
    }

    if (menuTab === "permits") {
      loadPermits();
    }

    if (menuTab === "vendor_accounts" || menuTab === "bulk_transfer") {
      loadVendorAccounts();
    }

    if (menuTab === "receipt_photos") {
      loadReceiptPhotos();
    }

    if (menuTab === "maintenance_photos") {
      loadMaintenancePhotos();
    }

    if (menuTab === "maintenance_schedule_new" || menuTab === "maintenance_schedules") {
      loadMaintenanceSchedules();
    }
  }, [menuTab, session]);


  useEffect(() => {
    if (!session) return;
    if (!canAccessTab(menuTab)) {
      setMenuTab(getFirstAllowedTab());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email, menuTab, currentRole, userPermissions.length]);

  const vendorOptions = useMemo(
    () =>
      vendors
        .map((v) => ({ label: `${v.code} / ${v.name}`, value: v.name, code: v.code, name: v.name }))
        .filter((v) => v.name),
    [vendors]
  );
  const warehouseNames = useMemo(() => [...groups.map((g) => g.name), ...warehouses.map((w) => `${w.group} / ${w.name}`)], [groups, warehouses]);
  const maintenanceEquipmentOptions = useMemo(() => {
    const values = [
      ...groups.map((g) => g.name),
      ...warehouses.map((w) => `${w.group} / ${w.name}`),
      ...warehouses.map((w) => w.name),
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [groups, warehouses]);
  const itemOptions = useMemo(
    () => items.map((i) => ({ label: i.name, value: i.name, code: i.code, name: i.name })).filter((i) => i.name),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      `${it.code || ""} ${it.name || ""} ${it.spec || ""} ${it.unit || ""}`.toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  const updateRow = (index: number, key: keyof PurchaseRow, value: any) => {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    if (key === "item") {
      const item = items.find((i) => i.name === value);
      if (item) {
        next[index].spec = item.spec || "";
        next[index].price = item.price || 0;
      }
    }
    if (["item", "qty", "price"].includes(key)) {
      const qty = Number(next[index].qty || 0);
      const price = Number(next[index].price || 0);
      next[index].supply = qty * price;
      next[index].vat = Math.round(next[index].supply * 0.1);
      next[index].total = next[index].supply + next[index].vat;
    }
    if (key === "supply") {
      next[index].supply = Number(value || 0);
      next[index].vat = Math.round(next[index].supply * 0.1);
      next[index].total = next[index].supply + next[index].vat;
    }
    if (key === "vat") {
      next[index].vat = Number(value || 0);
      next[index].total = Number(next[index].supply || 0) + next[index].vat;
    }
    setRows(next);
  };

  const purchaseSupplyTotal = rows.reduce((sum, r) => sum + Number(r.supply || 0), 0);
  const purchaseVatTotal = rows.reduce((sum, r) => sum + Number(r.vat || 0), 0);
  const purchaseTotal = rows.reduce((sum, r) => sum + Number(r.total || 0), 0);

  const resetPurchaseForm = () => {
    setPurchaseHeader({ date: "", vendor: "", warehouse: "", image_urls: [] });
    setRows([emptyRow()]);
    setEditingPurchaseId("");
  };

  const savePurchase = async () => {
    if (editingPurchaseId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    const validRows = rows.filter((r) => r.item && Number(r.qty) > 0);
    if (!purchaseHeader.vendor || !purchaseHeader.warehouse || !validRows.length) return alert("거래처, 창고, 품목/수량을 확인하세요.");
    const payload: Purchase = {
      id: editingPurchaseId || uid(),
      ...purchaseHeader,
      rows: validRows,
      supplyTotal: purchaseSupplyTotal,
      vatTotal: purchaseVatTotal,
      total: purchaseTotal,
      itemSummary: getPurchaseItemSummary({ itemSummary: validRows[0].item, rows: validRows }),
      image_urls: purchaseHeader.image_urls || [],
      image_url: (purchaseHeader.image_urls || [])[0] || "",
    };
    const { error } = await supabase.from("purchases").upsert(fromPurchase(payload));
    if (error) return alert(`구매 저장 실패: ${error.message}`);
    setPurchases((prev) => (editingPurchaseId ? prev.map((p) => (p.id === editingPurchaseId ? payload : p)) : [payload, ...prev]));
    if (linkingReceiptPhotoId) {
      await markReceiptPhotoProcessed(linkingReceiptPhotoId);
      setLinkingReceiptPhotoId("");
    }
    resetPurchaseForm();
    setMenuTab("list");
  };



  const compressReceiptImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/")) return resolve(file);

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();

        img.onload = () => {
          const maxSize = 1600;
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const width = Math.round(img.width * scale);
          const height = Math.round(img.height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(file);

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);

              const compressed = new File(
                [blob],
                `receipt-${Date.now()}.jpg`,
                { type: "image/jpeg" }
              );

              resolve(compressed);
            },
            "image/jpeg",
            0.75
          );
        };

        img.onerror = () => resolve(file);
        img.src = String(reader.result || "");
      };

      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };


  const uploadCardReceipts = async (files: FileList | File[]) => {
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = file.type === "application/pdf" ? "pdf" : "jpg";
      const fileName = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("receipts").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`영수증 여러 장 업로드 실패: ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("receipts").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };



  const uploadMaintFiles = async (files: FileList | File[]) => {
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = file.type === "application/pdf" ? "pdf" : "jpg";
      const fileName = `maint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("receipts").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`정비 첨부 업로드 실패: ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("receipts").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };


  const loadMaintenancePhotos = async () => {
    const { data, error } = await supabase
      .from("maintenance_photos")
      .select("*")
      .order("maint_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMaintenancePhotos(((data || []) as any[]).map((item) => ({
      ...item,
      id: String(item.id),
      maint_date: item.maint_date ? String(item.maint_date).slice(0, 10) : "",
      image_urls: item.image_urls || [],
    })) as MaintenancePhoto[]);
  };

  const loadMaintenanceSchedules = async () => {
    const { data, error } = await supabase
      .from("maintenance_schedules")
      .select("*")
      .order("schedule_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setMaintenanceSchedules(((data || []) as any[]).map((item) => ({
      ...item,
      id: String(item.id),
      schedule_date: item.schedule_date ? String(item.schedule_date).slice(0, 10) : "",
    })) as MaintenanceSchedule[]);
  };

  const uploadMaintenancePhotoFiles = async (files: File[]) => {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = file.type === "application/pdf" ? "pdf" : "jpg";
      const fileName = `maintenance-photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("maintenance-photos").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`정비사진 업로드 실패: ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("maintenance-photos").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const saveMaintenancePhoto = async () => {
    if (maintenancePhotoSaving) return;
    if (!maintenancePhotoForm.maint_date) return alert("일자를 입력하세요.");
    if (!maintenancePhotoForm.equipment_name.trim()) return alert("설비명을 입력하세요.");
    if (!maintenancePhotoForm.memo.trim() && !maintenancePhotoFiles.length) return alert("정비내용 또는 사진을 입력하세요.");

    setMaintenancePhotoSaving(true);

    try {
      const equipmentName = maintenancePhotoForm.equipment_name.trim();
      const memo = maintenancePhotoForm.memo.trim();

      const { data: duplicate } = await supabase
        .from("maintenance_photos")
        .select("id")
        .eq("maint_date", maintenancePhotoForm.maint_date)
        .eq("equipment_name", equipmentName)
        .eq("memo", memo)
        .limit(1);

      if ((duplicate || []).length) {
        alert("같은 일자/설비명/내용의 정비사진이 이미 등록되어 있습니다.");
        return;
      }

      const imageUrls = maintenancePhotoFiles.length ? await uploadMaintenancePhotoFiles(maintenancePhotoFiles) : [];

      const payload: MaintenancePhoto = {
        id: uid(),
        maint_date: maintenancePhotoForm.maint_date,
        equipment_name: equipmentName,
        memo,
        image_urls: imageUrls,
        created_by: userEmail || "직원",
        is_processed: false,
        is_urgent: maintenancePhotoForm.is_urgent,
      };

      const { error } = await supabase.from("maintenance_photos").insert(payload);
      if (error) return alert(`정비사진 저장 실패: ${error.message}`);

      setMaintenancePhotoForm({ maint_date: getTodayKey(), equipment_name: "", memo: "", is_urgent: false });
      setMaintenancePhotoFiles([]);
      await loadMaintenancePhotos();
      alert("정비사진이 등록되었습니다.");
    } finally {
      setMaintenancePhotoSaving(false);
    }
  };

  const toggleMaintenancePhotoProcessed = async (item: MaintenancePhoto) => {
    if (!canEditDeleteRecords) return alert("처리상태 변경은 관리자만 가능합니다.");

    const { error } = await supabase
      .from("maintenance_photos")
      .update({ is_processed: !item.is_processed })
      .eq("id", item.id);

    if (error) return alert(`처리상태 변경 실패: ${error.message}`);

    await loadMaintenancePhotos();
  };

  const deleteMaintenancePhoto = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    if (!confirm("정비사진 등록건을 삭제할까요?")) return;

    const { error } = await supabase.from("maintenance_photos").delete().eq("id", id);
    if (error) return alert(`정비사진 삭제 실패: ${error.message}`);

    await loadMaintenancePhotos();
  };

  const resetMaintenanceScheduleForm = () => {
    setMaintenanceScheduleForm({
      schedule_date: getTodayKey(),
      equipment_name: "",
      work_detail: "",
      worker_name: "",
      priority: "보통",
      status: "예정",
      memo: "",
    });
    setEditingMaintenanceScheduleId("");
  };

  const saveMaintenanceSchedule = async () => {
    if (editingMaintenanceScheduleId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!maintenanceScheduleForm.schedule_date) return alert("예정일을 입력하세요.");
    if (!maintenanceScheduleForm.equipment_name.trim()) return alert("장비명을 입력하세요.");
    if (!maintenanceScheduleForm.work_detail.trim()) return alert("작업내용을 입력하세요.");

    const payload: MaintenanceSchedule = {
      id: editingMaintenanceScheduleId || uid(),
      schedule_date: maintenanceScheduleForm.schedule_date,
      equipment_name: maintenanceScheduleForm.equipment_name.trim(),
      work_detail: maintenanceScheduleForm.work_detail.trim(),
      worker_name: maintenanceScheduleForm.worker_name.trim(),
      priority: maintenanceScheduleForm.priority || "보통",
      status: maintenanceScheduleForm.status || "예정",
      memo: maintenanceScheduleForm.memo.trim(),
    };

    const { error } = await supabase.from("maintenance_schedules").upsert(payload);
    if (error) return alert(`정비일정 저장 실패: ${error.message}`);

    await loadMaintenanceSchedules();
    resetMaintenanceScheduleForm();
    setMenuTab("maintenance_schedules");
  };

  const editMaintenanceSchedule = (item: MaintenanceSchedule) => {
    setEditingMaintenanceScheduleId(item.id);
    setMaintenanceScheduleForm({
      schedule_date: item.schedule_date || getTodayKey(),
      equipment_name: item.equipment_name || "",
      work_detail: item.work_detail || "",
      worker_name: item.worker_name || "",
      priority: item.priority || "보통",
      status: item.status || "예정",
      memo: item.memo || "",
    });
    setMenuTab("maintenance_schedule_new");
  };

  const deleteMaintenanceSchedule = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    if (!confirm("정비일정을 삭제할까요?")) return;
    const { error } = await supabase.from("maintenance_schedules").delete().eq("id", id);
    if (error) return alert(`정비일정 삭제 실패: ${error.message}`);
    setMaintenanceSchedules((prev) => prev.filter((item) => item.id !== id));
  };

  const updateMaintenanceScheduleStatus = async (item: MaintenanceSchedule, status: string) => {
    if (!canEditDeleteRecords) return alert("상태 변경은 관리자만 가능합니다.");
    const { error } = await supabase
      .from("maintenance_schedules")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) return alert(`정비일정 상태 변경 실패: ${error.message}`);
    setMaintenanceSchedules((prev) => prev.map((x) => (x.id === item.id ? { ...x, status } : x)));
  };

  const markReceiptPhotoProcessed = async (id: string) => {
    const { error } = await supabase
      .from("receipt_photos")
      .update({ is_processed: true })
      .eq("id", id);

    if (error) {
      alert(`입고사진 처리완료 저장 실패: ${error.message}`);
      return false;
    }

    setReceiptPhotos((prev) => prev.map((item) => item.id === id ? { ...item, is_processed: true } : item));
    return true;
  };

  const markMaintenancePhotoProcessed = async (id: string) => {
    const { error } = await supabase
      .from("maintenance_photos")
      .update({ is_processed: true })
      .eq("id", id);

    if (error) {
      alert(`정비사진 처리완료 저장 실패: ${error.message}`);
      return false;
    }

    setMaintenancePhotos((prev) => prev.map((item) => item.id === id ? { ...item, is_processed: true } : item));
    return true;
  };

  const applyReceiptPhotoToPurchase = async (item: ReceiptPhoto) => {
    if (!isAdmin) return alert("관리자만 구매입력에 반영할 수 있습니다.");

    setPurchaseHeader({
      date: item.receipt_date || getTodayKey(),
      vendor: item.vendor_name || "",
      warehouse: "",
      image_urls: item.image_urls || [],
    });
    setRows([emptyRow()]);
    setEditingPurchaseId("");
    setLinkingReceiptPhotoId(item.id);

    await markReceiptPhotoProcessed(item.id);

    setMenuTab("new");
    alert("입고사진을 구매입력에 반영했습니다. 창고/품목/금액을 입력해서 저장하세요.");
  };

  const applyMaintenancePhotoToMaint = async (item: MaintenancePhoto) => {
    if (!isAdmin) return alert("관리자만 정비등록에 반영할 수 있습니다.");

    setMaintForm({
      date: item.maint_date || getTodayKey(),
      warehouse: item.equipment_name || "",
      manager: userEmail || "",
      title: item.is_urgent ? "긴급 정비" : "정비",
      detail: item.memo || "",
      cost: "",
      image_urls: item.image_urls || [],
    });
    setMaintItems([emptyMaintItem()]);
    setEditingMaintId("");
    setLinkingMaintenancePhotoId(item.id);

    await markMaintenancePhotoProcessed(item.id);

    setMenuTab("maint_new");
    alert("정비사진을 정비등록에 반영했습니다. 품목/금액을 입력해서 저장하세요.");
  };

  const mergeUrls = (base?: string[], extra?: string[]) => {
    return Array.from(new Set([...(base || []), ...(extra || [])].filter(Boolean)));
  };

  const normalizeSearchText = (value: any) =>
    String(value || "")
      .toLowerCase()
      .replace(/[\s()\[\]{}·,._\-\/]/g, "");

  const matchLooseKeywords = (target: string, query: string) => {
    const keywords = String(query || "").split(/\s+/).filter(Boolean);
    if (!keywords.length) return true;

    const normalizedTarget = normalizeSearchText(target);
    return keywords.every((keyword) => {
      const normalizedKeyword = normalizeSearchText(keyword);
      return !normalizedKeyword || normalizedTarget.includes(normalizedKeyword);
    });
  };

  const openPurchasePhotoPicker = (purchase: Purchase) => {
    setPhotoLinkModal({ mode: "purchase", targetId: purchase.id, search: `${purchase.date || ""} ${purchase.vendor || ""}`.trim() });
  };

  const openMaintPhotoPicker = (maint: Maint) => {
    setPhotoLinkModal({ mode: "maint", targetId: maint.id, search: `${maint.date || ""} ${maint.warehouse || ""} ${maint.title || ""}`.trim() });
  };

  const openPurchaseRecordPickerFromReceiptPhoto = (photo: ReceiptPhoto) => {
    setPhotoLinkModal({ mode: "recordPurchase", targetId: photo.id, search: `${photo.vendor_name || ""}`.trim() });
  };

  const openMaintRecordPickerFromMaintenancePhoto = (photo: MaintenancePhoto) => {
    setPhotoLinkModal({ mode: "recordMaint", targetId: photo.id, search: `${photo.equipment_name || ""}`.trim() });
  };

  const connectPurchaseRecordToReceiptPhoto = async (purchase: Purchase, receiptPhotoId: string) => {
    const photo = receiptPhotos.find((item) => item.id === receiptPhotoId);
    if (!photo) return alert("입고사진을 찾지 못했습니다.");

    const nextUrls = mergeUrls(purchase.image_urls || (purchase.image_url ? [purchase.image_url] : []), photo.image_urls || []);
    const payload = { ...purchase, image_urls: nextUrls, image_url: nextUrls[0] || "" };

    const { error } = await supabase
      .from("purchases")
      .update({ image_urls: nextUrls, image_url: nextUrls[0] || "" })
      .eq("id", purchase.id);

    if (error) return alert(`기존 구매내역 사진 연결 실패: ${error.message}`);

    setPurchases((prev) => prev.map((p) => (p.id === purchase.id ? payload : p)));
    await markReceiptPhotoProcessed(photo.id);
    setPhotoLinkModal({ mode: "", targetId: "", search: "" });
    alert("기존 구매내역에 사진을 연결했습니다.");
  };

  const connectMaintRecordToMaintenancePhoto = async (maint: Maint, maintenancePhotoId: string) => {
    const photo = maintenancePhotos.find((item) => item.id === maintenancePhotoId);
    if (!photo) return alert("정비사진을 찾지 못했습니다.");

    const nextUrls = mergeUrls(maint.image_urls || (maint.image_url ? [maint.image_url] : []), photo.image_urls || []);
    const payload = { ...maint, image_urls: nextUrls, image_url: nextUrls[0] || "" };

    const { error } = await supabase
      .from("maints")
      .update({ image_urls: nextUrls, image_url: nextUrls[0] || "" })
      .eq("id", maint.id);

    if (error) return alert(`기존 정비내역 사진 연결 실패: ${error.message}`);

    setMaints((prev) => prev.map((m) => (m.id === maint.id ? payload : m)));
    await markMaintenancePhotoProcessed(photo.id);
    setPhotoLinkModal({ mode: "", targetId: "", search: "" });
    alert("기존 정비내역에 사진을 연결했습니다.");
  };

  const connectReceiptPhotoToPurchase = async (photo: ReceiptPhoto, purchaseId: string) => {
    const target = purchases.find((p) => p.id === purchaseId);
    if (!target) return alert("구매내역을 찾지 못했습니다.");

    const nextUrls = mergeUrls(target.image_urls || (target.image_url ? [target.image_url] : []), photo.image_urls || []);
    const payload = { ...target, image_urls: nextUrls, image_url: nextUrls[0] || "" };

    const { error } = await supabase
      .from("purchases")
      .update({ image_urls: nextUrls, image_url: nextUrls[0] || "" })
      .eq("id", target.id);

    if (error) return alert(`구매내역 사진 연결 실패: ${error.message}`);

    setPurchases((prev) => prev.map((p) => (p.id === target.id ? payload : p)));
    await markReceiptPhotoProcessed(photo.id);
    setPhotoLinkModal({ mode: "", targetId: "", search: "" });
    alert("구매내역에 사진을 연결했습니다.");
  };

  const connectMaintenancePhotoToMaint = async (photo: MaintenancePhoto, maintId: string) => {
    const target = maints.find((m) => m.id === maintId);
    if (!target) return alert("정비내역을 찾지 못했습니다.");

    const nextUrls = mergeUrls(target.image_urls || (target.image_url ? [target.image_url] : []), photo.image_urls || []);
    const payload = { ...target, image_urls: nextUrls, image_url: nextUrls[0] || "" };

    const { error } = await supabase
      .from("maints")
      .update({ image_urls: nextUrls, image_url: nextUrls[0] || "" })
      .eq("id", target.id);

    if (error) return alert(`정비내역 사진 연결 실패: ${error.message}`);

    setMaints((prev) => prev.map((m) => (m.id === target.id ? payload : m)));
    await markMaintenancePhotoProcessed(photo.id);
    setPhotoLinkModal({ mode: "", targetId: "", search: "" });
    alert("정비내역에 사진을 연결했습니다.");
  };


  const loadReceiptPhotos = async () => {
    const { data, error } = await supabase
      .from("receipt_photos")
      .select("*")
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setReceiptPhotos(((data || []) as any[]).map((item) => ({
      ...item,
      id: String(item.id),
      receipt_date: item.receipt_date ? String(item.receipt_date).slice(0, 10) : "",
      image_urls: item.image_urls || [],
    })) as ReceiptPhoto[]);
  };

  const uploadReceiptPhotoFiles = async (files: File[]) => {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = file.type === "application/pdf" ? "pdf" : "jpg";
      const fileName = `purchase-photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("purchase-photos").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`입고사진 업로드 실패: ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("purchase-photos").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const saveReceiptPhoto = async () => {
    if (receiptPhotoSaving) return;
    if (!receiptPhotoForm.receipt_date) return alert("일자를 입력하세요.");
    if (!receiptPhotoForm.vendor_name.trim()) return alert("거래처를 입력하세요.");
    if (!receiptPhotoForm.memo.trim() && !receiptPhotoFiles.length) return alert("내용 또는 사진을 입력하세요.");

    setReceiptPhotoSaving(true);

    try {
      const vendorName = receiptPhotoForm.vendor_name.trim();
      const memo = receiptPhotoForm.memo.trim();

      const { data: duplicate } = await supabase
        .from("receipt_photos")
        .select("id")
        .eq("receipt_date", receiptPhotoForm.receipt_date)
        .eq("vendor_name", vendorName)
        .eq("memo", memo)
        .limit(1);

      if ((duplicate || []).length) {
        alert("같은 일자/거래처/내용의 입고사진이 이미 등록되어 있습니다.");
        return;
      }

      const imageUrls = receiptPhotoFiles.length ? await uploadReceiptPhotoFiles(receiptPhotoFiles) : [];

      const payload: ReceiptPhoto = {
        id: uid(),
        receipt_date: receiptPhotoForm.receipt_date,
        vendor_name: vendorName,
        memo,
        image_urls: imageUrls,
        created_by: userEmail || "직원",
        is_processed: false,
      };

      const { error } = await supabase.from("receipt_photos").insert(payload);
      if (error) return alert(`입고사진 저장 실패: ${error.message}`);

      setReceiptPhotoForm({ receipt_date: getTodayKey(), vendor_name: "", memo: "" });
      setReceiptPhotoFiles([]);
      await loadReceiptPhotos();
      alert("입고사진이 등록되었습니다.");
    } finally {
      setReceiptPhotoSaving(false);
    }
  };

  const toggleReceiptPhotoProcessed = async (item: ReceiptPhoto) => {
    if (!canEditDeleteRecords) return alert("처리상태 변경은 관리자만 가능합니다.");

    const { error } = await supabase
      .from("receipt_photos")
      .update({ is_processed: !item.is_processed })
      .eq("id", item.id);

    if (error) return alert(`처리상태 변경 실패: ${error.message}`);

    await loadReceiptPhotos();
  };

  const deleteReceiptPhoto = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    if (!confirm("입고사진 등록건을 삭제할까요?")) return;

    const { error } = await supabase.from("receipt_photos").delete().eq("id", id);
    if (error) return alert(`입고사진 삭제 실패: ${error.message}`);

    await loadReceiptPhotos();
  };


  const resetCardForm = () => {
    setCardForm({ date: "", user_name: "", place: "", amount: "", memo: "", image_url: "", image_urls: [] });
    setEditingCardUseId("");
  };

  const saveCardUse = async () => {
    if (editingCardUseId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!cardForm.date || !cardForm.place || !Number(cardForm.amount || 0)) {
      return alert("사용일자, 사용처, 금액을 확인하세요.");
    }

    const payload: CardUse = {
      id: editingCardUseId || uid(),
      date: cardForm.date,
      user_name: cardForm.user_name,
      place: cardForm.place,
      amount: Number(cardForm.amount || 0),
      memo: cardForm.memo,
      image_url: (cardForm.image_urls || [])[0] || cardForm.image_url,
      image_urls: cardForm.image_urls || (cardForm.image_url ? [cardForm.image_url] : []),
    };

    const { error } = await supabase.from("card_uses").upsert(payload);
    if (error) return alert(`카드사용 저장 실패: ${error.message}`);

    setCardUses((prev) =>
      editingCardUseId
        ? prev.map((c) => (c.id === editingCardUseId ? payload : c))
        : [payload, ...prev]
    );

    resetCardForm();
    alert(editingCardUseId ? "카드사용 수정 완료" : "카드사용 저장 완료");
    setMenuTab("card_list");
  };

  const editCardUse = (c: CardUse) => {
    setEditingCardUseId(c.id);
    setCardForm({
      date: c.date || "",
      user_name: c.user_name || "",
      place: c.place || "",
      amount: String(c.amount || ""),
      memo: c.memo || "",
      image_url: c.image_url || "",
      image_urls: c.image_urls || (c.image_url ? [c.image_url] : []),
    });
    setMenuTab("card_use");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteCardUse = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const { error } = await supabase.from("card_uses").delete().eq("id", id);
    if (error) return alert(`카드사용 삭제 실패: ${error.message}`);
    setCardUses((prev) => prev.filter((c) => c.id !== id));
  };

  const filteredCardUses = cardUses
    .filter((c) => (!cardSearch.from || (c.date || "") >= cardSearch.from) && (!cardSearch.to || (c.date || "") <= cardSearch.to) && (!cardSearch.user_name || (c.user_name || "").includes(cardSearch.user_name)) && (!cardSearch.place || (c.place || "").includes(cardSearch.place)))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const editPurchase = (p: Purchase) => {
    setMenuTab("new");
    setEditingPurchaseId(p.id);
    setPurchaseHeader({ date: p.date || "", vendor: p.vendor || "", warehouse: p.warehouse || "", image_urls: p.image_urls || (p.image_url ? [p.image_url] : []) });
    setRows((p.rows || []).map((r) => ({ ...r, id: uid() })));
  };

  const filteredPurchases = purchases
    .filter(
      (p) =>
        (!purchaseSearch.from || (p.date || "") >= purchaseSearch.from) &&
        (!purchaseSearch.to || (p.date || "") <= purchaseSearch.to) &&
        (!purchaseSearch.vendor || p.vendor.includes(purchaseSearch.vendor)) &&
        (!purchaseSearch.warehouse || p.warehouse.includes(purchaseSearch.warehouse)) &&
        (!purchaseSearch.item || p.rows.some((r) => r.item.includes(purchaseSearch.item)))
    )
    .sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  const saveVendor = async () => {
    if (editingVendorId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!vendorForm.name) return;
    const existing = editingVendorId ? vendors.find((v) => v.id === editingVendorId) : vendors.find((v) => v.code === vendorForm.code || v.name === vendorForm.name);
    const payload: Vendor = { id: existing?.id || uid(), ...vendorForm };
    const { error } = await supabase.from("vendors").upsert(payload);
    if (error) return alert(`거래처 저장 실패: ${error.message}`);
    const next = existing ? vendors.map((v) => (v.id === existing.id ? payload : v)) : [...vendors, payload];
    setVendors(next);
    setVendorForm({ code: `V${String(next.length + 1).padStart(3, "0")}`, name: "", owner: "", phone: "", mobile: "" });
    setEditingVendorId("");
  };

  const importVendors = async (file: File) => {
    const rows = await readExcelRows(file);
    const imported = rows
      .map((r) => ({
        id: uid(),
        code: String(pick(r, ["거래처코드", "코드", "사업자번호"]) || "").trim() || `V${String(vendors.length + 1).padStart(3, "0")}`,
        name: String(pick(r, ["거래처명", "상호"]) || "").trim(),
        owner: String(pick(r, ["대표자", "대표자명"]) || "").trim(),
        phone: String(pick(r, ["전화", "전화번호", "연락처"]) || "").trim(),
        mobile: String(pick(r, ["모바일", "휴대폰", "휴대전화"]) || "").trim(),
      }))
      .filter((x) => x.name);
    const merged = [...vendors];
    imported.forEach((row) => {
      const idx = merged.findIndex((v) => v.code === row.code || v.name === row.name);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...row, id: merged[idx].id };
      else merged.push(row);
    });
    const { error } = await supabase.from("vendors").upsert(merged);
    if (error) return alert(`거래처 업로드 실패: ${error.message}`);
    setVendors(merged);
    setVendorImportMessage(`${imported.length}건 불러왔습니다.`);
  };

  const saveGroup = async () => {
    if (editingGroupId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!groupForm.name) return;
    const payload: Group = { id: editingGroupId || uid(), ...groupForm };
    const { error } = await supabase.from("warehouse_groups").upsert(payload);
    if (error) return alert(`대분류 저장 실패: ${error.message}`);
    const next = editingGroupId ? groups.map((g) => (g.id === editingGroupId ? payload : g)) : [...groups, payload];
    setGroups(next);
    setGroupForm({ code: nextCode(next), name: "" });
    setEditingGroupId("");
  };

  const saveWarehouse = async () => {
    if (editingWarehouseId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!warehouseForm.group || !warehouseForm.name) return;
    const payload: Warehouse = { id: editingWarehouseId || uid(), ...warehouseForm };
    const { error } = await supabase.from("warehouses").upsert(payload);
    if (error) return alert(`창고 저장 실패: ${error.message}`);
    const next = editingWarehouseId ? warehouses.map((w) => (w.id === editingWarehouseId ? payload : w)) : [...warehouses, payload];
    setWarehouses(next);
    setWarehouseForm({ group: "", code: nextCode(next), name: "" });
    setEditingWarehouseId("");
  };

  const reseq = <T extends { code: string }>(arr: T[]) => arr.map((x, idx) => ({ ...x, code: String(idx + 1).padStart(4, "0") }));
  const deleteGroup = async (id: string, name: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const newGroups = reseq(groups.filter((g) => g.id !== id));
    const newWarehouses = reseq(warehouses.filter((w) => w.group !== name));
    const delGroup = await supabase.from("warehouse_groups").delete().eq("id", id);
    if (delGroup.error) return alert(`대분류 삭제 실패: ${delGroup.error.message}`);
    const delWh = await supabase.from("warehouses").delete().eq("group", name);
    if (delWh.error) return alert(`세부창고 삭제 실패: ${delWh.error.message}`);
    if (newGroups.length) await supabase.from("warehouse_groups").upsert(newGroups);
    if (newWarehouses.length) await supabase.from("warehouses").upsert(newWarehouses);
    setGroups(newGroups);
    setWarehouses(newWarehouses);
    setGroupForm({ code: nextCode(newGroups), name: "" });
    setWarehouseForm({ group: "", code: nextCode(newWarehouses), name: "" });
  };
  const deleteWarehouse = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const newWarehouses = reseq(warehouses.filter((w) => w.id !== id));
    const { error } = await supabase.from("warehouses").delete().eq("id", id);
    if (error) return alert(`창고 삭제 실패: ${error.message}`);
    if (newWarehouses.length) await supabase.from("warehouses").upsert(newWarehouses);
    setWarehouses(newWarehouses);
    setWarehouseForm({ group: "", code: nextCode(newWarehouses), name: "" });
  };

  const saveItem = async () => {
    if (editingItemId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!itemForm.name) return;
    const existing = editingItemId ? items.find((i) => i.id === editingItemId) : items.find((i) => i.code === itemForm.code || i.name === itemForm.name);
    const payload = { id: existing?.id || uid(), ...itemForm, price: Number(itemForm.price || 0) };
    const { error } = await supabase.from("items").upsert(payload);
    if (error) return alert(`품목 저장 실패: ${error.message}`);
    const next = existing ? items.map((i) => (i.id === existing.id ? payload : i)) : [...items, payload];
    setItems(next);
    setItemForm({ code: nextCode(next), name: "", spec: "", unit: "", price: "" });
    setEditingItemId("");
  };

  const importItems = async (file: File) => {
    const rows = await readExcelRows(file);

    const existingRes = await fetchAllRows("items", "code", 1000);
    if (existingRes.error) return alert(`기존 품목 불러오기 실패: ${existingRes.error.message}`);

    const existingItems = ((existingRes.data || []) as any[]).map((x) => ({ ...x, price: Number(x.price || 0) })) as Item[];

    const imported = rows
      .map((r, idx) => {
        const rawCode = String(pick(r, ["품목코드", "코드"]) || "").trim();
        const name = String(pick(r, ["품목명", "품명"]) || "").trim();
        const spec = String(pick(r, ["규격정보", "규격"]) || "").trim();
        const unit = String(pick(r, ["단위"]) || "").trim();
        const price = Number(pick(r, ["단가", "입고단가", "매입단가"]) || 0);

        return {
          id: uid(),
          code: rawCode || String(existingItems.length + idx + 1).padStart(5, "0"),
          name,
          spec,
          unit,
          price,
        };
      })
      .filter((x) => x.name || x.code);

    const merged = [...existingItems];

    imported.forEach((row) => {
      const idx = merged.findIndex((i) => (row.code && i.code === row.code) || (row.name && i.name === row.name));
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...row, id: merged[idx].id };
      } else {
        merged.push(row);
      }
    });

    const error = await upsertInChunks("items", merged, 500);
    if (error) return alert(`품목 업로드 실패: ${error.message}`);

    const reloadRes = await fetchAllRows("items", "code", 1000);
    if (reloadRes.error) return alert(`품목 다시 불러오기 실패: ${reloadRes.error.message}`);

    const nextItems = ((reloadRes.data || []) as any[]).map((x) => ({ ...x, price: Number(x.price || 0) })) as Item[];
    setItems(nextItems);
    setItemImportMessage(`${imported.length}건 업로드 / 현재 ${nextItems.length}건 표시`);
    setItemForm({ code: nextCode(nextItems), name: "", spec: "", unit: "", price: "" });
  };

  const openNewItemModal = (rowIndex: number) => {
    setNewItemForm({ name: "", spec: "", unit: "", price: "" });
    setNewItemModal({ open: true, rowIndex });
  };

  const closeNewItemModal = () => {
    setNewItemModal({ open: false, rowIndex: null });
    setNewItemForm({ name: "", spec: "", unit: "", price: "" });
  };

  const saveNewItemFromModal = async () => {
    const name = newItemForm.name.trim();
    if (!name) return alert("품목명을 입력하세요.");

    const spec = newItemForm.spec.trim();
    const unit = newItemForm.unit.trim();
    const price = Number(String(newItemForm.price || "0").replace(/,/g, "")) || 0;

    const newItem = {
      id: uid(),
      code: nextCode(items),
      name,
      spec,
      unit,
      price,
    };

    const { error } = await supabase.from("items").insert(newItem);
    if (error) return alert(`신규 품목 저장 실패: ${error.message}`);
    setItems((prev) => [...prev, newItem]);

    if (newItemModal.rowIndex !== null) {
      updateRow(newItemModal.rowIndex, "item", name);
      updateRow(newItemModal.rowIndex, "spec", spec);
      updateRow(newItemModal.rowIndex, "price", price);
    }

    closeNewItemModal();
  };


  const updateMaintItem = (index: number, key: keyof MaintItem, value: any) => {
    const next = [...maintItems];
    next[index] = { ...next[index], [key]: value };

    if (key === "item") {
      const found = items.find((it) => it.name === value);
      if (found) {
        next[index].spec = found.spec || "";
        next[index].price = found.price || 0;
      }
    }

    if (["item", "qty", "price"].includes(key)) {
      const qty = Number(next[index].qty || 0);
      const price = Number(next[index].price || 0);
      next[index].supply = qty * price;
      next[index].vat = Math.round(next[index].supply * 0.1);
      next[index].total = next[index].supply + next[index].vat;
    }

    if (key === "supply") {
      next[index].supply = Number(value || 0);
      next[index].vat = Math.round(next[index].supply * 0.1);
      next[index].total = next[index].supply + next[index].vat;
    }

    if (key === "vat") {
      next[index].vat = Number(value || 0);
      next[index].total = Number(next[index].supply || 0) + next[index].vat;
    }

    setMaintItems(next);
    const total = next.reduce((sum, row) => sum + Number(row.total || 0), 0);
    setMaintForm((prev) => ({ ...prev, cost: String(total) }));
  };


  const bulkTransferRows = applyBulkTransferEdits(getBulkTransferRows());

  const filteredPermits = permits
    .filter((permit: PermitRenewal) =>
      !permitSearch.company || String(permit.company || "").includes(permitSearch.company)
    )
    .filter((permit: PermitRenewal) => {
      const keyword = permitSearch.keyword.trim();
      if (!keyword) return true;

      const target = [
        permit.company,
        permit.title,
        permit.agency,
        permit.contact,
        permit.check_note,
        permit.memo,
        permit.cycle,
        permit.status,
      ].join(" ");

      return target.includes(keyword);
    })
    .filter((permit: PermitRenewal) =>
      !permitSearch.status || String(permit.status || "") === permitSearch.status
    )
    .sort((a: PermitRenewal, b: PermitRenewal) => {
      const aDday = getDday(a.expiry_date);
      const bDday = getDday(b.expiry_date);

      const aValue = aDday === null ? 999999 : aDday;
      const bValue = bDday === null ? 999999 : bDday;

      return aValue - bValue;
    });

  const maintSupplyTotal = maintItems.reduce((sum, r) => sum + Number(r.supply || 0), 0);
  const maintVatTotal = maintItems.reduce((sum, r) => sum + Number(r.vat || 0), 0);
  const maintGrandTotal = maintItems.reduce((sum, r) => sum + Number(r.total || 0), 0);

  const resetMaintForm = () => {
    setMaintForm({ date: "", warehouse: "", manager: "", title: "", detail: "", cost: "", image_urls: [] });
    setMaintItems([emptyMaintItem()]);
    setEditingMaintId("");
  };
  const saveMaint = async () => {
    if (!maintForm.warehouse || !maintForm.title) return;
    const validItems = maintItems.filter((r) => r.item && Number(r.qty || 0) > 0);
    const payload = { id: editingMaintId || uid(), ...maintForm, image_url: (maintForm.image_urls || [])[0] || "", image_urls: maintForm.image_urls || [], items: validItems, supplyTotal: maintSupplyTotal, vatTotal: maintVatTotal, total: maintGrandTotal, cost: Number(maintGrandTotal || maintForm.cost || 0) };
    const { error } = await supabase.from("maints").upsert(payload);
    if (error) return alert(`정비 저장 실패: ${error.message}`);
    setMaints((prev) => (editingMaintId ? prev.map((m) => (m.id === editingMaintId ? payload : m)) : [payload, ...prev]));
    if (linkingMaintenancePhotoId) {
      await markMaintenancePhotoProcessed(linkingMaintenancePhotoId);
      setLinkingMaintenancePhotoId("");
    }
    resetMaintForm();
    setMenuTab("maint_list");
  };
  const editMaint = (m: Maint) => {
    setMenuTab("maint_new");
    setEditingMaintId(m.id);
    setMaintForm({ date: m.date || "", warehouse: m.warehouse || "", manager: m.manager || "", title: m.title || "", detail: m.detail || "", cost: String(m.cost || ""), image_urls: m.image_urls || (m.image_url ? [m.image_url] : []) });
    setMaintItems((m.items && m.items.length ? m.items : [emptyMaintItem()]).map((r: any) => ({ ...emptyMaintItem(), ...r, id: uid() })));
  };


  const editVendor = (v: Vendor) => {
    setEditingVendorId(v.id);
    setVendorForm({ code: v.code || "", name: v.name || "", owner: v.owner || "", phone: v.phone || "", mobile: v.mobile || "" });
  };

  const editGroup = (g: Group) => {
    setEditingGroupId(g.id);
    setGroupForm({ code: g.code || "", name: g.name || "" });
  };

  const editWarehouse = (w: Warehouse) => {
    setEditingWarehouseId(w.id);
    setWarehouseForm({ code: w.code || "", group: w.group || "", name: w.name || "" });
  };

  const editItem = (it: Item) => {
    setEditingItemId(it.id);
    setItemForm({ code: it.code || "", name: it.name || "", spec: it.spec || "", unit: it.unit || "", price: String(it.price || "") });
  };

  const deletePurchase = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) return alert(`구매 삭제 실패: ${error.message}`);
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  };

  const deleteVendor = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) return alert(`거래처 삭제 실패: ${error.message}`);
    setVendors((prev) => prev.filter((v) => v.id !== id));
  };

  const clearVendors = async () => {
    if (!isAdmin) return alert("관리자만 전체삭제할 수 있습니다.");
    const { error } = await supabase.from("vendors").delete().neq("id", "");
    if (error) return alert(`거래처 전체삭제 실패: ${error.message}`);
    setVendors([]);
    setVendorImportMessage("거래처 전체 삭제 완료");
    setVendorForm({ code: "V001", name: "", owner: "", phone: "", mobile: "" });
  };

  const deleteItem = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) return alert(`품목 삭제 실패: ${error.message}`);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearItems = async () => {
    if (!isAdmin) return alert("관리자만 전체삭제할 수 있습니다.");
    if (!confirm("품목을 전체 삭제하시겠습니까?\n삭제 후에는 되돌릴 수 없습니다.")) return;

    const { error } = await supabase.from("items").delete().neq("id", "");
    if (error) return alert(`품목 전체삭제 실패: ${error.message}`);

    setItems([]);
    setItemSearch("");
    setItemImportMessage("품목 전체 삭제 완료");
    setItemForm({ code: "0001", name: "", spec: "", unit: "", price: "" });
    setEditingItemId("");
  };

  const deleteMaint = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const { error } = await supabase.from("maints").delete().eq("id", id);
    if (error) return alert(`정비 삭제 실패: ${error.message}`);
    setMaints((prev) => prev.filter((m) => m.id !== id));
  };

  const filteredMaints = maints
    .filter((m) => (!maintSearch.from || (m.date || "") >= maintSearch.from) && (!maintSearch.to || (m.date || "") <= maintSearch.to) && (!maintSearch.warehouse || m.warehouse.includes(maintSearch.warehouse)) && (!maintSearch.keyword || `${m.title} ${m.detail} ${m.manager}`.includes(maintSearch.keyword)))
    .sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  const login = async () => {
    setLoginError("");

    const email = loginForm.email.trim();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: loginForm.password,
    });

    if (error) {
      setLoginError("로그인 실패: 이메일 또는 비밀번호를 확인하세요.");
      return;
    }

    const nextPrefs = {
      ...authPrefs,
      email: authPrefs.saveEmail || authPrefs.autoLogin ? email : "",
    };

    setAuthPrefs(nextPrefs);
    writeAuthPrefs(nextPrefs);
    setAuthLoading(false);
  };

  const logout = async () => {
    setAuthLoading(false);
    setSession(null);
    setMenuTab("home");
    setMobileSheet("");
    setShowMobileQuickStart(false);
    setShowUpdateNotice(false);
    setLoginError("");

    const nextPrefs = {
      ...authPrefs,
      autoLogin: false,
      email: authPrefs.saveEmail ? authPrefs.email : "",
    };

    setAuthPrefs(nextPrefs);
    writeAuthPrefs(nextPrefs);

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error(error);
    }
  };

  const closeUpdateNotice = () => {
    if (hideUpdateToday) {
      localStorage.setItem(UPDATE_NOTICE_HIDE_KEY, updateNoticeHideValue());
    }
    setShowUpdateNotice(false);
  };


  const loadUpdateNotices = async () => {
    setUpdateNoticeError("");

    const { data, error } = await supabase
      .from("update_notices")
      .select("*")
      .eq("is_active", true)
      .order("notice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setUpdateNoticeError(error.message);
      setUpdateNotices([]);
      setShowUpdateNotice(false);
      return;
    }

    const notices = ((data || []) as any[]).map((n) => ({
      ...n,
      id: String(n.id),
      notice_date: String(n.notice_date || "").slice(0, 10),
    })) as UpdateNotice[];

    const dedupedNotices = dedupeUpdateNotices(notices);
    setUpdateNotices(dedupedNotices);

    setShowUpdateNotice(false);
  };

  const loadSiteNotices = async () => {
    setSiteNoticeError("");

    const { data, error } = await supabase
      .from("site_notices")
      .select("*")
      .eq("is_active", true)
      .order("notice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setSiteNoticeError(error.message);
      setSiteNotices([]);
      return;
    }

    setSiteNotices(((data || []) as any[]).map((item) => ({
      ...item,
      id: String(item.id),
      notice_date: String(item.notice_date || "").slice(0, 10),
      priority: item.priority || "보통",
      target_roles: Array.isArray(item.target_roles) ? item.target_roles : ["all"],
      target_emails: Array.isArray(item.target_emails) ? item.target_emails : [],
    })) as SiteNotice[]);
  };

  const saveSiteNotice = async () => {
    if (!isAdmin) return alert("관리자만 현장 공지를 저장할 수 있습니다.");
    if (!siteNoticeForm.title.trim() || !siteNoticeForm.content.trim()) {
      return alert("제목과 내용을 입력하세요.");
    }

    const payload = {
      id: editingSiteNoticeId || uid(),
      notice_date: getTodayKey(),
      title: siteNoticeForm.title.trim(),
      content: siteNoticeForm.content.trim(),
      priority: siteNoticeForm.priority || "보통",
      is_active: siteNoticeForm.is_active,
      target_roles: siteNoticeForm.target_roles?.length ? siteNoticeForm.target_roles : ["all"],
      target_emails: siteNoticeForm.target_emails || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("site_notices").upsert(payload);
    if (error) return alert(`공지 저장 실패: ${error.message}`);

    setSiteNoticeForm({ title: "", content: "", priority: "보통", is_active: true, target_roles: ["all"], target_emails: [] });
    setEditingSiteNoticeId("");
    await loadSiteNotices();
  };

  const editSiteNotice = (notice: SiteNotice) => {
    setEditingSiteNoticeId(notice.id);
    setSiteNoticeForm({
      title: notice.title || "",
      content: notice.content || "",
      priority: notice.priority || "보통",
      is_active: notice.is_active !== false,
      target_roles: notice.target_roles?.length ? notice.target_roles : ["all"],
      target_emails: notice.target_emails || [],
    });
  };

  const deleteSiteNotice = async (id: string) => {
    if (!isAdmin) return alert("관리자만 현장 공지를 삭제할 수 있습니다.");
    if (!confirm("공지를 삭제할까요?")) return;

    const { error } = await supabase.from("site_notices").delete().eq("id", id);
    if (error) return alert(`공지 삭제 실패: ${error.message}`);

    await loadSiteNotices();
  };

  const loadUserPermissions = async () => {
    const { data, error } = await supabase
      .from("user_permissions")
      .select("*")
      .order("email", { ascending: true });

    if (error) {
      console.error(error);
      setUserPermissions([]);
      return;
    }

    setUserPermissions(((data || []) as any[]).map((item) => ({
      ...item,
      id: String(item.id),
      role: (item.role || "field") as UserRole,
      permissions: item.permissions || {},
    })) as UserPermission[]);
  };

  const saveUserPermission = async (next?: UserPermission) => {
    if (!isAdmin) return alert("관리자만 권한을 저장할 수 있습니다.");
    const target = next || permissionForm;
    const email = target.email.trim().toLowerCase();
    if (!email) return alert("직원 이메일을 입력하세요.");

    const payload = {
      id: target.id || uid(),
      email,
      role: target.role || "field",
      permissions: target.role === "field" ? (target.permissions || {}) : {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("user_permissions").upsert(payload, { onConflict: "email" });
    if (error) return alert(`권한 저장 실패: ${error.message}`);

    await loadUserPermissions();
    setPermissionForm({ id: uid(), email: "", role: "field", permissions: {} });
  };

  const deleteUserPermission = async (email: string) => {
    if (!isAdmin) return alert("관리자만 권한을 삭제할 수 있습니다.");
    if (!confirm(`${email} 권한을 삭제할까요?`)) return;

    const { error } = await supabase.from("user_permissions").delete().eq("email", email);
    if (error) return alert(`권한 삭제 실패: ${error.message}`);

    await loadUserPermissions();
  };

  const saveUpdateNotice = async () => {
    if (!isAdmin) return alert("관리자만 업데이트 공지를 저장할 수 있습니다.");
    if (!updateNoticeForm.notice_date || !updateNoticeForm.content.trim()) {
      return alert("날짜와 업데이트 내용을 입력하세요.");
    }

    const payload = {
      id: editingUpdateNoticeId || uid(),
      notice_date: updateNoticeForm.notice_date,
      content: updateNoticeForm.content.trim(),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("update_notices").upsert(payload);
    if (error) return alert(`업데이트 공지 저장 실패: ${error.message}`);

    setUpdateNoticeForm({ notice_date: getTodayKey(), content: "" });
    setEditingUpdateNoticeId("");
    await loadUpdateNotices();
    alert(editingUpdateNoticeId ? "업데이트 공지 수정 완료" : "업데이트 공지 등록 완료");
  };

  const editUpdateNotice = (notice: UpdateNotice) => {
    setEditingUpdateNoticeId(notice.id);
    setUpdateNoticeForm({
      notice_date: notice.notice_date || getTodayKey(),
      content: notice.content || "",
    });
    setMenuTab("update_notices");
  };

  const deleteUpdateNotice = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    if (!confirm("업데이트 공지를 삭제할까요?")) return;

    setUpdateNotices((prev) => prev.filter((notice) => notice.id !== id));

    const { error } = await supabase.from("update_notices").delete().eq("id", id);

    if (error) {
      const { error: softError } = await supabase
        .from("update_notices")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (softError) {
        await loadUpdateNotices();
        return alert(`업데이트 공지 삭제 실패: ${softError.message}`);
      }
    }

    await loadUpdateNotices();
  };

  const cleanupDuplicateUpdateNotices = async () => {
    if (!isAdmin) return alert("관리자만 중복 공지를 정리할 수 있습니다.");

    const { data, error } = await supabase
      .from("update_notices")
      .select("*")
      .eq("is_active", true)
      .order("notice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return alert(`중복 공지 조회 실패: ${error.message}`);

    const seen = new Set<string>();
    const duplicateIds: string[] = [];

    ((data || []) as any[]).forEach((notice) => {
      const key = `${String(notice.notice_date || "").slice(0, 10)}|${String(notice.content || "").trim()}`;
      if (seen.has(key)) duplicateIds.push(String(notice.id));
      else seen.add(key);
    });

    if (!duplicateIds.length) {
      alert("중복 공지가 없습니다.");
      return;
    }

    const { error: deleteError } = await supabase
      .from("update_notices")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) return alert(`중복 공지 삭제 실패: ${deleteError.message}`);

    await loadUpdateNotices();
    alert(`중복 공지 ${duplicateIds.length}건을 정리했습니다.`);
  };

  useEffect(() => {
    if (!session) return;
    loadUpdateNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, menuTab]);

  if (authLoading) {
    return (
      <>
        <style>{loginCss}</style>
        <div className="login-page">
          <div className="login-card">로그인 확인 중...</div>
        </div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <style>{loginCss}</style>
        <div className="login-page">
          <div className="login-card">
          <div className="login-badge">TAEMYUNG ERP</div>
          <h1>태명산업개발</h1>
          <p>통합 관리 시스템 로그인</p>

          <label>이메일</label>
          <input
            value={loginForm.email}
            onChange={(e) => {
              const email = e.target.value;
              setLoginForm({ ...loginForm, email });

              if (authPrefs.saveEmail || authPrefs.autoLogin) {
                const nextPrefs = { ...authPrefs, email };
                setAuthPrefs(nextPrefs);
                writeAuthPrefs(nextPrefs);
              }
            }}
            placeholder="이메일 입력"
          />

          <label>비밀번호</label>
          <input
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            placeholder="비밀번호 입력"
            onKeyDown={(e) => {
              if (e.key === "Enter") login();
            }}
          />

          <div className="login-options">
            <label>
              <input
                type="checkbox"
                checked={authPrefs.saveEmail}
                onChange={(e) => {
                  const nextPrefs = {
                    ...authPrefs,
                    saveEmail: e.target.checked,
                    email: e.target.checked || authPrefs.autoLogin ? loginForm.email.trim() : "",
                  };
                  setAuthPrefs(nextPrefs);
                  writeAuthPrefs(nextPrefs);
                }}
              />
              아이디 저장
            </label>

            <label>
              <input
                type="checkbox"
                checked={authPrefs.autoLogin}
                onChange={(e) => {
                  const nextPrefs = {
                    ...authPrefs,
                    autoLogin: e.target.checked,
                    saveEmail: e.target.checked ? true : authPrefs.saveEmail,
                    email: e.target.checked || authPrefs.saveEmail ? loginForm.email.trim() : "",
                  };
                  setAuthPrefs(nextPrefs);
                  writeAuthPrefs(nextPrefs);
                }}
              />
              자동 로그인
            </label>
          </div>

          {loginError && <div className="login-error">{loginError}</div>}

          <button className="primary login-button" onClick={login}>로그인</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      <style>{css}</style>
      <div className="app">
        <header className="hero">
          <h1 className="main-title">태명산업개발</h1>
          <p>통합 관리 시스템</p>
        </header>

        {loading && <div className="loading">Supabase 데이터 불러오는 중...</div>}



        {showMobileQuickStart && (
          <div className="mobile-quick-start">
            <div className="mobile-quick-card">
              <div className="mobile-quick-logo">
                <strong>태명산업개발</strong>
                <span>통합 관리 시스템</span>
              </div>

              <div className="mobile-quick-title">
                <h2>업무 선택</h2>
                <p>사용할 메뉴를 선택하세요.</p>
              </div>

              <button className="mobile-quick-btn photo" onClick={() => openMobileQuickMenu("receipt_photos")}>
                <span>📷</span>
                <div>
                  <b>입고사진등록</b>
                  <small>자재 입고 사진과 내용 등록</small>
                </div>
              </button>

              <button className="mobile-quick-btn maint" onClick={() => openMobileQuickMenu("maintenance_photos")}>
                <span>🛠️</span>
                <div>
                  <b>정비사진등록</b>
                  <small>정비 사진과 내용 등록</small>
                </div>
              </button>

              <button className="mobile-quick-btn home" onClick={() => openMobileQuickMenu("home")}>
                <span>🏠</span>
                <div>
                  <b>홈으로 가기</b>
                  <small>전체 ERP 메뉴 보기</small>
                </div>
              </button>

              <button className="mobile-quick-logout" onClick={logout}>
                로그아웃
              </button>
            </div>
          </div>
        )}

        {showUpdateNotice && (
          <div className="update-popup-backdrop">
            <div className="update-popup">
              <div className="update-popup-head">
                <div>
                  <span>UPDATE</span>
                  <h2>업데이트 안내</h2>
                </div>
                <button onClick={closeUpdateNotice}>×</button>
              </div>

              <ul>
                {recentUpdateItems.map((item) => (
                  <li key={item.id}>
                    <strong>{item.notice_date}</strong>
                    <span>{item.content}</span>
                  </li>
                ))}
              </ul>

              <div className="update-popup-bottom">
                <label>
                  <input
                    type="checkbox"
                    checked={hideUpdateToday}
                    onChange={(e) => setHideUpdateToday(e.target.checked)}
                  />
                  오늘 열지 않음
                </label>
                <button className="primary" onClick={closeUpdateNotice}>확인</button>
              </div>
            </div>
          </div>
        )}


        {bulkTransferSelectOpen && (
          <div className="bulk-select-overlay">
            <div className="bulk-select-modal">
              <div className="bulk-select-head">
                <div>
                  <h2>대량이체 항목 선택</h2>
                  <p>체크한 거래처만 엑셀로 다운로드됩니다.</p>
                </div>
                <button onClick={() => setBulkTransferSelectOpen(false)}>닫기</button>
              </div>
              <div className="bulk-select-actions">
                <button onClick={() => setSelectedBulkTransferIds(bulkTransferRows.map((row) => row.id))}>전체선택</button>
                <button onClick={() => setSelectedBulkTransferIds([])}>전체해제</button>
                <strong>선택 {selectedBulkTransferIds.length}건 / {money(bulkTransferRows.filter((row) => selectedBulkTransferIds.includes(row.id)).reduce((sum, row) => sum + row.amount, 0))}원</strong>
              </div>
              <div className="bulk-select-list">
                {bulkTransferRows.map((row) => (
                  <label className={row.matched ? "bulk-select-row" : "bulk-select-row missing"} key={row.id}>
                    <input type="checkbox" checked={selectedBulkTransferIds.includes(row.id)} onChange={() => toggleBulkTransferSelection(row.id)} />
                    <span>{row.vendor}</span>
                    <em>{row.matched ? "계좌매칭" : "계좌확인필요"}</em>
                    <b>{money(row.amount)}원</b>
                  </label>
                ))}
              </div>
              <div className="bulk-select-bottom">
                <button onClick={() => setBulkTransferSelectOpen(false)}>취소</button>
                <button className="primary" onClick={downloadSelectedBulkTransferExcel}>선택 항목 다운로드</button>
              </div>
            </div>
          </div>
        )}

        <nav className="menu permission-aware-menu">
          {canAccessTab("home") && <button className={menuTab === "home" ? "active" : ""} onClick={() => setMenuTab("home")}>홈</button>}
          {canAccessTab("site_notices") && <button className={menuTab === "site_notices" ? "active" : ""} onClick={() => setMenuTab("site_notices")}>공지</button>}
          {canAccessTab("layout") && <button className={menuTab === "layout" ? "active" : ""} onClick={() => setMenuTab("layout")}>생산라인</button>}

          {canShowAny(["new", "list", "status", "bulk_transfer", "receipt_photos", "vendor_accounts"]) && (
            <div className="menu-group">
              <button>구매</button>
              <div className="sub">
                {menuButton("new", "구매입력")}
                {menuButton("list", "구매조회")}
                {menuButton("status", "구매현황")}
                {menuButton("bulk_transfer", "대량이체")}
                {menuButton("receipt_photos", "입고사진등록")}
                {menuButton("vendor_accounts", "업체계좌관리")}
              </div>
            </div>
          )}

          {canShowAny(["card_use", "card_list", "card_stats"]) && (
            <div className="menu-group">
              <button>카드</button>
              <div className="sub">
                {menuButton("card_use", "카드사용")}
                {menuButton("card_list", "카드조회")}
                {menuButton("card_stats", "카드통계")}
              </div>
            </div>
          )}

          {canShowAny(["maint_new", "maint_list", "maint_stats", "maintenance_photos", "maintenance_schedule_new", "maintenance_schedules"]) && (
            <div className="menu-group maint-menu-group">
              <button type="button">정비</button>
              <div className="sub maint-sub">
                {menuButton("maint_new", "정비등록")}
                {menuButton("maint_list", "정비조회")}
                {menuButton("maint_stats", "정비통계")}
                {menuButton("maintenance_photos", "정비사진등록")}
                {menuButton("maintenance_schedule_new", "정비일정등록")}
                {menuButton("maintenance_schedules", "정비일정조회")}
              </div>
            </div>
          )}

          {canShowAny(["vendors", "warehouse_groups", "items"]) && (
            <div className="menu-group">
              <button>기초등록</button>
              <div className="sub">
                {menuButton("vendors", "거래처등록")}
                {menuButton("warehouse_groups", "창고등록")}
                {menuButton("items", "품목등록")}
              </div>
            </div>
          )}

          {canAccessTab("permits") && <button className={menuTab === "permits" ? "active" : ""} onClick={() => setMenuTab("permits")}>허가관리</button>}
          {isAdmin && <button className={menuTab === "backup_permissions" ? "active" : ""} onClick={() => setMenuTab("backup_permissions")}>백업/권한관리</button>}
          <div className="user-box"><span>{userEmail}{currentRole === "admin" ? " · 관리자" : currentRole === "office" ? " · 사무실직원" : " · 현장직원"}</span><button onClick={logout}>로그아웃</button></div>
        </nav>
        {menuTab === "update_history" && (
          <section className="notice-pro-wrap notice-only">
            <div className="notice-pro-left">
              <div className="notice-pro-head">
                <div>
                  <h2>📢 공지</h2>
                  <p>시스템 업데이트 및 중요 안내사항을 확인하세요.</p>
                </div>
                <div className="notice-pin">꼭<br />확인!</div>
              </div>

              <div className="notice-pro-tabs">
                <button className="active">전체</button>
                <button>오늘</button>
                <button>어제</button>
                <button>이번주</button>
                <button>이전</button>
              </div>

              {updateNoticeError && (
                <div className="notice-pro-error">
                  공지 불러오기 실패: {updateNoticeError}
                </div>
              )}

              <div className="notice-pro-list">
                {(updateNotices || []).length === 0 ? (
                  <div className="notice-pro-empty">등록된 공지가 없습니다.</div>
                ) : (
                  updateNotices.map((notice) => (
                    <article className="notice-pro-item" key={notice.id}>
                      <div className="notice-pro-date">
                        <strong>{notice.notice_date.slice(0, 4)}</strong>
                        <b>{notice.notice_date.slice(5)}</b>
                        {isRecentNotice(notice) && <em>NEW</em>}
                      </div>

                      <div className="notice-pro-body">
                        <div className="notice-pro-badge-row">
                          <span className={isRecentNotice(notice) ? "hot" : ""}>업데이트</span>
                        </div>
                        <h3>{notice.content}</h3>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="notice-pro-bottom">더 이상 공지가 없습니다.</div>
            </div>
          </section>
        )}

        {menuTab === "update_notices" && isAdmin && (
          <section className="notice-pro-wrap">
            <div className="notice-pro-left">
              <div className="notice-pro-head">
                <div>
                  <h2>{editingUpdateNoticeId ? "공지 수정" : "새 공지 등록"}</h2>
                  <p>저장하면 모든 사용자에게 인터넷으로 공지가 공유됩니다.</p>
                </div>
              </div>

              {updateNoticeError && (
                <div className="notice-pro-error notice-pro-manage-error">
                  공지 불러오기 실패: {updateNoticeError}
                </div>
              )}

              <div className="notice-form-grid">
                <Field label="공지 날짜">
                  <input
                    type="text"
                    placeholder="20260512 또는 260512"
                    value={updateNoticeForm.notice_date}
                    onChange={(e) => setUpdateNoticeForm({ ...updateNoticeForm, notice_date: formatInputDate(e.target.value) })}
                  />
                </Field>

                <Field label="업데이트 내용">
                  <input
                    value={updateNoticeForm.content}
                    onChange={(e) => setUpdateNoticeForm({ ...updateNoticeForm, content: e.target.value })}
                    placeholder="예: 카드사용 영수증 여러 장 업로드 기능 추가"
                  />
                </Field>
              </div>

              <div className="actions right-actions">
                <button className="primary" onClick={saveUpdateNotice}>
                  {editingUpdateNoticeId ? "수정저장" : "공지등록"}
                </button>
                <button
                  onClick={() => {
                    setEditingUpdateNoticeId("");
                    setUpdateNoticeForm({ notice_date: getTodayKey(), content: "" });
                  }}
                >
                  초기화
                </button>
                <button onClick={() => setMenuTab("update_history")}>공지 목록</button>
              </div>
            </div>

            <aside className="notice-pro-right">
              <div className="notice-pro-admin-head">
                <h2>등록된 공지</h2>
                <button onClick={loadUpdateNotices}>새로고침</button>
                <button onClick={cleanupDuplicateUpdateNotices}>중복정리</button>
              </div>

              <div className="notice-pro-table compact">
                <div className="notice-pro-table-head">
                  <span>날짜</span>
                  <span>제목</span>
                  <span>관리</span>
                </div>

                {!updateNotices.length ? (
                  <div className="notice-pro-empty">등록된 공지가 없습니다.</div>
                ) : (
                  updateNotices.map((notice) => (
                    <div className="notice-pro-table-row" key={notice.id}>
                      <span>{notice.notice_date}</span>
                      <span>{notice.content}</span>
                      <span className="notice-pro-actions">
                        <button onClick={() => editUpdateNotice(notice)}>수정</button>
                        <button className="danger" onClick={() => deleteUpdateNotice(notice.id)}>삭제</button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </section>
        )}


        {menuTab === "permits" && (
          <section className="card permit-page">
            <div className="permit-head">
              <div>
                <h2>허가/갱신관리</h2>
                <p>만료일과 갱신 업무를 한눈에 관리합니다.</p>
              </div>
              <div className="permit-summary">
                <span>전체 <b>{filteredPermits.length}</b></span>
                <span>30일 이내 <b>{filteredPermits.filter((p: PermitRenewal) => {
                  const d = getDday(p.expiry_date);
                  return d !== null && d >= 0 && d <= 30;
                }).length}</b></span>
              </div>
              <div className="permit-company-tabs">
                <button
                  className={!permitSearch.company ? "active" : ""}
                  onClick={() => setPermitSearch({ ...permitSearch, company: "" })}
                >
                  전체
                </button>
                <button
                  className={permitSearch.company === "태명" ? "active" : ""}
                  onClick={() => setPermitSearch({ ...permitSearch, company: "태명" })}
                >
                  태명
                </button>
                <button
                  className={permitSearch.company === "유강" ? "active" : ""}
                  onClick={() => setPermitSearch({ ...permitSearch, company: "유강" })}
                >
                  유강
                </button>
              </div>

              <div className="actions">
                <label className="upload">
                  <Upload size={16} /> 엑셀 업로드
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await importPermitExcel(file);
                    }}
                  />
                </label>
                <button onClick={loadPermits}>새로고침</button>
              </div>
            </div>

            <div className="grid5">
              <Field label="회사/구분">
                <input
                  value={permitForm.company}
                  onChange={(e) => setPermitForm({ ...permitForm, company: e.target.value })}
                  placeholder="예: 태명산업개발"
                />
              </Field>
              <Field label="허가/신고명">
                <input
                  value={permitForm.title}
                  onChange={(e) => setPermitForm({ ...permitForm, title: e.target.value })}
                />
              </Field>
              <Field label="허가관청">
                <input
                  value={permitForm.agency}
                  onChange={(e) => setPermitForm({ ...permitForm, agency: e.target.value })}
                />
              </Field>
              <Field label="담당/연락처">
                <input
                  value={permitForm.contact}
                  onChange={(e) => setPermitForm({ ...permitForm, contact: e.target.value })}
                />
              </Field>
              <Field label="만료일">
                <input
                  value={permitForm.expiry_date}
                  onChange={(e) => setPermitForm({ ...permitForm, expiry_date: formatInputDate(e.target.value) })}
                  placeholder="20260512 또는 260512"
                />
              </Field>
            </div>

            <div className="grid3">
              <Field label="확인사항">
                <input
                  value={permitForm.check_note}
                  onChange={(e) => setPermitForm({ ...permitForm, check_note: e.target.value })}
                />
              </Field>
              <Field label="주기">
                <input
                  value={permitForm.cycle}
                  onChange={(e) => setPermitForm({ ...permitForm, cycle: e.target.value })}
                />
              </Field>
              <Field label="상태">
                <select
                  value={permitForm.status}
                  onChange={(e) => setPermitForm({ ...permitForm, status: e.target.value })}
                >
                  <option value="진행">진행</option>
                  <option value="완료">완료</option>
                  <option value="보류">보류</option>
                </select>
              </Field>
            </div>

            <Field label="비고">
              <input
                value={permitForm.memo}
                onChange={(e) => setPermitForm({ ...permitForm, memo: e.target.value })}
              />
            </Field>

            <div className="actions right-actions">
              <button className="primary" onClick={savePermit}>
                {editingPermitId ? "수정저장" : "허가 등록"}
              </button>
              <button onClick={resetPermitForm}>초기화</button>
            </div>

            <div className="grid3">
              <Field label="회사 검색">
                <input value={permitSearch.company} onChange={(e) => setPermitSearch({ ...permitSearch, company: e.target.value })} />
              </Field>
              <Field label="키워드 검색">
                <input value={permitSearch.keyword} onChange={(e) => setPermitSearch({ ...permitSearch, keyword: e.target.value })} />
              </Field>
              <Field label="상태 검색">
                <select value={permitSearch.status} onChange={(e) => setPermitSearch({ ...permitSearch, status: e.target.value })}>
                  <option value="">전체</option>
                  <option value="진행">진행</option>
                  <option value="완료">완료</option>
                  <option value="보류">보류</option>
                </select>
              </Field>
            </div>

            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th>회사</th>
                    <th>허가/신고명</th>
                    <th>허가관청</th>
                    <th>담당/연락처</th>
                    <th>만료일</th>
                    <th>D-day</th>
                    <th>상태</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {!filteredPermits.length ? (
                    <tr><td colSpan={8} className="empty">등록된 허가/갱신 업무가 없습니다.</td></tr>
                  ) : (
                    filteredPermits.map((permit: PermitRenewal) => {
                      const dday = getDday(permit.expiry_date) ?? 999999;
                      return (
                        <tr key={permit.id}>
                          <td>{permit.company}</td>
                          <td>{permit.title}</td>
                          <td>{permit.agency || "-"}</td>
                          <td>{permit.contact || "-"}</td>
                          <td>{permit.expiry_date || "-"}</td>
                          <td className={dday <= 7 ? "danger-text" : dday <= 30 ? "warn-text" : ""}>
                            {permit.expiry_date ? (dday >= 0 ? `D-${dday}` : `D+${Math.abs(dday)}`) : "-"}
                          </td>
                          <td>{permit.status || "진행"}</td>
                          <td>
                            <button className="icon" onClick={() => editPermit(permit)}><Pencil size={16} /></button>
                            <button className="icon" onClick={() => deletePermit(permit.id)}><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ScrollTable>

            <div className="permit-card-list">
              {!filteredPermits.length ? (
                <div className="empty">등록된 허가/갱신 업무가 없습니다.</div>
              ) : (
                filteredPermits.map((permit: PermitRenewal) => {
                  const dday = getDday(permit.expiry_date) ?? 999999;
                  const ddayText = permit.expiry_date ? (dday >= 0 ? `D-${dday}` : `D+${Math.abs(dday)}`) : "미정";
                  const ddayClass = dday <= 7 ? "danger" : dday <= 30 ? "warn" : "";

                  return (
                    <div className="permit-card" key={permit.id}>
                      <div className="permit-card-main">
                        <div className="permit-title-area">
                          <span className="permit-company">{permit.company || "회사 미입력"}</span>
                          <b>{permit.title || "허가/신고명 미입력"}</b>
                          <p>{permit.agency || "허가관청 미입력"}</p>
                        </div>

                        <div className="permit-dday-box">
                          <span className={ddayClass}>{ddayText}</span>
                          <small>{permit.expiry_date || "만료일 없음"}</small>
                        </div>
                      </div>

                      <div className="permit-info-grid">
                        <div>
                          <label>담당/연락처</label>
                          <p>{permit.contact || "-"}</p>
                        </div>
                        <div>
                          <label>확인사항</label>
                          <p>{permit.check_note || "-"}</p>
                        </div>
                        <div>
                          <label>주기</label>
                          <p>{permit.cycle || "-"}</p>
                        </div>
                        <div>
                          <label>상태</label>
                          <p>{permit.status || "진행"}</p>
                        </div>
                      </div>

                      {permit.memo && <div className="permit-memo">{permit.memo}</div>}

                      <div className="permit-card-actions">
                        <button onClick={() => editPermit(permit)}>수정</button>
                        <button className="danger-btn" onClick={() => deletePermit(permit.id)}>삭제</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}





        {menuTab === "maintenance_photos" && (
          <section className="card receipt-photo-page receipt-photo-page-clean maintenance-photo-page-clean">
            <div className="receipt-clean-title">
              <div className="receipt-clean-icon maint">🛠️</div>
              <div>
                <h2>정비사진등록</h2>
                <p>현장 직원은 정비 사진과 내용을 등록하고, 관리자는 확인 후 정비등록에 반영합니다.</p>
              </div>
              <button className="receipt-refresh-btn" onClick={loadMaintenancePhotos}>새로고침</button>
            </div>

            <div className="receipt-clean-form-wrap">
              <div className="receipt-clean-form-card">
                <div className="receipt-card-section-title">정비 정보</div>

                <div className="receipt-clean-grid">
                  <Field label="일자">
                    <div className="date-input-wrap">
                      <input
                        className="date-text-input"
                        value={maintenancePhotoForm.maint_date}
                        onChange={(e) => setMaintenancePhotoForm({ ...maintenancePhotoForm, maint_date: formatInputDate(e.target.value) })}
                        placeholder="20260513 또는 260513"
                      />
                      <input
                        className="date-picker-input"
                        type="date"
                        value={maintenancePhotoForm.maint_date}
                        onChange={(e) => setMaintenancePhotoForm({ ...maintenancePhotoForm, maint_date: e.target.value })}
                        aria-label="정비일자 선택"
                      />
                      <span className="date-picker-icon">📅</span>
                    </div>
                  </Field>

                  <Field label="설비명">
                    <SearchSelect
                      value={maintenancePhotoForm.equipment_name}
                      options={warehouseNames}
                      onChange={(value) => setMaintenancePhotoForm({ ...maintenancePhotoForm, equipment_name: value })}
                      placeholder="설비/창고 검색 또는 입력"
                    />
                  </Field>
                </div>

                <Field label="정비내용">
                  <textarea
                    className="receipt-clean-textarea"
                    value={maintenancePhotoForm.memo}
                    onChange={(e) => setMaintenancePhotoForm({ ...maintenancePhotoForm, memo: e.target.value })}
                    placeholder="예: 2470 스크린 스프링 교체 / 컨베이어 벨트 찢어짐 / 로더 오일 누유"
                    rows={5}
                  />
                </Field>

                <label className="maintenance-urgent-check">
                  <input
                    type="checkbox"
                    checked={maintenancePhotoForm.is_urgent}
                    onChange={(e) => setMaintenancePhotoForm({ ...maintenancePhotoForm, is_urgent: e.target.checked })}
                  />
                  긴급 정비로 표시
                </label>

                <button className="receipt-submit-clean maintenance-submit" onClick={saveMaintenancePhoto} disabled={maintenancePhotoSaving}>
                  {maintenancePhotoSaving ? "저장 중..." : "정비사진 등록"}
                </button>
              </div>

              <div className="receipt-clean-upload-card">
                <div className="receipt-card-section-title">정비 사진 첨부</div>

                <label className="receipt-dropzone maintenance-dropzone">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setMaintenancePhotoFiles(Array.from(e.target.files || []))}
                  />
                  <div className="receipt-drop-icon">⬆</div>
                  <strong>정비 사진을 선택하세요</strong>
                  <span>여러 장 선택 가능 · 현장 사진 그대로 업로드</span>
                </label>

                <div className="receipt-file-count">
                  {maintenancePhotoFiles.length ? `${maintenancePhotoFiles.length}장 선택됨` : "선택된 사진 없음"}
                </div>
              </div>
            </div>

            <div className="receipt-list-head">
              <div>
                <h3>등록된 정비사진</h3>
                <p>미처리 {maintenancePhotos.filter((item) => !item.is_processed).length}건 · 처리완료 {maintenancePhotos.filter((item) => item.is_processed).length}건</p>
              </div>
            </div>

            <div className="receipt-clean-list">
              {!maintenancePhotos.length ? (
                <div className="receipt-clean-empty">등록된 정비사진이 없습니다.</div>
              ) : (
                maintenancePhotos.map((item) => (
                  <div className={item.is_processed ? "receipt-clean-card processed" : "receipt-clean-card pending"} key={item.id}>
                    <div className="receipt-clean-card-top">
                      <span className={item.is_processed ? "receipt-badge processed" : "receipt-badge pending"}>
                        {item.is_processed ? "처리완료" : "미처리"}
                      </span>
                      <small>{item.maint_date}</small>
                    </div>

                    <strong className="receipt-vendor-name">{item.equipment_name}</strong>
                    <p className="receipt-created-by">{item.created_by || "등록자 미입력"}</p>
                    {item.is_urgent && <div className="maintenance-urgent-badge">긴급</div>}

                    {item.memo && <div className="receipt-clean-memo">{item.memo}</div>}

                    <div className="receipt-clean-thumbs">
                      {(item.image_urls || []).slice(0, 3).map((url, idx) => (
                        <img key={`${item.id}-${idx}`} src={url} alt="정비사진" onClick={() => setMaintenancePhotoPreviewOpen(item)} />
                      ))}
                      {!(item.image_urls || []).length && <div className="receipt-no-thumb">사진 없음</div>}
                      {(item.image_urls || []).length > 3 && <div className="receipt-more-thumb">+{(item.image_urls || []).length - 3}</div>}
                    </div>

                                        <div className="receipt-clean-actions">
                      <button onClick={() => setMaintenancePhotoPreviewOpen(item)}>사진보기</button>
                      {isAdmin && <button className="link" onClick={() => applyMaintenancePhotoToMaint(item)}>정비등록 반영</button>}
                      {isAdmin && <button className="link secondary" onClick={() => openMaintRecordPickerFromMaintenancePhoto(item)}>기존정비 연결</button>}
                      <button className="complete" onClick={() => toggleMaintenancePhotoProcessed(item)}>
                        {item.is_processed ? "미처리로 변경" : "처리완료"}
                      </button>
                      {isAdmin && <button className="delete" onClick={() => deleteMaintenancePhoto(item.id)}>삭제</button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {maintenancePhotoPreviewOpen && (
          <div className="receipt-photo-preview-backdrop" onClick={() => setMaintenancePhotoPreviewOpen(null)}>
            <div className="receipt-photo-preview" onClick={(e) => e.stopPropagation()}>
              <div className="receipt-photo-preview-head">
                <div>
                  <h2>{maintenancePhotoPreviewOpen.equipment_name}</h2>
                  <p>{maintenancePhotoPreviewOpen.maint_date}</p>
                  {maintenancePhotoPreviewOpen.memo && <span>{maintenancePhotoPreviewOpen.memo}</span>}
                </div>
                <button onClick={() => setMaintenancePhotoPreviewOpen(null)}>닫기</button>
              </div>

              {(maintenancePhotoPreviewOpen.image_urls || []).length ? (
                <div className="receipt-photo-preview-images">
                  {(maintenancePhotoPreviewOpen.image_urls || []).map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="정비사진 확대" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="receipt-photo-no-image">등록된 사진이 없습니다.</div>
              )}
            </div>
          </div>
        )}


        {menuTab === "receipt_photos" && (
          <section className="card receipt-photo-page receipt-photo-page-clean">
            <div className="receipt-clean-title">
              <div className="receipt-clean-icon">📷</div>
              <div>
                <h2>입고사진등록</h2>
                <p>직원은 자재 입고 사진과 내용을 등록하고, 관리자는 확인 후 처리완료로 변경합니다.</p>
              </div>
              <button className="receipt-refresh-btn" onClick={loadReceiptPhotos}>새로고침</button>
            </div>

            <div className="receipt-clean-form-wrap">
              <div className="receipt-clean-form-card">
                <div className="receipt-card-section-title">입고 정보</div>

                <div className="receipt-clean-grid">
                  <Field label="일자">
                    <div className="date-input-wrap">
                      <input
                        className="date-text-input"
                        value={receiptPhotoForm.receipt_date}
                        onChange={(e) => setReceiptPhotoForm({ ...receiptPhotoForm, receipt_date: formatInputDate(e.target.value) })}
                        placeholder="20260513 또는 260513"
                      />
                      <input
                        className="date-picker-input"
                        type="date"
                        value={receiptPhotoForm.receipt_date}
                        onChange={(e) => setReceiptPhotoForm({ ...receiptPhotoForm, receipt_date: e.target.value })}
                        aria-label="입고일자 선택"
                      />
                      <span className="date-picker-icon">📅</span>
                    </div>
                  </Field>

                  <Field label="거래처">
                    <SearchSelect
                      value={receiptPhotoForm.vendor_name}
                      options={vendorOptions}
                      onChange={(value) => setReceiptPhotoForm({ ...receiptPhotoForm, vendor_name: value })}
                      placeholder="거래처 검색 또는 입력"
                    />
                  </Field>
                </div>

                <Field label="내용">
                  <textarea
                    className="receipt-clean-textarea"
                    value={receiptPhotoForm.memo}
                    onChange={(e) => setReceiptPhotoForm({ ...receiptPhotoForm, memo: e.target.value })}
                    placeholder="예: 베어링 입고 / 로더 부품 도착 / 납품사진"
                    rows={5}
                  />
                </Field>

                <button className="receipt-submit-clean" onClick={saveReceiptPhoto} disabled={receiptPhotoSaving}>
                  {receiptPhotoSaving ? "저장 중..." : "입고사진 등록"}
                </button>
              </div>

              <div className="receipt-clean-upload-card">
                <div className="receipt-card-section-title">사진 첨부</div>

                <label className="receipt-dropzone">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setReceiptPhotoFiles(Array.from(e.target.files || []))}
                  />
                  <div className="receipt-drop-icon">⬆</div>
                  <strong>사진을 선택하세요</strong>
                  <span>여러 장 선택 가능 · JPG / PNG / HEIC</span>
                </label>

                <div className="receipt-file-count">
                  {receiptPhotoFiles.length ? `${receiptPhotoFiles.length}장 선택됨` : "선택된 사진 없음"}
                </div>
              </div>
            </div>

            <div className="receipt-list-head">
              <div>
                <h3>등록된 입고사진</h3>
                <p>미처리 {receiptPhotos.filter((item) => !item.is_processed).length}건 · 처리완료 {receiptPhotos.filter((item) => item.is_processed).length}건</p>
              </div>
            </div>

            <div className="receipt-clean-list">
              {!receiptPhotos.length ? (
                <div className="receipt-clean-empty">등록된 입고사진이 없습니다.</div>
              ) : (
                receiptPhotos.map((item) => (
                  <div className={item.is_processed ? "receipt-clean-card processed" : "receipt-clean-card pending"} key={item.id}>
                    <div className="receipt-clean-card-top">
                      <span className={item.is_processed ? "receipt-badge processed" : "receipt-badge pending"}>
                        {item.is_processed ? "처리완료" : "미처리"}
                      </span>
                      <small>{item.receipt_date}</small>
                    </div>

                    <strong className="receipt-vendor-name">{item.vendor_name}</strong>
                    <p className="receipt-created-by">{item.created_by || "등록자 미입력"}</p>

                    {item.memo && <div className="receipt-clean-memo">{item.memo}</div>}

                    <div className="receipt-clean-thumbs">
                      {(item.image_urls || []).slice(0, 3).map((url, idx) => (
                        <img key={`${item.id}-${idx}`} src={url} alt="입고사진" onClick={() => setReceiptPhotoPreviewOpen(item)} />
                      ))}
                      {!(item.image_urls || []).length && <div className="receipt-no-thumb">사진 없음</div>}
                      {(item.image_urls || []).length > 3 && <div className="receipt-more-thumb">+{(item.image_urls || []).length - 3}</div>}
                    </div>

                                        <div className="receipt-clean-actions">
                      <button onClick={() => setReceiptPhotoPreviewOpen(item)}>사진보기</button>
                      {isAdmin && <button className="link" onClick={() => applyReceiptPhotoToPurchase(item)}>구매입력 반영</button>}
                      {isAdmin && <button className="link secondary" onClick={() => openPurchaseRecordPickerFromReceiptPhoto(item)}>기존구매 연결</button>}
                      <button className="complete" onClick={() => toggleReceiptPhotoProcessed(item)}>
                        {item.is_processed ? "미처리로 변경" : "처리완료"}
                      </button>
                      {isAdmin && <button className="delete" onClick={() => deleteReceiptPhoto(item.id)}>삭제</button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {receiptPhotoPreviewOpen && (
          <div className="receipt-photo-preview-backdrop" onClick={() => setReceiptPhotoPreviewOpen(null)}>
            <div className="receipt-photo-preview" onClick={(e) => e.stopPropagation()}>
              <div className="receipt-photo-preview-head">
                <div>
                  <h2>{receiptPhotoPreviewOpen.vendor_name}</h2>
                  <p>{receiptPhotoPreviewOpen.receipt_date}</p>
                  {receiptPhotoPreviewOpen.memo && <span>{receiptPhotoPreviewOpen.memo}</span>}
                </div>
                <button onClick={() => setReceiptPhotoPreviewOpen(null)}>닫기</button>
              </div>

              {(receiptPhotoPreviewOpen.image_urls || []).length ? (
                <div className="receipt-photo-preview-images">
                  {(receiptPhotoPreviewOpen.image_urls || []).map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="입고사진 확대" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="receipt-photo-no-image">
                  등록된 사진이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}


        {menuTab === "vendor_accounts" && (
          <section className="card vendor-account-page">
            <div className="vendor-account-head">
              <div>
                <h2>업체계좌관리</h2>
                <p>거래처 계좌 및 고객관리성명을 영구 저장합니다.</p>
              </div>

              <div className="actions">
                <label className="upload">
                  <Upload size={16} /> 계좌 엑셀 업로드
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await importVendorAccountsExcel(file);
                    }}
                  />
                </label>

                <button onClick={loadVendorAccounts}>새로고침</button>
              </div>
            </div>

            <div className="vendor-account-list">
              {!vendorAccounts.length ? (
                <div className="empty">등록된 거래처 계좌가 없습니다.</div>
              ) : (
                vendorAccounts.map((account) => (
                  <div className="vendor-account-card" key={account.id}>
                    <div className="vendor-account-title">
                      <strong>{account.vendor_name}</strong>
                    </div>

                    <div className="vendor-account-grid">
                      <Field label="은행명">
                        <input
                          value={account.bank_name || ""}
                          onChange={(e) =>
                            setVendorAccounts((prev) =>
                              prev.map((row) =>
                                row.id === account.id
                                  ? { ...row, bank_name: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </Field>

                      <Field label="은행코드">
                        <input
                          value={account.bank_code || ""}
                          onChange={(e) =>
                            setVendorAccounts((prev) =>
                              prev.map((row) =>
                                row.id === account.id
                                  ? { ...row, bank_code: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </Field>

                      <Field label="예금주">
                        <input
                          value={account.account_name || ""}
                          onChange={(e) =>
                            setVendorAccounts((prev) =>
                              prev.map((row) =>
                                row.id === account.id
                                  ? { ...row, account_name: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </Field>

                      <Field label="고객관리성명">
                        <input
                          value={account.customer_display_name || ""}
                          onChange={(e) =>
                            setVendorAccounts((prev) =>
                              prev.map((row) =>
                                row.id === account.id
                                  ? { ...row, customer_display_name: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </Field>

                      <Field label="계좌번호">
                        <input
                          value={account.account_number || ""}
                          onChange={(e) =>
                            setVendorAccounts((prev) =>
                              prev.map((row) =>
                                row.id === account.id
                                  ? { ...row, account_number: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </Field>
                    </div>

                    <div className="vendor-account-bottom">
                      <button
                        className="primary"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("vendor_accounts")
                            .upsert(account, { onConflict: "id" });

                          if (error) {
                            alert(`저장 실패: ${error.message}`);
                            return;
                          }

                          alert("저장되었습니다.");
                          await loadVendorAccounts();
                        }}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}


        {menuTab === "bulk_transfer" && (
          <section className="card bulk-transfer-page">
            <div className="bulk-transfer-head">
              <div>
                <h2>대량이체 생성</h2>
                <p>구매내역을 거래처별로 합산하고 계좌정보를 매칭해 은행 업로드용 엑셀을 만듭니다.</p>
              </div>
              <div className="actions">
                <label className="upload">
                  <Upload size={16} /> 업체 계좌 업로드
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await importVendorAccountsExcel(file);
                    }}
                  />
                </label>
                <button onClick={loadVendorAccounts}>계좌 새로고침</button>
                <button className="primary" onClick={openBulkTransferDownloadPopup}>대량이체 엑셀 다운로드</button>
              </div>
            </div>

            <div className="bulk-transfer-filter">
              <Field label="지급월">
                <input
                  value={transferMonth}
                  onChange={(e) => setTransferMonth(e.target.value)}
                  placeholder="2026-04"
                />
              </Field>
              <Field label="거래처 검색">
                <input
                  value={transferVendorSearch}
                  onChange={(e) => setTransferVendorSearch(e.target.value)}
                  placeholder="거래처명"
                />
              </Field>
              <div className="bulk-summary">
                <span>대상 거래처 <b>{bulkTransferRows.length}</b></span>
                <span>계좌 미매칭 <b>{bulkTransferRows.filter((r) => !r.matched).length}</b></span>
                <span>합계 <b>{money(bulkTransferRows.reduce((sum, r) => sum + r.amount, 0))}</b></span>
              </div>
            </div>

            <div className="bulk-transfer-list">
              {!bulkTransferRows.length ? (
                <div className="empty">대량이체로 만들 구매내역이 없습니다.</div>
              ) : (
                bulkTransferRows.map((row) => (
                  <div className={row.matched ? "bulk-transfer-card" : "bulk-transfer-card missing"} key={row.id}>
                    <div className="bulk-card-main">
                      <div>
                        <span className={row.matched ? "bulk-status ok" : "bulk-status missing"}>{row.matched ? "계좌매칭" : "계좌확인필요"}</span>
                        <b>{row.vendor}</b>
                      </div>
                      <strong>{money(row.amount)}원</strong>
                    </div>

                    <div className="bulk-edit-grid">
                      <Field label="입금은행">
                        <input value={row.bank_code} onChange={(e) => updateBulkTransferEdit(row.id, "bank_code", e.target.value)} />
                      </Field>
                      <Field label="입금계좌">
                        <input value={row.account_number} onChange={(e) => updateBulkTransferEdit(row.id, "account_number", e.target.value)} />
                      </Field>
                      <Field label="입금액">
                        <input value={String(row.amount || "")} onChange={(e) => updateBulkTransferEdit(row.id, "amount", e.target.value)} />
                      </Field>
                      <Field label="고객관리성명">
                        <input value={row.customer_display_name || row.account_name || row.vendor} onChange={(e) => updateBulkTransferEdit(row.id, "customer_display_name", e.target.value)} />
                      </Field>
                      <Field label="출금통장표시내용">
                        <input value={row.memo} onChange={(e) => updateBulkTransferEdit(row.id, "memo", e.target.value)} />
                      </Field>
                    </div>

                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {menuTab === "backup_permissions" && (
          <BackupPermissionPage
            purchases={purchases}
            maints={maints}
            cardUses={cardUses}
            vendors={vendors}
            groups={groups}
            warehouses={warehouses}
            items={items}
            permits={permits}
            vendorAccounts={vendorAccounts}
            receiptPhotos={receiptPhotos}
            maintenancePhotos={maintenancePhotos}
            maintenanceSchedules={maintenanceSchedules}
            updateNotices={updateNotices}
            userPermissions={userPermissions}
            permissionForm={permissionForm}
            setPermissionForm={setPermissionForm}
            saveUserPermission={saveUserPermission}
            deleteUserPermission={deleteUserPermission}
            loadAll={loadAll}
            loadPermits={loadPermits}
            loadVendorAccounts={loadVendorAccounts}
            loadReceiptPhotos={loadReceiptPhotos}
            loadMaintenancePhotos={loadMaintenancePhotos}
            loadMaintenanceSchedules={loadMaintenanceSchedules}
            loadUserPermissions={loadUserPermissions}
          />
        )}

        {menuTab === "site_notices" && (
          <SiteNoticePage
            siteNotices={visibleSiteNotices}
            allSiteNotices={siteNotices}
            userPermissions={userPermissions}
            siteNoticeForm={siteNoticeForm}
            setSiteNoticeForm={setSiteNoticeForm}
            editingSiteNoticeId={editingSiteNoticeId}
            saveSiteNotice={saveSiteNotice}
            editSiteNotice={editSiteNotice}
            deleteSiteNotice={deleteSiteNotice}
            siteNoticeError={siteNoticeError}
            isAdmin={isAdmin}
          />
        )}

        {menuTab === "home" && <HomeDashboard purchases={purchases} maints={maints} cardUses={cardUses} maintenanceSchedules={maintenanceSchedules} receiptPhotos={receiptPhotos} maintenancePhotos={maintenancePhotos} siteNotices={visibleSiteNotices} setMenuTab={setMenuTab} />}

        {menuTab === "layout" && <Home setMenuTab={setMenuTab} setMaintSearch={setMaintSearch} warehouses={warehouses} isAdmin={isAdmin} />}

        {menuTab === "new" && (
          <section className="card">
            <h2>{editingPurchaseId ? "구매수정" : "구매입력"}</h2>
            <div className="grid3">
              <Field label="일자">
                                <div className="date-input-wrap">
                  <input
                    className="date-text-input"
                    value={purchaseHeader.date}
                    onChange={(e) => setPurchaseHeader({ ...purchaseHeader, date: formatInputDate(e.target.value) })}
                    placeholder="20260501 또는 260501"
                  />
                  <input
                    className="date-picker-input"
                    type="date"
                    value={purchaseHeader.date}
                    onChange={(e) => setPurchaseHeader({ ...purchaseHeader, date: e.target.value })}
                    aria-label="일자 선택"
                  />
                  <span className="date-picker-icon">📅</span>
                </div>
              </Field>
              <SearchSelect label="거래처" value={purchaseHeader.vendor} options={vendorOptions} onChange={(v) => setPurchaseHeader({ ...purchaseHeader, vendor: v })} placeholder="거래처명 일부 입력" />
              <SearchSelect label="창고" value={purchaseHeader.warehouse} options={warehouseNames} onChange={(v) => setPurchaseHeader({ ...purchaseHeader, warehouse: v })} placeholder="창고명 일부 입력" />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>품목</th><th>규격</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세액</th><th>합계</th><th></th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={r.id}><td>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, minWidth: 520 }}>
    <SearchSelect
      value={r.item}
      options={itemOptions}
      onChange={(v) => updateRow(i, "item", v)}
      placeholder="품목 검색"
    />
    <input
      value={r.item}
      onChange={(e) => updateRow(i, "item", e.target.value)}
      placeholder="품목명 직접수정"
      title="이번 구매입력에서만 품목명을 수정합니다. 품목등록 원본은 바뀌지 않습니다."
    />
    <button
      type="button"
      onClick={() => openNewItemModal(i)}
    >
      + 신규
    </button>
  </div>
</td><td><input value={r.spec} onChange={(e) => updateRow(i, "spec", e.target.value)} /></td><td><input className="right" value={r.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} /></td><td><input className="right" value={r.price} onChange={(e) => updateRow(i, "price", e.target.value)} /></td><td><input className="right" value={r.supply} onChange={(e) => updateRow(i, "supply", e.target.value)} /></td><td><input className="right" value={r.vat} onChange={(e) => updateRow(i, "vat", e.target.value)} /></td><td className="right bold">{money(r.total)}</td><td><button className="icon" onClick={() => setRows(rows.length === 1 ? [emptyRow()] : rows.filter((_, idx) => idx !== i))}><Trash2 size={16} /></button></td></tr>)}</tbody>
              </table>
            </div>
            <div className="between"><button onClick={() => setRows([...rows, emptyRow()])}><Plus size={16} /> 행추가</button><div className="totals"><div>공급가액 합계: <b>{money(purchaseSupplyTotal)}원</b></div><div>부가세액 합계: <b>{money(purchaseVatTotal)}원</b></div><div className="big">총합: {money(purchaseTotal)}원</div></div></div>
            <div className="actions"><button className="primary" onClick={savePurchase}><Save size={16} /> 저장</button><button onClick={resetPurchaseForm}><RotateCcw size={16} /> 초기화</button></div>
          </section>
        )}

        {menuTab === "list" && <PurchaseList purchases={filteredPurchases} search={purchaseSearch} setSearch={setPurchaseSearch} editPurchase={editPurchase} deletePurchase={deletePurchase} isAdmin={canEditDeleteRecords} onLinkPhoto={openPurchasePhotoPicker} />}

        {menuTab === "status" && <PurchaseStatus purchases={purchases} />}


        {menuTab === "card_use" && (
          <section className="card">
            <h2>{editingCardUseId ? "카드사용 수정" : "카드사용"}</h2>

            <div className="grid5">
              <Field label="사용일자">
                <input
                  type="text"
                  placeholder="240107 또는 20240107"
                  value={cardForm.date}
                  onChange={(e) => setCardForm({ ...cardForm, date: formatInputDate(e.target.value) })}
                />
              </Field>
              <Field label="담당자">
                <input value={cardForm.user_name} onChange={(e) => setCardForm({ ...cardForm, user_name: e.target.value })} placeholder="사용자/작업자" />
              </Field>
              <Field label="사용처">
                <input value={cardForm.place} onChange={(e) => setCardForm({ ...cardForm, place: e.target.value })} placeholder="상호/구매처" />
              </Field>
              <Field label="금액">
                <input className="right" value={cardForm.amount} onChange={(e) => setCardForm({ ...cardForm, amount: e.target.value })} placeholder="0" />
              </Field>
              <Field label="메모">
                <input value={cardForm.memo} onChange={(e) => setCardForm({ ...cardForm, memo: e.target.value })} placeholder="구매내용 메모" />
              </Field>
            </div>

            <div className="between">
              <label className="upload">
                <Upload size={16} /> 영수증 여러 장 업로드
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  multiple
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    const urls = await uploadCardReceipts(files);
                    setCardForm((prev) => {
                      const nextUrls = [...(prev.image_urls || []), ...urls];
                      return { ...prev, image_urls: nextUrls, image_url: nextUrls[0] || prev.image_url };
                    });
                  }}
                />
              </label>
              <div className="receipt-preview">
                {(cardForm.image_urls || []).length ? (
                  <div className="attachment-chips">
                    {(cardForm.image_urls || []).map((url, idx) => (
                      <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer">영수증{idx + 1}</a>
                    ))}
                  </div>
                ) : (
                  cardForm.image_url ? <a href={cardForm.image_url} target="_blank" rel="noreferrer">업로드한 영수증 보기</a> : <span>영수증 미첨부</span>
                )}
              </div>
            </div>

            <div className="actions right-actions">
              <button className="primary" onClick={saveCardUse}>{editingCardUseId ? "카드사용 수정저장" : "카드사용 저장"}</button>
              <button onClick={resetCardForm}>초기화</button>
            </div>

          </section>
        )}


                {menuTab === "card_list" && (
          <section className="card lookup-page card-lookup-page">
            <div className="between" style={{marginTop:24}}>
              <h2>카드조회</h2>
              <button onClick={() => downloadExcel(`카드사용_${todayText()}`, withTotalRow(
  filteredCardUses.map((c) => ({ 사용일자: c.date, 담당자: c.user_name, 사용처: c.place, 금액: c.amount, 메모: c.memo || "", 영수증: c.image_url || "" })),
  { 사용일자: "총합계", 금액: filteredCardUses.reduce((sum, c) => sum + Number(c.amount || 0), 0) }
))}>엑셀 다운로드</button><button onClick={() => downloadPdf(`카드사용_${todayText()}`, "카드사용", withTotalRow(filteredCardUses.map((c) => ({ 사용일자: c.date, 작업자: c.user_name, 사용처: c.place, 금액: c.amount, 메모: c.memo || "" })), { 사용일자: "총합계", 금액: filteredCardUses.reduce((sum, c) => sum + Number(c.amount || 0), 0) }))}>PDF 출력</button>
            </div>
            <div className="grid5">
              <Field label="시작일"><input type="date" value={cardSearch.from} onChange={(e) => setCardSearch({ ...cardSearch, from: e.target.value })} /></Field>
              <Field label="종료일"><input type="date" value={cardSearch.to} onChange={(e) => setCardSearch({ ...cardSearch, to: e.target.value })} /></Field>
              <Field label="담당자"><input value={cardSearch.user_name} onChange={(e) => setCardSearch({ ...cardSearch, user_name: e.target.value })} placeholder="작업자 검색" /></Field>
              <Field label="사용처"><input value={cardSearch.place} onChange={(e) => setCardSearch({ ...cardSearch, place: e.target.value })} placeholder="사용처 검색" /></Field>
              <Field label="초기화"><button onClick={() => setCardSearch({ from: "", to: "", user_name: "", place: "" })}>검색 초기화</button></Field>
            </div>

            <div className="status-cards">
              <div><span>카드사용 건수</span><b>{filteredCardUses.length}건</b></div>
              <div><span>카드사용 합계</span><b>{money(filteredCardUses.reduce((sum, c) => sum + Number(c.amount || 0), 0))}원</b></div>
            </div>

            <ScrollTable>
              <table>
                <thead>
                  <tr><th>관리번호</th><th>담당자</th><th>사용처</th><th>금액</th><th>메모</th><th>영수증</th><th>관리</th></tr>
                </thead>
                <tbody>
                  {!filteredCardUses.length ? (
                    <tr><td colSpan={7} className="empty">저장된 카드사용 내역 없음</td></tr>
                  ) : (
                    filteredCardUses.map((c, index) => {
                      const sameDateBeforeCount = filteredCardUses
                        .slice(0, index)
                        .filter((x) => x.date === c.date).length;
                      const seq = sameDateBeforeCount + 1;

                      return (
                      <tr key={c.id}>
                        <td>{`${c.date || ""}-${String(seq).padStart(2, "0")}`}</td>
                        <td>{c.user_name || "-"}</td>
                        <td>{c.place}</td>
                        <td className="right bold">{money(c.amount)}</td>
                        <td>{c.memo || "-"}</td>
                        <td><AttachmentGroup urls={c.image_urls || (c.image_url ? [c.image_url] : [])} /></td>
                        <td>{isAdmin ? <><button className="icon" onClick={() => editCardUse(c)}><Pencil size={16} /></button><button className="icon" onClick={() => deleteCardUse(c.id)}><Trash2 size={16} /></button></> : "-"}</td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </ScrollTable>
            <div className="mobile-card-list mobile-card-list-carduses">
              {filteredCardUses.map((c, index) => {
                const sameDateBeforeCount = filteredCardUses
                  .slice(0, index)
                  .filter((x) => x.date === c.date).length;
                const seq = sameDateBeforeCount + 1;

                return (
                  <div className="mobile-list-card" key={c.id}>
                    <div className="mobile-list-top mobile-maint-card-top">
                      <b>{`${c.date || ""}-${String(seq).padStart(2, "0")}`}</b>
                      <span>{money(c.amount)}원</span>
                    </div>

                    <div className="mobile-list-body">
                      <div><label>사용처</label><p>{c.place}</p></div>
                      <div><label>담당자</label><p>{c.user_name || "-"}</p></div>
                      <div><label>메모</label><p>{c.memo || "-"}</p></div>
                    </div>

                    <div className="mobile-list-attachment">
                      <AttachmentGroup urls={c.image_urls || (c.image_url ? [c.image_url] : [])} />
                    </div>

                    <div className="mobile-card-actions">
                      {isAdmin ? (
                        <>
                          <button onClick={() => editCardUse(c)}>수정</button>
                          <button onClick={() => deleteCardUse(c.id)}>삭제</button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

          </section>
        )}


        {menuTab === "card_stats" && <CardUseStats cardUses={cardUses} />}

        {menuTab === "vendors" && (
          <section className="card"><h2>거래처등록</h2><div className="between"><span>{vendorImportMessage || `현재 ${vendors.length}개 거래처 등록됨`}</span><label className="upload"><Upload size={16} /> 거래처 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && importVendors(e.target.files[0])} /></label></div><div className="grid5"><Field label="거래처코드"><input value={vendorForm.code} onChange={(e) => setVendorForm({ ...vendorForm, code: e.target.value })} /></Field><Field label="상호"><input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} /></Field><Field label="대표자"><input value={vendorForm.owner} onChange={(e) => setVendorForm({ ...vendorForm, owner: e.target.value })} /></Field><Field label="전화번호"><input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} /></Field><Field label="모바일"><input value={vendorForm.mobile} onChange={(e) => setVendorForm({ ...vendorForm, mobile: e.target.value })} /></Field></div><div className="actions right-actions">{isAdmin && <button onClick={clearVendors}>전체삭제</button>}{isAdmin && <button className="primary" onClick={saveVendor}>{editingVendorId ? "거래처 수정저장" : "거래처 저장"}</button>}</div><SimpleVendorTable vendors={vendors} deleteVendor={deleteVendor} editVendor={editVendor} isAdmin={canEditDeleteRecords} /></section>
        )}

        {menuTab === "warehouse_groups" && (
          <section className="card"><h2>창고등록</h2><div className="two"><div><h3>대분류 창고</h3><Field label="대분류 코드"><input value={groupForm.code} readOnly /></Field><Field label="대분류 이름"><input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></Field>{isAdmin && <button className="primary" onClick={saveGroup}>{editingGroupId ? "대분류 수정저장" : "대분류 저장"}</button>}<ScrollTable><table><thead><tr><th>코드</th><th>이름</th><th>관리</th></tr></thead><tbody>{groups.map((g) => <tr key={g.id}><td>{g.code}</td><td>{g.name}</td><td>{isAdmin ? <><button className="icon" onClick={() => editGroup(g)}><Pencil size={16} /></button><button className="icon" onClick={() => deleteGroup(g.id, g.name)}><Trash2 size={16} /></button></> : "-"}</td></tr>)}</tbody></table></ScrollTable></div><div><h3>세부 창고</h3><SearchSelect label="상위 분류" value={warehouseForm.group} options={groups.map((g) => g.name)} onChange={(v) => setWarehouseForm({ ...warehouseForm, group: v })} placeholder="크라샤 입력" /><Field label="세부 코드"><input value={warehouseForm.code} readOnly /></Field><Field label="세부 이름"><input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} /></Field>{isAdmin && <button className="primary" onClick={saveWarehouse}>{editingWarehouseId ? "세부창고 수정저장" : "세부 창고 저장"}</button>}<ScrollTable><table><thead><tr><th>코드</th><th>대분류</th><th>창고명</th><th>관리</th></tr></thead><tbody>{warehouses.map((w) => <tr key={w.id}><td>{w.code}</td><td>{w.group}</td><td>{w.name}</td><td>{isAdmin ? <><button className="icon" onClick={() => editWarehouse(w)}><Pencil size={16} /></button><button className="icon" onClick={() => deleteWarehouse(w.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>)}</tbody></table></ScrollTable></div></div></section>
        )}

        {menuTab === "items" && (
          <section className="card"><h2>품목등록</h2><div className="between"><span>{itemImportMessage || `현재 ${items.length}개 품목 등록됨`}</span><label className="upload"><Upload size={16} /> 품목 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && importItems(e.target.files[0])} /></label></div><div className="item-search"><input placeholder="품목코드 / 품목명 / 규격 / 단위 검색" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} /><span>{filteredItems.length}건 표시</span></div><div className="grid5"><Field label="품목코드"><input value={itemForm.code} readOnly /></Field><Field label="품목명"><input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></Field><Field label="규격정보"><input value={itemForm.spec} onChange={(e) => setItemForm({ ...itemForm, spec: e.target.value })} /></Field><Field label="단위"><input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} /></Field><Field label="입고단가"><input value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} /></Field></div><div className="actions right-actions">{isAdmin && <button onClick={clearItems}>전체삭제</button>}{isAdmin && <button className="primary" onClick={saveItem}>{editingItemId ? "품목 수정저장" : "품목 저장"}</button>}</div><ScrollTable><table><thead><tr><th>품목코드</th><th>품목명</th><th>규격정보</th><th>단위</th><th>입고단가</th><th>관리</th></tr></thead><tbody>{filteredItems.map((it) => <tr key={it.id}><td>{it.code}</td><td>{it.name}</td><td>{it.spec || "-"}</td><td>{it.unit || "-"}</td><td className="right">{money(it.price)}</td><td>{isAdmin ? <><button className="icon" onClick={() => editItem(it)}><Pencil size={16} /></button><button className="icon" onClick={() => deleteItem(it.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>)}</tbody></table></ScrollTable></section>
        )}

        {menuTab === "maint_new" && (
          <section className="card">
            <h2>{editingMaintId ? "정비수정" : "정비등록"}</h2>

            <div className="grid3">
              <Field label="정비일자">
                <input
                  type="text"
                  placeholder="240107 또는 20240107"
                  value={maintForm.date}
                  onChange={(e) => setMaintForm({ ...maintForm, date: formatInputDate(e.target.value) })}
                />
              </Field>
              <SearchSelect label="창고" value={maintForm.warehouse} options={warehouseNames} onChange={(v) => setMaintForm({ ...maintForm, warehouse: v })} placeholder="창고 선택/검색" />
              <Field label="작업자">
                <input value={maintForm.manager} onChange={(e) => setMaintForm({ ...maintForm, manager: e.target.value })} />
              </Field>
              <Field label="정비제목">
                <input value={maintForm.title} onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })} />
              </Field>
              <Field label="정비내용">
                <input value={maintForm.detail} onChange={(e) => setMaintForm({ ...maintForm, detail: e.target.value })} />
              </Field>
              <Field label="정비비용">
                <input value={maintForm.cost} readOnly />
              </Field>
            </div>

            <h3>사용 품목</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>품목</th>
                    <th>규격</th>
                    <th>수량</th>
                    <th>단가</th>
                    <th>공급가액</th>
                    <th>부가세</th>
                    <th>합계</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {maintItems.map((r, i) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: "grid", gridTemplateColumns: "220px 220px", gap: 6, minWidth: 460 }}>
                          <SearchSelect
                            value={r.item}
                            options={itemOptions}
                            onChange={(v) => updateMaintItem(i, "item", v)}
                            placeholder="품목 검색"
                          />
                          <input
                            value={r.item}
                            onChange={(e) => updateMaintItem(i, "item", e.target.value)}
                            placeholder="품목명 직접수정"
                          />
                        </div>
                      </td>
                      <td><input value={r.spec} onChange={(e) => updateMaintItem(i, "spec", e.target.value)} /></td>
                      <td><input className="right" value={r.qty} onChange={(e) => updateMaintItem(i, "qty", e.target.value)} /></td>
                      <td><input className="right" value={r.price} onChange={(e) => updateMaintItem(i, "price", e.target.value)} /></td>
                      <td><input className="right" value={r.supply} onChange={(e) => updateMaintItem(i, "supply", e.target.value)} /></td>
                      <td><input className="right" value={r.vat} onChange={(e) => updateMaintItem(i, "vat", e.target.value)} /></td>
                      <td className="right bold">{money(r.total)}</td>
                      <td>
                        <button className="icon" onClick={() => {
                          const next = maintItems.length === 1 ? [emptyMaintItem()] : maintItems.filter((_, idx) => idx !== i);
                          setMaintItems(next);
                          const total = next.reduce((sum, row) => sum + Number(row.total || 0), 0);
                          setMaintForm((prev) => ({ ...prev, cost: String(total) }));
                        }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="between">
              <button onClick={() => setMaintItems([...maintItems, emptyMaintItem()])}><Plus size={16} /> 품목행 추가</button>
              <div className="totals">
                <div>공급가액 합계: <b>{money(maintSupplyTotal)}원</b></div>
                <div>부가세 합계: <b>{money(maintVatTotal)}원</b></div>
                <div className="big">정비비 총합: {money(maintGrandTotal)}원</div>
              </div>
            </div>

            <div className="between">
              <label className="upload">
                <Upload size={16} /> 정비 사진/PDF 여러 장 업로드
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    const urls = await uploadMaintFiles(files);
                    setMaintForm((prev) => ({
                      ...prev,
                      image_urls: [...(prev.image_urls || []), ...urls],
                    }));
                  }}
                />
              </label>
              <div className="attachment-chips">
                {(maintForm.image_urls || []).length ? (
                  (maintForm.image_urls || []).map((url, idx) => (
                    <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer">첨부{idx + 1}</a>
                  ))
                ) : (
                  <span>첨부파일 없음</span>
                )}
              </div>
            </div>

            <div className="actions right-actions">
              <button className="primary" onClick={saveMaint}>정비 저장</button>
              <button onClick={resetMaintForm}>초기화</button>
            </div>
          </section>
        )}

        {menuTab === "maint_list" && <MaintList maints={filteredMaints} search={{ ...maintSearch, warehouseNames }} setSearch={setMaintSearch} editMaint={editMaint} deleteMaint={deleteMaint} setMenuTab={setMenuTab} isAdmin={canEditDeleteRecords} onLinkPhoto={openMaintPhotoPicker} />}

        {menuTab === "maint_stats" && <MaintenanceStats maints={maints} />}

        {menuTab === "maintenance_schedule_new" && (
          <section className="maintenance-schedule-pro-page">
            <div className="schedule-pro-hero">
              <div>
                <span className="schedule-pro-eyebrow">Maintenance Schedule</span>
                <h2>{editingMaintenanceScheduleId ? "정비일정 수정" : "정비일정등록"}</h2>
                <p>예정일 기준으로 하루에 여러 작업을 등록하고, 조회 화면과 홈 대시보드에서 한눈에 확인합니다.</p>
              </div>
              <button className="schedule-pro-ghost" onClick={() => setMenuTab("maintenance_schedules")}>일정조회로 이동</button>
            </div>

            <div className="schedule-pro-layout">
              <div className="schedule-pro-form-card">
                <div className="schedule-pro-card-title modern">
                  <div>
                    <b>일정 정보</b>
                    <small>창고/설비를 선택하고 작업 내용을 등록하세요.</small>
                  </div>
                  <span>{maintenanceScheduleForm.schedule_date || getTodayKey()}</span>
                </div>

                <div className="schedule-pro-grid">
                  <Field label="예정일">
                    <input type="date" value={maintenanceScheduleForm.schedule_date} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, schedule_date: e.target.value })} />
                  </Field>
                  <Field label="장비/창고 선택">
                    <input
                      list="maintenance-equipment-options"
                      value={maintenanceScheduleForm.equipment_name}
                      onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, equipment_name: e.target.value })}
                      placeholder="창고/설비 검색 또는 직접 입력"
                    />
                    <datalist id="maintenance-equipment-options">
                      {maintenanceEquipmentOptions.map((name) => (
                        <option value={name} key={name} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="작업내용">
                    <input value={maintenanceScheduleForm.work_detail} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, work_detail: e.target.value })} placeholder="예: 라이너 교체" />
                  </Field>
                  <Field label="작업자">
                    <input value={maintenanceScheduleForm.worker_name} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, worker_name: e.target.value })} placeholder="작업자" />
                  </Field>
                  <Field label="우선순위">
                    <select value={maintenanceScheduleForm.priority} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, priority: e.target.value })}>
                      <option>긴급</option><option>높음</option><option>보통</option><option>낮음</option>
                    </select>
                  </Field>
                  <Field label="상태">
                    <select value={maintenanceScheduleForm.status} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, status: e.target.value })}>
                      <option>예정</option><option>진행중</option><option>완료</option>
                    </select>
                  </Field>
                </div>

                <div className="schedule-equipment-chips">
                  <span>빠른 선택</span>
                  {(maintenanceEquipmentOptions || []).slice(0, 10).map((name) => (
                    <button
                      type="button"
                      key={name}
                      onClick={() => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, equipment_name: name })}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                <Field label="메모">
                  <textarea value={maintenanceScheduleForm.memo} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, memo: e.target.value })} placeholder="특이사항 / 준비물 / 참고사항" />
                </Field>

                <div className="schedule-pro-actions">
                  <button className="primary" onClick={saveMaintenanceSchedule}>{editingMaintenanceScheduleId ? "수정저장" : "일정저장"}</button>
                  <button onClick={resetMaintenanceScheduleForm}>초기화</button>
                </div>
              </div>

              <div className="schedule-pro-side">
                <div className="schedule-pro-mini-card blue">
                  <span>오늘 일정</span>
                  <b>{maintenanceSchedules.filter((x) => x.schedule_date === getTodayKey()).length}건</b>
                  <small>오늘 등록된 정비 작업</small>
                </div>
                <div className="schedule-pro-mini-card red">
                  <span>긴급 일정</span>
                  <b>{maintenanceSchedules.filter((x) => x.priority === "긴급" && x.status !== "완료").length}건</b>
                  <small>완료되지 않은 긴급 작업</small>
                </div>
                <div className="schedule-pro-mini-card green">
                  <span>완료 일정</span>
                  <b>{maintenanceSchedules.filter((x) => x.status === "완료").length}건</b>
                  <small>누적 완료 작업</small>
                </div>

                <div className="schedule-pro-preview">
                  <div className="schedule-pro-card-title">
                    <b>오늘 작업 미리보기</b>
                    <span>{getTodayKey()}</span>
                  </div>
                  {maintenanceSchedules.filter((x) => x.schedule_date === getTodayKey()).slice(0, 5).length ? (
                    maintenanceSchedules.filter((x) => x.schedule_date === getTodayKey()).slice(0, 5).map((x) => (
                      <div className="schedule-pro-preview-row" key={x.id}>
                        <div>
                          <strong>{x.equipment_name}</strong>
                          <p>{x.work_detail}</p>
                        </div>
                        <span className={`schedule-status ${x.status || "예정"}`}>{x.status || "예정"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="schedule-pro-empty">오늘 등록된 정비일정이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {menuTab === "maintenance_schedules" && (
          <MaintenanceScheduleList
            schedules={maintenanceSchedules}
            isAdmin={canEditDeleteRecords}
            editSchedule={editMaintenanceSchedule}
            deleteSchedule={deleteMaintenanceSchedule}
            updateStatus={updateMaintenanceScheduleStatus}
          />
        )}

        {newItemModal.open && (
          <div className="modal-backdrop">
            <div className="modal-box">
              <h2>신규 품목 추가</h2>
              <div className="grid2">
                <Field label="품목명">
                  <input value={newItemForm.name} onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })} autoFocus />
                </Field>
                <Field label="규격정보">
                  <input value={newItemForm.spec} onChange={(e) => setNewItemForm({ ...newItemForm, spec: e.target.value })} />
                </Field>
                <Field label="단위">
                  <input value={newItemForm.unit} onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })} placeholder="ea" />
                </Field>
                <Field label="입고단가">
                  <input value={newItemForm.price} onChange={(e) => setNewItemForm({ ...newItemForm, price: e.target.value })} placeholder="0" />
                </Field>
              </div>
              <div className="actions right-actions">
                <button onClick={closeNewItemModal}>취소</button>
                <button className="primary" onClick={saveNewItemFromModal}>저장</button>
              </div>
            </div>
          </div>
        )}

        {photoLinkModal.mode && (
          <div className="photo-link-modal-backdrop" onClick={() => setPhotoLinkModal({ mode: "", targetId: "", search: "" })}>
            <div className="photo-link-modal" onClick={(e) => e.stopPropagation()}>
              <div className="photo-link-head">
                <div>
                  <h2>
                    {photoLinkModal.mode === "purchase"
                      ? "입고사진 선택"
                      : photoLinkModal.mode === "maint"
                        ? "정비사진 선택"
                        : photoLinkModal.mode === "recordPurchase"
                          ? "구매내역 선택"
                          : "정비내역 선택"}
                  </h2>
                  <p>
                    {photoLinkModal.mode === "purchase"
                      ? "구매조회 내역에 연결할 입고사진을 선택하세요."
                      : photoLinkModal.mode === "maint"
                        ? "정비조회 내역에 연결할 정비사진을 선택하세요."
                        : photoLinkModal.mode === "recordPurchase"
                          ? "입고사진을 연결할 기존 구매내역을 선택하세요."
                          : "정비사진을 연결할 기존 정비내역을 선택하세요."}
                  </p>
                </div>
                <button onClick={() => setPhotoLinkModal({ mode: "", targetId: "", search: "" })}>닫기</button>
              </div>

              <input
                className="photo-link-search"
                value={photoLinkModal.search}
                onChange={(e) => setPhotoLinkModal({ ...photoLinkModal, search: e.target.value })}
                placeholder="거래처/날짜/품목/창고 검색, 비우면 전체 표시"
              />

              <div className="photo-link-list">
                {photoLinkModal.mode === "purchase" && receiptPhotos
                  .filter((photo) => {
                    const q = photoLinkModal.search.trim();
                    if (!q) return true;
                    return `${photo.receipt_date || ""} ${photo.vendor_name || ""} ${photo.memo || ""}`.includes(q);
                  })
                  .map((photo) => (
                    <button className="photo-link-item" key={photo.id} onClick={() => connectReceiptPhotoToPurchase(photo, photoLinkModal.targetId)}>
                      <div>
                        <strong>{photo.vendor_name || "거래처 미입력"}</strong>
                        <span>{photo.receipt_date} · {photo.is_processed ? "처리완료" : "미처리"}</span>
                        <p>{photo.memo || "-"}</p>
                      </div>
                      <AttachmentGroup urls={photo.image_urls || []} />
                    </button>
                  ))}

                {photoLinkModal.mode === "maint" && maintenancePhotos
                  .filter((photo) => {
                    const q = photoLinkModal.search.trim();
                    if (!q) return true;
                    return `${photo.maint_date || ""} ${photo.equipment_name || ""} ${photo.memo || ""}`.includes(q);
                  })
                  .map((photo) => (
                    <button className="photo-link-item" key={photo.id} onClick={() => connectMaintenancePhotoToMaint(photo, photoLinkModal.targetId)}>
                      <div>
                        <strong>{photo.equipment_name || "설비 미입력"}</strong>
                        <span>{photo.maint_date} · {photo.is_processed ? "처리완료" : "미처리"}</span>
                        <p>{photo.memo || "-"}</p>
                      </div>
                      <AttachmentGroup urls={photo.image_urls || []} />
                    </button>
                  ))}

                {photoLinkModal.mode === "recordPurchase" && purchases
                  .filter((purchase) => {
                    const q = photoLinkModal.search.trim();
                    return matchLooseKeywords(`${purchase.date || ""} ${purchase.vendor || ""} ${purchase.warehouse || ""} ${getPurchaseItemSummary(purchase) || ""}`, q);
                  })
                  .map((purchase) => (
                    <button className="photo-link-item" key={purchase.id} onClick={() => connectPurchaseRecordToReceiptPhoto(purchase, photoLinkModal.targetId)}>
                      <div>
                        <strong>{purchase.vendor || "거래처 미입력"}</strong>
                        <span>{purchase.date || "-"} · {purchase.warehouse || "-"}</span>
                        <p>{getPurchaseItemSummary(purchase)} / {money(purchase.total)}원</p>
                      </div>
                      <AttachmentGroup urls={purchase.image_urls || (purchase.image_url ? [purchase.image_url] : [])} />
                    </button>
                  ))}

                {photoLinkModal.mode === "recordMaint" && maints
                  .filter((maint) => {
                    const q = photoLinkModal.search.trim();
                    return matchLooseKeywords(`${maint.date || ""} ${maint.warehouse || ""} ${maint.title || ""} ${maint.detail || ""}`, q);
                  })
                  .map((maint) => (
                    <button className="photo-link-item" key={maint.id} onClick={() => connectMaintRecordToMaintenancePhoto(maint, photoLinkModal.targetId)}>
                      <div>
                        <strong>{maint.title || "제목 미입력"}</strong>
                        <span>{maint.date || "-"} · {maint.warehouse || "-"}</span>
                        <p>{maint.detail || "-"}</p>
                      </div>
                      <AttachmentGroup urls={maint.image_urls || (maint.image_url ? [maint.image_url] : [])} />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        <div className="mobile-more-sheet" style={{ display: mobileSheet ? "grid" : "none" }}>
          {mobileSheet === "buy" && (
            <>
              {mobileMenuButton("new", "구매입력")}
              {mobileMenuButton("list", "구매조회")}
              {mobileMenuButton("status", "구매현황")}
              {mobileMenuButton("bulk_transfer", "대량이체")}
              {mobileMenuButton("receipt_photos", "입고사진등록")}
              {mobileMenuButton("vendor_accounts", "업체계좌관리")}
            </>
          )}

          {mobileSheet === "card" && (
            <>
              {mobileMenuButton("card_use", "카드사용")}
              {mobileMenuButton("card_list", "카드조회")}
              {mobileMenuButton("card_stats", "카드통계")}
            </>
          )}

          {mobileSheet === "maint" && (
            <>
              {mobileMenuButton("maint_new", "정비등록")}
              {mobileMenuButton("maint_list", "정비조회")}
              {mobileMenuButton("maint_stats", "정비통계")}
              {mobileMenuButton("maintenance_photos", "정비사진등록")}
              {mobileMenuButton("maintenance_schedule_new", "정비일정등록")}
              {mobileMenuButton("maintenance_schedules", "정비일정조회")}
            </>
          )}

          {mobileSheet === "more" && (
            <>
              {mobileMenuButton("site_notices", "공지")}
              {mobileMenuButton("layout", "생산라인")}
              {mobileMenuButton("vendors", "거래처등록")}
              {mobileMenuButton("warehouse_groups", "창고등록")}
              {mobileMenuButton("items", "품목등록")}
              {mobileMenuButton("permits", "허가관리")}
              {isAdmin && <button onClick={() => { setMenuTab("backup_permissions"); setMobileSheet(""); }}>백업/권한관리</button>}
              <button className="mobile-sheet-logout" onClick={logout}>로그아웃</button>
            </>
          )}
        </div>

        <div className="mobile-bottom-nav permission-aware-mobile-nav">
          {canAccessTab("home") && <button className={menuTab === "home" ? "active" : ""} onClick={() => { setMenuTab("home"); setMobileSheet(""); }}>홈</button>}
          {canShowAny(["new", "list", "status", "bulk_transfer", "receipt_photos", "vendor_accounts"]) && (
            <button className={mobileSheet === "buy" || ["new", "list", "status", "bulk_transfer", "receipt_photos", "vendor_accounts"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "buy" ? "" : "buy")}>구매</button>
          )}
          {canShowAny(["card_use", "card_list", "card_stats"]) && (
            <button className={mobileSheet === "card" || ["card_use", "card_list", "card_stats"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "card" ? "" : "card")}>카드</button>
          )}
          {canShowAny(["maint_new", "maint_list", "maint_stats", "maintenance_photos", "maintenance_schedule_new", "maintenance_schedules"]) && (
            <button className={mobileSheet === "maint" || ["maint_new", "maint_list", "maint_stats", "maintenance_photos", "maintenance_schedule_new", "maintenance_schedules"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "maint" ? "" : "maint")}>정비</button>
          )}
          {canShowAny(["site_notices", "layout", "vendors", "warehouse_groups", "items", "permits"]) && (
            <button className={mobileSheet === "more" ? "active" : ""} onClick={() => setMobileSheet((v) => v === "more" ? "" : "more")}>더보기</button>
          )}
        </div>

      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
function ScrollTable({ children }: { children: any }) {
  return <div className="scroll-table">{children}</div>;
}

function PurchaseList({ purchases, search, setSearch, editPurchase, deletePurchase, isAdmin, onLinkPhoto }: any) {
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);

  const openPurchaseDetail = (purchase: Purchase) => {
    if ((purchase.rows || []).length > 1) {
      setDetailPurchase(purchase);
    }
  };

  return <>
    <section className="card lookup-page purchase-lookup-page"><div className="between"><h2>구매조회</h2><button onClick={() => downloadExcel(`구매조회_${todayText()}`, withTotalRow(
  purchases.map((p: Purchase) => ({ 일자: p.date, 거래처: p.vendor, 창고: p.warehouse, 대표품목: getPurchaseItemSummary(p), 공급가액: p.supplyTotal, 부가세액: p.vatTotal, 합계: p.total })),
  { 일자: "총합계", 공급가액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.supplyTotal || 0), 0), 부가세액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.vatTotal || 0), 0), 합계: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.total || 0), 0) }
))}>엑셀 다운로드</button><button onClick={() => downloadPdf(`구매조회_${todayText()}`, "구매조회", withTotalRow(purchases.map((p: Purchase) => ({ 일자: p.date, 거래처: p.vendor, 창고: p.warehouse, 대표품목: getPurchaseItemSummary(p), 공급가액: p.supplyTotal, 부가세액: p.vatTotal, 합계: p.total })), { 일자: "총합계", 공급가액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.supplyTotal || 0), 0), 부가세액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.vatTotal || 0), 0), 합계: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.total || 0), 0) }))}>PDF 출력</button></div><div className="grid5"><input placeholder="시작일 240107 또는 20240107" value={search.from} onChange={(e) => setSearch({ ...search, from: formatInputDate(e.target.value) })} /><input placeholder="종료일 240107 또는 20240107" value={search.to} onChange={(e) => setSearch({ ...search, to: formatInputDate(e.target.value) })} /><input placeholder="거래처 검색" value={search.vendor} onChange={(e) => setSearch({ ...search, vendor: e.target.value })} /><input placeholder="창고 검색" value={search.warehouse} onChange={(e) => setSearch({ ...search, warehouse: e.target.value })} /><input placeholder="품목 검색" value={search.item} onChange={(e) => setSearch({ ...search, item: e.target.value })} /></div><div className="mobile-purchase-cards">
  {!purchases.length ? (
    <div className="empty">저장된 구매내역 없음</div>
  ) : purchases.map((p: Purchase, index: number) => {
    const sameDateBeforeCount = purchases.slice(0, index).filter((x: Purchase) => x.date === p.date).length;
    const seq = sameDateBeforeCount + 1;
    return (
      <div className="mobile-purchase-card" key={`mobile-${p.id}`}>
        <div className="mobile-purchase-card-head">
          <strong>{p.vendor || "거래처 미입력"}</strong>
          <span>{`${p.date || ""}-${String(seq).padStart(2, "0")}`}</span>
        </div>
        <div className="mobile-purchase-card-row"><span>창고</span><b>{p.warehouse || "-"}</b></div>
        <div className="mobile-purchase-card-row"><span>품목</span><b><button className="purchase-item-detail-button" onClick={() => openPurchaseDetail(p)}>{getPurchaseItemSummary(p)}</button></b></div>
        <div className="mobile-purchase-card-row"><span>합계</span><b>{money(p.total)}원</b></div>
        <div className="mobile-purchase-card-row"><span>사진</span><b><AttachmentGroup urls={p.image_urls || (p.image_url ? [p.image_url] : [])} /></b></div>
        {isAdmin && (
          <div className="mobile-purchase-card-actions">
            <button onClick={() => onLinkPhoto(p)}>사진연결</button>
            <button onClick={() => editPurchase(p)}>수정</button>
            <button onClick={() => deletePurchase(p.id)}>삭제</button>
          </div>
        )}
      </div>
    );
  })}
</div><ScrollTable><table><thead><tr><th>관리번호</th><th>거래처</th><th>창고</th><th>품목</th><th>합계</th><th>사진</th><th>관리</th></tr></thead><tbody>{!purchases.length ? <tr><td colSpan={7} className="empty">저장된 구매내역 없음</td></tr> : purchases.map((p: Purchase, index: number) => {
  const sameDateBeforeCount = purchases.slice(0, index).filter((x: Purchase) => x.date === p.date).length;
  const seq = sameDateBeforeCount + 1;
  return <tr key={p.id}><td>{`${p.date || ""}-${String(seq).padStart(2, "0")}`}</td><td>{p.vendor}</td><td>{p.warehouse}</td><td><button className="purchase-item-detail-button" onClick={() => openPurchaseDetail(p)}>{getPurchaseItemSummary(p)}</button></td><td>{money(p.total)}</td><td><AttachmentGroup urls={p.image_urls || (p.image_url ? [p.image_url] : [])} /></td><td>{isAdmin ? <><button className="icon" onClick={() => onLinkPhoto(p)}>사진</button><button className="icon" onClick={() => editPurchase(p)}><Pencil size={16} /></button><button className="icon" onClick={() => deletePurchase(p.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>})}</tbody></table></ScrollTable></section>
    {detailPurchase && (
      <div className="purchase-detail-modal-backdrop" onClick={() => setDetailPurchase(null)}>
        <div className="purchase-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="purchase-detail-modal-head">
            <div>
              <h2>상세 품목</h2>
              <p>{detailPurchase.vendor || "거래처 미입력"} · {detailPurchase.date || "날짜 없음"}</p>
            </div>
            <button onClick={() => setDetailPurchase(null)}>닫기</button>
          </div>
          <ScrollTable>
            <table className="purchase-detail-table">
              <thead>
                <tr><th>품목</th><th>규격</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세액</th><th>합계</th></tr>
              </thead>
              <tbody>
                {(detailPurchase.rows || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.item || "-"}</td>
                    <td>{row.spec || "-"}</td>
                    <td className="right">{money(row.qty)}</td>
                    <td className="right">{money(row.price)}</td>
                    <td className="right">{money(row.supply)}</td>
                    <td className="right">{money(row.vat)}</td>
                    <td className="right">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <div className="purchase-detail-total">
            <span>공급가액 {money(detailPurchase.supplyTotal)}원</span>
            <span>부가세 {money(detailPurchase.vatTotal)}원</span>
            <b>합계 {money(detailPurchase.total)}원</b>
          </div>
        </div>
      </div>
    )}
  </>;
}

function PurchaseStatus({ purchases }: { purchases: Purchase[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vendor, setVendor] = useState("");
  const [item, setItem] = useState("");

  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      const d = p.date || "";
      const okFrom = !from || d >= from;
      const okTo = !to || d <= to;
      const okVendor = !vendor || p.vendor.includes(vendor);
      const okItem = !item || p.rows.some((r) => r.item.includes(item));
      return okFrom && okTo && okVendor && okItem;
    });
  }, [purchases, from, to, vendor, item]);

  const summary = useMemo(() => {
    const totalSupply = filtered.reduce((sum, p) => sum + Number(p.supplyTotal || 0), 0);
    const totalVat = filtered.reduce((sum, p) => sum + Number(p.vatTotal || 0), 0);
    const total = filtered.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const rowCount = filtered.reduce((sum, p) => sum + (p.rows?.length || 0), 0);
    return { totalSupply, totalVat, total, rowCount };
  }, [filtered]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; count: number; supply: number; vat: number; total: number }>();
    filtered.forEach((p) => {
      const month = (p.date || "미지정").slice(0, 7) || "미지정";
      const cur = map.get(month) || { month, count: 0, supply: 0, vat: 0, total: 0 };
      cur.count += 1;
      cur.supply += Number(p.supplyTotal || 0);
      cur.vat += Number(p.vatTotal || 0);
      cur.total += Number(p.total || 0);
      map.set(month, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const byVendor = useMemo(() => {
    const map = new Map<string, { vendor: string; count: number; total: number }>();
    filtered.forEach((p) => {
      const name = p.vendor || "미지정";
      const cur = map.get(name) || { vendor: name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(p.total || 0);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  return (
    <section className="card">
      <div className="between"><h2>구매현황</h2><button onClick={() => downloadExcel(`구매현황_${todayText()}`, withTotalRow(
  filtered.flatMap((p) => (p.rows || []).map((r) => ({ 일자: p.date, 거래처: p.vendor, 창고: p.warehouse, 품목: r.item, 규격: r.spec, 수량: r.qty, 단가: r.price, 공급가액: r.supply, 부가세액: r.vat, 합계: r.total }))),
  {
    일자: "총합계",
    수량: filtered.reduce((sum, p) => sum + (p.rows || []).reduce((s, r) => s + Number(r.qty || 0), 0), 0),
    단가: filtered.reduce((sum, p) => sum + (p.rows || []).reduce((s, r) => s + Number(r.price || 0), 0), 0),
    공급가액: filtered.reduce((sum, p) => sum + Number(p.supplyTotal || 0), 0),
    부가세액: filtered.reduce((sum, p) => sum + Number(p.vatTotal || 0), 0),
    합계: filtered.reduce((sum, p) => sum + Number(p.total || 0), 0)
  }
))}>엑셀 다운로드</button></div>
      <div className="grid5">
        <Field label="시작일"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="종료일"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="거래처"><input placeholder="거래처 일부 검색" value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
        <Field label="품목"><input placeholder="품목 일부 검색" value={item} onChange={(e) => setItem(e.target.value)} /></Field>
        <Field label="초기화"><button onClick={() => { setFrom(""); setTo(""); setVendor(""); setItem(""); }}>검색 초기화</button></Field>
      </div>

      <div className="status-cards">
        <div><span>구매건수</span><b>{filtered.length}건</b></div>
        <div><span>품목행수</span><b>{summary.rowCount}건</b></div>
        <div><span>공급가액</span><b>{money(summary.totalSupply)}원</b></div>
        <div><span>부가세액</span><b>{money(summary.totalVat)}원</b></div>
        <div><span>총합계</span><b>{money(summary.total)}원</b></div>
      </div>

      <h3>월별 구매현황</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>월</th><th>구매건수</th><th>공급가액</th><th>부가세액</th><th>합계</th></tr></thead>
          <tbody>{!monthly.length ? <tr><td colSpan={5} className="empty">조회된 구매현황 없음</td></tr> : monthly.map((m) => <tr key={m.month}><td>{m.month}</td><td>{m.count}</td><td className="right">{money(m.supply)}</td><td className="right">{money(m.vat)}</td><td className="right bold">{money(m.total)}</td></tr>)}</tbody>
        </table>
      </ScrollTable>

      <h3>거래처별 구매현황</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>거래처</th><th>구매건수</th><th>합계</th></tr></thead>
          <tbody>{!byVendor.length ? <tr><td colSpan={3} className="empty">조회된 거래처 없음</td></tr> : byVendor.map((v) => <tr key={v.vendor}><td>{v.vendor}</td><td>{v.count}</td><td className="right bold">{money(v.total)}</td></tr>)}</tbody>
        </table>
      </ScrollTable>

      <h3>상세 구매내역</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>일자</th><th>거래처</th><th>창고</th><th>대표품목</th><th>수량</th><th>공급가액</th><th>부가세액</th><th>합계</th></tr></thead>
          <tbody>{!filtered.length ? <tr><td colSpan={8} className="empty">조회된 구매내역 없음</td></tr> : filtered.map((p) => <tr key={p.id}><td>{p.date}</td><td>{p.vendor}</td><td>{p.warehouse}</td><td>{getPurchaseItemSummary(p)}</td><td className="right">{money((p.rows || []).reduce((sum, r) => sum + Number(r.qty || 0), 0))}</td><td className="right">{money(p.supplyTotal)}</td><td className="right">{money(p.vatTotal)}</td><td className="right bold">{money(p.total)}</td></tr>)}</tbody>
        </table>
      </ScrollTable>
    </section>
  );
}


function MaintenanceScheduleList({ schedules, isAdmin, editSchedule, deleteSchedule, updateStatus }: any) {
  const [from, setFrom] = useState(getTodayKey());
  const [to, setTo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const today = getTodayKey();

  const filtered = useMemo(() => {
    return (schedules || [])
      .filter((item: MaintenanceSchedule) => {
        const d = item.schedule_date || "";
        const okFrom = !from || d >= from;
        const okTo = !to || d <= to;
        const q = `${item.equipment_name || ""} ${item.work_detail || ""} ${item.worker_name || ""} ${item.priority || ""} ${item.status || ""} ${item.memo || ""}`;
        const okKeyword = !keyword || q.includes(keyword);
        const okStatus = !status || item.status === status;
        const okPriority = !priority || item.priority === priority;
        return okFrom && okTo && okKeyword && okStatus && okPriority;
      })
      .sort((a: MaintenanceSchedule, b: MaintenanceSchedule) => {
        const dateCompare = String(a.schedule_date || "").localeCompare(String(b.schedule_date || ""));
        if (dateCompare !== 0) return dateCompare;
        return String(a.created_at || a.id || "").localeCompare(String(b.created_at || b.id || ""));
      });
  }, [schedules, from, to, keyword, status, priority]);

  const todayItems = (schedules || []).filter((x: MaintenanceSchedule) => x.schedule_date === today);
  const progressItems = (schedules || []).filter((x: MaintenanceSchedule) => x.status === "진행중");
  const doneItems = (schedules || []).filter((x: MaintenanceSchedule) => x.status === "완료");
  const urgentItems = (schedules || []).filter((x: MaintenanceSchedule) => x.priority === "긴급" && x.status !== "완료");

  return (
    <section className="maintenance-schedule-pro-list">
      <div className="schedule-list-head">
        <div>
          <span className="schedule-pro-eyebrow">Schedule Lookup</span>
          <h2>정비일정조회</h2>
          <p>등록한 정비일정을 날짜, 상태, 우선순위별로 확인합니다.</p>
        </div>
        <button onClick={() => downloadExcel(`정비일정_${todayText()}`, filtered.map((item: MaintenanceSchedule) => ({
          예정일: item.schedule_date,
          장비명: item.equipment_name,
          작업내용: item.work_detail,
          작업자: item.worker_name || "",
          우선순위: item.priority || "",
          상태: item.status || "",
          메모: item.memo || "",
        })))}>엑셀 다운로드</button>
      </div>

      <div className="schedule-summary-grid">
        <div className="schedule-summary-card blue"><span>오늘 일정</span><b>{todayItems.length}</b><small>오늘 예정/진행/완료</small></div>
        <div className="schedule-summary-card purple"><span>진행중</span><b>{progressItems.length}</b><small>현재 진행 작업</small></div>
        <div className="schedule-summary-card green"><span>완료</span><b>{doneItems.length}</b><small>완료된 작업</small></div>
        <div className="schedule-summary-card red"><span>긴급</span><b>{urgentItems.length}</b><small>미완료 긴급 작업</small></div>
      </div>

      <div className="schedule-filter-card">
        <Field label="시작일"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="종료일"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="검색"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="장비/작업내용/작업자 검색" /></Field>
        <Field label="상태">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">전체</option><option>예정</option><option>진행중</option><option>완료</option>
          </select>
        </Field>
        <Field label="우선순위">
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">전체</option><option>긴급</option><option>높음</option><option>보통</option><option>낮음</option>
          </select>
        </Field>
        <button className="schedule-reset-btn" onClick={() => { setFrom(""); setTo(""); setKeyword(""); setStatus(""); setPriority(""); }}>초기화</button>
      </div>

      <div className="schedule-table-card">
        <ScrollTable>
          <table>
            <thead>
              <tr><th>예정일</th><th>장비명</th><th>작업내용</th><th>작업자</th><th>우선순위</th><th>상태</th><th>메모</th><th>관리</th></tr>
            </thead>
            <tbody>
              {!filtered.length ? (
                <tr><td colSpan={8} className="empty">등록된 정비일정이 없습니다.</td></tr>
              ) : filtered.map((item: MaintenanceSchedule) => (
                <tr key={item.id}>
                  <td className="bold">{item.schedule_date || "-"}</td>
                  <td>{item.equipment_name || "-"}</td>
                  <td>{item.work_detail || "-"}</td>
                  <td>{item.worker_name || "-"}</td>
                  <td><span className={`schedule-priority ${item.priority || "보통"}`}>{item.priority || "보통"}</span></td>
                  <td><span className={`schedule-status ${item.status || "예정"}`}>{item.status || "예정"}</span></td>
                  <td>{item.memo || "-"}</td>
                  <td>{isAdmin ? (
                    <div className="schedule-row-actions">
                      <button onClick={() => editSchedule(item)}>수정</button>
                      <button onClick={() => updateStatus(item, item.status === "완료" ? "예정" : "완료")}>{item.status === "완료" ? "예정" : "완료"}</button>
                      <button className="danger" onClick={() => deleteSchedule(item.id)}>삭제</button>
                    </div>
                  ) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      <div className="mobile-card-list schedule-mobile-list">
        {filtered.map((item: MaintenanceSchedule) => (
          <div className="mobile-list-card" key={`mobile-${item.id}`}>
            <div className="mobile-list-top">
              <b>{item.equipment_name}</b>
              <span>{item.schedule_date}</span>
            </div>
            <div className="mobile-list-body">
              <div><label>작업내용</label><p>{item.work_detail}</p></div>
              <div><label>작업자</label><p>{item.worker_name || "-"}</p></div>
              <div><label>우선순위/상태</label><p>{item.priority || "보통"} / {item.status || "예정"}</p></div>
              <div><label>메모</label><p>{item.memo || "-"}</p></div>
            </div>
            {isAdmin && (
              <div className="mobile-card-actions">
                <button onClick={() => editSchedule(item)}>수정</button>
                <button onClick={() => updateStatus(item, item.status === "완료" ? "예정" : "완료")}>{item.status === "완료" ? "예정" : "완료"}</button>
                <button onClick={() => deleteSchedule(item.id)}>삭제</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}



function MaintList({ maints, search, setSearch, editMaint, deleteMaint, setMenuTab, isAdmin, onLinkPhoto }: any) {
  const [selected, setSelected] = useState<Maint | null>(null);

  const maintNoMap = useMemo(() => {
    const dateCounts = new Map<string, number>();
    const orderedByOldest = [...maints].sort((a, b) => {
      const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    orderedByOldest.forEach((m) => {
      const date = m.date || "날짜없음";
      const nextNo = (dateCounts.get(date) || 0) + 1;
      dateCounts.set(date, nextNo);
    });

    const running = new Map<string, number>();
    const map = new Map<string, string>();

    orderedByOldest.forEach((m) => {
      const date = m.date || "날짜없음";
      const nextNo = (running.get(date) || 0) + 1;
      running.set(date, nextNo);
      const displayDate = date === "날짜없음" ? "날짜없음" : date;
      map.set(m.id, `${displayDate}-${String(nextNo).padStart(2, "0")}`);
    });

    return map;
  }, [maints]);

  return (
    <section className="card lookup-page maint-lookup-page">
      <div className="between" style={{marginBottom:16}}>
        <h2 style={{margin:0}}>정비조회</h2>
        <div style={{display:"flex", gap:8}}>
          <button onClick={() => downloadExcel(`정비조회_${todayText()}`, withTotalRow(
            maints.map((m: Maint) => {
              const supply = Number(m.supplyTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.supply || 0), 0));
              const vat = Number(m.vatTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.vat || 0), 0));
              const total = Number(m.total || m.cost || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0));
              return { 관리번호: maintNoMap.get(m.id) || "", 일자: m.date, 창고: m.warehouse, 제목: m.title, 내용: m.detail, 작업자: m.manager, 공급가액: supply, 부가세: vat, 합계: total };
            }),
            {
              관리번호: "총합계",
              공급가액: maints.reduce((sum: number, m: Maint) => sum + Number(m.supplyTotal || (m.items || []).reduce((s: number, r: any) => s + Number(r.supply || 0), 0)), 0),
              부가세: maints.reduce((sum: number, m: Maint) => sum + Number(m.vatTotal || (m.items || []).reduce((s: number, r: any) => s + Number(r.vat || 0), 0)), 0),
              합계: maints.reduce((sum: number, m: Maint) => sum + Number(m.total || m.cost || (m.items || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)), 0)
            }
          ))}>엑셀 다운로드</button>
          <button className="primary" onClick={() => setMenuTab("maint_new")}>
            <Plus size={16} /> 정비등록
          </button>
        </div>
      </div>

      <div className="maint-filter">
        <Field label="시작일">
          <input type="date" value={search.from || ""} onChange={(e) => setSearch({ ...search, from: e.target.value })} />
        </Field>
        <Field label="종료일">
          <input type="date" value={search.to || ""} onChange={(e) => setSearch({ ...search, to: e.target.value })} />
        </Field>
        <Field label="창고">
          <SearchSelect value={search.warehouse || ""} options={search.warehouseNames || []} onChange={(v) => setSearch({ ...search, warehouse: v })} placeholder="창고 선택/검색" />
        </Field>
        <Field label="제목/내용/작업자">
          <input placeholder="검색어 입력" value={search.keyword || ""} onChange={(e) => setSearch({ ...search, keyword: e.target.value })} />
        </Field>
        <Field label="초기화">
          <button onClick={() => setSearch({ ...search, from: "", to: "", warehouse: "", keyword: "" })}>검색 초기화</button>
        </Field>
      </div>

      <ScrollTable>
        <table>
          <thead>
            <tr>
              <th>관리번호</th>
              <th>창고</th>
              <th>작업자</th>
              <th>제목</th>
              <th>내용</th>
              <th>공급가액</th>
              <th>부가세</th>
              <th>합계</th>
              <th>첨부</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {!maints.length ? (
              <tr><td colSpan={10} className="empty">저장된 정비내역 없음</td></tr>
            ) : (
              maints.map((m: Maint) => {
                const supply = Number(m.supplyTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.supply || 0), 0));
                const vat = Number(m.vatTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.vat || 0), 0));
                const total = Number(m.total || m.cost || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0));
                return (
                  <tr key={m.id}>
                    <td>{maintNoMap.get(m.id) || "-"}</td>
                    <td>{m.warehouse}</td>
                    <td>{m.manager || "-"}</td>
                    <td><button className="link-btn" onClick={() => setSelected(m)}>{m.title}</button></td>
                    <td><span className="maint-detail-text">{m.detail || "-"}</span></td>
                    <td className="right">{money(supply)}</td>
                    <td className="right">{money(vat)}</td>
                    <td className="right bold">{money(total)}</td>
                    <td>
                      <AttachmentGroup urls={m.image_urls || (m.image_url ? [m.image_url] : [])} />
                    </td>
                    <td>
                      {isAdmin ? <>
                        <button className="icon" onClick={() => onLinkPhoto(m)}>사진</button>
                        <button className="icon" onClick={() => editMaint(m)}><Pencil size={16} /></button>
                        <button className="icon" onClick={() => deleteMaint(m.id)}><Trash2 size={16} /></button>
                      </> : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollTable>
      <div className="mobile-card-list mobile-card-list-maints">
        {maints.map((m: Maint, index: number) => {
          const sameDateBeforeCount = maints
            .slice(0, index)
            .filter((x: Maint) => x.date === m.date).length;
          const seq = sameDateBeforeCount + 1;

          const supply = Number(m.supplyTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.supply || 0), 0));
          const vat = Number(m.vatTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.vat || 0), 0));
          const total = Number(m.total || m.cost || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0));

          return (
            <div className="mobile-list-card" key={m.id}>
              <div className="mobile-list-top">
                <b>{`${m.date || ""}-${String(seq).padStart(2, "0")}`}</b>
                <span>{money(total)}원</span>
              </div>

              <div className="mobile-list-body">
                <div><label>창고</label><p>{m.warehouse}</p></div>
                <div><label>작업자</label><p>{m.manager || "-"}</p></div>
                <div><label>제목</label><p>{m.title}</p></div>
                <div><label>내용</label><p>{m.detail || "-"}</p></div>
                <div><label>공급가액 / 부가세</label><p>{money(supply)}원 / {money(vat)}원</p></div>
              </div>

              <div className="mobile-list-attachment">
                <AttachmentGroup urls={m.image_urls || (m.image_url ? [m.image_url] : [])} />
              </div>

              <div className="mobile-card-actions">
                {isAdmin ? (
                  <>
                    <button onClick={() => onLinkPhoto(m)}>사진연결</button>
                    <button onClick={() => editMaint(m)}>수정</button>
                    <button onClick={() => deleteMaint(m.id)}>삭제</button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>


      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-box wide-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{selected.title}</h2>
            <p><b>관리번호:</b> {maintNoMap.get(selected.id) || "-"} / <b>일자:</b> {selected.date} / <b>창고:</b> {selected.warehouse} / <b>작업자:</b> {selected.manager || "-"}</p>
            <p><b>내용:</b> {selected.detail || "-"}</p>
            <div className="maint-modal-attachments">
              <b>첨부:</b>
              <AttachmentGroup urls={selected.image_urls || (selected.image_url ? [selected.image_url] : [])} />
            </div>
            <ScrollTable>
              <table>
                <thead><tr><th>품목</th><th>규격</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계</th></tr></thead>
                <tbody>
                  {!(selected.items || []).length ? (
                    <tr><td colSpan={7} className="empty">사용 품목 없음</td></tr>
                  ) : (
                    (selected.items || []).map((r: any) => (
                      <tr key={r.id || `${r.item}-${r.spec}`}>
                        <td>{r.item}</td>
                        <td>{r.spec || "-"}</td>
                        <td className="right">{r.qty}</td>
                        <td className="right">{money(r.price)}</td>
                        <td className="right">{money(r.supply)}</td>
                        <td className="right">{money(r.vat)}</td>
                        <td className="right bold">{money(r.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollTable>
            <div className="actions right-actions"><button onClick={() => setSelected(null)}>닫기</button></div>
          </div>
        </div>
      )}
    </section>
  );
}





function AttachmentPreview({ url }: { url?: string }) {
  if (!url) return <span>-</span>;

  const cleanUrl = String(url || "");
  const isPdf = cleanUrl.toLowerCase().includes(".pdf");

  return (
    <a
      href={cleanUrl}
      target="_blank"
      rel="noreferrer"
      className="attachment-preview"
    >
      {isPdf ? (
        <div className="pdf-thumb">PDF</div>
      ) : (
        <img src={cleanUrl} alt="첨부파일" />
      )}
    </a>
  );
}


function AttachmentGroup({ urls }: { urls?: string[] }) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return <span>-</span>;

  return (
    <div className="attachment-group">
      {list.map((url, idx) => (
        <div className="attachment-group-item" key={`${url}-${idx}`}>
          <AttachmentPreview url={url} />
        </div>
      ))}
    </div>
  );
}


function Home({
  setMenuTab,
  setMaintSearch,
  warehouses,
  isAdmin,
}: {
  setMenuTab: (tab: string) => void;
  setMaintSearch: (value: any) => void;
  warehouses: Warehouse[];
  isAdmin: boolean;
}) {
  const hotspotTableName = "layout_hotspots";
  const [editLayout, setEditLayout] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState("");
  const [resizingHotspot, setResizingHotspot] = useState("");
  const [layoutDevice, setLayoutDevice] = useState<"pc" | "mobile">(() =>
    window.innerWidth <= 900 ? "mobile" : "pc"
  );
  const [hotspotLinks, setHotspotLinks] = useState<any[]>([]);
  const [layoutMessage, setLayoutMessage] = useState("");

  const crusherWarehouses = (warehouses || [])
    .filter((w) => w.group === "크라샤")
    .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));

  const defaultHotspots = crusherWarehouses.map((w, index) => {
    const col = index % 8;
    const row = Math.floor(index / 8);

    return {
      name: w.name,
      left: Number((12 + col * 10.5).toFixed(2)),
      top: Number((22 + row * 10).toFixed(2)),
      width: 8.5,
      height: 5.8,
      device: layoutDevice,
    };
  });

  const activeHotspots = (() => {
    const savedList = Array.isArray(hotspotLinks) ? hotspotLinks : [];
    const savedMap = new Map(
      savedList
        .filter((x: any) => x.device === layoutDevice)
        .map((x: any) => [x.name, x])
    );

    return defaultHotspots.map((spot) => ({
      ...spot,
      ...(savedMap.get(spot.name) || {}),
      device: layoutDevice,
    }));
  })();

  const loadHotspotLayout = async (device = layoutDevice) => {
    const { data, error } = await supabase
      .from(hotspotTableName)
      .select("*")
      .eq("page", "crusher")
      .eq("device", device)
      .order("name", { ascending: true });

    if (error) {
      setLayoutMessage(`좌표 불러오기 실패: ${error.message}`);
      return;
    }

    const loaded = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      left: Number(row.left || 0),
      top: Number(row.top || 0),
      width: Number(row.width || 8),
      height: Number(row.height || 5),
      device: row.device || device,
    }));

    setHotspotLinks((prev: any[]) => {
      const otherDevice = (prev || []).filter((x: any) => x.device !== device);
      return [...otherDevice, ...loaded];
    });

    setLayoutMessage(`${device === "mobile" ? "모바일" : "PC"} 좌표 불러오기 완료`);
  };

  useEffect(() => {
    loadHotspotLayout(layoutDevice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutDevice, warehouses.length]);

  const openMaintHistory = (warehouseName: string) => {
    if (editLayout) return;

    setMaintSearch((prev: any) => ({
      ...prev,
      from: "",
      to: "",
      warehouse: warehouseName,
      keyword: "",
    }));
    setMenuTab("maint_list");
  };

  const updateHotspot = (name: string, patch: any) => {
    setSelectedHotspot(name);

    setHotspotLinks((prev: any[]) => {
      const base = activeHotspots;
      const current = base.find((x: any) => x.name === name);
      const nextMap = new Map((prev || []).map((x: any) => [`${x.device}:${x.name}`, x]));
      const key = `${layoutDevice}:${name}`;

      nextMap.set(key, {
        ...(current || {}),
        ...(nextMap.get(key) || {}),
        ...patch,
        device: layoutDevice,
      });

      const currentDeviceRows = base.map((x: any) => ({
        ...x,
        ...(nextMap.get(`${layoutDevice}:${x.name}`) || {}),
        device: layoutDevice,
      }));

      const otherRows = (prev || []).filter((x: any) => x.device !== layoutDevice);
      return [...otherRows, ...currentDeviceRows];
    });
  };

  const moveHotspot = (name: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!editLayout) return;

    e.preventDefault();
    e.stopPropagation();

    const map = e.currentTarget.closest(".layout-map") as HTMLElement | null;
    if (!map) return;

    const rect = map.getBoundingClientRect();
    const nextLeft = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width) * 100));
    const nextTop = Math.min(98, Math.max(2, ((e.clientY - rect.top) / rect.height) * 100));

    updateHotspot(name, {
      left: Number(nextLeft.toFixed(2)),
      top: Number(nextTop.toFixed(2)),
    });
  };

  const resizeHotspotByPointer = (name: string, e: React.PointerEvent<HTMLSpanElement>) => {
    if (!editLayout) return;

    e.preventDefault();
    e.stopPropagation();

    const map = e.currentTarget.closest(".layout-map") as HTMLElement | null;
    if (!map) return;

    const rect = map.getBoundingClientRect();
    const spot = activeHotspots.find((x: any) => x.name === name);
    if (!spot) return;

    const leftPx = (Number(spot.left || 0) / 100) * rect.width;
    const topPx = (Number(spot.top || 0) / 100) * rect.height;
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    const nextWidth = Math.min(28, Math.max(2.5, (Math.abs(pointerX - leftPx) * 2 / rect.width) * 100));
    const nextHeight = Math.min(24, Math.max(2.5, (Math.abs(pointerY - topPx) * 2 / rect.height) * 100));

    updateHotspot(name, {
      width: Number(nextWidth.toFixed(2)),
      height: Number(nextHeight.toFixed(2)),
    });
  };

  const resizeSelectedHotspot = (mode: "w+" | "w-" | "h+" | "h-") => {
    if (!selectedHotspot) {
      alert("먼저 조정할 칸을 선택하세요.");
      return;
    }

    const current = activeHotspots.find((x: any) => x.name === selectedHotspot);
    if (!current) return;

    const next = { ...current };

    if (mode === "w+") next.width = Math.min(24, Number((next.width + 0.8).toFixed(2)));
    if (mode === "w-") next.width = Math.max(2.5, Number((next.width - 0.8).toFixed(2)));
    if (mode === "h+") next.height = Math.min(20, Number((next.height + 0.8).toFixed(2)));
    if (mode === "h-") next.height = Math.max(2.5, Number((next.height - 0.8).toFixed(2)));

    updateHotspot(selectedHotspot, next);
  };

  const saveHotspotLayout = async () => {
    const rows = activeHotspots.map((spot: any) => ({
      page: "crusher",
      device: layoutDevice,
      name: spot.name,
      left: Number(spot.left || 0),
      top: Number(spot.top || 0),
      width: Number(spot.width || 0),
      height: Number(spot.height || 0),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from(hotspotTableName)
      .upsert(rows, { onConflict: "page,device,name" });

    if (error) {
      alert(`좌표 저장 실패: ${error.message}`);
      return;
    }

    setLayoutMessage(`${layoutDevice === "mobile" ? "모바일" : "PC"} 좌표 DB 저장 완료`);
    alert("생산라인 클릭영역 좌표를 DB에 저장했습니다.");
  };

  const copyPcToMobile = async () => {
    const { data, error } = await supabase
      .from(hotspotTableName)
      .select("*")
      .eq("page", "crusher")
      .eq("device", "pc");

    if (error) {
      alert(`PC 좌표 불러오기 실패: ${error.message}`);
      return;
    }

    const rows = (data || []).map((row: any) => ({
      page: "crusher",
      device: "mobile",
      name: row.name,
      left: Number(row.left || 0),
      top: Number(row.top || 0),
      width: Number(row.width || 0),
      height: Number(row.height || 0),
      updated_at: new Date().toISOString(),
    }));

    const { error: saveError } = await supabase
      .from(hotspotTableName)
      .upsert(rows, { onConflict: "page,device,name" });

    if (saveError) {
      alert(`모바일 좌표 저장 실패: ${saveError.message}`);
      return;
    }

    setLayoutDevice("mobile");
    await loadHotspotLayout("mobile");
    setLayoutMessage("PC 좌표를 모바일 좌표로 복사했습니다.");
  };

  const resetHotspotLayout = async () => {
    if (!confirm(`${layoutDevice === "mobile" ? "모바일" : "PC"} 좌표를 초기화할까요?`)) return;

    const { error } = await supabase
      .from(hotspotTableName)
      .delete()
      .eq("page", "crusher")
      .eq("device", layoutDevice);

    if (error) {
      alert(`좌표 초기화 실패: ${error.message}`);
      return;
    }

    setHotspotLinks((prev: any[]) => (prev || []).filter((x: any) => x.device !== layoutDevice));
    setSelectedHotspot("");
    setLayoutMessage(`${layoutDevice === "mobile" ? "모바일" : "PC"} 좌표 초기화 완료`);
  };

  return (
    <section className="card">
      <div className="between">
        <h2>생산라인 구성도</h2>

        {isAdmin && (
          <div className="layout-edit-actions">
            <button onClick={() => setEditLayout((v) => !v)}>
              {editLayout ? "위치조정 끄기" : "위치조정"}
            </button>

            {editLayout && (
              <>
                <button onClick={() => setLayoutDevice("pc")}>PC</button>
                <button onClick={() => setLayoutDevice("mobile")}>모바일</button>
                <button onClick={() => resizeSelectedHotspot("w+")}>가로 +</button>
                <button onClick={() => resizeSelectedHotspot("w-")}>가로 -</button>
                <button onClick={() => resizeSelectedHotspot("h+")}>세로 +</button>
                <button onClick={() => resizeSelectedHotspot("h-")}>세로 -</button>
                <button onClick={copyPcToMobile}>PC→모바일 복사</button>
                <button className="primary" onClick={saveHotspotLayout}>DB 저장</button>
                <button onClick={resetHotspotLayout}>초기화</button>
              </>
            )}
          </div>
        )}
      </div>

      {editLayout && (
        <div className="layout-edit-guide">
          현재 <b>{layoutDevice === "mobile" ? "모바일용" : "PC용"}</b> 좌표를 조정 중입니다.
          네모를 드래그해서 위치를 맞추고, 선택 후 가로/세로 버튼으로 크기를 조정하세요.
          {selectedHotspot ? <b> 선택됨: {selectedHotspot}</b> : null}
          {layoutMessage ? <strong>{layoutMessage}</strong> : null}
        </div>
      )}

      <div className={editLayout ? "layout-map editing" : "layout-map"}>
        <img src="/line-layout.png" alt="생산라인 구성도" />

        {activeHotspots.map((spot: any) => (
          <button
            key={spot.name}
            className={selectedHotspot === spot.name ? "layout-hotspot selected" : "layout-hotspot"}
            style={{
              left: `${spot.left}%`,
              top: `${spot.top}%`,
              width: `${spot.width}%`,
              height: `${spot.height}%`,
            }}
            title={`${spot.name} 정비이력 보기`}
            onPointerDown={(e) => {
              if (editLayout) {
                e.currentTarget.setPointerCapture(e.pointerId);
                setSelectedHotspot(spot.name);
                moveHotspot(spot.name, e);
              }
            }}
            onPointerMove={(e) => {
              if (editLayout && e.currentTarget.hasPointerCapture(e.pointerId)) {
                moveHotspot(spot.name, e);
              }
            }}
            onPointerUp={(e) => {
              if (editLayout && e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={(e) => {
              if (editLayout && e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onClick={(e) => {
              if (editLayout) {
                e.preventDefault();
                e.stopPropagation();
                setSelectedHotspot(spot.name);
                return;
              }

              openMaintHistory(spot.name);
            }}
          >
            <span>{spot.name}</span>
            {editLayout && selectedHotspot === spot.name && (
              <i
                className="layout-resize-handle"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setResizingHotspot(spot.name);
                  resizeHotspotByPointer(spot.name, e);
                }}
                onPointerMove={(e) => {
                  if (resizingHotspot === spot.name && e.currentTarget.hasPointerCapture(e.pointerId)) {
                    resizeHotspotByPointer(spot.name, e);
                  }
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                  setResizingHotspot("");
                }}
                onPointerCancel={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                  setResizingHotspot("");
                }}
              />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}



function SiteNoticePage({
  siteNotices,
  allSiteNotices,
  userPermissions = [],
  siteNoticeForm,
  setSiteNoticeForm,
  editingSiteNoticeId,
  saveSiteNotice,
  editSiteNotice,
  deleteSiteNotice,
  siteNoticeError,
  isAdmin,
}: any) {
  const activeNotices = isAdmin ? (allSiteNotices || siteNotices || []) : (siteNotices || []);
  const urgentCount = activeNotices.filter((n: SiteNotice) => n.priority === "긴급").length;
  const noticeTargetRoles = siteNoticeForm.target_roles || ["all"];
  const noticeTargetEmails = siteNoticeForm.target_emails || [];
  const noticeEmployees = (userPermissions || []).filter((u: UserPermission) => !!u.email);

  const toggleNoticeTargetRole = (role: string) => {
    let nextRoles = [...noticeTargetRoles];

    if (role === "all") {
      nextRoles = nextRoles.includes("all") ? [] : ["all"];
    } else {
      nextRoles = nextRoles.filter((item) => item !== "all");
      nextRoles = nextRoles.includes(role) ? nextRoles.filter((item) => item !== role) : [...nextRoles, role];
    }

    setSiteNoticeForm({ ...siteNoticeForm, target_roles: nextRoles.length ? nextRoles : ["all"] });
  };

  const toggleNoticeTargetEmail = (email: string) => {
    const nextEmails = noticeTargetEmails.includes(email)
      ? noticeTargetEmails.filter((item: string) => item !== email)
      : [...noticeTargetEmails, email];

    setSiteNoticeForm({ ...siteNoticeForm, target_roles: noticeTargetRoles.filter((item: string) => item !== "all"), target_emails: nextEmails });
  };

  const targetLabel = (notice: SiteNotice) => {
    const roles = notice.target_roles || ["all"];
    const emails = notice.target_emails || [];
    if (roles.includes("all") || (!roles.length && !emails.length)) return "전체 직원";
    const roleLabels = roles.map((role) => role === "office" ? "사무실직원" : role === "field" ? "현장직원" : role).filter(Boolean);
    return [...roleLabels, ...emails].join(", ") || "전체 직원";
  };

  return (
    <section className="site-notice-modern-page">
      <div className="site-notice-modern-head">
        <div>
          <span>NOTICE</span>
          <h2>공지</h2>
          <p>현장 공유사항을 등록하면 홈 대시보드와 공지 메뉴에 계속 표시됩니다.</p>
        </div>
        <div className="site-notice-modern-summary">
          <b>{activeNotices.length}</b>
          <em>공지</em>
          <strong>{urgentCount} 긴급</strong>
        </div>
      </div>

      {siteNoticeError && (
        <div className="site-notice-error">
          공지 불러오기 실패: {siteNoticeError}
          <br />
          Supabase에 site_notices 테이블을 먼저 만들어야 합니다.
        </div>
      )}

      {isAdmin && (
        <div className="site-notice-editor-card">
          <div className="site-notice-editor-title">
            <div>
              <h3>{editingSiteNoticeId ? "공지 수정" : "공지 등록"}</h3>
              <p>내리지 않는 이상 계속 표시됩니다. 날짜는 입력하지 않아도 됩니다.</p>
            </div>
            <select value={siteNoticeForm.priority} onChange={(e) => setSiteNoticeForm({ ...siteNoticeForm, priority: e.target.value })}>
              <option>긴급</option>
              <option>중요</option>
              <option>보통</option>
            </select>
          </div>

          <input
            className="site-notice-title-input"
            value={siteNoticeForm.title}
            onChange={(e) => setSiteNoticeForm({ ...siteNoticeForm, title: e.target.value })}
            placeholder="공지 제목"
          />

          <textarea
            className="site-notice-content-input"
            value={siteNoticeForm.content}
            onChange={(e) => setSiteNoticeForm({ ...siteNoticeForm, content: e.target.value })}
            placeholder="공지 내용을 입력하세요. 예: 내일 오전 세륜기 점검 / 전 직원 출차 전 세륜 필수"
          />

          <div className="site-notice-target-box">
            <strong>공지 볼 직원 선택</strong>
            <div className="site-notice-target-checks">
              <label>
                <input type="checkbox" checked={noticeTargetRoles.includes("all")} onChange={() => toggleNoticeTargetRole("all")} />
                <span>전체 직원</span>
              </label>
              <label>
                <input type="checkbox" checked={noticeTargetRoles.includes("office")} onChange={() => toggleNoticeTargetRole("office")} />
                <span>사무실직원</span>
              </label>
              <label>
                <input type="checkbox" checked={noticeTargetRoles.includes("field")} onChange={() => toggleNoticeTargetRole("field")} />
                <span>현장직원</span>
              </label>
            </div>
            {!!noticeEmployees.length && (
              <div className="site-notice-target-emails">
                {noticeEmployees.map((user: UserPermission) => (
                  <label key={user.email}>
                    <input type="checkbox" checked={noticeTargetEmails.includes(user.email)} onChange={() => toggleNoticeTargetEmail(user.email)} />
                    <span>{user.email}</span>
                    <em>{user.role === "field" ? "현장" : "사무실"}</em>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="site-notice-editor-actions">
            <button className="primary" onClick={saveSiteNotice}>{editingSiteNoticeId ? "수정 저장" : "공지 저장"}</button>
            <button onClick={() => setSiteNoticeForm({ title: "", content: "", priority: "보통", is_active: true, target_roles: ["all"], target_emails: [] })}>초기화</button>
          </div>
        </div>
      )}

      <div className="site-notice-modern-list">
        {activeNotices.length ? activeNotices.map((notice: SiteNotice) => (
          <article className={`site-notice-modern-card ${notice.priority || "보통"}`} key={notice.id}>
            <div className="site-notice-modern-card-top">
              {isAdmin && <small>대상: {targetLabel(notice)}</small>}
            </div>
            <h3>{notice.title}</h3>
            <p>{notice.content}</p>
            {isAdmin && (
              <div className="site-notice-modern-actions">
                <button onClick={() => editSiteNotice(notice)}>수정</button>
                <button className="danger" onClick={() => deleteSiteNotice(notice.id)}>내리기</button>
              </div>
            )}
          </article>
        )) : (
          <div className="site-notice-modern-empty">등록된 공지가 없습니다.</div>
        )}
      </div>
    </section>
  );
}



function BackupPermissionPage({
  purchases,
  maints,
  cardUses,
  vendors,
  groups,
  warehouses,
  items,
  permits,
  vendorAccounts,
  receiptPhotos,
  maintenancePhotos,
  maintenanceSchedules,
  updateNotices,
  userPermissions,
  permissionForm,
  setPermissionForm,
  saveUserPermission,
  deleteUserPermission,
  loadAll,
  loadPermits,
  loadVendorAccounts,
  loadReceiptPhotos,
  loadMaintenancePhotos,
  loadMaintenanceSchedules,
  loadUserPermissions,
}: any) {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const backupPayload = {
    backup_version: "taemyung-erp-v1",
    exported_at: new Date().toISOString(),
    data: {
      purchases,
      maints,
      cardUses,
      vendors,
      groups,
      warehouses,
      items,
      permits,
      vendorAccounts,
      receiptPhotos,
      maintenancePhotos,
      maintenanceSchedules,
      updateNotices,
      userPermissions,
    },
  };

  const downloadJsonBackup = () => {
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taemyung_erp_backup_${todayText()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcelBackup = () => {
    downloadExcel(`전체백업_${todayText()}`, [
      { 구분: "구매", 건수: purchases.length },
      { 구분: "정비", 건수: maints.length },
      { 구분: "카드", 건수: cardUses.length },
      { 구분: "거래처", 건수: vendors.length },
      { 구분: "창고대분류", 건수: groups.length },
      { 구분: "창고", 건수: warehouses.length },
      { 구분: "품목", 건수: items.length },
      { 구분: "허가관리", 건수: permits.length },
      { 구분: "업체계좌", 건수: vendorAccounts.length },
      { 구분: "입고사진", 건수: receiptPhotos.length },
      { 구분: "정비사진", 건수: maintenancePhotos.length },
      { 구분: "정비일정", 건수: maintenanceSchedules.length },
      { 구분: "권한", 건수: userPermissions.length },
    ]);
  };

  const restoreJsonBackup = async () => {
    if (!restoreFile) return alert("복구할 JSON 백업 파일을 선택하세요.");
    if (!confirm("선택한 백업 파일로 복구합니다. 같은 id 데이터는 덮어씁니다. 진행할까요?")) return;

    setRestoreBusy(true);

    try {
      const raw = await restoreFile.text();
      const parsed = JSON.parse(raw);
      const data = parsed.data || parsed;

      const restoreMap: Array<[string, any[] | undefined]> = [
        ["vendors", data.vendors],
        ["warehouse_groups", data.groups],
        ["warehouses", data.warehouses],
        ["items", data.items],
        ["purchases", data.purchases],
        ["maints", data.maints],
        ["card_uses", data.cardUses],
        ["permit_renewals", data.permits],
        ["vendor_accounts", data.vendorAccounts],
        ["receipt_photos", data.receiptPhotos],
        ["maintenance_photos", data.maintenancePhotos],
        ["maintenance_schedules", data.maintenanceSchedules],
        ["update_notices", data.updateNotices],
        ["user_permissions", data.userPermissions],
      ];

      for (const [table, rows] of restoreMap) {
        if (!Array.isArray(rows) || !rows.length) continue;
        const { error } = await supabase.from(table).upsert(rows);
        if (error) throw new Error(`${table} 복구 실패: ${error.message}`);
      }

      await Promise.all([
        loadAll(),
        loadPermits(),
        loadVendorAccounts(),
        loadReceiptPhotos(),
        loadMaintenancePhotos(),
        loadMaintenanceSchedules(),
        loadUserPermissions(),
      ]);

      alert("백업 복구가 완료되었습니다.");
      setRestoreFile(null);
    } catch (error: any) {
      alert(error?.message || "백업 복구 중 오류가 발생했습니다.");
    } finally {
      setRestoreBusy(false);
    }
  };

  const togglePermission = (key: string) => {
    const current = permissionForm.permissions || {};
    setPermissionForm({
      ...permissionForm,
      permissions: { ...current, [key]: !current[key] },
    });
  };

  const editPermission = (item: UserPermission) => {
    setPermissionForm({
      id: item.id || uid(),
      email: item.email || "",
      role: item.role || "field",
      permissions: item.permissions || {},
    });
  };

  return (
    <section className="backup-permission-page">
      <div className="backup-permission-hero">
        <div>
          <span>System Control</span>
          <h2>백업 / 권한관리</h2>
          <p>전체 데이터를 인터넷 저장 기준으로 백업하고, 직원 권한과 공지 접근을 관리합니다.</p>
        </div>
      </div>

      <div className="backup-permission-grid">
        <div className="backup-card">
          <h3>전체 백업</h3>
          <p>현재 ERP 주요 데이터를 JSON 파일로 내려받습니다. 복구용은 JSON을 사용하세요.</p>
          <div className="backup-stat-grid">
            <div><b>{purchases.length}</b><span>구매</span></div>
            <div><b>{maints.length}</b><span>정비</span></div>
            <div><b>{cardUses.length}</b><span>카드</span></div>
            <div><b>{maintenanceSchedules.length}</b><span>정비일정</span></div>
          </div>
          <div className="backup-actions">
            <button className="primary" onClick={downloadJsonBackup}>JSON 백업 다운로드</button>
            <button onClick={downloadExcelBackup}>백업 요약 엑셀</button>
          </div>
        </div>

        <div className="backup-card danger-zone">
          <h3>백업 복구</h3>
          <p>JSON 백업 파일을 선택하면 같은 ID 데이터는 덮어씁니다. 실행 전 한 번 더 백업하세요.</p>
          <input type="file" accept="application/json,.json" onChange={(e) => setRestoreFile(e.target.files?.[0] || null)} />
          <button className="danger" disabled={restoreBusy} onClick={restoreJsonBackup}>
            {restoreBusy ? "복구 중..." : "JSON 백업 복구"}
          </button>
        </div>
      </div>

      <div className="permission-card">
        <div className="permission-head">
          <div>
            <h3>직원 권한관리</h3>
            <p>관리자: 전체 가능 / 사무실직원: 수정·삭제 제외 대부분 가능 / 현장직원: 체크한 메뉴만 가능. 홈도 체크해야 보입니다.</p>
          </div>
        </div>

        <div className="permission-form">
          <Field label="직원 이메일">
            <input value={permissionForm.email} onChange={(e) => setPermissionForm({ ...permissionForm, email: e.target.value })} placeholder="직원 이메일" />
          </Field>
          <Field label="권한 단계">
            <select value={permissionForm.role} onChange={(e) => setPermissionForm({ ...permissionForm, role: e.target.value as UserRole })}>
              <option value="office">사무실직원</option>
              <option value="field">현장직원</option>
            </select>
          </Field>
          <button className="primary" onClick={() => saveUserPermission()}>권한 저장</button>
        </div>

        {permissionForm.role === "field" && (
          <div className="permission-checks">
            {ERP_PERMISSION_MODULES.map((m) => (
              <label key={m.key}>
                <input type="checkbox" checked={!!permissionForm.permissions?.[m.key]} onChange={() => togglePermission(m.key)} />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
        )}

        <div className="permission-list">
          {userPermissions.map((item: UserPermission) => (
            <div className="permission-row" key={item.email}>
              <div>
                <b>{item.email}</b>
                <span>{item.role === "office" ? "사무실직원" : item.role === "field" ? "현장직원" : "관리자"}</span>
              </div>
              <em>{item.role === "field" ? `${Object.values(item.permissions || {}).filter(Boolean).length}개 메뉴 허용` : "수정·삭제 제외 가능"}</em>
              <button onClick={() => editPermission(item)}>수정</button>
              <button className="danger" onClick={() => deleteUserPermission(item.email)}>삭제</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function HomeDashboard({
  purchases,
  maints,
  cardUses,
  maintenanceSchedules = [],
  receiptPhotos = [],
  maintenancePhotos = [],
  siteNotices = [],
  setMenuTab,
}: {
  purchases: Purchase[];
  maints: Maint[];
  cardUses: CardUse[];
  maintenanceSchedules?: MaintenanceSchedule[];
  receiptPhotos?: ReceiptPhoto[];
  maintenancePhotos?: MaintenancePhoto[];
  siteNotices?: SiteNotice[];
  setMenuTab?: (tab: string) => void;
}) {
  const today = getTodayKey();
  const todayPurchases = purchases.filter((p) => p.date === today);
  const todayCards = cardUses.filter((c) => c.date === today);
  const todayMaints = maints.filter((m) => m.date === today);
  const todaySchedules = maintenanceSchedules.filter((x) => x.schedule_date === today && x.status !== "완료");
  const urgentSchedules = maintenanceSchedules.filter((x) => x.priority === "긴급" && x.status !== "완료");
  const unprocessedReceiptPhotos = receiptPhotos.filter((x) => !x.is_processed);
  const unprocessedMaintenancePhotos = maintenancePhotos.filter((x) => !x.is_processed);
  const warningCount = urgentSchedules.length + unprocessedReceiptPhotos.length + unprocessedMaintenancePhotos.length;
  const activeNotices = (siteNotices || []).filter((n) => n.is_active !== false).slice(0, 5);
  const recentPurchases = [...purchases].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);
  const recentCards = [...cardUses].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);
  const recentMaints = [...maints].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);

  const todayPurchaseTotal = todayPurchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const todayCardTotal = todayCards.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const todayMaintTotal = todayMaints.reduce((sum, m) => sum + Number(m.total || m.cost || 0), 0);

  const kpiCards = [
    { label: "오늘 구매 등록", value: `${todayPurchases.length}건`, sub: `금액 ${money(todayPurchaseTotal)}원`, icon: "🛒", tone: "blue", tab: "new" },
    { label: "오늘 카드사용", value: `${todayCards.length}건`, sub: `금액 ${money(todayCardTotal)}원`, icon: "💳", tone: "green", tab: "card_use" },
    { label: "오늘 정비 등록", value: `${todayMaints.length}건`, sub: `일정 ${todaySchedules.length}건`, icon: "🔧", tone: "purple", tab: "maint_new" },
    { label: "확인 필요", value: `${warningCount}건`, sub: "미처리/긴급 등록", icon: "⚠️", tone: "red", tab: "maintenance_photos" },
  ];

  return (
    <section className="modern-home-shell">
      <div className="modern-home-intro">
        <div>
          <h2>관리자님, 오늘도 안전한 하루 되세요!</h2>
          <p>구매 · 카드 · 정비 · 공지 현황을 한 화면에서 확인합니다.</p>
        </div>
        <button onClick={() => window.location.reload()}>↻ 새로고침</button>
      </div>

      <div className="modern-home-kpis">
        {kpiCards.map((card) => (
          <button className={`modern-home-kpi ${card.tone}`} key={card.label} onClick={() => setMenuTab?.(card.tab)}>
            <span className="modern-home-kpi-icon">{card.icon}</span>
            <span className="modern-home-kpi-text">
              <em>{card.label}</em>
              <b>{card.value}</b>
              <small>{card.sub}</small>
            </span>
            <i>자세히 보기 ›</i>
          </button>
        ))}
      </div>

      <div className="modern-home-grid middle">
        <div className="modern-home-panel">
          <div className="modern-home-panel-head">
            <h3>공지사항</h3>
            <button onClick={() => setMenuTab?.("site_notices")}>더보기 ›</button>
          </div>
          <div className="modern-home-list">
            {activeNotices.length ? activeNotices.map((notice) => (
              <button className="modern-home-notice-row" key={notice.id} onClick={() => setMenuTab?.("site_notices")}>
                <span>NEW</span>
                <b>{notice.title || "제목 없음"}</b>
                <em>{(notice.created_at || notice.notice_date || "").slice(0, 10)}</em>
              </button>
            )) : <div className="modern-home-empty">등록된 공지가 없습니다.</div>}
          </div>
        </div>

        <div className="modern-home-panel">
          <div className="modern-home-panel-head">
            <h3>오늘 정비 일정</h3>
            <button onClick={() => setMenuTab?.("maintenance_schedules")}>더보기 ›</button>
          </div>
          <div className="modern-home-schedule-list">
            {todaySchedules.length ? todaySchedules.slice(0, 4).map((s) => (
              <button className="modern-home-schedule-row" key={s.id} onClick={() => setMenuTab?.("maintenance_schedules")}>
                <span>◷</span>
                <div>
                  <b>{s.equipment_name || "장비명 없음"}</b>
                  <p>{s.work_detail || "작업내용 없음"}{s.worker_name ? ` / 정비담당: ${s.worker_name}` : ""}</p>
                </div>
              </button>
            )) : <div className="modern-home-empty">오늘 등록된 정비일정이 없습니다.</div>}
          </div>
        </div>

        <div className="modern-home-panel alert-panel">
          <div className="modern-home-panel-head">
            <h3>확인 필요</h3>
            <button onClick={() => setMenuTab?.("maintenance_photos")}>더보기 ›</button>
          </div>
          <div className="modern-home-alert-list">
            <button onClick={() => setMenuTab?.("receipt_photos")}><b>입고사진 미처리</b><span>{unprocessedReceiptPhotos.length}건</span></button>
            <button onClick={() => setMenuTab?.("maintenance_photos")}><b>정비사진 미처리</b><span>{unprocessedMaintenancePhotos.length}건</span></button>
            <button onClick={() => setMenuTab?.("maintenance_schedules")}><b>긴급 정비 요청</b><span>{urgentSchedules.length}건</span></button>
          </div>
        </div>
      </div>

      <div className="modern-home-grid bottom">
        <div className="modern-home-panel">
          <div className="modern-home-panel-head">
            <h3>최근 구매 내역</h3>
            <button onClick={() => setMenuTab?.("list")}>더보기 ›</button>
          </div>
          <table className="modern-home-table">
            <thead><tr><th>날짜</th><th>거래처</th><th>품목</th><th>금액</th></tr></thead>
            <tbody>
              {recentPurchases.length ? recentPurchases.map((p) => (
                <tr key={p.id}>
                  <td>{(p.date || "").slice(5) || "-"}</td>
                  <td>{p.vendor || "-"}</td>
                  <td>{getPurchaseItemSummary(p)}</td>
                  <td>{money(p.total)}원</td>
                </tr>
              )) : <tr><td colSpan={4}>구매내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="modern-home-panel">
          <div className="modern-home-panel-head">
            <h3>최근 카드사용 내역</h3>
            <button onClick={() => setMenuTab?.("card_list")}>더보기 ›</button>
          </div>
          <table className="modern-home-table">
            <thead><tr><th>날짜</th><th>사용처</th><th>내역</th><th>금액</th></tr></thead>
            <tbody>
              {recentCards.length ? recentCards.map((c) => (
                <tr key={c.id}>
                  <td>{(c.date || "").slice(5) || "-"}</td>
                  <td>{c.place || "-"}</td>
                  <td>{c.memo || c.user_name || "-"}</td>
                  <td>{money(c.amount)}원</td>
                </tr>
              )) : <tr><td colSpan={4}>카드사용 내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="modern-home-panel">
          <div className="modern-home-panel-head">
            <h3>최근 정비 내역</h3>
            <button onClick={() => setMenuTab?.("maint_list")}>더보기 ›</button>
          </div>
          <table className="modern-home-table">
            <thead><tr><th>날짜</th><th>장비명 / 작업내용</th><th>구분</th><th>금액</th></tr></thead>
            <tbody>
              {recentMaints.length ? recentMaints.map((m) => (
                <tr key={m.id}>
                  <td>{(m.date || "").slice(5) || "-"}</td>
                  <td>{m.warehouse || "-"}</td>
                  <td>{m.title || "정비"}</td>
                  <td>{money(m.total || m.cost)}원</td>
                </tr>
              )) : <tr><td colSpan={4}>정비내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CardUseStats({ cardUses }: { cardUses: CardUse[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userName, setUserName] = useState("");
  const [place, setPlace] = useState("");

  const filtered = useMemo(() => {
    return cardUses.filter((c) => {
      const d = c.date || "";
      const okFrom = !from || d >= from;
      const okTo = !to || d <= to;
      const okUser = !userName || (c.user_name || "").includes(userName);
      const okPlace = !place || (c.place || "").includes(place);
      return okFrom && okTo && okUser && okPlace;
    });
  }, [cardUses, from, to, userName, place]);

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const byUser = new Map<string, number>();
    const byPlace = new Map<string, number>();

    filtered.forEach((c) => {
      const u = c.user_name || "미지정";
      const p = c.place || "미지정";
      byUser.set(u, (byUser.get(u) || 0) + Number(c.amount || 0));
      byPlace.set(p, (byPlace.get(p) || 0) + Number(c.amount || 0));
    });

    const topUser = Array.from(byUser.entries()).sort((a, b) => b[1] - a[1])[0];
    const topPlace = Array.from(byPlace.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      count: filtered.length,
      total,
      avg: filtered.length ? Math.round(total / filtered.length) : 0,
      topUserName: topUser?.[0] || "-",
      topUserTotal: topUser?.[1] || 0,
      topPlaceName: topPlace?.[0] || "-",
      topPlaceTotal: topPlace?.[1] || 0,
    };
  }, [filtered]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; count: number; total: number }>();
    filtered.forEach((c) => {
      const month = (c.date || "미지정").slice(0, 7) || "미지정";
      const cur = map.get(month) || { month, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(c.amount || 0);
      map.set(month, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [filtered]);

  const byUser = useMemo(() => {
    const map = new Map<string, { user_name: string; count: number; total: number }>();
    filtered.forEach((c) => {
      const name = c.user_name || "미지정";
      const cur = map.get(name) || { user_name: name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(c.amount || 0);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const byPlace = useMemo(() => {
    const map = new Map<string, { place: string; count: number; total: number }>();
    filtered.forEach((c) => {
      const name = c.place || "미지정";
      const cur = map.get(name) || { place: name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(c.amount || 0);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 30);
  }, [filtered]);

  const recent = useMemo(() => {
    return [...filtered].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 20);
  }, [filtered]);

  return (
    <section className="card">
      <div className="between"><h2>카드통계</h2><button onClick={() => downloadExcel(`카드통계_${todayText()}`, withTotalRow(
  filtered.map((c) => ({ 사용일자: c.date, 담당자: c.user_name, 사용처: c.place, 금액: c.amount, 메모: c.memo || "", 영수증: c.image_url || "" })),
  { 사용일자: "총합계", 금액: filtered.reduce((sum, c) => sum + Number(c.amount || 0), 0) }
))}>엑셀 다운로드</button></div>

      <div className="grid5">
        <Field label="시작일"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="종료일"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="담당자"><input placeholder="담당자 검색" value={userName} onChange={(e) => setUserName(e.target.value)} /></Field>
        <Field label="사용처"><input placeholder="사용처 검색" value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
        <Field label="초기화"><button onClick={() => { setFrom(""); setTo(""); setUserName(""); setPlace(""); }}>검색 초기화</button></Field>
      </div>

      <div className="status-cards">
        <div><span>카드사용 건수</span><b>{summary.count}건</b></div>
        <div><span>총 사용금액</span><b>{money(summary.total)}원</b></div>
        <div><span>건당 평균</span><b>{money(summary.avg)}원</b></div>
        <div><span>최고 사용 담당자</span><b>{summary.topUserName}<br />{money(summary.topUserTotal)}원</b></div>
        <div><span>최고 사용처</span><b>{summary.topPlaceName}<br />{money(summary.topPlaceTotal)}원</b></div>
      </div>

      <h3>월별 카드사용</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>월</th><th>건수</th><th>합계</th></tr></thead>
          <tbody>
            {!byMonth.length ? <tr><td colSpan={3} className="empty">조회된 월별 카드사용 없음</td></tr> : byMonth.map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                <td>{m.count}</td>
                <td className="right bold">{money(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>

      <h3>담당자별 카드사용</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>순위</th><th>작업자</th><th>건수</th><th>합계</th></tr></thead>
          <tbody>
            {!byUser.length ? <tr><td colSpan={4} className="empty">조회된 담당자별 카드사용 없음</td></tr> : byUser.map((u, i) => (
              <tr key={u.user_name}>
                <td>{i + 1}</td>
                <td>{u.user_name}</td>
                <td>{u.count}</td>
                <td className="right bold">{money(u.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>

      <h3>사용처별 카드사용 TOP 30</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>순위</th><th>사용처</th><th>건수</th><th>합계</th></tr></thead>
          <tbody>
            {!byPlace.length ? <tr><td colSpan={4} className="empty">조회된 사용처별 카드사용 없음</td></tr> : byPlace.map((p, i) => (
              <tr key={p.place}>
                <td>{i + 1}</td>
                <td>{p.place}</td>
                <td>{p.count}</td>
                <td className="right bold">{money(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>

      <h3>최근 카드사용 내역</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>일자</th><th>담당자</th><th>사용처</th><th>금액</th><th>영수증</th></tr></thead>
          <tbody>
            {!recent.length ? <tr><td colSpan={5} className="empty">최근 카드사용 없음</td></tr> : recent.map((c) => (
              <tr key={c.id}>
                <td>{c.date || "-"}</td>
                <td>{c.user_name || "-"}</td>
                <td>{c.place || "-"}</td>
                <td className="right bold">{money(c.amount)}</td>
                <td><AttachmentGroup urls={c.image_urls || (c.image_url ? [c.image_url] : [])} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}


function MaintenanceStats({ maints }: { maints: Maint[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    return maints.filter((m) => {
      const d = m.date || "";
      const okFrom = !from || d >= from;
      const okTo = !to || d <= to;
      const okWarehouse = !warehouse || (m.warehouse || "").includes(warehouse);
      const okKeyword = !keyword || `${m.title || ""} ${m.detail || ""} ${m.manager || ""}`.includes(keyword);
      return okFrom && okTo && okWarehouse && okKeyword;
    });
  }, [maints, from, to, warehouse, keyword]);

  const getSupply = (m: Maint) => Number(m.supplyTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.supply || 0), 0));
  const getVat = (m: Maint) => Number(m.vatTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.vat || 0), 0));
  const getTotal = (m: Maint) => Number(m.total || m.cost || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0));

  const summary = useMemo(() => {
    const supply = filtered.reduce((sum, m) => sum + getSupply(m), 0);
    const vat = filtered.reduce((sum, m) => sum + getVat(m), 0);
    const total = filtered.reduce((sum, m) => sum + getTotal(m), 0);

    const byWh = new Map<string, number>();
    filtered.forEach((m) => {
      const name = m.warehouse || "미지정";
      byWh.set(name, (byWh.get(name) || 0) + getTotal(m));
    });

    const topWarehouse = Array.from(byWh.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      count: filtered.length,
      supply,
      vat,
      total,
      topWarehouseName: topWarehouse?.[0] || "-",
      topWarehouseTotal: topWarehouse?.[1] || 0,
    };
  }, [filtered]);

  const byWarehouse = useMemo(() => {
    const map = new Map<string, { warehouse: string; count: number; supply: number; vat: number; total: number }>();
    filtered.forEach((m) => {
      const name = m.warehouse || "미지정";
      const cur = map.get(name) || { warehouse: name, count: 0, supply: 0, vat: 0, total: 0 };
      cur.count += 1;
      cur.supply += getSupply(m);
      cur.vat += getVat(m);
      cur.total += getTotal(m);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; count: number; total: number }>();
    filtered.forEach((m) => {
      const month = (m.date || "미지정").slice(0, 7) || "미지정";
      const cur = map.get(month) || { month, count: 0, total: 0 };
      cur.count += 1;
      cur.total += getTotal(m);
      map.set(month, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [filtered]);

  const byItem = useMemo(() => {
    const map = new Map<string, { item: string; count: number; qty: number; total: number }>();
    filtered.forEach((m) => {
      (m.items || []).forEach((r: any) => {
        const name = r.item || "미지정";
        const cur = map.get(name) || { item: name, count: 0, qty: 0, total: 0 };
        cur.count += 1;
        cur.qty += Number(r.qty || 0);
        cur.total += Number(r.total || 0);
        map.set(name, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [filtered]);

  const recent = useMemo(() => {
    return [...filtered].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 20);
  }, [filtered]);

  return (
    <section className="card">
      <div className="between"><h2>정비통계</h2><button onClick={() => downloadExcel(`정비통계_${todayText()}`, withTotalRow(
  filtered.map((m) => ({ 일자: m.date, 창고: m.warehouse, 제목: m.title, 내용: m.detail, 작업자: m.manager, 공급가액: getSupply(m), 부가세: getVat(m), 합계: getTotal(m) })),
  { 일자: "총합계", 공급가액: filtered.reduce((sum, m) => sum + getSupply(m), 0), 부가세: filtered.reduce((sum, m) => sum + getVat(m), 0), 합계: filtered.reduce((sum, m) => sum + getTotal(m), 0) }
))}>엑셀 다운로드</button></div>

      <div className="grid5">
        <Field label="시작일"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="종료일"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="창고"><input placeholder="창고 일부 검색" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} /></Field>
        <Field label="제목/내용/작업자"><input placeholder="검색어 입력" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></Field>
        <Field label="초기화"><button onClick={() => { setFrom(""); setTo(""); setWarehouse(""); setKeyword(""); }}>검색 초기화</button></Field>
      </div>

      <div className="status-cards">
        <div><span>정비건수</span><b>{summary.count}건</b></div>
        <div><span>공급가액</span><b>{money(summary.supply)}원</b></div>
        <div><span>부가세</span><b>{money(summary.vat)}원</b></div>
        <div><span>총 정비비</span><b>{money(summary.total)}원</b></div>
        <div><span>최고 지출 창고</span><b>{summary.topWarehouseName}<br />{money(summary.topWarehouseTotal)}원</b></div>
      </div>

      <h3>창고별 정비비</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>순위</th><th>창고</th><th>정비건수</th><th>공급가액</th><th>부가세</th><th>합계</th></tr></thead>
          <tbody>
            {!byWarehouse.length ? <tr><td colSpan={6} className="empty">조회된 창고별 정비비 없음</td></tr> : byWarehouse.map((w, i) => (
              <tr key={w.warehouse}>
                <td>{i + 1}</td>
                <td>{w.warehouse}</td>
                <td>{w.count}</td>
                <td className="right">{money(w.supply)}</td>
                <td className="right">{money(w.vat)}</td>
                <td className="right bold">{money(w.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>

      <h3>월별 정비비</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>월</th><th>정비건수</th><th>합계</th></tr></thead>
          <tbody>
            {!byMonth.length ? <tr><td colSpan={3} className="empty">조회된 월별 정비비 없음</td></tr> : byMonth.map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                <td>{m.count}</td>
                <td className="right bold">{money(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>

      <h3>품목별 사용금액 TOP 20</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>순위</th><th>품목</th><th>사용횟수</th><th>수량합계</th><th>금액합계</th></tr></thead>
          <tbody>
            {!byItem.length ? <tr><td colSpan={5} className="empty">조회된 품목 사용내역 없음</td></tr> : byItem.map((it, i) => (
              <tr key={it.item}>
                <td>{i + 1}</td>
                <td>{it.item}</td>
                <td>{it.count}</td>
                <td className="right">{money(it.qty)}</td>
                <td className="right bold">{money(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>

      <h3>최근 정비내역</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>일자</th><th>창고</th><th>제목</th><th>내용</th><th>합계</th></tr></thead>
          <tbody>
            {!recent.length ? <tr><td colSpan={5} className="empty">최근 정비내역 없음</td></tr> : recent.map((m) => (
              <tr key={m.id}>
                <td>{m.date || "-"}</td>
                <td>{m.warehouse || "-"}</td>
                <td>{m.title || "-"}</td>
                <td><span className="maint-detail-text">{m.detail || "-"}</span></td>
                <td className="right bold">{money(getTotal(m))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}


function SimpleVendorTable({ vendors, deleteVendor, editVendor, isAdmin }: any) {
  return <ScrollTable><table><thead><tr><th>코드</th><th>상호</th><th>대표자</th><th>전화번호</th><th>모바일</th><th>관리</th></tr></thead><tbody>{vendors.map((v: Vendor) => <tr key={v.id}><td>{v.code}</td><td>{v.name}</td><td>{v.owner || "-"}</td><td>{v.phone || "-"}</td><td>{v.mobile || "-"}</td><td>{isAdmin ? <><button className="icon" onClick={() => editVendor(v)}><Pencil size={16} /></button><button className="icon" onClick={() => deleteVendor(v.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>)}</tbody></table></ScrollTable>;
}

/*
MOBILE_MENU_AUDIT
menu_values=['bulk_transfer', 'card_stats', 'card_use', 'home', 'items', 'layout', 'list', 'maint_list', 'maint_new', 'maint_stats', 'maintenance_photos', 'new', 'permits', 'receipt_photos', 'status', 'update_history', 'update_notices', 'vendor_accounts', 'vendors', 'warehouse_groups']
render_values=['bulk_transfer', 'card_stats', 'card_use', 'home', 'items', 'layout', 'list', 'maint_list', 'maint_new', 'maint_stats', 'maintenance_photos', 'new', 'permits', 'receipt_photos', 'status', 'update_history', 'update_notices', 'vendor_accounts', 'vendors', 'warehouse_groups']
missing_render=[]
missing_menu=[]
*/

const css = `
*{box-sizing:border-box}
html,body,#root{width:100%;min-height:100%;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',Arial,sans-serif;background:#0f172a;color:#0f172a;overflow-x:hidden}
button{border:0;border-radius:10px;padding:9px 14px;cursor:pointer;display:inline-flex;gap:6px;align-items:center;background:#e2e8f0}
button:hover{filter:brightness(.96)}
input{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;background:#fff}
label{font-size:13px;font-weight:700;color:#334155;display:block;margin-bottom:6px}
.app{width:100%;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}
.hero{width:100%;background:linear-gradient(90deg,#2563eb,#4f46e5);color:#fff;border-radius:24px;padding:26px 32px;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.main-title{margin:0;text-align:center;font-size:42px;font-weight:900;letter-spacing:4px;color:white;text-shadow:0 4px 14px rgba(0,0,0,.35)}
.hero p{margin:10px 0 0;color:#dbeafe;text-align:center;font-size:18px;font-weight:600;letter-spacing:2px}
.loading{background:#fef3c7;color:#92400e;border-radius:12px;padding:12px 16px;margin:14px 0}
.menu{display:flex;gap:12px;background:rgba(255,255,255,.12);border-radius:16px;padding:10px;margin:18px 0;width:100%}
.menu>button,.menu-group>button{background:rgba(255,255,255,.18);color:white}
.menu>button.active{background:#facc15;color:#111827}
.menu-group{position:relative}
.sub{display:none;position:absolute;top:100%;left:0;padding-top:6px;z-index:100}
.sub button{display:block;width:150px;border-radius:0;background:white;color:#111827;text-align:left}
.sub button:first-child{border-radius:10px 10px 0 0}
.sub button:last-child{border-radius:0 0 10px 10px}
.menu-group:hover .sub{display:block}
.card{width:100%;background:rgba(255,255,255,.94);border-radius:24px;padding:22px;margin-top:18px;box-shadow:0 20px 50px rgba(0,0,0,.2)}
.card h2{margin:0 0 18px;text-align:center}
.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}
.grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:16px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.field{margin-bottom:12px}
.search-wrap{position:relative}
.dropdown{position:absolute;left:0;right:0;top:100%;z-index:99999;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.18);max-height:320px;overflow:auto}
.dropdown-item{padding:10px;cursor:pointer}
.dropdown-item:hover{background:#f1f5f9}
.dropdown-empty{padding:10px;color:#94a3b8}
.table-wrap{overflow:visible;border:1px solid #e2e8f0;border-radius:14px;margin-top:14px}
.scroll-table{overflow:auto;border:1px solid #e2e8f0;border-radius:14px;margin-top:14px;max-height:420px}
table{width:100%;border-collapse:collapse;background:white}
th{background:#e2e8f0;text-align:left;padding:10px;white-space:nowrap}
td{border-top:1px solid #e2e8f0;padding:8px;white-space:nowrap}
td input{height:36px}
.right{text-align:right}
.bold{font-weight:800}
.between{display:flex;justify-content:space-between;gap:16px;align-items:center;margin:14px 0}
.totals{text-align:right}
.totals .big{font-size:20px;font-weight:800;margin-top:5px}
.actions{display:flex;gap:10px;margin-top:16px}
.right-actions{justify-content:flex-end}
.primary{background:#16a34a;color:white}
.icon{padding:6px 8px;margin-right:4px}
.upload{display:inline-flex;gap:7px;align-items:center;padding:9px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;cursor:pointer}
.upload input{display:none}
.empty{text-align:center;color:#64748b;padding:36px}
.home-img{height:620px;background:#f1f5f9;border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.home-img img{width:100%;height:100%;object-fit:contain}
.home-buttons{display:flex;justify-content:center;gap:16px;margin-top:18px}
.modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;z-index:999999}
.modal-box{width:min(620px,92vw);background:white;border-radius:22px;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.modal-box h2{margin:0 0 18px}
.status-cards{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin:16px 0}
.status-cards div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px}
.status-cards span{display:block;color:#64748b;font-size:13px;margin-bottom:8px}
.status-cards b{font-size:20px}

.maint-filter{display:grid;grid-template-columns:170px 170px 260px 1fr 120px;gap:12px;align-items:end;margin-bottom:16px}
.maint-filter .field{margin-bottom:0}
.maint-filter button{height:40px;justify-content:center}
.link-btn{
  background:transparent;
  color:#2563eb;
  text-decoration:underline;
  padding:0;
  border:none;
  font:inherit;
  font-weight:600;
  cursor:pointer;
}
.wide-modal{width:min(1100px,94vw)}

.item-search{display:grid;grid-template-columns:1fr 110px;gap:12px;align-items:center;margin:10px 0 16px}
.item-search span{font-size:13px;color:#64748b;text-align:right}

@media(max-width:900px){.maint-filter{grid-template-columns:1fr}}


.item-search{display:grid;grid-template-columns:1fr 110px;gap:12px;align-items:center;margin:10px 0 16px}
.item-search span{font-size:13px;color:#64748b;text-align:right}

@media(max-width:900px){.grid2,.grid3,.grid5,.two,.status-cards{grid-template-columns:1fr}.menu{flex-wrap:wrap}.home-img{height:320px}}
/* table alignment fix only */
th{
  text-align:center;
  vertical-align:middle;
}
td{
  text-align:center;
  vertical-align:middle;
}
td.right,
th.right,
.right{
  text-align:center;
}
td:last-child,
th:last-child{
  text-align:center;
}
td .icon{
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.scroll-table th,
.scroll-table td,
.table-wrap th,
.table-wrap td{
  padding:10px 8px;
}

.maint-detail-text{
  font-size:13px;
  color:#64748b;
}

.login-page{
  min-height:100vh;
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  background:
    radial-gradient(circle at top left, rgba(37,99,235,.25), transparent 30%),
    radial-gradient(circle at bottom right, rgba(79,70,229,.18), transparent 35%),
    linear-gradient(135deg,#0f172a 0%,#111827 45%,#1e293b 100%);
  padding:24px;
}

.login-card{
  width:min(430px,95vw);
  background:rgba(255,255,255,.97);
  border-radius:28px;
  padding:42px 36px;
  box-shadow:0 25px 80px rgba(0,0,0,.45);
  display:flex;
  flex-direction:column;
  gap:12px;
  border:1px solid rgba(255,255,255,.4);
}

.login-badge{
  margin:0 auto 8px;
  padding:6px 14px;
  border-radius:999px;
  background:#dbeafe;
  color:#2563eb;
  font-size:12px;
  font-weight:900;
  letter-spacing:1px;
}

.login-card h1{
  margin:0;
  text-align:center;
  font-size:48px;
  font-weight:900;
  letter-spacing:2px;
  color:#111827;
}

.login-card p{
  margin:0 0 18px;
  text-align:center;
  color:#64748b;
  font-size:15px;
  font-weight:700;
  letter-spacing:1px;
}

.login-card label{
  font-size:13px;
  font-weight:800;
  color:#334155;
  margin-bottom:-4px;
}

.login-card input{
  width:100%;
  height:52px;
  border-radius:14px;
  border:1px solid #cbd5e1;
  background:#f8fafc;
  padding:0 16px;
  font-size:15px;
  transition:.15s;
  box-sizing:border-box;
}

.login-card input:focus{
  outline:none;
  border-color:#2563eb;
  background:white;
  box-shadow:0 0 0 4px rgba(37,99,235,.12);
}

.login-button{
  width:100%;
  height:54px;
  border:none;
  border-radius:14px;
  background:linear-gradient(90deg,#2563eb,#4f46e5);
  color:white;
  font-size:16px;
  font-weight:900;
  cursor:pointer;
  margin-top:8px;
  transition:.15s;
}

.login-button:hover{
  transform:translateY(-1px);
  box-shadow:0 14px 30px rgba(37,99,235,.28);
}

.login-error{
  background:#fee2e2;
  color:#991b1b;
  border-radius:12px;
  padding:12px;
  font-size:13px;
  font-weight:700;
}

.user-box{
  margin-left:auto;
  display:flex;
  align-items:center;
  gap:8px;
}

.user-box span{
  color:#e2e8f0;
  font-size:13px;
}

.user-box button{
  background:#334155;
  color:white;
}

.dashboard-wrap{
  display:flex;
  flex-direction:column;
  gap:18px;
}
.dashboard-title-row{
  background:white;
  border:1px solid #e5e7eb;
  border-radius:18px;
  padding:20px 22px;
  box-shadow:0 2px 10px rgba(0,0,0,.05);
}
.dashboard-title-row h2{
  margin:0;
  font-size:26px;
}
.dashboard-title-row p{
  margin:6px 0 0;
  color:#64748b;
  font-weight:700;
}
.dashboard-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
  gap:16px;
}
.dashboard-card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:18px;
  padding:22px;
  box-shadow:0 2px 10px rgba(0,0,0,.05);
}
.dashboard-card span{
  font-size:13px;
  color:#64748b;
  font-weight:800;
}
.dashboard-card b{
  display:block;
  margin-top:12px;
  font-size:30px;
  color:#0f172a;
}
.dashboard-two{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:18px;
}
.dashboard-panel{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:18px;
  padding:18px;
  box-shadow:0 2px 10px rgba(0,0,0,.05);
}
.dashboard-panel h3{
  margin:0 0 14px;
}
.dashboard-table{
  width:100%;
  border-collapse:collapse;
}
.dashboard-table th{
  background:#eff6ff;
  padding:10px;
  border-bottom:1px solid #dbeafe;
  text-align:left;
}
.dashboard-table td{
  padding:10px;
  border-bottom:1px solid #f1f5f9;
}
@media (max-width:900px){
  .dashboard-two{
    grid-template-columns:1fr;
  }
}

.date-combo{
  display:grid;
  grid-template-columns:1fr 44px;
  gap:8px;
  align-items:center;
}
.date-combo input[type="date"]{
  padding:0;
  text-align:center;
  color:transparent;
  cursor:pointer;
}
.date-combo input[type="date"]::-webkit-calendar-picker-indicator{
  opacity:1;
  cursor:pointer;
  width:22px;
  height:22px;
  margin:auto;
}

/* ===== Mobile UI Optimization ===== */
@media (max-width: 900px){
  .app{
    padding:14px;
  }

  .hero{
    padding:18px 14px;
    border-radius:18px;
  }

  .main-title{
    font-size:28px;
    line-height:1.2;
  }

  .hero p{
    font-size:14px;
  }

  .menu{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    align-items:flex-start;
    padding:10px;
    position:sticky;
    top:0;
    z-index:50;
    background:#f8fafc;
    border-radius:16px;
    box-shadow:0 4px 16px rgba(15,23,42,.08);
  }

  .menu > button,
  .menu-group > button,
  .user-box button{
    min-height:44px;
    padding:10px 13px;
    font-size:14px;
    border-radius:12px;
  }

  .menu-group{
    position:relative;
  }

  .menu-group .sub{
    min-width:150px;
    border-radius:14px;
  }

  .menu-group .sub button{
    min-height:42px;
    font-size:14px;
    padding:10px 12px;
  }

  .user-box{
    width:100%;
    display:flex;
    justify-content:space-between;
    gap:8px;
    align-items:center;
    padding:8px 4px 0;
    font-size:13px;
  }

  .card{
    padding:16px;
    border-radius:18px;
    margin-top:14px;
  }

  .card h2{
    font-size:22px;
    margin-bottom:14px;
  }

  .grid3,
  .grid5,
  .two,
  .dashboard-two{
    grid-template-columns:1fr !important;
  }

  input,
  select,
  textarea,
  button{
    min-height:44px;
    font-size:16px;
  }

  label{
    font-size:13px;
  }

  .actions,
  .right-actions,
  .between{
    flex-direction:column;
    align-items:stretch;
    gap:10px;
  }

  .actions button,
  .right-actions button,
  .between button,
  .upload{
    width:100%;
    justify-content:center;
  }

  .table-wrap,
  .scroll-table{
    overflow-x:auto;
    -webkit-overflow-scrolling:touch;
  }

  table{
    min-width:760px;
    font-size:13px;
  }

  th,
  td{
    padding:9px 8px;
    white-space:nowrap;
  }

  .dashboard-grid{
    grid-template-columns:1fr !important;
    gap:12px;
  }

  .dashboard-card{
    padding:18px;
    border-radius:16px;
  }

  .dashboard-card b{
    font-size:24px;
  }

  .dashboard-title-row{
    padding:16px;
    border-radius:16px;
  }

  .dashboard-title-row h2{
    font-size:22px;
  }

  .dashboard-panel{
    padding:14px;
    border-radius:16px;
  }

  .date-combo{
    grid-template-columns:1fr 48px;
  }

  .search-wrap{
    min-width:0;
  }

  .dropdown{
    max-height:260px;
    overflow:auto;
  }

  .home-img img{
    max-width:100%;
    height:auto;
  }

  .home-buttons{
    display:grid;
    grid-template-columns:1fr;
    gap:10px;
  }

  .totals{
    width:100%;
    display:grid;
    gap:8px;
    font-size:14px;
  }

  .totals .big{
    font-size:18px;
  }
}

@media (max-width: 520px){
  .app{
    padding:10px;
  }

  .main-title{
    font-size:24px;
  }

  .menu{
    gap:6px;
    padding:8px;
  }

  .menu > button,
  .menu-group > button{
    flex:1 1 calc(50% - 6px);
  }

  .card{
    padding:13px;
  }

  .card h2{
    font-size:20px;
  }

  table{
    min-width:680px;
  }

  .dashboard-card b{
    font-size:22px;
  }
}

/* ===== Mobile Dashboard Fit Fix ===== */
@media (max-width: 900px){
  html,
  body,
  #root{
    max-width:100%;
    overflow-x:hidden;
  }

  .app{
    max-width:100%;
    overflow-x:hidden;
    box-sizing:border-box;
  }

  .menu{
    background:#ffffff;
    color:#111827;
  }

  .menu > button,
  .menu-group > button{
    color:#111827 !important;
    background:#f1f5f9;
    border:1px solid #e5e7eb;
  }

  .menu > button.active{
    background:#facc15;
    color:#111827 !important;
  }

  .user-box{
    color:#334155;
  }

  .dashboard-wrap,
  .dashboard-panel,
  .dashboard-card,
  .dashboard-title-row{
    width:100%;
    max-width:100%;
    box-sizing:border-box;
    overflow:hidden;
  }

  .dashboard-table{
    width:100%;
    min-width:0 !important;
    table-layout:fixed;
  }

  .dashboard-table th,
  .dashboard-table td{
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    font-size:12px;
    padding:9px 6px;
  }

  .dashboard-table th:first-child,
  .dashboard-table td:first-child{
    width:86px;
  }

  .dashboard-table th:last-child,
  .dashboard-table td:last-child{
    width:auto;
  }

  .scroll-table table,
  .table-wrap table{
    min-width:760px;
  }

  .dashboard-panel h3{
    font-size:18px;
    white-space:normal;
  }

  .dashboard-card b{
    word-break:break-all;
  }
}

@media (max-width: 520px){
  .menu{
    display:grid;
    grid-template-columns:1fr 1fr;
  }

  .menu > button,
  .menu-group > button{
    width:100%;
    flex:unset;
  }

  .user-box{
    grid-column:1 / -1;
  }

  .dashboard-table th,
  .dashboard-table td{
    font-size:11.5px;
  }

  .dashboard-table th:first-child,
  .dashboard-table td:first-child{
    width:80px;
  }

  .scroll-table table,
  .table-wrap table{
    min-width:720px;
  }
}

/* ===== Compact Mobile Menu ===== */
@media (max-width: 900px){
  .menu{
    display:flex !important;
    flex-wrap:nowrap !important;
    overflow-x:auto;
    overflow-y:visible;
    gap:6px;
    padding:8px;
    align-items:center;
    scrollbar-width:none;
    -webkit-overflow-scrolling:touch;
  }

  .menu::-webkit-scrollbar{
    display:none;
  }

  .menu > button,
  .menu-group > button{
    flex:0 0 auto !important;
    width:auto !important;
    min-height:36px !important;
    height:36px;
    padding:7px 11px !important;
    font-size:13px !important;
    border-radius:999px !important;
    white-space:nowrap;
  }

  .menu-group{
    flex:0 0 auto;
  }

  .menu-group .sub{
    position:fixed;
    top:132px;
    left:12px;
    right:12px;
    width:auto;
    min-width:0;
    z-index:9999;
    display:none;
    grid-template-columns:1fr 1fr;
    gap:8px;
    padding:10px;
    background:#ffffff;
    border:1px solid #e5e7eb;
    border-radius:16px;
    box-shadow:0 12px 30px rgba(15,23,42,.18);
  }

  .menu-group:hover .sub,
  .menu-group:focus-within .sub{
    display:grid;
  }

  .menu-group .sub button{
    width:100%;
    min-height:40px;
    border-radius:12px;
    background:#f8fafc;
    color:#111827;
    border:1px solid #e5e7eb;
  }

  .user-box{
    flex:0 0 auto;
    width:auto !important;
    min-width:max-content;
    display:flex;
    gap:6px;
    align-items:center;
    padding:0 !important;
  }

  .user-box span{
    display:none;
  }

  .user-box button{
    min-height:36px !important;
    height:36px;
    padding:7px 11px !important;
    border-radius:999px !important;
    font-size:13px !important;
    white-space:nowrap;
  }
}

@media (max-width: 520px){
  .menu{
    grid-template-columns:none !important;
  }

  .menu > button,
  .menu-group > button{
    flex:0 0 auto !important;
  }

  .menu-group .sub{
    top:122px;
    grid-template-columns:1fr 1fr;
  }
}

/* ===== Mobile Bottom Navigation ===== */
.mobile-bottom-nav{
  display:none;
}

@media (max-width: 900px){
  .mobile-bottom-nav{
    position:fixed;
    left:0;
    right:0;
    bottom:0;
    height:66px;
    background:#ffffff;
    border-top:1px solid #e5e7eb;
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap:6px;
    padding:7px 8px;
    z-index:99999;
    box-shadow:0 -8px 30px rgba(15,23,42,.10);
    box-sizing:border-box;
  }

  .mobile-bottom-nav button{
    border:0;
    background:#f8fafc;
    border-radius:14px;
    font-size:12px;
    font-weight:900;
    color:#334155;
    min-height:48px !important;
    padding:4px 2px !important;
    white-space:nowrap;
  }

  .mobile-bottom-nav button.active{
    background:#2563eb;
    color:#ffffff;
  }

  .mobile-bottom-nav button:active{
    transform:scale(.97);
  }

  .app{
    padding-bottom:92px !important;
  }

  .menu{
    padding:7px !important;
    gap:5px !important;
  }

  .menu > button,
  .menu-group > button,
  .user-box button{
    min-height:34px !important;
    height:34px !important;
    padding:6px 10px !important;
    font-size:12px !important;
  }

  .user-box{
    display:none !important;
  }
}

@media (max-width: 520px){
  .mobile-bottom-nav{
    height:64px;
    padding:6px;
    gap:5px;
  }

  .mobile-bottom-nav button{
    font-size:11.5px;
    border-radius:12px;
  }

  .app{
    padding-bottom:88px !important;
  }
}

/* ===== Cleaner Mobile App Layout ===== */
@media (max-width: 900px){
  .menu{
    display:none !important;
  }

  .hero{
    margin-bottom:12px;
    padding:22px 14px !important;
    border-radius:22px !important;
  }

  .main-title{
    font-size:30px !important;
    letter-spacing:1px;
  }

  .hero p{
    margin-top:6px;
    font-size:14px !important;
  }

  .dashboard-grid{
    gap:10px !important;
  }

  .dashboard-card{
    padding:18px 14px !important;
    min-height:92px;
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:center;
    border-radius:18px !important;
  }

  .dashboard-card span{
    font-size:13px !important;
    margin-bottom:8px;
  }

  .dashboard-card b{
    margin-top:0 !important;
    font-size:26px !important;
  }

  .dashboard-panel{
    padding:14px !important;
    border-radius:18px !important;
  }

  .dashboard-panel h3{
    text-align:left;
    font-size:18px !important;
    margin-bottom:12px !important;
  }

  .mobile-bottom-nav{
    height:62px !important;
    padding:6px 8px calc(6px + env(safe-area-inset-bottom)) !important;
    background:rgba(255,255,255,.96) !important;
    backdrop-filter:blur(16px);
    border-top:1px solid #e5e7eb;
    grid-template-columns:repeat(5,1fr);
    gap:6px !important;
  }

  .mobile-bottom-nav button{
    min-height:48px !important;
    height:48px !important;
    border-radius:16px !important;
    font-size:12px !important;
    font-weight:900 !important;
    background:#f8fafc !important;
    color:#334155 !important;
  }

  .mobile-bottom-nav button.active{
    background:#2563eb !important;
    color:#ffffff !important;
    box-shadow:0 8px 18px rgba(37,99,235,.25);
  }

  .mobile-more-sheet{
    position:fixed;
    left:12px;
    right:12px;
    bottom:76px;
    z-index:99998;
    grid-template-columns:1fr 1fr;
    gap:8px;
    padding:12px;
    background:#ffffff;
    border:1px solid #e5e7eb;
    border-radius:20px;
    box-shadow:0 18px 50px rgba(15,23,42,.22);
  }

  .mobile-more-sheet button{
    min-height:44px;
    border:0;
    border-radius:14px;
    background:#f1f5f9;
    color:#111827;
    font-size:14px;
    font-weight:900;
  }

  .app{
    padding-bottom:86px !important;
  }
}

@media (max-width: 520px){
  .hero{
    padding:20px 12px !important;
  }

  .main-title{
    font-size:28px !important;
  }

  .dashboard-card{
    min-height:86px;
  }

  .dashboard-card b{
    font-size:24px !important;
  }

  .mobile-more-sheet{
    bottom:72px;
  }
}

/* ===== Mobile Bottom Menu Detail Fix ===== */
@media (max-width: 900px){
  .mobile-bottom-nav button{
    display:flex !important;
    align-items:center !important;
    justify-content:center !important;
    text-align:center !important;
    line-height:1 !important;
    padding:0 !important;
  }

  .mobile-more-sheet{
    grid-template-columns:1fr 1fr !important;
  }

  .mobile-more-sheet button{
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
  }
}

@media (max-width: 520px){
  .mobile-bottom-nav button{
    font-size:12px !important;
  }
}

/* ===== Mobile Card List + Attachment Preview ===== */
.mobile-card-list{
  display:none;
}

.attachment-preview{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:74px;
  height:74px;
  border-radius:16px;
  overflow:hidden;
  background:#f8fafc;
  border:1px solid #e5e7eb;
  text-decoration:none;
}

.attachment-preview img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.pdf-thumb{
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#dc2626;
  color:#ffffff;
  font-size:14px;
  font-weight:900;
}

.file-view-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:32px;
  padding:6px 10px;
  border-radius:10px;
  background:#2563eb;
  color:#ffffff;
  font-size:12px;
  font-weight:800;
  text-decoration:none;
}

@media (max-width: 900px){
  .card .scroll-table{
    display:none;
  }

  .mobile-card-list{
    display:grid;
    gap:12px;
    margin-top:12px;
  }

  .mobile-list-card{
    background:#ffffff;
    border:1px solid #e5e7eb;
    border-radius:20px;
    padding:15px;
    display:grid;
    gap:13px;
    box-shadow:0 6px 24px rgba(15,23,42,.07);
  }

  .mobile-list-top{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:12px;
  }

  .mobile-list-top b{
    font-size:15px;
    color:#111827;
  }

  .mobile-list-top span{
    font-size:15px;
    font-weight:900;
    color:#2563eb;
    white-space:nowrap;
  }

  .mobile-list-body{
    display:grid;
    gap:9px;
    font-size:14px;
    color:#111827;
  }

  .mobile-list-body div{
    display:grid;
    gap:4px;
  }

  .mobile-list-body label{
    font-size:12px;
    font-weight:900;
    color:#64748b;
  }

  .mobile-list-body p{
    margin:0;
    word-break:break-word;
  }

  .mobile-list-attachment{
    display:flex;
    justify-content:flex-end;
  }

  .mobile-card-actions{
    display:flex;
    justify-content:flex-end;
    gap:8px;
  }

  .mobile-card-actions button{
    min-height:36px;
    padding:7px 12px;
    border-radius:12px;
    border:0;
    background:#f1f5f9;
    color:#111827;
    font-size:13px;
    font-weight:900;
  }

  .mobile-card-actions button:last-child{
    background:#fee2e2;
    color:#991b1b;
  }
}

/* ===== PDF Output + Multiple Maintenance Attachments ===== */
.attachment-chips{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
}

.attachment-chips a{
  display:inline-flex;
  min-height:34px;
  align-items:center;
  justify-content:center;
  padding:6px 10px;
  border-radius:999px;
  background:#eff6ff;
  color:#1d4ed8;
  font-weight:900;
  font-size:13px;
  text-decoration:none;
}

.attachment-chips span{
  color:#64748b;
  font-size:13px;
  font-weight:800;
}

.attachment-group{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
  align-items:center;
}

.attachment-group .attachment-preview{
  width:56px;
  height:56px;
}

@media (max-width: 900px){
  .attachment-group{
    justify-content:flex-end;
  }

  .attachment-group .attachment-preview{
    width:64px;
    height:64px;
  }
}

/* ===== Update Notice Popup ===== */
.update-popup-backdrop{
  position:fixed;
  inset:0;
  background:rgba(15,23,42,.48);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  z-index:100000;
}

.update-popup{
  width:min(520px, 94vw);
  background:#ffffff;
  border-radius:24px;
  box-shadow:0 30px 90px rgba(0,0,0,.35);
  padding:22px;
  color:#111827;
}

.update-popup-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
  margin-bottom:14px;
}

.update-popup-head span{
  display:inline-flex;
  padding:5px 10px;
  border-radius:999px;
  background:#dbeafe;
  color:#1d4ed8;
  font-size:11px;
  font-weight:900;
  letter-spacing:.8px;
}

.update-popup-head h2{
  margin:8px 0 0;
  font-size:24px;
}

.update-popup-head button{
  width:36px;
  height:36px;
  border:0;
  border-radius:999px;
  background:#f1f5f9;
  font-size:24px;
  font-weight:800;
  cursor:pointer;
}


.update-popup li{
  display:grid;
  gap:3px;
}

.update-popup li strong{
  color:#1d4ed8;
  font-size:12px;
}

.update-popup li span{
  color:#334155;
}

.update-popup ul{
  margin:0;
  padding:0 0 0 20px;
  display:grid;
  gap:9px;
  color:#334155;
  font-size:15px;
  font-weight:700;
}

.update-popup-bottom{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  margin-top:20px;
}

.update-popup-bottom label{
  display:flex;
  align-items:center;
  gap:8px;
  color:#475569;
  font-size:14px;
  font-weight:800;
  cursor:pointer;
}

.update-popup-bottom input{
  width:17px;
  height:17px;
  accent-color:#2563eb;
}

.update-popup-bottom button{
  min-width:96px;
}

@media (max-width: 900px){
  .update-popup-backdrop{
    align-items:flex-end;
    padding:12px;
  }

  .update-popup{
    width:100%;
    border-radius:24px 24px 18px 18px;
    padding:20px;
  }

  .update-popup-head h2{
    font-size:22px;
  }

  .update-popup ul{
    font-size:14px;
  }

  .update-popup-bottom{
    flex-direction:row;
  }
}

/* ===== Multiple Card Receipt Attachments ===== */
.attachment-chips{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
}

.attachment-chips a{
  display:inline-flex;
  min-height:34px;
  align-items:center;
  justify-content:center;
  padding:6px 10px;
  border-radius:999px;
  background:#eff6ff;
  color:#1d4ed8;
  font-weight:900;
  font-size:13px;
  text-decoration:none;
}

.attachment-preview{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:74px;
  height:74px;
  border-radius:16px;
  overflow:hidden;
  background:#f8fafc;
  border:1px solid #e5e7eb;
  text-decoration:none;
}

.attachment-preview img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.pdf-thumb{
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#dc2626;
  color:#ffffff;
  font-size:14px;
  font-weight:900;
}

.attachment-group{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
  align-items:center;
}

.attachment-group .attachment-preview{
  width:56px;
  height:56px;
}

@media (max-width:900px){
  .attachment-group{
    justify-content:flex-end;
  }

  .attachment-group .attachment-preview{
    width:64px;
    height:64px;
  }
}

/* ===== Supabase Production Line Hotspot Editor ===== */
.layout-map{
  position:relative;
  width:100%;
  margin:0 auto;
  background:#ffffff;
  border-radius:16px;
  overflow:hidden;
}

.layout-map img{
  display:block;
  width:100%;
  height:auto;
}

.layout-hotspot{
  position:absolute;
  transform:translate(-50%, -50%);
  border:2px solid transparent;
  background:transparent;
  color:#111827;
  border-radius:10px;
  cursor:pointer;
  padding:0;
  transition:.15s ease;
  touch-action:none;
  user-select:none;
}

.layout-hotspot span{
  display:none;
}

.layout-map.editing .layout-hotspot span{
  display:block;
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%, -50%);
  max-width:96%;
  padding:3px 7px;
  border-radius:999px;
  background:#0f172a;
  color:#ffffff;
  font-size:11px;
  font-weight:900;
  line-height:1.15;
  white-space:normal;
  text-align:center;
  pointer-events:none;
}

.layout-hotspot:hover{
  background:rgba(245,158,11,.10);
  box-shadow:0 0 0 4px rgba(245,158,11,.08);
}

.layout-hotspot.selected{
  border-color:#2563eb;
  background:rgba(37,99,235,.18);
  box-shadow:0 0 0 4px rgba(37,99,235,.16);
}

.layout-edit-actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
  justify-content:flex-end;
}

.layout-edit-actions button{
  min-height:36px;
  border:0;
  border-radius:10px;
  padding:7px 11px;
  background:#f1f5f9;
  color:#111827;
  font-weight:900;
  cursor:pointer;
}

.layout-edit-guide{
  margin:10px 0 14px;
  padding:10px 12px;
  border-radius:12px;
  background:#fffbeb;
  color:#92400e;
  font-size:14px;
  font-weight:800;
  text-align:center;
}

.layout-edit-guide b{
  color:#1d4ed8;
  margin:0 4px;
}

.layout-edit-guide strong{
  display:block;
  margin-top:6px;
  color:#2563eb;
}

.layout-map.editing{
  outline:3px dashed #f59e0b;
  outline-offset:4px;
}

.layout-map.editing .layout-hotspot{
  cursor:grab;
  transition:none;
  border-color:rgba(245,158,11,.82);
  background:rgba(245,158,11,.14);
}

@media (max-width:900px){
  .layout-edit-actions{
    width:100%;
    display:grid;
    grid-template-columns:repeat(3, 1fr);
    gap:8px;
  }

  .layout-edit-actions button{
    font-size:12px;
    padding:7px 8px;
  }

  .layout-edit-guide{
    font-size:13px;
    text-align:left;
  }

  .layout-hotspot span{
    font-size:8px;
    padding:2px 4px;
  }
}

/* ===== Hotspot Side Resize Handle ===== */
.layout-resize-handle{
  position:absolute;
  right:-8px;
  bottom:-8px;
  width:18px;
  height:18px;
  border-radius:999px;
  background:#2563eb;
  border:3px solid #ffffff;
  box-shadow:0 2px 10px rgba(15,23,42,.35);
  cursor:nwse-resize;
  touch-action:none;
  z-index:10;
}

.layout-resize-handle::after{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:6px;
  height:6px;
  transform:translate(-50%, -50%);
  border-right:2px solid #fff;
  border-bottom:2px solid #fff;
}

/* ===== PRO Notice Board Design ===== */
.notice-pro-wrap{
  display:grid;
  grid-template-columns:minmax(0, 1.22fr) minmax(430px, .9fr);
  gap:18px;
  align-items:start;
}

.notice-pro-left{
  position:relative;
  padding:28px;
  border-radius:24px;
  background:
    radial-gradient(circle at 98% 6%, rgba(250,204,21,.18), transparent 20%),
    linear-gradient(135deg, #fffaf0 0%, #ffffff 72%);
  border:1px solid rgba(226,232,240,.9);
  box-shadow:0 18px 42px rgba(15,23,42,.16);
  overflow:hidden;
}

.notice-pro-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:18px;
  margin-bottom:20px;
}

.notice-pro-head h2{
  margin:0;
  color:#111827;
  font-size:32px;
  font-weight:1000;
  letter-spacing:-.05em;
}

.notice-pro-head p{
  margin:7px 0 0;
  color:#475569;
  font-size:15px;
  font-weight:800;
}

.notice-pin{
  width:92px;
  min-height:74px;
  display:grid;
  place-items:center;
  text-align:center;
  transform:rotate(5deg);
  background:#fde68a;
  color:#713f12;
  border-radius:7px;
  box-shadow:0 10px 24px rgba(15,23,42,.18);
  font-size:13px;
  font-weight:1000;
}

.notice-pro-tabs{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-bottom:17px;
}

.notice-pro-tabs button{
  min-width:76px;
  min-height:38px;
  border:1px solid #e5e7eb;
  border-radius:12px;
  background:#ffffff;
  color:#334155;
  font-size:14px;
  font-weight:1000;
  box-shadow:0 4px 10px rgba(15,23,42,.05);
}

.notice-pro-tabs button.active{
  background:#2563eb;
  border-color:#2563eb;
  color:#ffffff;
}

.notice-pro-list{
  display:grid;
  gap:10px;
}

.notice-pro-item{
  display:grid;
  grid-template-columns:84px 1fr;
  gap:12px;
  align-items:stretch;
}

.notice-pro-date{
  min-height:72px;
  border-radius:14px;
  background:#ffffff;
  border:1px solid #e5e7eb;
  box-shadow:0 6px 14px rgba(15,23,42,.08);
  display:grid;
  place-items:center;
  padding:8px 6px;
  position:relative;
}

.notice-pro-date strong{
  color:#ef4444;
  font-size:13px;
  line-height:1;
}

.notice-pro-date b{
  color:#111827;
  font-size:18px;
  line-height:1.1;
}

.notice-pro-date em{
  position:absolute;
  right:7px;
  bottom:5px;
  color:#ef4444;
  font-size:9px;
  font-style:normal;
  font-weight:1000;
}

.notice-pro-body{
  min-height:72px;
  border-radius:14px;
  background:rgba(255,255,255,.94);
  border:1px solid #e5e7eb;
  padding:13px 15px;
  box-shadow:0 5px 14px rgba(15,23,42,.05);
}

.notice-pro-badge-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:7px;
}

.notice-pro-badge-row span,
.notice-pro-table-row b{
  display:inline-flex;
  width:max-content;
  padding:4px 8px;
  border-radius:999px;
  background:#e5e7eb;
  color:#475569;
  font-size:11px;
  font-weight:1000;
}

.notice-pro-badge-row span.hot,
.notice-pro-table-row b.red{
  background:#fee2e2;
  color:#dc2626;
}

.notice-pro-table-row b.gray{
  background:#e5e7eb;
  color:#475569;
}

.notice-pro-body h3{
  margin:0 0 5px;
  color:#111827;
  font-size:16px;
  font-weight:1000;
  line-height:1.25;
}

.notice-pro-body p{
  margin:0;
  color:#334155;
  font-size:13px;
  font-weight:700;
  line-height:1.45;
}

.notice-pro-bottom{
  margin-top:14px;
  min-height:52px;
  display:grid;
  place-items:center;
  border-radius:14px;
  background:rgba(255,255,255,.72);
  border:1px dashed #cbd5e1;
  color:#64748b;
  font-weight:1000;
}

.notice-pro-right{
  padding:24px;
  border-radius:24px;
  background:#ffffff;
  border:1px solid #e5e7eb;
  box-shadow:0 18px 42px rgba(15,23,42,.16);
}

.notice-pro-admin-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:14px;
  margin-bottom:18px;
}

.notice-pro-admin-head h2{
  margin:0;
  color:#111827;
  font-size:24px;
  font-weight:1000;
}

.notice-pro-admin-head small{
  color:#64748b;
  font-size:13px;
  font-weight:800;
}

.notice-pro-admin-head button{
  min-height:38px;
  padding:8px 14px;
  border:0;
  border-radius:12px;
  background:#f1f5f9;
  color:#334155;
  font-weight:1000;
}

.notice-pro-admin-head button.primary{
  background:#2563eb;
  color:#ffffff;
}

.notice-pro-table{
  display:grid;
  border:1px solid #e5e7eb;
  border-radius:14px;
  overflow:hidden;
}

.notice-pro-table-head,
.notice-pro-table-row{
  display:grid;
  grid-template-columns:120px 110px 1fr 150px;
  align-items:center;
}

.notice-pro-table.compact .notice-pro-table-head,
.notice-pro-table.compact .notice-pro-table-row{
  grid-template-columns:120px 1fr 150px;
}

.notice-pro-table-head{
  min-height:44px;
  background:#f8fafc;
  color:#475569;
  font-size:13px;
  font-weight:1000;
}

.notice-pro-table-head span,
.notice-pro-table-row span{
  padding:10px 12px;
}

.notice-pro-table-row{
  min-height:54px;
  border-top:1px solid #e5e7eb;
  color:#111827;
  font-size:13px;
  font-weight:900;
}

.notice-pro-actions{
  display:flex;
  gap:7px;
  justify-content:flex-end;
}

.notice-pro-actions button{
  min-width:54px;
  min-height:32px;
  border:0;
  border-radius:9px;
  background:#2563eb;
  color:#ffffff;
  font-weight:1000;
}

.notice-pro-actions button.danger{
  background:#ef4444;
}

.notice-pro-tip{
  margin-top:18px;
  padding:16px;
  border-radius:16px;
  background:linear-gradient(135deg, #fef3c7, #fde68a);
  color:#78350f;
  font-size:13px;
  font-weight:800;
  box-shadow:0 8px 18px rgba(245,158,11,.15);
}

.notice-pro-tip b{
  display:block;
  margin-bottom:8px;
}

.notice-pro-tip p{
  margin:5px 0;
  line-height:1.5;
}

.notice-form-grid{
  display:grid;
  grid-template-columns:220px 1fr;
  gap:12px;
}

.notice-pro-empty{
  padding:24px;
  text-align:center;
  color:#64748b;
  font-weight:1000;
}

@media (max-width:1180px){
  .notice-pro-wrap{
    grid-template-columns:1fr;
  }
}

@media (max-width:900px){
  .notice-pro-wrap{
    gap:12px;
  }

  .notice-pro-left,
  .notice-pro-right{
    padding:18px;
    border-radius:20px;
  }

  .notice-pro-head,
  .notice-pro-admin-head{
    flex-direction:column;
    align-items:stretch;
  }

  .notice-pin{
    display:none;
  }

  .notice-pro-head h2{
    font-size:24px;
  }

  .notice-pro-item{
    grid-template-columns:70px 1fr;
    gap:9px;
  }

  .notice-pro-body p{
    display:none;
  }

  .notice-pro-table{
    border:0;
    gap:8px;
  }

  .notice-pro-table-head{
    display:none;
  }

  .notice-pro-table-row,
  .notice-pro-table.compact .notice-pro-table-row{
    grid-template-columns:1fr;
    border:1px solid #e5e7eb;
    border-radius:14px;
    overflow:hidden;
  }

  .notice-pro-actions{
    justify-content:flex-start;
    padding:0 12px 12px;
  }

  .notice-form-grid{
    grid-template-columns:1fr;
  }
}

/* ===== Notice Page Fix: view-only and readable ===== */
.notice-pro-wrap.notice-only{
  grid-template-columns:1fr;
}

.notice-pro-wrap.notice-only .notice-pro-left{
  max-width:none;
}

.notice-pro-wrap.notice-only .notice-pro-body{
  display:flex;
  align-items:center;
  gap:14px;
  min-height:72px;
}

.notice-pro-wrap.notice-only .notice-pro-badge-row{
  margin:0;
  flex:0 0 auto;
}

.notice-pro-wrap.notice-only .notice-pro-body h3{
  display:block;
  margin:0;
  color:#111827 !important;
  font-size:16px;
  font-weight:1000;
  line-height:1.45;
  text-align:left;
}

.notice-pro-wrap.notice-only .notice-pro-item{
  grid-template-columns:86px 1fr;
}

@media (max-width:900px){
  .notice-pro-wrap.notice-only .notice-pro-body{
    display:grid;
    gap:7px;
  }

  .notice-pro-wrap.notice-only .notice-pro-body h3{
    font-size:14px;
  }
}

/* ===== Notice alignment hotfix ===== */
.notice-pro-list{
  margin-top:14px;
}

.notice-pro-item{
  align-items:center !important;
}

.notice-pro-body{
  display:flex !important;
  align-items:center !important;
  gap:14px !important;
}

.notice-pro-badge-row{
  margin:0 !important;
  flex:0 0 auto;
}

.notice-pro-body h3{
  margin:0 !important;
  flex:1;
  text-align:left !important;
  color:#111827 !important;
  font-size:17px !important;
  font-weight:900 !important;
  line-height:1.45 !important;
  letter-spacing:-0.02em;
}

.notice-pro-date{
  flex-shrink:0;
}

.notice-pro-empty{
  min-height:160px;
  display:grid;
  place-items:center;
}

@media (max-width:900px){
  .notice-pro-body{
    display:grid !important;
    align-items:start !important;
    gap:7px !important;
  }

  .notice-pro-body h3{
    font-size:14px !important;
  }
}

/* ===== Notice Error Message ===== */
.notice-pro-error{
  margin:0 0 12px;
  padding:12px 14px;
  border-radius:14px;
  background:#fee2e2;
  color:#991b1b;
  font-weight:900;
  border:1px solid #fecaca;
}

/* ===== Notice Auto Sync + Alignment Polish ===== */
.notice-pro-wrap.notice-only .notice-pro-left{
  padding:24px 28px;
}

.notice-pro-wrap.notice-only .notice-pro-list{
  display:grid;
  gap:10px;
  margin-top:16px;
}

.notice-pro-wrap.notice-only .notice-pro-item{
  display:grid;
  grid-template-columns:82px 1fr;
  gap:12px;
  align-items:center !important;
}

.notice-pro-wrap.notice-only .notice-pro-date{
  min-height:64px;
  border-radius:14px;
  background:#ffffff;
  box-shadow:0 4px 12px rgba(15,23,42,.06);
}

.notice-pro-wrap.notice-only .notice-pro-body{
  min-height:64px;
  display:flex !important;
  align-items:center !important;
  gap:14px !important;
  padding:12px 16px !important;
  border-radius:14px;
  background:#ffffff;
  box-shadow:0 4px 12px rgba(15,23,42,.04);
}

.notice-pro-wrap.notice-only .notice-pro-badge-row{
  margin:0 !important;
  flex:0 0 auto;
}

.notice-pro-wrap.notice-only .notice-pro-body h3{
  margin:0 !important;
  flex:1;
  text-align:left !important;
  color:#111827 !important;
  font-size:16px !important;
  font-weight:900 !important;
  line-height:1.45 !important;
  letter-spacing:-0.02em;
}

.notice-pro-wrap.notice-only .notice-pro-body p{
  display:none !important;
}

.notice-pro-wrap.notice-only .notice-pro-empty{
  min-height:150px;
  display:grid;
  place-items:center;
  border-radius:16px;
  background:#ffffff;
  border:1px dashed #cbd5e1;
  color:#64748b;
  font-weight:900;
}

@media (max-width:900px){
  .notice-pro-wrap.notice-only .notice-pro-left{
    padding:18px;
  }

  .notice-pro-wrap.notice-only .notice-pro-item{
    grid-template-columns:70px 1fr;
    gap:9px;
  }

  .notice-pro-wrap.notice-only .notice-pro-body{
    display:grid !important;
    gap:7px !important;
    align-items:start !important;
  }

  .notice-pro-wrap.notice-only .notice-pro-body h3{
    font-size:14px !important;
  }
}

/* ===== Permit Renewal Management Clean UI ===== */
.permit-page{
  padding:26px;
}

.permit-head{
  display:grid;
  grid-template-columns:1fr auto auto;
  gap:14px;
  align-items:start;
  margin-bottom:18px;
}

.permit-head h2{
  margin:0;
  color:#111827;
  font-size:24px;
  font-weight:1000;
}

.permit-head p{
  margin:6px 0 0;
  color:#64748b;
  font-size:14px;
  font-weight:800;
}

.permit-summary{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  justify-content:flex-end;
}

.permit-summary span{
  min-height:38px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:8px 12px;
  border-radius:12px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
  color:#475569;
  font-size:13px;
  font-weight:900;
}

.permit-summary b{
  color:#2563eb;
  font-size:16px;
}

.permit-page .grid5,
.permit-page .grid3{
  gap:12px;
  margin-bottom:12px;
}

.permit-page .right-actions{
  margin:14px 0 18px;
}

.danger-text{
  color:#dc2626;
  font-weight:1000;
}

.warn-text{
  color:#d97706;
  font-weight:1000;
}

.permit-page .scroll-table{
  display:none;
}

.permit-card-list{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:12px;
  margin-top:14px;
}

.permit-card{
  padding:16px;
  border-radius:18px;
  background:#ffffff;
  border:1px solid #e5e7eb;
  box-shadow:0 6px 18px rgba(15,23,42,.06);
}

.permit-card-main{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:14px;
  margin-bottom:14px;
}

.permit-title-area{
  min-width:0;
}

.permit-company{
  display:inline-flex;
  width:max-content;
  max-width:100%;
  padding:4px 9px;
  border-radius:999px;
  background:#eff6ff;
  color:#1d4ed8;
  font-size:12px;
  font-weight:1000;
  margin-bottom:8px;
}

.permit-title-area b{
  display:block;
  color:#111827;
  font-size:17px;
  font-weight:1000;
  line-height:1.35;
  word-break:keep-all;
}

.permit-title-area p{
  margin:5px 0 0;
  color:#64748b;
  font-size:13px;
  font-weight:800;
}

.permit-dday-box{
  min-width:94px;
  display:grid;
  justify-items:end;
  gap:5px;
}

.permit-dday-box span{
  display:inline-flex;
  justify-content:center;
  min-width:68px;
  padding:7px 10px;
  border-radius:999px;
  background:#dcfce7;
  color:#166534;
  font-size:13px;
  font-weight:1000;
}

.permit-dday-box span.warn{
  background:#fef3c7;
  color:#92400e;
}

.permit-dday-box span.danger{
  background:#fee2e2;
  color:#991b1b;
}

.permit-dday-box small{
  color:#64748b;
  font-size:12px;
  font-weight:900;
}

.permit-info-grid{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:8px;
  padding:12px;
  border-radius:14px;
  background:#f8fafc;
  border:1px solid #eef2f7;
}

.permit-info-grid label{
  display:block;
  margin-bottom:4px;
  color:#64748b;
  font-size:11px;
  font-weight:1000;
}

.permit-info-grid p{
  margin:0;
  color:#111827;
  font-size:13px;
  font-weight:800;
  line-height:1.35;
  word-break:break-word;
}

.permit-memo{
  margin-top:10px;
  padding:10px 12px;
  border-radius:12px;
  background:#fffbeb;
  color:#92400e;
  font-size:13px;
  font-weight:800;
  line-height:1.4;
}

.permit-card-actions{
  display:flex;
  justify-content:flex-end;
  gap:8px;
  margin-top:12px;
}

.permit-card-actions button{
  min-height:34px;
  border:0;
  border-radius:10px;
  padding:7px 12px;
  background:#2563eb;
  color:#ffffff;
  font-weight:900;
  cursor:pointer;
}

.permit-card-actions .danger-btn{
  background:#ef4444;
}

@media (max-width:1100px){
  .permit-head{
    grid-template-columns:1fr;
  }

  .permit-summary{
    justify-content:flex-start;
  }

  .permit-card-list{
    grid-template-columns:1fr;
  }
}

@media (max-width:900px){
  .permit-page{
    padding:18px;
  }

  .permit-card{
    padding:14px;
    border-radius:16px;
  }

  .permit-card-main{
    flex-direction:column;
  }

  .permit-dday-box{
    width:100%;
    display:flex;
    justify-content:space-between;
    align-items:center;
  }

  .permit-info-grid{
    grid-template-columns:1fr;
  }
}

/* ===== Permit Company Filter Tabs ===== */
.permit-company-tabs{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  justify-content:flex-end;
}

.permit-company-tabs button{
  min-width:64px;
  min-height:38px;
  border:1px solid #e5e7eb;
  border-radius:12px;
  background:#ffffff;
  color:#334155;
  font-size:13px;
  font-weight:1000;
  cursor:pointer;
  box-shadow:0 4px 10px rgba(15,23,42,.04);
}

.permit-company-tabs button.active{
  background:#facc15;
  border-color:#facc15;
  color:#111827;
}

@media (max-width:1100px){
  .permit-company-tabs{
    justify-content:flex-start;
  }
}

@media (max-width:900px){
  .permit-company-tabs{
    display:grid;
    grid-template-columns:repeat(3, 1fr);
  }

  .permit-company-tabs button{
    width:100%;
  }
}

/* ===== Bulk Transfer Page ===== */
.bulk-transfer-page{
  padding:26px;
}

.bulk-transfer-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:14px;
  margin-bottom:18px;
}

.bulk-transfer-head h2{
  margin:0;
  color:#111827;
  font-size:24px;
  font-weight:1000;
}

.bulk-transfer-head p{
  margin:6px 0 0;
  color:#64748b;
  font-size:14px;
  font-weight:800;
}

.bulk-transfer-filter{
  display:grid;
  grid-template-columns:180px 1fr auto;
  gap:12px;
  align-items:end;
  margin-bottom:16px;
}

.bulk-summary{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  justify-content:flex-end;
}

.bulk-summary span{
  min-height:40px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:8px 12px;
  border-radius:12px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
  color:#475569;
  font-size:13px;
  font-weight:900;
}

.bulk-summary b{
  color:#2563eb;
  font-size:16px;
}

.bulk-transfer-list{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:12px;
}

.bulk-transfer-card{
  padding:16px;
  border-radius:18px;
  background:#ffffff;
  border:1px solid #e5e7eb;
  box-shadow:0 6px 18px rgba(15,23,42,.06);
}

.bulk-transfer-card.missing{
  border-color:#fecaca;
  background:#fff7f7;
}

.bulk-card-main{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:14px;
}

.bulk-card-main b{
  display:block;
  margin-top:7px;
  color:#111827;
  font-size:17px;
  font-weight:1000;
}

.bulk-card-main p{
  margin:5px 0 0;
  color:#64748b;
  font-size:13px;
  font-weight:800;
}

.bulk-card-main strong{
  min-width:max-content;
  color:#111827;
  font-size:18px;
  font-weight:1000;
}

.bulk-status{
  display:inline-flex;
  padding:4px 9px;
  border-radius:999px;
  font-size:12px;
  font-weight:1000;
}

.bulk-status.ok{
  background:#dcfce7;
  color:#166534;
}

.bulk-status.missing{
  background:#fee2e2;
  color:#991b1b;
}

.bulk-card-memo{
  margin-top:12px;
  padding:10px 12px;
  border-radius:12px;
  background:#f8fafc;
  color:#334155;
  font-size:13px;
  font-weight:800;
}

@media (max-width:1100px){
  .bulk-transfer-head{
    flex-direction:column;
  }

  .bulk-transfer-filter{
    grid-template-columns:1fr;
  }

  .bulk-summary{
    justify-content:flex-start;
  }

  .bulk-transfer-list{
    grid-template-columns:1fr;
  }
}

@media (max-width:900px){
  .bulk-transfer-page{
    padding:18px;
  }

  .bulk-card-main{
    flex-direction:column;
  }
}

/* ===== Bulk Transfer Edit Fields ===== */
.bulk-edit-grid{
  display:grid;
  grid-template-columns:90px 1fr 120px 1fr 1fr;
  gap:8px;
  margin-top:12px;
}

.bulk-edit-grid .field{
  margin:0;
}

.bulk-edit-grid label{
  font-size:11px;
  color:#64748b;
  font-weight:1000;
}

.bulk-edit-grid input{
  height:36px;
  font-size:13px;
}

@media (max-width:1100px){
  .bulk-edit-grid{
    grid-template-columns:1fr 1fr;
  }
}

@media (max-width:900px){
  .bulk-edit-grid{
    grid-template-columns:1fr;
  }
}

/* ===== Bulk Transfer Selection Popup ===== */
.bulk-select-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(15,23,42,.58);padding:18px}
.bulk-select-modal{width:min(860px,96vw);max-height:86vh;overflow:hidden;display:grid;grid-template-rows:auto auto 1fr auto;background:#fff;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.35)}
.bulk-select-head{display:flex;justify-content:space-between;gap:14px;padding:22px 24px 14px;border-bottom:1px solid #e5e7eb}
.bulk-select-head h2{margin:0;color:#111827;font-size:22px;font-weight:1000}
.bulk-select-head p{margin:6px 0 0;color:#64748b;font-size:14px;font-weight:800}
.bulk-select-head button,.bulk-select-actions button,.bulk-select-bottom button{border:0;border-radius:12px;padding:9px 14px;background:#f1f5f9;color:#334155;font-weight:1000;cursor:pointer}
.bulk-select-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:14px 24px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
.bulk-select-actions strong{margin-left:auto;color:#111827;font-size:15px;font-weight:1000}
.bulk-select-list{overflow:auto;padding:12px 24px;display:grid;gap:8px}
.bulk-select-row{display:grid;grid-template-columns:28px 1fr 100px 130px;gap:10px;align-items:center;min-height:48px;padding:10px 12px;border-radius:14px;border:1px solid #e5e7eb;background:#fff}
.bulk-select-row.missing{background:#fff7f7;border-color:#fecaca}
.bulk-select-row input{width:18px;height:18px;accent-color:#2563eb}
.bulk-select-row span{color:#111827;font-weight:1000}
.bulk-select-row em{width:max-content;padding:4px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-style:normal;font-size:12px;font-weight:1000}
.bulk-select-row.missing em{background:#fee2e2;color:#991b1b}
.bulk-select-row b{text-align:right;color:#111827;font-weight:1000}
.bulk-select-bottom{display:flex;justify-content:flex-end;gap:8px;padding:16px 24px 22px;border-top:1px solid #e5e7eb}
.bulk-select-bottom .primary{background:#16a34a;color:#fff}
@media (max-width:700px){.bulk-select-row{grid-template-columns:28px 1fr}.bulk-select-row em,.bulk-select-row b{grid-column:2;text-align:left}.bulk-select-actions strong{margin-left:0;width:100%}}

/* ===== Vendor Account Management ===== */
.vendor-account-page{
  padding:26px;
}

.vendor-account-head{
  display:flex;
  justify-content:space-between;
  gap:16px;
  margin-bottom:18px;
}

.vendor-account-head h2{
  margin:0;
  color:#111827;
  font-size:24px;
  font-weight:1000;
}

.vendor-account-head p{
  margin:6px 0 0;
  color:#64748b;
  font-size:14px;
  font-weight:800;
}

.vendor-account-list{
  display:grid;
  gap:14px;
}

.vendor-account-card{
  padding:18px;
  border-radius:20px;
  background:#fff;
  border:1px solid #e5e7eb;
  box-shadow:0 6px 18px rgba(15,23,42,.06);
}

.vendor-account-title{
  margin-bottom:14px;
}

.vendor-account-title strong{
  color:#111827;
  font-size:18px;
  font-weight:1000;
}

.vendor-account-grid{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:10px;
}

.vendor-account-bottom{
  display:flex;
  justify-content:flex-end;
  margin-top:14px;
}

.vendor-account-bottom .primary{
  min-width:120px;
}

@media (max-width:1200px){
  .vendor-account-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}

@media (max-width:700px){
  .vendor-account-head{
    flex-direction:column;
  }

  .vendor-account-grid{
    grid-template-columns:1fr;
  }
}

/* ===== Inline Date Picker ===== */
.date-input-wrap{
  position:relative;
  width:100%;
}

.date-input-wrap .date-text-input{
  width:100%;
  padding-right:46px;
}

.date-picker-input{
  position:absolute;
  right:0;
  top:0;
  width:44px;
  height:100%;
  opacity:0;
  cursor:pointer;
  z-index:3;
}

.date-picker-icon{
  position:absolute;
  right:14px;
  top:50%;
  transform:translateY(-50%);
  pointer-events:none;
  font-size:17px;
  line-height:1;
  opacity:.72;
  z-index:2;
}

.date-input-wrap:focus-within .date-picker-icon{
  opacity:1;
}

/* ===== Receipt Photo Register ===== */
.receipt-photo-page{
  padding:26px;
}

.receipt-photo-head{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  margin-bottom:18px;
}

.receipt-photo-head h2{
  margin:0;
  color:#111827;
  font-size:24px;
  font-weight:1000;
}

.receipt-photo-head p{
  margin:6px 0 0;
  color:#64748b;
  font-size:14px;
  font-weight:800;
}

.receipt-photo-form{
  display:grid;
  grid-template-columns:180px minmax(220px, 1fr) minmax(280px, 1.4fr) 220px;
  gap:12px;
  align-items:start;
  padding:16px;
  border-radius:20px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
  margin-bottom:18px;
}

.receipt-photo-form textarea{
  width:100%;
  resize:vertical;
  min-height:88px;
  border-radius:14px;
  border:1px solid #cbd5e1;
  padding:12px 14px;
  font-family:inherit;
  font-weight:800;
  box-sizing:border-box;
}

.receipt-photo-upload{
  min-height:48px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  border-radius:14px;
  background:#2563eb;
  color:#ffffff;
  font-weight:1000;
  cursor:pointer;
}

.receipt-photo-upload input{
  display:none;
}

.receipt-photo-selected{
  margin-top:8px;
  color:#2563eb;
  font-size:13px;
  font-weight:900;
}

.receipt-photo-list{
  display:grid;
  gap:12px;
}

.receipt-photo-card{
  padding:16px;
  border-radius:20px;
  background:#ffffff;
  border:1px solid #e5e7eb;
  box-shadow:0 6px 18px rgba(15,23,42,.06);
}

.receipt-photo-card.processed{
  background:#f8fafc;
  opacity:.82;
}

.receipt-photo-card-head{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
}

.receipt-photo-card-head span{
  display:inline-flex;
  padding:4px 9px;
  border-radius:999px;
  font-size:12px;
  font-weight:1000;
  margin-bottom:8px;
}

.receipt-photo-card-head span.pending{
  background:#fee2e2;
  color:#991b1b;
}

.receipt-photo-card-head span.processed{
  background:#dcfce7;
  color:#166534;
}

.receipt-photo-card-head b{
  display:block;
  color:#111827;
  font-size:17px;
  font-weight:1000;
}

.receipt-photo-card-head p{
  margin:5px 0 0;
  color:#64748b;
  font-size:13px;
  font-weight:800;
}

.receipt-photo-memo{
  margin-top:12px;
  padding:12px 14px;
  border-radius:14px;
  background:#fffbeb;
  color:#92400e;
  font-size:14px;
  font-weight:800;
  line-height:1.45;
}

.receipt-photo-thumbs{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-top:12px;
}

.receipt-photo-thumbs img{
  width:92px;
  height:92px;
  object-fit:cover;
  border-radius:14px;
  border:1px solid #e5e7eb;
  cursor:pointer;
}

.receipt-photo-more{
  width:92px;
  height:92px;
  display:grid;
  place-items:center;
  border-radius:14px;
  background:#f1f5f9;
  color:#475569;
  font-weight:1000;
}

.receipt-photo-preview-backdrop{
  position:fixed;
  inset:0;
  z-index:99999;
  display:grid;
  place-items:center;
  background:rgba(15,23,42,.62);
  padding:18px;
}

.receipt-photo-preview{
  width:min(960px, 96vw);
  max-height:88vh;
  overflow:auto;
  background:#ffffff;
  border-radius:24px;
  padding:22px;
  box-shadow:0 30px 90px rgba(0,0,0,.35);
}

.receipt-photo-preview-head{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  margin-bottom:14px;
}

.receipt-photo-preview-head h2{
  margin:0;
  color:#111827;
  font-size:22px;
  font-weight:1000;
}

.receipt-photo-preview-head p{
  margin:5px 0 0;
  color:#64748b;
  font-weight:800;
}

.receipt-photo-preview-images{
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));
  gap:12px;
}

.receipt-photo-preview-images img{
  width:100%;
  max-height:520px;
  object-fit:contain;
  border-radius:16px;
  border:1px solid #e5e7eb;
  background:#f8fafc;
}

@media (max-width:1100px){
  .receipt-photo-form{
    grid-template-columns:1fr 1fr;
  }
}

@media (max-width:900px){
  .receipt-photo-page{
    padding:18px;
  }

  .receipt-photo-head,
  .receipt-photo-card-head{
    flex-direction:column;
  }

  .receipt-photo-form{
    grid-template-columns:1fr;
    padding:14px;
  }

  .receipt-photo-thumbs img,
  .receipt-photo-more{
    width:74px;
    height:74px;
  }
}

/* ===== Receipt Photo Preview Mobile Fix ===== */
.receipt-photo-preview-backdrop{
  align-items:start !important;
  place-items:start center !important;
  padding:18px !important;
  overflow:auto !important;
}

.receipt-photo-preview{
  width:min(980px, 96vw) !important;
  max-height:none !important;
  overflow:visible !important;
  margin:24px auto 90px !important;
  padding:16px !important;
}

.receipt-photo-preview-head{
  position:sticky;
  top:0;
  z-index:2;
  display:flex !important;
  justify-content:space-between !important;
  align-items:flex-start !important;
  gap:12px !important;
  padding:6px 4px 14px !important;
  margin-bottom:12px !important;
  background:#ffffff;
  border-bottom:1px solid #e5e7eb;
}

.receipt-photo-preview-head h2{
  margin:0 !important;
  color:#111827 !important;
  font-size:22px !important;
  font-weight:1000 !important;
  line-height:1.25 !important;
}

.receipt-photo-preview-head p{
  margin:6px 0 0 !important;
  color:#64748b !important;
  font-size:15px !important;
  font-weight:900 !important;
}

.receipt-photo-preview-head span{
  display:block;
  margin-top:8px;
  color:#334155;
  font-size:14px;
  font-weight:800;
  line-height:1.45;
}

.receipt-photo-preview-head button{
  min-width:72px;
  min-height:46px;
  border:0;
  border-radius:16px;
  background:#e2e8f0;
  color:#111827;
  font-size:15px;
  font-weight:1000;
}

.receipt-photo-preview-images{
  display:grid !important;
  grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)) !important;
  gap:12px !important;
}

.receipt-photo-preview-images a{
  display:block;
  border-radius:18px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
  overflow:hidden;
}

.receipt-photo-preview-images img{
  display:block !important;
  width:100% !important;
  height:auto !important;
  max-height:none !important;
  object-fit:contain !important;
  border:0 !important;
  border-radius:0 !important;
}

.receipt-photo-no-image{
  min-height:180px;
  display:grid;
  place-items:center;
  border-radius:18px;
  background:#f8fafc;
  border:1px dashed #cbd5e1;
  color:#64748b;
  font-size:16px;
  font-weight:1000;
}

@media (max-width:700px){
  .receipt-photo-preview-backdrop{
    padding:10px !important;
  }

  .receipt-photo-preview{
    width:calc(100vw - 20px) !important;
    margin:10px auto 90px !important;
    padding:14px !important;
    border-radius:22px !important;
  }

  .receipt-photo-preview-head h2{
    font-size:20px !important;
  }

  .receipt-photo-preview-images{
    grid-template-columns:1fr !important;
  }
}

/* ===== Receipt Photo Clean Redesign ===== */
.receipt-photo-page-clean{
  padding:28px !important;
}

.receipt-clean-title{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:14px;
  margin-bottom:22px;
}

.receipt-clean-icon{
  width:52px;
  height:52px;
  display:grid;
  place-items:center;
  border-radius:18px;
  background:#eff6ff;
  color:#2563eb;
  font-size:26px;
  box-shadow:0 8px 18px rgba(37,99,235,.14);
}

.receipt-clean-title h2{
  margin:0;
  color:#111827;
  font-size:26px;
  font-weight:1000;
}

.receipt-clean-title p{
  margin:6px 0 0;
  color:#64748b;
  font-size:14px;
  font-weight:800;
}

.receipt-refresh-btn{
  min-height:42px;
  border:0;
  border-radius:14px;
  padding:0 16px;
  background:#f1f5f9;
  color:#334155;
  font-weight:1000;
  cursor:pointer;
}

.receipt-clean-form-wrap{
  display:grid;
  grid-template-columns:1fr 0.9fr;
  gap:16px;
  margin-bottom:24px;
}

.receipt-clean-form-card,
.receipt-clean-upload-card{
  padding:22px;
  border-radius:24px;
  background:#ffffff;
  border:1px solid #e5e7eb;
  box-shadow:0 8px 24px rgba(15,23,42,.05);
}

.receipt-card-section-title{
  margin-bottom:16px;
  color:#2563eb;
  font-size:16px;
  font-weight:1000;
}

.receipt-clean-grid{
  display:grid;
  grid-template-columns:220px 1fr;
  gap:12px;
}

.receipt-clean-textarea{
  width:100%;
  min-height:128px;
  resize:vertical;
  border-radius:16px;
  border:1px solid #cbd5e1;
  padding:14px 16px;
  font-family:inherit;
  font-size:14px;
  font-weight:800;
  line-height:1.5;
  box-sizing:border-box;
}

.receipt-submit-clean{
  width:100%;
  min-height:52px;
  margin-top:14px;
  border:0;
  border-radius:16px;
  background:linear-gradient(135deg,#16a34a,#15803d);
  color:#ffffff;
  font-size:16px;
  font-weight:1000;
  cursor:pointer;
  box-shadow:0 12px 22px rgba(22,163,74,.18);
}

.receipt-dropzone{
  min-height:208px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  border-radius:22px;
  border:2px dashed #93c5fd;
  background:linear-gradient(180deg,#eff6ff,#ffffff);
  cursor:pointer;
  transition:.16s ease;
}

.receipt-dropzone:hover{
  transform:translateY(-2px);
  border-color:#2563eb;
}

.receipt-dropzone input{
  display:none;
}

.receipt-drop-icon{
  width:52px;
  height:52px;
  display:grid;
  place-items:center;
  border-radius:999px;
  background:#2563eb;
  color:#ffffff;
  font-size:26px;
  font-weight:1000;
}

.receipt-dropzone strong{
  color:#111827;
  font-size:18px;
  font-weight:1000;
}

.receipt-dropzone span{
  color:#64748b;
  font-size:13px;
  font-weight:800;
}

.receipt-file-count{
  margin-top:12px;
  text-align:right;
  color:#2563eb;
  font-size:14px;
  font-weight:1000;
}

.receipt-list-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  margin:4px 0 14px;
}

.receipt-list-head h3{
  margin:0;
  color:#111827;
  font-size:22px;
  font-weight:1000;
}

.receipt-list-head p{
  margin:6px 0 0;
  color:#64748b;
  font-size:14px;
  font-weight:900;
}

.receipt-clean-list{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(330px,1fr));
  gap:14px;
}

.receipt-clean-card{
  padding:18px;
  border-radius:22px;
  background:#ffffff;
  border:1px solid #e5e7eb;
  box-shadow:0 8px 24px rgba(15,23,42,.05);
}

.receipt-clean-card.pending{
  border-left:6px solid #ef4444;
}

.receipt-clean-card.processed{
  border-left:6px solid #16a34a;
  background:#fbfefc;
}

.receipt-clean-card-top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  margin-bottom:10px;
}

.receipt-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:28px;
  padding:0 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:1000;
}

.receipt-badge.pending{
  background:#fee2e2;
  color:#991b1b;
}

.receipt-badge.processed{
  background:#dcfce7;
  color:#166534;
}

.receipt-clean-card-top small{
  color:#64748b;
  font-size:12px;
  font-weight:900;
}

.receipt-vendor-name{
  display:block;
  color:#111827;
  font-size:18px;
  font-weight:1000;
  line-height:1.3;
}

.receipt-created-by{
  margin:6px 0 0;
  color:#64748b;
  font-size:13px;
  font-weight:800;
}

.receipt-clean-memo{
  margin-top:12px;
  min-height:46px;
  padding:12px 14px;
  border-radius:14px;
  background:#f8fafc;
  color:#334155;
  font-size:14px;
  font-weight:800;
  line-height:1.45;
}

.receipt-clean-thumbs{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
  margin-top:12px;
}

.receipt-clean-thumbs img,
.receipt-no-thumb,
.receipt-more-thumb{
  width:100%;
  aspect-ratio:1/0.72;
  border-radius:14px;
  border:1px solid #e5e7eb;
  background:#f8fafc;
  object-fit:cover;
}

.receipt-clean-thumbs img{
  cursor:pointer;
}

.receipt-no-thumb,
.receipt-more-thumb{
  display:grid;
  place-items:center;
  color:#64748b;
  font-size:13px;
  font-weight:1000;
}

.receipt-clean-actions{
  display:grid;
  grid-template-columns:1fr 1fr auto;
  gap:8px;
  margin-top:14px;
}

.receipt-clean-actions button{
  min-height:40px;
  border:0;
  border-radius:12px;
  background:#e2e8f0;
  color:#111827;
  font-size:13px;
  font-weight:1000;
  cursor:pointer;
}

.receipt-clean-actions .complete{
  background:#16a34a;
  color:#ffffff;
}

.receipt-clean-actions .delete{
  background:#ef4444;
  color:#ffffff;
  padding:0 14px;
}

.receipt-clean-empty{
  grid-column:1/-1;
  min-height:220px;
  display:grid;
  place-items:center;
  border-radius:22px;
  background:#ffffff;
  border:1px dashed #cbd5e1;
  color:#64748b;
  font-size:17px;
  font-weight:1000;
}

@media (max-width:1100px){
  .receipt-clean-form-wrap{
    grid-template-columns:1fr;
  }
}

@media (max-width:900px){
  .receipt-photo-page-clean{
    padding:18px !important;
  }

  .receipt-clean-title{
    grid-template-columns:auto 1fr;
  }

  .receipt-refresh-btn{
    grid-column:1/-1;
    width:100%;
  }

  .receipt-clean-grid{
    grid-template-columns:1fr;
  }

  .receipt-clean-form-card,
  .receipt-clean-upload-card{
    padding:16px;
    border-radius:20px;
  }

  .receipt-dropzone{
    min-height:150px;
  }

  .receipt-clean-list{
    grid-template-columns:1fr;
  }

  .receipt-clean-actions{
    grid-template-columns:1fr;
  }
}

/* ===== Mobile Quick Start Menu ===== */
.mobile-quick-start{
  display:none;
}

@media (max-width:900px){
  .mobile-quick-start{
    position:fixed;
    inset:0;
    z-index:100000;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:22px;
    background:#0f172a;
  }

  .mobile-quick-card{
    width:100%;
    max-width:430px;
    display:grid;
    gap:16px;
  }

  .mobile-quick-logo{
    min-height:132px;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    border-radius:30px;
    background:linear-gradient(135deg,#2563eb,#4f46e5);
    color:#ffffff;
    box-shadow:0 18px 42px rgba(37,99,235,.32);
  }

  .mobile-quick-logo strong{
    font-size:34px;
    font-weight:1000;
    letter-spacing:-1px;
  }

  .mobile-quick-logo span{
    margin-top:10px;
    font-size:18px;
    font-weight:900;
    opacity:.9;
  }

  .mobile-quick-title{
    padding:4px 4px 0;
  }

  .mobile-quick-title h2{
    margin:0;
    color:#ffffff;
    font-size:24px;
    font-weight:1000;
  }

  .mobile-quick-title p{
    margin:6px 0 0;
    color:#cbd5e1;
    font-size:15px;
    font-weight:800;
  }

  .mobile-quick-btn{
    width:100%;
    min-height:92px;
    display:flex;
    align-items:center;
    gap:16px;
    border:0;
    border-radius:26px;
    padding:18px;
    background:#ffffff;
    color:#111827;
    text-align:left;
    box-shadow:0 14px 30px rgba(0,0,0,.18);
  }

  .mobile-quick-btn span{
    width:54px;
    height:54px;
    display:grid;
    place-items:center;
    border-radius:18px;
    font-size:28px;
    flex:none;
  }

  .mobile-quick-btn.photo span{
    background:#dbeafe;
  }

  .mobile-quick-btn.maint span{
    background:#fef3c7;
  }

  .mobile-quick-btn.home span{
    background:#dcfce7;
  }

  .mobile-quick-btn b{
    display:block;
    color:#111827;
    font-size:21px;
    font-weight:1000;
    line-height:1.25;
  }

  .mobile-quick-btn small{
    display:block;
    margin-top:5px;
    color:#64748b;
    font-size:13px;
    font-weight:800;
  }
}

/* ===== Maintenance Photo Register ===== */
.receipt-clean-icon.maint{
  background:#fef3c7;
  color:#92400e;
}

.maintenance-dropzone{
  border-color:#fbbf24 !important;
  background:linear-gradient(180deg,#fffbeb,#ffffff) !important;
}

.maintenance-submit{
  background:linear-gradient(135deg,#f59e0b,#d97706) !important;
  box-shadow:0 12px 22px rgba(245,158,11,.18) !important;
}

.maintenance-urgent-check{
  display:flex;
  align-items:center;
  gap:8px;
  margin-top:10px;
  color:#b91c1c;
  font-size:14px;
  font-weight:1000;
}

.maintenance-urgent-check input{
  width:18px;
  height:18px;
  accent-color:#dc2626;
}

.maintenance-urgent-badge{
  display:inline-flex;
  width:max-content;
  margin-top:8px;
  padding:5px 10px;
  border-radius:999px;
  background:#fee2e2;
  color:#991b1b;
  font-size:12px;
  font-weight:1000;
}

.maintenance-photo-page-clean .receipt-clean-card.pending{
  border-left-color:#f59e0b;
}

/* ===== Ensure Maintenance Photo Menu Visible ===== */
.menu .dropdown,
.menu .submenu,
.nav-dropdown,
.dropdown-menu{
  overflow:visible !important;
  z-index:9999 !important;
}

/* ===== Fixed Maintenance Dropdown Menu ===== */
.maint-menu-group .maint-sub{
  min-width:160px !important;
  height:auto !important;
  max-height:none !important;
  overflow:visible !important;
  z-index:99999 !important;
}

.maint-menu-group:hover .maint-sub,
.maint-menu-group:focus-within .maint-sub{
  display:block !important;
}

.maint-menu-group .maint-sub button{
  display:block !important;
  width:160px !important;
  min-height:38px !important;
  white-space:nowrap !important;
}

@media (max-width:900px){
  .maint-menu-group .maint-sub{
    display:none;
  }

  .maint-menu-group:hover .maint-sub,
  .maint-menu-group:focus-within .maint-sub{
    display:grid !important;
  }

  .maint-menu-group .maint-sub button{
    width:100% !important;
  }
}

/* ===== Force Maintenance Dropdown 4 Items ===== */
.maint-menu-group{
  position:relative !important;
}

.maint-menu-group .maint-sub{
  display:none;
  position:absolute !important;
  top:100% !important;
  left:0 !important;
  z-index:999999 !important;
  min-width:170px !important;
  height:auto !important;
  max-height:none !important;
  overflow:visible !important;
  padding-top:6px !important;
  background:transparent !important;
}

.maint-menu-group:hover .maint-sub,
.maint-menu-group:focus-within .maint-sub{
  display:flex !important;
  flex-direction:column !important;
}

.maint-menu-group .maint-sub button{
  display:block !important;
  width:170px !important;
  min-height:38px !important;
  height:38px !important;
  padding:9px 12px !important;
  background:#ffffff !important;
  color:#111827 !important;
  border:0 !important;
  border-radius:0 !important;
  text-align:left !important;
  white-space:nowrap !important;
}

.maint-menu-group .maint-sub button:first-child{
  border-radius:10px 10px 0 0 !important;
}

.maint-menu-group .maint-sub button:last-child{
  border-radius:0 0 10px 10px !important;
}

@media (max-width:900px){
  .maint-menu-group .maint-sub{
    position:fixed !important;
    top:132px !important;
    left:12px !important;
    right:12px !important;
    width:auto !important;
    min-width:0 !important;
    padding:10px !important;
    background:#ffffff !important;
    border:1px solid #e5e7eb !important;
    border-radius:16px !important;
    box-shadow:0 12px 30px rgba(15,23,42,.18) !important;
  }

  .maint-menu-group:hover .maint-sub,
  .maint-menu-group:focus-within .maint-sub{
    display:grid !important;
    grid-template-columns:1fr 1fr !important;
    gap:8px !important;
  }

  .maint-menu-group .maint-sub button{
    width:100% !important;
    border-radius:12px !important;
    background:#f8fafc !important;
    border:1px solid #e5e7eb !important;
  }
}

/* ===== Standalone Maintenance Photo Button ===== */
.menu > button.maintenance-photo-standalone,
.menu button[onclick*="maintenance_photos"]{
  white-space:nowrap;
}

/* ===== Clean Maintenance Dropdown Fixed ===== */
.menu .maint-menu-group{
  position:relative !important;
}

.menu .maint-menu-group .maint-sub{
  display:none !important;
  position:absolute !important;
  top:100% !important;
  left:0 !important;
  z-index:999999 !important;
  width:170px !important;
  min-width:170px !important;
  height:auto !important;
  max-height:none !important;
  overflow:visible !important;
  padding:6px 0 0 0 !important;
  background:transparent !important;
}

.menu .maint-menu-group:hover .maint-sub,
.menu .maint-menu-group:focus-within .maint-sub{
  display:flex !important;
  flex-direction:column !important;
}

.menu .maint-menu-group .maint-sub button{
  display:block !important;
  width:170px !important;
  min-width:170px !important;
  height:40px !important;
  min-height:40px !important;
  padding:9px 13px !important;
  margin:0 !important;
  border:0 !important;
  border-radius:0 !important;
  background:#ffffff !important;
  color:#111827 !important;
  text-align:left !important;
  font-size:14px !important;
  font-weight:500 !important;
  white-space:nowrap !important;
  box-shadow:none !important;
}

.menu .maint-menu-group .maint-sub button:first-child{
  border-radius:10px 10px 0 0 !important;
}

.menu .maint-menu-group .maint-sub button:last-child{
  border-radius:0 0 10px 10px !important;
}

.menu .maint-menu-group .maint-sub button:hover{
  background:#f1f5f9 !important;
}

@media (max-width:900px){
  .menu .maint-menu-group .maint-sub{
    position:fixed !important;
    top:132px !important;
    left:12px !important;
    right:12px !important;
    width:auto !important;
    min-width:0 !important;
    padding:10px !important;
    background:#ffffff !important;
    border:1px solid #e5e7eb !important;
    border-radius:16px !important;
    box-shadow:0 12px 30px rgba(15,23,42,.18) !important;
  }

  .menu .maint-menu-group:hover .maint-sub,
  .menu .maint-menu-group:focus-within .maint-sub{
    display:grid !important;
    grid-template-columns:1fr 1fr !important;
    gap:8px !important;
  }

  .menu .maint-menu-group .maint-sub button{
    width:100% !important;
    min-width:0 !important;
    border-radius:12px !important;
    background:#f8fafc !important;
    border:1px solid #e5e7eb !important;
  }
}

/* ===== Maintenance Photo Menu Visibility Final Fix ===== */
.menu-group .sub{
  height:auto !important;
  max-height:none !important;
  overflow:visible !important;
  z-index:999999 !important;
}

.menu-group:hover .sub,
.menu-group:focus-within .sub{
  display:block !important;
}

.menu-group .sub button{
  display:block !important;
  visibility:visible !important;
  opacity:1 !important;
  width:170px !important;
  min-height:40px !important;
  height:40px !important;
  line-height:1.2 !important;
}

@media (max-width:900px){
  .mobile-sheet,
  .mobile-sheet-panel,
  .mobile-sheet-content{
    height:auto !important;
    max-height:none !important;
    overflow:visible !important;
  }

  .mobile-sheet button,
  .mobile-sheet-panel button,
  .mobile-sheet-content button{
    display:flex !important;
    visibility:visible !important;
    opacity:1 !important;
  }
}

/* ===== Maintenance Dropdown Font Match ===== */
.menu .maint-menu-group .maint-sub button{
  font-weight:500 !important;
  letter-spacing:0 !important;
}

/* ===== Maintenance Dropdown Same Weight ===== */
.menu .maint-menu-group .maint-sub button{
  font-family: inherit !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  letter-spacing: 0 !important;
}

/* ===== Mobile Logout Button ===== */
.mobile-quick-logout{
  width:100%;
  min-height:54px;
  border:0;
  border-radius:20px;
  background:#ef4444;
  color:#ffffff;
  font-size:17px;
  font-weight:1000;
  box-shadow:0 12px 26px rgba(239,68,68,.25);
}

.mobile-sheet-logout{
  background:#ef4444 !important;
  color:#ffffff !important;
  font-weight:1000 !important;
}

/* ===== Mobile Full Menu Visibility + Font Normalize ===== */
@media (max-width:900px){
  html, body, #root, .app{
    font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",Arial,sans-serif !important;
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }

  .app{
    min-height:100dvh !important;
    height:auto !important;
    overflow-x:hidden !important;
    overflow-y:auto !important;
    padding-bottom:96px !important;
  }

  .card{
    height:auto !important;
    min-height:0 !important;
    max-height:none !important;
    overflow:visible !important;
  }

  .table-wrap,
  .scroll-table{
    width:100% !important;
    max-width:100% !important;
    height:auto !important;
    max-height:none !important;
    overflow-x:auto !important;
    overflow-y:visible !important;
    -webkit-overflow-scrolling:touch !important;
  }

  input, textarea, select{
    font-size:16px !important;
    font-weight:700 !important;
  }

  button{
    font-weight:900 !important;
  }
}

/* ===== Mobile Purchase Lookup Cards ===== */
.mobile-purchase-cards{
  display:none;
}

@media (max-width:900px){
  .mobile-purchase-cards{
    display:grid !important;
    gap:12px;
    margin-top:18px;
  }

  .mobile-purchase-card{
    display:block;
    padding:16px;
    border-radius:18px;
    background:#ffffff;
    border:1px solid #e5e7eb;
    box-shadow:0 8px 20px rgba(15,23,42,.07);
  }

  .mobile-purchase-card-head{
    display:flex;
    justify-content:space-between;
    gap:10px;
    align-items:flex-start;
    margin-bottom:10px;
  }

  .mobile-purchase-card-head strong{
    color:#111827;
    font-size:17px;
    font-weight:1000;
    line-height:1.3;
  }

  .mobile-purchase-card-head span{
    color:#64748b;
    font-size:13px;
    font-weight:800;
    white-space:nowrap;
  }

  .mobile-purchase-card-row{
    display:flex;
    justify-content:space-between;
    gap:10px;
    padding:7px 0;
    border-top:1px solid #f1f5f9;
    color:#334155;
    font-size:14px;
    font-weight:800;
  }

  .mobile-purchase-card-row b{
    color:#111827;
    font-weight:1000;
    text-align:right;
  }

  .mobile-purchase-card-actions{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
    margin-top:12px;
  }

  .mobile-purchase-card-actions button{
    min-height:40px;
    border:0;
    border-radius:12px;
    background:#e2e8f0;
    color:#111827;
    font-size:14px;
    font-weight:1000;
  }
}

/* ===== Mobile All Menu Audit Fix ===== */
@media (max-width:900px){
  html,
  body,
  #root{
    width:100% !important;
    min-height:100% !important;
    height:auto !important;
    overflow-x:hidden !important;
    overflow-y:auto !important;
    font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",Arial,sans-serif !important;
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }

  .app{
    width:100% !important;
    min-height:100dvh !important;
    height:auto !important;
    overflow-x:hidden !important;
    overflow-y:visible !important;
    padding:14px 10px 104px !important;
  }

  .hero{
    border-radius:28px !important;
    padding:34px 18px !important;
    margin-bottom:14px !important;
  }

  .main-title{
    font-size:34px !important;
    letter-spacing:-1px !important;
    line-height:1.16 !important;
  }

  .hero p{
    font-size:17px !important;
    letter-spacing:1px !important;
  }

  .card{
    width:100% !important;
    height:auto !important;
    min-height:0 !important;
    max-height:none !important;
    overflow:visible !important;
    padding:18px !important;
    border-radius:24px !important;
  }

  .card h2{
    font-size:26px !important;
    line-height:1.25 !important;
    margin:0 0 18px !important;
    text-align:center !important;
    color:#111827 !important;
  }

  .card h3{
    display:block !important;
    visibility:visible !important;
    opacity:1 !important;
    margin:22px 0 10px !important;
    color:#111827 !important;
    font-size:19px !important;
    font-weight:1000 !important;
  }

  .between{
    display:flex !important;
    flex-direction:column !important;
    align-items:stretch !important;
    gap:10px !important;
  }

  .between button{
    width:100% !important;
    justify-content:center !important;
    min-height:50px !important;
    font-size:16px !important;
  }

  .grid2,
  .grid3,
  .grid5,
  .two{
    display:grid !important;
    grid-template-columns:1fr !important;
    gap:12px !important;
    width:100% !important;
  }

  .field,
  .item-search,
  .status-cards,
  .dashboard-wrap,
  .dashboard-panel,
  .dashboard-card,
  .notice-pro-wrap,
  .receipt-clean-list,
  .receipt-photo-list,
  .vendor-account-list{
    display:block !important;
    visibility:visible !important;
    opacity:1 !important;
    width:100% !important;
    max-width:100% !important;
    height:auto !important;
    max-height:none !important;
    overflow:visible !important;
  }

  input,
  textarea,
  select{
    width:100% !important;
    min-height:52px !important;
    font-size:16px !important;
    font-weight:700 !important;
    border-radius:16px !important;
    font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",Arial,sans-serif !important;
  }

  textarea{
    min-height:120px !important;
  }

  button{
    font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",Arial,sans-serif !important;
    font-weight:900 !important;
  }

  .status-cards{
    display:grid !important;
    grid-template-columns:1fr !important;
    gap:12px !important;
    margin:18px 0 !important;
  }

  .status-cards > div{
    display:flex !important;
    flex-direction:column !important;
    justify-content:center !important;
    min-height:92px !important;
    padding:18px !important;
    border-radius:20px !important;
    background:#ffffff !important;
    border:1px solid #e5e7eb !important;
    box-shadow:0 8px 20px rgba(15,23,42,.06) !important;
  }

  .status-cards span{
    display:block !important;
    color:#64748b !important;
    font-size:14px !important;
    font-weight:900 !important;
    margin-bottom:8px !important;
  }

  .status-cards b{
    display:block !important;
    color:#111827 !important;
    font-size:22px !important;
    font-weight:1000 !important;
    line-height:1.35 !important;
    word-break:break-word !important;
  }

  .scroll-table,
  .table-wrap,
  .table-container{
    display:block !important;
    visibility:visible !important;
    opacity:1 !important;
    width:100% !important;
    max-width:100% !important;
    height:auto !important;
    max-height:none !important;
    overflow-x:auto !important;
    overflow-y:visible !important;
    -webkit-overflow-scrolling:touch !important;
    margin:10px 0 20px !important;
    border-radius:18px !important;
  }

  .scroll-table table,
  .table-wrap table,
  table{
    display:table !important;
    width:100% !important;
    min-width:680px !important;
    table-layout:auto !important;
  }

  th,
  td{
    font-size:13px !important;
    line-height:1.35 !important;
    white-space:nowrap !important;
  }

  .empty{
    display:table-cell !important;
    height:86px !important;
    text-align:center !important;
    color:#64748b !important;
    font-weight:900 !important;
  }

  .maint-detail-text{
    display:inline-block !important;
    max-width:260px !important;
    white-space:normal !important;
    word-break:break-word !important;
  }

  .mobile-purchase-cards{
    display:grid !important;
  }

  .mobile-bottom-nav{
    display:grid !important;
    z-index:100000 !important;
  }

  .mobile-more-sheet{
    z-index:100001 !important;
    max-height:78dvh !important;
    overflow-y:auto !important;
  }
}

/* PC에서는 구매조회 모바일 카드 숨김 유지 */
@media (min-width:901px){
  .mobile-purchase-cards{
    display:none !important;
  }
}

/* ===== Update Popup Compact + Closable ===== */
.update-popup-backdrop{
  padding:18px !important;
  align-items:center !important;
  overflow:auto !important;
}

.update-popup{
  width:min(560px, 94vw) !important;
  max-height:78dvh !important;
  overflow:auto !important;
  border-radius:24px !important;
}

.update-popup-head{
  position:sticky !important;
  top:0 !important;
  z-index:2 !important;
  background:#ffffff !important;
  padding-bottom:10px !important;
}

.update-popup-head button{
  min-width:42px !important;
  min-height:42px !important;
  border-radius:999px !important;
  background:#ef4444 !important;
  color:#ffffff !important;
  font-size:22px !important;
  font-weight:1000 !important;
  justify-content:center !important;
}

.update-popup ul{
  max-height:32dvh !important;
  overflow:auto !important;
  padding-right:4px !important;
}

.update-popup li{
  display:grid !important;
  grid-template-columns:92px 1fr !important;
  gap:8px !important;
  align-items:start !important;
}

.update-popup li span{
  display:-webkit-box !important;
  -webkit-line-clamp:2 !important;
  -webkit-box-orient:vertical !important;
  overflow:hidden !important;
  line-height:1.4 !important;
}

.update-popup-bottom{
  position:sticky !important;
  bottom:0 !important;
  background:#ffffff !important;
  padding-top:12px !important;
}

.update-popup-bottom .primary{
  min-height:46px !important;
  justify-content:center !important;
}

@media (max-width:900px){
  .update-popup{
    max-height:72dvh !important;
  }

  .update-popup li{
    grid-template-columns:1fr !important;
  }

  .update-popup li strong{
    font-size:12px !important;
  }
}

/* ===== Photo To Register Link Buttons ===== */
.receipt-clean-actions{
  grid-template-columns:repeat(auto-fit,minmax(92px,1fr)) !important;
}

.receipt-clean-actions .link{
  background:#2563eb !important;
  color:#ffffff !important;
}

.receipt-submit-clean:disabled{
  opacity:.62;
  cursor:not-allowed;
}

/* ===== Unified Excel/PDF Download Buttons ===== */
.between > button,
.bulk-download-btn,
.bulk-transfer-download,
button[class*="excel"],
button[class*="download"]{
  min-height:46px;
  border-radius:16px !important;
  padding:0 18px !important;
  background:linear-gradient(135deg,#2563eb,#1d4ed8) !important;
  color:#ffffff !important;
  font-weight:1000 !important;
  box-shadow:0 10px 22px rgba(37,99,235,.20) !important;
  justify-content:center !important;
}

.between{
  gap:10px !important;
  align-items:center !important;
}

.receipt-clean-actions .secondary{
  background:#475569 !important;
  color:#ffffff !important;
}

@media (max-width:900px){
  .between > button{
    width:100% !important;
  }
}

/* ===== Unified Page Header / Download Button Alignment ===== */
.card > .between:first-child{
  display:grid !important;
  grid-template-columns:1fr auto auto !important;
  align-items:center !important;
  gap:10px !important;
  margin-bottom:16px !important;
}

.card > .between:first-child h2{
  margin:0 !important;
  text-align:left !important;
  justify-self:start !important;
}

.card > .between:first-child button{
  justify-self:end !important;
  min-width:118px !important;
  min-height:42px !important;
  border-radius:14px !important;
  padding:0 16px !important;
}

.card > .between:first-child button:first-of-type{
  grid-column:auto !important;
}

.card > .between:first-child button + button{
  margin-left:0 !important;
}

@media (max-width:900px){
  .card > .between:first-child{
    grid-template-columns:1fr !important;
    gap:10px !important;
  }

  .card > .between:first-child h2{
    text-align:center !important;
    justify-self:center !important;
  }

  .card > .between:first-child button{
    width:100% !important;
    justify-self:stretch !important;
  }
}

/* 구매조회 필터와 표 간격 정리 */
.card > .grid5 + .mobile-purchase-cards,
.card > .grid5 + .scroll-table{
  margin-top:12px !important;
}

/* ===== Photo Link Picker Modal ===== */
.photo-link-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:100002;
  display:grid;
  place-items:center;
  padding:20px;
  background:rgba(15,23,42,.55);
}

.photo-link-modal{
  width:min(760px, 96vw);
  max-height:82dvh;
  overflow:auto;
  border-radius:24px;
  background:#ffffff;
  padding:20px;
  box-shadow:0 24px 80px rgba(15,23,42,.35);
}

.photo-link-head{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  margin-bottom:14px;
}

.photo-link-head h2{
  margin:0;
  font-size:24px;
  font-weight:1000;
}

.photo-link-head p{
  margin:6px 0 0;
  color:#64748b;
  font-weight:800;
}

.photo-link-head button{
  background:#e2e8f0;
  font-weight:1000;
}

.photo-link-search{
  margin-bottom:14px;
}

.photo-link-list{
  display:grid;
  gap:10px;
}

.photo-link-item{
  width:100%;
  display:grid;
  grid-template-columns:1fr auto;
  gap:12px;
  align-items:center;
  text-align:left;
  padding:14px;
  border-radius:18px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
}

.photo-link-item strong{
  display:block;
  font-size:16px;
  color:#111827;
  font-weight:1000;
}

.photo-link-item span{
  display:block;
  margin-top:4px;
  color:#64748b;
  font-size:13px;
  font-weight:800;
}

.photo-link-item p{
  margin:6px 0 0;
  color:#334155;
  font-weight:800;
}

.mobile-purchase-card-actions,
.mobile-card-actions{
  grid-template-columns:repeat(auto-fit,minmax(84px,1fr)) !important;
}

@media (max-width:900px){
  .photo-link-modal-backdrop{
    padding:12px;
    place-items:end center;
  }

  .photo-link-modal{
    width:100%;
    max-height:86dvh;
    border-radius:24px 24px 0 0;
  }

  .photo-link-item{
    grid-template-columns:1fr;
  }
}

/* ===== Mobile Receipt/Maintenance Photo Action Buttons Visible ===== */
@media (max-width:900px){
  .receipt-clean-list,
  .receipt-clean-card,
  .receipt-clean-actions{
    overflow:visible !important;
    height:auto !important;
    max-height:none !important;
  }

  .receipt-clean-actions{
    display:grid !important;
    grid-template-columns:1fr 1fr !important;
    gap:10px !important;
    width:100% !important;
    margin-top:16px !important;
  }

  .receipt-clean-actions button{
    display:flex !important;
    visibility:visible !important;
    opacity:1 !important;
    width:100% !important;
    min-width:0 !important;
    min-height:48px !important;
    height:auto !important;
    padding:11px 8px !important;
    border-radius:14px !important;
    justify-content:center !important;
    align-items:center !important;
    font-size:14px !important;
    font-weight:1000 !important;
    line-height:1.25 !important;
    white-space:normal !important;
    word-break:keep-all !important;
  }

  .receipt-clean-actions .link{
    background:#2563eb !important;
    color:#ffffff !important;
  }

  .receipt-clean-actions .secondary{
    background:#475569 !important;
    color:#ffffff !important;
  }

  .receipt-clean-actions .complete{
    background:#16a34a !important;
    color:#ffffff !important;
  }

  .receipt-clean-actions .delete{
    background:#ef4444 !important;
    color:#ffffff !important;
  }
}

@media (max-width:430px){
  .receipt-clean-actions{
    grid-template-columns:1fr !important;
  }
}

/* ===== Mobile Photo Cards Compact Action Buttons FINAL ===== */
@media (max-width:900px){
  .receipt-clean-card{
    padding:18px !important;
    border-radius:24px !important;
    overflow:visible !important;
    height:auto !important;
    max-height:none !important;
  }

  .receipt-clean-thumb,
  .receipt-clean-card img{
    max-width:96px !important;
    max-height:78px !important;
    border-radius:12px !important;
    object-fit:cover !important;
  }

  .receipt-clean-actions{
    display:grid !important;
    grid-template-columns:1fr 1fr !important;
    gap:8px !important;
    width:100% !important;
    margin-top:12px !important;
    overflow:visible !important;
    height:auto !important;
    max-height:none !important;
  }

  .receipt-clean-actions button{
    display:flex !important;
    visibility:visible !important;
    opacity:1 !important;
    width:100% !important;
    min-width:0 !important;
    min-height:38px !important;
    height:38px !important;
    padding:6px 8px !important;
    border-radius:12px !important;
    justify-content:center !important;
    align-items:center !important;
    font-size:12px !important;
    font-weight:1000 !important;
    line-height:1.15 !important;
    white-space:normal !important;
    word-break:keep-all !important;
  }

  .receipt-clean-actions .link{
    background:#2563eb !important;
    color:#ffffff !important;
  }

  .receipt-clean-actions .secondary{
    background:#475569 !important;
    color:#ffffff !important;
  }

  .receipt-clean-actions .complete{
    background:#16a34a !important;
    color:#ffffff !important;
  }

  .receipt-clean-actions .delete{
    background:#ef4444 !important;
    color:#ffffff !important;
  }

  .receipt-clean-actions button:nth-child(5){
    grid-column:1 / -1 !important;
  }
}

@media (max-width:380px){
  .receipt-clean-actions button{
    font-size:11px !important;
    padding:5px 6px !important;
  }
}

/* ===== Lookup Pages Full Height Layout ===== */
.lookup-page{
  min-height:calc(100vh - 230px) !important;
  display:flex !important;
  flex-direction:column !important;
}

.lookup-page > .scroll-table,
.lookup-page .scroll-table{
  flex:1 1 auto !important;
  min-height:430px !important;
  max-height:calc(100vh - 355px) !important;
  overflow:auto !important;
}

.lookup-page table{
  width:100% !important;
}

.purchase-lookup-page,
.maint-lookup-page{
  padding-bottom:20px !important;
}

/* 정비 드롭다운 글씨를 다른 메뉴와 동일하게 */
.menu .maint-menu-group .maint-sub button,
.menu-group .sub button{
  font-size:12px !important;
  font-weight:700 !important;
  line-height:1.2 !important;
  letter-spacing:0 !important;
}

.menu .maint-menu-group .maint-sub{
  min-width:96px !important;
}

@media (min-width:901px){
  .lookup-page{
    min-height:calc(100vh - 215px) !important;
  }

  .lookup-page > .scroll-table,
  .lookup-page .scroll-table{
    min-height:470px !important;
    max-height:calc(100vh - 340px) !important;
  }
}

@media (max-width:900px){
  .lookup-page{
    min-height:auto !important;
    display:block !important;
  }

  .lookup-page .scroll-table{
    min-height:0 !important;
    max-height:none !important;
  }
}

/* ===== Card Lookup Split Menu ===== */
.card-lookup-page{
  min-height:calc(100vh - 215px) !important;
  display:flex !important;
  flex-direction:column !important;
}

.card-lookup-page > .scroll-table,
.card-lookup-page .scroll-table{
  flex:1 1 auto !important;
  min-height:470px !important;
  max-height:calc(100vh - 340px) !important;
  overflow:auto !important;
}

@media (max-width:900px){
  .card-lookup-page{
    min-height:auto !important;
    display:block !important;
  }

  .card-lookup-page .scroll-table{
    min-height:0 !important;
    max-height:none !important;
  }
}

/* ===== Unified Download / Print Buttons Final ===== */
.card > .between:first-child,
.lookup-page > .between:first-child,
.card-lookup-page > .between:first-child{
  display:grid !important;
  grid-template-columns:1fr auto auto !important;
  align-items:center !important;
  gap:10px !important;
  margin-bottom:14px !important;
}

.card > .between:first-child h2,
.lookup-page > .between:first-child h2,
.card-lookup-page > .between:first-child h2{
  justify-self:start !important;
  text-align:left !important;
  margin:0 !important;
}

.card > .between:first-child button,
.lookup-page > .between:first-child button,
.card-lookup-page > .between:first-child button,
.bulk-transfer-download,
button[onclick*="downloadExcel"],
button[onclick*="downloadPdf"]{
  min-width:112px !important;
  min-height:42px !important;
  height:42px !important;
  padding:0 16px !important;
  border:0 !important;
  border-radius:14px !important;
  background:linear-gradient(135deg,#2563eb,#1d4ed8) !important;
  color:#ffffff !important;
  font-size:13px !important;
  font-weight:1000 !important;
  box-shadow:0 10px 22px rgba(37,99,235,.22) !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  white-space:nowrap !important;
}

.card > .between:first-child button:hover,
.lookup-page > .between:first-child button:hover,
.card-lookup-page > .between:first-child button:hover,
.bulk-transfer-download:hover{
  transform:translateY(-1px);
  filter:brightness(1.03);
}

@media (max-width:900px){
  .card > .between:first-child,
  .lookup-page > .between:first-child,
  .card-lookup-page > .between:first-child{
    grid-template-columns:1fr !important;
  }

  .card > .between:first-child h2,
  .lookup-page > .between:first-child h2,
  .card-lookup-page > .between:first-child h2{
    justify-self:center !important;
    text-align:center !important;
  }

  .card > .between:first-child button,
  .lookup-page > .between:first-child button,
  .card-lookup-page > .between:first-child button{
    width:100% !important;
  }
}

/* 정비조회 상단 버튼 묶음 통일 */
.maint-lookup-page > .between:first-child > div{
  display:flex !important;
  gap:10px !important;
  justify-self:end !important;
}

@media (max-width:900px){
  .maint-lookup-page > .between:first-child > div{
    display:grid !important;
    grid-template-columns:1fr !important;
    width:100% !important;
  }
}

/* ===== Maintenance Lookup Attachment Thumbnail Match ===== */
.maint-lookup-page .attachment-group,
.mobile-card-list-maints .attachment-group,
.maint-modal-attachments .attachment-group{
  display:flex !important;
  gap:6px !important;
  align-items:center !important;
  justify-content:center !important;
  flex-wrap:wrap !important;
}

.maint-lookup-page .attachment-preview,
.mobile-card-list-maints .attachment-preview,
.maint-modal-attachments .attachment-preview{
  width:42px !important;
  height:42px !important;
  border-radius:10px !important;
  overflow:hidden !important;
  border:1px solid #e5e7eb !important;
  background:#f8fafc !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
}

.maint-lookup-page .attachment-preview img,
.mobile-card-list-maints .attachment-preview img,
.maint-modal-attachments .attachment-preview img{
  width:100% !important;
  height:100% !important;
  object-fit:cover !important;
}

.maint-modal-attachments{
  display:flex;
  align-items:center;
  gap:10px;
  margin:12px 0;
  padding:10px 12px;
  border-radius:14px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
}

@media (max-width:900px){
  .mobile-card-list-maints .attachment-preview{
    width:56px !important;
    height:56px !important;
  }

  .maint-modal-attachments{
    display:grid;
    gap:8px;
  }
}

/* ===== Maintenance Schedule Feature ===== */
.schedule-priority,
.schedule-status{
  display:inline-flex;
  min-width:48px;
  justify-content:center;
  padding:5px 8px;
  border-radius:999px;
  font-weight:1000;
  font-size:12px;
}
.schedule-priority.긴급{ background:#fee2e2; color:#b91c1c; }
.schedule-priority.높음{ background:#ffedd5; color:#c2410c; }
.schedule-priority.보통{ background:#e0f2fe; color:#0369a1; }
.schedule-priority.낮음{ background:#dcfce7; color:#15803d; }
.schedule-status.예정{ background:#ffedd5; color:#c2410c; }
.schedule-status.진행중{ background:#dbeafe; color:#1d4ed8; }
.schedule-status.완료{ background:#dcfce7; color:#15803d; }
.maintenance-schedule-page,
.maintenance-schedule-list-page{
  min-height:calc(100vh - 215px) !important;
}
.maintenance-schedule-list-page .scroll-table{
  flex:1 1 auto;
  min-height:430px;
  max-height:calc(100vh - 360px);
  overflow:auto;
}
@media (max-width:900px){
  .maintenance-schedule-page,
  .maintenance-schedule-list-page{ min-height:auto !important; }
  .maintenance-schedule-list-page .scroll-table{ min-height:0; max-height:none; }
}

/* ===== Maintenance Schedule Pro Redesign ===== */
.maintenance-schedule-pro-page,
.maintenance-schedule-pro-list{
  min-height:calc(100vh - 210px);
  background:#f8fafc;
  border-radius:24px;
  padding:22px;
  box-shadow:0 18px 45px rgba(15,23,42,.10);
}

.schedule-pro-hero,
.schedule-list-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:18px;
  margin-bottom:18px;
}

.schedule-pro-eyebrow{
  display:inline-flex;
  padding:6px 10px;
  border-radius:999px;
  background:#dbeafe;
  color:#1d4ed8;
  font-size:12px;
  font-weight:1000;
  margin-bottom:8px;
}

.schedule-pro-hero h2,
.schedule-list-head h2{
  margin:0;
  font-size:28px;
  color:#0f172a;
  font-weight:1000;
  letter-spacing:-.5px;
}

.schedule-pro-hero p,
.schedule-list-head p{
  margin:8px 0 0;
  color:#64748b;
  font-weight:800;
}

.schedule-pro-ghost,
.schedule-list-head > button{
  min-height:44px;
  border:0;
  border-radius:14px;
  padding:0 18px;
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:#fff;
  font-weight:1000;
  box-shadow:0 12px 25px rgba(37,99,235,.22);
}

.schedule-pro-layout{
  display:grid;
  grid-template-columns:minmax(0,1.6fr) minmax(320px,.8fr);
  gap:18px;
}

.schedule-pro-form-card,
.schedule-pro-preview,
.schedule-table-card,
.schedule-filter-card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:22px;
  padding:18px;
  box-shadow:0 10px 28px rgba(15,23,42,.06);
}

.schedule-pro-card-title{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:14px;
}

.schedule-pro-card-title b{
  color:#0f172a;
  font-size:18px;
  font-weight:1000;
}

.schedule-pro-card-title span{
  color:#2563eb;
  font-weight:1000;
}

.schedule-pro-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:14px;
}

.schedule-pro-form-card textarea{
  min-height:118px;
  resize:vertical;
}

.schedule-pro-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:14px;
}

.schedule-pro-actions button{
  min-height:44px;
  border-radius:14px;
  padding:0 18px;
  font-weight:1000;
}

.schedule-pro-side{
  display:grid;
  gap:14px;
}

.schedule-pro-mini-card,
.schedule-summary-card{
  border-radius:22px;
  padding:18px;
  border:1px solid rgba(148,163,184,.22);
  box-shadow:0 10px 28px rgba(15,23,42,.06);
}

.schedule-pro-mini-card span,
.schedule-summary-card span{
  display:block;
  font-size:13px;
  font-weight:1000;
  margin-bottom:8px;
}

.schedule-pro-mini-card b,
.schedule-summary-card b{
  display:block;
  font-size:30px;
  color:#0f172a;
  font-weight:1000;
  line-height:1;
}

.schedule-pro-mini-card small,
.schedule-summary-card small{
  display:block;
  margin-top:8px;
  color:#64748b;
  font-weight:800;
}

.schedule-pro-mini-card.blue,
.schedule-summary-card.blue{background:linear-gradient(135deg,#eff6ff,#dbeafe);}
.schedule-pro-mini-card.red,
.schedule-summary-card.red{background:linear-gradient(135deg,#fff1f2,#fee2e2);}
.schedule-pro-mini-card.green,
.schedule-summary-card.green{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
.schedule-summary-card.purple{background:linear-gradient(135deg,#f5f3ff,#ede9fe);}

.schedule-pro-preview-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px 0;
  border-top:1px solid #f1f5f9;
}

.schedule-pro-preview-row strong{
  display:block;
  color:#0f172a;
  font-weight:1000;
}

.schedule-pro-preview-row p{
  margin:4px 0 0;
  color:#64748b;
  font-weight:800;
}

.schedule-pro-empty{
  padding:24px;
  text-align:center;
  color:#94a3b8;
  font-weight:900;
  background:#f8fafc;
  border-radius:16px;
}

.schedule-summary-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:14px;
  margin-bottom:16px;
}

.schedule-filter-card{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr)) auto;
  gap:12px;
  align-items:end;
  margin-bottom:16px;
}

.schedule-reset-btn{
  min-height:42px;
  border:0;
  border-radius:14px;
  background:#e2e8f0;
  color:#334155;
  font-weight:1000;
  padding:0 16px;
}

.schedule-table-card{
  padding:0;
  overflow:hidden;
}

.schedule-table-card .scroll-table{
  margin:0 !important;
  border-radius:0 !important;
  max-height:calc(100vh - 480px);
  min-height:360px;
}

.schedule-table-card th{
  background:#eef4fb !important;
  color:#0f172a !important;
  font-weight:1000 !important;
}

.schedule-table-card td{
  height:46px;
}

.schedule-row-actions{
  display:flex;
  justify-content:center;
  gap:6px;
}

.schedule-row-actions button{
  min-height:30px;
  border:0;
  border-radius:9px;
  padding:0 9px;
  background:#e2e8f0;
  color:#0f172a;
  font-size:12px;
  font-weight:1000;
}

.schedule-row-actions .danger{
  background:#fee2e2;
  color:#b91c1c;
}

.schedule-priority,
.schedule-status{
  display:inline-flex;
  min-width:52px;
  justify-content:center;
  padding:5px 9px;
  border-radius:999px;
  font-weight:1000;
  font-size:12px;
}

.schedule-priority.긴급{ background:#fee2e2; color:#b91c1c; }
.schedule-priority.높음{ background:#ffedd5; color:#c2410c; }
.schedule-priority.보통{ background:#dbeafe; color:#1d4ed8; }
.schedule-priority.낮음{ background:#dcfce7; color:#15803d; }
.schedule-status.예정{ background:#ffedd5; color:#c2410c; }
.schedule-status.진행중{ background:#dbeafe; color:#1d4ed8; }
.schedule-status.완료{ background:#dcfce7; color:#15803d; }

@media (max-width:1100px){
  .schedule-pro-layout{grid-template-columns:1fr;}
  .schedule-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  .schedule-filter-card{grid-template-columns:repeat(2,minmax(0,1fr));}
}

@media (max-width:900px){
  .maintenance-schedule-pro-page,
  .maintenance-schedule-pro-list{
    padding:16px;
    border-radius:22px;
    min-height:auto;
  }

  .schedule-pro-hero,
  .schedule-list-head{
    display:grid;
  }

  .schedule-pro-hero h2,
  .schedule-list-head h2{
    font-size:24px;
    text-align:left !important;
  }

  .schedule-pro-grid,
  .schedule-summary-grid,
  .schedule-filter-card{
    grid-template-columns:1fr;
  }

  .schedule-pro-actions{
    display:grid;
    grid-template-columns:1fr 1fr;
  }

  .schedule-table-card{
    display:none;
  }

  .schedule-mobile-list{
    display:grid !important;
  }
}

/* ===== Maintenance Schedule Modern Polish + Equipment Select ===== */
.maintenance-schedule-pro-page{
  background:linear-gradient(180deg,#f8fafc 0%,#eef4fb 100%) !important;
  border:1px solid rgba(148,163,184,.24) !important;
}

.schedule-pro-hero{
  padding:6px 4px 8px !important;
}

.schedule-pro-hero h2{
  font-size:30px !important;
  letter-spacing:-.8px !important;
}

.schedule-pro-layout{
  grid-template-columns:minmax(0,1.45fr) minmax(360px,.75fr) !important;
  align-items:start !important;
}

.schedule-pro-form-card{
  padding:24px !important;
  border-radius:28px !important;
  background:rgba(255,255,255,.94) !important;
  box-shadow:0 20px 60px rgba(15,23,42,.08) !important;
}

.schedule-pro-card-title.modern{
  padding:0 0 16px !important;
  border-bottom:1px solid #eef2f7 !important;
}

.schedule-pro-card-title.modern small{
  display:block;
  margin-top:5px;
  color:#64748b;
  font-weight:800;
}

.schedule-pro-grid{
  grid-template-columns:repeat(3,minmax(0,1fr)) !important;
  gap:16px !important;
  margin-top:18px !important;
}

.schedule-pro-form-card .field label{
  font-size:13px !important;
  color:#334155 !important;
  font-weight:1000 !important;
  margin-bottom:7px !important;
}

.schedule-pro-form-card input,
.schedule-pro-form-card select,
.schedule-pro-form-card textarea{
  min-height:48px !important;
  border-radius:16px !important;
  border:1px solid #d8e1ee !important;
  background:#ffffff !important;
  font-size:14px !important;
  font-weight:800 !important;
  padding:0 14px !important;
  transition:.18s ease !important;
}

.schedule-pro-form-card textarea{
  padding:14px !important;
  min-height:110px !important;
}

.schedule-pro-form-card input:focus,
.schedule-pro-form-card select:focus,
.schedule-pro-form-card textarea:focus{
  outline:none !important;
  border-color:#2563eb !important;
  box-shadow:0 0 0 4px rgba(37,99,235,.12) !important;
}

.schedule-equipment-chips{
  margin:14px 0 16px;
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
  padding:12px;
  border-radius:18px;
  background:#f8fafc;
  border:1px dashed #cbd5e1;
}

.schedule-equipment-chips span{
  color:#64748b;
  font-size:12px;
  font-weight:1000;
  margin-right:2px;
}

.schedule-equipment-chips button{
  min-height:32px;
  border:0;
  border-radius:999px;
  padding:0 12px;
  background:#e0ecff;
  color:#1d4ed8;
  font-size:12px;
  font-weight:1000;
}

.schedule-equipment-chips button:hover{
  background:#2563eb;
  color:#fff;
}

.schedule-pro-actions{
  padding-top:14px;
  border-top:1px solid #eef2f7;
}

.schedule-pro-actions .primary{
  background:linear-gradient(135deg,#16a34a,#15803d) !important;
  color:#fff !important;
  border:0 !important;
  box-shadow:0 12px 24px rgba(22,163,74,.24);
}

.schedule-pro-actions button:not(.primary){
  border:0 !important;
  background:#e2e8f0 !important;
  color:#334155 !important;
}

.schedule-pro-side{
  gap:12px !important;
}

.schedule-pro-mini-card{
  min-height:106px !important;
  display:flex !important;
  flex-direction:column !important;
  justify-content:center !important;
  border-radius:24px !important;
}

.schedule-pro-mini-card b{
  font-size:32px !important;
}

.schedule-pro-preview{
  border-radius:24px !important;
}

@media (max-width:1200px){
  .schedule-pro-layout{
    grid-template-columns:1fr !important;
  }

  .schedule-pro-grid{
    grid-template-columns:repeat(2,minmax(0,1fr)) !important;
  }
}

@media (max-width:900px){
  .schedule-pro-grid{
    grid-template-columns:1fr !important;
  }

  .schedule-equipment-chips{
    display:grid;
    grid-template-columns:1fr 1fr;
  }

  .schedule-equipment-chips span{
    grid-column:1 / -1;
  }

  .schedule-pro-actions{
    grid-template-columns:1fr !important;
  }
}


/* ===== Purchase Item Detail Modal ===== */
.purchase-item-detail-button{
  border:0;
  background:transparent;
  color:#2563eb;
  font:inherit;
  font-weight:1000;
  padding:0;
  cursor:pointer;
  text-decoration:underline;
  text-underline-offset:3px;
}
.purchase-detail-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:10000;
  background:rgba(15,23,42,.45);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
}
.purchase-detail-modal{
  width:min(980px,96vw);
  max-height:88vh;
  overflow:auto;
  background:#fff;
  border-radius:22px;
  padding:20px;
  box-shadow:0 30px 90px rgba(15,23,42,.35);
}
.purchase-detail-modal-head{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  margin-bottom:14px;
}
.purchase-detail-modal-head h2{
  margin:0;
  font-size:24px;
  font-weight:1000;
  color:#0f172a;
}
.purchase-detail-modal-head p{
  margin:6px 0 0;
  color:#64748b;
  font-weight:800;
}
.purchase-detail-modal-head button{
  border:0;
  border-radius:12px;
  padding:10px 14px;
  background:#e2e8f0;
  font-weight:1000;
  cursor:pointer;
}
.purchase-detail-table th{
  white-space:nowrap;
}
.purchase-detail-total{
  display:flex;
  flex-wrap:wrap;
  justify-content:flex-end;
  gap:10px;
  margin-top:14px;
}
.purchase-detail-total span,
.purchase-detail-total b{
  display:inline-flex;
  align-items:center;
  min-height:38px;
  padding:0 14px;
  border-radius:999px;
  background:#f1f5f9;
  color:#0f172a;
  font-weight:1000;
}
.purchase-detail-total b{
  background:#dbeafe;
  color:#1d4ed8;
}

/* ===== Home Dashboard Pro Redesign ===== */
.dashboard-pro-wrap{
  padding:22px;
  border-radius:24px;
  background:linear-gradient(180deg,#f8fafc 0%,#eef4fb 100%);
  box-shadow:0 18px 50px rgba(15,23,42,.10);
  min-height:calc(100vh - 210px);
}

.dashboard-pro-hero{
  display:flex;
  justify-content:space-between;
  gap:18px;
  align-items:flex-start;
  margin-bottom:18px;
}

.dashboard-pro-hero span{
  display:inline-flex;
  padding:6px 10px;
  border-radius:999px;
  background:#dbeafe;
  color:#1d4ed8;
  font-size:12px;
  font-weight:1000;
}

.dashboard-pro-hero h2{
  margin:8px 0 4px;
  color:#0f172a;
  font-size:30px;
  font-weight:1000;
  letter-spacing:-.7px;
}

.dashboard-pro-hero p{
  margin:0;
  color:#64748b;
  font-weight:800;
}

.dashboard-pro-date{
  min-height:40px;
  display:flex;
  align-items:center;
  padding:0 14px;
  border-radius:14px;
  background:#fff;
  color:#0f172a;
  font-weight:1000;
  box-shadow:0 8px 20px rgba(15,23,42,.06);
}

.dashboard-pro-kpis{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:14px;
  margin-bottom:16px;
}

.dashboard-pro-kpi{
  text-align:left;
  border:0;
  border-radius:22px;
  padding:18px;
  min-height:128px;
  box-shadow:0 14px 34px rgba(15,23,42,.08);
  cursor:pointer;
}

.dashboard-pro-kpi span{
  display:block;
  font-size:13px;
  font-weight:1000;
  margin-bottom:10px;
}

.dashboard-pro-kpi b{
  display:block;
  color:#0f172a;
  font-size:28px;
  font-weight:1000;
}

.dashboard-pro-kpi em{
  display:block;
  margin-top:8px;
  color:#64748b;
  font-size:12px;
  font-style:normal;
  font-weight:900;
}

.dashboard-pro-kpi.blue{background:linear-gradient(135deg,#eff6ff,#dbeafe);}
.dashboard-pro-kpi.red{background:linear-gradient(135deg,#fff1f2,#fee2e2);}
.dashboard-pro-kpi.green{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
.dashboard-pro-kpi.purple{background:linear-gradient(135deg,#f5f3ff,#ede9fe);}

.dashboard-pro-main{
  display:grid;
  grid-template-columns:minmax(0,1.65fr) minmax(330px,.75fr);
  gap:16px;
}

.dashboard-pro-left,
.dashboard-pro-right{
  display:grid;
  gap:16px;
  align-content:start;
}

.dashboard-pro-split{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:16px;
}

.dashboard-pro-panel{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:22px;
  padding:16px;
  box-shadow:0 10px 26px rgba(15,23,42,.06);
  overflow:hidden;
}

.dashboard-pro-panel-head{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
  margin-bottom:12px;
}

.dashboard-pro-panel h3{
  margin:0;
  color:#0f172a;
  font-size:18px;
  font-weight:1000;
}

.dashboard-pro-panel p{
  margin:5px 0 0;
  color:#64748b;
  font-weight:800;
  font-size:12px;
}

.dashboard-pro-panel-head button{
  border:0;
  border-radius:12px;
  min-height:34px;
  padding:0 12px;
  background:#e0ecff;
  color:#1d4ed8;
  font-weight:1000;
}

.dashboard-schedule-list{
  display:grid;
  gap:8px;
}

.dashboard-schedule-row{
  display:grid;
  grid-template-columns:1fr auto auto;
  gap:10px;
  align-items:center;
  padding:12px;
  border-radius:16px;
  background:#f8fafc;
  border:1px solid #edf2f7;
}

.dashboard-schedule-row strong{
  color:#0f172a;
  font-weight:1000;
}

.dashboard-schedule-row p{
  margin:4px 0 0;
  color:#64748b;
  font-weight:800;
}

.dashboard-pro-table{
  width:100%;
  border-collapse:collapse;
  font-size:13px;
}

.dashboard-pro-table th{
  background:#eef4fb;
  color:#334155;
  font-weight:1000;
  padding:10px;
}

.dashboard-pro-table td{
  border-bottom:1px solid #f1f5f9;
  padding:10px;
  color:#334155;
  font-weight:800;
}

.dashboard-photo-feed,
.dashboard-mini-list{
  display:grid;
  gap:10px;
}

.dashboard-photo-row{
  display:grid;
  grid-template-columns:58px 1fr;
  gap:10px;
  text-align:left;
  border:0;
  border-radius:16px;
  padding:10px;
  background:#f8fafc;
}

.dashboard-photo-thumb{
  width:58px;
  height:58px;
  border-radius:14px;
  background:#e2e8f0;
  overflow:hidden;
  display:grid;
  place-items:center;
  color:#64748b;
  font-size:12px;
  font-weight:1000;
}

.dashboard-photo-thumb img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.dashboard-photo-row strong,
.dashboard-mini-row b{
  display:block;
  color:#0f172a;
  font-weight:1000;
}

.dashboard-photo-row p,
.dashboard-photo-row small,
.dashboard-mini-row em{
  display:block;
  margin-top:3px;
  color:#64748b;
  font-style:normal;
  font-weight:800;
}

.dashboard-mini-row{
  padding:10px 0;
  border-bottom:1px solid #f1f5f9;
}

.dashboard-mini-row span{
  display:block;
  color:#2563eb;
  font-size:12px;
  font-weight:1000;
  margin-bottom:3px;
}

.dashboard-pro-empty{
  padding:22px;
  text-align:center;
  color:#94a3b8;
  font-weight:900;
  background:#f8fafc;
  border-radius:16px;
}

@media (max-width:1200px){
  .dashboard-pro-main,
  .dashboard-pro-split{
    grid-template-columns:1fr;
  }
  .dashboard-pro-kpis{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}

@media (max-width:900px){
  .dashboard-pro-wrap{
    padding:16px;
    min-height:auto;
  }
  .dashboard-pro-hero{
    display:grid;
  }
  .dashboard-pro-kpis{
    grid-template-columns:1fr;
  }
  .dashboard-schedule-row{
    grid-template-columns:1fr;
  }
}

/* ===== Dashboard Mobile Text Overflow Fix + Recent Purchases ===== */
.dashboard-pro-table{
  table-layout:fixed;
}

.dashboard-pro-table th,
.dashboard-pro-table td{
  word-break:keep-all;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.dashboard-purchase-vendor-row{
  grid-template-columns:1.25fr .75fr;
}

@media (max-width:900px){
  .dashboard-pro-panel{
    overflow:hidden;
  }

  .dashboard-mobile-stack{
    display:block;
  }

  .dashboard-mobile-stack thead{
    display:none;
  }

  .dashboard-mobile-stack tbody{
    display:grid;
    gap:10px;
  }

  .dashboard-mobile-stack tr{
    display:grid;
    gap:6px;
    padding:12px;
    border-radius:16px;
    background:#f8fafc;
    border:1px solid #e5e7eb;
  }

  .dashboard-mobile-stack td{
    display:grid;
    grid-template-columns:74px 1fr;
    gap:8px;
    border:0 !important;
    padding:0 !important;
    white-space:normal !important;
    overflow:visible !important;
    text-overflow:clip !important;
    word-break:break-word !important;
    text-align:left !important;
    font-size:13px;
  }

  .dashboard-mobile-stack td::before{
    content:attr(data-label);
    color:#64748b;
    font-weight:1000;
  }

  .dashboard-mobile-stack td.right{
    text-align:left !important;
  }

  .dashboard-pro-table td,
  .dashboard-pro-table th{
    white-space:normal !important;
  }

  .dashboard-purchase-vendor-row{
    grid-template-columns:1fr !important;
  }
}

/* ===== Mobile Dashboard Polish + UI Consistency ===== */
.dashboard-pro-wrap{
  padding:20px;
}

.dashboard-pro-panel{
  transition:all .18s ease;
}

.dashboard-pro-panel:hover{
  transform:translateY(-2px);
  box-shadow:0 18px 38px rgba(15,23,42,.10);
}

.dashboard-pro-panel h3{
  letter-spacing:-.4px;
}

.dashboard-pro-panel-head button,
.dashboard-pro-kpi,
.excel-download-btn,
.pdf-download-btn{
  transition:all .15s ease;
}

.dashboard-pro-panel-head button:hover,
.excel-download-btn:hover,
.pdf-download-btn:hover{
  transform:translateY(-1px);
}

.dashboard-pro-table th{
  height:42px;
  font-size:13px;
}

.dashboard-pro-table td{
  height:42px;
  font-size:13px;
}

.dashboard-photo-row{
  align-items:center;
}

.dashboard-photo-row strong{
  font-size:13px;
  line-height:1.2;
}

.dashboard-photo-row p{
  font-size:11px;
}

.dashboard-photo-row small{
  font-size:10px;
}

.dashboard-mini-row{
  padding:12px 0;
}

.dashboard-mini-row b{
  font-size:13px;
  line-height:1.3;
}

.dashboard-mini-row em{
  font-size:11px;
}

.dashboard-pro-kpi{
  min-height:118px;
}

.dashboard-pro-kpi b{
  line-height:1;
}

.dashboard-pro-empty{
  min-height:88px;
  display:flex;
  align-items:center;
  justify-content:center;
}

@media (max-width:900px){
  .dashboard-pro-wrap{
    padding:12px;
    border-radius:18px;
  }

  .dashboard-pro-hero{
    margin-bottom:12px;
  }

  .dashboard-pro-hero h2{
    font-size:24px;
  }

  .dashboard-pro-hero p{
    font-size:12px;
    line-height:1.4;
  }

  .dashboard-pro-date{
    width:max-content;
    font-size:12px;
    min-height:34px;
  }

  .dashboard-pro-kpis{
    gap:10px;
    margin-bottom:12px;
  }

  .dashboard-pro-kpi{
    border-radius:18px;
    min-height:auto;
    padding:14px;
  }

  .dashboard-pro-kpi span{
    font-size:11px;
    margin-bottom:8px;
  }

  .dashboard-pro-kpi b{
    font-size:24px;
  }

  .dashboard-pro-kpi em{
    margin-top:6px;
    font-size:11px;
  }

  .dashboard-pro-main,
  .dashboard-pro-left,
  .dashboard-pro-right,
  .dashboard-pro-split{
    gap:12px;
  }

  .dashboard-pro-panel{
    padding:12px;
    border-radius:18px;
  }

  .dashboard-pro-panel-head{
    margin-bottom:10px;
  }

  .dashboard-pro-panel-head button{
    min-height:30px;
    font-size:11px;
    padding:0 10px;
    border-radius:10px;
  }

  .dashboard-pro-panel h3{
    font-size:17px;
  }

  .dashboard-pro-table td,
  .dashboard-pro-table th{
    font-size:12px;
  }

  .dashboard-mobile-stack tbody{
    gap:8px;
  }

  .dashboard-mobile-stack tr{
    border-radius:14px;
    padding:10px;
  }

  .dashboard-mobile-stack td{
    grid-template-columns:62px 1fr;
    font-size:12px;
    line-height:1.35;
  }

  .dashboard-mobile-stack td::before{
    font-size:11px;
  }

  .dashboard-photo-feed{
    gap:8px;
  }

  .dashboard-photo-row{
    grid-template-columns:52px 1fr;
    padding:8px;
    border-radius:14px;
  }

  .dashboard-photo-thumb{
    width:52px;
    height:52px;
    border-radius:12px;
  }

  .dashboard-photo-row strong{
    font-size:12px;
  }

  .dashboard-photo-row p{
    font-size:10px;
  }

  .dashboard-photo-row small{
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
  }

  .dashboard-mini-row{
    padding:10px 0;
  }

  .dashboard-mini-row b{
    font-size:12px;
  }

  .dashboard-mini-row em{
    font-size:10px;
  }

  .dashboard-schedule-row{
    padding:10px;
    border-radius:14px;
  }

  .dashboard-schedule-row strong{
    font-size:13px;
  }

  .dashboard-schedule-row p{
    font-size:11px;
  }

  .dashboard-pro-empty{
    min-height:72px;
    font-size:12px;
    border-radius:14px;
  }

  /* 전체 메뉴 UI 통일 */
  .excel-download-btn,
  .pdf-download-btn{
    min-height:34px !important;
    border-radius:12px !important;
    padding:0 14px !important;
    font-size:12px !important;
    font-weight:1000 !important;
  }

  table{
    font-size:12px;
  }

  input,
  select,
  textarea{
    font-size:13px !important;
    min-height:40px;
    border-radius:12px !important;
  }

  textarea{
    min-height:80px !important;
  }
}

/* ===== Mobile Lookup Cards: Maintenance / Card Use Match Purchase Style ===== */
@media (max-width:900px){
  /* 정비조회/카드조회 공통 카드화 */
  .mobile-card-list,
  .mobile-card-list-maints,
  .mobile-card-list-cards{
    display:grid !important;
    gap:12px !important;
    margin-top:12px !important;
  }

  .mobile-list-card,
  .mobile-maint-card,
  .mobile-card-use-card{
    background:#ffffff !important;
    border:1px solid #e5e7eb !important;
    border-radius:22px !important;
    padding:16px !important;
    box-shadow:0 10px 28px rgba(15,23,42,.07) !important;
    overflow:hidden !important;
  }

  .mobile-list-top,
  .mobile-maint-card-top,
  .mobile-card-use-top{
    display:flex !important;
    justify-content:space-between !important;
    align-items:flex-start !important;
    gap:10px !important;
    margin-bottom:12px !important;
    padding-bottom:12px !important;
    border-bottom:1px solid #eef2f7 !important;
  }

  .mobile-list-top b,
  .mobile-maint-card-top b,
  .mobile-card-use-top b{
    color:#0f172a !important;
    font-size:17px !important;
    font-weight:1000 !important;
    line-height:1.25 !important;
    word-break:keep-all !important;
    overflow-wrap:anywhere !important;
  }

  .mobile-list-top span,
  .mobile-maint-card-top span,
  .mobile-card-use-top span{
    flex:0 0 auto !important;
    padding:5px 9px !important;
    border-radius:999px !important;
    background:#eff6ff !important;
    color:#1d4ed8 !important;
    font-size:12px !important;
    font-weight:1000 !important;
  }

  .mobile-list-body,
  .mobile-maint-card-body,
  .mobile-card-use-body{
    display:grid !important;
    grid-template-columns:1fr 1fr !important;
    gap:10px !important;
  }

  .mobile-list-body > div,
  .mobile-maint-card-body > div,
  .mobile-card-use-body > div{
    min-width:0 !important;
    padding:10px !important;
    border-radius:14px !important;
    background:#f8fafc !important;
  }

  .mobile-list-body label,
  .mobile-maint-card-body label,
  .mobile-card-use-body label{
    display:block !important;
    margin-bottom:5px !important;
    color:#64748b !important;
    font-size:11px !important;
    font-weight:1000 !important;
  }

  .mobile-list-body p,
  .mobile-maint-card-body p,
  .mobile-card-use-body p{
    margin:0 !important;
    color:#0f172a !important;
    font-size:13px !important;
    font-weight:900 !important;
    line-height:1.35 !important;
    word-break:keep-all !important;
    overflow-wrap:anywhere !important;
  }

  .mobile-list-body .wide,
  .mobile-maint-card-body .wide,
  .mobile-card-use-body .wide,
  .mobile-list-body > div:last-child:nth-child(odd),
  .mobile-maint-card-body > div:last-child:nth-child(odd),
  .mobile-card-use-body > div:last-child:nth-child(odd){
    grid-column:1 / -1 !important;
  }

  .mobile-card-actions,
  .mobile-maint-card-actions,
  .mobile-card-use-actions{
    display:grid !important;
    grid-template-columns:repeat(auto-fit,minmax(82px,1fr)) !important;
    gap:8px !important;
    margin-top:12px !important;
  }

  .mobile-card-actions button,
  .mobile-maint-card-actions button,
  .mobile-card-use-actions button{
    min-height:38px !important;
    border:0 !important;
    border-radius:12px !important;
    padding:0 8px !important;
    background:#e2e8f0 !important;
    color:#0f172a !important;
    font-size:12px !important;
    font-weight:1000 !important;
  }

  .mobile-card-actions button:first-child,
  .mobile-maint-card-actions button:first-child,
  .mobile-card-use-actions button:first-child{
    background:#dbeafe !important;
    color:#1d4ed8 !important;
  }

  .mobile-card-actions button:last-child,
  .mobile-maint-card-actions button:last-child,
  .mobile-card-use-actions button:last-child{
    background:#fee2e2 !important;
    color:#b91c1c !important;
  }

  /* 정비조회/카드조회는 모바일에서 PC 표 숨기고 카드 우선 */
  .maint-lookup-page .scroll-table,
  .card-lookup-page .scroll-table{
    display:none !important;
  }

  .maint-lookup-page .mobile-card-list,
  .card-lookup-page .mobile-card-list{
    display:grid !important;
  }

  /* 금액/합계 강조 */
  .mobile-card-use-body p.amount,
  .mobile-list-body p.amount,
  .mobile-maint-card-body p.amount{
    color:#1d4ed8 !important;
    font-size:15px !important;
    font-weight:1000 !important;
  }

  /* 사진 첨부 썸네일 */
  .mobile-maint-card .attachment-group,
  .mobile-list-card .attachment-group{
    justify-content:flex-start !important;
  }

  .mobile-maint-card .attachment-preview,
  .mobile-list-card .attachment-preview{
    width:54px !important;
    height:54px !important;
    border-radius:13px !important;
  }
}

@media (max-width:390px){
  .mobile-list-body,
  .mobile-maint-card-body,
  .mobile-card-use-body{
    grid-template-columns:1fr !important;
  }

  .mobile-list-top,
  .mobile-maint-card-top,
  .mobile-card-use-top{
    display:grid !important;
  }

  .mobile-list-top span,
  .mobile-maint-card-top span,
  .mobile-card-use-top span{
    width:max-content !important;
  }
}

/* ===== Backup and Permission Page ===== */
.backup-permission-page{
  min-height:calc(100vh - 210px);
  border-radius:24px;
  padding:22px;
  background:linear-gradient(180deg,#f8fafc 0%,#eef4fb 100%);
  box-shadow:0 18px 50px rgba(15,23,42,.10);
}

.backup-permission-hero{
  display:flex;
  justify-content:space-between;
  gap:18px;
  margin-bottom:18px;
}

.backup-permission-hero span{
  display:inline-flex;
  padding:6px 10px;
  border-radius:999px;
  background:#dbeafe;
  color:#1d4ed8;
  font-size:12px;
  font-weight:1000;
}

.backup-permission-hero h2{
  margin:8px 0 4px;
  color:#0f172a;
  font-size:30px;
  font-weight:1000;
}

.backup-permission-hero p{
  margin:0;
  color:#64748b;
  font-weight:800;
}

.backup-permission-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:16px;
  margin-bottom:16px;
}

.backup-card,
.permission-card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:22px;
  padding:18px;
  box-shadow:0 10px 26px rgba(15,23,42,.06);
}

.backup-card h3,
.permission-card h3{
  margin:0 0 8px;
  color:#0f172a;
  font-size:20px;
  font-weight:1000;
}

.backup-card p,
.permission-card p{
  margin:0 0 14px;
  color:#64748b;
  font-weight:800;
}

.backup-stat-grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:10px;
  margin:14px 0;
}

.backup-stat-grid div{
  padding:14px;
  border-radius:16px;
  background:#f8fafc;
  text-align:center;
}

.backup-stat-grid b{
  display:block;
  color:#1d4ed8;
  font-size:24px;
  font-weight:1000;
}

.backup-stat-grid span{
  display:block;
  margin-top:4px;
  color:#64748b;
  font-size:12px;
  font-weight:1000;
}

.backup-actions,
.permission-form{
  display:flex;
  gap:10px;
  align-items:end;
  flex-wrap:wrap;
}

.backup-card button,
.permission-card button{
  min-height:42px;
  border:0;
  border-radius:14px;
  padding:0 16px;
  font-weight:1000;
  background:#e2e8f0;
  color:#0f172a;
}

.backup-card button.primary,
.permission-card button.primary{
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:#fff;
}

.backup-card button.danger,
.permission-card button.danger{
  background:#fee2e2;
  color:#b91c1c;
}

.danger-zone{
  background:linear-gradient(135deg,#fff,#fff1f2);
}

.permission-checks{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:8px;
  margin:16px 0;
  padding:14px;
  border-radius:18px;
  background:#f8fafc;
}

.permission-checks label{
  display:flex;
  align-items:center;
  gap:8px;
  padding:9px 10px;
  border-radius:12px;
  background:#fff;
  font-weight:900;
  color:#334155;
}

.permission-list{
  display:grid;
  gap:10px;
  margin-top:14px;
}

.permission-row{
  display:grid;
  grid-template-columns:1fr auto auto auto;
  gap:10px;
  align-items:center;
  padding:12px;
  border:1px solid #e5e7eb;
  border-radius:16px;
  background:#fff;
}

.permission-row b{
  display:block;
  color:#0f172a;
  font-weight:1000;
}

.permission-row span,
.permission-row em{
  color:#64748b;
  font-size:12px;
  font-style:normal;
  font-weight:900;
}

@media (max-width:900px){
  .backup-permission-page{
    padding:14px;
    border-radius:18px;
  }
  .backup-permission-grid{
    grid-template-columns:1fr;
  }
  .backup-stat-grid,
  .permission-checks{
    grid-template-columns:1fr 1fr;
  }
  .permission-row{
    grid-template-columns:1fr;
  }
  .permission-form{
    display:grid;
  }
}

/* ===== Permission Aware Menu Hide ===== */
.permission-aware-mobile-nav{
  grid-template-columns:repeat(auto-fit,minmax(76px,1fr)) !important;
}

@media (max-width:900px){
  .permission-aware-menu .menu-group,
  .permission-aware-menu > button{
    display:none;
  }
}

/* ===== Mobile Permission Bottom Nav Final ===== */
.permission-aware-mobile-nav{
  grid-template-columns:repeat(auto-fit,minmax(72px,1fr)) !important;
}
.permission-aware-mobile-nav button{
  min-width:0 !important;
}

/* ===== Site Notice Feature ===== */
.site-notice-page{
  min-height:calc(100vh - 210px);
  border-radius:24px;
  padding:22px;
  background:linear-gradient(180deg,#f8fafc 0%,#eef4fb 100%);
  box-shadow:0 18px 50px rgba(15,23,42,.10);
}

.site-notice-hero{
  margin-bottom:16px;
}

.site-notice-hero span{
  display:inline-flex;
  padding:6px 10px;
  border-radius:999px;
  background:#dbeafe;
  color:#1d4ed8;
  font-size:12px;
  font-weight:1000;
}

.site-notice-hero h2{
  margin:8px 0 4px;
  color:#0f172a;
  font-size:30px;
  font-weight:1000;
}

.site-notice-hero p{
  margin:0;
  color:#64748b;
  font-weight:800;
}

.site-notice-form-card,
.site-notice-card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:22px;
  padding:18px;
  box-shadow:0 10px 26px rgba(15,23,42,.06);
}

.site-notice-form-card{
  margin-bottom:16px;
}

.site-notice-form-head h3{
  margin:0 0 6px;
  color:#0f172a;
  font-size:20px;
  font-weight:1000;
}

.site-notice-form-head p{
  margin:0 0 14px;
  color:#64748b;
  font-weight:800;
}

.site-notice-form-grid{
  display:grid;
  grid-template-columns:180px 160px 1fr;
  gap:12px;
}

.site-notice-form-card textarea{
  min-height:110px;
}

.site-notice-actions,
.site-notice-card-actions{
  display:flex;
  justify-content:flex-end;
  gap:8px;
  margin-top:12px;
}

.site-notice-actions button,
.site-notice-card-actions button{
  min-height:40px;
  border:0;
  border-radius:13px;
  padding:0 16px;
  font-weight:1000;
  background:#e2e8f0;
  color:#0f172a;
}

.site-notice-actions .primary{
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:#fff;
}

.site-notice-card-actions .danger{
  background:#fee2e2;
  color:#b91c1c;
}

.site-notice-list{
  display:grid;
  gap:12px;
}

.site-notice-card-top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  margin-bottom:10px;
}

.site-notice-card-top span{
  color:#2563eb;
  font-size:12px;
  font-weight:1000;
}

.site-notice-card-top em{
  font-style:normal;
  border-radius:999px;
  padding:5px 10px;
  font-size:12px;
  font-weight:1000;
  background:#dbeafe;
  color:#1d4ed8;
}

.site-notice-card.긴급 .site-notice-card-top em{
  background:#fee2e2;
  color:#b91c1c;
}

.site-notice-card.중요 .site-notice-card-top em{
  background:#ffedd5;
  color:#c2410c;
}

.site-notice-card h3{
  margin:0 0 8px;
  color:#0f172a;
  font-weight:1000;
}

.site-notice-card p{
  margin:0;
  color:#334155;
  font-weight:800;
  line-height:1.55;
  white-space:pre-wrap;
}

.site-notice-mini em{
  display:block;
  margin-top:4px;
  color:#64748b;
  font-style:normal;
  font-size:11px;
  font-weight:800;
  line-height:1.35;
}

@media (max-width:900px){
  .site-notice-page{
    padding:14px;
    border-radius:18px;
  }

  .site-notice-form-grid{
    grid-template-columns:1fr;
  }

  .site-notice-actions,
  .site-notice-card-actions{
    display:grid;
    grid-template-columns:1fr 1fr;
  }
}

/* ===== Site Notice Modern Redesign ===== */
.site-notice-modern-page{
  min-height:calc(100vh - 210px);
  border-radius:26px;
  padding:24px;
  background:linear-gradient(180deg,#f8fafc 0%,#edf4ff 100%);
  box-shadow:0 18px 50px rgba(15,23,42,.10);
}

.site-notice-modern-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:18px;
  margin-bottom:18px;
}

.site-notice-modern-head span{
  display:inline-flex;
  padding:6px 10px;
  border-radius:999px;
  background:#dbeafe;
  color:#1d4ed8;
  font-size:12px;
  font-weight:1000;
}

.site-notice-modern-head h2{
  margin:8px 0 4px;
  color:#0f172a;
  font-size:32px;
  font-weight:1000;
  letter-spacing:-.8px;
}

.site-notice-modern-head p{
  margin:0;
  color:#64748b;
  font-weight:800;
}

.site-notice-modern-summary{
  min-width:160px;
  border-radius:22px;
  padding:16px;
  background:#fff;
  box-shadow:0 10px 28px rgba(15,23,42,.08);
  text-align:center;
}

.site-notice-modern-summary b{
  display:block;
  color:#1d4ed8;
  font-size:34px;
  line-height:1;
  font-weight:1000;
}

.site-notice-modern-summary em,
.site-notice-modern-summary strong{
  display:block;
  margin-top:6px;
  color:#64748b;
  font-style:normal;
  font-size:12px;
  font-weight:1000;
}

.site-notice-error{
  margin-bottom:14px;
  padding:14px;
  border-radius:16px;
  background:#fee2e2;
  color:#991b1b;
  font-weight:900;
  text-align:center;
}

.site-notice-editor-card{
  margin-bottom:18px;
  border-radius:26px;
  padding:20px;
  background:#fff;
  border:1px solid #e5e7eb;
  box-shadow:0 14px 34px rgba(15,23,42,.08);
}

.site-notice-editor-title{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:14px;
  margin-bottom:14px;
}

.site-notice-editor-title h3{
  margin:0 0 5px;
  color:#0f172a;
  font-size:21px;
  font-weight:1000;
}

.site-notice-editor-title p{
  margin:0;
  color:#64748b;
  font-weight:800;
}

.site-notice-editor-title select{
  min-width:130px;
  min-height:44px;
  border:1px solid #d8e1ee;
  border-radius:14px;
  padding:0 12px;
  font-weight:1000;
  background:#f8fafc;
}

.site-notice-title-input,
.site-notice-content-input{
  width:100%;
  border:1px solid #d8e1ee;
  border-radius:18px;
  background:#fff;
  color:#0f172a;
  font-weight:900;
  box-sizing:border-box;
}

.site-notice-title-input{
  min-height:52px;
  padding:0 16px;
  margin-bottom:12px;
  font-size:16px;
}

.site-notice-content-input{
  min-height:150px;
  padding:16px;
  resize:vertical;
  line-height:1.55;
}

.site-notice-title-input:focus,
.site-notice-content-input:focus,
.site-notice-editor-title select:focus{
  outline:none;
  border-color:#2563eb;
  box-shadow:0 0 0 4px rgba(37,99,235,.12);
}

.site-notice-editor-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:14px;
}

.site-notice-editor-actions button,
.site-notice-modern-actions button{
  min-height:42px;
  border:0;
  border-radius:14px;
  padding:0 18px;
  font-weight:1000;
  background:#e2e8f0;
  color:#0f172a;
}

.site-notice-editor-actions .primary{
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:#fff;
  box-shadow:0 10px 22px rgba(37,99,235,.24);
}

.site-notice-modern-list{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
  gap:14px;
}

.site-notice-modern-card{
  border-radius:24px;
  padding:18px;
  background:#fff;
  border:1px solid #e5e7eb;
  box-shadow:0 10px 28px rgba(15,23,42,.06);
  border-left:8px solid #3b82f6;
}

.site-notice-modern-card.긴급{
  border-left-color:#ef4444;
  background:linear-gradient(135deg,#fff,#fff1f2);
}

.site-notice-modern-card.중요{
  border-left-color:#f97316;
  background:linear-gradient(135deg,#fff,#fff7ed);
}

.site-notice-modern-card-top{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:center;
  margin-bottom:10px;
}

.site-notice-modern-card-top em{
  font-style:normal;
  border-radius:999px;
  padding:5px 10px;
  background:#dbeafe;
  color:#1d4ed8;
  font-size:12px;
  font-weight:1000;
}

.site-notice-modern-card.긴급 .site-notice-modern-card-top em{
  background:#fee2e2;
  color:#b91c1c;
}

.site-notice-modern-card.중요 .site-notice-modern-card-top em{
  background:#ffedd5;
  color:#c2410c;
}

.site-notice-modern-card-top span{
  color:#64748b;
  font-size:12px;
  font-weight:1000;
}

.site-notice-modern-card h3{
  margin:0 0 10px;
  color:#0f172a;
  font-size:18px;
  font-weight:1000;
  line-height:1.35;
}

.site-notice-modern-card p{
  margin:0;
  color:#334155;
  font-weight:800;
  line-height:1.6;
  white-space:pre-wrap;
}

.site-notice-modern-actions{
  display:flex;
  justify-content:flex-end;
  gap:8px;
  margin-top:14px;
}

.site-notice-modern-actions .danger{
  background:#fee2e2;
  color:#b91c1c;
}

.site-notice-modern-empty{
  grid-column:1 / -1;
  padding:42px;
  text-align:center;
  color:#94a3b8;
  font-weight:1000;
  background:#fff;
  border-radius:22px;
}

@media (max-width:900px){
  .site-notice-modern-page{
    padding:14px;
    border-radius:18px;
  }
  .site-notice-modern-head,
  .site-notice-editor-title{
    display:grid;
  }
  .site-notice-modern-summary{
    width:100%;
    box-sizing:border-box;
  }
  .site-notice-editor-actions,
  .site-notice-modern-actions{
    display:grid;
    grid-template-columns:1fr 1fr;
  }
}

.site-notice-target-box{
  margin:14px 0 4px;
  padding:14px;
  border:1px solid #dbeafe;
  border-radius:16px;
  background:#f8fafc;
}
.site-notice-target-box>strong{
  display:block;
  margin-bottom:10px;
  color:#0f172a;
  font-weight:1000;
}
.site-notice-target-checks,
.site-notice-target-emails{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}
.site-notice-target-emails{
  margin-top:10px;
}
.site-notice-target-checks label,
.site-notice-target-emails label{
  display:inline-flex;
  align-items:center;
  gap:7px;
  margin:0;
  padding:8px 10px;
  border:1px solid #e2e8f0;
  border-radius:999px;
  background:white;
  color:#334155;
  font-size:12px;
  font-weight:900;
}
.site-notice-target-checks input,
.site-notice-target-emails input{
  width:auto;
  accent-color:#2563eb;
}
.site-notice-target-emails em{
  color:#64748b;
  font-style:normal;
}
.site-notice-modern-card-top small{
  color:#64748b;
  font-size:12px;
  font-weight:900;
}



/* ===== Home dashboard mockup style override ===== */
.home-upgrade{background:#f6f8fc;border:1px solid #dde5f0;border-radius:0;padding:26px;min-height:calc(100vh - 120px)}
.home-upgrade-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #e2e8f0}
.home-upgrade-topbar h2{margin:0;color:#111827;font-size:23px;font-weight:1000;letter-spacing:-.5px}.home-upgrade-topbar p{margin:8px 0 0;color:#64748b;font-weight:800}.home-upgrade-date{font-weight:1000;color:#111827;white-space:nowrap}
.home-upgrade-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:16px}.home-upgrade-kpi{position:relative;display:grid;grid-template-columns:70px 1fr;align-items:center;gap:14px;min-height:134px;padding:18px;border-radius:12px;background:white;border:1px solid #dbe4f0;box-shadow:0 8px 24px rgba(15,23,42,.06);text-align:left;cursor:pointer}.home-upgrade-kpi.blue{border-color:#bfdbfe}.home-upgrade-kpi.green{border-color:#bbf7d0}.home-upgrade-kpi.purple{border-color:#ddd6fe}.home-upgrade-kpi.red{border-color:#fecaca;background:#fff7f7}.home-upgrade-icon{width:58px;height:58px;border-radius:15px;display:grid;place-items:center;color:#fff;font-size:28px;background:#2563eb}.home-upgrade-kpi.green .home-upgrade-icon{background:#10b981}.home-upgrade-kpi.purple .home-upgrade-icon{background:#7c3aed}.home-upgrade-kpi.red .home-upgrade-icon{background:#e11d48}.home-upgrade-kpi-text em{display:block;font-style:normal;color:#0f172a;font-size:14px;font-weight:1000}.home-upgrade-kpi-text b{display:block;margin-top:10px;color:#1d4ed8;font-size:31px;font-weight:1000}.home-upgrade-kpi.green b{color:#047857}.home-upgrade-kpi.purple b{color:#6d28d9}.home-upgrade-kpi.red b{color:#e11d48}.home-upgrade-kpi-text small{display:block;margin-top:8px;color:#475569;font-weight:800}.home-upgrade-kpi i{position:absolute;right:18px;bottom:14px;color:#2563eb;font-style:normal;font-size:12px;font-weight:1000}.home-upgrade-kpi.red i{color:#e11d48}
.home-upgrade-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.home-upgrade-panel{background:white;border:1px solid #dbe4f0;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.05);padding:17px;min-height:185px}.home-upgrade-panel.warning{background:#fffafa;border-color:#fecaca}.home-upgrade-panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.home-upgrade-panel-head h3{margin:0;color:#0f172a;font-size:18px;font-weight:1000}.home-upgrade-panel-head button{border:0;background:transparent;color:#2563eb;font-size:12px;font-weight:1000;cursor:pointer}.home-upgrade-list{display:grid;gap:9px}.home-upgrade-notice{display:grid;grid-template-columns:44px 1fr auto;gap:8px;align-items:center;width:100%;padding:9px 0;border:0;border-bottom:1px solid #eef2f7;background:transparent;text-align:left;cursor:pointer}.home-upgrade-notice span{border-radius:999px;background:#2563eb;color:white;font-size:10px;font-weight:1000;text-align:center;padding:3px 6px}.home-upgrade-notice b{font-size:13px;color:#111827}.home-upgrade-notice em{font-style:normal;font-size:12px;color:#94a3b8}.home-upgrade-notice p{grid-column:2/4;margin:0;color:#64748b;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.home-upgrade-task{display:grid;grid-template-columns:24px 1fr auto;gap:9px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #eef2f7}.home-upgrade-task span{color:#2563eb;font-weight:1000}.home-upgrade-task b{font-size:13px;color:#111827}.home-upgrade-task p{margin:4px 0 0;color:#64748b;font-size:12px}.home-upgrade-task em{font-style:normal;background:#eef2ff;color:#4338ca;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:1000}.home-upgrade-alerts{display:grid;gap:12px}.home-upgrade-alerts button{display:flex;justify-content:space-between;align-items:center;border:1px solid #fee2e2;background:white;border-radius:12px;padding:12px;cursor:pointer}.home-upgrade-alerts b{color:#111827}.home-upgrade-alerts span{background:#e11d48;color:white;border-radius:999px;padding:7px 12px;font-weight:1000}.home-upgrade-table{width:100%;border-collapse:collapse;font-size:13px}.home-upgrade-table td{border-bottom:1px solid #eef2f7;padding:9px 5px;color:#334155;font-weight:800;white-space:nowrap}.home-upgrade-table td:nth-child(2){color:#0f172a}.home-upgrade-table td:last-child{text-align:right;color:#111827;font-weight:1000}.home-upgrade-empty{min-height:110px;display:grid;place-items:center;color:#94a3b8;font-weight:900;background:#f8fafc;border-radius:12px}
@media(max-width:1100px){.home-upgrade-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.home-upgrade-grid{grid-template-columns:1fr 1fr}}@media(max-width:700px){.home-upgrade{padding:12px;border-radius:14px}.home-upgrade-topbar{display:block}.home-upgrade-date{margin-top:10px}.home-upgrade-kpis,.home-upgrade-grid{grid-template-columns:1fr}.home-upgrade-kpi{grid-template-columns:56px 1fr;min-height:105px}.home-upgrade-icon{width:48px;height:48px;font-size:22px}.home-upgrade-kpi-text b{font-size:25px}.home-upgrade-table td{font-size:12px;padding:8px 3px}.home-upgrade-table td:nth-child(3){max-width:110px;overflow:hidden;text-overflow:ellipsis}}

/* Modern home dashboard - actual ERP home only */
.modern-home-shell{background:#f6f8fc;border-radius:0;padding:22px 24px 30px;margin:0 0 22px;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
.modern-home-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px;padding:8px 2px 0}.modern-home-intro h2{margin:0 0 6px;font-size:24px;font-weight:950;color:#111827;letter-spacing:-.6px}.modern-home-intro p{margin:0;color:#475569;font-size:14px;font-weight:750}.modern-home-intro button{border:1px solid #d8e2f0;background:#fff;border-radius:12px;padding:11px 17px;color:#334155;font-weight:900;cursor:pointer;box-shadow:0 6px 18px rgba(15,23,42,.04)}
.modern-home-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:18px}.modern-home-kpi{min-height:150px;border:1px solid #e0e7f2;border-radius:16px;background:#fff;padding:22px;display:grid;grid-template-columns:72px 1fr;grid-template-rows:1fr auto;gap:8px 18px;text-align:left;cursor:pointer;box-shadow:0 10px 26px rgba(15,23,42,.06);transition:transform .15s ease,box-shadow .15s ease}.modern-home-kpi:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(15,23,42,.1)}.modern-home-kpi-icon{width:64px;height:64px;border-radius:17px;display:grid;place-items:center;font-size:30px;color:white;grid-row:1/3}.modern-home-kpi em{display:block;font-style:normal;color:#111827;font-size:15px;font-weight:950}.modern-home-kpi b{display:block;margin-top:8px;font-size:36px;line-height:1;font-weight:950;letter-spacing:-1px}.modern-home-kpi small{display:block;margin-top:10px;color:#334155;font-size:13px;font-weight:800}.modern-home-kpi>i{grid-column:2;font-style:normal;text-align:right;color:#2563eb;font-size:13px;font-weight:950}.modern-home-kpi.blue .modern-home-kpi-icon{background:linear-gradient(135deg,#0d5bff,#2563eb)}.modern-home-kpi.blue b{color:#1455d9}.modern-home-kpi.green .modern-home-kpi-icon{background:linear-gradient(135deg,#11b981,#35c99a)}.modern-home-kpi.green b{color:#059669}.modern-home-kpi.purple .modern-home-kpi-icon{background:linear-gradient(135deg,#7c3aed,#5b43d6)}.modern-home-kpi.purple b{color:#6d28d9}.modern-home-kpi.red{background:#fff7f8;border-color:#f8cdd6}.modern-home-kpi.red .modern-home-kpi-icon{background:linear-gradient(135deg,#e11d48,#f43f5e)}.modern-home-kpi.red b{color:#e11d48}
.modern-home-grid{display:grid;gap:18px}.modern-home-grid.middle{grid-template-columns:1.1fr 1.1fr .95fr;margin-bottom:18px}.modern-home-grid.bottom{grid-template-columns:repeat(3,minmax(0,1fr))}.modern-home-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px;box-shadow:0 10px 26px rgba(15,23,42,.055);min-width:0}.modern-home-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.modern-home-panel-head h3{margin:0;font-size:20px;font-weight:950;color:#111827;letter-spacing:-.3px}.modern-home-panel-head button{border:0;background:transparent;color:#2563eb;font-size:13px;font-weight:950;cursor:pointer;white-space:nowrap}.modern-home-list,.modern-home-schedule-list,.modern-home-alert-list{display:flex;flex-direction:column;gap:10px}.modern-home-notice-row{border:0;background:#fff;width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #eef2f7;text-align:left;cursor:pointer}.modern-home-notice-row span{display:inline-flex;align-items:center;justify-content:center;height:20px;padding:0 7px;border-radius:999px;background:#1265ff;color:white;font-size:10px;font-weight:950}.modern-home-notice-row b{font-size:14px;color:#111827;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.modern-home-notice-row em{font-style:normal;color:#64748b;font-size:13px;font-weight:750;white-space:nowrap}.modern-home-schedule-row{border:0;background:#fff;width:100%;display:grid;grid-template-columns:24px 1fr;gap:12px;align-items:start;padding:8px 0;text-align:left;cursor:pointer}.modern-home-schedule-row span{color:#64748b;font-weight:950}.modern-home-schedule-row b{display:block;color:#111827;font-size:15px;font-weight:950}.modern-home-schedule-row p{margin:4px 0 0;color:#475569;font-size:13px;font-weight:750;line-height:1.45}.modern-home-alert-list button{border:1px solid #ffd1d9;background:#fff8f9;border-radius:13px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.modern-home-alert-list b{color:#111827;font-size:14px;font-weight:950}.modern-home-alert-list span{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:26px;border-radius:999px;background:#e11d48;color:white;font-size:13px;font-weight:950}.modern-home-table{width:100%;border-collapse:collapse;font-size:13px}.modern-home-table th{padding:0 8px 10px;border-bottom:1px solid #e5e7eb;color:#475569;font-size:12px;font-weight:950;text-align:left}.modern-home-table th:last-child{text-align:right}.modern-home-table td{padding:11px 8px;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;vertical-align:middle}.modern-home-table td:nth-child(1){white-space:nowrap;color:#334155}.modern-home-table td:nth-child(2),.modern-home-table td:nth-child(3){max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.modern-home-table td:last-child{text-align:right;white-space:nowrap;font-weight:950}.modern-home-empty{border-radius:14px;background:#f8fafc;border:1px dashed #cbd5e1;padding:28px;text-align:center;color:#94a3b8;font-weight:850}
@media(max-width:1200px){.modern-home-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.modern-home-grid.middle,.modern-home-grid.bottom{grid-template-columns:1fr}}
@media(max-width:760px){.modern-home-shell{padding:14px 10px 20px}.modern-home-intro{flex-direction:column}.modern-home-intro h2{font-size:20px}.modern-home-kpis{grid-template-columns:1fr;gap:12px}.modern-home-kpi{min-height:128px;padding:18px;grid-template-columns:58px 1fr}.modern-home-kpi-icon{width:54px;height:54px;font-size:24px}.modern-home-kpi b{font-size:30px}.modern-home-panel{padding:16px}.modern-home-table{font-size:12px}.modern-home-table th:nth-child(2),.modern-home-table td:nth-child(2){display:none}}


`;