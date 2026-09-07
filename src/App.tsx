import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { createClient } from "@supabase/supabase-js";
import { Save, RotateCcw, Plus, Trash2, Pencil, Upload, X, CheckCircle2, Home as HomeIcon, Bell, Factory, ShoppingCart, CreditCard, Wrench, Database, FileCheck2, ClipboardList, ShieldCheck } from "lucide-react";

type Vendor = { id: string; code: string; name: string; owner?: string; phone?: string; mobile?: string; address?: string; address_detail?: string };
type Group = { id: string; code: string; name: string };
type Warehouse = { id: string; code: string; group: string; name: string };
type Item = { id: string; code: string; name: string; spec?: string; unit?: string; price?: number };
type PurchaseRow = { id: string; item: string; spec: string; qty: string | number; price: string | number; supply: number; vat: number; total: number };
type Purchase = { id: string; date: string; vendor: string; warehouse: string; rows: PurchaseRow[]; supplyTotal: number; vatTotal: number; total: number; itemSummary: string; taxInvoiceReceived?: boolean; image_urls?: string[]; image_url?: string };
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
  taxInvoiceReceived: Boolean(p.tax_invoice_received ?? p.taxInvoiceReceived ?? false),
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
  tax_invoice_received: Boolean(p.taxInvoiceReceived),
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
const PURCHASE_DRAFT_KEY = "erp_purchase_draft_v1";
const CARD_DRAFT_KEY = "erp_card_draft_v1";
const MAINT_DRAFT_KEY = "erp_maint_draft_v1";
const INTERNAL_LOGIN_DOMAIN = "tm.local";

const toLoginEmail = (value: string) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.includes("@") ? raw : `${raw}@${INTERNAL_LOGIN_DOMAIN}`;
};

const toLoginId = (value: string) => {
  const raw = String(value || "").trim().toLowerCase();
  const suffix = `@${INTERNAL_LOGIN_DOMAIN}`;
  return raw.endsWith(suffix) ? raw.slice(0, -suffix.length) : raw;
};

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
const nextNumericCode = (arr: { code?: string }[], prefix = "", width = 4) => {
  const maxCode = (arr || []).reduce((max, item) => {
    const raw = String(item.code || "").trim();
    const numericText = prefix && raw.toUpperCase().startsWith(prefix.toUpperCase()) ? raw.slice(prefix.length) : raw;
    const numericCode = /^\d+$/.test(numericText) ? Number(numericText) : 0;
    return Number.isFinite(numericCode) ? Math.max(max, numericCode) : max;
  }, 0);
  return `${prefix}${String(maxCode + 1).padStart(width, "0")}`;
};
const nextCode = (arr: { code?: string }[]) => nextNumericCode(arr, "", 4);
const nextVendorCode = (arr: { code?: string }[]) => nextNumericCode(arr, "V", 3);
const nextItemCode = (arr: { code?: string }[]) => {
  return nextNumericCode(arr, "", 4);
};

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

const monthKeyWithOffset = (baseDateKey: string, offset: number) => {
  const date = new Date(`${baseDateKey.slice(0, 7)}-01T12:00:00`);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthChangeLabel = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? "ì‹ ê·œ" : "0%";
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("ko-KR")}%`;
};

const monthChangeTone = (current: number, previous: number) => {
  if (previous <= 0 || current === previous) return "neutral";
  return current > previous ? "up" : "down";
};

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const width = 132;
  const height = 52;
  const padding = 4;
  const safeValues = values.length ? values : [0, 0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(safeValues.length - 1, 1);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className="home-insight-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {safeValues.map((value, index) => {
        const [x, y] = points.split(" ")[index].split(",");
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.5" fill={color} />;
      })}
    </svg>
  );
}

const getPurchaseItemSummary = (purchase: Pick<Purchase, "itemSummary" | "rows">) => {
  const itemNames = (purchase.rows || [])
    .map((row) => String(row.item || "").trim())
    .filter(Boolean);

  if (!itemNames.length) return purchase.itemSummary || "-";

  const firstItem = itemNames[0];
  const extraCount = itemNames.length - 1;

  return extraCount > 0 ? `${firstItem} ì™¸ ${extraCount}ê±´` : firstItem;
};



const parseExcelLikeDate = (value: any) => {
  if (!value && value !== 0) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toDateKey(value);

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return toDateKey(excelEpoch);
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const formatted = formatInputDate(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toDateKey(parsed);

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
    .replace(/[\sãˆœ\(\)\[\]ì£¼ì‹íšŒì‚¬]/g, "")
    .toLowerCase();

const bankCodeByName = (name: string) => {
  const raw = String(name || "").replace(/\s/g, "");
  if (raw.includes("ë†í˜‘") || raw.includes("NH")) return "11";
  if (raw.includes("êµ­ë¯¼")) return "04";
  if (raw.includes("ê¸°ì—…") || raw.includes("IBK") || raw.includes("ì¤‘ì†Œê¸°ì—…")) return "03";
  if (raw.includes("í•˜ë‚˜")) return "81";
  if (raw.includes("ìš°ë¦¬")) return "20";
  if (raw.includes("ì‹ í•œ")) return "88";
  if (raw.includes("ì‹ í˜‘")) return "48";
  if (raw.includes("SC") || raw.includes("ì œì¼")) return "23";
  if (raw.includes("ì¹´ì¹´ì˜¤")) return "090";
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
    alert("ë‹¤ìš´ë¡œë“œí•  ë°ì´í„°ê°€ ì—†ìŠµë‹ˆë‹¤.");
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
    if (header.includes("ì¼ì") || header.includes("ê´€ë¦¬ë²ˆí˜¸")) return { wch: 18 };
    if (header.includes("ê±°ë˜ì²˜") || header.includes("ì‚¬ìš©ì²˜")) return { wch: 24 };
    if (header.includes("í’ˆëª©") || header.includes("ì œëª©") || header.includes("ë‚´ìš©") || header.includes("ë©”ëª¨")) return { wch: 28 };
    if (header.includes("ì˜ìˆ˜ì¦")) return { wch: 34 };
    if (["ìˆ˜ëŸ‰", "ë‹¨ê°€", "ê³µê¸‰ê°€ì•¡", "ë¶€ê°€ì„¸", "ë¶€ê°€ì„¸ì•¡", "í•©ê³„", "ê¸ˆì•¡"].some((x) => header.includes(x))) return { wch: 14 };

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
    const isTotalRow = !isHeader && String(firstCell?.v || "").includes("ì´í•©ê³„");

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

      if (["ìˆ˜ëŸ‰", "ë‹¨ê°€", "ê³µê¸‰ê°€ì•¡", "ë¶€ê°€ì„¸", "ë¶€ê°€ì„¸ì•¡", "í•©ê³„", "ê¸ˆì•¡"].some((x) => header.includes(x))) {
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
    Subject: "íƒœëª…ì‚°ì—…ê°œë°œ ERP ë‹¤ìš´ë¡œë“œ",
    Author: "íƒœëª…ì‚°ì—…ê°œë°œ",
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(workbook, worksheet, "ìë£Œ");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};


const downloadPdf = (fileName: string, title: string, rows: Record<string, any>[]) => {
  if (!rows.length) {
    alert("ì¶œë ¥í•  ë°ì´í„°ê°€ ì—†ìŠµë‹ˆë‹¤.");
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
  const totalIndex = rows.findIndex((row) => String(row[headers[0]] || "").includes("ì´í•©ê³„"));

  const tableHead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const tableBody = rows
    .map((row, rowIndex) => {
      const isTotal = rowIndex === totalIndex || String(row[headers[0]] || "").includes("ì´í•©ê³„");
      const cells = headers
        .map((h) => {
          const raw = row[h];
          const isNumber = typeof raw === "number" || ["ê¸ˆì•¡", "í•©ê³„", "ê³µê¸‰ê°€ì•¡", "ë¶€ê°€ì„¸", "ë¶€ê°€ì„¸ì•¡", "ìˆ˜ëŸ‰", "ë‹¨ê°€"].some((key) => h.includes(key));
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
    alert("íŒì—…ì´ ì°¨ë‹¨ë˜ì—ˆìŠµë‹ˆë‹¤. ë¸Œë¼ìš°ì €ì—ì„œ íŒì—… í—ˆìš© í›„ ë‹¤ì‹œ ì¶œë ¥í•˜ì„¸ìš”.");
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
  <div class="meta">ì¶œë ¥ì¼: ${todayText()}</div>
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


const todayText = () => getTodayKey();

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


const fetchAllRows = async (table: string, orderColumn = "code", pageSize = 1000, ascending = true) => {
  let allRows: any[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending })
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

type ActivityLog = {
  id: string;
  module: string;
  action: string;
  target_id?: string;
  target_title?: string;
  detail?: string;
  user_email?: string;
  user_role?: string;
  created_at?: string;
};

type DeletedRecord = {
  id: string;
  source_table: string;
  module: string;
  record_id: string;
  title?: string;
  detail?: string;
  data: any;
  deleted_by?: string;
  deleted_at?: string;
};

type BackupExport = {
  exported_at: string;
  exported_by: string;
  record_counts: Record<string, number>;
  vendors: Vendor[];
  warehouse_groups: Group[];
  warehouses: Warehouse[];
  items: Item[];
  purchases: Purchase[];
  maints: Maint[];
  card_uses: CardUse[];
  receipt_photos: ReceiptPhoto[];
  maintenance_photos: MaintenancePhoto[];
  maintenance_schedules: MaintenanceSchedule[];
  vendor_accounts: VendorAccount[];
  permits: PermitRenewal[];
  update_notices: UpdateNotice[];
  site_notices: SiteNotice[];
  user_permissions: UserPermission[];
  activity_logs: ActivityLog[];
  deleted_records: DeletedRecord[];
};

const KOREA_TIME_ZONE = "Asia/Seoul";

const koreaNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: KOREA_TIME_ZONE }));

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayKey = () => toDateKey(koreaNow());

const getYesterdayKey = () => {
  const d = koreaNow();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
};

const isRecentNotice = (notice: UpdateNotice) => {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();
  return notice.notice_date === today || notice.notice_date === yesterday;
};

const updateNoticeHideValue = () => getTodayKey();


const ERP_PERMISSION_MODULES = [
  { key: "home", label: "í™ˆ" },
  { key: "site_notices", label: "ê³µì§€" },
  { key: "bid_notices", label: "ì…ì°°ê³µê³ " },
  { key: "activity_logs", label: "ì‘ì—…ë¡œê·¸" },
  { key: "trash_bin", label: "íœ´ì§€í†µ" },
  { key: "layout", label: "ìƒì‚°ë¼ì¸" },
  { key: "new", label: "êµ¬ë§¤ì…ë ¥" },
  { key: "list", label: "êµ¬ë§¤ì¡°íšŒ" },
  { key: "status", label: "êµ¬ë§¤í˜„í™©" },
  { key: "bulk_transfer", label: "ëŒ€ëŸ‰ì´ì²´" },
  { key: "receipt_photos", label: "ì…ê³ ì‚¬ì§„ë“±ë¡" },
  { key: "vendor_accounts", label: "ì—…ì²´ê³„ì¢Œê´€ë¦¬" },
  { key: "card_use", label: "ì¹´ë“œì‚¬ìš©" },
  { key: "card_list", label: "ì¹´ë“œì¡°íšŒ" },
  { key: "card_stats", label: "ì¹´ë“œí†µê³„" },
  { key: "maint_new", label: "ì •ë¹„ë“±ë¡" },
  { key: "maint_list", label: "ì •ë¹„ì¡°íšŒ" },
  { key: "maint_stats", label: "ì •ë¹„í†µê³„" },
  { key: "maintenance_photos", label: "ì •ë¹„ì‚¬ì§„ë“±ë¡" },
  { key: "maintenance_schedule_new", label: "ì •ë¹„ì¼ì •ë“±ë¡" },
  { key: "maintenance_schedules", label: "ì •ë¹„ì¼ì •ì¡°íšŒ" },
  { key: "vendors", label: "ê±°ë˜ì²˜ë“±ë¡" },
  { key: "warehouse_groups", label: "ì°½ê³ ë“±ë¡" },
  { key: "items", label: "í’ˆëª©ë“±ë¡" },
  { key: "permits", label: "í—ˆê°€ê´€ë¦¬" },
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
  required = false,
  value,
  options,
  onChange,
  onSelect,
  placeholder,
  variant = "default",
}: {
  label?: string;
  required?: boolean;
  value: string;
  options: any[];
  onChange: (value: string) => void;
  onSelect?: (option: any) => void;
  placeholder?: string;
  variant?: "default" | "item";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const normalized = useMemo(() => {
    return (options || [])
      .map((o) => {
        if (typeof o === "string") {
          const text = String(o || "").trim();
          return { id: "", label: text, value: text, search: text.toLowerCase(), code: "", name: text, spec: "", unit: "", price: 0 };
        }
        const id = String(o?.id || "").trim();
        const label = String(o?.label || o?.name || o?.value || "").trim();
        const value = String(o?.value || o?.name || o?.label || "").trim();
        const code = String(o?.code || "").trim();
        const name = String(o?.name || "").trim();
        const spec = String(o?.spec || "").trim();
        const unit = String(o?.unit || "").trim();
        const price = Number(o?.price || 0);
        const search = `${label} ${value} ${code} ${name} ${spec} ${unit}`.toLowerCase();
        return { id, label, value, search, code, name, spec, unit, price };
      })
      .filter((o) => o.label || o.value);
  }, [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized.slice(0, 50);
    return normalized.filter((o) => o.search.includes(q)).slice(0, 80);
  }, [query, normalized]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const selectOption = (index = activeIndex) => {
    const option = filtered[index] || filtered[0];
    if (!option) return false;
    if (onSelect) onSelect(option);
    else onChange(option.value);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    return true;
  };

  return (
    <div className={`search-wrap${variant === "item" ? " item-search-select" : ""}`} style={{ zIndex: open ? 9999 : 1 }}>
      {label && <label>{label}{required && <span className="required-mark" aria-hidden="true">*</span>}</label>}

      <input
        value={query}
        placeholder={value || placeholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
          setActiveIndex(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (e.key === "Enter" && filtered.length > 0 && (query.trim() || filtered.length === 1)) {
            e.preventDefault();
            selectOption();
          }
          if (e.key === "Tab" && !e.shiftKey && open && query.trim() && filtered.length > 0) {
            selectOption();
          }
          if (e.key === "Escape") {
            setQuery("");
            setOpen(false);
            setActiveIndex(0);
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
        <div className={`dropdown${variant === "item" ? " item-search-dropdown" : ""}`}>
          {variant === "item" && filtered.length > 0 && (
            <div className="item-search-dropdown-head" aria-hidden="true">
              <span>í’ˆëª©ëª…</span><span>ì½”ë“œ</span><span>ê·œê²©</span><span>ë‹¨ìœ„</span><span>ì…ê³ ë‹¨ê°€</span>
            </div>
          )}
          {filtered.length ? (
            filtered.map((o, i) => (
              <div
                key={`${o.value}-${i}`}
                className={`dropdown-item${i === activeIndex ? " keyboard-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectOption(i)}
              >
                {variant === "item" ? (
                  <div className="item-search-dropdown-row">
                    <strong>{o.name || o.label}</strong>
                    <span>{o.code || "-"}</span>
                    <span>{o.spec || "-"}</span>
                    <span>{o.unit || "-"}</span>
                    <b>{o.price ? `${money(o.price)}ì›` : "-"}</b>
                  </div>
                ) : o.label}
              </div>
            ))
          ) : (
            <div className="dropdown-empty">ê²€ìƒ‰ ê²°ê³¼ ì—†ìŒ</div>
          )}
        </div>
      )}
    </div>
  );
}

function DateInput({
  value,
  onChange,
  placeholder = "20260519 ë˜ëŠ” 260519",
  ariaLabel = "ë‚ ì§œ ì„ íƒ",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const pickerRef = useRef<HTMLInputElement | null>(null);

  const openDatePicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;

    const showPicker = (picker as HTMLInputElement & { showPicker?: () => void }).showPicker;
    if (typeof showPicker === "function") {
      try {
        showPicker.call(picker);
        return;
      } catch {
        // Older or restricted browsers can fall back to a normal input click.
      }
    }

    picker.focus();
    picker.click();
  };

  return (
    <div className="date-input-wrap">
      <input
        className="date-text-input"
        value={value || ""}
        onChange={(e) => onChange(formatInputDate(e.target.value))}
        placeholder={placeholder}
      />
      <input
        ref={pickerRef}
        className="date-picker-input"
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        tabIndex={-1}
      />
      <button type="button" className="date-picker-button" onClick={openDatePicker} aria-label={ariaLabel}>
        <span aria-hidden="true">ğŸ“…</span>
      </button>
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

.permission-pending-card {
  text-align: center;
}

.permission-pending-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 8px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #2563eb;
  font-size: 34px;
}

.permission-pending-account {
  margin: 4px 0 10px;
  padding: 11px 14px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #f8fafc;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
  word-break: break-all;
}

.permission-pending-help {
  margin: 0 0 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.65;
}

.permission-pending-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 8px;
}

.permission-pending-actions button {
  min-height: 48px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #fff;
  color: #334155;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
}

.permission-pending-actions button.primary {
  border-color: transparent;
  background: linear-gradient(90deg, #2563eb, #4f46e5);
  color: #fff;
}
.audio-preview{display:flex;flex-direction:column;gap:6px;min-width:180px;max-width:260px;padding:6px;border:1px solid #dbeafe;border-radius:12px;background:#f8fafc}.audio-preview audio{width:220px;max-width:100%;height:32px}.audio-preview a{font-size:12px;font-weight:800;color:#2563eb;text-decoration:none}.attachment-file-link{display:inline-flex;align-items:center;justify-content:center;min-width:68px;padding:7px 9px;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:900;text-decoration:none}

.purchase-lookup-page .attachment-group{
  display:flex;
  align-items:center;
  gap:6px;
  flex-wrap:wrap;
}
.purchase-lookup-page .audio-preview{
  min-width:160px;
  max-width:220px;
}
.purchase-lookup-page .audio-preview audio{
  width:180px;
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
      { id: uid(), code: "V001", name: "ìˆ˜ì‚°ì„¸ë³´í‹±ìŠ¤", owner: "", phone: "", mobile: "" },
      { id: uid(), code: "V002", name: "ì˜ì¬ì¹´", owner: "", phone: "", mobile: "" },
    ])
  );
  const [groups, setGroups] = useState<Group[]>(() =>
    read(KEY.groups, [
      { id: uid(), code: "0001", name: "í¬ë¼ìƒ¤" },
      { id: uid(), code: "0002", name: "íëª©" },
    ])
  );
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() =>
    read(KEY.warehouses, [
      { id: uid(), code: "0001", group: "í¬ë¼ìƒ¤", name: "ë¡œë”" },
      { id: uid(), code: "0002", group: "í¬ë¼ìƒ¤", name: "ì•”í”„" },
    ])
  );
  const [items, setItems] = useState<Item[]>(() =>
    read(KEY.items, [
      { id: uid(), code: "0001", name: "ìœ ì••í˜¸ìŠ¤", spec: "Aí˜•", unit: "ea", price: 50000 },
      { id: uid(), code: "0002", name: "ë² ì–´ë§", spec: "Bí˜•", unit: "ea", price: 20000 },
      { id: uid(), code: "0003", name: "íƒ€ì´ì–´", spec: "29ì¸ì¹˜", unit: "ea", price: 300000 },
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
  const [openMenuGroup, setOpenMenuGroup] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const menuHistoryReadyRef = useRef(false);
  const skipNextMenuHistoryRef = useRef(false);
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [hideUpdateToday, setHideUpdateToday] = useState(false);
  const [updateNotices, setUpdateNotices] = useState<UpdateNotice[]>([]);
  const [siteNotices, setSiteNotices] = useState<SiteNotice[]>([]);
  const [siteNoticeForm, setSiteNoticeForm] = useState({ title: "", content: "", priority: "ë³´í†µ", is_active: true, target_roles: ["all"], target_emails: [] as string[] });
  const [editingSiteNoticeId, setEditingSiteNoticeId] = useState("");
  const [siteNoticeError, setSiteNoticeError] = useState("");

  const recentUpdateItems = updateNotices.filter(isRecentNotice).slice(0, 3);
  const [updateNoticeForm, setUpdateNoticeForm] = useState({ notice_date: getTodayKey(), content: "" });
  const [editingUpdateNoticeId, setEditingUpdateNoticeId] = useState("");
  const [updateNoticeError, setUpdateNoticeError] = useState("");
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [userPermissionsLoading, setUserPermissionsLoading] = useState(true);
  const [userPermissionsError, setUserPermissionsError] = useState("");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLogSearch, setActivityLogSearch] = useState({ module: "", keyword: "" });
  const [deletedRecords, setDeletedRecords] = useState<DeletedRecord[]>([]);
  const [trashSearch, setTrashSearch] = useState({ module: "", keyword: "" });
  const [backupSaving, setBackupSaving] = useState(false);
  const [permissionForm, setPermissionForm] = useState<UserPermission>({
    id: uid(),
    email: "",
    role: "field",
    permissions: {},
  });
  const currentUserPermission = userPermissions.find((item) => item.email === userEmail);
  const isPermissionApproved = isAdmin || !!currentUserPermission;
  const currentRole: UserRole = isAdmin ? "admin" : (currentUserPermission?.role || "field");
  const canCreateRecords = currentRole === "admin" || currentRole === "office";
  const canEditDeleteRecords = currentRole === "admin";
  const canAccessTab = (tab: string) => {
    if (!isPermissionApproved) return false;
    if (!tab) return true;
    if (tab === "home") return true;
    if (tab === "site_notices") return true;
    if (tab === "activity_logs") return isAdmin;
    if (tab === "trash_bin") return isAdmin;
    if (isAdmin) return true;
    if (currentRole === "office") return !ERP_OFFICE_BLOCKED_TABS.has(tab);
    const permissions = currentUserPermission?.permissions || {};
    return !!permissions[tab];
  };

  const getFirstAllowedTab = () => {
    if (isAdmin || currentRole === "office") return "home";
    return "home";
  };
  const canShowAny = (tabs: string[]) => tabs.some((tab) => canAccessTab(tab));
  const menuButton = (tab: string, label: string) =>
    canAccessTab(tab) ? <button className={menuTab === tab ? "active" : ""} onMouseDown={() => setMenuTab(tab)}>{label}</button> : null;

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
  const [purchaseHeader, setPurchaseHeader] = useState({ date: getTodayKey(), vendor: "", warehouse: "", image_urls: [] as string[] });
  const [rows, setRows] = useState<PurchaseRow[]>([emptyRow()]);
  const [editingPurchaseId, setEditingPurchaseId] = useState("");
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseUploading, setPurchaseUploading] = useState(false);
  const [purchaseTaxInvoiceSavingId, setPurchaseTaxInvoiceSavingId] = useState("");
  const [purchaseDraftReady, setPurchaseDraftReady] = useState(false);
  const purchaseSavingRef = useRef(false);
  const [purchaseEntryPopupOpen, setPurchaseEntryPopupOpen] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState({ from: "", to: "", vendor: "", warehouse: "", item: "", taxInvoice: "" });

  const [vendorForm, setVendorForm] = useState({ code: "", name: "", owner: "", phone: "", mobile: "", address: "", address_detail: "" });
  const [vendorImportMessage, setVendorImportMessage] = useState("");
  const [editingVendorId, setEditingVendorId] = useState("");
  const [vendorAddressSearchOpen, setVendorAddressSearchOpen] = useState(false);
  const [vendorAddressSearchReady, setVendorAddressSearchReady] = useState(false);
  const [vendorAddressSearchError, setVendorAddressSearchError] = useState("");
  const vendorAddressSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const vendorAddressDetailRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const postcodeWindow = window as any;
    const markReady = () => {
      if (postcodeWindow.kakao?.Postcode || postcodeWindow.daum?.Postcode) {
        setVendorAddressSearchReady(true);
        setVendorAddressSearchError("");
      }
    };
    markReady();
    if (postcodeWindow.kakao?.Postcode || postcodeWindow.daum?.Postcode) return;

    const existingScript = document.getElementById("kakao-postcode-script") as HTMLScriptElement | null;
    const script = existingScript || document.createElement("script");
    const handleError = () => setVendorAddressSearchError("ì£¼ì†Œ ê²€ìƒ‰ ì„œë¹„ìŠ¤ë¥¼ ë¶ˆëŸ¬ì˜¤ì§€ ëª»í–ˆìŠµë‹ˆë‹¤. ì¸í„°ë„· ì—°ê²°ì„ í™•ì¸í•´ ì£¼ì„¸ìš”.");
    script.addEventListener("load", markReady);
    script.addEventListener("error", handleError);
    if (!existingScript) {
      script.id = "kakao-postcode-script";
      script.src = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      document.head.appendChild(script);
    }
    return () => {
      script.removeEventListener("load", markReady);
      script.removeEventListener("error", handleError);
    };
  }, []);

  const openVendorAddressSearch = () => {
    setVendorAddressSearchError("");
    setVendorAddressSearchOpen(true);
  };

  useEffect(() => {
    if (!vendorAddressSearchOpen || !vendorAddressSearchReady || !vendorAddressSearchContainerRef.current) return;
    const postcodeWindow = window as any;
    const Postcode = postcodeWindow.kakao?.Postcode || postcodeWindow.daum?.Postcode;
    if (!Postcode) return;

    const container = vendorAddressSearchContainerRef.current;
    container.innerHTML = "";
    new Postcode({
      oncomplete: (data: any) => {
        const selectedAddress = data.userSelectedType === "J"
          ? data.jibunAddress
          : data.roadAddress || data.address;
        setVendorForm((prev) => ({ ...prev, address: selectedAddress || data.address || "" }));
        setVendorAddressSearchOpen(false);
        window.setTimeout(() => vendorAddressDetailRef.current?.focus(), 0);
      },
      width: "100%",
      height: "100%",
    }).embed(container, { autoClose: false });
  }, [vendorAddressSearchOpen, vendorAddressSearchReady]);

  useEffect(() => {
    if (!vendorAddressSearchOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVendorAddressSearchOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [vendorAddressSearchOpen]);
  const [groupForm, setGroupForm] = useState({ code: nextCode(groups), name: "" });
  const [warehouseForm, setWarehouseForm] = useState({ group: "", code: nextCode(warehouses), name: "" });
  const [editingGroupId, setEditingGroupId] = useState("");
  const [editingWarehouseId, setEditingWarehouseId] = useState("");
  const [itemForm, setItemForm] = useState({ code: nextItemCode(items), name: "", spec: "", unit: "", price: "" });
  const [itemImportMessage, setItemImportMessage] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [maintForm, setMaintForm] = useState({ date: getTodayKey(), warehouse: "", manager: "", title: "", detail: "", cost: "", image_urls: [] as string[] });
  const [maintItems, setMaintItems] = useState<MaintItem[]>([emptyMaintItem()]);
  const [editingMaintId, setEditingMaintId] = useState("");
  const [maintSaving, setMaintSaving] = useState(false);
  const [maintUploading, setMaintUploading] = useState(false);
  const [maintDraftReady, setMaintDraftReady] = useState(false);
  const maintSavingRef = useRef(false);
  const [maintSaveError, setMaintSaveError] = useState("");
  const [maintSearch, setMaintSearch] = useState({ from: "", to: "", warehouse: "", keyword: "" });
  const [showAllMaintSuggestions, setShowAllMaintSuggestions] = useState(false);
  const [maintTemplateOpen, setMaintTemplateOpen] = useState(false);
  const [maintTemplateSearch, setMaintTemplateSearch] = useState("");
  const [newItemModal, setNewItemModal] = useState<{ open: boolean; rowIndex: number | null }>({ open: false, rowIndex: null });
  const [newItemForm, setNewItemForm] = useState({ code: nextItemCode(items), name: "", spec: "", unit: "", price: "" });
  const [cardForm, setCardForm] = useState({ date: getTodayKey(), user_name: "", place: "", amount: "", memo: "", image_url: "", image_urls: [] as string[] });
  const [editingCardUseId, setEditingCardUseId] = useState("");
  const [cardSaving, setCardSaving] = useState(false);
  const [cardUploading, setCardUploading] = useState(false);
  const [cardDraftReady, setCardDraftReady] = useState(false);
  const cardSavingRef = useRef(false);
  const [cardSearch, setCardSearch] = useState({ from: "", to: "", user_name: "", place: "" });
  const auxiliarySavingRef = useRef<Set<string>>(new Set());
  const [auxiliarySaving, setAuxiliarySaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ id: number; message: string; tone: "success" | "info" } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string, tone: "success" | "info" = "success") => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  };

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const isAuxiliarySaving = (key: string) => !!auxiliarySaving[key];

  const runAuxiliarySave = async (key: string, action: () => Promise<unknown> | unknown) => {
    if (auxiliarySavingRef.current.has(key)) return;
    auxiliarySavingRef.current.add(key);
    setAuxiliarySaving((prev) => ({ ...prev, [key]: true }));

    try {
      await action();
    } finally {
      auxiliarySavingRef.current.delete(key);
      setAuxiliarySaving((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  useEffect(() => {
    if (menuTab === "new" && !editingPurchaseId && !purchaseHeader.date) {
      setPurchaseHeader((prev) => ({ ...prev, date: getTodayKey() }));
    }
    if (menuTab === "card_use" && !editingCardUseId && !cardForm.date) {
      setCardForm((prev) => ({ ...prev, date: getTodayKey() }));
    }
    if (menuTab === "maint_new" && !editingMaintId && !maintForm.date) {
      setMaintForm((prev) => ({ ...prev, date: getTodayKey() }));
    }
  }, [menuTab, editingPurchaseId, editingCardUseId, editingMaintId, purchaseHeader.date, cardForm.date, maintForm.date]);

  const [receiptPhotos, setReceiptPhotos] = useState<ReceiptPhoto[]>([]);
  const [receiptPhotoForm, setReceiptPhotoForm] = useState({ receipt_date: getTodayKey(), vendor_name: "", memo: "" });
  const [receiptPhotoFiles, setReceiptPhotoFiles] = useState<File[]>([]);
  const [receiptUploadPreviewUrls, setReceiptUploadPreviewUrls] = useState<string[]>([]);
  const [receiptPhotoPreviewOpen, setReceiptPhotoPreviewOpen] = useState<ReceiptPhoto | null>(null);
  const [maintenancePhotos, setMaintenancePhotos] = useState<MaintenancePhoto[]>([]);
  const [maintenancePhotoForm, setMaintenancePhotoForm] = useState({
    maint_date: getTodayKey(),
    equipment_name: "",
    memo: "",
    is_urgent: false,
  });
  const [maintenancePhotoFiles, setMaintenancePhotoFiles] = useState<File[]>([]);
  const [maintenanceUploadPreviewUrls, setMaintenanceUploadPreviewUrls] = useState<string[]>([]);
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
    priority: "ë³´í†µ",
    status: "ì˜ˆì •",
    memo: "",
  });
  const [editingMaintenanceScheduleId, setEditingMaintenanceScheduleId] = useState("");

  const [photoLinkModal, setPhotoLinkModal] = useState<{
    mode: "" | "purchase" | "maint" | "recordPurchase" | "recordMaint";
    targetId: string;
    search: string;
  }>({ mode: "", targetId: "", search: "" });
  const [photoViewer, setPhotoViewer] = useState<{ urls: string[]; index: number; title: string } | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [attachmentViewer, setAttachmentViewer] = useState<{ title: string; urls: string[] } | null>(null);

  const isPdfUrl = (url: string) => String(url || "").toLowerCase().split("?")[0].endsWith(".pdf");
  const isAudioUrl = (url: string) => {
    const target = String(url || "").toLowerCase().split("?")[0];
    return /\.(mp3|m4a|wav|webm|ogg|aac)$/i.test(target);
  };
  const isImageUrl = (url: string) => {
    const target = String(url || "").toLowerCase().split("?")[0];
    return target.match(/\.(jpg|jpeg|png|webp|gif|heic)$/) || String(url || "").startsWith("blob:") || (!isPdfUrl(url) && !isAudioUrl(url) && String(url || "").includes("/storage/"));
  };

  const openPhotoViewer = (urls: string[], index = 0, title = "ì‚¬ì§„ ë³´ê¸°") => {
    const imageUrls = (urls || []).filter((url) => isImageUrl(url));
    if (!imageUrls.length) return;
    const safeIndex = Math.min(Math.max(index, 0), imageUrls.length - 1);
    setPhotoViewer({ urls: imageUrls, index: safeIndex, title });
  };

  const openPdfViewer = (url: string, title = "PDF ë³´ê¸°") => {
    if (!url) return;
    setPdfViewer({ url, title });
  };

  const closePhotoViewer = () => setPhotoViewer(null);
  const closePdfViewer = () => setPdfViewer(null);

  const movePhotoViewer = (direction: number) => {
    setPhotoViewer((prev) => {
      if (!prev) return prev;
      const nextIndex = (prev.index + direction + prev.urls.length) % prev.urls.length;
      return { ...prev, index: nextIndex };
    });
  };


  const [vendorAccounts, setVendorAccounts] = useState<VendorAccount[]>([]);
  const [newVendorAccountForm, setNewVendorAccountForm] = useState({
    vendor_name: "",
    bank_name: "",
    bank_code: "",
    account_name: "",
    customer_display_name: "",
    account_number: "",
    memo: "",
  });
  const [transferMonth, setTransferMonth] = useState(() => getTodayKey().slice(0, 7));
  const [transferVendorSearch, setTransferVendorSearch] = useState("");
  const [transferWarehouseSearch, setTransferWarehouseSearch] = useState("");
  const [transferWarehouseDropdownOpen, setTransferWarehouseDropdownOpen] = useState(false);
  const [selectedTransferWarehouses, setSelectedTransferWarehouses] = useState<string[]>([]);
  const transferWarehouseInitializedRef = useRef(false);
  const previousTransferWarehouseOptionsRef = useRef<string[]>([]);
  const [bulkTransferEdits, setBulkTransferEdits] = useState<Record<string, Partial<BulkTransferRow>>>({});
  const [bulkTransferSelectOpen, setBulkTransferSelectOpen] = useState(false);
  const [selectedBulkTransferIds, setSelectedBulkTransferIds] = useState<string[]>([]);
  const [permits, setPermits] = useState<PermitRenewal[]>([]);
  const [permitSearch, setPermitSearch] = useState({ company: "", keyword: "", status: "" });
  const [permitForm, setPermitForm] = useState({
    company: "íƒœëª…",
    title: "",
    agency: "",
    contact: "",
    expiry_date: "",
    check_note: "",
    memo: "",
    cycle: "",
    status: "ì§„í–‰",
  });
  const [editingPermitId, setEditingPermitId] = useState("");

  const transferWarehouseOptions = useMemo(() => {
    const names = [
      ...(warehouses || []).map((warehouse) => String(warehouse.name || "").trim()),
      ...(purchases || []).map((purchase) => String(purchase.warehouse || "").trim()),
    ].filter(Boolean);

    return Array.from(new Set(names)).sort((a, b) => {
      const aYugang = a.includes("ìœ ê°•ì”¨ì•¤ë””");
      const bYugang = b.includes("ìœ ê°•ì”¨ì•¤ë””");
      if (aYugang !== bYugang) return aYugang ? -1 : 1;
      return a.localeCompare(b, "ko");
    });
  }, [warehouses, purchases]);

  useEffect(() => {
    const previousOptions = previousTransferWarehouseOptionsRef.current;

    setSelectedTransferWarehouses((prev) => {
      const validSelection = prev.filter((warehouse) => transferWarehouseOptions.includes(warehouse));
      const previouslySelectedAll =
        !transferWarehouseInitializedRef.current ||
        (previousOptions.length > 0 && previousOptions.every((warehouse) => prev.includes(warehouse)));

      return previouslySelectedAll ? transferWarehouseOptions : validSelection;
    });

    if (transferWarehouseOptions.length) transferWarehouseInitializedRef.current = true;
    previousTransferWarehouseOptionsRef.current = transferWarehouseOptions;
  }, [transferWarehouseOptions]);

  const selectedTransferWarehouseSet = useMemo(() => new Set(selectedTransferWarehouses), [selectedTransferWarehouses]);
  const isTransferWarehouseFilterActive =
    transferWarehouseOptions.length > 0 &&
    selectedTransferWarehouses.length > 0 &&
    selectedTransferWarehouses.length < transferWarehouseOptions.length;
  const filteredTransferWarehouseOptions = useMemo(() => {
    const keyword = transferWarehouseSearch.trim().toLowerCase();
    if (!keyword) return transferWarehouseOptions;
    return transferWarehouseOptions.filter((warehouse) => warehouse.toLowerCase().includes(keyword));
  }, [transferWarehouseOptions, transferWarehouseSearch]);
  const isAllTransferWarehousesSelected = transferWarehouseOptions.length > 0 && selectedTransferWarehouses.length === transferWarehouseOptions.length;
  const transferWarehouseLabel = !transferWarehouseOptions.length
    ? "ì°½ê³  ì—†ìŒ"
    : isAllTransferWarehousesSelected
      ? `ì „ì²´ ì°½ê³  (${transferWarehouseOptions.length})`
      : selectedTransferWarehouses.length
        ? `${selectedTransferWarehouses.slice(0, 2).join(", ")}${selectedTransferWarehouses.length > 2 ? ` ì™¸ ${selectedTransferWarehouses.length - 2}ê°œ` : ""}`
        : "ì„ íƒ ì—†ìŒ";

  const toggleTransferWarehouse = (warehouseName: string) => {
    setSelectedTransferWarehouses((prev) =>
      prev.includes(warehouseName)
        ? prev.filter((name) => name !== warehouseName)
        : [...prev, warehouseName]
    );
  };


  const loadVendorAccounts = async () => {
    const { data, error } = await fetchAllRows("vendor_accounts", "vendor_name", 1000);

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

  const resetNewVendorAccountForm = () => {
    setNewVendorAccountForm({
      vendor_name: "",
      bank_name: "",
      bank_code: "",
      account_name: "",
      customer_display_name: "",
      account_number: "",
      memo: "",
    });
  };

  const saveNewVendorAccount = async () => {
    const vendorName = newVendorAccountForm.vendor_name.trim();
    if (!vendorName) return alert("ê±°ë˜ì²˜ëª…ì„ ì…ë ¥í•˜ì„¸ìš”.");

    const id = `account-${normalizeVendorName(vendorName)}`;
    const payload: VendorAccount = {
      id,
      vendor_name: vendorName,
      bank_name: newVendorAccountForm.bank_name.trim(),
      bank_code: newVendorAccountForm.bank_code.trim() || bankCodeByName(newVendorAccountForm.bank_name),
      account_name: newVendorAccountForm.account_name.trim(),
      customer_display_name: newVendorAccountForm.customer_display_name.trim() || newVendorAccountForm.account_name.trim() || vendorName,
      account_number: cleanAccountNumber(newVendorAccountForm.account_number),
      memo: newVendorAccountForm.memo.trim(),
    };

    const duplicated = vendorAccounts.find((row) => normalizeVendorName(row.vendor_name) === normalizeVendorName(vendorName));
    if (duplicated && !confirm("ì´ë¯¸ ê°™ì€ ê±°ë˜ì²˜ëª…ì´ ìˆìŠµë‹ˆë‹¤. ê³„ì¢Œì •ë³´ë¥¼ ë®ì–´ì“¸ê¹Œìš”?")) return;

    const { error } = await supabase.from("vendor_accounts").upsert(payload, { onConflict: "id" });
    if (error) return alert(`ê³„ì¢Œ ì¶”ê°€ ì‹¤íŒ¨: ${error.message}`);

    await loadVendorAccounts();
    resetNewVendorAccountForm();
    showToast("ê±°ë˜ì²˜ ê³„ì¢Œê°€ ì €ì¥ë˜ì—ˆìŠµë‹ˆë‹¤.");
  };

  const importVendorAccountsExcel = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const rows: VendorAccount[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const ws = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      json.forEach((r) => {
        const vendorName = String(pick(r, ["ê±°ë˜ì²˜ëª…", "ì—…ì²´ëª…", "ìƒí˜¸"]) || "").trim();
        if (!vendorName) return;

        const bankName = String(pick(r, ["ì€í–‰ëª…", "ì€í–‰"]) || "").trim();
        const bankCode = String(pick(r, ["ì½”ë“œëª…", "ì€í–‰ì½”ë“œ", "ì½”ë“œ"]) || bankCodeByName(bankName)).trim();
        const accountName = String(pick(r, ["ì´ë¦„", "ì˜ˆê¸ˆì£¼", "ì…ê¸ˆìëª…"]) || "").trim();
        const customerDisplayName = String(pick(r, ["ê³ ê°ê´€ë¦¬ì„±ëª…", "ê³ ê°ê´€ë¦¬ëª…"]) || accountName || vendorName).trim();
        const accountNumber = String(pick(r, ["ê³„ì¢Œë²ˆí˜¸", "ê³„ì¢Œ"]) || "").trim();

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

    if (!rows.length) return alert("ê³„ì¢Œ ì—‘ì…€ì—ì„œ ê±°ë˜ì²˜ ê³„ì¢Œ ì •ë³´ë¥¼ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");

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
    if (error) return alert(`ê±°ë˜ì²˜ ê³„ì¢Œ ì—…ë¡œë“œ ì‹¤íŒ¨: ${error.message}`);

    await loadVendorAccounts();
    showToast(`ê±°ë˜ì²˜ ê³„ì¢Œ ${dedupedRows.length}ê±´ì„ ì €ì¥í–ˆìŠµë‹ˆë‹¤. ì¤‘ë³µ ${rows.length - dedupedRows.length}ê±´ì€ ìë™ ì •ë¦¬í–ˆìŠµë‹ˆë‹¤.`);
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
      .filter((p) => {
        if (!transferWarehouseOptions.length) return true;
        if (!selectedTransferWarehouses.length) return false;
        if (!isTransferWarehouseFilterActive) return true;
        return selectedTransferWarehouseSet.has(String(p.warehouse || "").trim());
      })
      .forEach((p) => {
        const vendor = p.vendor || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥";
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
        const memoItem = row.memoItems[0] || "êµ¬ë§¤";
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
    if (!rows.length) return alert("ëŒ€ëŸ‰ì´ì²´ë¡œ ë§Œë“¤ êµ¬ë§¤ë‚´ì—­ì´ ì—†ìŠµë‹ˆë‹¤.");

    const missing = rows.filter((row) => !row.matched);
    if (missing.length) {
      const ok = confirm(`ê³„ì¢Œ ë§¤ì¹­ ì•ˆ ëœ ê±°ë˜ì²˜ê°€ ${missing.length}ê±´ ìˆìŠµë‹ˆë‹¤. ê·¸ë˜ë„ ë‹¤ìš´ë¡œë“œí• ê¹Œìš”?`);
      if (!ok) return;
    }

    const header = ["*ì…ê¸ˆì€í–‰", "*ì…ê¸ˆê³„ì¢Œ", "*ì…ê¸ˆì•¡", "ê³ ê°ê´€ë¦¬ì„±ëª…", "ì…ê¸ˆí†µì¥í‘œì‹œë‚´ìš©", "ì¶œê¸ˆí†µì¥í‘œì‹œë‚´ìš©", "ì…ê¸ˆì¸ì½”ë“œ", "ë¹„ê³ ", "ì—…ì²´ì‚¬ìš©key"];
    const dataRows = rows.map((row) => [
      String(row.bank_code || ""),
      cleanAccountNumber(row.account_number),
      Number(row.amount || 0),
      row.customer_display_name || row.account_name || row.vendor,
      "(ì£¼)íƒœëª…ì‚°ì—…ê°œë°œ",
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
      Title: `${transferMonth || getTodayKey().slice(0, 7)} ëŒ€ëŸ‰ì´ì²´`,
      Subject: "íƒœëª…ì‚°ì—…ê°œë°œ ëŒ€ëŸ‰ì´ì²´",
      Author: "íƒœëª…ì‚°ì—…ê°œë°œ",
      CreatedDate: new Date(),
    };

    XLSX.utils.book_append_sheet(workbook, worksheet, "ëŒ€ëŸ‰ì´ì²´ ë¯¸ì…ê¸ˆë¶„");
    XLSX.writeFile(workbook, `${transferMonth || getTodayKey().slice(0, 7)}_ëŒ€ëŸ‰ì´ì²´.xlsx`, { bookType: "xlsx", cellStyles: true });
  };

  const openBulkTransferDownloadPopup = () => {
    const rows = applyBulkTransferEdits(getBulkTransferRows());
    if (!rows.length) return alert("ëŒ€ëŸ‰ì´ì²´ë¡œ ë§Œë“¤ êµ¬ë§¤ë‚´ì—­ì´ ì—†ìŠµë‹ˆë‹¤.");
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
    const { data, error } = await fetchAllRows("permit_renewals", "expiry_date", 1000);

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
      company: "íƒœëª…",
      title: "",
      agency: "",
      contact: "",
      expiry_date: "",
      check_note: "",
      memo: "",
      cycle: "",
      status: "ì§„í–‰",
    });
  };

  const savePermit = async () => {
    if (editingPermitId && !canEditDeleteRecords) return alert("ìˆ˜ì •ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");
    if (!permitForm.title.trim()) return alert("í—ˆê°€/ì‹ ê³ ëª…ì„ ì…ë ¥í•˜ì„¸ìš”.");

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
      status: permitForm.status || "ì§„í–‰",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("permit_renewals").upsert(payload);

    if (error) return alert(`í—ˆê°€/ê°±ì‹  ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

    await loadPermits();
    resetPermitForm();
    showToast(editingPermitId ? "í—ˆê°€Â·ê°±ì‹  í•­ëª©ì„ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "í—ˆê°€Â·ê°±ì‹  í•­ëª©ì„ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
  };

  const editPermit = (permit: PermitRenewal) => {
    setEditingPermitId(permit.id);
    setPermitForm({
      company: permit.company || "íƒœëª…",
      title: permit.title || "",
      agency: permit.agency || "",
      contact: permit.contact || "",
      expiry_date: permit.expiry_date || "",
      check_note: permit.check_note || "",
      memo: permit.memo || "",
      cycle: permit.cycle || "",
      status: permit.status || "ì§„í–‰",
    });
    setMenuTab("permits");
  };

  const deletePermit = async (id: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = permits.find((item) => item.id === id);
    if (!target) return alert("ì‚­ì œí•  í—ˆê°€/ê°±ì‹  í•­ëª©ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("í—ˆê°€/ê°±ì‹  í•­ëª©ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "permit_renewals",
      module: "í—ˆê°€ê´€ë¦¬",
      record_id: id,
      title: target.title || "",
      detail: `${target.company || "-"} Â· ${target.expiry_date || "ê¸°í•œ ì—†ìŒ"}`,
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("permit_renewals").delete().eq("id", id);
    if (error) return alert(`í—ˆê°€/ê°±ì‹  ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);

    await loadPermits();
  };

  const importPermitExcel = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const rows: any[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const ws = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
      const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell || "").trim() === "ë‚´ìš©"));
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
          status: "ì§„í–‰",
          updated_at: new Date().toISOString(),
        };

        rows.push(permit);
      });
    });

    if (!rows.length) return alert("ì—‘ì…€ì—ì„œ ë“±ë¡í•  í—ˆê°€/ê°±ì‹  í•­ëª©ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");

    const { error } = await supabase.from("permit_renewals").upsert(rows, { onConflict: "id" });

    if (error) return alert(`í—ˆê°€/ê°±ì‹  ì—‘ì…€ ì—…ë¡œë“œ ì‹¤íŒ¨: ${error.message}`);

    await loadPermits();
    showToast(`í—ˆê°€Â·ê°±ì‹  í•­ëª© ${rows.length}ê±´ì„ ì €ì¥í–ˆìŠµë‹ˆë‹¤.`);
  };


  const loadAll = async () => {
    setLoading(true);
    const [vRes, gRes, wRes, iRes, pRes, mRes, cRes] = await Promise.all([
      fetchAllRows("vendors", "code", 1000),
      fetchAllRows("warehouse_groups", "code", 1000),
      fetchAllRows("warehouses", "code", 1000),
      fetchAllRows("items", "code", 1000),
      fetchAllRows("purchases", "date", 1000, false),
      fetchAllRows("maints", "date", 1000, false),
      fetchAllRows("card_uses", "date", 1000, false),
    ]);

    if (vRes.error || gRes.error || wRes.error || iRes.error || pRes.error || mRes.error || cRes.error) {
      console.error(vRes.error || gRes.error || wRes.error || iRes.error || pRes.error || mRes.error || cRes.error);
      alert("Supabase ë°ì´í„°ë¥¼ ë¶ˆëŸ¬ì˜¤ì§€ ëª»í–ˆìŠµë‹ˆë‹¤. .envì™€ RLS ì •ì±…ì„ í™•ì¸í•˜ì„¸ìš”.");
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

    setVendorForm({ code: "", name: "", owner: "", phone: "", mobile: "", address: "", address_detail: "" });
    setGroupForm({ code: nextCode(nextGroups), name: "" });
    setWarehouseForm({ group: "", code: nextCode(nextWarehouses), name: "" });
    setItemForm({ code: nextItemCode(nextItems), name: "", spec: "", unit: "", price: "" });
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
    if (!session) {
      setUserPermissions([]);
      setUserPermissionsLoading(true);
      return;
    }

    let active = true;

    const loadAuthorizedSession = async () => {
      const permissions = await loadUserPermissions();
      if (!active) return;

      const approved = isAdmin || permissions.some((item) => item.email === userEmail);
      if (!approved) {
        setLoading(false);
        return;
      }

      await Promise.all([
        loadAll(),
        loadPermits(),
        loadVendorAccounts(),
        loadReceiptPhotos(),
        loadMaintenancePhotos(),
        loadMaintenanceSchedules(),
        loadSiteNotices(),
        loadActivityLogs(),
        loadDeletedRecords(),
      ]);
    };

    loadAuthorizedSession();

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !isPermissionApproved) return;

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

    if (menuTab === "activity_logs") {
      loadActivityLogs();
    }

    if (menuTab === "trash_bin") {
      loadDeletedRecords();
    }
  }, [menuTab, session]);


  useEffect(() => {
    if (!session) return;

    const onPopState = () => {
      const url = new URL(window.location.href);
      const nextTab = url.searchParams.get("tab") || window.history.state?.erpMenuTab || "home";

      skipNextMenuHistoryRef.current = true;
      setMenuTab(canAccessTab(nextTab) ? nextTab : getFirstAllowedTab());
      setMobileSheet("");
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email, currentRole, userPermissions.length]);

  useEffect(() => {
    if (!session) return;

    const url = new URL(window.location.href);
    url.searchParams.set("tab", menuTab);

    const nextState = {
      ...(window.history.state || {}),
      erpMenuTab: menuTab,
    };

    if (!menuHistoryReadyRef.current) {
      window.history.replaceState(nextState, "", url);
      menuHistoryReadyRef.current = true;
      return;
    }

    if (skipNextMenuHistoryRef.current) {
      skipNextMenuHistoryRef.current = false;
      window.history.replaceState(nextState, "", url);
      return;
    }

    window.history.pushState(nextState, "", url);
  }, [menuTab, session]);

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
    () => items.map((i) => ({
      id: i.id,
      label: i.name,
      value: i.name,
      code: i.code,
      name: i.name,
      spec: i.spec,
      unit: i.unit,
      price: i.price,
    })).filter((i) => i.name),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      `${it.code || ""} ${it.name || ""} ${it.spec || ""} ${it.unit || ""}`.toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  const updateRow = (index: number, key: keyof PurchaseRow, value: any, selectedItem?: Partial<Item>) => {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    if (key === "item") {
      const exactMatches = items.filter((i) => i.name === value);
      const item = selectedItem || (exactMatches.length === 1 ? exactMatches[0] : undefined);
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

  const removePurchaseRow = (index: number) => {
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, rowIndex) => rowIndex !== index)));
  };

  const validPurchaseRows = rows.filter((r) => r.item && Number(r.qty || 0) > 0);
  const purchaseSupplyTotal = validPurchaseRows.reduce((sum, r) => sum + Number(r.supply || 0), 0);
  const purchaseVatTotal = validPurchaseRows.reduce((sum, r) => sum + Number(r.vat || 0), 0);
  const purchaseTotal = validPurchaseRows.reduce((sum, r) => sum + Number(r.total || 0), 0);

  const parsePurchaseImportDateNo = (value: any) => {
    const raw = String(value || "").trim();
    const match = raw.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*-?\s*(\d+)?/);
    if (!match) return { date: "", no: "" };

    return {
      date: `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`,
      no: String(match[4] || "1").padStart(2, "0"),
    };
  };

  const parsePurchaseImportMoney = (value: any) => {
    const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
    const num = Number(cleaned || 0);
    return Number.isFinite(num) ? num : 0;
  };

  const splitImportedItemSpec = (value: any) => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(.*?)\s*\[([^\]]*)\]\s*$/);
    if (!match) return { item: raw, spec: "" };
    return { item: match[1].trim(), spec: match[2].trim() };
  };

  const normalizeWarehouseImportText = (value: any) =>
    String(value || "")
      .replace(/[\s()\[\]{}\-_/]/g, "")
      .toLowerCase();

  const resolveImportedWarehouseName = (rawValue: any, workingGroups: Group[], workingWarehouses: Warehouse[]) => {
    const raw = String(rawValue || "").trim();
    if (!raw) return "";

    const normalizedRaw = normalizeWarehouseImportText(raw);

    const groupMatch = workingGroups.find((group) => normalizeWarehouseImportText(group.name) === normalizedRaw);
    if (groupMatch) return groupMatch.name;

    const exactWarehouseMatch = workingWarehouses.find((warehouse) => {
      const display = `${warehouse.group} / ${warehouse.name}`;
      return normalizeWarehouseImportText(display) === normalizedRaw || normalizeWarehouseImportText(warehouse.name) === normalizedRaw;
    });
    if (exactWarehouseMatch) return `${exactWarehouseMatch.group} / ${exactWarehouseMatch.name}`;

    const rawNumbers = raw.match(/\d{3,}/g) || [];
    const numberWarehouseMatch = rawNumbers.length
      ? workingWarehouses.find((warehouse) => {
          const target = normalizeWarehouseImportText(`${warehouse.code || ""} ${warehouse.name || ""}`);
          return rawNumbers.some((num) => target.includes(num));
        })
      : undefined;
    if (numberWarehouseMatch) return `${numberWarehouseMatch.group} / ${numberWarehouseMatch.name}`;

    const partialWarehouseMatch = workingWarehouses.find((warehouse) => {
      const detail = normalizeWarehouseImportText(warehouse.name);
      return detail.length >= 3 && (normalizedRaw.includes(detail) || detail.includes(normalizedRaw));
    });
    if (partialWarehouseMatch) return `${partialWarehouseMatch.group} / ${partialWarehouseMatch.name}`;

    return raw;
  };

  const importPurchaseHistoryExcel = async (file: File) => {
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");

    const excelRows = await readExcelRows(file);
    if (!excelRows.length) return alert("ì—‘ì…€ì—ì„œ êµ¬ë§¤ë‚´ì—­ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");

    const workingGroups = [...groups];
    const newGroups: Group[] = [];

    const ensureGroup = (name: string) => {
      const trimmed = String(name || "").trim();
      if (!trimmed) return;

      const exists = workingGroups.some((group) => normalizeWarehouseImportText(group.name) === normalizeWarehouseImportText(trimmed));
      if (exists) return;

      const nextGroup = {
        id: uid(),
        code: nextCode(workingGroups),
        name: trimmed,
      };

      workingGroups.push(nextGroup);
      newGroups.push(nextGroup);
    };

    const grouped = new Map<string, Purchase>();
    let skippedRows = 0;

    excelRows.forEach((row) => {
      const dateNoRaw = pick(row, ["ì¼ì-No", "ì¼ì", "ë‚ ì§œ"]);
      const { date, no } = parsePurchaseImportDateNo(dateNoRaw);
      const vendor = String(pick(row, ["ê±°ë˜ì²˜ëª…", "ê±°ë˜ì²˜", "ì—…ì²´ëª…"]) || "").trim();
      const itemRaw = String(pick(row, ["í’ˆëª©ëª…(ê·œê²©)", "í’ˆëª©ëª…", "í’ˆëª©"]) || "").trim();
      const warehouseRaw = String(pick(row, ["ì°½ê³ ëª…", "ì°½ê³ "]) || "").trim();
      const combined = `${dateNoRaw || ""} ${vendor} ${itemRaw} ${warehouseRaw}`;

      if (!date || !vendor || !itemRaw || /(?:^|\s)(ê³„|í•©ê³„|ì†Œê³„)(?:\s|$)/.test(combined)) {
        skippedRows += 1;
        return;
      }

      const warehouse = resolveImportedWarehouseName(warehouseRaw, workingGroups, warehouses);
      if (warehouse && !warehouse.includes(" / ")) ensureGroup(warehouse);

      const { item, spec } = splitImportedItemSpec(itemRaw);
      const qty = parsePurchaseImportMoney(pick(row, ["ìˆ˜ëŸ‰"]));
      const price = parsePurchaseImportMoney(pick(row, ["ë‹¨ê°€"]));
      const supply = parsePurchaseImportMoney(pick(row, ["ê³µê¸‰ê°€ì•¡", "ê³µê¸‰ì•¡"]));
      const vat = parsePurchaseImportMoney(pick(row, ["ë¶€ê°€ì„¸", "ë¶€ê°€ì„¸ì•¡"]));
      const total = parsePurchaseImportMoney(pick(row, ["í•©ê³„", "ì´ì•¡"]));
      const memo = String(pick(row, ["ì ìš”", "ë¹„ê³ ", "ë©”ëª¨"]) || "").trim();

      const purchaseRow: PurchaseRow = {
        id: uid(),
        item: memo ? `${item}` : item,
        spec,
        qty: qty || 1,
        price,
        supply,
        vat,
        total: total || supply + vat,
      };

      const key = `${date}-${no}`;
      const prev = grouped.get(key);

      if (prev) {
        prev.rows = [...prev.rows, purchaseRow];
        prev.supplyTotal = prev.rows.reduce((sum, itemRow) => sum + Number(itemRow.supply || 0), 0);
        prev.vatTotal = prev.rows.reduce((sum, itemRow) => sum + Number(itemRow.vat || 0), 0);
        prev.total = prev.rows.reduce((sum, itemRow) => sum + Number(itemRow.total || 0), 0);
        prev.itemSummary = getPurchaseItemSummary(prev);
        grouped.set(key, prev);
        return;
      }

      grouped.set(key, {
        id: `purchase-import-${date}-${no}`,
        date,
        vendor,
        warehouse,
        rows: [purchaseRow],
        supplyTotal: purchaseRow.supply,
        vatTotal: purchaseRow.vat,
        total: purchaseRow.total,
        itemSummary: getPurchaseItemSummary({ itemSummary: purchaseRow.item, rows: [purchaseRow] }),
        image_urls: [],
        image_url: "",
      });
    });

    const purchaseRows = Array.from(grouped.values());
    if (!purchaseRows.length) return alert("ë“±ë¡í•  êµ¬ë§¤ë‚´ì—­ì´ ì—†ìŠµë‹ˆë‹¤. í•©ê³„ í–‰ì´ë‚˜ ë¹ˆ í–‰ë§Œ ìˆëŠ”ì§€ í™•ì¸í•˜ì„¸ìš”.");

    if (newGroups.length) {
      const groupError = await upsertInChunks("warehouse_groups", newGroups);
      if (groupError) return alert(`ì°½ê³  ì €ì¥ ì‹¤íŒ¨: ${groupError.message}`);
    }

    const purchaseError = await upsertInChunks("purchases", purchaseRows.map(fromPurchase));
    if (purchaseError) return alert(`êµ¬ë§¤ë‚´ì—­ ì—…ë¡œë“œ ì‹¤íŒ¨: ${purchaseError.message}`);

    await addActivityLog({
      module: "êµ¬ë§¤",
      action: "ì—‘ì…€ì—…ë¡œë“œ",
      target_title: `êµ¬ë§¤ë‚´ì—­ ${purchaseRows.length}ê±´`,
      detail: `ì œì™¸ ${skippedRows}í–‰ Â· ìƒˆ ì°½ê³  ${newGroups.length}ê±´`,
    });

    await loadAll();
    showToast(`êµ¬ë§¤ë‚´ì—­ ${purchaseRows.length}ê±´ì„ ì—…ë¡œë“œí–ˆìŠµë‹ˆë‹¤. í•©ê³„Â·ë¹ˆ í–‰ ${skippedRows}í–‰ì€ ì œì™¸í–ˆìŠµë‹ˆë‹¤.`);
  };

  const hasPurchaseFormValue = () => !!(
    (purchaseHeader.date && purchaseHeader.date !== getTodayKey()) ||
    purchaseHeader.vendor ||
    purchaseHeader.warehouse ||
    (purchaseHeader.image_urls || []).length ||
    rows.some((row) => row.item || row.spec || row.qty || row.price || row.supply || row.vat || row.total) ||
    editingPurchaseId
  );

  const clearPurchaseDraft = () => {
    try {
      localStorage.removeItem(PURCHASE_DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const clearPurchaseForm = () => {
    setPurchaseHeader({ date: getTodayKey(), vendor: "", warehouse: "", image_urls: [] });
    setRows([emptyRow()]);
    setEditingPurchaseId("");
    setLinkingReceiptPhotoId("");
    clearPurchaseDraft();
  };

  const resetPurchaseForm = () => {
    if (hasPurchaseFormValue() && !window.confirm("ì‘ì„± ì¤‘ì¸ êµ¬ë§¤ì…ë ¥ ë‚´ìš©ì„ ëª¨ë‘ ì´ˆê¸°í™”í• ê¹Œìš”?")) return;
    clearPurchaseForm();
  };

  const openPurchaseEntryPopup = () => {
    if (!hasPurchaseFormValue()) clearPurchaseForm();
    setPurchaseEntryPopupOpen(true);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PURCHASE_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft?.purchaseHeader) setPurchaseHeader(draft.purchaseHeader);
        if (Array.isArray(draft?.rows) && draft.rows.length) setRows(draft.rows);
        if (draft?.editingPurchaseId) setEditingPurchaseId(draft.editingPurchaseId);
      }
    } catch {
      clearPurchaseDraft();
    } finally {
      setPurchaseDraftReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!purchaseDraftReady) return;
    if (!hasPurchaseFormValue()) {
      clearPurchaseDraft();
      return;
    }

    try {
      localStorage.setItem(PURCHASE_DRAFT_KEY, JSON.stringify({
        purchaseHeader,
        rows,
        editingPurchaseId,
        saved_at: new Date().toISOString(),
      }));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseHeader, rows, editingPurchaseId, purchaseDraftReady]);

  const savePurchase = async () => {
    if (purchaseSavingRef.current) return;
    if (purchaseUploading) return alert("ì²¨ë¶€íŒŒì¼ ì—…ë¡œë“œê°€ ëë‚œ í›„ ì €ì¥í•´ ì£¼ì„¸ìš”.");
    if (editingPurchaseId && !canEditDeleteRecords) return alert("ìˆ˜ì •ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");
    const validRows = validPurchaseRows;
    if (!purchaseHeader.vendor || !purchaseHeader.warehouse || !validRows.length) return alert("ê±°ë˜ì²˜, ì°½ê³ , í’ˆëª©/ìˆ˜ëŸ‰ì„ í™•ì¸í•˜ì„¸ìš”.");
    purchaseSavingRef.current = true;
    setPurchaseSaving(true);

    try {
      const payload: Purchase = {
        id: editingPurchaseId || uid(),
        ...purchaseHeader,
        date: purchaseHeader.date || getTodayKey(),
        rows: validRows,
        supplyTotal: purchaseSupplyTotal,
        vatTotal: purchaseVatTotal,
        total: purchaseTotal,
        itemSummary: getPurchaseItemSummary({ itemSummary: validRows[0].item, rows: validRows }),
        taxInvoiceReceived: editingPurchaseId
          ? Boolean(purchases.find((purchase) => purchase.id === editingPurchaseId)?.taxInvoiceReceived)
          : false,
        image_urls: purchaseHeader.image_urls || [],
        image_url: (purchaseHeader.image_urls || [])[0] || "",
      };
      const { error } = await supabase.from("purchases").upsert(fromPurchase(payload));
      if (error) return alert(`êµ¬ë§¤ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
      setPurchases((prev) => (editingPurchaseId ? prev.map((p) => (p.id === editingPurchaseId ? payload : p)) : [payload, ...prev]));
      await addActivityLog({
        module: "êµ¬ë§¤",
        action: editingPurchaseId ? "ìˆ˜ì •" : "ë“±ë¡",
        target_id: payload.id,
        target_title: `${payload.vendor || "-"} / ${getPurchaseItemSummary(payload)}`,
        detail: `${payload.date || "-"} Â· ${payload.warehouse || "-"} Â· ${money(payload.total)}ì›`,
      });
      if (linkingReceiptPhotoId) {
        await markReceiptPhotoProcessed(linkingReceiptPhotoId);
        setLinkingReceiptPhotoId("");
      }
      clearPurchaseForm();
      setPurchaseEntryPopupOpen(false);
      showToast(editingPurchaseId ? "êµ¬ë§¤ë‚´ì—­ì„ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "êµ¬ë§¤ë‚´ì—­ì„ ì €ì¥í–ˆìŠµë‹ˆë‹¤.");
      setMenuTab("list");
    } catch (error: any) {
      const message = error?.message ? `êµ¬ë§¤ ì €ì¥ ì¤‘ ì˜¤ë¥˜: ${error.message}` : "êµ¬ë§¤ ì €ì¥ ì¤‘ ì•Œ ìˆ˜ ì—†ëŠ” ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤.";
      alert(message);
    } finally {
      purchaseSavingRef.current = false;
      setPurchaseSaving(false);
    }
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


  const getUploadFileExtension = (file: File, fallback = "bin") => {
    const nameExt = String(file.name || "").split(".").pop()?.toLowerCase() || "";
    if (nameExt && /^[a-z0-9]+$/.test(nameExt) && nameExt.length <= 8) return nameExt;
    if (file.type === "application/pdf") return "pdf";
    if (file.type.startsWith("audio/")) return file.type.split("/")[1] || "audio";
    if (file.type.startsWith("image/")) return "jpg";
    return fallback;
  };

  const formatUploadSize = (bytes: number) => {
    if (!bytes) return "0B";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const validateAttachmentFiles = (inputFiles: FileList | File[]) => {
    const files = Array.from(inputFiles || []);
    const maxFileCount = 20;
    const maxBatchSize = 100 * 1024 * 1024;
    const imageLimit = 20 * 1024 * 1024;
    const pdfLimit = 30 * 1024 * 1024;
    const audioLimit = 50 * 1024 * 1024;
    const imagePattern = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;
    const audioPattern = /\.(mp3|m4a|wav|webm|ogg|aac)$/i;

    if (!files.length) return [] as File[];
    if (files.length > maxFileCount) {
      alert(`ì²¨ë¶€íŒŒì¼ì€ í•œ ë²ˆì— ìµœëŒ€ ${maxFileCount}ê°œê¹Œì§€ ì„ íƒí•  ìˆ˜ ìˆìŠµë‹ˆë‹¤. í˜„ì¬ ${files.length}ê°œë¥¼ ì„ íƒí–ˆìŠµë‹ˆë‹¤.`);
      return null;
    }

    const unsupported: string[] = [];
    const oversized: string[] = [];

    files.forEach((file) => {
      const isImage = file.type.startsWith("image/") || imagePattern.test(file.name || "");
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
      const isAudio = file.type.startsWith("audio/") || audioPattern.test(file.name || "");

      if (!isImage && !isPdf && !isAudio) {
        unsupported.push(file.name || "ì´ë¦„ ì—†ëŠ” íŒŒì¼");
        return;
      }

      const limit = isImage ? imageLimit : isPdf ? pdfLimit : audioLimit;
      if (file.size > limit) {
        oversized.push(`${file.name || "ì´ë¦„ ì—†ëŠ” íŒŒì¼"} (${formatUploadSize(file.size)} / ì œí•œ ${formatUploadSize(limit)})`);
      }
    });

    if (unsupported.length) {
      alert(`ì§€ì›í•˜ì§€ ì•ŠëŠ” íŒŒì¼ í˜•ì‹ì…ë‹ˆë‹¤.\n${unsupported.slice(0, 5).join("\n")}${unsupported.length > 5 ? `\nì™¸ ${unsupported.length - 5}ê°œ` : ""}\n\nì‚¬ì§„Â·PDFÂ·ìŒì„±íŒŒì¼ë§Œ ì—…ë¡œë“œí•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.`);
      return null;
    }

    if (oversized.length) {
      alert(`íŒŒì¼ ìš©ëŸ‰ ì œí•œì„ ì´ˆê³¼í–ˆìŠµë‹ˆë‹¤.\n${oversized.slice(0, 5).join("\n")}${oversized.length > 5 ? `\nì™¸ ${oversized.length - 5}ê°œ` : ""}`);
      return null;
    }

    const totalSize = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalSize > maxBatchSize) {
      alert(`í•œ ë²ˆì— ì„ íƒí•œ íŒŒì¼ì˜ í•©ê³„ëŠ” ${formatUploadSize(maxBatchSize)} ì´í•˜ì—¬ì•¼ í•©ë‹ˆë‹¤. í˜„ì¬ ${formatUploadSize(totalSize)}ì…ë‹ˆë‹¤.`);
      return null;
    }

    return files;
  };

  const uploadPurchaseFiles = async (files: FileList | File[]) => {
    const uploadedUrls: string[] = [];
    const validFiles = validateAttachmentFiles(files);
    if (!validFiles) return uploadedUrls;

    for (const file of validFiles) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = isImage ? "jpg" : getUploadFileExtension(file);
      const fileName = `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("receipts").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`êµ¬ë§¤ ì²¨ë¶€ ì—…ë¡œë“œ ì‹¤íŒ¨ (${file.name || "ì´ë¦„ ì—†ëŠ” íŒŒì¼"}): ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("receipts").getPublicUrl(fileName);
      const isAudioUpload = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg|aac)$/i.test(file.name || "");
      uploadedUrls.push(isAudioUpload ? `${data.publicUrl}?erp_file=audio` : data.publicUrl);
    }

    return uploadedUrls;
  };


  const uploadCardReceipts = async (files: FileList | File[]) => {
    const uploadedUrls: string[] = [];
    const validFiles = validateAttachmentFiles(files);
    if (!validFiles) return uploadedUrls;

    for (const file of validFiles) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = isImage ? "jpg" : getUploadFileExtension(file);
      const fileName = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("receipts").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`ì˜ìˆ˜ì¦ ì—…ë¡œë“œ ì‹¤íŒ¨ (${file.name || "ì´ë¦„ ì—†ëŠ” íŒŒì¼"}): ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("receipts").getPublicUrl(fileName);
      const isAudioUpload = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg|aac)$/i.test(file.name || "");
      uploadedUrls.push(isAudioUpload ? `${data.publicUrl}?erp_file=audio` : data.publicUrl);
    }

    return uploadedUrls;
  };



  const uploadMaintFiles = async (files: FileList | File[]) => {
    const uploadedUrls: string[] = [];
    const validFiles = validateAttachmentFiles(files);
    if (!validFiles) return uploadedUrls;

    for (const file of validFiles) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = isImage ? "jpg" : getUploadFileExtension(file);
      const fileName = `maint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("receipts").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`ì •ë¹„ ì²¨ë¶€ ì—…ë¡œë“œ ì‹¤íŒ¨ (${file.name || "ì´ë¦„ ì—†ëŠ” íŒŒì¼"}): ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("receipts").getPublicUrl(fileName);
      const isAudioUpload = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg|aac)$/i.test(file.name || "");
      uploadedUrls.push(isAudioUpload ? `${data.publicUrl}?erp_file=audio` : data.publicUrl);
    }

    return uploadedUrls;
  };


  const loadMaintenancePhotos = async () => {
    const { data, error } = await fetchAllRows("maintenance_photos", "maint_date", 1000, false);

    if (error) {
      console.error(error);
      return;
    }

    setMaintenancePhotos(((data || []) as any[]).map((item) => ({
      ...item,
      id: String(item.id),
      maint_date: item.maint_date ? String(item.maint_date).slice(0, 10) : "",
      image_urls: item.image_urls || [],
    })).sort((a, b) => String(b.maint_date || "").localeCompare(String(a.maint_date || "")) || String(b.created_at || "").localeCompare(String(a.created_at || ""))) as MaintenancePhoto[]);
  };

  const loadMaintenanceSchedules = async () => {
    const { data, error } = await fetchAllRows("maintenance_schedules", "schedule_date", 1000);

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
    const validFiles = validateAttachmentFiles(files);
    if (!validFiles) return uploadedUrls;

    for (const file of validFiles) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = isImage ? "jpg" : getUploadFileExtension(file);
      const fileName = `maintenance-photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("maintenance-photos").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`ì •ë¹„ì‚¬ì§„ ì—…ë¡œë“œ ì‹¤íŒ¨ (${file.name || "ì´ë¦„ ì—†ëŠ” íŒŒì¼"}): ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("maintenance-photos").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const saveMaintenancePhoto = async () => {
    if (maintenancePhotoSaving) return;
    if (!maintenancePhotoForm.maint_date) return alert("ì¼ìë¥¼ ì…ë ¥í•˜ì„¸ìš”.");
    if (!maintenancePhotoForm.equipment_name.trim()) return alert("ì„¤ë¹„ëª…ì„ ì…ë ¥í•˜ì„¸ìš”.");
    if (!maintenancePhotoForm.memo.trim() && !maintenancePhotoFiles.length) return alert("ì •ë¹„ë‚´ìš© ë˜ëŠ” ì‚¬ì§„ì„ ì…ë ¥í•˜ì„¸ìš”.");

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
        alert("ê°™ì€ ì¼ì/ì„¤ë¹„ëª…/ë‚´ìš©ì˜ ì •ë¹„ì‚¬ì§„ì´ ì´ë¯¸ ë“±ë¡ë˜ì–´ ìˆìŠµë‹ˆë‹¤.");
        return;
      }

      const imageUrls = maintenancePhotoFiles.length ? await uploadMaintenancePhotoFiles(maintenancePhotoFiles) : [];

      const payload: MaintenancePhoto = {
        id: uid(),
        maint_date: maintenancePhotoForm.maint_date,
        equipment_name: equipmentName,
        memo,
        image_urls: imageUrls,
        created_by: userEmail || "ì§ì›",
        is_processed: false,
        is_urgent: maintenancePhotoForm.is_urgent,
      };

      const { error } = await supabase.from("maintenance_photos").insert(payload);
      if (error) return alert(`ì •ë¹„ì‚¬ì§„ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

      await addActivityLog({
        module: "ì •ë¹„ì‚¬ì§„",
        action: "ë“±ë¡",
        target_id: payload.id,
        target_title: equipmentName,
        detail: `${payload.maint_date} Â· ${memo || "ë‚´ìš© ì—†ìŒ"} Â· ì²¨ë¶€ ${imageUrls.length}ê°œ${payload.is_urgent ? " Â· ê¸´ê¸‰" : ""}`,
      });

      setMaintenancePhotoForm({ maint_date: getTodayKey(), equipment_name: "", memo: "", is_urgent: false });
      setMaintenancePhotoFiles([]);
      setMaintenanceUploadPreviewUrls([]);
      await loadMaintenancePhotos();
      showToast("ì •ë¹„ì‚¬ì§„ì´ ë“±ë¡ë˜ì—ˆìŠµë‹ˆë‹¤.");
    } finally {
      setMaintenancePhotoSaving(false);
    }
  };

  const toggleMaintenancePhotoProcessed = async (item: MaintenancePhoto) => {
    if (!canEditDeleteRecords) return alert("ì²˜ë¦¬ìƒíƒœ ë³€ê²½ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");

    const { error } = await supabase
      .from("maintenance_photos")
      .update({ is_processed: !item.is_processed })
      .eq("id", item.id);

    if (error) return alert(`ì²˜ë¦¬ìƒíƒœ ë³€ê²½ ì‹¤íŒ¨: ${error.message}`);

    await addActivityLog({
      module: "ì •ë¹„ì‚¬ì§„",
      action: item.is_processed ? "ë¯¸ì²˜ë¦¬ ë³€ê²½" : "ì²˜ë¦¬ì™„ë£Œ",
      target_id: item.id,
      target_title: item.equipment_name || "",
      detail: item.memo || "",
    });

    await loadMaintenancePhotos();
  };

  const deleteMaintenancePhoto = async (id: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = maintenancePhotos.find((item) => item.id === id);
    if (!target) return alert("ì‚­ì œí•  ì •ë¹„ì‚¬ì§„ ë“±ë¡ê±´ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ì •ë¹„ì‚¬ì§„ ë“±ë¡ê±´ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "maintenance_photos",
      module: "ì •ë¹„ì‚¬ì§„",
      record_id: id,
      title: target.equipment_name || "",
      detail: target.memo || "",
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("maintenance_photos").delete().eq("id", id);
    if (error) return alert(`ì •ë¹„ì‚¬ì§„ ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);

    await addActivityLog({
      module: "ì •ë¹„ì‚¬ì§„",
      action: "íœ´ì§€í†µ ì´ë™",
      target_id: id,
      target_title: target?.equipment_name || "",
      detail: target?.memo || "",
    });

    await loadMaintenancePhotos();
  };

  const resetMaintenanceScheduleForm = () => {
    setMaintenanceScheduleForm({
      schedule_date: getTodayKey(),
      equipment_name: "",
      work_detail: "",
      worker_name: "",
      priority: "ë³´í†µ",
      status: "ì˜ˆì •",
      memo: "",
    });
    setEditingMaintenanceScheduleId("");
  };

  const saveMaintenanceSchedule = async () => {
    if (editingMaintenanceScheduleId && !canEditDeleteRecords) return alert("ìˆ˜ì •ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");
    if (!maintenanceScheduleForm.schedule_date) return alert("ì˜ˆì •ì¼ì„ ì…ë ¥í•˜ì„¸ìš”.");
    if (!maintenanceScheduleForm.equipment_name.trim()) return alert("ì¥ë¹„ëª…ì„ ì…ë ¥í•˜ì„¸ìš”.");
    if (!maintenanceScheduleForm.work_detail.trim()) return alert("ì‘ì—…ë‚´ìš©ì„ ì…ë ¥í•˜ì„¸ìš”.");

    const payload: MaintenanceSchedule = {
      id: editingMaintenanceScheduleId || uid(),
      schedule_date: maintenanceScheduleForm.schedule_date,
      equipment_name: maintenanceScheduleForm.equipment_name.trim(),
      work_detail: maintenanceScheduleForm.work_detail.trim(),
      worker_name: maintenanceScheduleForm.worker_name.trim(),
      priority: maintenanceScheduleForm.priority || "ë³´í†µ",
      status: maintenanceScheduleForm.status || "ì˜ˆì •",
      memo: maintenanceScheduleForm.memo.trim(),
    };

    const { error } = await supabase.from("maintenance_schedules").upsert(payload);
    if (error) return alert(`ì •ë¹„ì¼ì • ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

    await loadMaintenanceSchedules();
    resetMaintenanceScheduleForm();
    showToast(editingMaintenanceScheduleId ? "ì •ë¹„ì¼ì •ì„ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "ì •ë¹„ì¼ì •ì„ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
    setMenuTab("maintenance_schedules");
  };

  const editMaintenanceSchedule = (item: MaintenanceSchedule) => {
    setEditingMaintenanceScheduleId(item.id);
    setMaintenanceScheduleForm({
      schedule_date: item.schedule_date || getTodayKey(),
      equipment_name: item.equipment_name || "",
      work_detail: item.work_detail || "",
      worker_name: item.worker_name || "",
      priority: item.priority || "ë³´í†µ",
      status: item.status || "ì˜ˆì •",
      memo: item.memo || "",
    });
    setMenuTab("maintenance_schedule_new");
  };

  const deleteMaintenanceSchedule = async (id: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = maintenanceSchedules.find((item) => item.id === id);
    if (!target) return alert("ì‚­ì œí•  ì •ë¹„ì¼ì •ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ì •ë¹„ì¼ì •ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "maintenance_schedules",
      module: "ì •ë¹„ì¼ì •",
      record_id: id,
      title: target.equipment_name || "",
      detail: `${target.schedule_date || "-"} Â· ${target.work_detail || "-"}`,
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("maintenance_schedules").delete().eq("id", id);
    if (error) return alert(`ì •ë¹„ì¼ì • ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);
    setMaintenanceSchedules((prev) => prev.filter((item) => item.id !== id));
  };

  const updateMaintenanceScheduleStatus = async (item: MaintenanceSchedule, status: string) => {
    if (!canEditDeleteRecords) return alert("ìƒíƒœ ë³€ê²½ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");

    const { error } = await supabase
      .from("maintenance_schedules")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) return alert(`ì •ë¹„ì¼ì • ìƒíƒœ ë³€ê²½ ì‹¤íŒ¨: ${error.message}`);

    setMaintenanceSchedules((prev) => prev.map((x) => (x.id === item.id ? { ...x, status } : x)));

    if (status !== "ì™„ë£Œ") return;

    const maintId = `schedule-maint-${item.id}`;
    const exists = maints.some((m) => m.id === maintId);

    if (!exists) {
      const newMaint: Maint = {
        id: maintId,
        date: item.schedule_date || getTodayKey(),
        warehouse: item.equipment_name || "",
        manager: item.worker_name || userEmail || "",
        title: item.work_detail || "ì •ë¹„ì¼ì • ì™„ë£Œ",
        detail: item.memo || item.work_detail || "",
        cost: 0,
        items: [],
        supplyTotal: 0,
        vatTotal: 0,
        total: 0,
        image_urls: [],
      };

      const { error: maintError } = await supabase.from("maints").upsert(newMaint, { onConflict: "id" });
      if (maintError) return alert(`ì •ë¹„ì¡°íšŒ ìë™ë“±ë¡ ì‹¤íŒ¨: ${maintError.message}`);

      setMaints((prev) => [newMaint, ...prev]);
      showToast("ì •ë¹„ì¼ì •ì„ ì™„ë£Œ ì²˜ë¦¬í•˜ê³  ì •ë¹„ì¡°íšŒì— ìë™ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
    }
  };

  const markReceiptPhotoProcessed = async (id: string) => {
    const { error } = await supabase
      .from("receipt_photos")
      .update({ is_processed: true })
      .eq("id", id);

    if (error) {
      alert(`ì…ê³ ì‚¬ì§„ ì²˜ë¦¬ì™„ë£Œ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
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
      alert(`ì •ë¹„ì‚¬ì§„ ì²˜ë¦¬ì™„ë£Œ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
      return false;
    }

    setMaintenancePhotos((prev) => prev.map((item) => item.id === id ? { ...item, is_processed: true } : item));
    return true;
  };

  const applyReceiptPhotoToPurchase = (item: ReceiptPhoto) => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ êµ¬ë§¤ì…ë ¥ì— ë°˜ì˜í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");

    setPurchaseHeader({
      date: item.receipt_date || getTodayKey(),
      vendor: item.vendor_name || "",
      warehouse: "",
      image_urls: item.image_urls || [],
    });
    setRows([emptyRow()]);
    setEditingPurchaseId("");
    setLinkingReceiptPhotoId(item.id);

    setMenuTab("new");
    showToast("ì…ê³ ì‚¬ì§„ì„ êµ¬ë§¤ì…ë ¥ì— ë°˜ì˜í–ˆìŠµë‹ˆë‹¤. ë‚˜ë¨¸ì§€ í•­ëª©ì„ ì…ë ¥í•´ ì£¼ì„¸ìš”.", "info");
  };

  const applyMaintenancePhotoToMaint = (item: MaintenancePhoto) => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ì •ë¹„ë“±ë¡ì— ë°˜ì˜í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");

    setMaintForm({
      date: item.maint_date || getTodayKey(),
      warehouse: item.equipment_name || "",
      manager: userEmail || "",
      title: item.is_urgent ? "ê¸´ê¸‰ ì •ë¹„" : "ì •ë¹„",
      detail: item.memo || "",
      cost: "",
      image_urls: item.image_urls || [],
    });
    setMaintItems([emptyMaintItem()]);
    setEditingMaintId("");
    setLinkingMaintenancePhotoId(item.id);

    setMenuTab("maint_new");
    showToast("ì •ë¹„ì‚¬ì§„ì„ ì •ë¹„ë“±ë¡ì— ë°˜ì˜í–ˆìŠµë‹ˆë‹¤. ë‚˜ë¨¸ì§€ í•­ëª©ì„ ì…ë ¥í•´ ì£¼ì„¸ìš”.", "info");
  };

  const mergeUrls = (base?: string[], extra?: string[]) => {
    return Array.from(new Set([...(base || []), ...(extra || [])].filter(Boolean)));
  };

  const normalizeSearchText = (value: any) =>
    String(value || "")
      .toLowerCase()
      .replace(/[\s()\[\]{}Â·,._\-\/]/g, "");

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
    if (!photo) return alert("ì…ê³ ì‚¬ì§„ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");

    const nextUrls = mergeUrls(purchase.image_urls || (purchase.image_url ? [purchase.image_url] : []), photo.image_urls || []);
    const payload = { ...purchase, image_urls: nextUrls, image_url: nextUrls[0] || "" };

    const { error } = await supabase
      .from("purchases")
      .update({ image_urls: nextUrls, image_url: nextUrls[0] || "" })
      .eq("id", purchase.id);

    if (error) return alert(`ê¸°ì¡´ êµ¬ë§¤ë‚´ì—­ ì‚¬ì§„ ì—°ê²° ì‹¤íŒ¨: ${error.message}`);

    setPurchases((prev) => prev.map((p) => (p.id === purchase.id ? payload : p)));
    await markReceiptPhotoProcessed(photo.id);
    setPhotoLinkModal({ mode: "", targetId: "", search: "" });
    showToast("ê¸°ì¡´ êµ¬ë§¤ë‚´ì—­ì— ì‚¬ì§„ì„ ì—°ê²°í–ˆìŠµë‹ˆë‹¤.");
  };

  const connectMaintRecordToMaintenancePhoto = async (maint: Maint, maintenancePhotoId: string) => {
    const photo = maintenancePhotos.find((item) => item.id === maintenancePhotoId);
    if (!photo) return alert("ì •ë¹„ì‚¬ì§„ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");

    const nextUrls = mergeUrls(maint.image_urls || (maint.image_url ? [maint.image_url] : []), photo.image_urls || []);
    const payload = { ...maint, image_urls: nextUrls, image_url: nextUrls[0] || "" };

    const { error } = await supabase
      .from("maints")
      .update({ image_urls: nextUrls, image_url: nextUrls[0] || "" })
      .eq("id", maint.id);

    if (error) return alert(`ê¸°ì¡´ ì •ë¹„ë‚´ì—­ ì‚¬ì§„ ì—°ê²° ì‹¤íŒ¨: ${error.message}`);

    setMaints((prev) => prev.map((m) => (m.id === maint.id ? payload : m)));
    await markMaintenancePhotoProcessed(photo.id);
    setPhotoLinkModal({ mode: "", targetId: "", search: "" });
    showToast("ê¸°ì¡´ ì •ë¹„ë‚´ì—­ì— ì‚¬ì§„ì„ ì—°ê²°í–ˆìŠµë‹ˆë‹¤.");
  };

  const connectReceiptPhotoToPurchase = async (photo: ReceiptPhoto, purchaseId: string) => {
    const target = purchases.find((p) => p.id === purchaseId);
    if (!target) return alert("êµ¬ë§¤ë‚´ì—­ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");

    const nextUrls = mergeUrls(target.image_urls || (target.image_url ? [target.image_url] : []), photo.image_urls || []);
    const payload = { ...target, image_urls: nextUrls, image_url: nextUrls[0] || "" };

    const { error } = await supabase
      .from("purchases")
      .update({ image_urls: nextUrls, image_url: nextUrls[0] || "" })
      .eq("id", target.id);

    if (error) return alert(`êµ¬ë§¤ë‚´ì—­ ì‚¬ì§„ ì—°ê²° ì‹¤íŒ¨: ${error.message}`);

    setPurchases((prev) => prev.map((p) => (p.id === target.id ? payload : p)));
    await markReceiptPhotoProcessed(photo.id);
    setPhotoLinkModal({ mode: "", targetId: "", search: "" });
    showToast("êµ¬ë§¤ë‚´ì—­ì— ì‚¬ì§„ì„ ì—°ê²°í–ˆìŠµë‹ˆë‹¤.");
  };

  const connectMaintenancePhotoToMaint = async (photo: MaintenancePhoto, maintId: string) => {
    const target = maints.find((m) => m.id === maintId);
    if (!target) return alert("ì •ë¹„ë‚´ì—­ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");

    const nextUrls = mergeUrls(target.image_urls || (target.image_url ? [target.image_url] : []), photo.image_urls || []);
    const payload = { ...target, image_urls: nextUrls, image_url: nextUrls[0] || "" };

    const { error } = await supabase
      .from("maints")
      .update({ image_urls: nextUrls, image_url: nextUrls[0] || "" })
      .eq("id", target.id);

    if (error) return alert(`ì •ë¹„ë‚´ì—­ ì‚¬ì§„ ì—°ê²° ì‹¤íŒ¨: ${error.message}`);

    setMaints((prev) => prev.map((m) => (m.id === target.id ? payload : m)));
    await markMaintenancePhotoProcessed(photo.id);
    setPhotoLinkModal({ mode: "", targetId: "", search: "" });
    showToast("ì •ë¹„ë‚´ì—­ì— ì‚¬ì§„ì„ ì—°ê²°í–ˆìŠµë‹ˆë‹¤.");
  };


  const loadReceiptPhotos = async () => {
    const { data, error } = await fetchAllRows("receipt_photos", "receipt_date", 1000, false);

    if (error) {
      console.error(error);
      return;
    }

    setReceiptPhotos(((data || []) as any[]).map((item) => ({
      ...item,
      id: String(item.id),
      receipt_date: item.receipt_date ? String(item.receipt_date).slice(0, 10) : "",
      image_urls: item.image_urls || [],
    })).sort((a, b) => String(b.receipt_date || "").localeCompare(String(a.receipt_date || "")) || String(b.created_at || "").localeCompare(String(a.created_at || ""))) as ReceiptPhoto[]);
  };

  const uploadReceiptPhotoFiles = async (files: File[]) => {
    const uploadedUrls: string[] = [];
    const validFiles = validateAttachmentFiles(files);
    if (!validFiles) return uploadedUrls;

    for (const file of validFiles) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await compressReceiptImage(file) : file;
      const ext = isImage ? "jpg" : getUploadFileExtension(file);
      const fileName = `purchase-photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("purchase-photos").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        alert(`ì…ê³ ì‚¬ì§„ ì—…ë¡œë“œ ì‹¤íŒ¨ (${file.name || "ì´ë¦„ ì—†ëŠ” íŒŒì¼"}): ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("purchase-photos").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const saveReceiptPhoto = async () => {
    if (receiptPhotoSaving) return;
    if (!receiptPhotoForm.receipt_date) return alert("ì¼ìë¥¼ ì…ë ¥í•˜ì„¸ìš”.");
    if (!receiptPhotoForm.vendor_name.trim()) return alert("ê±°ë˜ì²˜ë¥¼ ì…ë ¥í•˜ì„¸ìš”.");
    if (!receiptPhotoForm.memo.trim() && !receiptPhotoFiles.length) return alert("ë‚´ìš© ë˜ëŠ” ì‚¬ì§„ì„ ì…ë ¥í•˜ì„¸ìš”.");

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
        alert("ê°™ì€ ì¼ì/ê±°ë˜ì²˜/ë‚´ìš©ì˜ ì…ê³ ì‚¬ì§„ì´ ì´ë¯¸ ë“±ë¡ë˜ì–´ ìˆìŠµë‹ˆë‹¤.");
        return;
      }

      const imageUrls = receiptPhotoFiles.length ? await uploadReceiptPhotoFiles(receiptPhotoFiles) : [];

      const payload: ReceiptPhoto = {
        id: uid(),
        receipt_date: receiptPhotoForm.receipt_date,
        vendor_name: vendorName,
        memo,
        image_urls: imageUrls,
        created_by: userEmail || "ì§ì›",
        is_processed: false,
      };

      const { error } = await supabase.from("receipt_photos").insert(payload);
      if (error) return alert(`ì…ê³ ì‚¬ì§„ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

      await addActivityLog({
        module: "ì…ê³ ì‚¬ì§„",
        action: "ë“±ë¡",
        target_id: payload.id,
        target_title: vendorName,
        detail: `${payload.receipt_date} Â· ${memo || "ë‚´ìš© ì—†ìŒ"} Â· ì²¨ë¶€ ${imageUrls.length}ê°œ`,
      });

      setReceiptPhotoForm({ receipt_date: getTodayKey(), vendor_name: "", memo: "" });
      setReceiptPhotoFiles([]);
      setReceiptUploadPreviewUrls([]);
      await loadReceiptPhotos();
      showToast("ì…ê³ ì‚¬ì§„ì´ ë“±ë¡ë˜ì—ˆìŠµë‹ˆë‹¤.");
    } finally {
      setReceiptPhotoSaving(false);
    }
  };

  const toggleReceiptPhotoProcessed = async (item: ReceiptPhoto) => {
    if (!canEditDeleteRecords) return alert("ì²˜ë¦¬ìƒíƒœ ë³€ê²½ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");

    const { error } = await supabase
      .from("receipt_photos")
      .update({ is_processed: !item.is_processed })
      .eq("id", item.id);

    if (error) return alert(`ì²˜ë¦¬ìƒíƒœ ë³€ê²½ ì‹¤íŒ¨: ${error.message}`);

    await addActivityLog({
      module: "ì…ê³ ì‚¬ì§„",
      action: item.is_processed ? "ë¯¸ì²˜ë¦¬ ë³€ê²½" : "ì²˜ë¦¬ì™„ë£Œ",
      target_id: item.id,
      target_title: item.vendor_name || "",
      detail: item.memo || "",
    });

    await loadReceiptPhotos();
  };

  const deleteReceiptPhoto = async (id: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = receiptPhotos.find((item) => item.id === id);
    if (!target) return alert("ì‚­ì œí•  ì…ê³ ì‚¬ì§„ ë“±ë¡ê±´ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ì…ê³ ì‚¬ì§„ ë“±ë¡ê±´ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "receipt_photos",
      module: "ì…ê³ ì‚¬ì§„",
      record_id: id,
      title: target.vendor_name || "",
      detail: target.memo || "",
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("receipt_photos").delete().eq("id", id);
    if (error) return alert(`ì…ê³ ì‚¬ì§„ ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);

    await addActivityLog({
      module: "ì…ê³ ì‚¬ì§„",
      action: "íœ´ì§€í†µ ì´ë™",
      target_id: id,
      target_title: target?.vendor_name || "",
      detail: target?.memo || "",
    });

    await loadReceiptPhotos();
  };


  const hasCardFormValue = () => !!(
    (cardForm.date && cardForm.date !== getTodayKey()) ||
    cardForm.user_name ||
    cardForm.place ||
    cardForm.amount ||
    cardForm.memo ||
    cardForm.image_url ||
    (cardForm.image_urls || []).length ||
    editingCardUseId
  );

  const clearCardDraft = () => {
    try {
      localStorage.removeItem(CARD_DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const clearCardForm = () => {
    setCardForm({ date: getTodayKey(), user_name: "", place: "", amount: "", memo: "", image_url: "", image_urls: [] });
    setEditingCardUseId("");
    clearCardDraft();
  };

  const resetCardForm = () => {
    if (hasCardFormValue() && !window.confirm("ì‘ì„± ì¤‘ì¸ ì¹´ë“œì‚¬ìš© ë‚´ìš©ì„ ëª¨ë‘ ì´ˆê¸°í™”í• ê¹Œìš”?")) return;
    clearCardForm();
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CARD_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft?.cardForm) setCardForm(draft.cardForm);
        if (draft?.editingCardUseId) setEditingCardUseId(draft.editingCardUseId);
      }
    } catch {
      clearCardDraft();
    } finally {
      setCardDraftReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cardDraftReady) return;
    if (!hasCardFormValue()) {
      clearCardDraft();
      return;
    }

    try {
      localStorage.setItem(CARD_DRAFT_KEY, JSON.stringify({
        cardForm,
        editingCardUseId,
        saved_at: new Date().toISOString(),
      }));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardForm, editingCardUseId, cardDraftReady]);

  const saveCardUse = async () => {
    if (cardSavingRef.current) return;
    if (cardUploading) return alert("ì²¨ë¶€íŒŒì¼ ì—…ë¡œë“œê°€ ëë‚œ í›„ ì €ì¥í•´ ì£¼ì„¸ìš”.");
    if (editingCardUseId && !canEditDeleteRecords) return alert("ìˆ˜ì •ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");
    const cardDate = cardForm.date || getTodayKey();
    if (!cardForm.place || !Number(cardForm.amount || 0)) {
      return alert("ì‚¬ìš©ì¼ì, ì‚¬ìš©ì²˜, ê¸ˆì•¡ì„ í™•ì¸í•˜ì„¸ìš”.");
    }
    cardSavingRef.current = true;
    setCardSaving(true);

    try {
      const isEditing = !!editingCardUseId;
      const payload: CardUse = {
        id: editingCardUseId || uid(),
        date: cardDate,
        user_name: cardForm.user_name,
        place: cardForm.place,
        amount: Number(cardForm.amount || 0),
        memo: cardForm.memo,
        image_url: (cardForm.image_urls || [])[0] || cardForm.image_url,
        image_urls: cardForm.image_urls || (cardForm.image_url ? [cardForm.image_url] : []),
      };

      const { error } = await supabase.from("card_uses").upsert(payload);
      if (error) return alert(`ì¹´ë“œì‚¬ìš© ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

      setCardUses((prev) =>
        isEditing
          ? prev.map((c) => (c.id === editingCardUseId ? payload : c))
          : [payload, ...prev]
      );

      await addActivityLog({
        module: "ì¹´ë“œ",
        action: isEditing ? "ìˆ˜ì •" : "ë“±ë¡",
        target_id: payload.id,
        target_title: payload.place || "",
        detail: `${payload.date || "-"} Â· ${money(payload.amount)}ì› Â· ${payload.memo || ""}`,
      });

      clearCardForm();
      showToast(isEditing ? "ì¹´ë“œì‚¬ìš© ë‚´ì—­ì„ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "ì¹´ë“œì‚¬ìš© ë‚´ì—­ì„ ì €ì¥í–ˆìŠµë‹ˆë‹¤.");
      setMenuTab("card_list");
    } catch (error: any) {
      const message = error?.message ? `ì¹´ë“œì‚¬ìš© ì €ì¥ ì¤‘ ì˜¤ë¥˜: ${error.message}` : "ì¹´ë“œì‚¬ìš© ì €ì¥ ì¤‘ ì•Œ ìˆ˜ ì—†ëŠ” ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤.";
      alert(message);
    } finally {
      cardSavingRef.current = false;
      setCardSaving(false);
    }
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
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = cardUses.find((item) => item.id === id);
    if (!target) return alert("ì‚­ì œí•  ì¹´ë“œì‚¬ìš©ë‚´ì—­ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ì¹´ë“œì‚¬ìš©ë‚´ì—­ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "card_uses",
      module: "ì¹´ë“œ",
      record_id: id,
      title: target.place || "",
      detail: `${target.date || "-"} Â· ${money(target.amount || 0)}ì›`,
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("card_uses").delete().eq("id", id);
    if (error) return alert(`ì¹´ë“œì‚¬ìš© ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);
    setCardUses((prev) => prev.filter((c) => c.id !== id));
    await addActivityLog({
      module: "ì¹´ë“œ",
      action: "íœ´ì§€í†µ ì´ë™",
      target_id: id,
      target_title: target?.place || "",
      detail: `${target?.date || "-"} Â· ${money(target?.amount || 0)}ì›`,
    });
  };

  const filteredCardUses = cardUses
    .filter((c) => (!cardSearch.from || (c.date || "") >= cardSearch.from) && (!cardSearch.to || (c.date || "") <= cardSearch.to) && (!cardSearch.user_name || (c.user_name || "").includes(cardSearch.user_name)) && (!cardSearch.place || (c.place || "").includes(cardSearch.place)))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const editPurchase = (p: Purchase) => {
    setMenuTab("new");
    setLinkingReceiptPhotoId("");
    setEditingPurchaseId(p.id);
    setPurchaseHeader({ date: p.date || "", vendor: p.vendor || "", warehouse: p.warehouse || "", image_urls: p.image_urls || (p.image_url ? [p.image_url] : []) });
    setRows((p.rows || []).map((r) => ({ ...r, id: uid() })));
  };

  const updatePurchaseTaxInvoiceStatus = async (purchase: Purchase, received: boolean) => {
    if (!canCreateRecords) return alert("ì„¸ê¸ˆê³„ì‚°ì„œ ìˆ˜ì·¨ ì—¬ë¶€ë¥¼ ë³€ê²½í•  ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");
    if (purchaseTaxInvoiceSavingId) return;

    setPurchaseTaxInvoiceSavingId(purchase.id);

    try {
      const { error } = await supabase
        .from("purchases")
        .update({ tax_invoice_received: received })
        .eq("id", purchase.id);

      if (error) return alert(`ì„¸ê¸ˆê³„ì‚°ì„œ ìƒíƒœ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

      setPurchases((prev) => prev.map((item) => (
        item.id === purchase.id ? { ...item, taxInvoiceReceived: received } : item
      )));

      await addActivityLog({
        module: "êµ¬ë§¤",
        action: "ì„¸ê¸ˆê³„ì‚°ì„œ í™•ì¸",
        target_id: purchase.id,
        target_title: purchase.vendor || "",
        detail: `${purchase.date || "-"} Â· ${received ? "ìˆ˜ì·¨ ì™„ë£Œ" : "ë¯¸ìˆ˜ì·¨ë¡œ ë³€ê²½"}`,
      });
    } catch (error: any) {
      alert(error?.message ? `ì„¸ê¸ˆê³„ì‚°ì„œ ìƒíƒœ ì €ì¥ ì‹¤íŒ¨: ${error.message}` : "ì„¸ê¸ˆê³„ì‚°ì„œ ìƒíƒœ ì €ì¥ ì¤‘ ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤.");
    } finally {
      setPurchaseTaxInvoiceSavingId("");
    }
  };

  const filteredPurchases = purchases
    .filter(
      (p) =>
        (!purchaseSearch.from || (p.date || "") >= purchaseSearch.from) &&
        (!purchaseSearch.to || (p.date || "") <= purchaseSearch.to) &&
        (!purchaseSearch.vendor || p.vendor.includes(purchaseSearch.vendor)) &&
        (!purchaseSearch.warehouse || p.warehouse.includes(purchaseSearch.warehouse)) &&
        (!purchaseSearch.item || p.rows.some((r) => r.item.includes(purchaseSearch.item))) &&
        (!purchaseSearch.taxInvoice || (purchaseSearch.taxInvoice === "received" ? Boolean(p.taxInvoiceReceived) : !p.taxInvoiceReceived))
    )
    .sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  const saveVendor = async () => {
    if (editingVendorId && !canEditDeleteRecords) return alert("ìˆ˜ì •ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");
    const code = vendorForm.code.trim();
    const name = vendorForm.name.trim();
    if (!name) return;

    const existing = editingVendorId ? vendors.find((v) => v.id === editingVendorId) : undefined;
    if (editingVendorId && !existing) return alert("ìˆ˜ì •í•  ê±°ë˜ì²˜ë¥¼ ì°¾ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤. ëª©ë¡ì„ ìƒˆë¡œê³ ì¹¨í•œ ë’¤ ë‹¤ì‹œ ì‹œë„í•´ ì£¼ì„¸ìš”.");

    const duplicate = vendors.find(
      (v) => v.id !== editingVendorId && ((code !== "" && v.code.trim() === code) || v.name.trim() === name)
    );
    if (duplicate) {
      const duplicateField = code !== "" && duplicate.code.trim() === code ? "ê±°ë˜ì²˜ì½”ë“œ" : "ê±°ë˜ì²˜ëª…";
      return alert(`ê°™ì€ ${duplicateField}ì˜ ê±°ë˜ì²˜ê°€ ì´ë¯¸ ìˆìŠµë‹ˆë‹¤. ê¸°ì¡´ ê±°ë˜ì²˜ë¥¼ ì„ íƒí•´ ìˆ˜ì •í•´ ì£¼ì„¸ìš”.`);
    }

    const payload: Vendor = { ...vendorForm, id: existing?.id || uid(), code, name };
    const { error } = await supabase.from("vendors").upsert(payload);
    if (error) return alert(`ê±°ë˜ì²˜ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
    const next = existing ? vendors.map((v) => (v.id === existing.id ? payload : v)) : [...vendors, payload];
    setVendors(next);
    setVendorForm({ code: "", name: "", owner: "", phone: "", mobile: "", address: "", address_detail: "" });
    setEditingVendorId("");
    showToast(existing ? "ê±°ë˜ì²˜ ì •ë³´ë¥¼ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "ê±°ë˜ì²˜ë¥¼ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
  };

  const importVendors = async (file: File) => {
    const rows = await readExcelRows(file);
    const importedCodes: { code?: string }[] = [...vendors];
    const imported = rows
      .map((r) => {
        const code = String(pick(r, ["ê±°ë˜ì²˜ì½”ë“œ", "ì½”ë“œ", "ì‚¬ì—…ìë²ˆí˜¸"]) || "").trim() || nextVendorCode(importedCodes);
        importedCodes.push({ code });
        return {
          id: uid(),
          code,
          name: String(pick(r, ["ê±°ë˜ì²˜ëª…", "ìƒí˜¸"]) || "").trim(),
          owner: String(pick(r, ["ëŒ€í‘œì", "ëŒ€í‘œìëª…"]) || "").trim(),
          phone: String(pick(r, ["ì „í™”", "ì „í™”ë²ˆí˜¸", "ì—°ë½ì²˜"]) || "").trim(),
          mobile: String(pick(r, ["ëª¨ë°”ì¼", "íœ´ëŒ€í°", "íœ´ëŒ€ì „í™”"]) || "").trim(),
          address: String(pick(r, ["ì£¼ì†Œ", "ì‚¬ì—…ì¥ì£¼ì†Œ", "ì†Œì¬ì§€"]) || "").trim(),
          address_detail: String(pick(r, ["ìƒì„¸ì£¼ì†Œ", "ì£¼ì†Œìƒì„¸", "ìƒì„¸ ì£¼ì†Œ"]) || "").trim(),
        };
      })
      .filter((x) => x.name);
    const merged = [...vendors];
    imported.forEach((row) => {
      const idx = merged.findIndex((v) => v.code === row.code || v.name === row.name);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...row, id: merged[idx].id };
      else merged.push(row);
    });
    const { error } = await supabase.from("vendors").upsert(merged);
    if (error) return alert(`ê±°ë˜ì²˜ ì—…ë¡œë“œ ì‹¤íŒ¨: ${error.message}`);
    setVendors(merged);
    setVendorImportMessage(`${imported.length}ê±´ ë¶ˆëŸ¬ì™”ìŠµë‹ˆë‹¤.`);
  };

  const saveGroup = async () => {
    if (editingGroupId && !canEditDeleteRecords) return alert("ìˆ˜ì •ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");
    if (!groupForm.name) return;
    const payload: Group = { id: editingGroupId || uid(), ...groupForm };
    const { error } = await supabase.from("warehouse_groups").upsert(payload);
    if (error) return alert(`ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
    const next = editingGroupId ? groups.map((g) => (g.id === editingGroupId ? payload : g)) : [...groups, payload];
    setGroups(next);
    setGroupForm({ code: nextCode(next), name: "" });
    setEditingGroupId("");
    showToast(editingGroupId ? "ì°½ê³  ëŒ€ë¶„ë¥˜ë¥¼ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "ì°½ê³  ëŒ€ë¶„ë¥˜ë¥¼ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
  };

  const saveWarehouse = async () => {
    if (editingWarehouseId && !canEditDeleteRecords) return alert("ìˆ˜ì •ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");
    if (!warehouseForm.group || !warehouseForm.name) return;
    const payload: Warehouse = { id: editingWarehouseId || uid(), ...warehouseForm };
    const { error } = await supabase.from("warehouses").upsert(payload);
    if (error) return alert(`ì°½ê³  ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
    const next = editingWarehouseId ? warehouses.map((w) => (w.id === editingWarehouseId ? payload : w)) : [...warehouses, payload];
    setWarehouses(next);
    setWarehouseForm({ group: "", code: nextCode(next), name: "" });
    setEditingWarehouseId("");
    showToast(editingWarehouseId ? "ì„¸ë¶€ ì°½ê³ ë¥¼ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "ì„¸ë¶€ ì°½ê³ ë¥¼ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
  };

  const deleteGroup = async (id: string, name: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = groups.find((group) => group.id === id);
    if (!target) return alert("ì‚­ì œí•  ì°½ê³  ëŒ€ë¶„ë¥˜ë¥¼ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    const linkedWarehouses = warehouses.filter((warehouse) => warehouse.group === name);
    if (!confirm(`ì°½ê³  ëŒ€ë¶„ë¥˜ì™€ ì—°ê²°ëœ ì„¸ë¶€ì°½ê³  ${linkedWarehouses.length}ê±´ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?`)) return;

    const ok = await moveRecordsToTrash([
      {
        source_table: "warehouse_groups",
        module: "ì°½ê³ ë¶„ë¥˜",
        record_id: target.id,
        title: target.name || "",
        detail: `ì—°ê²° ì„¸ë¶€ì°½ê³  ${linkedWarehouses.length}ê±´`,
        data: target,
      },
      ...linkedWarehouses.map((warehouse) => ({
        source_table: "warehouses",
        module: "ì°½ê³ ",
        record_id: warehouse.id,
        title: warehouse.name || "",
        detail: warehouse.group || "",
        data: warehouse,
      })),
    ]);
    if (!ok) return;

    const delWh = await supabase.from("warehouses").delete().eq("group", name);
    if (delWh.error) return alert(`ì„¸ë¶€ì°½ê³  ì‚­ì œ ì‹¤íŒ¨: ${delWh.error.message}`);
    const delGroup = await supabase.from("warehouse_groups").delete().eq("id", id);
    if (delGroup.error) return alert(`ëŒ€ë¶„ë¥˜ ì‚­ì œ ì‹¤íŒ¨: ${delGroup.error.message}`);

    const newGroups = groups.filter((group) => group.id !== id);
    const newWarehouses = warehouses.filter((warehouse) => warehouse.group !== name);
    setGroups(newGroups);
    setWarehouses(newWarehouses);
    setGroupForm({ code: nextCode(newGroups), name: "" });
    setWarehouseForm({ group: "", code: nextCode(newWarehouses), name: "" });
  };
  const deleteWarehouse = async (id: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = warehouses.find((warehouse) => warehouse.id === id);
    if (!target) return alert("ì‚­ì œí•  ì°½ê³ ë¥¼ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ì„¸ë¶€ì°½ê³ ë¥¼ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "warehouses",
      module: "ì°½ê³ ",
      record_id: id,
      title: target.name || "",
      detail: target.group || "",
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("warehouses").delete().eq("id", id);
    if (error) return alert(`ì°½ê³  ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);
    const newWarehouses = warehouses.filter((warehouse) => warehouse.id !== id);
    setWarehouses(newWarehouses);
    setWarehouseForm({ group: "", code: nextCode(newWarehouses), name: "" });
  };

  const saveItem = async () => {
    if (editingItemId && !canEditDeleteRecords) return alert("ìˆ˜ì •ì€ ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    if (!canCreateRecords) return alert("ë“±ë¡ ê¶Œí•œì´ ì—†ìŠµë‹ˆë‹¤.");

    const code = String(itemForm.code || "").trim();
    const name = String(itemForm.name || "").trim();
    if (!code) return alert("í’ˆëª©ì½”ë“œë¥¼ ì…ë ¥í•˜ì„¸ìš”.");
    if (!name) return alert("í’ˆëª©ëª…ì„ ì…ë ¥í•˜ì„¸ìš”.");

    const latestRes = await fetchAllRows("items", "code", 1000);
    if (latestRes.error) return alert(`í’ˆëª© ìµœì‹ ìë£Œ ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: ${latestRes.error.message}`);

    const latestItems = ((latestRes.data || []) as any[]).map((x) => ({ ...x, price: Number(x.price || 0) })) as Item[];
    const duplicateCode = latestItems.find((i) => i.code === code && i.id !== editingItemId);
    if (duplicateCode) return alert("ì´ë¯¸ ì‚¬ìš© ì¤‘ì¸ í’ˆëª©ì½”ë“œì…ë‹ˆë‹¤.");

    const existing = editingItemId ? latestItems.find((i) => i.id === editingItemId) : undefined;
    const payload = { id: existing?.id || uid(), ...itemForm, code, name, price: Number(itemForm.price || 0) };
    const { error } = await supabase.from("items").upsert(payload);
    if (error) return alert(`ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

    const next = existing ? latestItems.map((i) => (i.id === existing.id ? payload : i)) : [...latestItems, payload];
    setItems(next);
    setItemForm({ code: nextItemCode(next), name: "", spec: "", unit: "", price: "" });
    setEditingItemId("");
    showToast(existing ? "í’ˆëª© ì •ë³´ë¥¼ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "í’ˆëª©ì„ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
  };

  const importItems = async (file: File) => {
    const rows = await readExcelRows(file);

    const existingRes = await fetchAllRows("items", "code", 1000);
    if (existingRes.error) return alert(`ê¸°ì¡´ í’ˆëª© ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: ${existingRes.error.message}`);

    const existingItems = ((existingRes.data || []) as any[]).map((x) => ({ ...x, price: Number(x.price || 0) })) as Item[];

    const tempImportedCodes: { code?: string }[] = [];
    const imported = rows
      .map((r) => {
        const rawCode = String(pick(r, ["í’ˆëª©ì½”ë“œ", "ì½”ë“œ"]) || "").trim();
        const name = String(pick(r, ["í’ˆëª©ëª…", "í’ˆëª…"]) || "").trim();
        const spec = String(pick(r, ["ê·œê²©ì •ë³´", "ê·œê²©"]) || "").trim();
        const unit = String(pick(r, ["ë‹¨ìœ„"]) || "").trim();
        const price = Number(pick(r, ["ë‹¨ê°€", "ì…ê³ ë‹¨ê°€", "ë§¤ì…ë‹¨ê°€"]) || 0);
        const code = rawCode || nextItemCode([...existingItems, ...tempImportedCodes]);

        tempImportedCodes.push({ code });

        return {
          id: uid(),
          code,
          name,
          spec,
          unit,
          price,
        };
      })
      .filter((x) => x.name || x.code);

    const merged = [...existingItems];

    imported.forEach((row) => {
      const idx = merged.findIndex((i) => row.code && i.code === row.code);
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...row, id: merged[idx].id };
      } else {
        merged.push(row);
      }
    });

    const error = await upsertInChunks("items", merged, 500);
    if (error) return alert(`í’ˆëª© ì—…ë¡œë“œ ì‹¤íŒ¨: ${error.message}`);

    const reloadRes = await fetchAllRows("items", "code", 1000);
    if (reloadRes.error) return alert(`í’ˆëª© ë‹¤ì‹œ ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: ${reloadRes.error.message}`);

    const nextItems = ((reloadRes.data || []) as any[]).map((x) => ({ ...x, price: Number(x.price || 0) })) as Item[];
    setItems(nextItems);
    setItemImportMessage(`${imported.length}ê±´ ì—…ë¡œë“œ / í˜„ì¬ ${nextItems.length}ê±´ í‘œì‹œ`);
    setItemForm({ code: nextItemCode(nextItems), name: "", spec: "", unit: "", price: "" });
  };

  const openNewItemModal = (rowIndex: number) => {
    setNewItemForm({ code: nextItemCode(items), name: "", spec: "", unit: "", price: "" });
    setNewItemModal({ open: true, rowIndex });
  };

  const closeNewItemModal = () => {
    setNewItemModal({ open: false, rowIndex: null });
    setNewItemForm({ code: nextItemCode(items), name: "", spec: "", unit: "", price: "" });
  };

  const saveNewItemFromModal = async () => {
    const code = newItemForm.code.trim();
    if (!code) return alert("í’ˆëª©ì½”ë“œë¥¼ ì…ë ¥í•˜ì„¸ìš”.");
    if (items.some((item) => String(item.code || "").trim().toLowerCase() === code.toLowerCase())) {
      return alert("ì´ë¯¸ ë“±ë¡ëœ í’ˆëª©ì½”ë“œì…ë‹ˆë‹¤. ë‹¤ë¥¸ ì½”ë“œë¥¼ ì…ë ¥í•˜ì„¸ìš”.");
    }

    const name = newItemForm.name.trim();
    if (!name) return alert("í’ˆëª©ëª…ì„ ì…ë ¥í•˜ì„¸ìš”.");

    const spec = newItemForm.spec.trim();
    const unit = newItemForm.unit.trim();
    const price = Number(String(newItemForm.price || "0").replace(/,/g, "")) || 0;

    const newItem = {
      id: uid(),
      code,
      name,
      spec,
      unit,
      price,
    };

    const { error } = await supabase.from("items").insert(newItem);
    if (error) return alert(`ì‹ ê·œ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
    setItems((prev) => [...prev, newItem]);

    if (newItemModal.rowIndex !== null) {
      const targetRowIndex = newItemModal.rowIndex;

      setRows((prev) =>
        prev.map((row, index) => {
          if (index !== targetRowIndex) return row;

          const qty = Number(row.qty || 0);
          const supply = qty * price;
          const vat = Math.round(supply * 0.1);

          return {
            ...row,
            item: name,
            spec,
            price,
            supply,
            vat,
            total: supply + vat,
          };
        })
      );
    }

    showToast("ì‹ ê·œ í’ˆëª©ì„ ë“±ë¡í•˜ê³  ì…ë ¥ë€ì— ë°˜ì˜í–ˆìŠµë‹ˆë‹¤.");
    closeNewItemModal();
  };


  const updateMaintItem = (index: number, key: keyof MaintItem, value: any, selectedItem?: Partial<Item>) => {
    const next = [...maintItems];
    next[index] = { ...next[index], [key]: value };

    if (key === "item") {
      const exactMatches = items.filter((it) => it.name === value);
      const found = selectedItem || (exactMatches.length === 1 ? exactMatches[0] : undefined);
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

  const removeMaintItem = (index: number) => {
    const next = maintItems.length === 1 ? [emptyMaintItem()] : maintItems.filter((_, rowIndex) => rowIndex !== index);
    setMaintItems(next);
    const total = next.reduce((sum, row) => sum + Number(row.total || 0), 0);
    setMaintForm((prev) => ({ ...prev, cost: String(total) }));
  };

  const makeMaintItemFromSuggestion = (source: Partial<MaintItem>): MaintItem => {
    const itemName = String(source.item || "").trim();
    const master = items.find((it) => it.name === itemName);
    const qty = Number(source.qty || 1) || 1;
    const price = Number(source.price || master?.price || 0);
    const supply = qty * price;
    const vat = Math.round(supply * 0.1);

    return {
      id: uid(),
      item: itemName,
      spec: String(source.spec || master?.spec || ""),
      qty,
      price,
      supply,
      vat,
      total: supply + vat,
    };
  };

  const applyMaintItems = (nextItems: MaintItem[]) => {
    setMaintItems(nextItems.length ? nextItems : [emptyMaintItem()]);
    const total = nextItems.reduce((sum, row) => sum + Number(row.total || 0), 0);
    setMaintForm((prev) => ({ ...prev, cost: String(total) }));
  };

  const addMaintSuggestedItems = (suggestions: { item: string; spec?: string; qty?: number | string; price?: number | string }[]) => {
    const current = maintItems.filter((row) => row.item || row.spec || row.qty || row.price || row.supply || row.vat || row.total);
    const existingNames = new Set(current.map((row) => String(row.item || "").trim()).filter(Boolean));

    const nextSuggested = suggestions
      .filter((suggestion) => String(suggestion.item || "").trim() && !existingNames.has(String(suggestion.item || "").trim()))
      .map((suggestion) => makeMaintItemFromSuggestion(suggestion));

    if (!nextSuggested.length) return alert("ì¶”ê°€í•  ì¶”ì²œ í’ˆëª©ì´ ì—†ìŠµë‹ˆë‹¤.");

    applyMaintItems([...current, ...nextSuggested]);
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

  const validMaintItems = maintItems.filter((r) => r.item && Number(r.qty || 0) > 0);
  const maintSupplyTotal = validMaintItems.reduce((sum, r) => sum + Number(r.supply || 0), 0);
  const maintVatTotal = validMaintItems.reduce((sum, r) => sum + Number(r.vat || 0), 0);
  const maintGrandTotal = validMaintItems.reduce((sum, r) => sum + Number(r.total || 0), 0);

  const getRecentPurchaseInfo = (itemName: string) => {
    const keyword = String(itemName || "").trim();
    if (!keyword) return null;

    const candidates = purchases
      .flatMap((purchase) =>
        (purchase.rows || [])
          .filter((row) => String(row.item || "").trim() === keyword)
          .map((row) => ({
            date: purchase.date || "",
            vendor: purchase.vendor || "",
            warehouse: purchase.warehouse || "",
            item: row.item || "",
            spec: row.spec || "",
            price: Number(row.price || 0),
          }))
      )
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    return candidates[0] || null;
  };

  const maintWarehouseKey = maintForm.warehouse.trim().toLowerCase().replace(/\s+/g, "");
  const maintSuggestedItems = useMemo(() => {
    if (!maintWarehouseKey) return [];

    const rows = new Map<string, {
      item: string;
      spec: string;
      qty: number;
      price: number;
      count: number;
      lastDate: string;
    }>();

    maints.forEach((record) => {
      if (editingMaintId && record.id === editingMaintId) return;
      const recordWarehouseKey = String(record.warehouse || "").trim().toLowerCase().replace(/\s+/g, "");
      if (recordWarehouseKey !== maintWarehouseKey) return;

      (record.items || []).forEach((row) => {
        const itemName = String(row.item || "").trim();
        if (!itemName) return;

        const prev = rows.get(itemName) || {
          item: itemName,
          spec: String(row.spec || ""),
          qty: Number(row.qty || 1) || 1,
          price: Number(row.price || 0),
          count: 0,
          lastDate: "",
        };

        prev.count += 1;
        if (String(record.date || "") >= String(prev.lastDate || "")) {
          prev.spec = String(row.spec || prev.spec || "");
          prev.qty = Number(row.qty || prev.qty || 1) || 1;
          prev.price = Number(row.price || prev.price || 0);
          prev.lastDate = String(record.date || "");
        }

        rows.set(itemName, prev);
      });
    });

    return Array.from(rows.values())
      .sort((a, b) => b.count - a.count || String(b.lastDate || "").localeCompare(String(a.lastDate || "")));
  }, [maints, maintWarehouseKey, editingMaintId]);

  const visibleMaintSuggestedItems = showAllMaintSuggestions ? maintSuggestedItems : maintSuggestedItems.slice(0, 8);

  useEffect(() => {
    setShowAllMaintSuggestions(false);
  }, [maintWarehouseKey]);


  const maintTemplateRecords = useMemo(() => {
    const keyword = maintTemplateSearch.trim().toLowerCase();

    return [...maints]
      .filter((record) => !editingMaintId || record.id !== editingMaintId)
      .filter((record) => {
        if (!keyword) return true;

        const target = [
          record.date,
          record.warehouse,
          record.manager,
          record.title,
          record.detail,
          ...(record.items || []).map((item) => `${item.item || ""} ${item.spec || ""}`),
        ]
          .join(" ")
          .toLowerCase();

        return target.includes(keyword);
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 50);
  }, [maints, maintTemplateSearch, editingMaintId]);

  const applyMaintTemplate = (record: Maint) => {
    const copiedItems = (record.items || [])
      .filter((row) => row.item || row.spec || row.qty || row.price || row.supply || row.vat || row.total)
      .map((row) => {
        const qty = Number(row.qty || 0);
        const price = Number(row.price || 0);
        const supply = Number(row.supply || qty * price || 0);
        const vat = Number(row.vat || Math.round(supply * 0.1) || 0);
        const total = Number(row.total || supply + vat || 0);

        return {
          ...row,
          id: uid(),
          qty: row.qty || "",
          price: row.price || "",
          supply,
          vat,
          total,
        };
      });

    const nextItems = copiedItems.length ? copiedItems : [emptyMaintItem()];
    const nextTotal = nextItems.reduce((sum, row) => sum + Number(row.total || 0), 0);

    setMaintForm((prev) => ({
      ...prev,
      warehouse: record.warehouse || prev.warehouse,
      title: record.title || "",
      detail: record.detail || "",
      cost: String(nextTotal),
      date: prev.date,
      manager: prev.manager,
      image_urls: prev.image_urls || [],
    }));
    setMaintItems(nextItems);
    setMaintTemplateOpen(false);
    setMaintTemplateSearch("");
  };


  const clearMaintDraft = () => {
    try {
      localStorage.removeItem(MAINT_DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const hasMaintFormValue = () => !!(
    (maintForm.date && maintForm.date !== getTodayKey()) ||
    maintForm.warehouse ||
    maintForm.manager ||
    maintForm.title ||
    maintForm.detail ||
    maintForm.cost ||
    (maintForm.image_urls || []).length ||
    maintItems.some((item) => item.item || item.spec || item.qty || item.price || item.supply || item.vat || item.total) ||
    editingMaintId
  );

  const clearMaintForm = () => {
    setMaintForm({ date: getTodayKey(), warehouse: "", manager: "", title: "", detail: "", cost: "", image_urls: [] });
    setMaintItems([emptyMaintItem()]);
    setEditingMaintId("");
    setLinkingMaintenancePhotoId("");
    setMaintSaveError("");
    clearMaintDraft();
  };

  const resetMaintForm = () => {
    if (hasMaintFormValue() && !window.confirm("ì‘ì„± ì¤‘ì¸ ì •ë¹„ë“±ë¡ ë‚´ìš©ì„ ëª¨ë‘ ì´ˆê¸°í™”í• ê¹Œìš”?")) return;
    clearMaintForm();
  };

  const restoreMaintDraft = () => {
    try {
      const saved = localStorage.getItem(MAINT_DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft?.maintForm) setMaintForm(draft.maintForm);
      if (Array.isArray(draft?.maintItems) && draft.maintItems.length) setMaintItems(draft.maintItems);
      if (draft?.editingMaintId) setEditingMaintId(draft.editingMaintId);
    } catch {
      clearMaintDraft();
    } finally {
      setMaintDraftReady(true);
    }
  };

  useEffect(() => {
    restoreMaintDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!maintDraftReady) return;
    if (!hasMaintFormValue()) {
      clearMaintDraft();
      return;
    }

    try {
      localStorage.setItem(MAINT_DRAFT_KEY, JSON.stringify({
        maintForm,
        maintItems,
        editingMaintId,
        saved_at: new Date().toISOString(),
      }));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintForm, maintItems, editingMaintId, maintDraftReady]);

  const saveMaint = async () => {
    if (maintSavingRef.current) return;
    if (maintUploading) return alert("ì²¨ë¶€íŒŒì¼ ì—…ë¡œë“œê°€ ëë‚œ í›„ ì €ì¥í•´ ì£¼ì„¸ìš”.");
    setMaintSaveError("");

    if (!maintForm.warehouse || !maintForm.title) {
      const message = "ì°½ê³ ì™€ ì •ë¹„ì œëª©ì„ ì…ë ¥í•˜ì„¸ìš”.";
      setMaintSaveError(message);
      alert(message);
      return;
    }

    maintSavingRef.current = true;
    setMaintSaving(true);

    try {
      const validItems = validMaintItems;
      const payload = {
        id: editingMaintId || uid(),
        ...maintForm,
        date: maintForm.date || getTodayKey(),
        image_url: (maintForm.image_urls || [])[0] || "",
        image_urls: maintForm.image_urls || [],
        items: validItems,
        supplyTotal: maintSupplyTotal,
        vatTotal: maintVatTotal,
        total: maintGrandTotal,
        cost: Number(maintGrandTotal || maintForm.cost || 0),
      };

      const { error } = await supabase.from("maints").upsert(payload);
      if (error) {
        const message = `ì •ë¹„ ì €ì¥ ì‹¤íŒ¨: ${error.message}`;
        setMaintSaveError(message);
        alert(message);
        return;
      }

      setMaints((prev) => (editingMaintId ? prev.map((m) => (m.id === editingMaintId ? payload : m)) : [payload, ...prev]));

      await addActivityLog({
        module: "ì •ë¹„",
        action: editingMaintId ? "ìˆ˜ì •" : "ë“±ë¡",
        target_id: payload.id,
        target_title: payload.title || "",
        detail: `${payload.date || "-"} Â· ${payload.warehouse || "-"} Â· ${money(payload.cost)}ì›`,
      });

      if (linkingMaintenancePhotoId) {
        await markMaintenancePhotoProcessed(linkingMaintenancePhotoId);
        setLinkingMaintenancePhotoId("");
      }

      clearMaintForm();
      showToast(editingMaintId ? "ì •ë¹„ë‚´ì—­ì„ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "ì •ë¹„ë‚´ì—­ì„ ì €ì¥í–ˆìŠµë‹ˆë‹¤.");
      setMenuTab("maint_list");
    } catch (error: any) {
      const message = error?.message ? `ì •ë¹„ ì €ì¥ ì¤‘ ì˜¤ë¥˜: ${error.message}` : "ì •ë¹„ ì €ì¥ ì¤‘ ì•Œ ìˆ˜ ì—†ëŠ” ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤.";
      setMaintSaveError(message);
      alert(message);
    } finally {
      maintSavingRef.current = false;
      setMaintSaving(false);
    }
  };
  const editMaint = (m: Maint) => {
    setMenuTab("maint_new");
    setMaintSaveError("");
    clearMaintDraft();
    setLinkingMaintenancePhotoId("");
    setEditingMaintId(m.id);
    setMaintForm({ date: m.date || "", warehouse: m.warehouse || "", manager: m.manager || "", title: m.title || "", detail: m.detail || "", cost: String(m.cost || ""), image_urls: m.image_urls || (m.image_url ? [m.image_url] : []) });
    setMaintItems((m.items && m.items.length ? m.items : [emptyMaintItem()]).map((r: any) => ({ ...emptyMaintItem(), ...r, id: uid() })));
  };


  const editVendor = (v: Vendor) => {
    setEditingVendorId(v.id);
    setVendorForm({ code: v.code || "", name: v.name || "", owner: v.owner || "", phone: v.phone || "", mobile: v.mobile || "", address: v.address || "", address_detail: v.address_detail || "" });
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
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = purchases.find((p) => p.id === id);
    if (!target) return alert("ì‚­ì œí•  êµ¬ë§¤ë‚´ì—­ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("êµ¬ë§¤ë‚´ì—­ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "purchases",
      module: "êµ¬ë§¤",
      record_id: id,
      title: `${target.vendor || "-"} / ${getPurchaseItemSummary(target)}`,
      detail: `${target.date || "-"} Â· ${target.warehouse || "-"} Â· ${money(target.total)}ì›`,
      data: fromPurchase(target),
    });
    if (!ok) return;

    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) return alert(`êµ¬ë§¤ ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    await addActivityLog({ module: "êµ¬ë§¤", action: "íœ´ì§€í†µ ì´ë™", target_id: id, target_title: target.vendor || "", detail: getPurchaseItemSummary(target) });
  };

  const deleteVendor = async (id: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = vendors.find((vendor) => vendor.id === id);
    if (!target) return alert("ì‚­ì œí•  ê±°ë˜ì²˜ë¥¼ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ê±°ë˜ì²˜ë¥¼ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "vendors",
      module: "ê±°ë˜ì²˜",
      record_id: id,
      title: target.name || "",
      detail: target.code || "",
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) return alert(`ê±°ë˜ì²˜ ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);
    setVendors((prev) => prev.filter((v) => v.id !== id));
  };

  const clearVendors = async () => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ì „ì²´ì‚­ì œí•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    if (!vendors.length) return alert("ì‚­ì œí•  ê±°ë˜ì²˜ê°€ ì—†ìŠµë‹ˆë‹¤.");
    if (!confirm(`ê±°ë˜ì²˜ ${vendors.length}ê±´ì„ ëª¨ë‘ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?`)) return;
    const ok = await moveRecordsToTrash(vendors.map((vendor) => ({
      source_table: "vendors",
      module: "ê±°ë˜ì²˜",
      record_id: vendor.id,
      title: vendor.name || "",
      detail: vendor.code || "",
      data: vendor,
    })));
    if (!ok) return;

    const { error } = await supabase.from("vendors").delete().neq("id", "");
    if (error) return alert(`ê±°ë˜ì²˜ ì „ì²´ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);
    setVendors([]);
    setVendorImportMessage("ê±°ë˜ì²˜ ì „ì²´ ì‚­ì œ ì™„ë£Œ");
    setVendorForm({ code: "", name: "", owner: "", phone: "", mobile: "", address: "", address_detail: "" });
  };

  const deleteItem = async (id: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = items.find((item) => item.id === id);
    if (!target) return alert("ì‚­ì œí•  í’ˆëª©ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("í’ˆëª©ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "items",
      module: "í’ˆëª©",
      record_id: id,
      title: target.name || "",
      detail: `${target.code || "-"} Â· ${target.spec || "ê·œê²© ì—†ìŒ"}`,
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) return alert(`í’ˆëª© ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearItems = async () => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ì „ì²´ì‚­ì œí•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    if (!items.length) return alert("ì‚­ì œí•  í’ˆëª©ì´ ì—†ìŠµë‹ˆë‹¤.");
    if (!confirm(`í’ˆëª© ${items.length}ê±´ì„ ëª¨ë‘ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?`)) return;

    const ok = await moveRecordsToTrash(items.map((item) => ({
      source_table: "items",
      module: "í’ˆëª©",
      record_id: item.id,
      title: item.name || "",
      detail: `${item.code || "-"} Â· ${item.spec || "ê·œê²© ì—†ìŒ"}`,
      data: item,
    })));
    if (!ok) return;

    const { error } = await supabase.from("items").delete().neq("id", "");
    if (error) return alert(`í’ˆëª© ì „ì²´ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);

    setItems([]);
    setItemSearch("");
    setItemImportMessage("í’ˆëª© ì „ì²´ ì‚­ì œ ì™„ë£Œ");
    setItemForm({ code: "0001", name: "", spec: "", unit: "", price: "" });
    setEditingItemId("");
  };

  const deleteMaint = async (id: string) => {
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = maints.find((item) => item.id === id);
    if (!target) return alert("ì‚­ì œí•  ì •ë¹„ë‚´ì—­ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ì •ë¹„ë‚´ì—­ì„ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "maints",
      module: "ì •ë¹„",
      record_id: id,
      title: target.title || "",
      detail: `${target.date || "-"} Â· ${target.warehouse || "-"}`,
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("maints").delete().eq("id", id);
    if (error) return alert(`ì •ë¹„ ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);
    setMaints((prev) => prev.filter((m) => m.id !== id));
    await addActivityLog({
      module: "ì •ë¹„",
      action: "íœ´ì§€í†µ ì´ë™",
      target_id: id,
      target_title: target?.title || "",
      detail: `${target?.date || "-"} Â· ${target?.warehouse || "-"}`,
    });
  };

  const filteredMaints = maints
    .filter((m) => (!maintSearch.from || (m.date || "") >= maintSearch.from) && (!maintSearch.to || (m.date || "") <= maintSearch.to) && (!maintSearch.warehouse || m.warehouse.includes(maintSearch.warehouse)) && (!maintSearch.keyword || `${m.title} ${m.detail} ${m.manager}`.includes(maintSearch.keyword)))
    .sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  const filteredActivityLogs = activityLogs.filter((log) => {
    const moduleOk = !activityLogSearch.module || log.module === activityLogSearch.module;
    const keyword = activityLogSearch.keyword.trim().toLowerCase();
    const target = `${log.module || ""} ${log.action || ""} ${log.target_title || ""} ${log.detail || ""} ${log.user_email || ""}`.toLowerCase();
    return moduleOk && (!keyword || target.includes(keyword));
  });

  const filteredDeletedRecords = deletedRecords.filter((record) => {
    const moduleOk = !trashSearch.module || record.module === trashSearch.module;
    const keyword = trashSearch.keyword.trim().toLowerCase();
    const target = `${record.module || ""} ${record.title || ""} ${record.detail || ""} ${record.deleted_by || ""}`.toLowerCase();
    return moduleOk && (!keyword || target.includes(keyword));
  });

  const login = async () => {
    setLoginError("");

    const loginId = loginForm.email.trim();
    const email = toLoginEmail(loginId);

    if (!email) {
      setLoginError("ì•„ì´ë””ë¥¼ ì…ë ¥í•˜ì„¸ìš”.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: loginForm.password,
    });

    if (error) {
      setLoginError("ë¡œê·¸ì¸ ì‹¤íŒ¨: ì•„ì´ë”” ë˜ëŠ” ë¹„ë°€ë²ˆí˜¸ë¥¼ í™•ì¸í•˜ì„¸ìš”.");
      return;
    }

    const nextPrefs = {
      ...authPrefs,
      email: authPrefs.saveEmail || authPrefs.autoLogin ? toLoginId(email) : "",
    };

    setLoginForm((prev) => ({ ...prev, email: toLoginId(email) }));
    setAuthPrefs(nextPrefs);
    writeAuthPrefs(nextPrefs);
    setAuthLoading(false);
  };

  const logout = async () => {
    setAuthLoading(false);
    setSession(null);
    setMenuTab("home");
    setMobileSheet("");
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

    const { data, error } = await fetchAllRows("update_notices", "notice_date", 1000, false);

    if (error) {
      console.error(error);
      setUpdateNoticeError(error.message);
      setUpdateNotices([]);
      setShowUpdateNotice(false);
      return;
    }

    const notices = ((data || []) as any[]).filter((n) => n.is_active !== false).map((n) => ({
      ...n,
      id: String(n.id),
      notice_date: String(n.notice_date || "").slice(0, 10),
    })).sort((a, b) => String(b.notice_date || "").localeCompare(String(a.notice_date || "")) || String(b.created_at || "").localeCompare(String(a.created_at || ""))) as UpdateNotice[];

    const dedupedNotices = dedupeUpdateNotices(notices);
    setUpdateNotices(dedupedNotices);

    setShowUpdateNotice(false);
  };

  const addActivityLog = async ({
    module,
    action,
    target_id = "",
    target_title = "",
    detail = "",
  }: {
    module: string;
    action: string;
    target_id?: string;
    target_title?: string;
    detail?: string;
  }) => {
    try {
      await supabase.from("activity_logs").insert({
        id: uid(),
        module,
        action,
        target_id,
        target_title,
        detail,
        user_email: userEmail || "",
        user_role: currentRole,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("activity log failed", error);
    }
  };

  const loadActivityLogs = async () => {
    const { data, error } = await fetchAllRows("activity_logs", "created_at", 1000, false);

    if (error) {
      console.error(error);
      setActivityLogs([]);
      return;
    }

    setActivityLogs(((data || []) as any[]).map((row) => ({
      ...row,
      id: String(row.id),
      module: row.module || "",
      action: row.action || "",
      target_id: row.target_id || "",
      target_title: row.target_title || "",
      detail: row.detail || "",
      user_email: row.user_email || "",
      user_role: row.user_role || "",
      created_at: row.created_at || "",
    })) as ActivityLog[]);
  };

  const loadDeletedRecords = async () => {
    const { data, error } = await fetchAllRows("deleted_records", "deleted_at", 1000, false);

    if (error) {
      console.error(error);
      setDeletedRecords([]);
      return;
    }

    setDeletedRecords(((data || []) as any[]).map((row) => ({
      ...row,
      id: String(row.id),
      source_table: row.source_table || "",
      module: row.module || "",
      record_id: row.record_id || "",
      title: row.title || "",
      detail: row.detail || "",
      data: row.data || {},
      deleted_by: row.deleted_by || "",
      deleted_at: row.deleted_at || "",
    })) as DeletedRecord[]);
  };

  type TrashInput = {
    source_table: string;
    module: string;
    record_id: string;
    title?: string;
    detail?: string;
    data: any;
  };

  const moveRecordsToTrash = async (records: TrashInput[]) => {
    if (!records.length) return true;
    const movedAt = Date.now();
    const deletedAt = new Date().toISOString();
    const payloads: DeletedRecord[] = records.map((record, index) => ({
      id: `trash-${record.source_table}-${record.record_id}-${movedAt}-${index}`,
      source_table: record.source_table,
      module: record.module,
      record_id: record.record_id,
      title: record.title || "",
      detail: record.detail || "",
      data: record.data,
      deleted_by: userEmail || "",
      deleted_at: deletedAt,
    }));

    const error = await upsertInChunks("deleted_records", payloads, 500);
    if (error) {
      alert(`íœ´ì§€í†µ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
      return false;
    }

    return true;
  };

  const moveToTrash = async ({
    source_table,
    module,
    record_id,
    title = "",
    detail = "",
    data,
  }: TrashInput) => {
    return moveRecordsToTrash([{
      source_table,
      module,
      record_id,
      title,
      detail,
      data,
    }]);
  };

  const restoreDeletedRecord = async (record: DeletedRecord) => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ë³µêµ¬í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    if (!confirm(`${record.title || record.module} í•­ëª©ì„ ë³µêµ¬í• ê¹Œìš”?`)) return;

    const { error: restoreError } = await supabase.from(record.source_table).upsert(record.data);
    if (restoreError) return alert(`ë³µêµ¬ ì‹¤íŒ¨: ${restoreError.message}`);

    const { error: deleteTrashError } = await supabase.from("deleted_records").delete().eq("id", record.id);
    if (deleteTrashError) return alert(`íœ´ì§€í†µ ì •ë¦¬ ì‹¤íŒ¨: ${deleteTrashError.message}`);

    await addActivityLog({
      module: record.module,
      action: "ë³µêµ¬",
      target_id: record.record_id,
      target_title: record.title || "",
      detail: record.detail || "",
    });

    await loadDeletedRecords();
    await Promise.all([
      loadAll(),
      loadPermits(),
      loadVendorAccounts(),
      loadReceiptPhotos(),
      loadMaintenancePhotos(),
      loadMaintenanceSchedules(),
      loadUpdateNotices(),
      loadSiteNotices(),
    ]);
    showToast("ì„ íƒí•œ í•­ëª©ì„ ë³µêµ¬í–ˆìŠµë‹ˆë‹¤.");
  };

  const permanentlyDeleteTrashRecord = async (id: string) => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ì™„ì „ì‚­ì œí•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    if (!confirm("íœ´ì§€í†µì—ì„œ ì™„ì „íˆ ì‚­ì œí• ê¹Œìš”? ì´ ì‘ì—…ì€ ë˜ëŒë¦´ ìˆ˜ ì—†ìŠµë‹ˆë‹¤.")) return;

    const { error } = await supabase.from("deleted_records").delete().eq("id", id);
    if (error) return alert(`ì™„ì „ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);

    await loadDeletedRecords();
  };

  const fetchBackupTable = async (table: string, orderColumn = "id") => {
    const { data, error } = await fetchAllRows(table, orderColumn, 1000, false);

    if (error) {
      console.error(`backup ${table} failed`, error);
      throw new Error(`${table} ì „ì²´ìë£Œ ì¡°íšŒ ì‹¤íŒ¨: ${error.message}`);
    }

    return data || [];
  };

  const downloadTextFile = (fileName: string, content: string, type = "application/json") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportFullBackup = async () => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ë°±ì—…í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    if (backupSaving) return;

    setBackupSaving(true);

    try {
      const [
        backupVendors,
        backupGroups,
        backupWarehouses,
        backupItems,
        backupPurchases,
        backupMaints,
        backupCardUses,
        backupReceiptPhotos,
        backupMaintenancePhotos,
        backupMaintenanceSchedules,
        backupVendorAccounts,
        backupPermits,
        backupUpdateNotices,
        backupSiteNotices,
        backupUserPermissions,
        backupActivityLogs,
        backupDeletedRecords,
      ] = await Promise.all([
        fetchBackupTable("vendors", "code"),
        fetchBackupTable("warehouse_groups", "code"),
        fetchBackupTable("warehouses", "code"),
        fetchBackupTable("items", "code"),
        fetchBackupTable("purchases", "date"),
        fetchBackupTable("maints", "date"),
        fetchBackupTable("card_uses", "date"),
        fetchBackupTable("receipt_photos", "receipt_date"),
        fetchBackupTable("maintenance_photos", "maint_date"),
        fetchBackupTable("maintenance_schedules", "schedule_date"),
        fetchBackupTable("vendor_accounts", "vendor_name"),
        fetchBackupTable("permit_renewals", "expiry_date"),
        fetchBackupTable("update_notices", "notice_date"),
        fetchBackupTable("site_notices", "notice_date"),
        fetchBackupTable("user_permissions", "email"),
        fetchBackupTable("activity_logs", "created_at"),
        fetchBackupTable("deleted_records", "deleted_at"),
      ]);

      const backup: BackupExport = {
        exported_at: new Date().toISOString(),
        exported_by: userEmail || "",
        record_counts: {
          vendors: backupVendors.length,
          warehouse_groups: backupGroups.length,
          warehouses: backupWarehouses.length,
          items: backupItems.length,
          purchases: backupPurchases.length,
          maints: backupMaints.length,
          card_uses: backupCardUses.length,
          receipt_photos: backupReceiptPhotos.length,
          maintenance_photos: backupMaintenancePhotos.length,
          maintenance_schedules: backupMaintenanceSchedules.length,
          vendor_accounts: backupVendorAccounts.length,
          permit_renewals: backupPermits.length,
          update_notices: backupUpdateNotices.length,
          site_notices: backupSiteNotices.length,
          user_permissions: backupUserPermissions.length,
          activity_logs: backupActivityLogs.length,
          deleted_records: backupDeletedRecords.length,
        },
        vendors: backupVendors as Vendor[],
        warehouse_groups: backupGroups as Group[],
        warehouses: backupWarehouses as Warehouse[],
        items: backupItems as Item[],
        purchases: (backupPurchases as any[]).map(toPurchase),
        maints: backupMaints as Maint[],
        card_uses: backupCardUses as CardUse[],
        receipt_photos: backupReceiptPhotos as ReceiptPhoto[],
        maintenance_photos: backupMaintenancePhotos as MaintenancePhoto[],
        maintenance_schedules: backupMaintenanceSchedules as MaintenanceSchedule[],
        vendor_accounts: backupVendorAccounts as VendorAccount[],
        permits: backupPermits as PermitRenewal[],
        update_notices: backupUpdateNotices as UpdateNotice[],
        site_notices: backupSiteNotices as SiteNotice[],
        user_permissions: backupUserPermissions as UserPermission[],
        activity_logs: backupActivityLogs as ActivityLog[],
        deleted_records: backupDeletedRecords as DeletedRecord[],
      };

      const fileName = `ERP_ì „ì²´ë°±ì—…_${getTodayKey()}_${new Date().toTimeString().slice(0, 5).replace(":", "")}.json`;
      downloadTextFile(fileName, JSON.stringify(backup, null, 2));

      await addActivityLog({
        module: "ë°±ì—…",
        action: "ì „ì²´ë°±ì—… ë‹¤ìš´ë¡œë“œ",
        target_title: fileName,
        detail: `êµ¬ë§¤ ${backup.purchases.length}ê±´ Â· ì •ë¹„ ${backup.maints.length}ê±´ Â· ì¹´ë“œ ${backup.card_uses.length}ê±´ Â· íœ´ì§€í†µ ${backup.deleted_records.length}ê±´`,
      });

      showToast("ì „ì²´ ë°±ì—… íŒŒì¼ì„ ë‹¤ìš´ë¡œë“œí–ˆìŠµë‹ˆë‹¤.");
    } catch (error: any) {
      alert(error?.message || "ì „ì²´ë°±ì—… ì¤‘ ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤. ë°±ì—… íŒŒì¼ì€ ìƒì„±í•˜ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤.");
    } finally {
      setBackupSaving(false);
    }
  };

  const exportBackupSummaryExcel = async () => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ë°±ì—…í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");

    const rows = [
      { êµ¬ë¶„: "ê±°ë˜ì²˜", ê±´ìˆ˜: vendors.length },
      { êµ¬ë¶„: "ì°½ê³ ëŒ€ë¶„ë¥˜", ê±´ìˆ˜: groups.length },
      { êµ¬ë¶„: "ì°½ê³ ", ê±´ìˆ˜: warehouses.length },
      { êµ¬ë¶„: "í’ˆëª©", ê±´ìˆ˜: items.length },
      { êµ¬ë¶„: "êµ¬ë§¤", ê±´ìˆ˜: purchases.length },
      { êµ¬ë¶„: "ì •ë¹„", ê±´ìˆ˜: maints.length },
      { êµ¬ë¶„: "ì¹´ë“œì‚¬ìš©", ê±´ìˆ˜: cardUses.length },
      { êµ¬ë¶„: "ì…ê³ ì‚¬ì§„", ê±´ìˆ˜: receiptPhotos.length },
      { êµ¬ë¶„: "ì •ë¹„ì‚¬ì§„", ê±´ìˆ˜: maintenancePhotos.length },
      { êµ¬ë¶„: "ì •ë¹„ì¼ì •", ê±´ìˆ˜: maintenanceSchedules.length },
      { êµ¬ë¶„: "ê±°ë˜ì²˜ê³„ì¢Œ", ê±´ìˆ˜: vendorAccounts.length },
      { êµ¬ë¶„: "í—ˆê°€ê´€ë¦¬", ê±´ìˆ˜: permits.length },
      { êµ¬ë¶„: "ì‘ì—…ë¡œê·¸", ê±´ìˆ˜: activityLogs.length },
      { êµ¬ë¶„: "íœ´ì§€í†µ", ê±´ìˆ˜: deletedRecords.length },
    ];

    downloadExcel(`ERP_ë°±ì—…í˜„í™©_${getTodayKey()}`, rows);
  };

  const loadSiteNotices = async () => {
    setSiteNoticeError("");

    const { data, error } = await fetchAllRows("site_notices", "notice_date", 1000, false);

    if (error) {
      console.error(error);
      setSiteNoticeError(error.message);
      setSiteNotices([]);
      return;
    }

    setSiteNotices(((data || []) as any[]).filter((item) => item.is_active !== false).map((item) => ({
      ...item,
      id: String(item.id),
      notice_date: String(item.notice_date || "").slice(0, 10),
      priority: item.priority || "ë³´í†µ",
      target_roles: Array.isArray(item.target_roles) ? item.target_roles : ["all"],
      target_emails: Array.isArray(item.target_emails) ? item.target_emails : [],
    })).sort((a, b) => String(b.notice_date || "").localeCompare(String(a.notice_date || "")) || String(b.created_at || "").localeCompare(String(a.created_at || ""))) as SiteNotice[]);
  };

  const saveSiteNotice = async () => {
    if (!(isAdmin || currentRole === "office")) return alert("ê´€ë¦¬ì ë˜ëŠ” ì‚¬ë¬´ì‹¤ì§ì›ë§Œ ê³µì§€ë¥¼ ì €ì¥í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    if (!siteNoticeForm.title.trim() || !siteNoticeForm.content.trim()) {
      return alert("ì œëª©ê³¼ ë‚´ìš©ì„ ì…ë ¥í•˜ì„¸ìš”.");
    }

    const payload = {
      id: editingSiteNoticeId || uid(),
      notice_date: getTodayKey(),
      title: siteNoticeForm.title.trim(),
      content: siteNoticeForm.content.trim(),
      priority: siteNoticeForm.priority || "ë³´í†µ",
      is_active: siteNoticeForm.is_active,
      target_roles: siteNoticeForm.target_roles?.length ? siteNoticeForm.target_roles : ["all"],
      target_emails: siteNoticeForm.target_emails || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("site_notices").upsert(payload);
    if (error) return alert(`ê³µì§€ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

    setSiteNoticeForm({ title: "", content: "", priority: "ë³´í†µ", is_active: true, target_roles: ["all"], target_emails: [] });
    setEditingSiteNoticeId("");
    await loadSiteNotices();
    showToast(editingSiteNoticeId ? "ê³µì§€ë¥¼ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "ê³µì§€ë¥¼ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
  };

  const editSiteNotice = (notice: SiteNotice) => {
    setEditingSiteNoticeId(notice.id);
    setSiteNoticeForm({
      title: notice.title || "",
      content: notice.content || "",
      priority: notice.priority || "ë³´í†µ",
      is_active: notice.is_active !== false,
      target_roles: notice.target_roles?.length ? notice.target_roles : ["all"],
      target_emails: notice.target_emails || [],
    });
  };

  const deleteSiteNotice = async (id: string) => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ í˜„ì¥ ê³µì§€ë¥¼ ì‚­ì œí•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    const target = siteNotices.find((notice) => notice.id === id);
    if (!target) return alert("ì‚­ì œí•  ê³µì§€ë¥¼ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ê³µì§€ë¥¼ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "site_notices",
      module: "ê³µì§€",
      record_id: id,
      title: target.title || "",
      detail: `${target.notice_date || "-"} Â· ${target.priority || "ë³´í†µ"}`,
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("site_notices").delete().eq("id", id);
    if (error) return alert(`ê³µì§€ ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);

    await loadSiteNotices();
  };

  const loadUserPermissions = async () => {
    setUserPermissionsLoading(true);
    setUserPermissionsError("");
    const { data, error } = await fetchAllRows("user_permissions", "email", 1000);

    if (error) {
      console.error(error);
      setUserPermissions([]);
      setUserPermissionsError("ê¶Œí•œ ì •ë³´ë¥¼ ë¶ˆëŸ¬ì˜¤ì§€ ëª»í–ˆìŠµë‹ˆë‹¤. ì ì‹œ í›„ ë‹¤ì‹œ í™•ì¸í•´ ì£¼ì„¸ìš”.");
      setUserPermissionsLoading(false);
      return [] as UserPermission[];
    }

    const nextPermissions = ((data || []) as any[]).map((item) => ({
      ...item,
      id: String(item.id),
      role: (item.role || "field") as UserRole,
      permissions: item.permissions || {},
    })) as UserPermission[];

    setUserPermissions(nextPermissions);
    setUserPermissionsLoading(false);
    return nextPermissions;
  };

  const saveUserPermission = async (next?: UserPermission) => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ê¶Œí•œì„ ì €ì¥í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    const target = next || permissionForm;
    const loginId = target.email.trim().toLowerCase();
    const email = toLoginEmail(loginId);
    if (!email) return alert("ì§ì› ì•„ì´ë””ë¥¼ ì…ë ¥í•˜ì„¸ìš”.");

    const payload = {
      id: target.id || uid(),
      email,
      role: target.role || "field",
      permissions: target.role === "field" ? (target.permissions || {}) : {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("user_permissions").upsert(payload, { onConflict: "email" });
    if (error) return alert(`ê¶Œí•œ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

    await loadUserPermissions();
    setPermissionForm({ id: uid(), email: "", role: "field", permissions: {} });
  };

  const deleteUserPermission = async (email: string) => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ê¶Œí•œì„ ì‚­ì œí•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    if (!confirm(`${toLoginId(email)} ê¶Œí•œì„ ì‚­ì œí• ê¹Œìš”?`)) return;

    const { error } = await supabase.from("user_permissions").delete().eq("email", email);
    if (error) return alert(`ê¶Œí•œ ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);

    await loadUserPermissions();
  };

  const saveUpdateNotice = async () => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ì—…ë°ì´íŠ¸ ê³µì§€ë¥¼ ì €ì¥í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");
    if (!updateNoticeForm.notice_date || !updateNoticeForm.content.trim()) {
      return alert("ë‚ ì§œì™€ ì—…ë°ì´íŠ¸ ë‚´ìš©ì„ ì…ë ¥í•˜ì„¸ìš”.");
    }

    const payload = {
      id: editingUpdateNoticeId || uid(),
      notice_date: updateNoticeForm.notice_date,
      content: updateNoticeForm.content.trim(),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("update_notices").upsert(payload);
    if (error) return alert(`ì—…ë°ì´íŠ¸ ê³µì§€ ì €ì¥ ì‹¤íŒ¨: ${error.message}`);

    setUpdateNoticeForm({ notice_date: getTodayKey(), content: "" });
    setEditingUpdateNoticeId("");
    await loadUpdateNotices();
    showToast(editingUpdateNoticeId ? "ì—…ë°ì´íŠ¸ ê³µì§€ë¥¼ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤." : "ì—…ë°ì´íŠ¸ ê³µì§€ë¥¼ ë“±ë¡í–ˆìŠµë‹ˆë‹¤.");
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
    if (!canEditDeleteRecords) return alert("ì‚­ì œëŠ” ê´€ë¦¬ìë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.");
    const target = updateNotices.find((notice) => notice.id === id);
    if (!target) return alert("ì‚­ì œí•  ì—…ë°ì´íŠ¸ ê³µì§€ë¥¼ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
    if (!confirm("ì—…ë°ì´íŠ¸ ê³µì§€ë¥¼ íœ´ì§€í†µìœ¼ë¡œ ì´ë™í• ê¹Œìš”?")) return;

    const ok = await moveToTrash({
      source_table: "update_notices",
      module: "ì—…ë°ì´íŠ¸ê³µì§€",
      record_id: id,
      title: target.content || "",
      detail: target.notice_date || "",
      data: target,
    });
    if (!ok) return;

    const { error } = await supabase.from("update_notices").delete().eq("id", id);
    if (error) return alert(`ì—…ë°ì´íŠ¸ ê³µì§€ ì‚­ì œ ì‹¤íŒ¨: ${error.message}`);

    await loadUpdateNotices();
  };

  const cleanupDuplicateUpdateNotices = async () => {
    if (!isAdmin) return alert("ê´€ë¦¬ìë§Œ ì¤‘ë³µ ê³µì§€ë¥¼ ì •ë¦¬í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.");

    const { data, error } = await fetchAllRows("update_notices", "notice_date", 1000, false);

    if (error) return alert(`ì¤‘ë³µ ê³µì§€ ì¡°íšŒ ì‹¤íŒ¨: ${error.message}`);

    const seen = new Set<string>();
    const duplicateIds: string[] = [];

    ((data || []) as any[]).filter((notice) => notice.is_active !== false).forEach((notice) => {
      const key = `${String(notice.notice_date || "").slice(0, 10)}|${String(notice.content || "").trim()}`;
      if (seen.has(key)) duplicateIds.push(String(notice.id));
      else seen.add(key);
    });

    if (!duplicateIds.length) {
      showToast("ì •ë¦¬í•  ì¤‘ë³µ ê³µì§€ê°€ ì—†ìŠµë‹ˆë‹¤.", "info");
      return;
    }

    const { error: deleteError } = await supabase
      .from("update_notices")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) return alert(`ì¤‘ë³µ ê³µì§€ ì‚­ì œ ì‹¤íŒ¨: ${deleteError.message}`);

    await loadUpdateNotices();
    showToast(`ì¤‘ë³µ ê³µì§€ ${duplicateIds.length}ê±´ì„ ì •ë¦¬í–ˆìŠµë‹ˆë‹¤.`);
  };

  useEffect(() => {
    if (!session || !isPermissionApproved) return;
    loadUpdateNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, menuTab, isPermissionApproved]);

  if (authLoading) {
    return (
      <>
        <style>{loginCss}</style>
        <div className="login-page">
          <div className="login-card">ë¡œê·¸ì¸ í™•ì¸ ì¤‘...</div>
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
          <h1>íƒœëª…ì‚°ì—…ê°œë°œ</h1>
          <p>í†µí•© ê´€ë¦¬ ì‹œìŠ¤í…œ ë¡œê·¸ì¸</p>

          <label>ì•„ì´ë””</label>
          <input
            value={loginForm.email}
            onChange={(e) => {
              const email = e.target.value;
              setLoginForm({ ...loginForm, email });

              if (authPrefs.saveEmail || authPrefs.autoLogin) {
                const nextPrefs = { ...authPrefs, email: toLoginId(email) };
                setAuthPrefs(nextPrefs);
                writeAuthPrefs(nextPrefs);
              }
            }}
            placeholder="ì•„ì´ë”” ì…ë ¥ ì˜ˆ: field01"
          />

          <label>ë¹„ë°€ë²ˆí˜¸</label>
          <input
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            placeholder="ë¹„ë°€ë²ˆí˜¸ ì…ë ¥"
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
              ì•„ì´ë”” ì €ì¥
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
              ìë™ ë¡œê·¸ì¸
            </label>
          </div>

          {loginError && <div className="login-error">{loginError}</div>}

          <button className="primary login-button" onClick={login}>ë¡œê·¸ì¸</button>
          </div>
        </div>
      </>
    );
  }

  if (!isAdmin && userPermissionsLoading) {
    return (
      <>
        <style>{loginCss}</style>
        <div className="login-page">
          <div className="login-card">ê¶Œí•œ í™•ì¸ ì¤‘...</div>
        </div>
      </>
    );
  }

  if (!isPermissionApproved) {
    return (
      <>
        <style>{loginCss}</style>
        <div className="login-page">
          <div className="login-card permission-pending-card">
            <div className="login-badge">TAEMYUNG ERP</div>
            <div className="permission-pending-icon" aria-hidden="true">ğŸ”’</div>
            <h1>{userPermissionsError ? "ê¶Œí•œ í™•ì¸ ì˜¤ë¥˜" : "ê¶Œí•œ ìŠ¹ì¸ ëŒ€ê¸°"}</h1>
            <p>{userPermissionsError || "ê´€ë¦¬ìê°€ ì´ ê³„ì •ì˜ ì‚¬ìš© ê¶Œí•œì„ ë“±ë¡í•´ì•¼ ì—…ë¬´ ë©”ë‰´ë¥¼ ì´ìš©í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤."}</p>
            <div className="permission-pending-account">ë¡œê·¸ì¸ ê³„ì •: {toLoginId(userEmail)}</div>
            <div className="permission-pending-help">
              ê´€ë¦¬ìì—ê²Œ ìœ„ ì•„ì´ë””ë¥¼ ì•Œë ¤ì£¼ê³ <br />ê¶Œí•œê´€ë¦¬ì—ì„œ ì§ì› ê¶Œí•œì„ ë“±ë¡í•´ ì£¼ì„¸ìš”.
            </div>
            <div className="permission-pending-actions">
              <button type="button" onClick={logout}>ë¡œê·¸ì•„ì›ƒ</button>
              <button type="button" className="primary" onClick={() => window.location.reload()}>ê¶Œí•œ ë‹¤ì‹œ í™•ì¸</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      <style>{css}</style>
      {toast && (
        <div key={toast.id} className={`app-toast ${toast.tone}`} role="status" aria-live="polite">
          <div className="app-toast-icon"><CheckCircle2 size={21} /></div>
          <div className="app-toast-copy">
            <strong>{toast.tone === "success" ? "ì™„ë£Œ" : "ì•ˆë‚´"}</strong>
            <span>{toast.message}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} aria-label="ì•Œë¦¼ ë‹«ê¸°"><X size={16} /></button>
          <i aria-hidden="true" />
        </div>
      )}
      {vendorAddressSearchOpen && (
        <div className="vendor-address-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setVendorAddressSearchOpen(false);
        }}>
          <div className="vendor-address-modal" role="dialog" aria-modal="true" aria-label="ê±°ë˜ì²˜ ì£¼ì†Œ ê²€ìƒ‰">
            <div className="vendor-address-modal-head">
              <div>
                <strong>ì£¼ì†Œ ê²€ìƒ‰</strong>
                <span>ë„ë¡œëª… ë˜ëŠ” ì§€ë²ˆì£¼ì†Œë¥¼ ê²€ìƒ‰í•˜ì„¸ìš”.</span>
              </div>
              <button type="button" onClick={() => setVendorAddressSearchOpen(false)} aria-label="ì£¼ì†Œ ê²€ìƒ‰ ë‹«ê¸°"><X size={18} /></button>
            </div>
            <div className="vendor-address-modal-body">
              {!vendorAddressSearchReady && !vendorAddressSearchError && (
                <div className="vendor-address-modal-status">ì£¼ì†Œ ê²€ìƒ‰ ê¸°ëŠ¥ì„ ë¶ˆëŸ¬ì˜¤ëŠ” ì¤‘ì…ë‹ˆë‹¤...</div>
              )}
              {vendorAddressSearchError && (
                <div className="vendor-address-modal-status error">
                  <strong>ì£¼ì†Œ ê²€ìƒ‰ì„ ë¶ˆëŸ¬ì˜¤ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.</strong>
                  <span>{vendorAddressSearchError}</span>
                  <button type="button" onClick={() => window.location.reload()}>ë‹¤ì‹œ ë¶ˆëŸ¬ì˜¤ê¸°</button>
                </div>
              )}
              <div ref={vendorAddressSearchContainerRef} className={`vendor-address-embed${vendorAddressSearchReady ? " ready" : ""}`} />
            </div>
          </div>
        </div>
      )}
      <div className={`app app-tab-${menuTab}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
        <header className="hero">
          <div className="hero-brand-mark" aria-hidden="true">TM</div>
          <div className="hero-brand-copy">
            <h1 className="main-title">íƒœëª…ì‚°ì—…ê°œë°œ</h1>
            <p>í†µí•© ê´€ë¦¬ ì‹œìŠ¤í…œ</p>
          </div>
        </header>

        {loading && <div className="loading">Supabase ë°ì´í„° ë¶ˆëŸ¬ì˜¤ëŠ” ì¤‘...</div>}



        {showUpdateNotice && (
          <div className="update-popup-backdrop">
            <div className="update-popup">
              <div className="update-popup-head">
                <div>
                  <span>UPDATE</span>
                  <h2>ì—…ë°ì´íŠ¸ ì•ˆë‚´</h2>
                </div>
                <button onClick={closeUpdateNotice}>Ã—</button>
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
                  ì˜¤ëŠ˜ ì—´ì§€ ì•ŠìŒ
                </label>
                <button className="primary" onClick={closeUpdateNotice}>í™•ì¸</button>
              </div>
            </div>
          </div>
        )}


        {bulkTransferSelectOpen && (
          <div className="bulk-select-overlay">
            <div className="bulk-select-modal">
              <div className="bulk-select-head">
                <div>
                  <h2>ëŒ€ëŸ‰ì´ì²´ í•­ëª© ì„ íƒ</h2>
                  <p>ì²´í¬í•œ ê±°ë˜ì²˜ë§Œ ì—‘ì…€ë¡œ ë‹¤ìš´ë¡œë“œë©ë‹ˆë‹¤.</p>
                </div>
                <button onClick={() => setBulkTransferSelectOpen(false)}>ë‹«ê¸°</button>
              </div>
              <div className="bulk-select-actions">
                <button onClick={() => setSelectedBulkTransferIds(bulkTransferRows.map((row) => row.id))}>ì „ì²´ì„ íƒ</button>
                <button onClick={() => setSelectedBulkTransferIds([])}>ì „ì²´í•´ì œ</button>
                <strong>ì„ íƒ {selectedBulkTransferIds.length}ê±´ / {money(bulkTransferRows.filter((row) => selectedBulkTransferIds.includes(row.id)).reduce((sum, row) => sum + row.amount, 0))}ì›</strong>
              </div>
              <div className="bulk-select-list">
                {bulkTransferRows.map((row) => (
                  <label className={row.matched ? "bulk-select-row" : "bulk-select-row missing"} key={row.id}>
                    <input type="checkbox" checked={selectedBulkTransferIds.includes(row.id)} onChange={() => toggleBulkTransferSelection(row.id)} />
                    <span>{row.vendor}</span>
                    <em>{row.matched ? "ê³„ì¢Œë§¤ì¹­" : "ê³„ì¢Œí™•ì¸í•„ìš”"}</em>
                    <b>{money(row.amount)}ì›</b>
                  </label>
                ))}
              </div>
              <div className="bulk-select-bottom">
                <button onClick={() => setBulkTransferSelectOpen(false)}>ì·¨ì†Œ</button>
                <button className="primary" onClick={downloadSelectedBulkTransferExcel}>ì„ íƒ í•­ëª© ë‹¤ìš´ë¡œë“œ</button>
              </div>
            </div>
          </div>
        )}

        <nav className="menu permission-aware-menu">
          <button
            type="button"
            className="desktop-sidebar-toggle"
            aria-label={sidebarCollapsed ? "ì‚¬ì´ë“œë°” í¼ì¹˜ê¸°" : "ì‚¬ì´ë“œë°” ì ‘ê¸°"}
            title={sidebarCollapsed ? "ì‚¬ì´ë“œë°” í¼ì¹˜ê¸°" : "ì‚¬ì´ë“œë°” ì ‘ê¸°"}
            onClick={() => {
              setSidebarCollapsed((value) => !value);
              setOpenMenuGroup(null);
            }}
          >
            â˜°
          </button>
          {canAccessTab("home") && <button className={menuTab === "home" ? "active" : ""} onClick={() => { setMenuTab("home"); setOpenMenuGroup(null); }}><HomeIcon size={17} /> í™ˆ</button>}
          {canAccessTab("site_notices") && <button className={menuTab === "site_notices" ? "active" : ""} onClick={() => { setMenuTab("site_notices"); setOpenMenuGroup(null); }}><Bell size={17} /> ê³µì§€</button>}
          {canAccessTab("layout") && <button className={menuTab === "layout" ? "active" : ""} onClick={() => { setMenuTab("layout"); setOpenMenuGroup(null); }}><Factory size={17} /> ìƒì‚°ë¼ì¸</button>}
          {canAccessTab("bid_notices") && <button className={menuTab === "bid_notices" ? "active" : ""} onClick={() => { setMenuTab("bid_notices"); setOpenMenuGroup(null); }}><FileCheck2 size={17} /> ì…ì°°ê³µê³ </button>}

          {canShowAny(["new", "list", "status", "bulk_transfer", "receipt_photos", "vendor_accounts"]) && (
            <div className={`menu-group ${openMenuGroup === "purchase" ? "expanded" : ""}`}>
              <button type="button" aria-expanded={openMenuGroup === "purchase"} onClick={() => setOpenMenuGroup((current) => current === "purchase" ? null : "purchase")}><ShoppingCart size={17} /> êµ¬ë§¤</button>
              <div className="sub">
                {menuButton("new", "êµ¬ë§¤ì…ë ¥")}
                {menuButton("list", "êµ¬ë§¤ì¡°íšŒ")}
                {menuButton("status", "êµ¬ë§¤í˜„í™©")}
                {menuButton("bulk_transfer", "ëŒ€ëŸ‰ì´ì²´")}
                {menuButton("receipt_photos", "ì…ê³ ì‚¬ì§„ë“±ë¡")}
                {menuButton("vendor_accounts", "ì—…ì²´ê³„ì¢Œê´€ë¦¬")}
              </div>
            </div>
          )}

          {canShowAny(["card_use", "card_list", "card_stats"]) && (
            <div className={`menu-group ${openMenuGroup === "card" ? "expanded" : ""}`}>
              <button type="button" aria-expanded={openMenuGroup === "card"} onClick={() => setOpenMenuGroup((current) => current === "card" ? null : "card")}><CreditCard size={17} /> ì¹´ë“œ</button>
              <div className="sub">
                {menuButton("card_use", "ì¹´ë“œì‚¬ìš©")}
                {menuButton("card_list", "ì¹´ë“œì¡°íšŒ")}
                {menuButton("card_stats", "ì¹´ë“œí†µê³„")}
              </div>
            </div>
          )}

          {canShowAny(["maint_new", "maint_list", "maint_stats", "maintenance_photos", "maintenance_schedule_new", "maintenance_schedules"]) && (
            <div className={`menu-group maint-menu-group ${openMenuGroup === "maintenance" ? "expanded" : ""}`}>
              <button type="button" aria-expanded={openMenuGroup === "maintenance"} onClick={() => setOpenMenuGroup((current) => current === "maintenance" ? null : "maintenance")}><Wrench size={17} /> ì •ë¹„</button>
              <div className="sub maint-sub">
                {menuButton("maint_new", "ì •ë¹„ë“±ë¡")}
                {menuButton("maint_list", "ì •ë¹„ì¡°íšŒ")}
                {menuButton("maint_stats", "ì •ë¹„í†µê³„")}
                {menuButton("maintenance_photos", "ì •ë¹„ì‚¬ì§„ë“±ë¡")}
                {menuButton("maintenance_schedule_new", "ì •ë¹„ì¼ì •ë“±ë¡")}
                {menuButton("maintenance_schedules", "ì •ë¹„ì¼ì •ì¡°íšŒ")}
              </div>
            </div>
          )}

          {canShowAny(["vendors", "warehouse_groups", "items"]) && (
            <div className={`menu-group ${openMenuGroup === "basic" ? "expanded" : ""}`}>
              <button type="button" aria-expanded={openMenuGroup === "basic"} onClick={() => setOpenMenuGroup((current) => current === "basic" ? null : "basic")}><Database size={17} /> ê¸°ì´ˆë“±ë¡</button>
              <div className="sub">
                {menuButton("vendors", "ê±°ë˜ì²˜ë“±ë¡")}
                {menuButton("warehouse_groups", "ì°½ê³ ë“±ë¡")}
                {menuButton("items", "í’ˆëª©ë“±ë¡")}
              </div>
            </div>
          )}

          {canAccessTab("permits") && <button className={menuTab === "permits" ? "active" : ""} onClick={() => { setMenuTab("permits"); setOpenMenuGroup(null); }}><FileCheck2 size={17} /> í—ˆê°€ê´€ë¦¬</button>}
          {isAdmin && <button className={menuTab === "activity_logs" ? "active" : ""} onClick={() => { setMenuTab("activity_logs"); setOpenMenuGroup(null); }}><ClipboardList size={17} /> ì‘ì—…ë¡œê·¸</button>}
          {isAdmin && <button className={menuTab === "trash_bin" ? "active" : ""} onClick={() => { setMenuTab("trash_bin"); setOpenMenuGroup(null); }}><Trash2 size={17} /> íœ´ì§€í†µ</button>}
          {isAdmin && <button className={menuTab === "backup_permissions" ? "active" : ""} onClick={() => { setMenuTab("backup_permissions"); setOpenMenuGroup(null); }}><ShieldCheck size={17} /> ë°±ì—…/ê¶Œí•œê´€ë¦¬</button>}
          <div className="user-box"><span>{userEmail}{currentRole === "admin" ? " Â· ê´€ë¦¬ì" : currentRole === "office" ? " Â· ì‚¬ë¬´ì‹¤ì§ì›" : " Â· í˜„ì¥ì§ì›"}</span><button onClick={logout}>ë¡œê·¸ì•„ì›ƒ</button></div>
        </nav>
        {menuTab === "update_history" && (
          <section className="notice-pro-wrap notice-only">
            <div className="notice-pro-left">
              <div className="notice-pro-head">
                <div>
                  <h2>ğŸ“¢ ê³µì§€</h2>
                  <p>ì‹œìŠ¤í…œ ì—…ë°ì´íŠ¸ ë° ì¤‘ìš” ì•ˆë‚´ì‚¬í•­ì„ í™•ì¸í•˜ì„¸ìš”.</p>
                </div>
                <div className="notice-pin">ê¼­<br />í™•ì¸!</div>
              </div>

              <div className="notice-pro-tabs">
                <button className="active">ì „ì²´</button>
                <button>ì˜¤ëŠ˜</button>
                <button>ì–´ì œ</button>
                <button>ì´ë²ˆì£¼</button>
                <button>ì´ì „</button>
              </div>

              {updateNoticeError && (
                <div className="notice-pro-error">
                  ê³µì§€ ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: {updateNoticeError}
                </div>
              )}

              <div className="notice-pro-list">
                {(updateNotices || []).length === 0 ? (
                  <div className="notice-pro-empty">ë“±ë¡ëœ ê³µì§€ê°€ ì—†ìŠµë‹ˆë‹¤.</div>
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
                          <span className={isRecentNotice(notice) ? "hot" : ""}>ì—…ë°ì´íŠ¸</span>
                        </div>
                        <h3>{notice.content}</h3>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="notice-pro-bottom">ë” ì´ìƒ ê³µì§€ê°€ ì—†ìŠµë‹ˆë‹¤.</div>
            </div>
          </section>
        )}

        {menuTab === "update_notices" && isAdmin && (
          <section className="notice-pro-wrap">
            <div className="notice-pro-left">
              <div className="notice-pro-head">
                <div>
                  <h2>{editingUpdateNoticeId ? "ê³µì§€ ìˆ˜ì •" : "ìƒˆ ê³µì§€ ë“±ë¡"}</h2>
                  <p>ì €ì¥í•˜ë©´ ëª¨ë“  ì‚¬ìš©ìì—ê²Œ ì¸í„°ë„·ìœ¼ë¡œ ê³µì§€ê°€ ê³µìœ ë©ë‹ˆë‹¤.</p>
                </div>
              </div>

              {updateNoticeError && (
                <div className="notice-pro-error notice-pro-manage-error">
                  ê³µì§€ ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: {updateNoticeError}
                </div>
              )}

              <div className="notice-form-grid">
                <Field label="ê³µì§€ ë‚ ì§œ">
                  <input
                    type="text"
                    placeholder="20260512 ë˜ëŠ” 260512"
                    value={updateNoticeForm.notice_date}
                    onChange={(e) => setUpdateNoticeForm({ ...updateNoticeForm, notice_date: formatInputDate(e.target.value) })}
                  />
                </Field>

                <Field label="ì—…ë°ì´íŠ¸ ë‚´ìš©">
                  <input
                    value={updateNoticeForm.content}
                    onChange={(e) => setUpdateNoticeForm({ ...updateNoticeForm, content: e.target.value })}
                    placeholder="ì˜ˆ: ì¹´ë“œì‚¬ìš© ì˜ìˆ˜ì¦ ì—¬ëŸ¬ ì¥ ì—…ë¡œë“œ ê¸°ëŠ¥ ì¶”ê°€"
                  />
                </Field>
              </div>

              <div className="actions right-actions">
                <button className="primary" disabled={isAuxiliarySaving("updateNotice")} onClick={() => runAuxiliarySave("updateNotice", saveUpdateNotice)}>
                  {isAuxiliarySaving("updateNotice") ? "ì €ì¥ ì¤‘..." : editingUpdateNoticeId ? "ìˆ˜ì • ì €ì¥" : "ê³µì§€ ë“±ë¡"}
                </button>
                <button
                  disabled={isAuxiliarySaving("updateNotice")}
                  onClick={() => {
                    setEditingUpdateNoticeId("");
                    setUpdateNoticeForm({ notice_date: getTodayKey(), content: "" });
                  }}
                >
                  ì´ˆê¸°í™”
                </button>
                <button onClick={() => setMenuTab("update_history")}>ê³µì§€ ëª©ë¡</button>
              </div>
            </div>

            <aside className="notice-pro-right">
              <div className="notice-pro-admin-head">
                <h2>ë“±ë¡ëœ ê³µì§€</h2>
                <button onClick={loadUpdateNotices}>ìƒˆë¡œê³ ì¹¨</button>
                <button onClick={cleanupDuplicateUpdateNotices}>ì¤‘ë³µì •ë¦¬</button>
              </div>

              <div className="notice-pro-table compact">
                <div className="notice-pro-table-head">
                  <span>ë‚ ì§œ</span>
                  <span>ì œëª©</span>
                  <span>ê´€ë¦¬</span>
                </div>

                {!updateNotices.length ? (
                  <div className="notice-pro-empty">ë“±ë¡ëœ ê³µì§€ê°€ ì—†ìŠµë‹ˆë‹¤.</div>
                ) : (
                  updateNotices.map((notice) => (
                    <div className="notice-pro-table-row" key={notice.id}>
                      <span>{notice.notice_date}</span>
                      <span>{notice.content}</span>
                      <span className="notice-pro-actions">
                        <button onClick={() => editUpdateNotice(notice)}>ìˆ˜ì •</button>
                        <button className="danger" onClick={() => deleteUpdateNotice(notice.id)}>ì‚­ì œ</button>
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
                <h2>í—ˆê°€/ê°±ì‹ ê´€ë¦¬</h2>
                <p>ë§Œë£Œì¼ê³¼ ê°±ì‹  ì—…ë¬´ë¥¼ í•œëˆˆì— ê´€ë¦¬í•©ë‹ˆë‹¤.</p>
              </div>
              <div className="permit-summary">
                <span>ì „ì²´ <b>{filteredPermits.length}</b></span>
                <span>30ì¼ ì´ë‚´ <b>{filteredPermits.filter((p: PermitRenewal) => {
                  const d = getDday(p.expiry_date);
                  return d !== null && d >= 0 && d <= 30;
                }).length}</b></span>
              </div>
              <div className="permit-company-tabs">
                <button
                  className={!permitSearch.company ? "active" : ""}
                  onClick={() => setPermitSearch({ ...permitSearch, company: "" })}
                >
                  ì „ì²´
                </button>
                <button
                  className={permitSearch.company === "íƒœëª…" ? "active" : ""}
                  onClick={() => setPermitSearch({ ...permitSearch, company: "íƒœëª…" })}
                >
                  íƒœëª…
                </button>
                <button
                  className={permitSearch.company === "ìœ ê°•" ? "active" : ""}
                  onClick={() => setPermitSearch({ ...permitSearch, company: "ìœ ê°•" })}
                >
                  ìœ ê°•
                </button>
              </div>

              <div className="actions">
                <label className="upload">
                  <Upload size={16} /> ì—‘ì…€ ì—…ë¡œë“œ
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await importPermitExcel(file);
                    }}
                  />
                </label>
                <button onClick={loadPermits}>ìƒˆë¡œê³ ì¹¨</button>
              </div>
            </div>

            <div className="grid5">
              <Field label="íšŒì‚¬/êµ¬ë¶„">
                <input
                  value={permitForm.company}
                  onChange={(e) => setPermitForm({ ...permitForm, company: e.target.value })}
                  placeholder="ì˜ˆ: íƒœëª…ì‚°ì—…ê°œë°œ"
                />
              </Field>
              <Field label="í—ˆê°€/ì‹ ê³ ëª…">
                <input
                  value={permitForm.title}
                  onChange={(e) => setPermitForm({ ...permitForm, title: e.target.value })}
                />
              </Field>
              <Field label="í—ˆê°€ê´€ì²­">
                <input
                  value={permitForm.agency}
                  onChange={(e) => setPermitForm({ ...permitForm, agency: e.target.value })}
                />
              </Field>
              <Field label="ë‹´ë‹¹/ì—°ë½ì²˜">
                <input
                  value={permitForm.contact}
                  onChange={(e) => setPermitForm({ ...permitForm, contact: e.target.value })}
                />
              </Field>
              <Field label="ë§Œë£Œì¼">
                <input
                  value={permitForm.expiry_date}
                  onChange={(e) => setPermitForm({ ...permitForm, expiry_date: formatInputDate(e.target.value) })}
                  placeholder="20260512 ë˜ëŠ” 260512"
                />
              </Field>
            </div>

            <div className="grid3">
              <Field label="í™•ì¸ì‚¬í•­">
                <input
                  value={permitForm.check_note}
                  onChange={(e) => setPermitForm({ ...permitForm, check_note: e.target.value })}
                />
              </Field>
              <Field label="ì£¼ê¸°">
                <input
                  value={permitForm.cycle}
                  onChange={(e) => setPermitForm({ ...permitForm, cycle: e.target.value })}
                />
              </Field>
              <Field label="ìƒíƒœ">
                <select
                  value={permitForm.status}
                  onChange={(e) => setPermitForm({ ...permitForm, status: e.target.value })}
                >
                  <option value="ì§„í–‰">ì§„í–‰</option>
                  <option value="ì™„ë£Œ">ì™„ë£Œ</option>
                  <option value="ë³´ë¥˜">ë³´ë¥˜</option>
                </select>
              </Field>
            </div>

            <Field label="ë¹„ê³ ">
              <input
                value={permitForm.memo}
                onChange={(e) => setPermitForm({ ...permitForm, memo: e.target.value })}
              />
            </Field>

            <div className="actions right-actions">
              <button className="primary" disabled={isAuxiliarySaving("permit")} onClick={() => runAuxiliarySave("permit", savePermit)}>
                {isAuxiliarySaving("permit") ? "ì €ì¥ ì¤‘..." : editingPermitId ? "ìˆ˜ì • ì €ì¥" : "í—ˆê°€ ë“±ë¡"}
              </button>
              <button disabled={isAuxiliarySaving("permit")} onClick={resetPermitForm}>ì´ˆê¸°í™”</button>
            </div>

            <div className="grid3">
              <Field label="íšŒì‚¬ ê²€ìƒ‰">
                <input value={permitSearch.company} onChange={(e) => setPermitSearch({ ...permitSearch, company: e.target.value })} />
              </Field>
              <Field label="í‚¤ì›Œë“œ ê²€ìƒ‰">
                <input value={permitSearch.keyword} onChange={(e) => setPermitSearch({ ...permitSearch, keyword: e.target.value })} />
              </Field>
              <Field label="ìƒíƒœ ê²€ìƒ‰">
                <select value={permitSearch.status} onChange={(e) => setPermitSearch({ ...permitSearch, status: e.target.value })}>
                  <option value="">ì „ì²´</option>
                  <option value="ì§„í–‰">ì§„í–‰</option>
                  <option value="ì™„ë£Œ">ì™„ë£Œ</option>
                  <option value="ë³´ë¥˜">ë³´ë¥˜</option>
                </select>
              </Field>
            </div>

            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th>íšŒì‚¬</th>
                    <th>í—ˆê°€/ì‹ ê³ ëª…</th>
                    <th>í—ˆê°€ê´€ì²­</th>
                    <th>ë‹´ë‹¹/ì—°ë½ì²˜</th>
                    <th>ë§Œë£Œì¼</th>
                    <th>D-day</th>
                    <th>ìƒíƒœ</th>
                    <th>ê´€ë¦¬</th>
                  </tr>
                </thead>
                <tbody>
                  {!filteredPermits.length ? (
                    <tr><td colSpan={8} className="empty">ë“±ë¡ëœ í—ˆê°€/ê°±ì‹  ì—…ë¬´ê°€ ì—†ìŠµë‹ˆë‹¤.</td></tr>
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
                          <td>{permit.status || "ì§„í–‰"}</td>
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
                <div className="empty">ë“±ë¡ëœ í—ˆê°€/ê°±ì‹  ì—…ë¬´ê°€ ì—†ìŠµë‹ˆë‹¤.</div>
              ) : (
                filteredPermits.map((permit: PermitRenewal) => {
                  const dday = getDday(permit.expiry_date) ?? 999999;
                  const ddayText = permit.expiry_date ? (dday >= 0 ? `D-${dday}` : `D+${Math.abs(dday)}`) : "ë¯¸ì •";
                  const ddayClass = dday <= 7 ? "danger" : dday <= 30 ? "warn" : "";

                  return (
                    <div className="permit-card" key={permit.id}>
                      <div className="permit-card-main">
                        <div className="permit-title-area">
                          <span className="permit-company">{permit.company || "íšŒì‚¬ ë¯¸ì…ë ¥"}</span>
                          <b>{permit.title || "í—ˆê°€/ì‹ ê³ ëª… ë¯¸ì…ë ¥"}</b>
                          <p>{permit.agency || "í—ˆê°€ê´€ì²­ ë¯¸ì…ë ¥"}</p>
                        </div>

                        <div className="permit-dday-box">
                          <span className={ddayClass}>{ddayText}</span>
                          <small>{permit.expiry_date || "ë§Œë£Œì¼ ì—†ìŒ"}</small>
                        </div>
                      </div>

                      <div className="permit-info-grid">
                        <div>
                          <label>ë‹´ë‹¹/ì—°ë½ì²˜</label>
                          <p>{permit.contact || "-"}</p>
                        </div>
                        <div>
                          <label>í™•ì¸ì‚¬í•­</label>
                          <p>{permit.check_note || "-"}</p>
                        </div>
                        <div>
                          <label>ì£¼ê¸°</label>
                          <p>{permit.cycle || "-"}</p>
                        </div>
                        <div>
                          <label>ìƒíƒœ</label>
                          <p>{permit.status || "ì§„í–‰"}</p>
                        </div>
                      </div>

                      {permit.memo && <div className="permit-memo">{permit.memo}</div>}

                      <div className="permit-card-actions">
                        <button onClick={() => editPermit(permit)}>ìˆ˜ì •</button>
                        <button className="danger-btn" onClick={() => deletePermit(permit.id)}>ì‚­ì œ</button>
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
              <div className="receipt-clean-icon maint">ğŸ› ï¸</div>
              <div>
                <h2>ì •ë¹„ì‚¬ì§„ë“±ë¡</h2>
                <p>í˜„ì¥ ì§ì›ì€ ì •ë¹„ ì‚¬ì§„ê³¼ ë‚´ìš©ì„ ë“±ë¡í•˜ê³ , ê´€ë¦¬ìëŠ” í™•ì¸ í›„ ì •ë¹„ë“±ë¡ì— ë°˜ì˜í•©ë‹ˆë‹¤.</p>
              </div>
              <button className="receipt-refresh-btn" onClick={loadMaintenancePhotos}>ìƒˆë¡œê³ ì¹¨</button>
            </div>

            <div className="receipt-clean-form-wrap">
              <div className="receipt-clean-form-card">
                <div className="receipt-card-section-title">ì •ë¹„ ì •ë³´</div>

                <div className="receipt-clean-grid">
                  <Field label="ì¼ì">
                    <div className="date-input-wrap">
                      <input
                        className="date-text-input"
                        value={maintenancePhotoForm.maint_date}
                        onChange={(e) => setMaintenancePhotoForm({ ...maintenancePhotoForm, maint_date: formatInputDate(e.target.value) })}
                        placeholder="20260513 ë˜ëŠ” 260513"
                      />
                      <input
                        className="date-picker-input"
                        type="date"
                        value={maintenancePhotoForm.maint_date}
                        onChange={(e) => setMaintenancePhotoForm({ ...maintenancePhotoForm, maint_date: e.target.value })}
                        aria-label="ì •ë¹„ì¼ì ì„ íƒ"
                      />
                      <span className="date-picker-icon">ğŸ“…</span>
                    </div>
                  </Field>

                  <Field label="ì„¤ë¹„ëª…">
                    <SearchSelect
                      value={maintenancePhotoForm.equipment_name}
                      options={warehouseNames}
                      onChange={(value) => setMaintenancePhotoForm({ ...maintenancePhotoForm, equipment_name: value })}
                      placeholder="ì„¤ë¹„/ì°½ê³  ê²€ìƒ‰ ë˜ëŠ” ì…ë ¥"
                    />
                  </Field>
                </div>

                <Field label="ì •ë¹„ë‚´ìš©">
                  <textarea
                    className="receipt-clean-textarea"
                    value={maintenancePhotoForm.memo}
                    onChange={(e) => setMaintenancePhotoForm({ ...maintenancePhotoForm, memo: e.target.value })}
                    placeholder="ì˜ˆ: 2470 ìŠ¤í¬ë¦° ìŠ¤í”„ë§ êµì²´ / ì»¨ë² ì´ì–´ ë²¨íŠ¸ ì°¢ì–´ì§ / ë¡œë” ì˜¤ì¼ ëˆ„ìœ "
                    rows={5}
                  />
                </Field>

                <label className="maintenance-urgent-check">
                  <input
                    type="checkbox"
                    checked={maintenancePhotoForm.is_urgent}
                    onChange={(e) => setMaintenancePhotoForm({ ...maintenancePhotoForm, is_urgent: e.target.checked })}
                  />
                  ê¸´ê¸‰ ì •ë¹„ë¡œ í‘œì‹œ
                </label>


              </div>

              <div className="receipt-clean-upload-card">
                <div className="receipt-card-section-title">ì •ë¹„ ì‚¬ì§„/PDF/ìŒì„± ì²¨ë¶€</div>

                <label className="receipt-dropzone maintenance-dropzone">
                  <input
                    type="file"
                    accept="image/*,application/pdf,audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac"
                    multiple
                    onChange={(e) => {
                      const input = e.currentTarget;
                      const files = validateAttachmentFiles(e.target.files || []);
                      maintenanceUploadPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
                      if (!files) {
                        input.value = "";
                        setMaintenancePhotoFiles([]);
                        setMaintenanceUploadPreviewUrls([]);
                        return;
                      }
                      setMaintenancePhotoFiles(files);
                      setMaintenanceUploadPreviewUrls(
                        files.filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f))
                      );
                    }}
                  />
                  <div className="receipt-drop-icon">â¬†</div>
                  <strong>ì •ë¹„ ì‚¬ì§„/PDF/ìŒì„±ì„ ì„ íƒí•˜ì„¸ìš”</strong>
                  <span>ì‚¬ì§„ 20MB Â· PDF 30MB Â· ìŒì„± 50MB ì´í•˜</span>
                </label>

                <div className="receipt-file-count">
                  {maintenancePhotoFiles.length
                    ? `${maintenancePhotoFiles.length}ê°œ Â· ${formatUploadSize(maintenancePhotoFiles.reduce((sum, file) => sum + file.size, 0))}`
                    : "ì„ íƒëœ ì²¨ë¶€íŒŒì¼ ì—†ìŒ"}
                </div>

                {!!maintenanceUploadPreviewUrls.length && (
                  <div className="upload-preview-grid">
                    {maintenanceUploadPreviewUrls.map((url: string, idx: number) => (
                      <button
                        type="button"
                        key={`${url}-${idx}`}
                        className="upload-preview-thumb"
                        onClick={() => openPhotoViewer(maintenanceUploadPreviewUrls, idx, "ì •ë¹„ì‚¬ì§„ ë¯¸ë¦¬ë³´ê¸°")}
                      >
                        <img src={url} alt={`ì •ë¹„ì‚¬ì§„ ë¯¸ë¦¬ë³´ê¸° ${idx + 1}`} />
                      </button>
                    ))}
                  </div>
                )}

                {!!maintenancePhotoFiles.filter((file) => file.type === "application/pdf").length && (
                  <div className="upload-pdf-list">
                    {maintenancePhotoFiles.filter((file) => file.type === "application/pdf").map((file, idx) => {
                      const url = URL.createObjectURL(file);
                      return (
                        <button
                          type="button"
                          key={`${file.name}-${idx}`}
                          className="upload-pdf-chip"
                          onClick={() => openPdfViewer(url, file.name || "ì •ë¹„ PDF")}
                        >
                          <span>PDF</span>
                          <b>{file.name || `ì •ë¹„ PDF ${idx + 1}`}</b>
                          <em>ë³´ê¸°</em>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  className="receipt-submit-clean maintenance-submit upload-bottom-submit"
                  onClick={saveMaintenancePhoto}
                  disabled={maintenancePhotoSaving}
                >
                  {maintenancePhotoSaving ? "ì €ì¥ ì¤‘..." : "ì •ë¹„ì‚¬ì§„ ë“±ë¡"}
                </button>
              </div>
            </div>

            <div className="receipt-list-head">
              <div>
                <h3>ë“±ë¡ëœ ì •ë¹„ì‚¬ì§„</h3>
                <p>ë¯¸ì²˜ë¦¬ {maintenancePhotos.filter((item) => !item.is_processed).length}ê±´ Â· ì²˜ë¦¬ì™„ë£Œ {maintenancePhotos.filter((item) => item.is_processed).length}ê±´</p>
              </div>
            </div>

            <div className="receipt-clean-list">
              {!maintenancePhotos.length ? (
                <div className="receipt-clean-empty">ë“±ë¡ëœ ì •ë¹„ì‚¬ì§„ì´ ì—†ìŠµë‹ˆë‹¤.</div>
              ) : (
                maintenancePhotos.map((item) => (
                  <div className={item.is_processed ? "receipt-clean-card processed" : "receipt-clean-card pending"} key={item.id}>
                    <div className="receipt-clean-card-top">
                      <span className={item.is_processed ? "receipt-badge processed" : "receipt-badge pending"}>
                        {item.is_processed ? "ì²˜ë¦¬ì™„ë£Œ" : "ë¯¸ì²˜ë¦¬"}
                      </span>
                      <small>{item.maint_date}</small>
                    </div>

                    <strong className="receipt-vendor-name">{item.equipment_name}</strong>
                    <p className="receipt-created-by">{item.created_by || "ë“±ë¡ì ë¯¸ì…ë ¥"}</p>
                    {item.is_urgent && <div className="maintenance-urgent-badge">ê¸´ê¸‰</div>}

                    {item.memo && <div className="receipt-clean-memo">{item.memo}</div>}

                    <div className="receipt-clean-thumbs">
                      {(item.image_urls || []).filter((url) => isImageUrl(url)).slice(0, 3).map((url, idx) => (
                        <img key={`${item.id}-${idx}`} src={url} alt="ì •ë¹„ì‚¬ì§„" onClick={() => openPhotoViewer((item.image_urls || []).filter((x) => isImageUrl(x)), idx, `${item.equipment_name || "ì •ë¹„ì‚¬ì§„"}`)} />
                      ))}
                      {(item.image_urls || []).filter((url) => isPdfUrl(url)).slice(0, 2).map((url, idx) => (
                        <button key={`${item.id}-pdf-${idx}`} className="receipt-pdf-thumb" onClick={() => openPdfViewer(url, `${item.equipment_name || "ì •ë¹„"} PDF`)}>
                          <span>PDF</span>
                        </button>
                      ))}
                      {!(item.image_urls || []).length && <div className="receipt-no-thumb">ì²¨ë¶€ ì—†ìŒ</div>}
                      {(item.image_urls || []).length > 3 && <div className="receipt-more-thumb">+{(item.image_urls || []).length - 3}</div>}
                    </div>

                                        <div className="receipt-clean-actions">
                      <button onClick={() => setMaintenancePhotoPreviewOpen(item)}>ì‚¬ì§„ë³´ê¸°</button>
                      {isAdmin && <button className="link" onClick={() => applyMaintenancePhotoToMaint(item)}>ì •ë¹„ë“±ë¡ ë°˜ì˜</button>}
                      {isAdmin && <button className="link secondary" onClick={() => openMaintRecordPickerFromMaintenancePhoto(item)}>ê¸°ì¡´ì •ë¹„ ì—°ê²°</button>}
                      <button className="complete" onClick={() => toggleMaintenancePhotoProcessed(item)}>
                        {item.is_processed ? "ë¯¸ì²˜ë¦¬ë¡œ ë³€ê²½" : "ì²˜ë¦¬ì™„ë£Œ"}
                      </button>
                      {isAdmin && <button className="delete" onClick={() => deleteMaintenancePhoto(item.id)}>ì‚­ì œ</button>}
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
                <button onClick={() => setMaintenancePhotoPreviewOpen(null)}>ë‹«ê¸°</button>
              </div>

              {(maintenancePhotoPreviewOpen.image_urls || []).length ? (
                <div className="receipt-photo-preview-images">
                  {(maintenancePhotoPreviewOpen.image_urls || []).map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="ì •ë¹„ì‚¬ì§„ í™•ëŒ€" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="receipt-photo-no-image">ë“±ë¡ëœ ì‚¬ì§„ì´ ì—†ìŠµë‹ˆë‹¤.</div>
              )}
            </div>
          </div>
        )}


        {menuTab === "receipt_photos" && (
          <section className="card receipt-photo-page receipt-photo-page-clean">
            <div className="receipt-clean-title">
              <div className="receipt-clean-icon">ğŸ“·</div>
              <div>
                <h2>ì…ê³ ì‚¬ì§„ë“±ë¡</h2>
                <p>ì§ì›ì€ ìì¬ ì…ê³  ì‚¬ì§„ê³¼ ë‚´ìš©ì„ ë“±ë¡í•˜ê³ , ê´€ë¦¬ìëŠ” í™•ì¸ í›„ ì²˜ë¦¬ì™„ë£Œë¡œ ë³€ê²½í•©ë‹ˆë‹¤.</p>
              </div>
              <button className="receipt-refresh-btn" onClick={loadReceiptPhotos}>ìƒˆë¡œê³ ì¹¨</button>
            </div>

            <div className="receipt-clean-form-wrap">
              <div className="receipt-clean-form-card">
                <div className="receipt-card-section-title">ì…ê³  ì •ë³´</div>

                <div className="receipt-clean-grid">
                  <Field label="ì¼ì">
                    <div className="date-input-wrap">
                      <input
                        className="date-text-input"
                        value={receiptPhotoForm.receipt_date}
                        onChange={(e) => setReceiptPhotoForm({ ...receiptPhotoForm, receipt_date: formatInputDate(e.target.value) })}
                        placeholder="20260513 ë˜ëŠ” 260513"
                      />
                      <input
                        className="date-picker-input"
                        type="date"
                        value={receiptPhotoForm.receipt_date}
                        onChange={(e) => setReceiptPhotoForm({ ...receiptPhotoForm, receipt_date: e.target.value })}
                        aria-label="ì…ê³ ì¼ì ì„ íƒ"
                      />
                      <span className="date-picker-icon">ğŸ“…</span>
                    </div>
                  </Field>

                  <Field label="ê±°ë˜ì²˜">
                    <SearchSelect
                      value={receiptPhotoForm.vendor_name}
                      options={vendorOptions}
                      onChange={(value) => setReceiptPhotoForm({ ...receiptPhotoForm, vendor_name: value })}
                      placeholder="ê±°ë˜ì²˜ ê²€ìƒ‰ ë˜ëŠ” ì…ë ¥"
                    />
                  </Field>
                </div>

                <Field label="ë‚´ìš©">
                  <textarea
                    className="receipt-clean-textarea"
                    value={receiptPhotoForm.memo}
                    onChange={(e) => setReceiptPhotoForm({ ...receiptPhotoForm, memo: e.target.value })}
                    placeholder="ì˜ˆ: ë² ì–´ë§ ì…ê³  / ë¡œë” ë¶€í’ˆ ë„ì°© / ë‚©í’ˆì‚¬ì§„"
                    rows={5}
                  />
                </Field>


              </div>

              <div className="receipt-clean-upload-card">
                <div className="receipt-card-section-title">ì‚¬ì§„/PDF/ìŒì„± ì²¨ë¶€</div>

                <label className="receipt-dropzone">
                  <input
                    type="file"
                    accept="image/*,application/pdf,audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac"
                    multiple
                    onChange={(e) => {
                      const input = e.currentTarget;
                      const files = validateAttachmentFiles(e.target.files || []);
                      receiptUploadPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
                      if (!files) {
                        input.value = "";
                        setReceiptPhotoFiles([]);
                        setReceiptUploadPreviewUrls([]);
                        return;
                      }
                      setReceiptPhotoFiles(files);
                      setReceiptUploadPreviewUrls(
                        files.filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f))
                      );
                    }}
                  />
                  <div className="receipt-drop-icon">â¬†</div>
                  <strong>ì‚¬ì§„/PDF/ìŒì„±ì„ ì„ íƒí•˜ì„¸ìš”</strong>
                  <span>ì‚¬ì§„ 20MB Â· PDF 30MB Â· ìŒì„± 50MB ì´í•˜</span>
                </label>

                <div className="receipt-file-count">
                  {receiptPhotoFiles.length
                    ? `${receiptPhotoFiles.length}ê°œ Â· ${formatUploadSize(receiptPhotoFiles.reduce((sum, file) => sum + file.size, 0))}`
                    : "ì„ íƒëœ ì²¨ë¶€íŒŒì¼ ì—†ìŒ"}
                </div>

                {!!receiptUploadPreviewUrls.length && (
                  <div className="upload-preview-grid">
                    {receiptUploadPreviewUrls.map((url: string, idx: number) => (
                      <button
                        type="button"
                        key={`${url}-${idx}`}
                        className="upload-preview-thumb"
                        onClick={() => openPhotoViewer(receiptUploadPreviewUrls, idx, "ì…ê³ ì‚¬ì§„ ë¯¸ë¦¬ë³´ê¸°")}
                      >
                        <img src={url} alt={`ì…ê³ ì‚¬ì§„ ë¯¸ë¦¬ë³´ê¸° ${idx + 1}`} />
                      </button>
                    ))}
                  </div>
                )}

                {!!receiptPhotoFiles.filter((file) => file.type === "application/pdf").length && (
                  <div className="upload-pdf-list">
                    {receiptPhotoFiles.filter((file) => file.type === "application/pdf").map((file, idx) => {
                      const url = URL.createObjectURL(file);
                      return (
                        <button
                          type="button"
                          key={`${file.name}-${idx}`}
                          className="upload-pdf-chip"
                          onClick={() => openPdfViewer(url, file.name || "ì…ê³  PDF")}
                        >
                          <span>PDF</span>
                          <b>{file.name || `ì…ê³  PDF ${idx + 1}`}</b>
                          <em>ë³´ê¸°</em>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  className="receipt-submit-clean upload-bottom-submit"
                  onClick={saveReceiptPhoto}
                  disabled={receiptPhotoSaving}
                >
                  {receiptPhotoSaving ? "ì €ì¥ ì¤‘..." : "ì…ê³ ì‚¬ì§„ ë“±ë¡"}
                </button>
              </div>
            </div>

            <div className="receipt-list-head">
              <div>
                <h3>ë“±ë¡ëœ ì…ê³ ì‚¬ì§„</h3>
                <p>ë¯¸ì²˜ë¦¬ {receiptPhotos.filter((item) => !item.is_processed).length}ê±´ Â· ì²˜ë¦¬ì™„ë£Œ {receiptPhotos.filter((item) => item.is_processed).length}ê±´</p>
              </div>
            </div>

            <div className="receipt-clean-list">
              {!receiptPhotos.length ? (
                <div className="receipt-clean-empty">ë“±ë¡ëœ ì…ê³ ì‚¬ì§„ì´ ì—†ìŠµë‹ˆë‹¤.</div>
              ) : (
                receiptPhotos.map((item) => (
                  <div className={item.is_processed ? "receipt-clean-card processed" : "receipt-clean-card pending"} key={item.id}>
                    <div className="receipt-clean-card-top">
                      <span className={item.is_processed ? "receipt-badge processed" : "receipt-badge pending"}>
                        {item.is_processed ? "ì²˜ë¦¬ì™„ë£Œ" : "ë¯¸ì²˜ë¦¬"}
                      </span>
                      <small>{item.receipt_date}</small>
                    </div>

                    <strong className="receipt-vendor-name">{item.vendor_name}</strong>
                    <p className="receipt-created-by">{item.created_by || "ë“±ë¡ì ë¯¸ì…ë ¥"}</p>

                    {item.memo && <div className="receipt-clean-memo">{item.memo}</div>}

                    <div className="receipt-clean-thumbs">
                      {(item.image_urls || []).filter((url) => isImageUrl(url)).slice(0, 3).map((url, idx) => (
                        <img key={`${item.id}-${idx}`} src={url} alt="ì…ê³ ì‚¬ì§„" onClick={() => openPhotoViewer((item.image_urls || []).filter((x) => isImageUrl(x)), idx, `${item.vendor_name || "ì…ê³ ì‚¬ì§„"}`)} />
                      ))}
                      {(item.image_urls || []).filter((url) => isPdfUrl(url)).slice(0, 2).map((url, idx) => (
                        <button key={`${item.id}-pdf-${idx}`} className="receipt-pdf-thumb" onClick={() => openPdfViewer(url, `${item.vendor_name || "ì…ê³ "} PDF`)}>
                          <span>PDF</span>
                        </button>
                      ))}
                      {!(item.image_urls || []).length && <div className="receipt-no-thumb">ì²¨ë¶€ ì—†ìŒ</div>}
                      {(item.image_urls || []).length > 3 && <div className="receipt-more-thumb">+{(item.image_urls || []).length - 3}</div>}
                    </div>

                                        <div className="receipt-clean-actions">
                      <button onClick={() => setReceiptPhotoPreviewOpen(item)}>ì‚¬ì§„ë³´ê¸°</button>
                      {isAdmin && <button className="link" onClick={() => applyReceiptPhotoToPurchase(item)}>êµ¬ë§¤ì…ë ¥ ë°˜ì˜</button>}
                      {isAdmin && <button className="link secondary" onClick={() => openPurchaseRecordPickerFromReceiptPhoto(item)}>ê¸°ì¡´êµ¬ë§¤ ì—°ê²°</button>}
                      <button className="complete" onClick={() => toggleReceiptPhotoProcessed(item)}>
                        {item.is_processed ? "ë¯¸ì²˜ë¦¬ë¡œ ë³€ê²½" : "ì²˜ë¦¬ì™„ë£Œ"}
                      </button>
                      {isAdmin && <button className="delete" onClick={() => deleteReceiptPhoto(item.id)}>ì‚­ì œ</button>}
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
                <button onClick={() => setReceiptPhotoPreviewOpen(null)}>ë‹«ê¸°</button>
              </div>

              {(receiptPhotoPreviewOpen.image_urls || []).length ? (
                <div className="receipt-photo-preview-images">
                  {(receiptPhotoPreviewOpen.image_urls || []).map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="ì…ê³ ì‚¬ì§„ í™•ëŒ€" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="receipt-photo-no-image">
                  ë“±ë¡ëœ ì‚¬ì§„ì´ ì—†ìŠµë‹ˆë‹¤.
                </div>
              )}
            </div>
          </div>
        )}


        {menuTab === "vendor_accounts" && (
          <section className="card vendor-account-page">
            <div className="vendor-account-head">
              <div>
                <h2>ì—…ì²´ê³„ì¢Œê´€ë¦¬</h2>
                <p>ê±°ë˜ì²˜ ê³„ì¢Œ ë° ê³ ê°ê´€ë¦¬ì„±ëª…ì„ ì˜êµ¬ ì €ì¥í•©ë‹ˆë‹¤.</p>
              </div>

              <div className="actions">
                <label className="upload">
                  <Upload size={16} /> ê³„ì¢Œ ì—‘ì…€ ì—…ë¡œë“œ
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await importVendorAccountsExcel(file);
                    }}
                  />
                </label>

                <button onClick={loadVendorAccounts}>ìƒˆë¡œê³ ì¹¨</button>
              </div>
            </div>

            <div className="vendor-account-add-card">
              <div className="vendor-account-add-head">
                <div>
                  <h3>ì‹ ê·œ ê³„ì¢Œ ì§ì ‘ ì¶”ê°€</h3>
                  <p>ì—‘ì…€ ì—†ì´ ê±°ë˜ì²˜ ê³„ì¢Œë¥¼ ë°”ë¡œ ë“±ë¡í•©ë‹ˆë‹¤.</p>
                </div>
                <button onClick={resetNewVendorAccountForm}>ì´ˆê¸°í™”</button>
              </div>

              <div className="vendor-account-grid">
                <Field label="ê±°ë˜ì²˜ëª…">
                  <input
                    value={newVendorAccountForm.vendor_name}
                    onChange={(e) => setNewVendorAccountForm((prev) => ({ ...prev, vendor_name: e.target.value }))}
                    placeholder="ì˜ˆ: ì¶œì¥ë¹µêµ¬ì •ë¹„"
                  />
                </Field>

                <Field label="ì€í–‰ëª…">
                  <input
                    value={newVendorAccountForm.bank_name}
                    onChange={(e) =>
                      setNewVendorAccountForm((prev) => ({
                        ...prev,
                        bank_name: e.target.value,
                        bank_code: prev.bank_code || bankCodeByName(e.target.value),
                      }))
                    }
                    placeholder="ì˜ˆ: ë†í˜‘"
                  />
                </Field>

                <Field label="ì€í–‰ì½”ë“œ">
                  <input
                    value={newVendorAccountForm.bank_code}
                    onChange={(e) => setNewVendorAccountForm((prev) => ({ ...prev, bank_code: e.target.value }))}
                    placeholder="ì˜ˆ: 11"
                  />
                </Field>

                <Field label="ì˜ˆê¸ˆì£¼">
                  <input
                    value={newVendorAccountForm.account_name}
                    onChange={(e) =>
                      setNewVendorAccountForm((prev) => ({
                        ...prev,
                        account_name: e.target.value,
                        customer_display_name: prev.customer_display_name || e.target.value,
                      }))
                    }
                    placeholder="ì˜ˆê¸ˆì£¼"
                  />
                </Field>

                <Field label="ê³ ê°ê´€ë¦¬ì„±ëª…">
                  <input
                    value={newVendorAccountForm.customer_display_name}
                    onChange={(e) => setNewVendorAccountForm((prev) => ({ ...prev, customer_display_name: e.target.value }))}
                    placeholder="ëŒ€ëŸ‰ì´ì²´ í‘œì‹œëª…"
                  />
                </Field>

                <Field label="ê³„ì¢Œë²ˆí˜¸">
                  <input
                    value={newVendorAccountForm.account_number}
                    onChange={(e) => setNewVendorAccountForm((prev) => ({ ...prev, account_number: e.target.value }))}
                    placeholder="ìˆ«ì ë˜ëŠ” í•˜ì´í”ˆ ì…ë ¥"
                  />
                </Field>

                <Field label="ë©”ëª¨">
                  <input
                    value={newVendorAccountForm.memo}
                    onChange={(e) => setNewVendorAccountForm((prev) => ({ ...prev, memo: e.target.value }))}
                    placeholder="ì„ íƒ"
                  />
                </Field>
              </div>

              <div className="vendor-account-bottom">
                <button className="primary" disabled={isAuxiliarySaving("vendorAccount")} onClick={() => runAuxiliarySave("vendorAccount", saveNewVendorAccount)}>
                  {isAuxiliarySaving("vendorAccount") ? "ì €ì¥ ì¤‘..." : "ê³„ì¢Œ ì¶”ê°€"}
                </button>
              </div>
            </div>

            <div className="vendor-account-list">
              {!vendorAccounts.length ? (
                <div className="empty">ë“±ë¡ëœ ê±°ë˜ì²˜ ê³„ì¢Œê°€ ì—†ìŠµë‹ˆë‹¤.</div>
              ) : (
                vendorAccounts.map((account) => (
                  <div className="vendor-account-card" key={account.id}>
                    <div className="vendor-account-title">
                      <strong>{account.vendor_name}</strong>
                    </div>

                    <div className="vendor-account-grid">
                      <Field label="ì€í–‰ëª…">
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

                      <Field label="ì€í–‰ì½”ë“œ">
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

                      <Field label="ì˜ˆê¸ˆì£¼">
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

                      <Field label="ê³ ê°ê´€ë¦¬ì„±ëª…">
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

                      <Field label="ê³„ì¢Œë²ˆí˜¸">
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
                        disabled={isAuxiliarySaving(`vendorAccount:${account.id}`)}
                        onClick={() => runAuxiliarySave(`vendorAccount:${account.id}`, async () => {
                          const { error } = await supabase
                            .from("vendor_accounts")
                            .upsert(account, { onConflict: "id" });

                          if (error) {
                            alert(`ì €ì¥ ì‹¤íŒ¨: ${error.message}`);
                            return;
                          }

                          showToast("ê±°ë˜ì²˜ ê³„ì¢Œë¥¼ ì €ì¥í–ˆìŠµë‹ˆë‹¤.");
                          await loadVendorAccounts();
                        })}
                      >
                        {isAuxiliarySaving(`vendorAccount:${account.id}`) ? "ì €ì¥ ì¤‘..." : "ì €ì¥"}
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
                <h2>ëŒ€ëŸ‰ì´ì²´ ìƒì„±</h2>
                <p>êµ¬ë§¤ë‚´ì—­ì„ ê±°ë˜ì²˜ë³„ë¡œ í•©ì‚°í•˜ê³  ê³„ì¢Œì •ë³´ë¥¼ ë§¤ì¹­í•´ ì€í–‰ ì—…ë¡œë“œìš© ì—‘ì…€ì„ ë§Œë“­ë‹ˆë‹¤.</p>
              </div>
              <div className="actions">
                <label className="upload">
                  <Upload size={16} /> ì—…ì²´ ê³„ì¢Œ ì—…ë¡œë“œ
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await importVendorAccountsExcel(file);
                    }}
                  />
                </label>
                <button onClick={loadVendorAccounts}>ê³„ì¢Œ ìƒˆë¡œê³ ì¹¨</button>
                <button className="primary" onClick={openBulkTransferDownloadPopup}>ëŒ€ëŸ‰ì´ì²´ ì—‘ì…€ ë‹¤ìš´ë¡œë“œ</button>
              </div>
            </div>

            <div className="bulk-transfer-filter">
              <Field label="ì§€ê¸‰ì›”">
                <input
                  value={transferMonth}
                  onChange={(e) => setTransferMonth(e.target.value)}
                  placeholder="2026-04"
                />
              </Field>
              <Field label="ì°½ê³ ">
                <div className="bulk-warehouse-multiselect">
                  <button
                    type="button"
                    className="bulk-warehouse-toggle"
                    onClick={() => setTransferWarehouseDropdownOpen((open) => !open)}
                  >
                    <span>{transferWarehouseLabel}</span>
                    <b>â–¾</b>
                  </button>
                  {transferWarehouseDropdownOpen && (
                    <div className="bulk-warehouse-dropdown">
                      <div className="bulk-warehouse-actions">
                        <button type="button" onClick={() => setSelectedTransferWarehouses(transferWarehouseOptions)}>ì „ì²´ì„ íƒ</button>
                        <button type="button" onClick={() => setSelectedTransferWarehouses([])}>ì „ì²´í•´ì œ</button>
                      </div>
                      <input
                        className="bulk-warehouse-search"
                        value={transferWarehouseSearch}
                        onChange={(e) => setTransferWarehouseSearch(e.target.value)}
                        placeholder="ì°½ê³  ê²€ìƒ‰"
                      />
                      <div className="bulk-warehouse-list">
                        {!filteredTransferWarehouseOptions.length ? (
                          <div className="dropdown-empty">ê²€ìƒ‰ ê²°ê³¼ ì—†ìŒ</div>
                        ) : (
                          filteredTransferWarehouseOptions.map((warehouseName) => (
                            <label key={warehouseName} className="bulk-warehouse-option">
                              <input
                                type="checkbox"
                                checked={selectedTransferWarehouses.includes(warehouseName)}
                                onChange={() => toggleTransferWarehouse(warehouseName)}
                              />
                              <span>{warehouseName}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Field>
              <Field label="ê±°ë˜ì²˜ ê²€ìƒ‰">
                <input
                  value={transferVendorSearch}
                  onChange={(e) => setTransferVendorSearch(e.target.value)}
                  placeholder="ê±°ë˜ì²˜ëª…"
                />
              </Field>
              <div className="bulk-summary">
                <span>ëŒ€ìƒ ê±°ë˜ì²˜ <b>{bulkTransferRows.length}</b></span>
                <span>ê³„ì¢Œ ë¯¸ë§¤ì¹­ <b>{bulkTransferRows.filter((r) => !r.matched).length}</b></span>
                <span>í•©ê³„ <b>{money(bulkTransferRows.reduce((sum, r) => sum + r.amount, 0))}</b></span>
              </div>
            </div>

            <div className="bulk-transfer-list">
              {!bulkTransferRows.length ? (
                <div className="empty">ëŒ€ëŸ‰ì´ì²´ë¡œ ë§Œë“¤ êµ¬ë§¤ë‚´ì—­ì´ ì—†ìŠµë‹ˆë‹¤.</div>
              ) : (
                bulkTransferRows.map((row) => (
                  <div className={row.matched ? "bulk-transfer-card" : "bulk-transfer-card missing"} key={row.id}>
                    <div className="bulk-card-main">
                      <div>
                        <span className={row.matched ? "bulk-status ok" : "bulk-status missing"}>{row.matched ? "ê³„ì¢Œë§¤ì¹­" : "ê³„ì¢Œí™•ì¸í•„ìš”"}</span>
                        <b>{row.vendor}</b>
                      </div>
                      <strong>{money(row.amount)}ì›</strong>
                    </div>

                    <div className="bulk-edit-grid">
                      <Field label="ì…ê¸ˆì€í–‰">
                        <input value={row.bank_code} onChange={(e) => updateBulkTransferEdit(row.id, "bank_code", e.target.value)} />
                      </Field>
                      <Field label="ì…ê¸ˆê³„ì¢Œ">
                        <input value={row.account_number} onChange={(e) => updateBulkTransferEdit(row.id, "account_number", e.target.value)} />
                      </Field>
                      <Field label="ì…ê¸ˆì•¡">
                        <input value={String(row.amount || "")} onChange={(e) => updateBulkTransferEdit(row.id, "amount", e.target.value)} />
                      </Field>
                      <Field label="ê³ ê°ê´€ë¦¬ì„±ëª…">
                        <input value={row.customer_display_name || row.account_name || row.vendor} onChange={(e) => updateBulkTransferEdit(row.id, "customer_display_name", e.target.value)} />
                      </Field>
                      <Field label="ì¶œê¸ˆí†µì¥í‘œì‹œë‚´ìš©">
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
            purchaseDraft={purchaseHeader}
            maintenanceDraft={maintForm}
            cardDraft={cardForm}
            updateNotices={updateNotices}
            siteNotices={siteNotices}
            userPermissions={userPermissions}
            activityLogs={activityLogs}
            deletedRecords={deletedRecords}
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
            loadUpdateNotices={loadUpdateNotices}
            loadSiteNotices={loadSiteNotices}
            loadUserPermissions={loadUserPermissions}
            loadActivityLogs={loadActivityLogs}
            loadDeletedRecords={loadDeletedRecords}
            backupSaving={backupSaving}
            exportFullBackup={exportFullBackup}
            exportBackupSummaryExcel={exportBackupSummaryExcel}
            showToast={showToast}
          />
        )}

        {menuTab === "trash_bin" && isAdmin && (
          <section className="card trash-page">
            <div className="between">
              <div>
                <h2>íœ´ì§€í†µ</h2>
                <p className="muted">ì‚­ì œëœ êµ¬ë§¤Â·ì¹´ë“œÂ·ì •ë¹„Â·ì‚¬ì§„Â·ê¸°ì´ˆìë£ŒÂ·ì¼ì •Â·ê³µì§€ë¥¼ ë³µêµ¬í•˜ê±°ë‚˜ ì™„ì „ì‚­ì œí•©ë‹ˆë‹¤.</p>
              </div>
              <button onClick={loadDeletedRecords}>ìƒˆë¡œê³ ì¹¨</button>
            </div>

            <div className="grid3">
              <Field label="êµ¬ë¶„">
                <select value={trashSearch.module} onChange={(e) => setTrashSearch({ ...trashSearch, module: e.target.value })}>
                  <option value="">ì „ì²´</option>
                  <option value="êµ¬ë§¤">êµ¬ë§¤</option>
                  <option value="ì¹´ë“œ">ì¹´ë“œ</option>
                  <option value="ì •ë¹„">ì •ë¹„</option>
                  <option value="ì…ê³ ì‚¬ì§„">ì…ê³ ì‚¬ì§„</option>
                  <option value="ì •ë¹„ì‚¬ì§„">ì •ë¹„ì‚¬ì§„</option>
                  <option value="ê±°ë˜ì²˜">ê±°ë˜ì²˜</option>
                  <option value="í’ˆëª©">í’ˆëª©</option>
                  <option value="ì°½ê³ ë¶„ë¥˜">ì°½ê³ ë¶„ë¥˜</option>
                  <option value="ì°½ê³ ">ì°½ê³ </option>
                  <option value="í—ˆê°€ê´€ë¦¬">í—ˆê°€ê´€ë¦¬</option>
                  <option value="ì •ë¹„ì¼ì •">ì •ë¹„ì¼ì •</option>
                  <option value="ê³µì§€">ê³µì§€</option>
                  <option value="ì—…ë°ì´íŠ¸ê³µì§€">ì—…ë°ì´íŠ¸ê³µì§€</option>
                </select>
              </Field>
              <Field label="ê²€ìƒ‰">
                <input value={trashSearch.keyword} onChange={(e) => setTrashSearch({ ...trashSearch, keyword: e.target.value })} placeholder="ì œëª©/ë‚´ìš©/ì‚­ì œì ê²€ìƒ‰" />
              </Field>
            </div>

            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th>ì‚­ì œì¼ì‹œ</th>
                    <th>êµ¬ë¶„</th>
                    <th>ëŒ€ìƒ</th>
                    <th>ë‚´ìš©</th>
                    <th>ì‚­ì œì</th>
                    <th>ê´€ë¦¬</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeletedRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{String(record.deleted_at || "").slice(0, 19).replace("T", " ")}</td>
                      <td>{record.module}</td>
                      <td><b>{record.title || "-"}</b></td>
                      <td>{record.detail || "-"}</td>
                      <td>{toLoginId(record.deleted_by || "") || "-"}</td>
                      <td>
                        <button onClick={() => restoreDeletedRecord(record)}>ë³µêµ¬</button>
                        <button className="danger" onClick={() => permanentlyDeleteTrashRecord(record.id)}>ì™„ì „ì‚­ì œ</button>
                      </td>
                    </tr>
                  ))}
                  {!filteredDeletedRecords.length && (
                    <tr>
                      <td colSpan={6} className="center">íœ´ì§€í†µì´ ë¹„ì–´ ìˆìŠµë‹ˆë‹¤.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollTable>

            <div className="mobile-card-list">
              {filteredDeletedRecords.map((record) => (
                <div className="mobile-list-card" key={record.id}>
                  <div className="mobile-list-top">
                    <b>{record.module}</b>
                    <span>{String(record.deleted_at || "").slice(5, 16).replace("T", " ")}</span>
                  </div>
                  <div className="mobile-list-body">
                    <p><b>ëŒ€ìƒ</b> {record.title || "-"}</p>
                    <p><b>ë‚´ìš©</b> {record.detail || "-"}</p>
                    <p><b>ì‚­ì œì</b> {toLoginId(record.deleted_by || "") || "-"}</p>
                  </div>
                  <div className="mobile-list-actions">
                    <button onClick={() => restoreDeletedRecord(record)}>ë³µêµ¬</button>
                    <button className="danger" onClick={() => permanentlyDeleteTrashRecord(record.id)}>ì™„ì „ì‚­ì œ</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {menuTab === "activity_logs" && isAdmin && (
          <section className="card activity-log-page">
            <div className="between">
              <div>
                <h2>ì‘ì—…ë¡œê·¸</h2>
                <p className="muted">ê´€ë¦¬ì ì „ìš© í™”ë©´ì…ë‹ˆë‹¤. ë“±ë¡, ìˆ˜ì •, ì‚­ì œ, ì²˜ë¦¬ì™„ë£Œ ë³€ê²½ ì´ë ¥ì„ ìµœê·¼ 300ê±´ê¹Œì§€ í™•ì¸í•©ë‹ˆë‹¤.</p>
              </div>
              <button onClick={loadActivityLogs}>ìƒˆë¡œê³ ì¹¨</button>
            </div>

            <div className="grid3">
              <Field label="êµ¬ë¶„">
                <select value={activityLogSearch.module} onChange={(e) => setActivityLogSearch({ ...activityLogSearch, module: e.target.value })}>
                  <option value="">ì „ì²´</option>
                  <option value="êµ¬ë§¤">êµ¬ë§¤</option>
                  <option value="ì¹´ë“œ">ì¹´ë“œ</option>
                  <option value="ì •ë¹„">ì •ë¹„</option>
                  <option value="ì…ê³ ì‚¬ì§„">ì…ê³ ì‚¬ì§„</option>
                  <option value="ì •ë¹„ì‚¬ì§„">ì •ë¹„ì‚¬ì§„</option>
                </select>
              </Field>
              <Field label="ê²€ìƒ‰">
                <input value={activityLogSearch.keyword} onChange={(e) => setActivityLogSearch({ ...activityLogSearch, keyword: e.target.value })} placeholder="ì‘ì—…ì/ë‚´ìš©/ì œëª© ê²€ìƒ‰" />
              </Field>
            </div>

            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th>ì‹œê°„</th>
                    <th>êµ¬ë¶„</th>
                    <th>ì‘ì—…</th>
                    <th>ëŒ€ìƒ</th>
                    <th>ë‚´ìš©</th>
                    <th>ì‘ì—…ì</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivityLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{String(log.created_at || "").slice(0, 19).replace("T", " ")}</td>
                      <td>{log.module}</td>
                      <td><b>{log.action}</b></td>
                      <td>{log.target_title || "-"}</td>
                      <td>{log.detail || "-"}</td>
                      <td>{toLoginId(log.user_email || "") || "-"}</td>
                    </tr>
                  ))}
                  {!filteredActivityLogs.length && (
                    <tr>
                      <td colSpan={6} className="center">í‘œì‹œí•  ì‘ì—…ë¡œê·¸ê°€ ì—†ìŠµë‹ˆë‹¤.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollTable>

            <div className="mobile-card-list">
              {filteredActivityLogs.map((log) => (
                <div className="mobile-list-card" key={log.id}>
                  <div className="mobile-list-top">
                    <b>{log.module} Â· {log.action}</b>
                    <span>{String(log.created_at || "").slice(5, 16).replace("T", " ")}</span>
                  </div>
                  <div className="mobile-list-body">
                    <p><b>ëŒ€ìƒ</b> {log.target_title || "-"}</p>
                    <p><b>ë‚´ìš©</b> {log.detail || "-"}</p>
                    <p><b>ì‘ì—…ì</b> {toLoginId(log.user_email || "") || "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {menuTab === "site_notices" && (
          <SiteNoticePage
            siteNotices={visibleSiteNotices}
            allSiteNotices={siteNotices}
            userPermissions={userPermissions}
            siteNoticeForm={siteNoticeForm}
            setSiteNoticeForm={setSiteNoticeForm}
            editingSiteNoticeId={editingSiteNoticeId}
            saveSiteNotice={() => runAuxiliarySave("siteNotice", saveSiteNotice)}
            siteNoticeSaving={isAuxiliarySaving("siteNotice")}
            editSiteNotice={editSiteNotice}
            deleteSiteNotice={deleteSiteNotice}
            siteNoticeError={siteNoticeError}
            isAdmin={isAdmin}
            currentRole={currentRole}
          />
        )}

        {menuTab === "bid_notices" && <BidNoticePage currentRole={currentRole} />}

        {menuTab === "home" && <HomeDashboard purchases={purchases} maints={maints} cardUses={cardUses} maintenanceSchedules={maintenanceSchedules} receiptPhotos={receiptPhotos} maintenancePhotos={maintenancePhotos} siteNotices={visibleSiteNotices} deletedRecords={deletedRecords} setMenuTab={setMenuTab} currentRole={currentRole}  logout={logout} />}

        {menuTab === "layout" && <Home setMenuTab={setMenuTab} setMaintSearch={setMaintSearch} warehouses={warehouses} isAdmin={isAdmin} showToast={showToast} />}

        {(menuTab === "new" || purchaseEntryPopupOpen) && (
          <section className={`card purchase-entry-card ${purchaseEntryPopupOpen ? "purchase-entry-popup-card" : ""}`}>
            <div className="purchase-entry-popup-head">
              <h2>{editingPurchaseId ? "êµ¬ë§¤ ìˆ˜ì •" : "êµ¬ë§¤ ì…ë ¥"}</h2>
              {purchaseEntryPopupOpen && <button onClick={() => setPurchaseEntryPopupOpen(false)}>ë‹«ê¸°</button>}
            </div>
            <div className="grid3">
              <Field label="ì¼ì" required>
                <DateInput
                  value={purchaseHeader.date || getTodayKey()}
                  onChange={(value) => setPurchaseHeader({ ...purchaseHeader, date: value })}
                  placeholder="20260501 ë˜ëŠ” 260501"
                  ariaLabel="êµ¬ë§¤ì¼ì ì„ íƒ"
                />
              </Field>
              <SearchSelect label="ê±°ë˜ì²˜" required value={purchaseHeader.vendor} options={vendorOptions} onChange={(v) => setPurchaseHeader({ ...purchaseHeader, vendor: v })} placeholder="ê±°ë˜ì²˜ëª… ì¼ë¶€ ì…ë ¥" />
              <SearchSelect label="ì°½ê³ " required value={purchaseHeader.warehouse} options={warehouseNames} onChange={(v) => setPurchaseHeader({ ...purchaseHeader, warehouse: v })} placeholder="ì°½ê³ ëª… ì¼ë¶€ ì…ë ¥" />
            </div>
            <div className="table-wrap entry-desktop-table">
              <table>
                <colgroup>
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                </colgroup>
                <thead><tr><th>í’ˆëª© <span className="required-mark">*</span></th><th>ê·œê²©</th><th>ìˆ˜ëŸ‰ <span className="required-mark">*</span></th><th>ë‹¨ê°€</th><th>ê³µê¸‰ê°€ì•¡</th><th>ë¶€ê°€ì„¸ì•¡</th><th>í•©ê³„</th><th>ê´€ë¦¬</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={r.id}><td>
  <div className="purchase-item-editor">
    <SearchSelect
      value={r.item}
      options={itemOptions}
      onChange={(v) => updateRow(i, "item", v)}
      onSelect={(option) => updateRow(i, "item", option.name || option.value, option)}
      placeholder="í’ˆëª© ê²€ìƒ‰"
      variant="item"
    />
    <input
      value={r.item}
      onChange={(e) => updateRow(i, "item", e.target.value)}
      placeholder="í’ˆëª©ëª… ì§ì ‘ìˆ˜ì •"
      title="ì´ë²ˆ êµ¬ë§¤ì…ë ¥ì—ì„œë§Œ í’ˆëª©ëª…ì„ ìˆ˜ì •í•©ë‹ˆë‹¤. í’ˆëª©ë“±ë¡ ì›ë³¸ì€ ë°”ë€Œì§€ ì•ŠìŠµë‹ˆë‹¤."
    />
    <button
      type="button"
      onClick={() => openNewItemModal(i)}
    >
      + ì‹ ê·œ
    </button>
  </div>
</td><td><input value={r.spec} onChange={(e) => updateRow(i, "spec", e.target.value)} /></td><td><input className="right" inputMode="decimal" value={r.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} /></td><td><input className="right" inputMode="decimal" value={r.price} onChange={(e) => updateRow(i, "price", e.target.value)} /></td><td><input className="right" inputMode="decimal" value={r.supply} onChange={(e) => updateRow(i, "supply", e.target.value)} /></td><td><input className="right" inputMode="decimal" value={r.vat} onChange={(e) => updateRow(i, "vat", e.target.value)} /></td><td className="right bold">{money(r.total)}</td><td><button className="icon" title="í–‰ ì‚­ì œ" aria-label="í–‰ ì‚­ì œ" onClick={() => removePurchaseRow(i)}><Trash2 size={16} /></button></td></tr>)}</tbody>
              </table>
            </div>
            <div className="mobile-entry-item-list" aria-label="êµ¬ë§¤ í’ˆëª© ì…ë ¥">
              {rows.map((r, i) => (
                <div className="mobile-entry-item-card" key={`mobile-purchase-${r.id}`}>
                  <div className="mobile-entry-item-head">
                    <div><span>êµ¬ë§¤ í’ˆëª©</span><b>{i + 1}</b></div>
                    <button type="button" className="mobile-entry-delete" onClick={() => removePurchaseRow(i)} aria-label={`${i + 1}ë²ˆ êµ¬ë§¤ í’ˆëª© ì‚­ì œ`}><Trash2 size={16} /> ì‚­ì œ</button>
                  </div>

                  <SearchSelect
                    label="í’ˆëª©"
                    required
                    value={r.item}
                    options={itemOptions}
                    onChange={(value) => updateRow(i, "item", value)}
                    onSelect={(option) => updateRow(i, "item", option.name || option.value, option)}
                    placeholder="í’ˆëª©ëª… ê²€ìƒ‰"
                    variant="item"
                  />

                  <Field label="í’ˆëª©ëª… ì§ì ‘ìˆ˜ì •">
                    <div className="mobile-entry-inline-row">
                      <input value={r.item} onChange={(e) => updateRow(i, "item", e.target.value)} placeholder="ì´ë²ˆ êµ¬ë§¤ì—ì„œ ì‚¬ìš©í•  í’ˆëª©ëª…" />
                      <button type="button" onClick={() => openNewItemModal(i)}><Plus size={16} /> ì‹ ê·œ</button>
                    </div>
                  </Field>

                  <Field label="ê·œê²©">
                    <input value={r.spec} onChange={(e) => updateRow(i, "spec", e.target.value)} placeholder="ê·œê²© ì…ë ¥" />
                  </Field>

                  <div className="mobile-entry-grid">
                    <Field label="ìˆ˜ëŸ‰" required>
                      <input className="right" inputMode="decimal" value={r.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="ë‹¨ê°€">
                      <input className="right" inputMode="decimal" value={r.price} onChange={(e) => updateRow(i, "price", e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="ê³µê¸‰ê°€ì•¡">
                      <input className="right" inputMode="decimal" value={r.supply} onChange={(e) => updateRow(i, "supply", e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="ë¶€ê°€ì„¸ì•¡">
                      <input className="right" inputMode="decimal" value={r.vat} onChange={(e) => updateRow(i, "vat", e.target.value)} placeholder="0" />
                    </Field>
                  </div>

                  <div className="mobile-entry-total"><span>í’ˆëª© í•©ê³„</span><b>{money(r.total)}ì›</b></div>
                </div>
              ))}
            </div>
            <div className="purchase-entry-footer">
              <div className="purchase-entry-support">
                <button className="purchase-add-item-button" onClick={() => setRows([...rows, emptyRow()])}><Plus size={16} /> í’ˆëª© ì¶”ê°€</button>
                <div className="purchase-upload-panel">
                  <strong>êµ¬ë§¤ ì²¨ë¶€íŒŒì¼</strong>
                  <p>ì‚¬ì§„ 20MB Â· PDF 30MB Â· ìŒì„± 50MB ì´í•˜, í•œ ë²ˆì— ìµœëŒ€ 20ê°œì…ë‹ˆë‹¤.</p>
                  <label className={`upload${purchaseUploading ? " upload-busy" : ""}`} aria-disabled={purchaseUploading}>
                    <Upload size={16} /> {purchaseUploading ? "ì²¨ë¶€ ì—…ë¡œë“œ ì¤‘..." : "ì²¨ë¶€íŒŒì¼ ì„ íƒ"}
                    <input
                      type="file"
                      accept="image/*,application/pdf,audio/*,.mp3,.m4a,.wav,.webm"
                      multiple
                      disabled={purchaseUploading}
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        const files = e.target.files;
                        if (!files?.length) return;
                        setPurchaseUploading(true);
                        try {
                          const urls = await uploadPurchaseFiles(files);
                          setPurchaseHeader((prev) => ({
                            ...prev,
                            image_urls: [...(prev.image_urls || []), ...urls],
                          }));
                        } finally {
                          input.value = "";
                          setPurchaseUploading(false);
                        }
                      }}
                    />
                  </label>
                  <div className="receipt-preview">
                    {(purchaseHeader.image_urls || []).length ? (
                      <AttachmentGroup
                        urls={purchaseHeader.image_urls || []}
                        onRemove={(removeIndex) => setPurchaseHeader((prev) => ({
                          ...prev,
                          image_urls: (prev.image_urls || []).filter((_, idx) => idx !== removeIndex),
                        }))}
                      />
                    ) : (
                      <span>ì²¨ë¶€íŒŒì¼ ì—†ìŒ</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="totals purchase-entry-summary">
                <span>ê²°ì œê¸ˆì•¡ ìš”ì•½</span>
                <div>ê³µê¸‰ê°€ì•¡ í•©ê³„ <b>{money(purchaseSupplyTotal)}ì›</b></div>
                <div>ë¶€ê°€ì„¸ì•¡ í•©ê³„ <b>{money(purchaseVatTotal)}ì›</b></div>
                <div className="big"><em>ì´í•©</em><strong>{money(purchaseTotal)}ì›</strong></div>
              </div>
            </div>
            <div className="actions right-actions entry-actions"><button className="primary" disabled={purchaseSaving || purchaseUploading} onClick={savePurchase}><Save size={16} /> {purchaseUploading ? "ì—…ë¡œë“œ ì¤‘..." : purchaseSaving ? "ì €ì¥ ì¤‘..." : editingPurchaseId ? "ìˆ˜ì • ì €ì¥" : "ì €ì¥"}</button><button disabled={purchaseSaving || purchaseUploading} onClick={resetPurchaseForm}><RotateCcw size={16} /> ì´ˆê¸°í™”</button></div>
            <p className="draft-help-text">ì‘ì„± ì¤‘ì¸ êµ¬ë§¤ì…ë ¥ ë‚´ìš©ì€ ìë™ ì„ì‹œì €ì¥ë©ë‹ˆë‹¤. ìƒˆë¡œê³ ì¹¨í•˜ê±°ë‚˜ ë©”ë‰´ë¥¼ ì´ë™í•´ë„ ë‹¤ì‹œ êµ¬ë§¤ì…ë ¥ì— ë“¤ì–´ì˜¤ë©´ ë³µì›ë©ë‹ˆë‹¤.</p>
          </section>
        )}

        {menuTab === "list" && <PurchaseList purchases={filteredPurchases} search={purchaseSearch} setSearch={setPurchaseSearch} editPurchase={editPurchase} deletePurchase={deletePurchase} isAdmin={canEditDeleteRecords} canUpdateTaxInvoice={canCreateRecords} taxInvoiceSavingId={purchaseTaxInvoiceSavingId} onUpdateTaxInvoice={updatePurchaseTaxInvoiceStatus} onLinkPhoto={openPurchasePhotoPicker} onQuickPurchase={openPurchaseEntryPopup} onImportPurchaseExcel={importPurchaseHistoryExcel} />}

        {menuTab === "status" && <PurchaseStatus purchases={purchases} />}


        {menuTab === "card_use" && (
          <section className="card">
            <h2>{editingCardUseId ? "ì¹´ë“œì‚¬ìš© ìˆ˜ì •" : "ì¹´ë“œì‚¬ìš© ë“±ë¡"}</h2>

            <div className="grid5">
              <Field label="ì‚¬ìš©ì¼ì" required>
                <DateInput
                  value={cardForm.date || getTodayKey()}
                  onChange={(value) => setCardForm({ ...cardForm, date: value })}
                  placeholder="20260519 ë˜ëŠ” 260519"
                  ariaLabel="ì‚¬ìš©ì¼ì ì„ íƒ"
                />
              </Field>
              <Field label="ë‹´ë‹¹ì">
                <input value={cardForm.user_name} onChange={(e) => setCardForm({ ...cardForm, user_name: e.target.value })} placeholder="ì‚¬ìš©ì/ì‘ì—…ì" />
              </Field>
              <Field label="ì‚¬ìš©ì²˜" required>
                <input value={cardForm.place} onChange={(e) => setCardForm({ ...cardForm, place: e.target.value })} placeholder="ìƒí˜¸/êµ¬ë§¤ì²˜" />
              </Field>
              <Field label="ê¸ˆì•¡" required>
                <input className="right" inputMode="decimal" value={cardForm.amount} onChange={(e) => setCardForm({ ...cardForm, amount: e.target.value })} placeholder="0" />
              </Field>
              <Field label="ë©”ëª¨">
                <input value={cardForm.memo} onChange={(e) => setCardForm({ ...cardForm, memo: e.target.value })} placeholder="êµ¬ë§¤ë‚´ìš© ë©”ëª¨" />
              </Field>
            </div>

            <div className="between">
              <label className={`upload${cardUploading ? " upload-busy" : ""}`} aria-disabled={cardUploading}>
                <Upload size={16} /> {cardUploading ? "ì˜ìˆ˜ì¦ ì—…ë¡œë“œ ì¤‘..." : "ì˜ìˆ˜ì¦ ì—¬ëŸ¬ ì¥ ì—…ë¡œë“œ"}
                <input
                  type="file"
                  accept="image/*,application/pdf,audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac"
                  capture="environment"
                  multiple
                  disabled={cardUploading}
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const files = e.target.files;
                    if (!files?.length) return;
                    setCardUploading(true);
                    try {
                      const urls = await uploadCardReceipts(files);
                      setCardForm((prev) => {
                        const nextUrls = [...(prev.image_urls || []), ...urls];
                        return { ...prev, image_urls: nextUrls, image_url: nextUrls[0] || prev.image_url };
                      });
                    } finally {
                      input.value = "";
                      setCardUploading(false);
                    }
                  }}
                />
              </label>
              <div className="receipt-preview">
                {(cardForm.image_urls || []).length ? (
                  <AttachmentGroup
                    urls={cardForm.image_urls || []}
                    onRemove={(removeIndex) => setCardForm((prev) => {
                      const nextUrls = (prev.image_urls || []).filter((_, idx) => idx !== removeIndex);
                      return { ...prev, image_urls: nextUrls, image_url: nextUrls[0] || "" };
                    })}
                  />
                ) : (
                  cardForm.image_url ? <a href={cardForm.image_url} target="_blank" rel="noreferrer">ì—…ë¡œë“œí•œ ì˜ìˆ˜ì¦ ë³´ê¸°</a> : <span>ì˜ìˆ˜ì¦ ë¯¸ì²¨ë¶€</span>
                )}
              </div>
            </div>

            <div className="actions right-actions entry-actions">
              <button className="primary" disabled={cardSaving || cardUploading} onClick={saveCardUse}><Save size={16} /> {cardUploading ? "ì—…ë¡œë“œ ì¤‘..." : cardSaving ? "ì €ì¥ ì¤‘..." : editingCardUseId ? "ìˆ˜ì • ì €ì¥" : "ì €ì¥"}</button>
              <button disabled={cardSaving || cardUploading} onClick={resetCardForm}><RotateCcw size={16} /> ì´ˆê¸°í™”</button>
            </div>
            <p className="draft-help-text">ì‘ì„± ì¤‘ì¸ ì¹´ë“œì‚¬ìš© ë‚´ìš©ì€ ìë™ ì„ì‹œì €ì¥ë©ë‹ˆë‹¤. ìƒˆë¡œê³ ì¹¨í•˜ê±°ë‚˜ ë©”ë‰´ë¥¼ ì´ë™í•´ë„ ë‹¤ì‹œ ì¹´ë“œì‚¬ìš©ì— ë“¤ì–´ì˜¤ë©´ ë³µì›ë©ë‹ˆë‹¤.</p>

          </section>
        )}


                {menuTab === "card_list" && (
          <section className="card lookup-page card-lookup-page">
            <div className="between" style={{marginTop:24}}>
              <h2>ì¹´ë“œì¡°íšŒ</h2>
              <button onClick={() => downloadExcel(`ì¹´ë“œì‚¬ìš©_${todayText()}`, withTotalRow(
  filteredCardUses.map((c) => ({ ì‚¬ìš©ì¼ì: c.date, ë‹´ë‹¹ì: c.user_name, ì‚¬ìš©ì²˜: c.place, ê¸ˆì•¡: c.amount, ë©”ëª¨: c.memo || "", ì˜ìˆ˜ì¦: c.image_url || "" })),
  { ì‚¬ìš©ì¼ì: "ì´í•©ê³„", ê¸ˆì•¡: filteredCardUses.reduce((sum, c) => sum + Number(c.amount || 0), 0) }
))}>ì—‘ì…€ ë‹¤ìš´ë¡œë“œ</button><button onClick={() => downloadPdf(`ì¹´ë“œì‚¬ìš©_${todayText()}`, "ì¹´ë“œì‚¬ìš©", withTotalRow(filteredCardUses.map((c) => ({ ì‚¬ìš©ì¼ì: c.date, ì‘ì—…ì: c.user_name, ì‚¬ìš©ì²˜: c.place, ê¸ˆì•¡: c.amount, ë©”ëª¨: c.memo || "" })), { ì‚¬ìš©ì¼ì: "ì´í•©ê³„", ê¸ˆì•¡: filteredCardUses.reduce((sum, c) => sum + Number(c.amount || 0), 0) }))}>PDF ì¶œë ¥</button>
            </div>
            <div className="grid5">
              <Field label="ì‹œì‘ì¼"><DateInput value={cardSearch.from} onChange={(value) => setCardSearch({ ...cardSearch, from: value })} /></Field>
              <Field label="ì¢…ë£Œì¼"><DateInput value={cardSearch.to} onChange={(value) => setCardSearch({ ...cardSearch, to: value })} /></Field>
              <Field label="ë‹´ë‹¹ì"><input value={cardSearch.user_name} onChange={(e) => setCardSearch({ ...cardSearch, user_name: e.target.value })} placeholder="ì‘ì—…ì ê²€ìƒ‰" /></Field>
              <Field label="ì‚¬ìš©ì²˜"><input value={cardSearch.place} onChange={(e) => setCardSearch({ ...cardSearch, place: e.target.value })} placeholder="ì‚¬ìš©ì²˜ ê²€ìƒ‰" /></Field>
              <Field label="ì´ˆê¸°í™”"><button onClick={() => setCardSearch({ from: "", to: "", user_name: "", place: "" })}>ê²€ìƒ‰ ì´ˆê¸°í™”</button></Field>
            </div>

            <div className="status-cards">
              <div><span>ì¹´ë“œì‚¬ìš© ê±´ìˆ˜</span><b>{filteredCardUses.length}ê±´</b></div>
              <div><span>ì¹´ë“œì‚¬ìš© í•©ê³„</span><b>{money(filteredCardUses.reduce((sum, c) => sum + Number(c.amount || 0), 0))}ì›</b></div>
            </div>

            <ScrollTable>
              <table>
                <thead>
                  <tr><th>ê´€ë¦¬ë²ˆí˜¸</th><th>ë‹´ë‹¹ì</th><th>ì‚¬ìš©ì²˜</th><th>ê¸ˆì•¡</th><th>ë©”ëª¨</th><th>ì˜ìˆ˜ì¦</th><th>ê´€ë¦¬</th></tr>
                </thead>
                <tbody>
                  {!filteredCardUses.length ? (
                    <tr><td colSpan={7} className="empty">ì €ì¥ëœ ì¹´ë“œì‚¬ìš© ë‚´ì—­ ì—†ìŒ</td></tr>
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
                      <span>{money(c.amount)}ì›</span>
                    </div>

                    <div className="mobile-list-body">
                      <div><label>ì‚¬ìš©ì²˜</label><p>{c.place}</p></div>
                      <div><label>ë‹´ë‹¹ì</label><p>{c.user_name || "-"}</p></div>
                      <div><label>ë©”ëª¨</label><p>{c.memo || "-"}</p></div>
                    </div>

                    <div className="mobile-list-attachment">
                      <AttachmentGroup urls={c.image_urls || (c.image_url ? [c.image_url] : [])} />
                    </div>

                    <div className="mobile-card-actions">
                      {isAdmin ? (
                        <>
                          <button onClick={() => editCardUse(c)}>ìˆ˜ì •</button>
                          <button onClick={() => deleteCardUse(c.id)}>ì‚­ì œ</button>
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
          <section className="card"><h2>ê±°ë˜ì²˜ë“±ë¡</h2><div className="between"><span>{vendorImportMessage || `í˜„ì¬ ${vendors.length}ê°œ ê±°ë˜ì²˜ ë“±ë¡ë¨`}</span><label className="upload"><Upload size={16} /> ê±°ë˜ì²˜ ì—‘ì…€ ì—…ë¡œë“œ<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && importVendors(e.target.files[0])} /></label></div><div className="grid5 vendor-register-grid"><Field label="ê±°ë˜ì²˜ì½”ë“œ"><input value={vendorForm.code} onChange={(e) => setVendorForm({ ...vendorForm, code: e.target.value })} placeholder="ê±°ë˜ì²˜ì½”ë“œ ì§ì ‘ ì…ë ¥" /></Field><Field label="ìƒí˜¸"><input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} /></Field><Field label="ëŒ€í‘œì"><input value={vendorForm.owner} onChange={(e) => setVendorForm({ ...vendorForm, owner: e.target.value })} /></Field><Field label="ì „í™”ë²ˆí˜¸"><input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} /></Field><Field label="ëª¨ë°”ì¼"><input value={vendorForm.mobile} onChange={(e) => setVendorForm({ ...vendorForm, mobile: e.target.value })} /></Field><Field label="ê¸°ë³¸ì£¼ì†Œ"><div className="vendor-address-input"><input value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} placeholder="ì£¼ì†Œ ê²€ìƒ‰ì„ ëˆŒëŸ¬ ì…ë ¥í•˜ì„¸ìš”" /><button type="button" onClick={openVendorAddressSearch}>ì£¼ì†Œ ê²€ìƒ‰</button></div></Field><Field label="ìƒì„¸ì£¼ì†Œ"><input ref={vendorAddressDetailRef} value={vendorForm.address_detail} onChange={(e) => setVendorForm({ ...vendorForm, address_detail: e.target.value })} placeholder="ê±´ë¬¼ëª…, ì¸µ, í˜¸ìˆ˜ ë“±" /></Field></div><div className="actions right-actions">{isAdmin && <button disabled={isAuxiliarySaving("vendor")} onClick={clearVendors}>ì „ì²´ì‚­ì œ</button>}{isAdmin && <button className="primary" disabled={isAuxiliarySaving("vendor")} onClick={() => runAuxiliarySave("vendor", saveVendor)}>{isAuxiliarySaving("vendor") ? "ì €ì¥ ì¤‘..." : editingVendorId ? "ìˆ˜ì • ì €ì¥" : "ì €ì¥"}</button>}</div><SimpleVendorTable vendors={vendors} deleteVendor={deleteVendor} editVendor={editVendor} isAdmin={canEditDeleteRecords} /></section>
        )}

        {menuTab === "warehouse_groups" && (
          <section className="card"><h2>ì°½ê³ ë“±ë¡</h2><div className="two"><div><h3>ëŒ€ë¶„ë¥˜ ì°½ê³ </h3><Field label="ëŒ€ë¶„ë¥˜ ì½”ë“œ"><input value={groupForm.code} readOnly /></Field><Field label="ëŒ€ë¶„ë¥˜ ì´ë¦„"><input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></Field>{isAdmin && <button className="primary" disabled={isAuxiliarySaving("group")} onClick={() => runAuxiliarySave("group", saveGroup)}>{isAuxiliarySaving("group") ? "ì €ì¥ ì¤‘..." : editingGroupId ? "ìˆ˜ì • ì €ì¥" : "ì €ì¥"}</button>}<ScrollTable><table><thead><tr><th>ì½”ë“œ</th><th>ì´ë¦„</th><th>ê´€ë¦¬</th></tr></thead><tbody>{groups.map((g) => <tr key={g.id}><td>{g.code}</td><td>{g.name}</td><td>{isAdmin ? <><button className="icon" onClick={() => editGroup(g)}><Pencil size={16} /></button><button className="icon" onClick={() => deleteGroup(g.id, g.name)}><Trash2 size={16} /></button></> : "-"}</td></tr>)}</tbody></table></ScrollTable></div><div><h3>ì„¸ë¶€ ì°½ê³ </h3><SearchSelect label="ìƒìœ„ ë¶„ë¥˜" value={warehouseForm.group} options={groups.map((g) => g.name)} onChange={(v) => setWarehouseForm({ ...warehouseForm, group: v })} placeholder="í¬ë¼ìƒ¤ ì…ë ¥" /><Field label="ì„¸ë¶€ ì½”ë“œ"><input value={warehouseForm.code} readOnly /></Field><Field label="ì„¸ë¶€ ì´ë¦„"><input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} /></Field>{isAdmin && <button className="primary" disabled={isAuxiliarySaving("warehouse")} onClick={() => runAuxiliarySave("warehouse", saveWarehouse)}>{isAuxiliarySaving("warehouse") ? "ì €ì¥ ì¤‘..." : editingWarehouseId ? "ìˆ˜ì • ì €ì¥" : "ì €ì¥"}</button>}<ScrollTable><table><thead><tr><th>ì½”ë“œ</th><th>ëŒ€ë¶„ë¥˜</th><th>ì°½ê³ ëª…</th><th>ê´€ë¦¬</th></tr></thead><tbody>{warehouses.map((w) => <tr key={w.id}><td>{w.code}</td><td>{w.group}</td><td>{w.name}</td><td>{isAdmin ? <><button className="icon" onClick={() => editWarehouse(w)}><Pencil size={16} /></button><button className="icon" onClick={() => deleteWarehouse(w.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>)}</tbody></table></ScrollTable></div></div></section>
        )}

        {menuTab === "items" && (
          <section className="card"><h2>í’ˆëª©ë“±ë¡</h2><div className="between"><span>{itemImportMessage || `í˜„ì¬ ${items.length}ê°œ í’ˆëª© ë“±ë¡ë¨`}</span><label className="upload"><Upload size={16} /> í’ˆëª© ì—‘ì…€ ì—…ë¡œë“œ<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && importItems(e.target.files[0])} /></label></div><div className="item-search"><input placeholder="í’ˆëª©ì½”ë“œ / í’ˆëª©ëª… / ê·œê²© / ë‹¨ìœ„ ê²€ìƒ‰" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} /><span>{filteredItems.length}ê±´ í‘œì‹œ</span></div><div className="grid5"><Field label="í’ˆëª©ì½”ë“œ"><input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} /></Field><Field label="í’ˆëª©ëª…"><input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></Field><Field label="ê·œê²©ì •ë³´"><input value={itemForm.spec} onChange={(e) => setItemForm({ ...itemForm, spec: e.target.value })} /></Field><Field label="ë‹¨ìœ„"><input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} /></Field><Field label="ì…ê³ ë‹¨ê°€"><input inputMode="decimal" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} /></Field></div><div className="actions right-actions">{isAdmin && <button disabled={isAuxiliarySaving("item")} onClick={clearItems}>ì „ì²´ì‚­ì œ</button>}{isAdmin && <button className="primary" disabled={isAuxiliarySaving("item")} onClick={() => runAuxiliarySave("item", saveItem)}>{isAuxiliarySaving("item") ? "ì €ì¥ ì¤‘..." : editingItemId ? "ìˆ˜ì • ì €ì¥" : "ì €ì¥"}</button>}</div><ScrollTable><table><thead><tr><th>í’ˆëª©ì½”ë“œ</th><th>í’ˆëª©ëª…</th><th>ê·œê²©ì •ë³´</th><th>ë‹¨ìœ„</th><th>ì…ê³ ë‹¨ê°€</th><th>ê´€ë¦¬</th></tr></thead><tbody>{filteredItems.map((it) => <tr key={it.id}><td>{it.code}</td><td>{it.name}</td><td>{it.spec || "-"}</td><td>{it.unit || "-"}</td><td className="right">{money(it.price)}</td><td>{isAdmin ? <><button className="icon" onClick={() => editItem(it)}><Pencil size={16} /></button><button className="icon" onClick={() => deleteItem(it.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>)}</tbody></table></ScrollTable></section>
        )}

        {menuTab === "maint_new" && (
          <section className="card">
            <div className="between">
              <h2>{editingMaintId ? "ì •ë¹„ ìˆ˜ì •" : "ì •ë¹„ ë“±ë¡"}</h2>
              <button onClick={() => setMaintTemplateOpen((value) => !value)}>ì´ì „ ì‘ì—… ë¶ˆëŸ¬ì˜¤ê¸°</button>
            </div>

            {maintTemplateOpen && (
              <div className="subcard" style={{ marginBottom: 14 }}>
                <div className="between">
                  <strong>ì´ì „ ì •ë¹„ì‘ì—… ì„ íƒ</strong>
                  <input
                    style={{ maxWidth: 320 }}
                    value={maintTemplateSearch}
                    onChange={(e) => setMaintTemplateSearch(e.target.value)}
                    placeholder="ì‘ì—…ëª…/ì°½ê³ /í’ˆëª© ê²€ìƒ‰"
                  />
                </div>
                <ScrollTable>
                  <table>
                    <thead>
                      <tr><th>ì •ë¹„ì¼ì</th><th>ì°½ê³ </th><th>ì •ë¹„ì œëª©</th><th>í’ˆëª©</th><th>í•©ê³„</th><th>ë¶ˆëŸ¬ì˜¤ê¸°</th></tr>
                    </thead>
                    <tbody>
                      {!maintTemplateRecords.length ? (
                        <tr><td colSpan={6} className="empty">ë¶ˆëŸ¬ì˜¬ ì •ë¹„ ì´ë ¥ì´ ì—†ìŠµë‹ˆë‹¤.</td></tr>
                      ) : maintTemplateRecords.map((record) => (
                        <tr key={`maint-template-${record.id}`}>
                          <td>{record.date || "-"}</td>
                          <td>{record.warehouse || "-"}</td>
                          <td className="bold">{record.title || "-"}</td>
                          <td>{(record.items || []).map((item) => item.item).filter(Boolean).slice(0, 3).join(", ") || "-"}</td>
                          <td className="right bold">{money(record.total || record.cost || 0)}</td>
                          <td><button className="primary" onClick={() => applyMaintTemplate(record)}>ì„ íƒ</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
                <p className="draft-help-text">ë‚ ì§œ, ì‘ì—…ì, ì‚¬ì§„ì€ ë³µì‚¬í•˜ì§€ ì•Šê³  ì œëª©/ë‚´ìš©/ì°½ê³ /í’ˆëª©/ìˆ˜ëŸ‰/ë‹¨ê°€ë§Œ í˜„ì¬ ì •ë¹„ë“±ë¡ì— ì±„ì›ë‹ˆë‹¤.</p>
              </div>
            )}

            <div className="grid3">
              <Field label="ì •ë¹„ì¼ì" required>
                <DateInput
                  value={maintForm.date || getTodayKey()}
                  onChange={(value) => setMaintForm({ ...maintForm, date: value })}
                  placeholder="20260519 ë˜ëŠ” 260519"
                  ariaLabel="ì •ë¹„ì¼ì ì„ íƒ"
                />
              </Field>
              <SearchSelect label="ì°½ê³ " required value={maintForm.warehouse} options={warehouseNames} onChange={(v) => setMaintForm({ ...maintForm, warehouse: v })} placeholder="ì°½ê³  ì„ íƒ/ê²€ìƒ‰" />
              <Field label="ì‘ì—…ì">
                <input value={maintForm.manager} onChange={(e) => setMaintForm({ ...maintForm, manager: e.target.value })} />
              </Field>
              <Field label="ì •ë¹„ì œëª©" required>
                <input value={maintForm.title} onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })} />
              </Field>
              <Field label="ì •ë¹„ë‚´ìš©">
                <textarea className="maint-detail-input" rows={3} value={maintForm.detail} onChange={(e) => setMaintForm({ ...maintForm, detail: e.target.value })} placeholder="ì •ë¹„ ì‘ì—…ë‚´ìš©ì„ ì…ë ¥í•˜ì„¸ìš”" />
              </Field>
              <Field label="ì •ë¹„ë¹„ìš©">
                <input value={maintForm.cost} readOnly />
              </Field>
            </div>

            <div className="maint-suggest-box">
                <div className="maint-suggest-head">
                  <div>
                    <strong>
                      ì°½ê³  ì¶”ì²œ í’ˆëª©
                      {!!maintWarehouseKey && <em>{maintSuggestedItems.length}ê°œ</em>}
                    </strong>
                    <span>
                      {!maintWarehouseKey
                        ? "ì°½ê³ ë¥¼ ì„ íƒí•˜ë©´ í•´ë‹¹ ì°½ê³ ì˜ ê³¼ê±° ì •ë¹„ ì‚¬ìš©í’ˆëª©ì„ ë³´ì—¬ì¤ë‹ˆë‹¤."
                        : maintSuggestedItems.length
                          ? `"${maintForm.warehouse}"ì—ì„œ ìì£¼ ì‚¬ìš©ëœ í’ˆëª©ì…ë‹ˆë‹¤.`
                          : `"${maintForm.warehouse}"ì˜ ê¸°ì¡´ ì •ë¹„ ì´ë ¥ì— ë“±ë¡ëœ ì‚¬ìš©í’ˆëª©ì´ ì—†ìŠµë‹ˆë‹¤.`}
                    </span>
                  </div>

                  {!!maintSuggestedItems.length && (
                    <button className="primary" onClick={() => addMaintSuggestedItems(maintSuggestedItems)}>
                      ì¶”ì²œ í’ˆëª© ì „ì²´ ì¶”ê°€
                    </button>
                  )}
                </div>

                {!!maintSuggestedItems.length && (
                  <>
                    <div className="maint-suggest-chips">
                      {visibleMaintSuggestedItems.map((item) => (
                        <button key={item.item} onClick={() => addMaintSuggestedItems([item])}>
                          <b>{item.item}</b>
                          <span>{item.count}íšŒ ì‚¬ìš©</span>
                        </button>
                      ))}
                    </div>

                    {maintSuggestedItems.length > 8 && (
                      <div className="maint-suggest-more">
                        <button onClick={() => setShowAllMaintSuggestions((value) => !value)}>
                          {showAllMaintSuggestions ? "ì ‘ê¸°" : `ë”ë³´ê¸° ${maintSuggestedItems.length - 8}ê°œ`}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {!maintSuggestedItems.length && (
                  <div className="maint-suggest-empty">
                    {maintWarehouseKey ? "ì´ ì°½ê³ ì˜ ì²« ì •ë¹„ í’ˆëª©ì„ ë“±ë¡í•˜ë©´ ë‹¤ìŒë¶€í„° ìë™ ì¶”ì²œë©ë‹ˆë‹¤." : "ë¨¼ì € ìœ„ì—ì„œ ì°½ê³ ë¥¼ ì„ íƒí•˜ì„¸ìš”."}
                  </div>
                )}
              </div>

            <h3>ì‚¬ìš© í’ˆëª©</h3>
            <div className="table-wrap entry-desktop-table">
              <table>
                <colgroup>
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>í’ˆëª©</th>
                    <th>ê·œê²©</th>
                    <th>ìˆ˜ëŸ‰</th>
                    <th>ë‹¨ê°€</th>
                    <th>ê³µê¸‰ê°€ì•¡</th>
                    <th>ë¶€ê°€ì„¸</th>
                    <th>í•©ê³„</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {maintItems.map((r, i) => {
                    const recentPurchaseInfo = getRecentPurchaseInfo(String(r.item || ""));

                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="maintenance-item-editor">
                            <SearchSelect
                              value={r.item}
                              options={itemOptions}
                              onChange={(v) => updateMaintItem(i, "item", v)}
                              onSelect={(option) => updateMaintItem(i, "item", option.name || option.value, option)}
                              placeholder="í’ˆëª© ê²€ìƒ‰"
                              variant="item"
                            />
                            <input
                              value={r.item}
                              onChange={(e) => updateMaintItem(i, "item", e.target.value)}
                              placeholder="í’ˆëª©ëª… ì§ì ‘ìˆ˜ì •"
                            />
                          </div>
                          {recentPurchaseInfo && (
                            <div style={{ marginTop: 6, fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                              ìµœê·¼êµ¬ë§¤: {recentPurchaseInfo.date || "-"} / {recentPurchaseInfo.vendor || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥"} / ë‹¨ê°€ {money(recentPurchaseInfo.price)}ì›
                            </div>
                          )}
                        </td>
                        <td><input value={r.spec} onChange={(e) => updateMaintItem(i, "spec", e.target.value)} /></td>
                        <td><input className="right" inputMode="decimal" value={r.qty} onChange={(e) => updateMaintItem(i, "qty", e.target.value)} /></td>
                        <td><input className="right" inputMode="decimal" value={r.price} onChange={(e) => updateMaintItem(i, "price", e.target.value)} /></td>
                        <td><input className="right" inputMode="decimal" value={r.supply} onChange={(e) => updateMaintItem(i, "supply", e.target.value)} /></td>
                        <td><input className="right" inputMode="decimal" value={r.vat} onChange={(e) => updateMaintItem(i, "vat", e.target.value)} /></td>
                        <td className="right bold">{money(r.total)}</td>
                        <td>
                          <button className="icon" title="í–‰ ì‚­ì œ" aria-label="í–‰ ì‚­ì œ" onClick={() => removeMaintItem(i)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-entry-item-list" aria-label="ì •ë¹„ ì‚¬ìš© í’ˆëª© ì…ë ¥">
              {maintItems.map((r, i) => {
                const recentPurchaseInfo = getRecentPurchaseInfo(String(r.item || ""));

                return (
                  <div className="mobile-entry-item-card maintenance" key={`mobile-maint-${r.id}`}>
                    <div className="mobile-entry-item-head">
                      <div><span>ì •ë¹„ í’ˆëª©</span><b>{i + 1}</b></div>
                      <button type="button" className="mobile-entry-delete" onClick={() => removeMaintItem(i)} aria-label={`${i + 1}ë²ˆ ì •ë¹„ í’ˆëª© ì‚­ì œ`}><Trash2 size={16} /> ì‚­ì œ</button>
                    </div>

                    <SearchSelect
                      label="í’ˆëª©"
                      value={r.item}
                      options={itemOptions}
                      onChange={(value) => updateMaintItem(i, "item", value)}
                      onSelect={(option) => updateMaintItem(i, "item", option.name || option.value, option)}
                      placeholder="í’ˆëª©ëª… ê²€ìƒ‰"
                      variant="item"
                    />

                    <Field label="í’ˆëª©ëª… ì§ì ‘ìˆ˜ì •">
                      <input value={r.item} onChange={(e) => updateMaintItem(i, "item", e.target.value)} placeholder="ì´ë²ˆ ì •ë¹„ì—ì„œ ì‚¬ìš©í•  í’ˆëª©ëª…" />
                    </Field>

                    {recentPurchaseInfo && (
                      <div className="mobile-entry-recent">
                        <span>ìµœê·¼ êµ¬ë§¤</span>
                        <b>{recentPurchaseInfo.date || "-"} Â· {recentPurchaseInfo.vendor || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥"}</b>
                        <em>ë‹¨ê°€ {money(recentPurchaseInfo.price)}ì›</em>
                      </div>
                    )}

                    <Field label="ê·œê²©">
                      <input value={r.spec} onChange={(e) => updateMaintItem(i, "spec", e.target.value)} placeholder="ê·œê²© ì…ë ¥" />
                    </Field>

                    <div className="mobile-entry-grid">
                      <Field label="ìˆ˜ëŸ‰">
                        <input className="right" inputMode="decimal" value={r.qty} onChange={(e) => updateMaintItem(i, "qty", e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="ë‹¨ê°€">
                        <input className="right" inputMode="decimal" value={r.price} onChange={(e) => updateMaintItem(i, "price", e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="ê³µê¸‰ê°€ì•¡">
                        <input className="right" inputMode="decimal" value={r.supply} onChange={(e) => updateMaintItem(i, "supply", e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="ë¶€ê°€ì„¸">
                        <input className="right" inputMode="decimal" value={r.vat} onChange={(e) => updateMaintItem(i, "vat", e.target.value)} placeholder="0" />
                      </Field>
                    </div>

                    <div className="mobile-entry-total"><span>í’ˆëª© í•©ê³„</span><b>{money(r.total)}ì›</b></div>
                  </div>
                );
              })}
            </div>

            <div className="maintenance-entry-footer">
              <div className="maintenance-entry-support">
                <button className="maintenance-add-item-button" onClick={() => setMaintItems([...maintItems, emptyMaintItem()])}><Plus size={16} /> í’ˆëª© ì¶”ê°€</button>
                <div className="maintenance-upload-panel">
                  <strong>ì •ë¹„ ì²¨ë¶€íŒŒì¼</strong>
                  <p>ì‚¬ì§„ 20MB Â· PDF 30MB Â· ìŒì„± 50MB ì´í•˜, í•œ ë²ˆì— ìµœëŒ€ 20ê°œì…ë‹ˆë‹¤.</p>
                  <label className={`upload${maintUploading ? " upload-busy" : ""}`} aria-disabled={maintUploading}>
                    <Upload size={16} /> {maintUploading ? "ì²¨ë¶€ ì—…ë¡œë“œ ì¤‘..." : "ì²¨ë¶€íŒŒì¼ ì„ íƒ"}
                    <input
                      type="file"
                      accept="image/*,application/pdf,audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac"
                      multiple
                      disabled={maintUploading}
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        const files = e.target.files;
                        if (!files?.length) return;
                        setMaintUploading(true);
                        try {
                          const urls = await uploadMaintFiles(files);
                          setMaintForm((prev) => ({
                            ...prev,
                            image_urls: [...(prev.image_urls || []), ...urls],
                          }));
                        } finally {
                          input.value = "";
                          setMaintUploading(false);
                        }
                      }}
                    />
                  </label>
                  <div className="receipt-preview">
                    {(maintForm.image_urls || []).length ? (
                      <AttachmentGroup
                        urls={maintForm.image_urls || []}
                        onRemove={(removeIndex) => setMaintForm((prev) => ({
                          ...prev,
                          image_urls: (prev.image_urls || []).filter((_, idx) => idx !== removeIndex),
                        }))}
                      />
                    ) : (
                      <span>ì²¨ë¶€íŒŒì¼ ì—†ìŒ</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="totals maintenance-entry-summary">
                <span>ì •ë¹„ê¸ˆì•¡ ìš”ì•½</span>
                <div>ê³µê¸‰ê°€ì•¡ í•©ê³„ <b>{money(maintSupplyTotal)}ì›</b></div>
                <div>ë¶€ê°€ì„¸ì•¡ í•©ê³„ <b>{money(maintVatTotal)}ì›</b></div>
                <div className="big"><em>ì´í•©</em><strong>{money(maintGrandTotal)}ì›</strong></div>
              </div>
            </div>

            {maintSaveError && <div className="save-error-box">{maintSaveError}</div>}

            <div className="actions right-actions entry-actions">
              <button className="primary" disabled={maintSaving || maintUploading} onClick={saveMaint}>
                <Save size={16} /> {maintUploading ? "ì—…ë¡œë“œ ì¤‘..." : maintSaving ? "ì €ì¥ ì¤‘..." : editingMaintId ? "ìˆ˜ì • ì €ì¥" : "ì €ì¥"}
              </button>
              <button disabled={maintSaving || maintUploading} onClick={resetMaintForm}><RotateCcw size={16} /> ì´ˆê¸°í™”</button>
            </div>
            <p className="draft-help-text">ì‘ì„± ì¤‘ì¸ ì •ë¹„ë“±ë¡ ë‚´ìš©ì€ ìë™ ì„ì‹œì €ì¥ë©ë‹ˆë‹¤. ì €ì¥ ì‹¤íŒ¨ë‚˜ ë©”ë‰´ ì´ë™ í›„ì—ë„ ë‹¤ì‹œ ì •ë¹„ë“±ë¡ì— ë“¤ì–´ì˜¤ë©´ ë³µì›ë©ë‹ˆë‹¤.</p>
          </section>
        )}

        {menuTab === "maint_list" && <MaintList maints={filteredMaints} search={{ ...maintSearch, warehouseNames }} setSearch={setMaintSearch} editMaint={editMaint} deleteMaint={deleteMaint} setMenuTab={setMenuTab} isAdmin={canEditDeleteRecords} onLinkPhoto={openMaintPhotoPicker} />}

        {menuTab === "maint_stats" && <MaintenanceStats maints={maints} />}

        {menuTab === "maintenance_schedule_new" && (
          <section className="maintenance-schedule-pro-page">
            <div className="schedule-pro-hero">
              <div>
                <span className="schedule-pro-eyebrow">Maintenance Schedule</span>
                <h2>{editingMaintenanceScheduleId ? "ì •ë¹„ì¼ì • ìˆ˜ì •" : "ì •ë¹„ì¼ì •ë“±ë¡"}</h2>
                <p>ì˜ˆì •ì¼ ê¸°ì¤€ìœ¼ë¡œ í•˜ë£¨ì— ì—¬ëŸ¬ ì‘ì—…ì„ ë“±ë¡í•˜ê³ , ì¡°íšŒ í™”ë©´ê³¼ í™ˆ ëŒ€ì‹œë³´ë“œì—ì„œ í•œëˆˆì— í™•ì¸í•©ë‹ˆë‹¤.</p>
              </div>
              <button className="schedule-pro-ghost" onClick={() => setMenuTab("maintenance_schedules")}>ì¼ì •ì¡°íšŒë¡œ ì´ë™</button>
            </div>

            <div className="schedule-pro-layout">
              <div className="schedule-pro-form-card">
                <div className="schedule-pro-card-title modern">
                  <div>
                    <b>ì¼ì • ì •ë³´</b>
                    <small>ì°½ê³ /ì„¤ë¹„ë¥¼ ì„ íƒí•˜ê³  ì‘ì—… ë‚´ìš©ì„ ë“±ë¡í•˜ì„¸ìš”.</small>
                  </div>
                  <span>{maintenanceScheduleForm.schedule_date || getTodayKey()}</span>
                </div>

                <div className="schedule-pro-grid">
                  <Field label="ì˜ˆì •ì¼">
                    <DateInput value={maintenanceScheduleForm.schedule_date} onChange={(value) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, schedule_date: value })} ariaLabel="ì˜ˆì •ì¼ ì„ íƒ" />
                  </Field>
                  <Field label="ì¥ë¹„/ì°½ê³  ì„ íƒ">
                    <input
                      list="maintenance-equipment-options"
                      value={maintenanceScheduleForm.equipment_name}
                      onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, equipment_name: e.target.value })}
                      placeholder="ì°½ê³ /ì„¤ë¹„ ê²€ìƒ‰ ë˜ëŠ” ì§ì ‘ ì…ë ¥"
                    />
                    <datalist id="maintenance-equipment-options">
                      {maintenanceEquipmentOptions.map((name) => (
                        <option value={name} key={name} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="ì‘ì—…ë‚´ìš©">
                    <input value={maintenanceScheduleForm.work_detail} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, work_detail: e.target.value })} placeholder="ì˜ˆ: ë¼ì´ë„ˆ êµì²´" />
                  </Field>
                  <Field label="ì‘ì—…ì">
                    <input value={maintenanceScheduleForm.worker_name} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, worker_name: e.target.value })} placeholder="ì‘ì—…ì" />
                  </Field>
                  <Field label="ìš°ì„ ìˆœìœ„">
                    <select value={maintenanceScheduleForm.priority} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, priority: e.target.value })}>
                      <option>ê¸´ê¸‰</option><option>ë†’ìŒ</option><option>ë³´í†µ</option><option>ë‚®ìŒ</option>
                    </select>
                  </Field>
                  <Field label="ìƒíƒœ">
                    <select value={maintenanceScheduleForm.status} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, status: e.target.value })}>
                      <option>ì˜ˆì •</option><option>ì§„í–‰ì¤‘</option><option>ì™„ë£Œ</option>
                    </select>
                  </Field>
                </div>

                <div className="schedule-equipment-chips">
                  <span>ë¹ ë¥¸ ì„ íƒ</span>
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

                <Field label="ë©”ëª¨">
                  <textarea value={maintenanceScheduleForm.memo} onChange={(e) => setMaintenanceScheduleForm({ ...maintenanceScheduleForm, memo: e.target.value })} placeholder="íŠ¹ì´ì‚¬í•­ / ì¤€ë¹„ë¬¼ / ì°¸ê³ ì‚¬í•­" />
                </Field>

                <div className="schedule-pro-actions">
                  <button className="primary" disabled={isAuxiliarySaving("maintenanceSchedule")} onClick={() => runAuxiliarySave("maintenanceSchedule", saveMaintenanceSchedule)}>{isAuxiliarySaving("maintenanceSchedule") ? "ì €ì¥ ì¤‘..." : editingMaintenanceScheduleId ? "ìˆ˜ì • ì €ì¥" : "ì¼ì • ì €ì¥"}</button>
                  <button disabled={isAuxiliarySaving("maintenanceSchedule")} onClick={resetMaintenanceScheduleForm}>ì´ˆê¸°í™”</button>
                </div>
              </div>

              <div className="schedule-pro-side">
                <div className="schedule-pro-mini-card blue">
                  <span>ì˜¤ëŠ˜ ì¼ì •</span>
                  <b>{maintenanceSchedules.filter((x) => x.schedule_date === getTodayKey()).length}ê±´</b>
                  <small>ì˜¤ëŠ˜ ë“±ë¡ëœ ì •ë¹„ ì‘ì—…</small>
                </div>
                <div className="schedule-pro-mini-card red">
                  <span>ê¸´ê¸‰ ì¼ì •</span>
                  <b>{maintenanceSchedules.filter((x) => x.priority === "ê¸´ê¸‰" && x.status !== "ì™„ë£Œ").length}ê±´</b>
                  <small>ì™„ë£Œë˜ì§€ ì•Šì€ ê¸´ê¸‰ ì‘ì—…</small>
                </div>
                <div className="schedule-pro-mini-card green">
                  <span>ì™„ë£Œ ì¼ì •</span>
                  <b>{maintenanceSchedules.filter((x) => x.status === "ì™„ë£Œ").length}ê±´</b>
                  <small>ëˆ„ì  ì™„ë£Œ ì‘ì—…</small>
                </div>

                <div className="schedule-pro-preview">
                  <div className="schedule-pro-card-title">
                    <b>ì˜¤ëŠ˜ ì‘ì—… ë¯¸ë¦¬ë³´ê¸°</b>
                    <span>{getTodayKey()}</span>
                  </div>
                  {maintenanceSchedules.filter((x) => x.schedule_date === getTodayKey()).slice(0, 5).length ? (
                    maintenanceSchedules.filter((x) => x.schedule_date === getTodayKey()).slice(0, 5).map((x) => (
                      <div className="schedule-pro-preview-row" key={x.id}>
                        <div>
                          <strong>{x.equipment_name}</strong>
                          <p>{x.work_detail}</p>
                        </div>
                        <span className={`schedule-status ${x.status || "ì˜ˆì •"}`}>{x.status || "ì˜ˆì •"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="schedule-pro-empty">ì˜¤ëŠ˜ ë“±ë¡ëœ ì •ë¹„ì¼ì •ì´ ì—†ìŠµë‹ˆë‹¤.</div>
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
              <h2>ì‹ ê·œ í’ˆëª© ì¶”ê°€</h2>
              <div className="grid2">
                <Field label="í’ˆëª©ì½”ë“œ" required>
                  <input value={newItemForm.code} onChange={(e) => setNewItemForm({ ...newItemForm, code: e.target.value })} autoFocus placeholder="ì˜ˆ: 0001" />
                </Field>
                <Field label="í’ˆëª©ëª…">
                  <input value={newItemForm.name} onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })} />
                </Field>
                <Field label="ê·œê²©ì •ë³´">
                  <input value={newItemForm.spec} onChange={(e) => setNewItemForm({ ...newItemForm, spec: e.target.value })} />
                </Field>
                <Field label="ë‹¨ìœ„">
                  <input value={newItemForm.unit} onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })} placeholder="ea" />
                </Field>
                <Field label="ì…ê³ ë‹¨ê°€">
                  <input inputMode="decimal" value={newItemForm.price} onChange={(e) => setNewItemForm({ ...newItemForm, price: e.target.value })} placeholder="0" />
                </Field>
              </div>
              <div className="actions right-actions">
                <button disabled={isAuxiliarySaving("newItemModal")} onClick={closeNewItemModal}>ì·¨ì†Œ</button>
                <button className="primary" disabled={isAuxiliarySaving("newItemModal")} onClick={() => runAuxiliarySave("newItemModal", saveNewItemFromModal)}>{isAuxiliarySaving("newItemModal") ? "ì €ì¥ ì¤‘..." : "ì €ì¥"}</button>
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
                      ? "ì…ê³ ì‚¬ì§„ ì„ íƒ"
                      : photoLinkModal.mode === "maint"
                        ? "ì •ë¹„ì‚¬ì§„ ì„ íƒ"
                        : photoLinkModal.mode === "recordPurchase"
                          ? "êµ¬ë§¤ë‚´ì—­ ì„ íƒ"
                          : "ì •ë¹„ë‚´ì—­ ì„ íƒ"}
                  </h2>
                  <p>
                    {photoLinkModal.mode === "purchase"
                      ? "êµ¬ë§¤ì¡°íšŒ ë‚´ì—­ì— ì—°ê²°í•  ì…ê³ ì‚¬ì§„/PDF/ìŒì„±ì„ ì„ íƒí•˜ì„¸ìš”."
                      : photoLinkModal.mode === "maint"
                        ? "ì •ë¹„ì¡°íšŒ ë‚´ì—­ì— ì—°ê²°í•  ì •ë¹„ì‚¬ì§„/PDF/ìŒì„±ì„ ì„ íƒí•˜ì„¸ìš”."
                        : photoLinkModal.mode === "recordPurchase"
                          ? "ì…ê³ ì‚¬ì§„ì„ ì—°ê²°í•  ê¸°ì¡´ êµ¬ë§¤ë‚´ì—­ì„ ì„ íƒí•˜ì„¸ìš”."
                          : "ì •ë¹„ì‚¬ì§„ì„ ì—°ê²°í•  ê¸°ì¡´ ì •ë¹„ë‚´ì—­ì„ ì„ íƒí•˜ì„¸ìš”."}
                  </p>
                </div>
                <button onClick={() => setPhotoLinkModal({ mode: "", targetId: "", search: "" })}>ë‹«ê¸°</button>
              </div>

              <input
                className="photo-link-search"
                value={photoLinkModal.search}
                onChange={(e) => setPhotoLinkModal({ ...photoLinkModal, search: e.target.value })}
                placeholder="ê±°ë˜ì²˜/ë‚ ì§œ/í’ˆëª©/ì°½ê³  ê²€ìƒ‰, ë¹„ìš°ë©´ ì „ì²´ í‘œì‹œ"
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
                        <strong>{photo.vendor_name || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥"}</strong>
                        <span>{photo.receipt_date} Â· {photo.is_processed ? "ì²˜ë¦¬ì™„ë£Œ" : "ë¯¸ì²˜ë¦¬"}</span>
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
                        <strong>{photo.equipment_name || "ì„¤ë¹„ ë¯¸ì…ë ¥"}</strong>
                        <span>{photo.maint_date} Â· {photo.is_processed ? "ì²˜ë¦¬ì™„ë£Œ" : "ë¯¸ì²˜ë¦¬"}</span>
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
                        <strong>{purchase.vendor || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥"}</strong>
                        <span>{purchase.date || "-"} Â· {purchase.warehouse || "-"}</span>
                        <p>{getPurchaseItemSummary(purchase)} / {money(purchase.total)}ì›</p>
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
                        <strong>{maint.title || "ì œëª© ë¯¸ì…ë ¥"}</strong>
                        <span>{maint.date || "-"} Â· {maint.warehouse || "-"}</span>
                        <p>{maint.detail || "-"}</p>
                      </div>
                      <AttachmentGroup urls={maint.image_urls || (maint.image_url ? [maint.image_url] : [])} />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        <AttachmentViewerModal viewer={attachmentViewer} onClose={() => setAttachmentViewer(null)} />

      {photoViewer && (
          <div className="photo-viewer-backdrop" onClick={closePhotoViewer}>
            <div className="photo-viewer-modal" onClick={(e) => e.stopPropagation()}>
              <div className="photo-viewer-head">
                <div>
                  <strong>{photoViewer.title}</strong>
                  <span>{photoViewer.index + 1} / {photoViewer.urls.length}</span>
                </div>
                <button onClick={closePhotoViewer}>ë‹«ê¸°</button>
              </div>

              <div className="photo-viewer-body">
                {photoViewer.urls.length > 1 && (
                  <button className="photo-viewer-nav prev" onClick={() => movePhotoViewer(-1)}>â€¹</button>
                )}

                <img src={photoViewer.urls[photoViewer.index]} alt="í™•ëŒ€ì‚¬ì§„" />

                {photoViewer.urls.length > 1 && (
                  <button className="photo-viewer-nav next" onClick={() => movePhotoViewer(1)}>â€º</button>
                )}
              </div>

              {photoViewer.urls.length > 1 && (
                <div className="photo-viewer-thumbs">
                  {photoViewer.urls.map((url, idx) => (
                    <button
                      key={`${url}-${idx}`}
                      className={idx === photoViewer.index ? "active" : ""}
                      onClick={() => setPhotoViewer((prev) => prev ? { ...prev, index: idx } : prev)}
                    >
                      <img src={url} alt={`ì¸ë„¤ì¼ ${idx + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {pdfViewer && (
          <div className="photo-viewer-backdrop" onClick={closePdfViewer}>
            <div className="pdf-viewer-modal" onClick={(e) => e.stopPropagation()}>
              <div className="photo-viewer-head">
                <div>
                  <strong>{pdfViewer.title}</strong>
                  <span>PDF ë¬¸ì„œ</span>
                </div>
                <button onClick={closePdfViewer}>ë‹«ê¸°</button>
              </div>
              <iframe src={pdfViewer.url} title={pdfViewer.title} />
              <div className="pdf-viewer-actions">
                <a href={pdfViewer.url} target="_blank" rel="noreferrer">ìƒˆ ì°½ìœ¼ë¡œ ì—´ê¸°</a>
              </div>
            </div>
          </div>
        )}

        <div className="mobile-more-sheet role-mobile-sheet" style={{ display: mobileSheet ? "block" : "none" }}>
          <div className="role-mobile-sheet-card">
            <div className="role-mobile-sheet-head">
              <strong>
                {mobileSheet === "buy" ? "êµ¬ë§¤ ë©”ë‰´" : mobileSheet === "card" ? "ì¹´ë“œ ë©”ë‰´" : mobileSheet === "maint" ? "ì •ë¹„ ë©”ë‰´" : "ë”ë³´ê¸°"}
              </strong>
              <button onClick={() => setMobileSheet("")}>ë‹«ê¸°</button>
            </div>

            <div className="role-mobile-sheet-grid">
              {mobileSheet === "buy" && (
                <>
                  {canAccessTab("new") && <button onClick={() => { setMenuTab("new"); setMobileSheet(""); }}>êµ¬ë§¤ì…ë ¥</button>}
                  {canAccessTab("list") && <button onClick={() => { setMenuTab("list"); setMobileSheet(""); }}>êµ¬ë§¤ì¡°íšŒ</button>}
                  {canAccessTab("status") && <button onClick={() => { setMenuTab("status"); setMobileSheet(""); }}>êµ¬ë§¤í˜„í™©</button>}
                  {canAccessTab("bulk_transfer") && <button onClick={() => { setMenuTab("bulk_transfer"); setMobileSheet(""); }}>ëŒ€ëŸ‰ì´ì²´</button>}
                  {canAccessTab("receipt_photos") && <button onClick={() => { setMenuTab("receipt_photos"); setMobileSheet(""); }}>ì…ê³ ì‚¬ì§„ë“±ë¡</button>}
                  {canAccessTab("vendor_accounts") && <button onClick={() => { setMenuTab("vendor_accounts"); setMobileSheet(""); }}>ì—…ì²´ê³„ì¢Œê´€ë¦¬</button>}
                </>
              )}

              {mobileSheet === "card" && (
                <>
                  {canAccessTab("card_use") && <button onClick={() => { setMenuTab("card_use"); setMobileSheet(""); }}>ì¹´ë“œì‚¬ìš©</button>}
                  {canAccessTab("card_list") && <button onClick={() => { setMenuTab("card_list"); setMobileSheet(""); }}>ì¹´ë“œì¡°íšŒ</button>}
                  {canAccessTab("card_stats") && <button onClick={() => { setMenuTab("card_stats"); setMobileSheet(""); }}>ì¹´ë“œí†µê³„</button>}
                </>
              )}

              {mobileSheet === "maint" && (
                <>
                  {canAccessTab("maint_new") && <button onClick={() => { setMenuTab("maint_new"); setMobileSheet(""); }}>ì •ë¹„ë“±ë¡</button>}
                  {canAccessTab("maint_list") && <button onClick={() => { setMenuTab("maint_list"); setMobileSheet(""); }}>ì •ë¹„ì¡°íšŒ</button>}
                  {canAccessTab("maint_stats") && <button onClick={() => { setMenuTab("maint_stats"); setMobileSheet(""); }}>ì •ë¹„í†µê³„</button>}
                  {canAccessTab("maintenance_photos") && <button onClick={() => { setMenuTab("maintenance_photos"); setMobileSheet(""); }}>ì •ë¹„ì‚¬ì§„ë“±ë¡</button>}
                  {canAccessTab("maintenance_schedule_new") && <button onClick={() => { setMenuTab("maintenance_schedule_new"); setMobileSheet(""); }}>ì •ë¹„ì¼ì •ë“±ë¡</button>}
                  {canAccessTab("maintenance_schedules") && <button onClick={() => { setMenuTab("maintenance_schedules"); setMobileSheet(""); }}>ì •ë¹„ì¼ì •ì¡°íšŒ</button>}
                </>
              )}

              {mobileSheet === "more" && (
                <>
                  {canAccessTab("site_notices") && <button onClick={() => { setMenuTab("site_notices"); setMobileSheet(""); }}>ê³µì§€ì‚¬í•­</button>}
                  {canAccessTab("bid_notices") && <button onClick={() => { setMenuTab("bid_notices"); setMobileSheet(""); }}>ì…ì°°ê³µê³ </button>}
                  {canAccessTab("activity_logs") && <button onClick={() => { setMenuTab("activity_logs"); setMobileSheet(""); }}>ì‘ì—…ë¡œê·¸</button>}
                  {canAccessTab("trash_bin") && <button onClick={() => { setMenuTab("trash_bin"); setMobileSheet(""); }}>íœ´ì§€í†µ</button>}
                  {canAccessTab("layout") && <button onClick={() => { setMenuTab("layout"); setMobileSheet(""); }}>ìƒì‚°ë¼ì¸</button>}
                  {canAccessTab("vendors") && <button onClick={() => { setMenuTab("vendors"); setMobileSheet(""); }}>ê±°ë˜ì²˜ë“±ë¡</button>}
                  {canAccessTab("warehouse_groups") && <button onClick={() => { setMenuTab("warehouse_groups"); setMobileSheet(""); }}>ì°½ê³ ë“±ë¡</button>}
                  {canAccessTab("items") && <button onClick={() => { setMenuTab("items"); setMobileSheet(""); }}>í’ˆëª©ë“±ë¡</button>}
                  {canAccessTab("permits") && <button onClick={() => { setMenuTab("permits"); setMobileSheet(""); }}>í—ˆê°€ê´€ë¦¬</button>}
                  {isAdmin && <button onClick={() => { setMenuTab("backup_permissions"); setMobileSheet(""); }}>ë°±ì—…/ê¶Œí•œê´€ë¦¬</button>}
                  <button className="role-mobile-logout" onClick={logout}>ë¡œê·¸ì•„ì›ƒ</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mobile-bottom-nav permission-aware-mobile-nav role-aware-bottom-nav">
          {currentRole === "field" ? (
            <>
              <button className={menuTab === "home" ? "active" : ""} onClick={() => { setMenuTab("home"); setMobileSheet(""); }}>í™ˆ</button>
              {canAccessTab("receipt_photos") && <button className={menuTab === "receipt_photos" ? "active" : ""} onClick={() => { setMenuTab("receipt_photos"); setMobileSheet(""); }}>ì…ê³ ì‚¬ì§„</button>}
              {canAccessTab("maintenance_photos") && <button className={menuTab === "maintenance_photos" ? "active" : ""} onClick={() => { setMenuTab("maintenance_photos"); setMobileSheet(""); }}>ì •ë¹„ì‚¬ì§„</button>}
              {canAccessTab("maintenance_schedules") && <button className={["maintenance_schedule_new","maintenance_schedules"].includes(menuTab) ? "active" : ""} onClick={() => { setMenuTab("maintenance_schedules"); setMobileSheet(""); }}>ì¼ì •</button>}
              <button className={mobileSheet === "more" || ["site_notices", "bid_notices"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "more" ? "" : "more")}>ë”ë³´ê¸°</button>
            </>
          ) : (
            <>
              <button className={menuTab === "home" ? "active" : ""} onClick={() => { setMenuTab("home"); setMobileSheet(""); }}>í™ˆ</button>
              <button className={mobileSheet === "buy" || ["new","list","status","bulk_transfer","receipt_photos","vendor_accounts"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "buy" ? "" : "buy")}>êµ¬ë§¤</button>
              <button className={mobileSheet === "card" || ["card_use","card_list","card_stats"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "card" ? "" : "card")}>ì¹´ë“œ</button>
              <button className={mobileSheet === "maint" || ["maint_new","maint_list","maint_stats","maintenance_photos","maintenance_schedule_new","maintenance_schedules"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "maint" ? "" : "maint")}>ì •ë¹„</button>
              <button className={mobileSheet === "more" || ["site_notices","bid_notices","activity_logs","trash_bin","layout","vendors","warehouse_groups","items","permits","backup_permissions"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "more" ? "" : "more")}>ë”ë³´ê¸°</button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

function Field({ label, children, required = false, className = "" }: { label: string; children: any; required?: boolean; className?: string }) {
  return <div className={`field ${className}`.trim()}><label>{label}{required && <span className="required-mark" aria-hidden="true">*</span>}</label>{children}</div>;
}
function ScrollTable({ children }: { children: any }) {
  return <div className="scroll-table">{children}</div>;
}

function PurchaseList({ purchases, search, setSearch, editPurchase, deletePurchase, isAdmin, canUpdateTaxInvoice, taxInvoiceSavingId, onUpdateTaxInvoice, onLinkPhoto, onQuickPurchase, onImportPurchaseExcel }: any) {
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [attachmentViewer, setAttachmentViewer] = useState<{ title: string; urls: string[] } | null>(null);
  const [purchasePage, setPurchasePage] = useState(1);
  const purchaseImportInputRef = useRef<HTMLInputElement | null>(null);
  const purchasePageSize = 20;
  const purchaseTotalPages = Math.max(1, Math.ceil((purchases || []).length / purchasePageSize));
  const purchaseSafePage = Math.min(Math.max(purchasePage, 1), purchaseTotalPages);
  const purchaseStartIndex = (purchaseSafePage - 1) * purchasePageSize;
  const pagedPurchases = (purchases || []).slice(purchaseStartIndex, purchaseStartIndex + purchasePageSize);
  const purchaseEndIndex = purchases.length ? Math.min(purchaseStartIndex + pagedPurchases.length, purchases.length) : 0;

  useEffect(() => {
    setPurchasePage(1);
  }, [search.from, search.to, search.vendor, search.warehouse, search.item, search.taxInvoice]);

  useEffect(() => {
    if (purchasePage > purchaseTotalPages) setPurchasePage(purchaseTotalPages);
  }, [purchasePage, purchaseTotalPages]);

  const setPurchasePeriod = (from: string, to: string) => {
    setSearch({ ...search, from, to });
  };
  const setThisWeekPeriod = () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    setPurchasePeriod(toDateKey(monday), toDateKey(sunday));
  };
  const setThisMonthPeriod = () => {
    const now = koreaNow();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setPurchasePeriod(toDateKey(first), toDateKey(last));
  };
  const setLastMonthPeriod = () => {
    const now = koreaNow();
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    setPurchasePeriod(toDateKey(first), toDateKey(last));
  };
  const setThisYearPeriod = () => {
    const now = koreaNow();
    setPurchasePeriod(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
  };

  const openPurchaseDetail = (purchase: Purchase) => {
    setDetailPurchase(purchase);
  };

  const renderPurchasePages = () => {
    if (purchaseTotalPages <= 1) return null;

    const pages = Array.from({ length: purchaseTotalPages }, (_, i) => i + 1).filter((page) => {
      return page === 1 || page === purchaseTotalPages || Math.abs(page - purchaseSafePage) <= 2;
    });

    return (
      <div className="purchase-pagination">
        <button disabled={purchaseSafePage <= 1} onClick={() => setPurchasePage((page) => Math.max(1, page - 1))}>ì´ì „</button>
        {pages.map((page, index) => {
          const prevPage = pages[index - 1];
          return (
            <span key={page} className="purchase-page-group">
              {prevPage && page - prevPage > 1 && <span className="purchase-page-ellipsis">...</span>}
              <button className={page === purchaseSafePage ? "active" : ""} onClick={() => setPurchasePage(page)}>{page}</button>
            </span>
          );
        })}
        <button disabled={purchaseSafePage >= purchaseTotalPages} onClick={() => setPurchasePage((page) => Math.min(purchaseTotalPages, page + 1))}>ë‹¤ìŒ</button>
      </div>
    );
  };

  return <>
    <AttachmentViewerModal viewer={attachmentViewer} onClose={() => setAttachmentViewer(null)} />
    <section className="card lookup-page purchase-lookup-page"><div className="between"><h2>êµ¬ë§¤ì¡°íšŒ</h2><div className="purchase-lookup-actions"><button className="primary" onClick={onQuickPurchase}>êµ¬ë§¤ì…ë ¥</button><button onClick={() => purchaseImportInputRef.current?.click()}>ì—‘ì…€ ì—…ë¡œë“œ</button><input ref={purchaseImportInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) onImportPurchaseExcel(file); e.currentTarget.value = ""; }} /><button onClick={() => downloadExcel(`êµ¬ë§¤ì¡°íšŒ_${todayText()}`, withTotalRow(
  purchases.map((p: Purchase) => ({ ì¼ì: p.date, ê±°ë˜ì²˜: p.vendor, ì°½ê³ : p.warehouse, ëŒ€í‘œí’ˆëª©: getPurchaseItemSummary(p), ì„¸ê¸ˆê³„ì‚°ì„œ: p.taxInvoiceReceived ? "ë°›ìŒ" : "ë¯¸ìˆ˜ì·¨", ê³µê¸‰ê°€ì•¡: p.supplyTotal, ë¶€ê°€ì„¸ì•¡: p.vatTotal, í•©ê³„: p.total })),
  { ì¼ì: "ì´í•©ê³„", ê³µê¸‰ê°€ì•¡: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.supplyTotal || 0), 0), ë¶€ê°€ì„¸ì•¡: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.vatTotal || 0), 0), í•©ê³„: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.total || 0), 0) }
))}>ì—‘ì…€ ë‹¤ìš´ë¡œë“œ</button><button onClick={() => downloadPdf(`êµ¬ë§¤ì¡°íšŒ_${todayText()}`, "êµ¬ë§¤ì¡°íšŒ", withTotalRow(purchases.map((p: Purchase) => ({ ì¼ì: p.date, ê±°ë˜ì²˜: p.vendor, ì°½ê³ : p.warehouse, ëŒ€í‘œí’ˆëª©: getPurchaseItemSummary(p), ì„¸ê¸ˆê³„ì‚°ì„œ: p.taxInvoiceReceived ? "ë°›ìŒ" : "ë¯¸ìˆ˜ì·¨", ê³µê¸‰ê°€ì•¡: p.supplyTotal, ë¶€ê°€ì„¸ì•¡: p.vatTotal, í•©ê³„: p.total })), { ì¼ì: "ì´í•©ê³„", ê³µê¸‰ê°€ì•¡: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.supplyTotal || 0), 0), ë¶€ê°€ì„¸ì•¡: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.vatTotal || 0), 0), í•©ê³„: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.total || 0), 0) }))}>PDF ì¶œë ¥</button></div></div><div className="purchase-period-buttons"><button onClick={() => setPurchasePeriod(getTodayKey(), getTodayKey())}>ì˜¤ëŠ˜</button><button onClick={setThisWeekPeriod}>ì´ë²ˆì£¼</button><button onClick={setThisMonthPeriod}>ì´ë²ˆë‹¬</button><button onClick={setLastMonthPeriod}>ì§€ë‚œë‹¬</button><button onClick={setThisYearPeriod}>ì˜¬í•´</button><button onClick={() => setSearch({ from: "", to: "", vendor: "", warehouse: "", item: "", taxInvoice: "" })}>ì „ì²´</button></div><div className="grid5 purchase-filter-grid"><input placeholder="ì‹œì‘ì¼ 240107 ë˜ëŠ” 20240107" value={search.from} onChange={(e) => setSearch({ ...search, from: formatInputDate(e.target.value) })} /><input placeholder="ì¢…ë£Œì¼ 240107 ë˜ëŠ” 20240107" value={search.to} onChange={(e) => setSearch({ ...search, to: formatInputDate(e.target.value) })} /><input placeholder="ê±°ë˜ì²˜ ê²€ìƒ‰" value={search.vendor} onChange={(e) => setSearch({ ...search, vendor: e.target.value })} /><input placeholder="ì°½ê³  ê²€ìƒ‰" value={search.warehouse} onChange={(e) => setSearch({ ...search, warehouse: e.target.value })} /><input placeholder="í’ˆëª© ê²€ìƒ‰" value={search.item} onChange={(e) => setSearch({ ...search, item: e.target.value })} /><select aria-label="ì„¸ê¸ˆê³„ì‚°ì„œ ìˆ˜ì·¨ ì—¬ë¶€" value={search.taxInvoice || ""} onChange={(e) => setSearch({ ...search, taxInvoice: e.target.value })}><option value="">ì„¸ê¸ˆê³„ì‚°ì„œ ì „ì²´</option><option value="received">ë°›ìŒ</option><option value="unreceived">ë¯¸ìˆ˜ì·¨</option></select></div>
      <div className="purchase-page-summary">ê²€ìƒ‰ê²°ê³¼ {money(purchases.length)}ê±´ Â· {purchases.length ? `${money(purchaseStartIndex + 1)}-${money(purchaseEndIndex)}ê±´` : "0ê±´"} í‘œì‹œ</div>
      <div className="mobile-purchase-cards">
  {!pagedPurchases.length ? (
    <div className="empty">ì €ì¥ëœ êµ¬ë§¤ë‚´ì—­ ì—†ìŒ</div>
  ) : pagedPurchases.map((p: Purchase, pageIndex: number) => {
    const index = purchaseStartIndex + pageIndex;
    const sameDateBeforeCount = purchases.slice(0, index).filter((x: Purchase) => x.date === p.date).length;
    const seq = sameDateBeforeCount + 1;
    return (
      <div className="mobile-purchase-card" key={`mobile-${p.id}`}>
        <div className="mobile-purchase-card-head">
          <strong>{p.vendor || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥"}</strong>
          <span>{`${p.date || ""}-${String(seq).padStart(2, "0")}`}</span>
        </div>
        <div className="mobile-purchase-card-row"><span>í’ˆëª©</span><b><button className="purchase-item-detail-button" onClick={() => openPurchaseDetail(p)}>{getPurchaseItemSummary(p)}</button></b></div>
        <div className="mobile-purchase-card-row"><span>ì°½ê³ </span><b>{p.warehouse || "-"}</b></div>
        <div className="mobile-purchase-card-row"><span>í•©ê³„</span><b>{money(p.total)}ì›</b></div>
        <div className="mobile-purchase-card-row"><span>ì„¸ê¸ˆê³„ì‚°ì„œ</span><b><label className={`tax-invoice-check${p.taxInvoiceReceived ? " checked" : ""}`}><input type="checkbox" checked={Boolean(p.taxInvoiceReceived)} disabled={!canUpdateTaxInvoice || Boolean(taxInvoiceSavingId)} onChange={(e) => onUpdateTaxInvoice(p, e.target.checked)} /><em>{taxInvoiceSavingId === p.id ? "ì €ì¥ ì¤‘" : p.taxInvoiceReceived ? "ë°›ìŒ" : "ë¯¸ìˆ˜ì·¨"}</em></label></b></div>
        <div className="mobile-purchase-card-row"><span>ì²¨ë¶€</span><b><AttachmentSummaryButton urls={p.image_urls || (p.image_url ? [p.image_url] : [])} onOpen={() => setAttachmentViewer({ title: `${p.vendor || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥"} Â· ${p.date || "-"}`, urls: p.image_urls || (p.image_url ? [p.image_url] : []) })} /></b></div>
        {isAdmin && (
          <div className="mobile-purchase-card-actions">
            <button onClick={() => onLinkPhoto(p)}>ì‚¬ì§„ì—°ê²°</button>
            <button onClick={() => editPurchase(p)}>ìˆ˜ì •</button>
            <button onClick={() => deletePurchase(p.id)}>ì‚­ì œ</button>
          </div>
        )}
      </div>
    );
  })}
</div><ScrollTable><table><thead><tr><th>ê´€ë¦¬ë²ˆí˜¸</th><th>ê±°ë˜ì²˜</th><th>í’ˆëª©</th><th>ì°½ê³ </th><th>í•©ê³„</th><th>ì„¸ê¸ˆê³„ì‚°ì„œ</th><th>ì²¨ë¶€</th><th>ê´€ë¦¬</th></tr></thead><tbody>{!pagedPurchases.length ? <tr><td colSpan={8} className="empty">ì €ì¥ëœ êµ¬ë§¤ë‚´ì—­ ì—†ìŒ</td></tr> : pagedPurchases.map((p: Purchase, pageIndex: number) => {
  const index = purchaseStartIndex + pageIndex;
  const sameDateBeforeCount = purchases.slice(0, index).filter((x: Purchase) => x.date === p.date).length;
  const seq = sameDateBeforeCount + 1;
  return <tr key={p.id}><td>{`${p.date || ""}-${String(seq).padStart(2, "0")}`}</td><td>{p.vendor}</td><td><button className="purchase-item-detail-button" onClick={() => openPurchaseDetail(p)}>{getPurchaseItemSummary(p)}</button></td><td>{p.warehouse}</td><td>{money(p.total)}</td><td><label className={`tax-invoice-check${p.taxInvoiceReceived ? " checked" : ""}`}><input type="checkbox" checked={Boolean(p.taxInvoiceReceived)} disabled={!canUpdateTaxInvoice || Boolean(taxInvoiceSavingId)} onChange={(e) => onUpdateTaxInvoice(p, e.target.checked)} /><em>{taxInvoiceSavingId === p.id ? "ì €ì¥ ì¤‘" : p.taxInvoiceReceived ? "ë°›ìŒ" : "ë¯¸ìˆ˜ì·¨"}</em></label></td><td><AttachmentSummaryButton urls={p.image_urls || (p.image_url ? [p.image_url] : [])} onOpen={() => setAttachmentViewer({ title: `${p.vendor || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥"} Â· ${p.date || "-"}`, urls: p.image_urls || (p.image_url ? [p.image_url] : []) })} /></td><td>{isAdmin ? <><button className="icon" onClick={() => onLinkPhoto(p)}>ì‚¬ì§„</button><button className="icon" onClick={() => editPurchase(p)}><Pencil size={16} /></button><button className="icon" onClick={() => deletePurchase(p.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>})}</tbody></table></ScrollTable>{renderPurchasePages()}</section>
    {detailPurchase && (
      <div className="purchase-detail-modal-backdrop" onClick={() => setDetailPurchase(null)}>
        <div className="purchase-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="purchase-detail-modal-head">
            <div>
              <h2>ìƒì„¸ í’ˆëª©</h2>
              <p>{detailPurchase.vendor || "ê±°ë˜ì²˜ ë¯¸ì…ë ¥"} Â· {detailPurchase.date || "ë‚ ì§œ ì—†ìŒ"}</p>
            </div>
            <button onClick={() => setDetailPurchase(null)}>ë‹«ê¸°</button>
          </div>
          <ScrollTable>
            <table className="purchase-detail-table">
              <thead>
                <tr><th>í’ˆëª©</th><th>ê·œê²©</th><th>ìˆ˜ëŸ‰</th><th>ë‹¨ê°€</th><th>ê³µê¸‰ê°€ì•¡</th><th>ë¶€ê°€ì„¸ì•¡</th><th>í•©ê³„</th></tr>
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
            <span>ê³µê¸‰ê°€ì•¡ {money(detailPurchase.supplyTotal)}ì›</span>
            <span>ë¶€ê°€ì„¸ {money(detailPurchase.vatTotal)}ì›</span>
            <b>í•©ê³„ {money(detailPurchase.total)}ì›</b>
          </div>
          <div className="purchase-detail-attachment-box">
            <h3>ì²¨ë¶€íŒŒì¼</h3>
            <AttachmentGroup urls={detailPurchase.image_urls || (detailPurchase.image_url ? [detailPurchase.image_url] : [])} />
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

  const monthRangeText = (month: string) => {
    if (!/^\d{4}-\d{2}$/.test(month)) return "-";
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return `${month}-01 ~ ${month}-${String(lastDay).padStart(2, "0")}`;
  };

  const monthly = useMemo(() => {
    const vendorKeyword = vendor.trim();
    const itemKeyword = item.trim();

    const base = purchases.filter((p) => {
      const okVendor = !vendorKeyword || String(p.vendor || "").includes(vendorKeyword);
      const okItem = !itemKeyword || (p.rows || []).some((r) => String(r.item || "").includes(itemKeyword));
      return okVendor && okItem;
    });

    const selectedMonths = new Set<string>();

    if (from || to) {
      base.forEach((p) => {
        const date = String(p.date || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const month = date.slice(0, 7);
        const monthStart = `${month}-01`;
        const [year, monthNumber] = month.split("-").map(Number);
        const monthEnd = `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`;
        const overlapsFrom = !from || monthEnd >= from;
        const overlapsTo = !to || monthStart <= to;
        if (overlapsFrom && overlapsTo) selectedMonths.add(month);
      });
    }

    const map = new Map<string, { month: string; period: string; count: number; rowCount: number; supply: number; vat: number; total: number }>();

    base.forEach((p) => {
      const date = String(p.date || "");
      const month = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : "ë¯¸ì§€ì •";

      if ((from || to) && month !== "ë¯¸ì§€ì •" && !selectedMonths.has(month)) return;

      const cur = map.get(month) || {
        month,
        period: monthRangeText(month),
        count: 0,
        rowCount: 0,
        supply: 0,
        vat: 0,
        total: 0,
      };

      cur.count += 1;
      cur.rowCount += (p.rows || []).length;
      cur.supply += Number(p.supplyTotal || 0);
      cur.vat += Number(p.vatTotal || 0);
      cur.total += Number(p.total || 0);
      map.set(month, cur);
    });

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [purchases, from, to, vendor, item]);

  const byVendor = useMemo(() => {
    const map = new Map<string, { vendor: string; count: number; total: number }>();
    filtered.forEach((p) => {
      const name = p.vendor || "ë¯¸ì§€ì •";
      const cur = map.get(name) || { vendor: name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(p.total || 0);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  return (
    <section className="card">
      <div className="between"><h2>êµ¬ë§¤í˜„í™©</h2><button onClick={() => downloadExcel(`êµ¬ë§¤í˜„í™©_${todayText()}`, withTotalRow(
  filtered.flatMap((p) => (p.rows || []).map((r) => ({ ì¼ì: p.date, ê±°ë˜ì²˜: p.vendor, ì°½ê³ : p.warehouse, í’ˆëª©: r.item, ê·œê²©: r.spec, ìˆ˜ëŸ‰: r.qty, ë‹¨ê°€: r.price, ê³µê¸‰ê°€ì•¡: r.supply, ë¶€ê°€ì„¸ì•¡: r.vat, í•©ê³„: r.total }))),
  {
    ì¼ì: "ì´í•©ê³„",
    ìˆ˜ëŸ‰: filtered.reduce((sum, p) => sum + (p.rows || []).reduce((s, r) => s + Number(r.qty || 0), 0), 0),
    ë‹¨ê°€: filtered.reduce((sum, p) => sum + (p.rows || []).reduce((s, r) => s + Number(r.price || 0), 0), 0),
    ê³µê¸‰ê°€ì•¡: filtered.reduce((sum, p) => sum + Number(p.supplyTotal || 0), 0),
    ë¶€ê°€ì„¸ì•¡: filtered.reduce((sum, p) => sum + Number(p.vatTotal || 0), 0),
    í•©ê³„: filtered.reduce((sum, p) => sum + Number(p.total || 0), 0)
  }
))}>ì—‘ì…€ ë‹¤ìš´ë¡œë“œ</button></div>
      <div className="grid5">
        <Field label="ì‹œì‘ì¼"><DateInput value={from} onChange={setFrom} /></Field>
        <Field label="ì¢…ë£Œì¼"><DateInput value={to} onChange={setTo} /></Field>
        <Field label="ê±°ë˜ì²˜"><input placeholder="ê±°ë˜ì²˜ ì¼ë¶€ ê²€ìƒ‰" value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
        <Field label="í’ˆëª©"><input placeholder="í’ˆëª© ì¼ë¶€ ê²€ìƒ‰" value={item} onChange={(e) => setItem(e.target.value)} /></Field>
        <Field label="ì´ˆê¸°í™”"><button onClick={() => { setFrom(""); setTo(""); setVendor(""); setItem(""); }}>ê²€ìƒ‰ ì´ˆê¸°í™”</button></Field>
      </div>

      <div className="status-cards">
        <div><span>êµ¬ë§¤ê±´ìˆ˜</span><b>{filtered.length}ê±´</b></div>
        <div><span>í’ˆëª©í–‰ìˆ˜</span><b>{summary.rowCount}ê±´</b></div>
        <div><span>ê³µê¸‰ê°€ì•¡</span><b>{money(summary.totalSupply)}ì›</b></div>
        <div><span>ë¶€ê°€ì„¸ì•¡</span><b>{money(summary.totalVat)}ì›</b></div>
        <div><span>ì´í•©ê³„</span><b>{money(summary.total)}ì›</b></div>
      </div>

      <div className="between purchase-status-section-head">
        <div>
          <h3>ì›”ë³„ êµ¬ë§¤í˜„í™©</h3>
          <p className="muted">ì›”ë³„ ì§‘ê³„ëŠ” ì„ íƒí•œ ê¸°ê°„ì´ ì›” ì¤‘ê°„ì´ì–´ë„ í•´ë‹¹ ì›” 1ì¼~ë§ì¼ ì „ì²´ ê¸°ì¤€ìœ¼ë¡œ ê³„ì‚°ë©ë‹ˆë‹¤.</p>
        </div>
        <button onClick={() => downloadExcel(`ì›”ë³„êµ¬ë§¤í˜„í™©_${todayText()}`, withTotalRow(
          monthly.map((m) => ({
            ì›”: m.month,
            ì§‘ê³„ê¸°ê°„: m.period,
            êµ¬ë§¤ê±´ìˆ˜: m.count,
            í’ˆëª©í–‰ìˆ˜: m.rowCount,
            ê³µê¸‰ê°€ì•¡: m.supply,
            ë¶€ê°€ì„¸ì•¡: m.vat,
            í•©ê³„: m.total,
          })),
          {
            ì›”: "ì´í•©ê³„",
            ì§‘ê³„ê¸°ê°„: "-",
            êµ¬ë§¤ê±´ìˆ˜: monthly.reduce((sum, m) => sum + m.count, 0),
            í’ˆëª©í–‰ìˆ˜: monthly.reduce((sum, m) => sum + m.rowCount, 0),
            ê³µê¸‰ê°€ì•¡: monthly.reduce((sum, m) => sum + m.supply, 0),
            ë¶€ê°€ì„¸ì•¡: monthly.reduce((sum, m) => sum + m.vat, 0),
            í•©ê³„: monthly.reduce((sum, m) => sum + m.total, 0),
          }
        ))}>ì›”ë³„ ì—‘ì…€</button>
      </div>
      <ScrollTable>
        <table>
          <thead><tr><th>ì›”</th><th>ì§‘ê³„ê¸°ê°„</th><th>êµ¬ë§¤ê±´ìˆ˜</th><th>í’ˆëª©í–‰ìˆ˜</th><th>ê³µê¸‰ê°€ì•¡</th><th>ë¶€ê°€ì„¸ì•¡</th><th>í•©ê³„</th></tr></thead>
          <tbody>{!monthly.length ? <tr><td colSpan={7} className="empty">ì¡°íšŒëœ ì›”ë³„ êµ¬ë§¤í˜„í™© ì—†ìŒ</td></tr> : monthly.map((m) => <tr key={m.month}><td className="bold">{m.month}</td><td>{m.period}</td><td className="right">{money(m.count)}</td><td className="right">{money(m.rowCount)}</td><td className="right">{money(m.supply)}</td><td className="right">{money(m.vat)}</td><td className="right bold">{money(m.total)}</td></tr>)}</tbody>
        </table>
      </ScrollTable>

      <h3>ê±°ë˜ì²˜ë³„ êµ¬ë§¤í˜„í™©</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>ê±°ë˜ì²˜</th><th>êµ¬ë§¤ê±´ìˆ˜</th><th>í•©ê³„</th></tr></thead>
          <tbody>{!byVendor.length ? <tr><td colSpan={3} className="empty">ì¡°íšŒëœ ê±°ë˜ì²˜ ì—†ìŒ</td></tr> : byVendor.map((v) => <tr key={v.vendor}><td>{v.vendor}</td><td>{v.count}</td><td className="right bold">{money(v.total)}</td></tr>)}</tbody>
        </table>
      </ScrollTable>

      <h3>ìƒì„¸ êµ¬ë§¤ë‚´ì—­</h3>
      <ScrollTable>
        <table>
          <thead><tr><th>ì¼ì</th><th>ê±°ë˜ì²˜</th><th>ì°½ê³ </th><th>ëŒ€í‘œí’ˆëª©</th><th>ìˆ˜ëŸ‰</th><th>ê³µê¸‰ê°€ì•¡</th><th>ë¶€ê°€ì„¸ì•¡</th><th>í•©ê³„</th></tr></thead>
          <tbody>{!filtered.length ? <tr><td colSpan={8} className="empty">ì¡°íšŒëœ êµ¬ë§¤ë‚´ì—­ ì—†ìŒ</td></tr> : filtered.map((p) => <tr key={p.id}><td>{p.date}</td><td>{p.vendor}</td><td>{p.warehouse}</td><td>{getPurchaseItemSummary(p)}</td><td className="right">{money((p.rows || []).reduce((sum, r) => sum + Number(r.qty || 0), 0))}</td><td className="right">{money(p.supplyTotal)}</td><td className="right">{money(p.vatTotal)}</td><td className="right bold">{money(p.total)}</td></tr>)}</tbody>
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
  const progressItems = (schedules || []).filter((x: MaintenanceSchedule) => x.status === "ì§„í–‰ì¤‘");
  const doneItems = (schedules || []).filter((x: MaintenanceSchedule) => x.status === "ì™„ë£Œ");
  const urgentItems = (schedules || []).filter((x: MaintenanceSchedule) => x.priority === "ê¸´ê¸‰" && x.status !== "ì™„ë£Œ");

  return (
    <section className="maintenance-schedule-pro-list">
      <div className="schedule-list-head">
        <div>
          <span className="schedule-pro-eyebrow">Schedule Lookup</span>
          <h2>ì •ë¹„ì¼ì •ì¡°íšŒ</h2>
          <p>ë“±ë¡í•œ ì •ë¹„ì¼ì •ì„ ë‚ ì§œ, ìƒíƒœ, ìš°ì„ ìˆœìœ„ë³„ë¡œ í™•ì¸í•©ë‹ˆë‹¤.</p>
        </div>
        <button onClick={() => downloadExcel(`ì •ë¹„ì¼ì •_${todayText()}`, filtered.map((item: MaintenanceSchedule) => ({
          ì˜ˆì •ì¼: item.schedule_date,
          ì¥ë¹„ëª…: item.equipment_name,
          ì‘ì—…ë‚´ìš©: item.work_detail,
          ì‘ì—…ì: item.worker_name || "",
          ìš°ì„ ìˆœìœ„: item.priority || "",
          ìƒíƒœ: item.status || "",
          ë©”ëª¨: item.memo || "",
        })))}>ì—‘ì…€ ë‹¤ìš´ë¡œë“œ</button>
      </div>

      <div className="schedule-summary-grid">
        <div className="schedule-summary-card blue"><span>ì˜¤ëŠ˜ ì¼ì •</span><b>{todayItems.length}</b><small>ì˜¤ëŠ˜ ì˜ˆì •/ì§„í–‰/ì™„ë£Œ</small></div>
        <div className="schedule-summary-card purple"><span>ì§„í–‰ì¤‘</span><b>{progressItems.length}</b><small>í˜„ì¬ ì§„í–‰ ì‘ì—…</small></div>
        <div className="schedule-summary-card green"><span>ì™„ë£Œ</span><b>{doneItems.length}</b><small>ì™„ë£Œëœ ì‘ì—…</small></div>
        <div className="schedule-summary-card red"><span>ê¸´ê¸‰</span><b>{urgentItems.length}</b><small>ë¯¸ì™„ë£Œ ê¸´ê¸‰ ì‘ì—…</small></div>
      </div>

      <div className="schedule-filter-card">
        <Field label="ì‹œì‘ì¼"><DateInput value={from} onChange={setFrom} /></Field>
        <Field label="ì¢…ë£Œì¼"><DateInput value={to} onChange={setTo} /></Field>
        <Field label="ê²€ìƒ‰"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="ì¥ë¹„/ì‘ì—…ë‚´ìš©/ì‘ì—…ì ê²€ìƒ‰" /></Field>
        <Field label="ìƒíƒœ">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ì „ì²´</option><option>ì˜ˆì •</option><option>ì§„í–‰ì¤‘</option><option>ì™„ë£Œ</option>
          </select>
        </Field>
        <Field label="ìš°ì„ ìˆœìœ„">
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">ì „ì²´</option><option>ê¸´ê¸‰</option><option>ë†’ìŒ</option><option>ë³´í†µ</option><option>ë‚®ìŒ</option>
          </select>
        </Field>
        <button className="schedule-reset-btn" onClick={() => { setFrom(""); setTo(""); setKeyword(""); setStatus(""); setPriority(""); }}>ì´ˆê¸°í™”</button>
      </div>

      <div className="schedule-table-card">
        <ScrollTable>
          <table>
            <thead>
              <tr><th>ì˜ˆì •ì¼</th><th>ì¥ë¹„ëª…</th><th>ì‘ì—…ë‚´ìš©</th><th>ì‘ì—…ì</th><th>ìš°ì„ ìˆœìœ„</th><th>ìƒíƒœ</th><th>ë©”ëª¨</th><th>ê´€ë¦¬</th></tr>
            </thead>
            <tbody>
              {!filtered.length ? (
                <tr><td colSpan={8} className="empty">ë“±ë¡ëœ ì •ë¹„ì¼ì •ì´ ì—†ìŠµë‹ˆë‹¤.</td></tr>
              ) : filtered.map((item: MaintenanceSchedule) => (
                <tr key={item.id}>
                  <td className="bold">{item.schedule_date || "-"}</td>
                  <td>{item.equipment_name || "-"}</td>
                  <td>{item.work_detail || "-"}</td>
                  <td>{item.worker_name || "-"}</td>
                  <td><span className={`schedule-priority ${item.priority || "ë³´í†µ"}`}>{item.priority || "ë³´í†µ"}</span></td>
                  <td><span className={`schedule-status ${item.status || "ì˜ˆì •"}`}>{item.status || "ì˜ˆì •"}</span></td>
                  <td>{item.memo || "-"}</td>
                  <td>{isAdmin ? (
                    <div className="schedule-row-actions">
                      <button onClick={() => editSchedule(item)}>ìˆ˜ì •</button>
                      <button onClick={() => updateStatus(item, item.status === "ì™„ë£Œ" ? "ì˜ˆì •" : "ì™„ë£Œ")}>{item.status === "ì™„ë£Œ" ? "ì˜ˆì •" : "ì™„ë£Œ"}</button>
                      <button className="danger" onClick={() => deleteSchedule(item.id)}>ì‚­ì œ</button>
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
              <div><label>ì‘ì—…ë‚´ìš©</label><p>{item.work_detail}</p></div>
              <div><label>ì‘ì—…ì</label><p>{item.worker_name || "-"}</p></div>
              <div><label>ìš°ì„ ìˆœìœ„/ìƒíƒœ</label><p>{item.priority || "ë³´í†µ"} / {item.status || "ì˜ˆì •"}</p></div>
              <div><label>ë©”ëª¨</label><p>{item.memo || "-"}</p></div>
            </div>
            {isAdmin && (
              <div className="mobile-card-actions">
                <button onClick={() => editSchedule(item)}>ìˆ˜ì •</button>
                <button onClick={() => updateStatus(item, item.status === "ì™„ë£Œ" ? "ì˜ˆì •" : "ì™„ë£Œ")}>{item.status === "ì™„ë£Œ" ? "ì˜ˆì •" : "ì™„ë£Œ"}</button>
                <button onClick={() => deleteSchedule(item.id)}>ì‚­ì œ</button>
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
      const date = m.date || "ë‚ ì§œì—†ìŒ";
      const nextNo = (dateCounts.get(date) || 0) + 1;
      dateCounts.set(date, nextNo);
    });

    const running = new Map<string, number>();
    const map = new Map<string, string>();

    orderedByOldest.forEach((m) => {
      const date = m.date || "ë‚ ì§œì—†ìŒ";
      const nextNo = (running.get(date) || 0) + 1;
      running.set(date, nextNo);
      const displayDate = date === "ë‚ ì§œì—†ìŒ" ? "ë‚ ì§œì—†ìŒ" : date;
      map.set(m.id, `${displayDate}-${String(nextNo).padStart(2, "0")}`);
    });

    return map;
  }, [maints]);

  return (
    <section className="card lookup-page maint-lookup-page">
      <div className="between" style={{marginBottom:16}}>
        <h2 style={{margin:0}}>ì •ë¹„ì¡°íšŒ</h2>
        <div style={{display:"flex", gap:8}}>
          <button onClick={() => downloadExcel(`ì •ë¹„ì¡°íšŒ_${todayText()}`, withTotalRow(
            maints.map((m: Maint) => {
              const supply = Number(m.supplyTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.supply || 0), 0));
              const vat = Number(m.vatTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.vat || 0), 0));
              const total = Number(m.total || m.cost || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0));
              return { ê´€ë¦¬ë²ˆí˜¸: maintNoMap.get(m.id) || "", ì¼ì: m.date, ì°½ê³ : m.warehouse, ì œëª©: m.title, ë‚´ìš©: m.detail, ì‘ì—…ì: m.manager, ê³µê¸‰ê°€ì•¡: supply, ë¶€ê°€ì„¸: vat, í•©ê³„: total };
            }),
            {
              ê´€ë¦¬ë²ˆí˜¸: "ì´í•©ê³„",
              ê³µê¸‰ê°€ì•¡: maints.reduce((sum: number, m: Maint) => sum + Number(m.supplyTotal || (m.items || []).reduce((s: number, r: any) => s + Number(r.supply || 0), 0)), 0),
              ë¶€ê°€ì„¸: maints.reduce((sum: number, m: Maint) => sum + Number(m.vatTotal || (m.items || []).reduce((s: number, r: any) => s + Number(r.vat || 0), 0)), 0),
              í•©ê³„: maints.reduce((sum: number, m: Maint) => sum + Number(m.total || m.cost || (m.items || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)), 0)
            }
          ))}>ì—‘ì…€ ë‹¤ìš´ë¡œë“œ</button>
          <button className="primary" onClick={() => setMenuTab("maint_new")}>
            <Plus size={16} /> ì •ë¹„ë“±ë¡
          </button>
        </div>
      </div>

      <div className="maint-filter">
        <Field label="ì‹œì‘ì¼">
          <DateInput value={search.from || ""} onChange={(value) => setSearch({ ...search, from: value })} />
        </Field>
        <Field label="ì¢…ë£Œì¼">
          <DateInput value={search.to || ""} onChange={(value) => setSearch({ ...search, to: value })} />
        </Field>
        <Field label="ì°½ê³ ">
          <SearchSelect value={search.warehouse || ""} options={search.warehouseNames || []} onChange={(v) => setSearch({ ...search, warehouse: v })} placeholder="ì°½ê³  ì„ íƒ/ê²€ìƒ‰" />
        </Field>
        <Field label="ì œëª©/ë‚´ìš©/ì‘ì—…ì">
          <input placeholder="ê²€ìƒ‰ì–´ ì…ë ¥" value={search.keyword || ""} onChange={(e) => setSearch({ ...search, keyword: e.target.value })} />
        </Field>
        <Field label="ì´ˆê¸°í™”">
          <button onClick={() => setSearch({ ...search, from: "", to: "", warehouse: "", keyword: "" })}>ê²€ìƒ‰ ì´ˆê¸°í™”</button>
        </Field>
      </div>

      <ScrollTable>
        <table className="maint-lookup-table">
          <thead>
            <tr>
              <th>ê´€ë¦¬ë²ˆí˜¸</th>
              <th>ì°½ê³ </th>
              <th>ì‘ì—…ì</th>
              <th>ì œëª©</th>
              <th>ë‚´ìš©</th>
              <th>ê³µê¸‰ê°€ì•¡</th>
              <th>ë¶€ê°€ì„¸</th>
              <th>í•©ê³„</th>
              <th>ì²¨ë¶€</th>
              <th>ê´€ë¦¬</th>
            </tr>
          </thead>
          <tbody>
            {!maints.length ? (
              <tr><td colSpan={10} className="empty">ì €ì¥ëœ ì •ë¹„ë‚´ì—­ ì—†ìŒ</td></tr>
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
                        <button className="icon" onClick={() => onLinkPhoto(m)}>ì‚¬ì§„</button>
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
                <span>{money(total)}ì›</span>
              </div>

              <div className="mobile-list-body">
                <div><label>ì°½ê³ </label><p>{m.warehouse}</p></div>
                <div><label>ì‘ì—…ì</label><p>{m.manager || "-"}</p></div>
                <div><label>ì œëª©</label><p>{m.title}</p></div>
                <div><label>ë‚´ìš©</label><p>{m.detail || "-"}</p></div>
                <div><label>ê³µê¸‰ê°€ì•¡ / ë¶€ê°€ì„¸</label><p>{money(supply)}ì› / {money(vat)}ì›</p></div>
              </div>

              <div className="mobile-list-attachment">
                <AttachmentGroup urls={m.image_urls || (m.image_url ? [m.image_url] : [])} />
              </div>

              <div className="mobile-card-actions">
                {isAdmin ? (
                  <>
                    <button onClick={() => onLinkPhoto(m)}>ì‚¬ì§„ì—°ê²°</button>
                    <button onClick={() => editMaint(m)}>ìˆ˜ì •</button>
                    <button onClick={() => deleteMaint(m.id)}>ì‚­ì œ</button>
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
            <p><b>ê´€ë¦¬ë²ˆí˜¸:</b> {maintNoMap.get(selected.id) || "-"} / <b>ì¼ì:</b> {selected.date} / <b>ì°½ê³ :</b> {selected.warehouse} / <b>ì‘ì—…ì:</b> {selected.manager || "-"}</p>
            <p><b>ë‚´ìš©:</b> {selected.detail || "-"}</p>
            <div className="maint-modal-attachments">
              <b>ì²¨ë¶€:</b>
              <AttachmentGroup urls={selected.image_urls || (selected.image_url ? [selected.image_url] : [])} />
            </div>
            <ScrollTable>
              <table>
                <thead><tr><th>í’ˆëª©</th><th>ê·œê²©</th><th>ìˆ˜ëŸ‰</th><th>ë‹¨ê°€</th><th>ê³µê¸‰ê°€ì•¡</th><th>ë¶€ê°€ì„¸</th><th>í•©ê³„</th></tr></thead>
                <tbody>
                  {!(selected.items || []).length ? (
                    <tr><td colSpan={7} className="empty">ì‚¬ìš© í’ˆëª© ì—†ìŒ</td></tr>
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
            <div className="actions right-actions"><button onClick={() => setSelected(null)}>ë‹«ê¸°</button></div>
          </div>
        </div>
      )}
    </section>
  );
}





function getAttachmentKind(url?: string) {
  const cleanUrl = String(url || "");
  const lowerUrl = decodeURIComponent(cleanUrl.toLowerCase());
  const pathOnly = lowerUrl.split("?")[0];

  if (
    /\.(mp3|m4a|wav|webm|ogg|aac|mpeg|mp4)$/i.test(pathOnly) ||
    lowerUrl.includes("audio/") ||
    lowerUrl.includes("erp_file=audio") ||
    lowerUrl.includes(".mp3") ||
    lowerUrl.includes(".m4a") ||
    lowerUrl.includes(".wav") ||
    lowerUrl.includes(".webm") ||
    lowerUrl.includes(".ogg") ||
    lowerUrl.includes(".aac")
  ) return "audio";

  if (pathOnly.endsWith(".pdf") || lowerUrl.includes("application/pdf")) return "pdf";

  if (
    /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(pathOnly) ||
    lowerUrl.startsWith("blob:") ||
    lowerUrl.includes("/storage/")
  ) return "image";

  return "file";
}

function AttachmentPreview({ url }: { url?: string }) {
  if (!url) return <span>-</span>;

  const cleanUrl = String(url || "");
  const kind = getAttachmentKind(cleanUrl);

  if (kind === "audio") {
    return (
      <div className="audio-preview">
        <audio controls src={cleanUrl} preload="metadata" />
        <a href={cleanUrl} target="_blank" rel="noreferrer">ìŒì„±íŒŒì¼ ì—´ê¸°</a>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <a href={cleanUrl} target="_blank" rel="noreferrer" className="attachment-preview">
        <div className="pdf-thumb">PDF</div>
      </a>
    );
  }

  if (kind === "image") {
    return (
      <a href={cleanUrl} target="_blank" rel="noreferrer" className="attachment-preview">
        <img src={cleanUrl} alt="ì²¨ë¶€íŒŒì¼" />
      </a>
    );
  }

  return (
    <a href={cleanUrl} target="_blank" rel="noreferrer" className="attachment-file-link">
      íŒŒì¼ ì—´ê¸°
    </a>
  );
}

function AttachmentGroup({ urls, onRemove }: { urls?: string[]; onRemove?: (index: number) => void }) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return <span>-</span>;

  return (
    <div className="attachment-group">
      {list.map((url, idx) => (
        <div className="attachment-group-item" key={`${url}-${idx}`}>
          <AttachmentPreview url={url} />
          {onRemove && (
            <button
              type="button"
              className="attachment-remove-button"
              onClick={() => onRemove(idx)}
              aria-label={`ì²¨ë¶€íŒŒì¼ ${idx + 1} ì‚­ì œ`}
              title="ì²¨ë¶€ ì‚­ì œ"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AttachmentSummaryButton({
  urls,
  onOpen,
}: {
  urls?: string[];
  onOpen: () => void;
}) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return <span>-</span>;

  const counts = list.reduce(
    (acc, url) => {
      const kind = getAttachmentKind(url);
      if (kind === "image") acc.image += 1;
      else if (kind === "audio") acc.audio += 1;
      else if (kind === "pdf") acc.pdf += 1;
      else acc.file += 1;
      return acc;
    },
    { image: 0, audio: 0, pdf: 0, file: 0 }
  );

  return (
    <button type="button" className="attachment-summary-button" onClick={onOpen}>
      {!!counts.image && <span>ğŸ“· {counts.image}</span>}
      {!!counts.audio && <span>ğŸ¤ {counts.audio}</span>}
      {!!counts.pdf && <span>ğŸ“„ {counts.pdf}</span>}
      {!!counts.file && <span>ğŸ“ {counts.file}</span>}
    </button>
  );
}

function AttachmentViewerModal({
  viewer,
  onClose,
}: {
  viewer: { title: string; urls: string[] } | null;
  onClose: () => void;
}) {
  if (!viewer) return null;

  const urls = (viewer.urls || []).filter(Boolean);
  const imageUrls = urls.filter((url) => getAttachmentKind(url) === "image");
  const audioUrls = urls.filter((url) => getAttachmentKind(url) === "audio");
  const pdfUrls = urls.filter((url) => getAttachmentKind(url) === "pdf");
  const fileUrls = urls.filter((url) => getAttachmentKind(url) === "file");

  return (
    <div className="attachment-viewer-backdrop" onClick={onClose}>
      <div className="attachment-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="attachment-viewer-head">
          <div>
            <h2>ì²¨ë¶€íŒŒì¼</h2>
            <p>{viewer.title}</p>
          </div>
          <button onClick={onClose}>ë‹«ê¸°</button>
        </div>

        {!!imageUrls.length && (
          <div className="attachment-viewer-section">
            <h3>ì‚¬ì§„ {imageUrls.length}ê°œ</h3>
            <div className="attachment-viewer-image-grid">
              {imageUrls.map((url, idx) => (
                <a href={url} target="_blank" rel="noreferrer" key={`${url}-${idx}`}>
                  <img src={url} alt={`ì‚¬ì§„ ${idx + 1}`} />
                </a>
              ))}
            </div>
          </div>
        )}

        {!!audioUrls.length && (
          <div className="attachment-viewer-section">
            <h3>ìŒì„±ë©”ëª¨ {audioUrls.length}ê°œ</h3>
            <div className="attachment-viewer-audio-list">
              {audioUrls.map((url, idx) => (
                <div className="attachment-viewer-audio" key={`${url}-${idx}`}>
                  <b>ìŒì„± {idx + 1}</b>
                  <audio controls src={url} preload="metadata" />
                  <a href={url} target="_blank" rel="noreferrer">ìƒˆ ì°½ì—ì„œ ì—´ê¸°</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!pdfUrls.length && (
          <div className="attachment-viewer-section">
            <h3>PDF {pdfUrls.length}ê°œ</h3>
            <div className="attachment-viewer-link-list">
              {pdfUrls.map((url, idx) => (
                <a href={url} target="_blank" rel="noreferrer" key={`${url}-${idx}`}>PDF {idx + 1} ì—´ê¸°</a>
              ))}
            </div>
          </div>
        )}

        {!!fileUrls.length && (
          <div className="attachment-viewer-section">
            <h3>ê¸°íƒ€íŒŒì¼ {fileUrls.length}ê°œ</h3>
            <div className="attachment-viewer-link-list">
              {fileUrls.map((url, idx) => (
                <a href={url} target="_blank" rel="noreferrer" key={`${url}-${idx}`}>íŒŒì¼ {idx + 1} ì—´ê¸°</a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function Home({
  setMenuTab,
  setMaintSearch,
  warehouses,
  isAdmin,
  showToast,
}: {
  setMenuTab: (tab: string) => void;
  setMaintSearch: (value:×mûé¼­zÊ&ŠÛ^vã®†p€´ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí½ÁåAQ½5½‰¥±•ôùAŠK®ª£®ÂS²vğƒ®Î×²
°ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆ½¹±¥¬õíÍ…Ù•!½ÑÍÁ½Ñ1…å½ÕÑôùƒ²‚²z”ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÉ•Í•Ñ!½ÑÍÁ½Ñ1…å½ÕÑôû²Ò#ªâÃ¶fPğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ¼ø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¥ô(€€€€€€ğ½‘¥Øø((€€€€€í•‘¥Ñ1…å½ÕĞ€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±…å½ÕĞµ•‘¥ĞµÕ¥‘”ˆø(€€€€€€€€€ƒ¶b²z°€ñˆùí±…å½ÕÑ•Ù¥”€ôôô€‰µ½‰¥±”ˆ€ü€‹®ª£®ÂS²vó²j¤ˆ€è€‰A²j¤‰ôğ½ˆøƒ²Š3¶Fs®–ğƒ²†Ã²‚Tƒ²’G²z®.#®.¸(€€€€€€€€€ƒ®“®ª£®–ğƒ®Ns®zcªŞã¶VÓ²pƒ²r²æc®–ğƒ®{²ÚSªÎ€°ƒ²ƒ¶tƒ¶nƒªÂ®†p¿²ã®†pƒ®Ê¶*ó²ró®†pƒ¶³ªâÃ®–ğƒ²†Ã²‚W¶Vc²ã²jP¸(€€€€€€€€€íÍ•±•Ñ•‘!½ÑÍÁ½Ğ€ü€ñˆøƒ²ƒ¶w®B èíÍ•±•Ñ•‘!½ÑÍÁ½Ñôğ½ˆø€è¹Õ±±ô(€€€€€€€€€í±…å½ÕÑ5•ÍÍ…”€ü€ñÍÑÉ½¹œùí±…å½ÕÑ5•ÍÍ…•ôğ½ÍÑÉ½¹œø€è¹Õ±±ô(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí•‘¥Ñ1…å½ÕĞ€ü€‰±…å½ÕĞµµ…À•‘¥Ñ¥¹œˆ€è€‰±…å½ÕĞµµ…À‰ôø(€€€€€€€€ñ¥µœÍÉŒôˆ½±¥¹”µ±…å½ÕĞ¹Á¹œˆ…±Ğô‹²w²
Ã®vó²vàƒªÖ³²Ç®>ˆ€¼ø((€€€€€€€í…Ñ¥Ù•!½ÑÍÁ½ÑÌ¹µ…À ¡ÍÁ½Ğè…¹ä¤€ôø€ (€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€­•äõíÍÁ½Ğ¹¹…µ•ô(€€€€€€€€€€€±…ÍÍ9…µ”õíÍ•±•Ñ•‘!½ÑÍÁ½Ğ€ôôôÍÁ½Ğ¹¹…µ”€ü€‰±…å½ÕĞµ¡½ÑÍÁ½ĞÍ•±•Ñ•ˆ€è€‰±…å½ÕĞµ¡½ÑÍÁ½Ğ‰ô(€€€€€€€€€€€ÍÑå±”õíì(€€€€€€€€€€€€€±•™Ğè€‘íÍÁ½Ğ¹±•™Ñô•€°(€€€€€€€€€€€€€Ñ½Àè€‘íÍÁ½Ğ¹Ñ½Áô•€°(€€€€€€€€€€€€€İ¥‘Ñ è€‘íÍÁ½Ğ¹İ¥‘Ñ¡ô•€°(€€€€€€€€€€€€€¡•¥¡Ğè€‘íÍÁ½Ğ¹¡•¥¡Ñô•€°(€€€€€€€€€€€õô(€€€€€€€€€€€Ñ¥Ñ±”õí€‘íÍÁ½Ğ¹¹…µ•ôƒ²‚W®æ²vÓ®‚”ƒ®ÎÓªâÁô(€€€€€€€€€€€½¹A½¥¹Ñ•É½İ¸õì¡”¤€ôøì(€€€€€€€€€€€€€¥˜€¡•‘¥Ñ1…å½ÕĞ¤ì(€€€€€€€€€€€€€€€”¹ÕÉÉ•¹ÑQ…É•Ğ¹Í•ÑA½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤ì(€€€€€€€€€€€€€€€Í•ÑM•±•Ñ•‘!½ÑÍÁ½Ğ¡ÍÁ½Ğ¹¹…µ”¤ì(€€€€€€€€€€€€€€€µ½Ù•!½ÑÍÁ½Ğ¡ÍÁ½Ğ¹¹…µ”°”¤ì(€€€€€€€€€€€€€ô(€€€€€€€€€€€õô(€€€€€€€€€€€½¹A½¥¹Ñ•É5½Ù”õì¡”¤€ôøì(€€€€€€€€€€€€€¥˜€¡•‘¥Ñ1…å½ÕĞ€˜˜”¹ÕÉÉ•¹ÑQ…É•Ğ¹¡…ÍA½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤¤ì(€€€€€€€€€€€€€€€µ½Ù•!½ÑÍÁ½Ğ¡ÍÁ½Ğ¹¹…µ”°”¤ì(€€€€€€€€€€€€€ô(€€€€€€€€€€€õô(€€€€€€€€€€€½¹A½¥¹Ñ•ÉUÀõì¡”¤€ôøì(€€€€€€€€€€€€€¥˜€¡•‘¥Ñ1…å½ÕĞ€˜˜”¹ÕÉÉ•¹ÑQ…É•Ğ¹¡…ÍA½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤¤ì(€€€€€€€€€€€€€€€”¹ÕÉÉ•¹ÑQ…É•Ğ¹É•±•…Í•A½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤ì(€€€€€€€€€€€€€ô(€€€€€€€€€€€õô(€€€€€€€€€€€½¹A½¥¹Ñ•É…¹•°õì¡”¤€ôøì(€€€€€€€€€€€€€¥˜€¡•‘¥Ñ1…å½ÕĞ€˜˜”¹ÕÉÉ•¹ÑQ…É•Ğ¹¡…ÍA½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤¤ì(€€€€€€€€€€€€€€€”¹ÕÉÉ•¹ÑQ…É•Ğ¹É•±•…Í•A½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤ì(€€€€€€€€€€€€€ô(€€€€€€€€€€€õô(€€€€€€€€€€€½¹±¥¬õì¡”¤€ôøì(€€€€€€€€€€€€€¥˜€¡•‘¥Ñ1…å½ÕĞ¤ì(€€€€€€€€€€€€€€€”¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€€€€€€€€€€€€€”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€€€€€€€€€Í•ÑM•±•Ñ•‘!½ÑÍÁ½Ğ¡ÍÁ½Ğ¹¹…µ”¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€ô((€€€€€€€€€€€€€½Á•¹5…¥¹Ñ!¥ÍÑ½Éä¡ÍÁ½Ğ¹¹…µ”¤ì(€€€€€€€€€€€õô(€€€€€€€€€€ø(€€€€€€€€€€€€ñÍÁ…¸ùíÍÁ½Ğ¹¹…µ•ôğ½ÍÁ…¸ø(€€€€€€€€€€€í•‘¥Ñ1…å½ÕĞ€˜˜Í•±•Ñ•‘!½ÑÍÁ½Ğ€ôôôÍÁ½Ğ¹¹…µ”€˜˜€ (€€€€€€€€€€€€€€ñ¤(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰±…å½ÕĞµÉ•Í¥é”µ¡…¹‘±”ˆ(€€€€€€€€€€€€€€€½¹A½¥¹Ñ•É½İ¸õì¡”¤€ôøì(€€€€€€€€€€€€€€€€€”¹ÕÉÉ•¹ÑQ…É•Ğ¹Í•ÑA½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤ì(€€€€€€€€€€€€€€€€€Í•ÑI•Í¥é¥¹!½ÑÍÁ½Ğ¡ÍÁ½Ğ¹¹…µ”¤ì(€€€€€€€€€€€€€€€€€É•Í¥é•!½ÑÍÁ½Ñ	åA½¥¹Ñ•È¡ÍÁ½Ğ¹¹…µ”°”¤ì(€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€½¹A½¥¹Ñ•É5½Ù”õì¡”¤€ôøì(€€€€€€€€€€€€€€€€€¥˜€¡É•Í¥é¥¹!½ÑÍÁ½Ğ€ôôôÍÁ½Ğ¹¹…µ”€˜˜”¹ÕÉÉ•¹ÑQ…É•Ğ¹¡…ÍA½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤¤ì(€€€€€€€€€€€€€€€€€€€É•Í¥é•!½ÑÍÁ½Ñ	åA½¥¹Ñ•È¡ÍÁ½Ğ¹¹…µ”°”¤ì(€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€½¹A½¥¹Ñ•ÉUÀõì¡”¤€ôøì(€€€€€€€€€€€€€€€€€¥˜€¡”¹ÕÉÉ•¹ÑQ…É•Ğ¹¡…ÍA½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤¤ì(€€€€€€€€€€€€€€€€€€€”¹ÕÉÉ•¹ÑQ…É•Ğ¹É•±•…Í•A½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤ì(€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€Í•ÑI•Í¥é¥¹!½ÑÍÁ½Ğ ˆˆ¤ì(€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€½¹A½¥¹Ñ•É…¹•°õì¡”¤€ôøì(€€€€€€€€€€€€€€€€€¥˜€¡”¹ÕÉÉ•¹ÑQ…É•Ğ¹¡…ÍA½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤¤ì(€€€€€€€€€€€€€€€€€€€”¹ÕÉÉ•¹ÑQ…É•Ğ¹É•±•…Í•A½¥¹Ñ•É…ÁÑÕÉ”¡”¹Á½¥¹Ñ•É%¤ì(€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€Í•ÑI•Í¥é¥¹!½ÑÍÁ½Ğ ˆˆ¤ì(€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½Í•Ñ¥½¸ø(€€¤ì)ô((()ÑåÁ”	¥‘I•¥½¹¥±Ñ•È€ô€‰±½…°ˆğ€‰…±°ˆğ€‰‘…•©•½¸ˆğ€‰Í•©½¹œˆğ€‰¡Õ¹¹…´ˆì()½¹ÍĞ	%}I%=9}1	1LèI•½Éñ	¥‘I•¥½¹¥±Ñ•È°ÍÑÉ¥¹œø€ôì(€±½…°è€‹²jÃ®š°ƒ²²^´ˆ°(€…±°è€‹²‚²ÊĞƒ²²^´ˆ°(€‘…•©•½¸è€‹®2²‚ˆ°(€Í•©½¹œè€‹²ã²Šˆ°(€¡Õ¹¹…´è€‹²Ú§®
 ˆ°)ôì()½¹ÍĞ	%}I%=9}-e]=ILèI•½Éñá±Õ‘”ñ	¥‘I•¥½¹¥±Ñ•È°€‰±½…°ˆğ€‰…±°ˆø°ÍÑÉ¥¹mtø€ôì(€‘…•©•½¸èl‹®2²‚ˆ°€‹®2²‚ªÒG²^·².p‰t°(€Í•©½¹œèl‹²ã²Šˆ°€‹²ã²Š¶*ç®Î²zC²æc².p‰t°(€¡Õ¹¹…´èl(€€€€‹²Ú§®
 ˆ°€‹²Ú§²Ê·®
£®>ˆ°€‹²Ês²V ˆ°€‹ªÎ×²ğˆ°€‹®ÎÓ®‚äˆ°€‹²V²
Àˆ°€‹²s²
Àˆ°€‹®ó²
Àˆ°€‹ªÎ®„ˆ°€‹®.ç²ˆ°(€€€€‹ªâ#²
Àˆ°€‹®Ú²^°ˆ°€‹²s²Êpˆ°€‹²Ê·²ZDˆ°€‹¶f7²Äˆ°€‹²b#²
Àˆ°€‹¶s²V ˆ°(€t°)ôì()½¹ÍĞÑ½	¥‘…Ñ•%¹ÁÕĞ€ô€¡‘…Ñ”è…Ñ”¤€ôøì(€½¹ÍĞå•…È€ô‘…Ñ”¹•ÑÕ±±e•…È ¤ì(€½¹ÍĞµ½¹Ñ €ôMÑÉ¥¹œ¡‘…Ñ”¹•Ñ5½¹Ñ  ¤€¬€Ä¤¹Á…‘MÑ…ÉĞ È°€ˆÀˆ¤ì(€½¹ÍĞ‘…ä€ôMÑÉ¥¹œ¡‘…Ñ”¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°€ˆÀˆ¤ì(€É•ÑÕÉ¸€‘íå•…Éô´‘íµ½¹Ñ¡ô´‘í‘…åõ€ì)ôì()½¹ÍĞ•Ñ	¥‘EÕ¥­I…¹”€ô€¡‘…åÌè¹Õµ‰•È¤€ôøì(€½¹ÍĞÑ¼€ô¹•Ü…Ñ” ¤ì(€½¹ÍĞ™É½´€ô¹•Ü…Ñ”¡Ñ¼¤ì(€™É½´¹Í•Ñ…Ñ”¡™É½´¹•Ñ…Ñ” ¤€´5…Ñ ¹µ…à À°‘…åÌ€´€Ä¤¤ì(€É•ÑÕÉ¸ì™É½´èÑ½	¥‘…Ñ•%¹ÁÕĞ¡™É½´¤°Ñ¼èÑ½	¥‘…Ñ•%¹ÁÕĞ¡Ñ¼¤ôì)ôì()™Õ¹Ñ¥½¸	¥‘9½Ñ¥•A…”¡ìÕÉÉ•¹ÑI½±”ôèìÕÉÉ•¹ÑI½±”èUÍ•ÉI½±”ô¤ì(€½¹ÍĞmÍ½ÕÉ”°Í•ÑM½ÕÉ•t€ôÕÍ•MÑ…Ñ”ğ‰…±°ˆğ€‰œÉˆˆğ€‰± ˆø ‰…±°ˆ¤ì(€½¹ÍĞmÍ•…É °Í•ÑM•…É¡t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞm¥¹±Õ‘•%¹ÁÕĞ°Í•Ñ%¹±Õ‘•%¹ÁÕÑt€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞm•á±Õ‘•%¹ÁÕĞ°Í•Ñá±Õ‘•%¹ÁÕÑt€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞm­•åİ½É‘5•ÍÍ…”°Í•Ñ-•åİ½É‘5•ÍÍ…•t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞm‰¥‘9½Ñ¥•Ì°Í•Ñ	¥‘9½Ñ¥•Ít€ôÕÍ•MÑ…Ñ”ñÉÉ…äñì(€€€¥èÍÑÉ¥¹œìÍ½ÕÉ”èÍÑÉ¥¹œì‰ÕÍ¥¹•ÍÍQåÁ”èÍÑÉ¥¹œì‰¥‘9¼èÍÑÉ¥¹œìÑ¥Ñ±”èÍÑÉ¥¹œì(€€€…•¹äèÍÑÉ¥¹œì¹½Ñ¥•…Ñ”èÍÑÉ¥¹œì‘•…‘±¥¹”èÍÑÉ¥¹œì…µ½Õ¹Ğè¹Õµ‰•ÈìÕÉ°èÍÑÉ¥¹œì(€ôøø¡mt¤ì(€½¹ÍĞm‰¥‘1½…‘¥¹œ°Í•Ñ	¥‘1½…‘¥¹t€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€½¹ÍĞm‰¥‘ÉÉ½È°Í•Ñ	¥‘ÉÉ½Ét€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞm‰¥‘•Ñ¡•‘Ğ°Í•Ñ	¥‘•Ñ¡•‘Ñt€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞm‰¥‘¥±Ñ•ÉÌ°Í•Ñ	¥‘¥±Ñ•ÉÍt€ôÕÍ•MÑ…Ñ”ñìÉ•¥½¸è	¥‘I•¥½¹¥±Ñ•Èì™É½´èÍÑÉ¥¹œìÑ¼èÍÑÉ¥¹œôø  ¤€ôøì(€€€½¹ÍĞ‘•™…Õ±ÑÌ€ôìÉ•¥½¸è€‰±½…°ˆ…Ì	¥‘I•¥½¹¥±Ñ•È°€¸¸¹•Ñ	¥‘EÕ¥­I…¹” ÌÀ¤ôì(€€€ÑÉäì(€€€€€½¹ÍĞÍ…Ù•€ôİ¥¹‘½Ü¹±½…±MÑ½É…”¹•Ñ%Ñ•´ ‰•ÉÁ}‰¥‘}™¥±Ñ•É}Í•ÑÑ¥¹Í}ØÄˆ¤ì(€€€€€¥˜€ …Í…Ù•¤É•ÑÕÉ¸‘•™…Õ±ÑÌì(€€€€€½¹ÍĞÁ…ÉÍ•€ô)M=8¹Á…ÉÍ”¡Í…Ù•¤ì(€€€€€½¹ÍĞ…±±½İ•‘I•¥½¹Ìè	¥‘I•¥½¹¥±Ñ•Émt€ôl‰±½…°ˆ°€‰…±°ˆ°€‰‘…•©•½¸ˆ°€‰Í•©½¹œˆ°€‰¡Õ¹¹…´‰tì(€€€€€½¹ÍĞ‘…Ñ•A…ÑÑ•É¸€ô€½yq‘ìÑôµq‘ìÉôµq‘ìÉô¼ì(€€€€€É•ÑÕÉ¸ì(€€€€€€€É•¥½¸è…±±½İ•‘I•¥½¹Ì¹¥¹±Õ‘•Ì¡Á…ÉÍ•ü¹É•¥½¸¤€üÁ…ÉÍ•¹É•¥½¸€è‘•™…Õ±ÑÌ¹É•¥½¸°(€€€€€€€™É½´è‘…Ñ•A…ÑÑ•É¸¹Ñ•ÍĞ¡Á…ÉÍ•ü¹™É½´ñğ€ˆˆ¤€üÁ…ÉÍ•¹™É½´€è‘•™…Õ±ÑÌ¹™É½´°(€€€€€€€Ñ¼è‘…Ñ•A…ÑÑ•É¸¹Ñ•ÍĞ¡Á…ÉÍ•ü¹Ñ¼ñğ€ˆˆ¤€üÁ…ÉÍ•¹Ñ¼€è‘•™…Õ±ÑÌ¹Ñ¼°(€€€€€ôì(€€€ô…Ñ ì(€€€€€É•ÑÕÉ¸‘•™…Õ±ÑÌì(€€€ô(€ô¤ì(€½¹ÍĞm­•åİ½É‘Ì°Í•Ñ-•åİ½É‘Ít€ôÕÍ•MÑ…Ñ”ñì¥¹±Õ‘”èÍÑÉ¥¹mtì•á±Õ‘”èÍÑÉ¥¹mtôø  ¤€ôøì(€€€ÑÉäì(€€€€€½¹ÍĞÍ…Ù•€ôİ¥¹‘½Ü¹±½…±MÑ½É…”¹•Ñ%Ñ•´ ‰•ÉÁ}‰¥‘}­•åİ½É‘}Í•ÑÑ¥¹Í}ØÄˆ¤ì(€€€€€¥˜€¡Í…Ù•¤ì(€€€€€€€½¹ÍĞÁ…ÉÍ•€ô)M=8¹Á…ÉÍ”¡Í…Ù•¤ì(€€€€€€€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡Á…ÉÍ•ü¹¥¹±Õ‘”¤€˜˜ÉÉ…ä¹¥ÍÉÉ…ä¡Á…ÉÍ•ü¹•á±Õ‘”¤¤ì(€€€€€€€€€É•ÑÕÉ¸ì¥¹±Õ‘”èÁ…ÉÍ•¹¥¹±Õ‘”°•á±Õ‘”èÁ…ÉÍ•¹•á±Õ‘”ôì(€€€€€€€ô(€€€€€ô(€€€ô…Ñ ì(€€€€€€¼¼ƒ²‚²z—ªÂK²vĞƒ²C²®BpƒªÊ÷²jÀƒªâÃ®Îàƒ¶
“²n3®Ns®–ğƒ²
³²j§¶V§®.#®.¸(€€€ô(€€€É•ÑÕÉ¸ì¥¹±Õ‘”èl‹ªÎ£²z°ˆ°€‹²z‡²tˆ°€‹²²tˆ°€‹¶bó¶V§ªÎ£²z°‰t°•á±Õ‘”èl‹²"s¶fcªÎ£²z°‰tôì(€ô¤ì(€½¹ÍĞ…¹‘¥Ñ-•åİ½É‘Ì€ôÕÉÉ•¹ÑI½±”€ôôô€‰…‘µ¥¸ˆñğÕÉÉ•¹ÑI½±”€ôôô€‰½™™¥”ˆì((€½¹ÍĞ…‘‘-•åİ½É€ô€¡­¥¹è€‰¥¹±Õ‘”ˆğ€‰•á±Õ‘”ˆ¤€ôøì(€€€¥˜€ ……¹‘¥Ñ-•åİ½É‘Ì¤É•ÑÕÉ¸ì(€€€½¹ÍĞÙ…±Õ”€ô€¡­¥¹€ôôô€‰¥¹±Õ‘”ˆ€ü¥¹±Õ‘•%¹ÁÕĞ€è•á±Õ‘•%¹ÁÕĞ¤¹ÑÉ¥´ ¤ì(€€€¥˜€ …Ù…±Õ”¤É•ÑÕÉ¸Í•Ñ-•åİ½É‘5•ÍÍ…” ‹²ÚSªÂ¶V€ƒ¶
“²n3®Ns®–ğƒ²z®‚—¶VĞƒ²ó²ã²jP¸ˆ¤ì(€€€¥˜€¡l¸¸¹­•åİ½É‘Ì¹¥¹±Õ‘”°€¸¸¹­•åİ½É‘Ì¹•á±Õ‘•t¹Í½µ” ¡­•åİ½É¤€ôø­•åİ½É¹Ñ½1½İ•É…Í” ¤€ôôôÙ…±Õ”¹Ñ½1½İ•É…Í” ¤¤¤ì(€€€€€É•ÑÕÉ¸Í•Ñ-•åİ½É‘5•ÍÍ…” ‹²vÓ®¾àƒ®NÇ®†w®Bpƒ¶
“²n3®Ns²z®.#®.¸ˆ¤ì(€€€ô(€€€Í•Ñ-•åİ½É‘Ì ¡ÕÉÉ•¹Ğ¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°m­¥¹‘tèl¸¸¹ÕÉÉ•¹Ñm­¥¹‘t°Ù…±Õ•tô¤¤ì(€€€¥˜€¡­¥¹€ôôô€‰¥¹±Õ‘”ˆ¤Í•Ñ%¹±Õ‘•%¹ÁÕĞ ˆˆ¤ì(€€€•±Í”Í•Ñá±Õ‘•%¹ÁÕĞ ˆˆ¤ì(€€€Í•Ñ-•åİ½É‘5•ÍÍ…” ‹®ÎªÊ÷²
³¶V·²vƒ²‚²z—¶VĞƒ²ó²ã²jP¸ˆ¤ì(€ôì((€½¹ÍĞÉ•µ½Ù•-•åİ½É€ô€¡­¥¹è€‰¥¹±Õ‘”ˆğ€‰•á±Õ‘”ˆ°­•åİ½ÉèÍÑÉ¥¹œ¤€ôøì(€€€¥˜€ ……¹‘¥Ñ-•åİ½É‘Ì¤É•ÑÕÉ¸ì(€€€Í•Ñ-•åİ½É‘Ì ¡ÕÉÉ•¹Ğ¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°m­¥¹‘tèÕÉÉ•¹Ñm­¥¹‘t¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´€„ôô­•åİ½É¤ô¤¤ì(€€€Í•Ñ-•åİ½É‘5•ÍÍ…” ‹®ÎªÊ÷²
³¶V·²vƒ²‚²z—¶VĞƒ²ó²ã²jP¸ˆ¤ì(€ôì((€½¹ÍĞÍ…Ù•-•åİ½É‘Ì€ô€ ¤€ôøì(€€€¥˜€ ……¹‘¥Ñ-•åİ½É‘Ì¤É•ÑÕÉ¸ì(€€€¥˜€ …­•åİ½É‘Ì¹¥¹±Õ‘”¹±•¹Ñ ¤É•ÑÕÉ¸Í•Ñ-•åİ½É‘5•ÍÍ…” ‹¶>³¶V ƒ¶
“²n3®Ns®*Pƒ¶VpƒªÂpƒ²vÓ²ƒ¶V²jS¶V§®.#®.¸ˆ¤ì(€€€İ¥¹‘½Ü¹±½…±MÑ½É…”¹Í•Ñ%Ñ•´ ‰•ÉÁ}‰¥‘}­•åİ½É‘}Í•ÑÑ¥¹Í}ØÄˆ°)M=8¹ÍÑÉ¥¹¥™ä¡­•åİ½É‘Ì¤¤ì(€€€Í•Ñ-•åİ½É‘5•ÍÍ…” ‹¶
“²n3®Npƒ²“²‚W²vƒ²‚²z—¶Z#²*×®.#®.¸ˆ¤ì(€ôì((€½¹ÍĞ¡…¹‘±•-•åİ½É‘-•å½İ¸€ô€¡•Ù•¹ĞèI•…Ğ¹-•å‰½…É‘Ù•¹Ğñ!Q51%¹ÁÕÑ±•µ•¹Ğø°­¥¹è€‰¥¹±Õ‘”ˆğ€‰•á±Õ‘”ˆ¤€ôøì(€€€¥˜€¡•Ù•¹Ğ¹­•ä€„ôô€‰¹Ñ•Èˆ¤É•ÑÕÉ¸ì(€€€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ì(€€€…‘‘-•åİ½É¡­¥¹¤ì(€ôì((€½¹ÍĞ±½…‘É‰9½Ñ¥•Ì€ô…Íå¹Œ€ ¤€ôøì(€€€Í•Ñ	¥‘1½…‘¥¹œ¡ÑÉÕ”¤ì(€€€Í•Ñ	¥‘ÉÉ½È ˆˆ¤ì(€€€ÑÉäì(€€€€€½¹ÍĞ™É½µ…Ñ”€ô¹•Ü…Ñ”¡€‘í‰¥‘¥±Ñ•ÉÌ¹™É½µõPÀÀèÀÀèÀÁ€¤ì(€€€€€½¹ÍĞÑ½…Ñ”€ô¹•Ü…Ñ”¡€‘í‰¥‘¥±Ñ•ÉÌ¹Ñ½õPÈÌèÔäèÔå€¤ì(€€€€€½¹ÍĞÉ…¹•…åÌ€ô5…Ñ ¹™±½½È ¡Ñ½…Ñ”¹•ÑQ¥µ” ¤€´™É½µ…Ñ”¹•ÑQ¥µ” ¤¤€¼€àØĞÀÀÀÀÀ¤€¬€Äì(€€€€€¥˜€ …‰¥‘¥±Ñ•ÉÌ¹™É½´ñğ€…‰¥‘¥±Ñ•ÉÌ¹Ñ¼ñğ9Õµ‰•È¹¥Í9…8¡É…¹•…åÌ¤¤Ñ¡É½Ü¹•ÜÉÉ½È ‹²†Ã¶j0ƒ².s²zG²vóªÎğƒ²Š®3²vó²vƒ²ƒ¶w¶VĞƒ²ó²ã²jP¸ˆ¤ì(€€€€€¥˜€¡É…¹•…åÌ€ğ€Ä¤Ñ¡É½Ü¹•ÜÉÉ½È ‹².s²zG²vó²v ƒ²Š®3²vó®ÎÓ®.ƒ®*›²vƒ²"`ƒ²^²*×®.#®.¸ˆ¤ì(€€€€€¥˜€¡É…¹•…åÌ€ø€äÀ¤Ñ¡É½Ü¹•ÜÉÉ½È ‹²†Ã¶j3ªâÃªÂ²v ƒ²Ös®2 €äÃ²vóªæ3² ƒ²ƒ¶w¶V€ƒ²"`ƒ²z#²*×®.#®.¸ˆ¤ì(€€€€€½¹ÍĞÁ…É…µÌ€ô¹•ÜUI1M•…É¡A…É…µÌ¡ì(€€€€€€€¥¹±Õ‘”è­•åİ½É‘Ì¹¥¹±Õ‘”¹©½¥¸ ˆ°ˆ¤°(€€€€€€€•á±Õ‘”è­•åİ½É‘Ì¹•á±Õ‘”¹©½¥¸ ˆ°ˆ¤°(€€€€€€€™É½´è‰¥‘¥±Ñ•ÉÌ¹™É½´°(€€€€€€€Ñ¼è‰¥‘¥±Ñ•ÉÌ¹Ñ¼°(€€€€€ô¤ì(€€€€€½¹ÍĞÉ•ÍÁ½¹Í”€ô…İ…¥Ğ™•Ñ ¡€½…Á¤½œÉˆü‘íÁ…É…µÌ¹Ñ½MÑÉ¥¹œ ¥õ€¤ì(€€€€€½¹ÍĞÁ…å±½…€ô…İ…¥ĞÉ•ÍÁ½¹Í”¹©Í½¸ ¤¹…Ñ   ¤€ôø€¡íô¤¤ì(€€€€€¥˜€ …É•ÍÁ½¹Í”¹½¬¤Ñ¡É½Ü¹•ÜÉÉ½È¡Á…å±½…ü¹•ÉÉ½ÈñğƒªÎ×ªÎ€ƒ²†Ã¶j0ƒ².“¶2 € ‘íÉ•ÍÁ½¹Í”¹ÍÑ…ÑÕÍô¥€¤ì(€€€€€Í•Ñ	¥‘9½Ñ¥•Ì¡ÉÉ…ä¹¥ÍÉÉ…ä¡Á…å±½…ü¹¹½Ñ¥•Ì¤€üÁ…å±½…¹¹½Ñ¥•Ì€èmt¤ì(€€€€€Í•Ñ	¥‘•Ñ¡•‘Ğ¡Á…å±½…ü¹™•Ñ¡•‘Ğñğ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¤ì(€€€€€¥˜€¡Á…å±½…ü¹™…¥±•‘…±±Ì¤Í•Ñ	¥‘ÉÉ½È¡ƒ²vó®Ú ƒªÎ×ªÎ€ƒ²†Ã¶j0€‘íÁ…å±½…¹™…¥±•‘…±±Í÷ªÆÓ²vĞƒ².“¶2£¶Z#²*×®.#®.¸ƒ¶Fs².s®BpƒªÎ×ªÎƒ®*Pƒ²‚W²ƒ²†Ã¶j3®Ú²z®.#®.¹€¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€Í•Ñ	¥‘9½Ñ¥•Ì¡mt¤ì(€€€€€Í•Ñ	¥‘ÉÉ½È¡•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€è€‹®
c®vó²z—¶ÀƒªÎ×ªÎƒ®–ğƒ®Ú#®~³²b“² ƒ®ªï¶Z#²*×®.#®.¸ˆ¤ì(€€€ô™¥¹…±±äì(€€€€€Í•Ñ	¥‘1½…‘¥¹œ¡™…±Í”¤ì(€€€ô(€ôì((€ÕÍ•™™•Ğ  ¤€ôøì(€€€Ù½¥±½…‘É‰9½Ñ¥•Ì ¤ì(€€€€¼¼ƒ²Ê¬ƒ²²zƒ².pƒ²‚²z—®Bpƒ¶
“²n3®Ns®†pƒ¶Vpƒ®Ê#®0ƒ²†Ã¶j3¶V§®.#®.¸(€€€€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ¹•áĞµ±¥¹”É•…Ğµ¡½½­Ì½•á¡…ÕÍÑ¥Ù”µ‘•ÁÌ(€ô°mt¤ì((€ÕÍ•™™•Ğ  ¤€ôøì(€€€İ¥¹‘½Ü¹±½…±MÑ½É…”¹Í•Ñ%Ñ•´ ‰•ÉÁ}‰¥‘}™¥±Ñ•É}Í•ÑÑ¥¹Í}ØÄˆ°)M=8¹ÍÑÉ¥¹¥™ä¡‰¥‘¥±Ñ•ÉÌ¤¤ì(€ô°m‰¥‘¥±Ñ•ÉÍt¤ì((€½¹ÍĞÍ•ÑEÕ¥­I…¹”€ô€¡‘…åÌè¹Õµ‰•È¤€ôøì(€€€Í•Ñ	¥‘¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ğ¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°€¸¸¹•Ñ	¥‘EÕ¥­I…¹”¡‘…åÌ¤ô¤¤ì(€ôì((€½¹ÍĞµ…Ñ¡•Í	¥‘I•¥½¸€ô€¡¹½Ñ¥”èì…•¹äèÍÑÉ¥¹œìÉ•¥½¹Q•áĞüèÍÑÉ¥¹œô¤€ôøì(€€€¥˜€¡‰¥‘¥±Ñ•ÉÌ¹É•¥½¸€ôôô€‰…±°ˆ¤É•ÑÕÉ¸ÑÉÕ”ì(€€€½¹ÍĞÑ•áĞ€ô€‘í¹½Ñ¥”¹É•¥½¹Q•áĞñğ€ˆ‰ô€‘í¹½Ñ¥”¹…•¹äñğ€ˆ‰õ€¹Ñ½1½İ•É…Í” ¤ì(€€€½¹ÍĞµ…Ñ¡•Ì€ô€¡É•¥½¸è€‰‘…•©•½¸ˆğ€‰Í•©½¹œˆğ€‰¡Õ¹¹…´ˆ¤€ôø(€€€€€	%}I%=9}-e]=IMmÉ•¥½¹t¹Í½µ” ¡­•åİ½É¤€ôøÑ•áĞ¹¥¹±Õ‘•Ì¡­•åİ½É¹Ñ½1½İ•É…Í” ¤¤¤ì(€€€É•ÑÕÉ¸‰¥‘¥±Ñ•ÉÌ¹É•¥½¸€ôôô€‰±½…°ˆ(€€€€€€üµ…Ñ¡•Ì ‰‘…•©•½¸ˆ¤ñğµ…Ñ¡•Ì ‰Í•©½¹œˆ¤ñğµ…Ñ¡•Ì ‰¡Õ¹¹…´ˆ¤(€€€€€€èµ…Ñ¡•Ì¡‰¥‘¥±Ñ•ÉÌ¹É•¥½¸¤ì(€ôì((€½¹ÍĞÙ¥Í¥‰±•	¥‘9½Ñ¥•Ì€ô‰¥‘9½Ñ¥•Ì¹™¥±Ñ•È ¡¹½Ñ¥”¤€ôøì(€€€¥˜€¡Í½ÕÉ”€ôôô€‰± ˆ¤É•ÑÕÉ¸™…±Í”ì(€€€¥˜€ …µ…Ñ¡•Í	¥‘I•¥½¸¡¹½Ñ¥”¤¤É•ÑÕÉ¸™…±Í”ì(€€€½¹ÍĞ­•åİ½É€ôÍ•…É ¹ÑÉ¥´ ¤¹Ñ½1½İ•É…Í” ¤ì(€€€¥˜€ …­•åİ½É¤É•ÑÕÉ¸ÑÉÕ”ì(€€€É•ÑÕÉ¸€‘í¹½Ñ¥”¹Ñ¥Ñ±•ô€‘í¹½Ñ¥”¹…•¹åô€‘í¹½Ñ¥”¹‰¥‘9½õ€¹Ñ½1½İ•É…Í” ¤¹¥¹±Õ‘•Ì¡­•åİ½É¤ì(€ô¤ì(€½¹ÍĞ™½Éµ…Ñ	¥‘µ½Õ¹Ğ€ô€¡…µ½Õ¹Ğè¹Õµ‰•È¤€ôø…µ½Õ¹Ğ€ø€À€ü€‘í…µ½Õ¹Ğ¹Ñ½1½…±•MÑÉ¥¹œ ‰­¼µ-Hˆ¥÷²nA€€è€‹ªâ#²V„ƒ®¾ãªÎ×ªÂpˆì(€½¹ÍĞ™½Éµ…Ñ	¥‘…Ñ”€ô€¡Ù…±Õ”èÍÑÉ¥¹œ¤€ôøÙ…±Õ”€üÙ…±Õ”¹Í±¥” À°€ÄØ¤€è€‹®¾ã²‚Tˆì((€É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µÁ…”ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µ¡•…ˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸ùAU	1%	%ğ½ÍÁ…¸ø(€€€€€€€€€€ñ Èû²z²ÂÃªÎ×ªÎ€ğ½ Èø(€€€€€€€€€€ñÀû®
c®vó²z—¶Ã²f 1#²v`ƒªÎ×ªÂpƒ²z²ÂÃªÎ×ªÎƒ®–ğƒ¶VsªÎÏ²^C²pƒ¶fW²vã¶V§®.#®.¸ğ½Àø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µÍÑ…”ˆø(€€€€€€€€€€ñˆøÓ®.£ªÎğ½ˆø(€€€€€€€€€€ñÍÁ…¸û²²^·
ßªâÃªÂƒ²†ÃªÆĞƒ²†Ã¶j0ğ½ÍÁ…¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ­•åİ½ÉµÁ…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ­•åİ½ÉµÉ½ÕÀˆø(€€€€€€€€€€ñÍÑÉ½¹œû¶>³¶V ƒ¶
“²n3®Npğ½ÍÑÉ½¹œø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ­•åİ½Éµ¡¥ÁÌˆø(€€€€€€€€€€€í­•åİ½É‘Ì¹¥¹±Õ‘”¹µ…À ¡­•åİ½É¤€ôø€ (€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¥¹±Õ‘”ˆ­•äõí­•åİ½É‘ôùí­•åİ½É‘õí…¹‘¥Ñ-•åİ½É‘Ì€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÉ•µ½Ù•-•åİ½É ‰¥¹±Õ‘”ˆ°­•åİ½É¥ô…É¥„µ±…‰•°õí€‘í­•åİ½É‘ôƒ²
·²‚qôû\ğ½‰ÕÑÑ½¸ùôğ½ÍÁ…¸ø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€í…¹‘¥Ñ-•åİ½É‘Ì€˜˜€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ­•åİ½Éµ…‘ˆø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õí¥¹±Õ‘•%¹ÁÕÑô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•Ñ%¹±Õ‘•%¹ÁÕĞ¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”¥ô½¹-•å½İ¸õì¡•Ù•¹Ğ¤€ôø¡…¹‘±•-•åİ½É‘-•å½İ¸¡•Ù•¹Ğ°€‰¥¹±Õ‘”ˆ¥ôÁ±…•¡½±‘•Èô‹¶>³¶V ƒ¶
“²n3®Npƒ²z®‚”ˆ€¼ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø…‘‘-•åİ½É ‰¥¹±Õ‘”ˆ¥ôû²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ­•åİ½ÉµÉ½ÕÀˆø(€€€€€€€€€€ñÍÑÉ½¹œû²‚s²fàƒ¶
“²n3®Npğ½ÍÑÉ½¹œø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ­•åİ½Éµ¡¥ÁÌˆø(€€€€€€€€€€€í­•åİ½É‘Ì¹•á±Õ‘”¹µ…À ¡­•åİ½É¤€ôø€ (€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•á±Õ‘”ˆ­•äõí­•åİ½É‘ôùí­•åİ½É‘õí…¹‘¥Ñ-•åİ½É‘Ì€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÉ•µ½Ù•-•åİ½É ‰•á±Õ‘”ˆ°­•åİ½É¥ô…É¥„µ±…‰•°õí€‘í­•åİ½É‘ôƒ²
·²‚qôû\ğ½‰ÕÑÑ½¸ùôğ½ÍÁ…¸ø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€ì…­•åİ½É‘Ì¹•á±Õ‘”¹±•¹Ñ €˜˜€ñ•´û®NÇ®†w®Bpƒ²‚s²fàƒ¶
“²n3®NsªÂ ƒ²^²*×®.#®.¸ğ½•´ùô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€í…¹‘¥Ñ-•åİ½É‘Ì€˜˜€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ­•åİ½Éµ…‘ˆø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õí•á±Õ‘•%¹ÁÕÑô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•Ñá±Õ‘•%¹ÁÕĞ¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”¥ô½¹-•å½İ¸õì¡•Ù•¹Ğ¤€ôø¡…¹‘±•-•åİ½É‘-•å½İ¸¡•Ù•¹Ğ°€‰•á±Õ‘”ˆ¥ôÁ±…•¡½±‘•Èô‹²‚s²fàƒ¶
“²n3®Npƒ²z®‚”ˆ€¼ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø…‘‘-•åİ½É ‰•á±Õ‘”ˆ¥ôû²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ­•åİ½Éµ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñÍÁ…¸ùí…¹‘¥Ñ-•åİ½É‘Ì€ü€¡­•åİ½É‘5•ÍÍ…”ñğ€‹¶
“²n3®Ns®–ğƒ²ÚSªÂ¶VcªÆÃ®
`ƒ\ƒ®Ê¶*ó²ró®†pƒ²
·²‚s¶Vpƒ®Jƒ²‚²z—¶Vc²ã²jP¸ˆ¤€è€‹ªÒ®š³²z@ƒ®bC®*Pƒ²
³®²Ó².“²²nC²vĞƒ¶
“²n3®Ns®–ğƒ®ÎªÊ÷¶V€ƒ²"`ƒ²z#²*×®.#®.¸‰ôğ½ÍÁ…¸ø(€€€€€€€€€í…¹‘¥Ñ-•åİ½É‘Ì€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆ½¹±¥¬õíÍ…Ù•-•åİ½É‘Íôû¶
“²n3®Npƒ²‚²z”ğ½‰ÕÑÑ½¸ùô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µÉ…¹”µÁ…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µÉ…¹”µÉ½ÕÀˆø(€€€€€€€€€€ñÍÑÉ½¹œûªÎ×ªÎ€ƒ²²^´ğ½ÍÑÉ½¹œø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µÉ•¥½¸µ‰ÕÑÑ½¹Ìˆø(€€€€€€€€€€€ì¡=‰©•Ğ¹­•åÌ¡	%}I%=9}1	1L¤…Ì	¥‘I•¥½¹¥±Ñ•Émt¤¹µ…À ¡É•¥½¸¤€ôø€ (€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€­•äõíÉ•¥½¹ô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí‰¥‘¥±Ñ•ÉÌ¹É•¥½¸€ôôôÉ•¥½¸€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•Ñ	¥‘¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ğ¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°É•¥½¸ô¤¥ô(€€€€€€€€€€€€€€ùí	%}I%=9}1	1MmÉ•¥½¹uôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñÍµ…±°û²jÃ®š°ƒ²²^·²v ƒ®Âs²ó
ß²"c²jSªâÃªÒ ƒªâÃ²’ ƒ®2²‚°ƒ²ã²Š°ƒ²Ú§®
 ƒªÎ×ªÎƒ®–ğƒ¶V£ªî`ƒ¶Fs².s¶V§®.#®.¸ğ½Íµ…±°ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µÉ…¹”µÉ½ÕÀˆø(€€€€€€€€€€ñÍÑÉ½¹œû²†Ã¶j3ªâÃªÂğ½ÍÑÉ½¹œø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ‘…Ñ”µÅÕ¥¬ˆø(€€€€€€€€€€€ílÜ°€ÌÀ°€äÁt¹µ…À ¡‘…åÌ¤€ôø€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ­•äõí‘…åÍô½¹±¥¬õì ¤€ôøÍ•ÑEÕ¥­I…¹”¡‘…åÌ¥ôû²ÖsªŞğí‘…åÍ÷²vğğ½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ‘…Ñ”µ¥¹ÁÕÑÌˆø(€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí‰¥‘¥±Ñ•ÉÌ¹™É½µôµ…àõí‰¥‘¥±Ñ•ÉÌ¹Ñ½ô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•Ñ	¥‘¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ğ¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°™É½´è•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”ô¤¥ô…É¥„µ±…‰•°ô‹²z²ÂÃªÎ×ªÎ€ƒ²†Ã¶j0ƒ².s²zG²vğˆ€¼ø(€€€€€€€€€€€€ñÍÁ…¸ùøğ½ÍÁ…¸ø(€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí‰¥‘¥±Ñ•ÉÌ¹Ñ½ôµ¥¸õí‰¥‘¥±Ñ•ÉÌ¹™É½µôµ…àõíÑ½	¥‘…Ñ•%¹ÁÕĞ¡¹•Ü…Ñ” ¤¥ô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•Ñ	¥‘¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ğ¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°Ñ¼è•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”ô¤¥ô…É¥„µ±…‰•°ô‹²z²ÂÃªÎ×ªÎ€ƒ²†Ã¶j0ƒ²Š®3²vğˆ€¼ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñÍµ…±°û²Ös®2 €äÃ²vóªæ3² ƒ²ƒ¶w¶V€ƒ²"`ƒ²z#²ró®¦ÀƒªÎ×ªÎ€ƒ²#®†sªÎƒ²æ£²vƒ®"®–Ó®¦Ğƒ²‚²j§®B§®.#®.¸ğ½Íµ…±°ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ™¥±Ñ•Èµ‰…Èˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µÍ½ÕÉ”µÑ…‰Ìˆ…É¥„µ±…‰•°ô‹ªÎ×ªÎ€ƒ²Ús²Ê`ƒ²ƒ¶tˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”õíÍ½ÕÉ”€ôôô€‰…±°ˆ€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰ô½¹±¥¬õì ¤€ôøÍ•ÑM½ÕÉ” ‰…±°ˆ¥ôû²‚²ÊĞğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”õíÍ½ÕÉ”€ôôô€‰œÉˆˆ€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰ô½¹±¥¬õì ¤€ôøÍ•ÑM½ÕÉ” ‰œÉˆˆ¥ôû®
c®vó²z—¶Àğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”õíÍ½ÕÉ”€ôôô€‰± ˆ€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰ô½¹±¥¬õì ¤€ôøÍ•ÑM½ÕÉ” ‰± ˆ¥ôù1 ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíÍ•…É¡ô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•ÑM•…É ¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹ªÎ×ªÎƒ®ªƒ®bC®*Pƒ®Âs²óªâÃªÒ ƒªÊ²$ˆ…É¥„µ±…‰•°ô‹²z²ÂÃªÎ×ªÎ€ƒªÊ²$ˆ€¼ø(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆ½¹±¥¬õí±½…‘É‰9½Ñ¥•Íô‘¥Í…‰±•õí‰¥‘1½…‘¥¹œñğÍ½ÕÉ”€ôôô€‰± ‰ôùí‰¥‘1½…‘¥¹œ€ü€‹ªÎ×ªÎ€ƒ®Ú#®~³²b“®*Pƒ²’D¸¸¸ˆ€è€‹ªÎ×ªÎ€ƒ²#®†sªÎƒ²æ ‰ôğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µÉ•ÍÕ±ĞµÍÕµµ…Éäˆø(€€€€€€€€ñ‘¥ØøñÍÑÉ½¹œùíÍ½ÕÉ”€ôôô€‰± ˆ€ü€À€èÙ¥Í¥‰±•	¥‘9½Ñ¥•Ì¹±•¹Ñ¡ôğ½ÍÑÉ½¹œøñÍÁ…¸û¶Fs².pƒªÎ×ªÎ€ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€ñÀùíÍ½ÕÉ”€ôôô€‰± ˆ€ü€‰1 ƒªÎ×ªÎƒ®*Pƒ®.“²v0ƒ®.£ªÎ²^C²pƒ²^ÃªÊÃ¶V§®.#®.¸ˆ€è‰¥‘•Ñ¡•‘Ğ€ü€‘í	%}I%=9}1	1Mm‰¥‘¥±Ñ•ÉÌ¹É•¥½¹uôƒ
Ü€‘í‰¥‘¥±Ñ•ÉÌ¹™É½µôø€‘í‰¥‘¥±Ñ•ÉÌ¹Ñ½ôƒ
Üƒ®#²®$ƒ²†Ã¶j0€‘í¹•Ü…Ñ”¡‰¥‘•Ñ¡•‘Ğ¤¹Ñ½1½…±•MÑÉ¥¹œ ‰­¼µ-Hˆ¥õ€€è€‹®
c®vó²z—¶Àƒ²^ÃªÊÀƒ®2ªâÀƒ²’D‰ôğ½Àø(€€€€€€ğ½‘¥Øø(€€€€€í‰¥‘ÉÉ½È€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ…Á¤µ•ÉÉ½Èˆùí‰¥‘ÉÉ½Éôğ½‘¥Øùô((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ±¥ÍĞµ¡•…ˆø(€€€€€€€€ñÍÁ…¸û²Ús²Ê`ğ½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸ûªÎ×ªÎƒ®ªƒ
Üƒ®Âs²óªâÃªÒ ğ½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸ûªÎ×ªÎƒªâ#²V„ğ½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸û®#ªÂC²vğğ½ÍÁ…¸ø(€€€€€€ğ½‘¥Øø(€€€€€íÙ¥Í¥‰±•	¥‘9½Ñ¥•Ì¹±•¹Ñ €ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µ±¥ÍĞˆø(€€€€€€€€€íÙ¥Í¥‰±•	¥‘9½Ñ¥•Ì¹µ…À ¡¹½Ñ¥”¤€ôø€ (€€€€€€€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µÉ½Üˆ­•äõí¹½Ñ¥”¹¥‘ôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µÍ½ÕÉ”ˆøñˆùí¹½Ñ¥”¹Í½ÕÉ•ôğ½ˆøñÍÁ…¸ùí¹½Ñ¥”¹‰ÕÍ¥¹•ÍÍQåÁ•ôğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µµ…¥¸ˆø(€€€€€€€€€€€€€€€€ñ„¡É•˜õí¹½Ñ¥”¹ÕÉ±ôÑ…É•Ğô‰}‰±…¹¬ˆÉ•°ô‰¹½É•™•ÉÉ•Èˆùí¹½Ñ¥”¹Ñ¥Ñ±•ôğ½„ø(€€€€€€€€€€€€€€€€ñÍÁ…¸ùí¹½Ñ¥”¹…•¹äñğ€‹ªâÃªÒ ƒ®¾ã¶Fs².p‰ôƒ
Üí¹½Ñ¥”¹‰¥‘9½ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñÍÑÉ½¹œ±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µ…µ½Õ¹Ğˆùí™½Éµ…Ñ	¥‘µ½Õ¹Ğ¡¹½Ñ¥”¹…µ½Õ¹Ğ¥ôğ½ÍÑÉ½¹œø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ¹½Ñ¥”µ‘•…‘±¥¹”ˆøñÍÁ…¸ùí™½Éµ…Ñ	¥‘…Ñ”¡¹½Ñ¥”¹‘•…‘±¥¹”¥ôğ½ÍÁ…¸øñ„¡É•˜õí¹½Ñ¥”¹ÕÉ±ôÑ…É•Ğô‰}‰±…¹¬ˆÉ•°ô‰¹½É•™•ÉÉ•Èˆû²nC®²àƒ®ÎÓªâÀğ½„øğ½‘¥Øø(€€€€€€€€€€€€ğ½…ÉÑ¥±”ø(€€€€€€€€€€¤¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€¤€è€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰¥µ•µÁÑäµÍÑ…Ñ”ˆø(€€€€€€€€€€ñ¥±•¡•¬ÈÍ¥é”õìĞÉô€¼ø(€€€€€€€€€€ñÍÑÉ½¹œùí‰¥‘1½…‘¥¹œ€ü€‹®
c®vó²z—¶ÀƒªÎ×ªÎƒ®–ğƒ®Ú#®~³²b“ªÎ€ƒ²z#²*×®.#®.ˆ€èÍ½ÕÉ”€ôôô€‰± ˆ€ü€‰1 ƒªÎ×ªÎ€ƒ²^Ã®>dƒ²’®æƒ²’G²z®.#®.ˆ€è€‹²†ÃªÆÓ²^@ƒ®{®*Pƒ²¶Z$ƒ²’DƒªÎ×ªÎƒªÂ ƒ²^²*×®.#®.‰ôğ½ÍÑÉ½¹œø(€€€€€€€€€€ñÀùíÍ½ÕÉ”€ôôô€‰± ˆ€ü€‰1 ƒªÎ×².tA'®*Pƒ®.“²v0ƒ®.£ªÎ²^C²pƒ²^ÃªÊÃ¶V§®.#®.¸ˆ€è€‹¶>³¶V ƒ¶
“²n3®Npƒ®bC®*PƒªÊ²'²ZÓ®–ğƒ®ÂSªúãªÎ€ƒªÎ×ªÎ€ƒ²#®†sªÎƒ²æ£²vƒ®"3®~³®ÎÓ²ã²jP¸‰ôğ½Àø(€€€€€€€€€€ñÍµ…±°û¶>³¶V ƒ¶
“²n3®Npƒ²’Dƒ¶Vc®
cªÂ ƒ²z#ªÎ€°ƒ²‚s²fàƒ¶
“²n3®NsªÂ ƒ²^®*Pƒ²¶Z$ƒ²’DƒªÎ×ªÎƒ®0ƒ¶Fs².s®B§®.#®.¸ğ½Íµ…±°ø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€ğ½Í•Ñ¥½¸ø(€€¤ì)ô(()™Õ¹Ñ¥½¸M¥Ñ•9½Ñ¥•A…”¡ì(€Í¥Ñ•9½Ñ¥•Ì°(€…±±M¥Ñ•9½Ñ¥•Ì°(€ÕÍ•ÉA•Éµ¥ÍÍ¥½¹Ì€ômt°(€Í¥Ñ•9½Ñ¥•½É´°(€Í•ÑM¥Ñ•9½Ñ¥•½É´°(€•‘¥Ñ¥¹M¥Ñ•9½Ñ¥•%°(€Í…Ù•M¥Ñ•9½Ñ¥”°(€Í¥Ñ•9½Ñ¥•M…Ù¥¹œ€ô™…±Í”°(€•‘¥ÑM¥Ñ•9½Ñ¥”°(€‘•±•Ñ•M¥Ñ•9½Ñ¥”°(€Í¥Ñ•9½Ñ¥•ÉÉ½È°(€¥Í‘µ¥¸°(€ÕÉÉ•¹ÑI½±”°)ôè…¹ä¤ì(€½¹ÍĞ…¹]É¥Ñ•9½Ñ¥”€ô¥Í‘µ¥¸ñğÕÉÉ•¹ÑI½±”€ôôô€‰½™™¥”ˆì(€½¹ÍĞ…Ñ¥Ù•9½Ñ¥•Ì€ô¥Í‘µ¥¸€ü€¡…±±M¥Ñ•9½Ñ¥•ÌñğÍ¥Ñ•9½Ñ¥•Ìñğmt¤€è€¡Í¥Ñ•9½Ñ¥•Ìñğmt¤ì(€½¹ÍĞÕÉ•¹Ñ½Õ¹Ğ€ô…Ñ¥Ù•9½Ñ¥•Ì¹™¥±Ñ•È ¡¸èM¥Ñ•9½Ñ¥”¤€ôø¸¹ÁÉ¥½É¥Ñä€ôôô€‹ªâÓªâ$ˆ¤¹±•¹Ñ ì(€½¹ÍĞ¹½Ñ¥•Q…É•ÑI½±•Ì€ôÍ¥Ñ•9½Ñ¥•½É´¹Ñ…É•Ñ}É½±•Ìñğl‰…±°‰tì(€½¹ÍĞ¹½Ñ¥•Q…É•Ñµ…¥±Ì€ôÍ¥Ñ•9½Ñ¥•½É´¹Ñ…É•Ñ}•µ…¥±Ìñğmtì(€½¹ÍĞ¹½Ñ¥•µÁ±½å••Ì€ô€¡ÕÍ•ÉA•Éµ¥ÍÍ¥½¹Ìñğmt¤¹™¥±Ñ•È ¡ÔèUÍ•ÉA•Éµ¥ÍÍ¥½¸¤€ôø€„…Ô¹•µ…¥°¤ì((€½¹ÍĞÑ½±•9½Ñ¥•Q…É•ÑI½±”€ô€¡É½±”èÍÑÉ¥¹œ¤€ôøì(€€€±•Ğ¹•áÑI½±•Ì€ôl¸¸¹¹½Ñ¥•Q…É•ÑI½±•Ítì((€€€¥˜€¡É½±”€ôôô€‰…±°ˆ¤ì(€€€€€¹•áÑI½±•Ì€ô¹•áÑI½±•Ì¹¥¹±Õ‘•Ì ‰…±°ˆ¤€ümt€èl‰…±°‰tì(€€€ô•±Í”ì(€€€€€¹•áÑI½±•Ì€ô¹•áÑI½±•Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´€„ôô€‰…±°ˆ¤ì(€€€€€¹•áÑI½±•Ì€ô¹•áÑI½±•Ì¹¥¹±Õ‘•Ì¡É½±”¤€ü¹•áÑI½±•Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´€„ôôÉ½±”¤€èl¸¸¹¹•áÑI½±•Ì°É½±•tì(€€€ô((€€€Í•ÑM¥Ñ•9½Ñ¥•½É´¡ì€¸¸¹Í¥Ñ•9½Ñ¥•½É´°Ñ…É•Ñ}É½±•Ìè¹•áÑI½±•Ì¹±•¹Ñ €ü¹•áÑI½±•Ì€èl‰…±°‰tô¤ì(€ôì((€½¹ÍĞÑ½±•9½Ñ¥•Q…É•Ñµ…¥°€ô€¡•µ…¥°èÍÑÉ¥¹œ¤€ôøì(€€€½¹ÍĞ¹•áÑµ…¥±Ì€ô¹½Ñ¥•Q…É•Ñµ…¥±Ì¹¥¹±Õ‘•Ì¡•µ…¥°¤(€€€€€€ü¹½Ñ¥•Q…É•Ñµ…¥±Ì¹™¥±Ñ•È ¡¥Ñ•´èÍÑÉ¥¹œ¤€ôø¥Ñ•´€„ôô•µ…¥°¤(€€€€€€èl¸¸¹¹½Ñ¥•Q…É•Ñµ…¥±Ì°•µ…¥±tì((€€€Í•ÑM¥Ñ•9½Ñ¥•½É´¡ì€¸¸¹Í¥Ñ•9½Ñ¥•½É´°Ñ…É•Ñ}É½±•Ìè¹½Ñ¥•Q…É•ÑI½±•Ì¹™¥±Ñ•È ¡¥Ñ•´èÍÑÉ¥¹œ¤€ôø¥Ñ•´€„ôô€‰…±°ˆ¤°Ñ…É•Ñ}•µ…¥±Ìè¹•áÑµ…¥±Ìô¤ì(€ôì((€½¹ÍĞÑ…É•Ñ1…‰•°€ô€¡¹½Ñ¥”èM¥Ñ•9½Ñ¥”¤€ôøì(€€€½¹ÍĞÉ½±•Ì€ô¹½Ñ¥”¹Ñ…É•Ñ}É½±•Ìñğl‰…±°‰tì(€€€½¹ÍĞ•µ…¥±Ì€ô¹½Ñ¥”¹Ñ…É•Ñ}•µ…¥±Ìñğmtì(€€€¥˜€¡É½±•Ì¹¥¹±Õ‘•Ì ‰…±°ˆ¤ñğ€ …É½±•Ì¹±•¹Ñ €˜˜€…•µ…¥±Ì¹±•¹Ñ ¤¤É•ÑÕÉ¸€‹²‚²ÊĞƒ²²n@ˆì(€€€½¹ÍĞÉ½±•1…‰•±Ì€ôÉ½±•Ì¹µ…À ¡É½±”¤€ôøÉ½±”€ôôô€‰½™™¥”ˆ€ü€‹²
³®²Ó².“²²n@ˆ€èÉ½±”€ôôô€‰™¥•±ˆ€ü€‹¶b²z—²²n@ˆ€èÉ½±”¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€É•ÑÕÉ¸l¸¸¹É½±•1…‰•±Ì°€¸¸¹•µ…¥±Ít¹©½¥¸ ˆ°€ˆ¤ñğ€‹²‚²ÊĞƒ²²n@ˆì(€ôì((€É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÁ…”ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ¡•…ˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸ù9=Q%ğ½ÍÁ…¸ø(€€€€€€€€€€ñ ÈûªÎ×² ğ½ Èø(€€€€€€€€€€ñÀûªÒ®š³²zC²f ƒ²
³®²Ó².“²²nC²v ƒªÎ×²®–ğƒ®NÇ®†w¶V€ƒ²"`ƒ²z#ªÎ€°ƒ¶b²z—²²nC²v ƒªÎ×²®–ğƒ¶fW²vã¶V€ƒ²"`ƒ²z#²*×®.#®.¸ğ½Àø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÍÕµµ…Éäˆø(€€€€€€€€€€ñˆùí…Ñ¥Ù•9½Ñ¥•Ì¹±•¹Ñ¡ôğ½ˆø(€€€€€€€€€€ñ•´ûªÎ×² ğ½•´ø(€€€€€€€€€€ñÍÑÉ½¹œùíÕÉ•¹Ñ½Õ¹ÑôƒªâÓªâ$ğ½ÍÑÉ½¹œø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€íÍ¥Ñ•9½Ñ¥•ÉÉ½È€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µ•ÉÉ½Èˆø(€€€€€€€€€ƒªÎ×² ƒ®Ú#®~³²b“ªâÀƒ².“¶2 èíÍ¥Ñ•9½Ñ¥•ÉÉ½Éô(€€€€€€€€€€ñ‰È€¼ø(€€€€€€€€€MÕÁ…‰…Í—²^@Í¥Ñ•}¹½Ñ¥•Ìƒ¶3²vÓ®âS²vƒ®¢ó²‚ ƒ®3®N“²ZÓ²Vğƒ¶V§®.#®.¸(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€í…¹]É¥Ñ•9½Ñ¥”€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½Èµ…Éˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½ÈµÑ¥Ñ±”ˆø(€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€ñ Ìùí•‘¥Ñ¥¹M¥Ñ•9½Ñ¥•%€ü€‹ªÎ×² ƒ²"c²‚Tˆ€è€‹ªÎ×² ƒ®NÇ®†t‰ôğ½ Ìø(€€€€€€€€€€€€€€ñÀû®
Ó®š³² ƒ²V+®*Pƒ²vÓ²ƒªÎ²4ƒ¶Fs².s®B§®.#®.¸ƒ®
ƒ²s®*Pƒ²z®‚—¶Vc² ƒ²V+²V®>ƒ®B§®.#®.¸ğ½Àø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíÍ¥Ñ•9½Ñ¥•½É´¹ÁÉ¥½É¥Ñåô½¹¡…¹”õì¡”¤€ôøÍ•ÑM¥Ñ•9½Ñ¥•½É´¡ì€¸¸¹Í¥Ñ•9½Ñ¥•½É´°ÁÉ¥½É¥Ñäè”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ôø(€€€€€€€€€€€€€€ñ½ÁÑ¥½¸ûªâÓªâ$ğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€ñ½ÁÑ¥½¸û²’G²jPğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€ñ½ÁÑ¥½¸û®ÎÓ¶Ôğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñ¥¹ÁÕĞ(€€€€€€€€€€€±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µÑ¥Ñ±”µ¥¹ÁÕĞˆ(€€€€€€€€€€€Ù…±Õ”õíÍ¥Ñ•9½Ñ¥•½É´¹Ñ¥Ñ±•ô(€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•ÑM¥Ñ•9½Ñ¥•½É´¡ì€¸¸¹Í¥Ñ•9½Ñ¥•½É´°Ñ¥Ñ±”è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô(€€€€€€€€€€€Á±…•¡½±‘•Èô‹ªÎ×² ƒ²‚s®ª¤ˆ(€€€€€€€€€€¼ø((€€€€€€€€€€ñÑ•áÑ…É•„(€€€€€€€€€€€±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µ½¹Ñ•¹Ğµ¥¹ÁÕĞˆ(€€€€€€€€€€€Ù…±Õ”õíÍ¥Ñ•9½Ñ¥•½É´¹½¹Ñ•¹Ñô(€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•ÑM¥Ñ•9½Ñ¥•½É´¡ì€¸¸¹Í¥Ñ•9½Ñ¥•½É´°½¹Ñ•¹Ğè”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô(€€€€€€€€€€€Á±…•¡½±‘•Èô‹ªÎ×² ƒ®
Ó²j§²vƒ²z®‚—¶Vc²ã²jP¸ƒ²b èƒ®
Ó²vğƒ²b“²‚ƒ²ã®–sªâÀƒ²‚CªÊ €¼ƒ²‚ƒ²²n@ƒ²Ús²Â ƒ²‚ƒ²ã®–pƒ¶V²"`ˆ(€€€€€€€€€€¼ø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ‰½àˆø(€€€€€€€€€€€€ñÍÑÉ½¹œûªÎ×² ƒ®Îğƒ²²n@ƒ²ƒ¶tğ½ÍÑÉ½¹œø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ¡•­Ìˆø(€€€€€€€€€€€€€€ñ±…‰•°ø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õí¹½Ñ¥•Q…É•ÑI½±•Ì¹¥¹±Õ‘•Ì ‰…±°ˆ¥ô½¹¡…¹”õì ¤€ôøÑ½±•9½Ñ¥•Q…É•ÑI½±” ‰…±°ˆ¥ô€¼ø(€€€€€€€€€€€€€€€€ñÍÁ…¸û²‚²ÊĞƒ²²n@ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€ñ±…‰•°ø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õí¹½Ñ¥•Q…É•ÑI½±•Ì¹¥¹±Õ‘•Ì ‰½™™¥”ˆ¥ô½¹¡…¹”õì ¤€ôøÑ½±•9½Ñ¥•Q…É•ÑI½±” ‰½™™¥”ˆ¥ô€¼ø(€€€€€€€€€€€€€€€€ñÍÁ…¸û²
³®²Ó².“²²n@ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€ñ±…‰•°ø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õí¹½Ñ¥•Q…É•ÑI½±•Ì¹¥¹±Õ‘•Ì ‰™¥•±ˆ¥ô½¹¡…¹”õì ¤€ôøÑ½±•9½Ñ¥•Q…É•ÑI½±” ‰™¥•±ˆ¥ô€¼ø(€€€€€€€€€€€€€€€€ñÍÁ…¸û¶b²z—²²n@ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½±…‰•°ø((€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€ì„…¹½Ñ¥•µÁ±½å••Ì¹±•¹Ñ €˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ•µ…¥±Ìˆø(€€€€€€€€€€€€€€€í¹½Ñ¥•µÁ±½å••Ì¹µ…À ¡ÕÍ•ÈèUÍ•ÉA•Éµ¥ÍÍ¥½¸¤€ôø€ (€€€€€€€€€€€€€€€€€€ñ±…‰•°­•äõíÕÍ•È¹•µ…¥±ôø(€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õí¹½Ñ¥•Q…É•Ñµ…¥±Ì¹¥¹±Õ‘•Ì¡ÕÍ•È¹•µ…¥°¥ô½¹¡…¹”õì ¤€ôøÑ½±•9½Ñ¥•Q…É•Ñµ…¥°¡ÕÍ•È¹•µ…¥°¥ô€¼ø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÑ½1½¥¹%¡ÕÍ•È¹•µ…¥°¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñ•´ùíÕÍ•È¹É½±”€ôôô€‰™¥•±ˆ€ü€‹¶b²z”ˆ€è€‹²
³®²Ó².‰ôğ½•´ø(€€€€€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½Èµ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆ‘¥Í…‰±•õíÍ¥Ñ•9½Ñ¥•M…Ù¥¹ô½¹±¥¬õíÍ…Ù•M¥Ñ•9½Ñ¥•ôùíÍ¥Ñ•9½Ñ¥•M…Ù¥¹œ€ü€‹²‚²z”ƒ²’D¸¸¸ˆ€è•‘¥Ñ¥¹M¥Ñ•9½Ñ¥•%€ü€‹²"c²‚Tƒ²‚²z”ˆ€è€‹ªÎ×² ƒ²‚²z”‰ôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸‘¥Í…‰±•õíÍ¥Ñ•9½Ñ¥•M…Ù¥¹ô½¹±¥¬õì ¤€ôøÍ•ÑM¥Ñ•9½Ñ¥•½É´¡ìÑ¥Ñ±”è€ˆˆ°½¹Ñ•¹Ğè€ˆˆ°ÁÉ¥½É¥Ñäè€‹®ÎÓ¶Ôˆ°¥Í}…Ñ¥Ù”èÑÉÕ”°Ñ…É•Ñ}É½±•Ìèl‰…±°‰t°Ñ…É•Ñ}•µ…¥±Ìèmtô¥ôû²Ò#ªâÃ¶fPğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ±¥ÍĞˆø(€€€€€€€í…Ñ¥Ù•9½Ñ¥•Ì¹±•¹Ñ €ü…Ñ¥Ù•9½Ñ¥•Ì¹µ…À ¡¹½Ñ¥”èM¥Ñ•9½Ñ¥”¤€ôø€ (€€€€€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”õíÍ¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…É€‘í¹½Ñ¥”¹ÁÉ¥½É¥Ñäñğ€‹®ÎÓ¶Ô‰õô­•äõí¹½Ñ¥”¹¥‘ôø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½Àˆø(€€€€€€€€€€€€€í…¹]É¥Ñ•9½Ñ¥”€˜˜€ñÍµ…±°û®2²èíÑ…É•Ñ1…‰•°¡¹½Ñ¥”¥ôğ½Íµ…±°ùô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ Ìùí¹½Ñ¥”¹Ñ¥Ñ±•ôğ½ Ìø(€€€€€€€€€€€€ñÀùí¹½Ñ¥”¹½¹Ñ•¹Ñôğ½Àø(€€€€€€€€€€€í…¹]É¥Ñ•9½Ñ¥”€˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôø•‘¥ÑM¥Ñ•9½Ñ¥”¡¹½Ñ¥”¥ôû²"c²‚Tğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€í¥Í‘µ¥¸€˜˜€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘…¹•Èˆ½¹±¥¬õì ¤€ôø‘•±•Ñ•M¥Ñ•9½Ñ¥”¡¹½Ñ¥”¹¥¥ôû®
Ó®š³ªâÀğ½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½…ÉÑ¥±”ø(€€€€€€€€¤¤€è€ (€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ•µÁÑäˆû®NÇ®†w®BpƒªÎ×²ªÂ ƒ²^²*×®.#®.¸ğ½‘¥Øø(€€€€€€€€¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½Í•Ñ¥½¸ø(€€¤ì)ô((()™Õ¹Ñ¥½¸	…­ÕÁA•Éµ¥ÍÍ¥½¹A…”¡ì(€ÁÕÉ¡…Í•Ì°(€µ…¥¹ÑÌ°(€…É‘UÍ•Ì°(€Ù•¹‘½ÉÌ°(€É½ÕÁÌ°(€İ…É•¡½ÕÍ•Ì°(€¥Ñ•µÌ°(€Á•Éµ¥ÑÌ°(€Ù•¹‘½É½Õ¹ÑÌ°(€É••¥ÁÑA¡½Ñ½Ì°(€µ…¥¹Ñ•¹…¹•A¡½Ñ½Ì°(€µ…¥¹Ñ•¹…¹•M¡•‘Õ±•Ì°(€ÁÕÉ¡…Í•É…™Ğ°(€µ…¥¹Ñ•¹…¹•É…™Ğ°(€…É‘É…™Ğ°(€ÕÁ‘…Ñ•9½Ñ¥•Ì°(€Í¥Ñ•9½Ñ¥•Ì°(€ÕÍ•ÉA•Éµ¥ÍÍ¥½¹Ì°(€…Ñ¥Ù¥Ñå1½Ì°(€‘•±•Ñ•‘I•½É‘Ì°(€Á•Éµ¥ÍÍ¥½¹½É´°(€Í•ÑA•Éµ¥ÍÍ¥½¹½É´°(€Í…Ù•UÍ•ÉA•Éµ¥ÍÍ¥½¸°(€‘•±•Ñ•UÍ•ÉA•Éµ¥ÍÍ¥½¸°(€±½…‘±°°(€±½…‘A•Éµ¥ÑÌ°(€±½…‘Y•¹‘½É½Õ¹ÑÌ°(€±½…‘I••¥ÁÑA¡½Ñ½Ì°(€±½…‘5…¥¹Ñ•¹…¹•A¡½Ñ½Ì°(€±½…‘5…¥¹Ñ•¹…¹•M¡•‘Õ±•Ì°(€±½…‘UÁ‘…Ñ•9½Ñ¥•Ì°(€±½…‘M¥Ñ•9½Ñ¥•Ì°(€±½…‘UÍ•ÉA•Éµ¥ÍÍ¥½¹Ì°(€±½…‘Ñ¥Ù¥Ñå1½Ì°(€±½…‘•±•Ñ•‘I•½É‘Ì°(€‰…­ÕÁM…Ù¥¹œ°(€•áÁ½ÉÑÕ±±	…­ÕÀ°(€•áÁ½ÉÑ	…­ÕÁMÕµµ…Éåá•°°(€Í¡½İQ½…ÍĞ°)ôè…¹ä¤ì(€½¹ÍĞmÉ•ÍÑ½É•¥±”°Í•ÑI•ÍÑ½É•¥±•t€ôÕÍ•MÑ…Ñ”ñ¥±”ğ¹Õ±°ø¡¹Õ±°¤ì(€½¹ÍĞmÉ•ÍÑ½É•	ÕÍä°Í•ÑI•ÍÑ½É•	ÕÍåt€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€½¹ÍĞm…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍä°Í•ÑÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍåt€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€½¹ÍĞm…ÑÑ…¡µ•¹Ñ	…­ÕÁAÉ½É•ÍÌ°Í•ÑÑÑ…¡µ•¹Ñ	…­ÕÁAÉ½É•ÍÍt€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞmÍÑ½É…•±•…¹ÕÁ	ÕÍä°Í•ÑMÑ½É…•±•…¹ÕÁ	ÕÍåt€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€½¹ÍĞmÍÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì°Í•ÑMÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ít€ôÕÍ•MÑ…Ñ”ñÉÉ…äñì(€€€‰Õ­•ĞèÍÑÉ¥¹œì(€€€Á…Ñ èÍÑÉ¥¹œì(€€€Í¥é”è¹Õµ‰•Èì(€€€É•…Ñ•‘ĞèÍÑÉ¥¹œì(€ôøø¡mt¤ì(€½¹ÍĞmÍÑ½É…•±•…¹ÕÁMÕµµ…Éä°Í•ÑMÑ½É…•±•…¹ÕÁMÕµµ…Éåt€ôÕÍ•MÑ…Ñ”ñì(€€€Í…¹¹•è¹Õµ‰•Èì(€€€É•™•É•¹•è¹Õµ‰•Èì(€€€…¹‘¥‘…Ñ•	åÑ•Ìè¹Õµ‰•Èì(€€€¡•­•‘ĞèÍÑÉ¥¹œì(€ôğ¹Õ±°ø¡¹Õ±°¤ì((€½¹ÍĞ‰…­ÕÁA…å±½…€ôì(€€€‰…­ÕÁ}Ù•ÉÍ¥½¸è€‰Ñ…•µåÕ¹œµ•ÉÀµØÄˆ°(€€€•áÁ½ÉÑ•‘}…Ğè¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€‘…Ñ„èì(€€€€€ÁÕÉ¡…Í•Ì°(€€€€€µ…¥¹ÑÌ°(€€€€€…É‘UÍ•Ì°(€€€€€Ù•¹‘½ÉÌ°(€€€€€É½ÕÁÌ°(€€€€€İ…É•¡½ÕÍ•Ì°(€€€€€¥Ñ•µÌ°(€€€€€Á•Éµ¥ÑÌ°(€€€€€Ù•¹‘½É½Õ¹ÑÌ°(€€€€€É••¥ÁÑA¡½Ñ½Ì°(€€€€€µ…¥¹Ñ•¹…¹•A¡½Ñ½Ì°(€€€€€µ…¥¹Ñ•¹…¹•M¡•‘Õ±•Ì°(€€€€€…Ñ¥Ù•É…™ÑÌèì(€€€€€€€ÁÕÉ¡…Í”èÁÕÉ¡…Í•É…™Ğ°(€€€€€€€µ…¥¹Ñ•¹…¹”èµ…¥¹Ñ•¹…¹•É…™Ğ°(€€€€€€€…Éè…É‘É…™Ğ°(€€€€€ô°(€€€€€ÕÁ‘…Ñ•9½Ñ¥•Ì°(€€€€€Í¥Ñ•9½Ñ¥•Ì°(€€€€€ÕÍ•ÉA•Éµ¥ÍÍ¥½¹Ì°(€€€€€…Ñ¥Ù¥Ñå1½Ì°(€€€€€‘•±•Ñ•‘I•½É‘Ì°(€€€ô°(€ôì((€½¹ÍĞ½±±•ÑÑÑ…¡µ•¹ÑI•™•É•¹•Ì€ô€ ¤€ôøì(€€€½¹ÍĞ…ÑÑ…¡µ•¹Ñ5…À€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ìÕÉ°èÍÑÉ¥¹œìÉ•™•É•¹•ÌèÍÑÉ¥¹mtôø ¤ì(€€€½¹ÍĞÙ¥Í¥Ñ	…­ÕÁY…±Õ”€ô€¡Ù…±Õ”è…¹ä°Á…Ñ èÍÑÉ¥¹œ¤€ôøì(€€€€€¥˜€¡ÑåÁ•½˜Ù…±Õ”€ôôô€‰ÍÑÉ¥¹œˆ¤ì(€€€€€€€½¹ÍĞÑ•áĞ€ôÙ…±Õ”¹ÑÉ¥´ ¤ì(€€€€€€€¥˜€ ½y¡ÑÑÁÌüép½p¼½¤¹Ñ•ÍĞ¡Ñ•áĞ¤€˜˜Ñ•áĞ¹¥¹±Õ‘•Ì ˆ½ÍÑ½É…”½ØÄ½½‰©•Ğ¼ˆ¤¤ì(€€€€€€€€€½¹ÍĞ­•ä€ôÑ•áĞ¹É•Á±…” ½pı•ÉÁ}™¥±”õ…Õ‘¥¼ üè˜¸¨¤ü½¤°€ˆˆ¤ì(€€€€€€€€€½¹ÍĞ•á¥ÍÑ¥¹œ€ô…ÑÑ…¡µ•¹Ñ5…À¹•Ğ¡­•ä¤ì(€€€€€€€€€¥˜€¡•á¥ÍÑ¥¹œ¤ì(€€€€€€€€€€€¥˜€ …•á¥ÍÑ¥¹œ¹É•™•É•¹•Ì¹¥¹±Õ‘•Ì¡Á…Ñ ¤¤•á¥ÍÑ¥¹œ¹É•™•É•¹•Ì¹ÁÕÍ ¡Á…Ñ ¤ì(€€€€€€€€€ô•±Í”ì(€€€€€€€€€€€…ÑÑ…¡µ•¹Ñ5…À¹Í•Ğ¡­•ä°ìÕÉ°èÑ•áĞ°É•™•É•¹•ÌèmÁ…Ñ¡tô¤ì(€€€€€€€€€ô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡Ù…±Õ”¤¤ì(€€€€€€€Ù…±Õ”¹™½É…  ¡¥Ñ•´°¥¹‘•à¤€ôøÙ¥Í¥Ñ	…­ÕÁY…±Õ”¡¥Ñ•´°€‘íÁ…Ñ¡õl‘í¥¹‘•áõu€¤¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€¥˜€¡Ù…±Õ”€˜˜ÑåÁ•½˜Ù…±Õ”€ôôô€‰½‰©•Ğˆ¤ì(€€€€€€€=‰©•Ğ¹•¹ÑÉ¥•Ì¡Ù…±Õ”¤¹™½É…  ¡m­•ä°¥Ñ•µt¤€ôøÙ¥Í¥Ñ	…­ÕÁY…±Õ”¡¥Ñ•´°Á…Ñ €ü€‘íÁ…Ñ¡ô¸‘í­•åõ€€è­•ä¤¤ì(€€€€€ô(€€€ôì((€€€Ù¥Í¥Ñ	…­ÕÁY…±Õ”¡‰…­ÕÁA…å±½…¹‘…Ñ„°€‰‘…Ñ„ˆ¤ì(€€€É•ÑÕÉ¸…ÑÑ…¡µ•¹Ñ5…Àì(€ôì((€½¹ÍĞ•ÑMÑ½É…•=‰©•Ñ-•ä€ô€¡ÕÉ°èÍÑÉ¥¹œ¤€ôøì(€€€ÑÉäì(€€€€€½¹ÍĞÁ…Ñ¡9…µ”€ô‘•½‘•UI%½µÁ½¹•¹Ğ¡¹•ÜUI0¡ÕÉ°¤¹Á…Ñ¡¹…µ”¤ì(€€€€€½¹ÍĞµ…É­•ÉÌ€ôlˆ½ÍÑ½É…”½ØÄ½½‰©•Ğ½ÁÕ‰±¥Œ¼ˆ°€ˆ½ÍÑ½É…”½ØÄ½½‰©•Ğ½Í¥¸¼ˆ°€ˆ½ÍÑ½É…”½ØÄ½½‰©•Ğ½…ÕÑ¡•¹Ñ¥…Ñ•¼‰tì(€€€€€™½È€¡½¹ÍĞµ…É­•È½˜µ…É­•ÉÌ¤ì(€€€€€€€½¹ÍĞµ…É­•É%¹‘•à€ôÁ…Ñ¡9…µ”¹¥¹‘•á=˜¡µ…É­•È¤ì(€€€€€€€¥˜€¡µ…É­•É%¹‘•à€øô€À¤É•ÑÕÉ¸Á…Ñ¡9…µ”¹Í±¥”¡µ…É­•É%¹‘•à€¬µ…É­•È¹±•¹Ñ ¤¹É•Á±…” ½yp¼¬¼°€ˆˆ¤ì(€€€€€ô(€€€ô…Ñ ì(€€€€€É•ÑÕÉ¸€ˆˆì(€€€ô(€€€É•ÑÕÉ¸€ˆˆì(€ôì((€½¹ÍĞ™½Éµ…ÑMÑ½É…•M¥é”€ô€¡‰åÑ•Ìè¹Õµ‰•È¤€ôøì(€€€¥˜€ …‰åÑ•Ì¤É•ÑÕÉ¸€ˆÁˆì(€€€¥˜€¡‰åÑ•Ì€ğ€ÄÀÈĞ¤É•ÑÕÉ¸€‘í‰åÑ•Íõ	€ì(€€€¥˜€¡‰åÑ•Ì€ğ€ÄÀÈĞ€¨€ÄÀÈĞ¤É•ÑÕÉ¸€‘ì¡‰åÑ•Ì€¼€ÄÀÈĞ¤¹Ñ½¥á• Ä¥õ-	€ì(€€€¥˜€¡‰åÑ•Ì€ğ€ÄÀÈĞ€¨€ÄÀÈĞ€¨€ÄÀÈĞ¤É•ÑÕÉ¸€‘ì¡‰åÑ•Ì€¼€ÄÀÈĞ€¼€ÄÀÈĞ¤¹Ñ½¥á• Ä¥õ5	€ì(€€€É•ÑÕÉ¸€‘ì¡‰åÑ•Ì€¼€ÄÀÈĞ€¼€ÄÀÈĞ€¼€ÄÀÈĞ¤¹Ñ½¥á• È¥õ	€ì(€ôì((€½¹ÍĞ½Á•¹MÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ”€ô€¡¥Ñ•´èì‰Õ­•ĞèÍÑÉ¥¹œìÁ…Ñ èÍÑÉ¥¹œô¤€ôøì(€€€½¹ÍĞì‘…Ñ„ô€ôÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´¡¥Ñ•´¹‰Õ­•Ğ¤¹•ÑAÕ‰±¥UÉ°¡¥Ñ•´¹Á…Ñ ¤ì(€€€¥˜€ …‘…Ñ„ü¹ÁÕ‰±¥UÉ°¤ì(€€€€€…±•ÉĞ ‹¶23²vğƒ²ó²3®–ğƒ¶fW²vã¶V€ƒ²"`ƒ²^²*×®.#®.¸ˆ¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍĞ…¹¡½È€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰„ˆ¤ì(€€€…¹¡½È¹¡É•˜€ô‘…Ñ„¹ÁÕ‰±¥UÉ°ì(€€€…¹¡½È¹Ñ…É•Ğ€ô€‰}‰±…¹¬ˆì(€€€…¹¡½È¹É•°€ô€‰¹½½Á•¹•È¹½É•™•ÉÉ•Èˆì(€€€‘½Õµ•¹Ğ¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡…¹¡½È¤ì(€€€…¹¡½È¹±¥¬ ¤ì(€€€…¹¡½È¹É•µ½Ù” ¤ì(€ôì((€½¹ÍĞ‘½İ¹±½…‘)Í½¹	…­ÕÀ€ô€ ¤€ôøì(€€€½¹ÍĞ‰±½ˆ€ô¹•Ü	±½ˆ¡m)M=8¹ÍÑÉ¥¹¥™ä¡‰…­ÕÁA…å±½…°¹Õ±°°€È¥t°ìÑåÁ”è€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸í¡…ÉÍ•ĞõÕÑ˜´àˆô¤ì(€€€½¹ÍĞÕÉ°€ôUI0¹É•…Ñ•=‰©•ÑUI0¡‰±½ˆ¤ì(€€€½¹ÍĞ„€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰„ˆ¤ì(€€€„¹¡É•˜€ôÕÉ°ì(€€€„¹‘½İ¹±½…€ôÑ…•µåÕ¹}•ÉÁ}‰…­ÕÁ|‘íÑ½‘…åQ•áĞ ¥ô¹©Í½¹€ì(€€€„¹±¥¬ ¤ì(€€€UI0¹É•Ù½­•=‰©•ÑUI0¡ÕÉ°¤ì(€ôì((€½¹ÍĞ‘½İ¹±½…‘	…­ÕÁ]¥Ñ¡ÑÑ…¡µ•¹ÑÌ€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜€¡…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍäñğ‰…­ÕÁM…Ù¥¹œ¤É•ÑÕÉ¸ì((€€€½¹ÍĞ…ÑÑ…¡µ•¹Ñ5…À€ô½±±•ÑÑÑ…¡µ•¹ÑI•™•É•¹•Ì ¤ì(€€€½¹ÍĞ…ÑÑ…¡µ•¹ÑÌ€ôÉÉ…ä¹™É½´¡…ÑÑ…¡µ•¹Ñ5…À¹Ù…±Õ•Ì ¤¤ì((€€€½¹ÍĞÁ¥­•È€ô€¡İ¥¹‘½Ü…Ì…¹ä¤¹Í¡½İ¥É•Ñ½ÉåA¥­•Èì(€€€¥˜€¡ÑåÁ•½˜Á¥­•È€„ôô€‰™Õ¹Ñ¥½¸ˆ¤ì(€€€€€…±•ÉĞ ‹²Ê£®Ú ƒ¶>³¶V ƒ®ÂÇ²^²v A²j¤‘”ƒ®bC®*P¡É½µ—²^C²pƒ²
³²j§¶V€ƒ²"`ƒ²z#²*×®.#®.¸ˆ¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜€ …½¹™¥É´¡ƒ®Î×ªÖ³²j¤)M=;ªÎğƒ²Ê£®Ú¶23²vğ€‘í…ÑÑ…¡µ•¹ÑÌ¹±•¹Ñ¡÷ªÂs®–ğƒ²ƒ¶w¶Vpƒ¶>Ó®6S²^@ƒ®ÂÇ²^¶Vƒªæ3²jPı€¤¤É•ÑÕÉ¸ì((€€€±•ĞÍ•±•Ñ•‘¥É•Ñ½Éäè…¹äì(€€€ÑÉäì(€€€€€Í•±•Ñ•‘¥É•Ñ½Éä€ô…İ…¥ĞÁ¥­•È¹…±°¡İ¥¹‘½Ü°ìµ½‘”è€‰É•…‘İÉ¥Ñ”ˆ°ÍÑ…ÉÑ%¸è€‰‘½İ¹±½…‘Ìˆô¤ì(€€€ô…Ñ €¡•ÉÉ½Èè…¹ä¤ì(€€€€€¥˜€¡•ÉÉ½Èü¹¹…µ”€„ôô€‰‰½ÉÑÉÉ½Èˆ¤…±•ÉĞ¡•ÉÉ½Èü¹µ•ÍÍ…”ñğ€‹®ÂÇ²^ƒ¶>Ó®6S®–ğƒ²^Ğƒ²"`ƒ²^²*×®.#®.¸ˆ¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô((€€€Í•ÑÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍä¡ÑÉÕ”¤ì(€€€Í•ÑÑÑ…¡µ•¹Ñ	…­ÕÁAÉ½É•ÍÌ ‹®ÂÇ²^ƒ¶>Ó®6Pƒ²’®æƒ²’D¸¸¸ˆ¤ì((€€€ÑÉäì(€€€€€½¹ÍĞ¹½Ü€ô¹•Ü…Ñ” ¤ì(€€€€€½¹ÍĞÑ¥µ•-•ä€ô€‘í•ÑQ½‘…å-•ä ¤¹É•Á±…” ¼´½œ°€ˆˆ¥õ|‘íMÑÉ¥¹œ¡¹½Ü¹•Ñ!½ÕÉÌ ¤¤¹Á…‘MÑ…ÉĞ È°€ˆÀˆ¥ô‘íMÑÉ¥¹œ¡¹½Ü¹•Ñ5¥¹ÕÑ•Ì ¤¤¹Á…‘MÑ…ÉĞ È°€ˆÀˆ¥õ€ì(€€€€€½¹ÍĞ‰…­ÕÁ¥É•Ñ½Éä€ô…İ…¥ĞÍ•±•Ñ•‘¥É•Ñ½Éä¹•Ñ¥É•Ñ½Éå!…¹‘±”¡IA²Ê£®Ú¶>³¶V£®ÂÇ²^|‘íÑ¥µ•-•åõ€°ìÉ•…Ñ”èÑÉÕ”ô¤ì(€€€€€½¹ÍĞ…ÑÑ…¡µ•¹Ñ¥É•Ñ½Éä€ô…İ…¥Ğ‰…­ÕÁ¥É•Ñ½Éä¹•Ñ¥É•Ñ½Éå!…¹‘±” ‰…ÑÑ…¡µ•¹ÑÌˆ°ìÉ•…Ñ”èÑÉÕ”ô¤ì((€€€€€½¹ÍĞİÉ¥Ñ•!…¹‘±”€ô…Íå¹Œ€¡‘¥É•Ñ½Éäè…¹ä°™¥±•9…µ”èÍÑÉ¥¹œ°‘…Ñ„è	±½ˆğÍÑÉ¥¹œ¤€ôøì(€€€€€€€½¹ÍĞ¡…¹‘±”€ô…İ…¥Ğ‘¥É•Ñ½Éä¹•Ñ¥±•!…¹‘±”¡™¥±•9…µ”°ìÉ•…Ñ”èÑÉÕ”ô¤ì(€€€€€€€½¹ÍĞİÉ¥Ñ…‰±”€ô…İ…¥Ğ¡…¹‘±”¹É•…Ñ•]É¥Ñ…‰±” ¤ì(€€€€€€€…İ…¥ĞİÉ¥Ñ…‰±”¹İÉ¥Ñ”¡‘…Ñ„¤ì(€€€€€€€…İ…¥ĞİÉ¥Ñ…‰±”¹±½Í” ¤ì(€€€€€ôì((€€€€€…İ…¥ĞİÉ¥Ñ•!…¹‘±” (€€€€€€€‰…­ÕÁ¥É•Ñ½Éä°(€€€€€€€€‰IA²‚²ÊÓ®ÂÇ²^¹©Í½¸ˆ°(€€€€€€€¹•Ü	±½ˆ¡m)M=8¹ÍÑÉ¥¹¥™ä¡‰…­ÕÁA…å±½…°¹Õ±°°€È¥t°ìÑåÁ”è€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸í¡…ÉÍ•ĞõÕÑ˜´àˆô¤(€€€€€€¤ì((€€€€€½¹ÍĞÕÍ•‘9…µ•Ì€ô¹•ÜM•ĞñÍÑÉ¥¹œø ¤ì(€€€€€½¹ÍĞµ…¹¥™•ÍĞèÉÉ…äñì(€€€€€€€™¥±•}¹…µ”èÍÑÉ¥¹œì(€€€€€€€½É¥¥¹…±}ÕÉ°èÍÑÉ¥¹œì(€€€€€€€É•™•É•¹•ÌèÍÑÉ¥¹mtì(€€€€€€€Í¥é•}‰åÑ•Ìè¹Õµ‰•Èì(€€€€€€€ÍÑ…ÑÕÌè€‰Í…Ù•ˆğ€‰™…¥±•ˆì(€€€€€€€•ÉÉ½ÈüèÍÑÉ¥¹œì(€€€€€ôø€ômtì((€€€€€™½È€¡±•Ğ¥¹‘•à€ô€Àì¥¹‘•à€ğ…ÑÑ…¡µ•¹ÑÌ¹±•¹Ñ ì¥¹‘•à€¬ô€Ä¤ì(€€€€€€€½¹ÍĞ…ÑÑ…¡µ•¹Ğ€ô…ÑÑ…¡µ•¹ÑÍm¥¹‘•átì(€€€€€€€Í•ÑÑÑ…¡µ•¹Ñ	…­ÕÁAÉ½É•ÍÌ¡ƒ²Ê£®Ú¶23²vğƒ²‚²z”€‘í¥¹‘•à€¬€Åô¼‘í…ÑÑ…¡µ•¹ÑÌ¹±•¹Ñ¡õ€¤ì((€€€€€€€±•Ğ½É¥¥¹…±9…µ”€ô…ÑÑ…¡µ•¹Ğ´‘íMÑÉ¥¹œ¡¥¹‘•à€¬€Ä¤¹Á…‘MÑ…ÉĞ Ğ°€ˆÀˆ¥õ€ì(€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍĞÁ…Ñ¡9…µ”€ô¹•ÜUI0¡…ÑÑ…¡µ•¹Ğ¹ÕÉ°¤¹Á…Ñ¡¹…µ”ì(€€€€€€€€€½É¥¥¹…±9…µ”€ô‘•½‘•UI%½µÁ½¹•¹Ğ¡Á…Ñ¡9…µ”¹ÍÁ±¥Ğ ˆ¼ˆ¤¹Á½À ¤ñğ½É¥¥¹…±9…µ”¤ì(€€€€€€€ô…Ñ ì(€€€€€€€€€€¼¼-••ÀÑ¡”•¹•É…Ñ•™…±±‰…¬™¥±•¹…µ”¸(€€€€€€€ô((€€€€€€€½É¥¥¹…±9…µ”€ô½É¥¥¹…±9…µ”(€€€€€€€€€€¹É•Á±…” ½mxÀ´å„µéµkªÂ ·¶zŒ¹|µt¬½œ°€‰|ˆ¤(€€€€€€€€€€¹É•Á±…” ½yp¸¬¼°€ˆˆ¤(€€€€€€€€€€¹Í±¥” À°€ÄÔÀ¤ñğ…ÑÑ…¡µ•¹Ğ´‘íMÑÉ¥¹œ¡¥¹‘•à€¬€Ä¤¹Á…‘MÑ…ÉĞ Ğ°€ˆÀˆ¥õ€ì((€€€€€€€±•Ğ™¥±•9…µ”€ô½É¥¥¹…±9…µ”ì(€€€€€€€±•Ğ‘ÕÁ±¥…Ñ•%¹‘•à€ô€Èì(€€€€€€€İ¡¥±”€¡ÕÍ•‘9…µ•Ì¹¡…Ì¡™¥±•9…µ”¹Ñ½1½İ•É…Í” ¤¤¤ì(€€€€€€€€€½¹ÍĞ‘½Ñ%¹‘•à€ô½É¥¥¹…±9…µ”¹±…ÍÑ%¹‘•á=˜ ˆ¸ˆ¤ì(€€€€€€€€€½¹ÍĞ‰…Í”€ô‘½Ñ%¹‘•à€ø€À€ü½É¥¥¹…±9…µ”¹Í±¥” À°‘½Ñ%¹‘•à¤€è½É¥¥¹…±9…µ”ì(€€€€€€€€€½¹ÍĞ•áĞ€ô‘½Ñ%¹‘•à€ø€À€ü½É¥¥¹…±9…µ”¹Í±¥”¡‘½Ñ%¹‘•à¤€è€ˆˆì(€€€€€€€€€™¥±•9…µ”€ô€‘í‰…Í•ô´‘í‘ÕÁ±¥…Ñ•%¹‘•áô‘í•áÑõ€ì(€€€€€€€€€‘ÕÁ±¥…Ñ•%¹‘•à€¬ô€Äì(€€€€€€€ô(€€€€€€€ÕÍ•‘9…µ•Ì¹…‘¡™¥±•9…µ”¹Ñ½1½İ•É…Í” ¤¤ì((€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍĞÉ•ÍÁ½¹Í”€ô…İ…¥Ğ™•Ñ ¡…ÑÑ…¡µ•¹Ğ¹ÕÉ°¤ì(€€€€€€€€€¥˜€ …É•ÍÁ½¹Í”¹½¬¤Ñ¡É½Ü¹•ÜÉÉ½È¡!QQ@€‘íÉ•ÍÁ½¹Í”¹ÍÑ…ÑÕÍõ€¤ì(€€€€€€€€€½¹ÍĞ‰±½ˆ€ô…İ…¥ĞÉ•ÍÁ½¹Í”¹‰±½ˆ ¤ì(€€€€€€€€€…İ…¥ĞİÉ¥Ñ•!…¹‘±”¡…ÑÑ…¡µ•¹Ñ¥É•Ñ½Éä°™¥±•9…µ”°‰±½ˆ¤ì(€€€€€€€€€µ…¹¥™•ÍĞ¹ÁÕÍ ¡ì(€€€€€€€€€€€™¥±•}¹…µ”è…ÑÑ…¡µ•¹ÑÌ¼‘í™¥±•9…µ•õ€°(€€€€€€€€€€€½É¥¥¹…±}ÕÉ°è…ÑÑ…¡µ•¹Ğ¹ÕÉ°°(€€€€€€€€€€€É•™•É•¹•Ìè…ÑÑ…¡µ•¹Ğ¹É•™•É•¹•Ì°(€€€€€€€€€€€Í¥é•}‰åÑ•Ìè‰±½ˆ¹Í¥é”°(€€€€€€€€€€€ÍÑ…ÑÕÌè€‰Í…Ù•ˆ°(€€€€€€€€€ô¤ì(€€€€€€€ô…Ñ €¡•ÉÉ½Èè…¹ä¤ì(€€€€€€€€€µ…¹¥™•ÍĞ¹ÁÕÍ ¡ì(€€€€€€€€€€€™¥±•}¹…µ”è…ÑÑ…¡µ•¹ÑÌ¼‘í™¥±•9…µ•õ€°(€€€€€€€€€€€½É¥¥¹…±}ÕÉ°è…ÑÑ…¡µ•¹Ğ¹ÕÉ°°(€€€€€€€€€€€É•™•É•¹•Ìè…ÑÑ…¡µ•¹Ğ¹É•™•É•¹•Ì°(€€€€€€€€€€€Í¥é•}‰åÑ•Ìè€À°(€€€€€€€€€€€ÍÑ…ÑÕÌè€‰™…¥±•ˆ°(€€€€€€€€€€€•ÉÉ½Èè•ÉÉ½Èü¹µ•ÍÍ…”ñğ€‹®.“²jÓ®†s®Npƒ².“¶2 ˆ°(€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€€ô((€€€€€½¹ÍĞÍ…Ù•‘½Õ¹Ğ€ôµ…¹¥™•ÍĞ¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹ÍÑ…ÑÕÌ€ôôô€‰Í…Ù•ˆ¤¹±•¹Ñ ì(€€€€€½¹ÍĞ™…¥±•‘½Õ¹Ğ€ôµ…¹¥™•ÍĞ¹±•¹Ñ €´Í…Ù•‘½Õ¹Ğì(€€€€€½¹ÍĞÑ½Ñ…±M¥é”€ôµ…¹¥™•ÍĞ¹É•‘Õ” ¡ÍÕ´°¥Ñ•´¤€ôøÍÕ´€¬¥Ñ•´¹Í¥é•}‰åÑ•Ì°€À¤ì(€€€€€½¹ÍĞµ…¹¥™•ÍÑA…å±½…€ôì(€€€€€€€•áÁ½ÉÑ•‘}…Ğè¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€€€€€…ÑÑ…¡µ•¹Ñ}½Õ¹Ğèµ…¹¥™•ÍĞ¹±•¹Ñ °(€€€€€€€Í…Ù•‘}½Õ¹ĞèÍ…Ù•‘½Õ¹Ğ°(€€€€€€€™…¥±•‘}½Õ¹Ğè™…¥±•‘½Õ¹Ğ°(€€€€€€€Ñ½Ñ…±}Í¥é•}‰åÑ•ÌèÑ½Ñ…±M¥é”°(€€€€€€€™¥±•Ìèµ…¹¥™•ÍĞ°(€€€€€ôì((€€€€€…İ…¥ĞİÉ¥Ñ•!…¹‘±” (€€€€€€€‰…­ÕÁ¥É•Ñ½Éä°(€€€€€€€€‹²Ê£®Ú¶23²vñ®ª§®†t¹©Í½¸ˆ°(€€€€€€€¹•Ü	±½ˆ¡m)M=8¹ÍÑÉ¥¹¥™ä¡µ…¹¥™•ÍÑA…å±½…°¹Õ±°°€È¥t°ìÑåÁ”è€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸í¡…ÉÍ•ĞõÕÑ˜´àˆô¤(€€€€€€¤ì((€€€€€¥˜€¡™…¥±•‘½Õ¹Ğ¤ì(€€€€€€€…±•ÉĞ¡ƒ²Ê£®Ú ƒ¶>³¶V ƒ®ÂÇ²^²vĞƒ²f®3®BC²®0€‘í™…¥±•‘½Õ¹Ñ÷ªÂpƒ¶23²vó²v ƒ²‚²z—¶Vc² ƒ®ªï¶Z#²*×®.#®.¸ƒ®ÂÇ²^ƒ¶>Ó®6S²v`ƒ²Ê£®Ú¶23²vñ®ª§®†t¹©Í½»²vƒ¶fW²vã¶Vc²ã²jP¹€¤ì(€€€€€ô•±Í”ì(€€€€€€€Í¡½İQ½…ÍĞ¡ƒ²Ê£®Ú¶23²vğ€‘íÍ…Ù•‘½Õ¹Ñ÷ªÂs®–ğƒ¶>³¶V£¶VĞƒ®ÂÇ²^¶Z#²*×®.#®.¹€¤ì(€€€€€ô(€€€ô…Ñ €¡•ÉÉ½Èè…¹ä¤ì(€€€€€…±•ÉĞ¡•ÉÉ½Èü¹µ•ÍÍ…”ñğ€‹²Ê£®Ú ƒ¶>³¶V ƒ®ÂÇ²^ƒ²’Dƒ²b“®–cªÂ ƒ®Âs²w¶Z#²*×®.#®.¸ˆ¤ì(€€€ô™¥¹…±±äì(€€€€€Í•ÑÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍä¡™…±Í”¤ì(€€€€€Í•ÑÑÑ…¡µ•¹Ñ	…­ÕÁAÉ½É•ÍÌ ˆˆ¤ì(€€€ô(€ôì((€½¹ÍĞÍ…¹U¹ÕÍ•‘ÑÑ…¡µ•¹ÑÌ€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜€¡ÍÑ½É…•±•…¹ÕÁ	ÕÍäñğ…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍäñğ‰…­ÕÁM…Ù¥¹œ¤É•ÑÕÉ¸ì(€€€Í•ÑMÑ½É…•±•…¹ÕÁ	ÕÍä¡ÑÉÕ”¤ì(€€€Í•ÑMÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¡mt¤ì(€€€Í•ÑMÑ½É…•±•…¹ÕÁMÕµµ…Éä¡¹Õ±°¤ì((€€€ÑÉäì(€€€€€½¹ÍĞÉ•™•É•¹•‘-•åÌ€ô¹•ÜM•Ğ (€€€€€€€ÉÉ…ä¹™É½´¡½±±•ÑÑÑ…¡µ•¹ÑI•™•É•¹•Ì ¤¹Ù…±Õ•Ì ¤¤(€€€€€€€€€€¹µ…À ¡¥Ñ•´¤€ôø•ÑMÑ½É…•=‰©•Ñ-•ä¡¥Ñ•´¹ÕÉ°¤¤(€€€€€€€€€€¹™¥±Ñ•È¡	½½±•…¸¤(€€€€€€¤ì(€€€€€½¹ÍĞ‰Õ­•ÑÌ€ôl‰É••¥ÁÑÌˆ°€‰ÁÕÉ¡…Í”µÁ¡½Ñ½Ìˆ°€‰µ…¥¹Ñ•¹…¹”µÁ¡½Ñ½Ì‰tì(€€€€€½¹ÍĞÕÑ½™™Q¥µ”€ô…Ñ”¹¹½Ü ¤€´€Ü€¨€ÈĞ€¨€ØÀ€¨€ØÀ€¨€ÄÀÀÀì(€€€€€½¹ÍĞ…¹‘¥‘…Ñ•ÌèÉÉ…äñì‰Õ­•ĞèÍÑÉ¥¹œìÁ…Ñ èÍÑÉ¥¹œìÍ¥é”è¹Õµ‰•ÈìÉ•…Ñ•‘ĞèÍÑÉ¥¹œôø€ômtì(€€€€€±•ĞÍ…¹¹•€ô€Àì(€€€€€±•ĞÉ•™•É•¹•€ô€Àì((€€€€€™½È€¡½¹ÍĞ‰Õ­•Ğ½˜‰Õ­•ÑÌ¤ì(€€€€€€€±•Ğ½™™Í•Ğ€ô€Àì(€€€€€€€İ¡¥±”€¡ÑÉÕ”¤ì(€€€€€€€€€½¹ÍĞì‘…Ñ„°•ÉÉ½Èô€ô…İ…¥ĞÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´¡‰Õ­•Ğ¤¹±¥ÍĞ ˆˆ°ì(€€€€€€€€€€€±¥µ¥Ğè€ÄÀÀÀ°(€€€€€€€€€€€½™™Í•Ğ°(€€€€€€€€€€€Í½ÉÑ	äèì½±Õµ¸è€‰¹…µ”ˆ°½É‘•Èè€‰…ÍŒˆô°(€€€€€€€€€ô¤ì(€€€€€€€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡€‘í‰Õ­•Ñôƒ²‚²z—²0ƒªÊ²
°ƒ².“¶2 è€‘í•ÉÉ½È¹µ•ÍÍ…•õ€¤ì((€€€€€€€€€½¹ÍĞ½‰©•ÑÌ€ô€¡‘…Ñ„ñğmt¤¹™¥±Ñ•È ¡¥Ñ•´è…¹ä¤€ôø¥Ñ•´ü¹¹…µ”€˜˜¥Ñ•´¹¹…µ”€„ôô€ˆ¹•µÁÑå½±‘•ÉA±…•¡½±‘•Èˆ¤ì(€€€€€€€€€Í…¹¹•€¬ô½‰©•ÑÌ¹±•¹Ñ ì((€€€€€€€€€½‰©•ÑÌ¹™½É…  ¡¥Ñ•´è…¹ä¤€ôøì(€€€€€€€€€€€½¹ÍĞÁ…Ñ €ôMÑÉ¥¹œ¡¥Ñ•´¹¹…µ”ñğ€ˆˆ¤ì(€€€€€€€€€€€½¹ÍĞ½‰©•Ñ-•ä€ô€‘í‰Õ­•Ñô¼‘íÁ…Ñ¡õ€ì(€€€€€€€€€€€¥˜€¡É•™•É•¹•‘-•åÌ¹¡…Ì¡½‰©•Ñ-•ä¤¤ì(€€€€€€€€€€€€€É•™•É•¹•€¬ô€Äì(€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍĞÉ•…Ñ•‘Ğ€ôMÑÉ¥¹œ¡¥Ñ•´¹É•…Ñ•‘}…Ğñğ¥Ñ•´¹ÕÁ‘…Ñ•‘}…Ğñğ€ˆˆ¤ì(€€€€€€€€€€€½¹ÍĞÉ•…Ñ•‘Q¥µ”€ôÉ•…Ñ•‘Ğ€ü¹•Ü…Ñ”¡É•…Ñ•‘Ğ¤¹•ÑQ¥µ” ¤€è9Õµ‰•È¹9…8ì(€€€€€€€€€€€¥˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡É•…Ñ•‘Q¥µ”¤ñğÉ•…Ñ•‘Q¥µ”€øÕÑ½™™Q¥µ”¤É•ÑÕÉ¸ì((€€€€€€€€€€€…¹‘¥‘…Ñ•Ì¹ÁÕÍ ¡ì(€€€€€€€€€€€€€‰Õ­•Ğ°(€€€€€€€€€€€€€Á…Ñ °(€€€€€€€€€€€€€Í¥é”è9Õµ‰•È¡¥Ñ•´¹µ•Ñ…‘…Ñ„ü¹Í¥é”ñğ€À¤°(€€€€€€€€€€€€€É•…Ñ•‘Ğ°(€€€€€€€€€€€ô¤ì(€€€€€€€€€ô¤ì((€€€€€€€€€¥˜€ ¡‘…Ñ„ñğmt¤¹±•¹Ñ €ğ€ÄÀÀÀ¤‰É•…¬ì(€€€€€€€€€½™™Í•Ğ€¬ô€ÄÀÀÀì(€€€€€€€ô(€€€€€ô((€€€€€½¹ÍĞ…¹‘¥‘…Ñ•	åÑ•Ì€ô…¹‘¥‘…Ñ•Ì¹É•‘Õ” ¡ÍÕ´°¥Ñ•´¤€ôøÍÕ´€¬¥Ñ•´¹Í¥é”°€À¤ì(€€€€€Í•ÑMÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¡…¹‘¥‘…Ñ•Ì¤ì(€€€€€Í•ÑMÑ½É…•±•…¹ÕÁMÕµµ…Éä¡ì(€€€€€€€Í…¹¹•°(€€€€€€€É•™•É•¹•°(€€€€€€€…¹‘¥‘…Ñ•	åÑ•Ì°(€€€€€€€¡•­•‘Ğè¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€€€ô¤ì((€€€€€¥˜€ ……¹‘¥‘…Ñ•Ì¹±•¹Ñ ¤Í¡½İQ½…ÍĞ ‹²‚W®š³¶V€ƒ®¾ã²
³²j¤ƒ²Ê£®Ú¶23²vó²vĞƒ²^²*×®.#®.¸ˆ¤ì(€€€ô…Ñ €¡•ÉÉ½Èè…¹ä¤ì(€€€€€…±•ÉĞ¡•ÉÉ½Èü¹µ•ÍÍ…”ñğ€‹®¾ã²
³²j¤ƒ²Ê£®Ú¶23²vğƒªÊ²
°ƒ²’Dƒ²b“®–cªÂ ƒ®Âs²w¶Z#²*×®.#®.¸ˆ¤ì(€€€ô™¥¹…±±äì(€€€€€Í•ÑMÑ½É…•±•…¹ÕÁ	ÕÍä¡™…±Í”¤ì(€€€ô(€ôì((€½¹ÍĞ‘•±•Ñ•U¹ÕÍ•‘ÑÑ…¡µ•¹ÑÌ€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜€¡ÍÑ½É…•±•…¹ÕÁ	ÕÍäñğ€…ÍÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¹±•¹Ñ ¤É•ÑÕÉ¸ì((€€€½¹ÍĞÉ•™•É•¹•‘-•åÌ€ô¹•ÜM•Ğ (€€€€€ÉÉ…ä¹™É½´¡½±±•ÑÑÑ…¡µ•¹ÑI•™•É•¹•Ì ¤¹Ù…±Õ•Ì ¤¤(€€€€€€€€¹µ…À ¡¥Ñ•´¤€ôø•ÑMÑ½É…•=‰©•Ñ-•ä¡¥Ñ•´¹ÕÉ°¤¤(€€€€€€€€¹™¥±Ñ•È¡	½½±•…¸¤(€€€€¤ì(€€€½¹ÍĞÍ…™•…¹‘¥‘…Ñ•Ì€ôÍÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø€…É•™•É•¹•‘-•åÌ¹¡…Ì¡€‘í¥Ñ•´¹‰Õ­•Ñô¼‘í¥Ñ•´¹Á…Ñ¡õ€¤¤ì(€€€½¹ÍĞÑ½Ñ…±	åÑ•Ì€ôÍ…™•…¹‘¥‘…Ñ•Ì¹É•‘Õ” ¡ÍÕ´°¥Ñ•´¤€ôøÍÕ´€¬¥Ñ•´¹Í¥é”°€À¤ì((€€€¥˜€ …Í…™•…¹‘¥‘…Ñ•Ì¹±•¹Ñ ¤ì(€€€€€Í•ÑMÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¡mt¤ì(€€€€€Í¡½İQ½…ÍĞ ‹¶b²z°ƒ²zC®3²^C²pƒ®.“².pƒ²
³²j¤ƒ²’G²vàƒ¶23²vó²v ƒ²
·²‚s¶Vc² ƒ²V+²Vc²*×®.#®.¸ˆ¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜€ …½¹™¥É´¡€ß²vğƒ²vÓ²ƒ²
³²j§®Bc² ƒ²V+²v ƒ²Ê£®Ú¶23²vğ€‘íÍ…™•…¹‘¥‘…Ñ•Ì¹±•¹Ñ¡÷ªÂp ‘í™½Éµ…ÑMÑ½É…•M¥é”¡Ñ½Ñ…±	åÑ•Ì¥ô§®–ğƒ²f²‚¶z ƒ²
·²‚s¶Vƒªæ3²jPüƒ²vĞƒ²zG²^²v ƒ®Bc®>3®šĞƒ²"`ƒ²^²*×®.#®.¹€¤¤É•ÑÕÉ¸ì((€€€Í•ÑMÑ½É…•±•…¹ÕÁ	ÕÍä¡ÑÉÕ”¤ì(€€€ÑÉäì(€€€€€½¹ÍĞ™…¥±•èÑåÁ•½˜Í…™•…¹‘¥‘…Ñ•Ì€ômtì(€€€€€±•Ğ‘•±•Ñ•‘½Õ¹Ğ€ô€Àì(€€€€€½¹ÍĞ‰Õ­•ÑÌ€ôÉÉ…ä¹™É½´¡¹•ÜM•Ğ¡Í…™•…¹‘¥‘…Ñ•Ì¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹‰Õ­•Ğ¤¤¤ì((€€€€€™½È€¡½¹ÍĞ‰Õ­•Ğ½˜‰Õ­•ÑÌ¤ì(€€€€€€€½¹ÍĞ‰Õ­•Ñ%Ñ•µÌ€ôÍ…™•…¹‘¥‘…Ñ•Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹‰Õ­•Ğ€ôôô‰Õ­•Ğ¤ì(€€€€€€€™½È€¡±•Ğ¥¹‘•à€ô€Àì¥¹‘•à€ğ‰Õ­•Ñ%Ñ•µÌ¹±•¹Ñ ì¥¹‘•à€¬ô€ÄÀÀ¤ì(€€€€€€€€€½¹ÍĞ¡Õ¹¬€ô‰Õ­•Ñ%Ñ•µÌ¹Í±¥”¡¥¹‘•à°¥¹‘•à€¬€ÄÀÀ¤ì(€€€€€€€€€½¹ÍĞì•ÉÉ½Èô€ô…İ…¥ĞÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´¡‰Õ­•Ğ¤¹É•µ½Ù”¡¡Õ¹¬¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹Á…Ñ ¤¤ì(€€€€€€€€€¥˜€¡•ÉÉ½È¤™…¥±•¹ÁÕÍ  ¸¸¹¡Õ¹¬¤ì(€€€€€€€€€•±Í”‘•±•Ñ•‘½Õ¹Ğ€¬ô¡Õ¹¬¹±•¹Ñ ì(€€€€€€€ô(€€€€€ô((€€€€€Í•ÑMÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¡™…¥±•¤ì(€€€€€Í•ÑMÑ½É…•±•…¹ÕÁMÕµµ…Éä ¡ÕÉÉ•¹Ğ¤€ôøÕÉÉ•¹Ğ€üì(€€€€€€€€¸¸¹ÕÉÉ•¹Ğ°(€€€€€€€…¹‘¥‘…Ñ•	åÑ•Ìè™…¥±•¹É•‘Õ” ¡ÍÕ´°¥Ñ•´¤€ôøÍÕ´€¬¥Ñ•´¹Í¥é”°€À¤°(€€€€€€€¡•­•‘Ğè¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€€€ô€èÕÉÉ•¹Ğ¤ì((€€€€€¥˜€¡™…¥±•¹±•¹Ñ ¤ì(€€€€€€€…±•ÉĞ¡€‘í‘•±•Ñ•‘½Õ¹Ñ÷ªÂs®*Pƒ²
·²‚s¶Z#ªÎ€€‘í™…¥±•¹±•¹Ñ¡÷ªÂs®*Pƒ²
·²‚s¶Vc² ƒ®ªï¶Z#²*×®.#®.¸ƒ²‚²z—²0ƒ²
·²‚pƒªÚ3¶Vs²vƒ¶fW²vã¶Vpƒ®Jƒ®.“².pƒªÊ²
³¶Vc²ã²jP¹€¤ì(€€€€€ô•±Í”ì(€€€€€€€Í¡½İQ½…ÍĞ¡ƒ®¾ã²
³²j¤ƒ²Ê£®Ú¶23²vğ€‘í‘•±•Ñ•‘½Õ¹Ñ÷ªÂs®–ğƒ²V#²‚¶VcªÊ0ƒ²‚W®š³¶Z#²*×®.#®.¹€¤ì(€€€€€ô(€€€ô…Ñ €¡•ÉÉ½Èè…¹ä¤ì(€€€€€…±•ÉĞ¡•ÉÉ½Èü¹µ•ÍÍ…”ñğ€‹®¾ã²
³²j¤ƒ²Ê£®Ú¶23²vğƒ²
·²‚pƒ²’Dƒ²b“®–cªÂ ƒ®Âs²w¶Z#²*×®.#®.¸ˆ¤ì(€€€ô™¥¹…±±äì(€€€€€Í•ÑMÑ½É…•±•…¹ÕÁ	ÕÍä¡™…±Í”¤ì(€€€ô(€ôì((€½¹ÍĞÉ•ÍÑ½É•)Í½¹	…­ÕÀ€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜€ …É•ÍÑ½É•¥±”¤É•ÑÕÉ¸…±•ÉĞ ‹®Î×ªÖ³¶V€)M=8ƒ®ÂÇ²^ƒ¶23²vó²vƒ²ƒ¶w¶Vc²ã²jP¸ˆ¤ì(€€€¥˜€ …½¹™¥É´ ‹²ƒ¶w¶Vpƒ®ÂÇ²^ƒ¶23²vó®†pƒ®Î×ªÖ³¶V§®.#®.¸ƒªÂg²v ¥ƒ®6Ã²vÓ¶Ã®*Pƒ®6»²ZÓ²R®.#®.¸ƒ²¶Z'¶Vƒªæ3²jPüˆ¤¤É•ÑÕÉ¸ì((€€€Í•ÑI•ÍÑ½É•	ÕÍä¡ÑÉÕ”¤ì((€€€ÑÉäì(€€€€€½¹ÍĞÉ…Ü€ô…İ…¥ĞÉ•ÍÑ½É•¥±”¹Ñ•áĞ ¤ì(€€€€€½¹ÍĞÁ…ÉÍ•€ô)M=8¹Á…ÉÍ”¡É…Ü¤ì(€€€€€½¹ÍĞ‘…Ñ„€ôÁ…ÉÍ•¹‘…Ñ„ñğÁ…ÉÍ•ì((€€€€€½¹ÍĞÉ•ÍÑ½É•5…ÀèÉÉ…äñmÍÑÉ¥¹œ°…¹åmtğÕ¹‘•™¥¹•‘tø€ôl(€€€€€€€l‰Ù•¹‘½ÉÌˆ°‘…Ñ„¹Ù•¹‘½ÉÍt°(€€€€€€€l‰İ…É•¡½ÕÍ•}É½ÕÁÌˆ°‘…Ñ„¹İ…É•¡½ÕÍ•}É½ÕÁÌñğ‘…Ñ„¹É½ÕÁÍt°(€€€€€€€l‰İ…É•¡½ÕÍ•Ìˆ°‘…Ñ„¹İ…É•¡½ÕÍ•Ít°(€€€€€€€l‰¥Ñ•µÌˆ°‘…Ñ„¹¥Ñ•µÍt°(€€€€€€€l‰ÁÕÉ¡…Í•Ìˆ°‘…Ñ„¹ÁÕÉ¡…Í•Ít°(€€€€€€€l‰µ…¥¹ÑÌˆ°‘…Ñ„¹µ…¥¹ÑÍt°(€€€€€€€l‰…É‘}ÕÍ•Ìˆ°‘…Ñ„¹…É‘}ÕÍ•Ìñğ‘…Ñ„¹…É‘UÍ•Ít°(€€€€€€€l‰Á•Éµ¥Ñ}É•¹•İ…±Ìˆ°‘…Ñ„¹Á•Éµ¥ÑÍt°(€€€€€€€l‰Ù•¹‘½É}…½Õ¹ÑÌˆ°‘…Ñ„¹Ù•¹‘½É}…½Õ¹ÑÌñğ‘…Ñ„¹Ù•¹‘½É½Õ¹ÑÍt°(€€€€€€€l‰É••¥ÁÑ}Á¡½Ñ½Ìˆ°‘…Ñ„¹É••¥ÁÑ}Á¡½Ñ½Ìñğ‘…Ñ„¹É••¥ÁÑA¡½Ñ½Ít°(€€€€€€€l‰µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìˆ°‘…Ñ„¹µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìñğ‘…Ñ„¹µ…¥¹Ñ•¹…¹•A¡½Ñ½Ít°(€€€€€€€l‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìˆ°‘…Ñ„¹µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìñğ‘…Ñ„¹µ…¥¹Ñ•¹…¹•M¡•‘Õ±•Ít°(€€€€€€€l‰ÕÁ‘…Ñ•}¹½Ñ¥•Ìˆ°‘…Ñ„¹ÕÁ‘…Ñ•}¹½Ñ¥•Ìñğ‘…Ñ„¹ÕÁ‘…Ñ•9½Ñ¥•Ít°(€€€€€€€l‰Í¥Ñ•}¹½Ñ¥•Ìˆ°‘…Ñ„¹Í¥Ñ•}¹½Ñ¥•Ìñğ‘…Ñ„¹Í¥Ñ•9½Ñ¥•Ít°(€€€€€€€l‰ÕÍ•É}Á•Éµ¥ÍÍ¥½¹Ìˆ°‘…Ñ„¹ÕÍ•É}Á•Éµ¥ÍÍ¥½¹Ìñğ‘…Ñ„¹ÕÍ•ÉA•Éµ¥ÍÍ¥½¹Ít°(€€€€€€€l‰…Ñ¥Ù¥Ñå}±½Ìˆ°‘…Ñ„¹…Ñ¥Ù¥Ñå}±½Ìñğ‘…Ñ„¹…Ñ¥Ù¥Ñå1½Ít°(€€€€€€€l‰‘•±•Ñ•‘}É•½É‘Ìˆ°‘…Ñ„¹‘•±•Ñ•‘}É•½É‘Ìñğ‘…Ñ„¹‘•±•Ñ•‘I•½É‘Ít°(€€€€€tì((€€€€€™½È€¡½¹ÍĞmÑ…‰±”°É½İÍt½˜É•ÍÑ½É•5…À¤ì(€€€€€€€¥˜€ …ÉÉ…ä¹¥ÍÉÉ…ä¡É½İÌ¤ñğ€…É½İÌ¹±•¹Ñ ¤½¹Ñ¥¹Õ”ì(€€€€€€€½¹ÍĞ¹½Éµ…±¥é•‘I½İÌ€ôÑ…‰±”€ôôô€‰ÁÕÉ¡…Í•Ìˆ(€€€€€€€€€€üÉ½İÌ¹µ…À ¡É½Ü¤€ôø™É½µAÕÉ¡…Í”¡Ñ½AÕÉ¡…Í”¡É½Ü¤¤¤(€€€€€€€€€€èÉ½İÌì(€€€€€€€½¹ÍĞ•ÉÉ½È€ô…İ…¥ĞÕÁÍ•ÉÑ%¹¡Õ¹­Ì¡Ñ…‰±”°¹½Éµ…±¥é•‘I½İÌ°€ÔÀÀ¤ì(€€€€€€€¥˜€¡•ÉÉ½È¤Ñ¡É½Ü¹•ÜÉÉ½È¡€‘íÑ…‰±•ôƒ®Î×ªÖ°ƒ².“¶2 è€‘í•ÉÉ½È¹µ•ÍÍ…•õ€¤ì(€€€€€ô((€€€€€…İ…¥ĞAÉ½µ¥Í”¹…±°¡l(€€€€€€€±½…‘±° ¤°(€€€€€€€±½…‘A•Éµ¥ÑÌ ¤°(€€€€€€€±½…‘Y•¹‘½É½Õ¹ÑÌ ¤°(€€€€€€€±½…‘I••¥ÁÑA¡½Ñ½Ì ¤°(€€€€€€€±½…‘5…¥¹Ñ•¹…¹•A¡½Ñ½Ì ¤°(€€€€€€€±½…‘5…¥¹Ñ•¹…¹•M¡•‘Õ±•Ì ¤°(€€€€€€€±½…‘UÁ‘…Ñ•9½Ñ¥•Ì ¤°(€€€€€€€±½…‘M¥Ñ•9½Ñ¥•Ì ¤°(€€€€€€€±½…‘UÍ•ÉA•Éµ¥ÍÍ¥½¹Ì ¤°(€€€€€€€±½…‘Ñ¥Ù¥Ñå1½Ì ¤°(€€€€€€€±½…‘•±•Ñ•‘I•½É‘Ì ¤°(€€€€€t¤ì((€€€€€Í¡½İQ½…ÍĞ ‹®ÂÇ²^ƒ®Î×ªÖ³ªÂ ƒ²f®3®Bc²^#²*×®.#®.¸ˆ¤ì(€€€€€Í•ÑI•ÍÑ½É•¥±”¡¹Õ±°¤ì(€€€ô…Ñ €¡•ÉÉ½Èè…¹ä¤ì(€€€€€…±•ÉĞ¡•ÉÉ½Èü¹µ•ÍÍ…”ñğ€‹®ÂÇ²^ƒ®Î×ªÖ°ƒ²’Dƒ²b“®–cªÂ ƒ®Âs²w¶Z#²*×®.#®.¸ˆ¤ì(€€€ô™¥¹…±±äì(€€€€€Í•ÑI•ÍÑ½É•	ÕÍä¡™…±Í”¤ì(€€€ô(€ôì((€½¹ÍĞÑ½±•A•Éµ¥ÍÍ¥½¸€ô€¡­•äèÍÑÉ¥¹œ¤€ôøì(€€€½¹ÍĞÕÉÉ•¹Ğ€ôÁ•Éµ¥ÍÍ¥½¹½É´¹Á•Éµ¥ÍÍ¥½¹Ìñğíôì(€€€Í•ÑA•Éµ¥ÍÍ¥½¹½É´¡ì(€€€€€€¸¸¹Á•Éµ¥ÍÍ¥½¹½É´°(€€€€€Á•Éµ¥ÍÍ¥½¹Ìèì€¸¸¹ÕÉÉ•¹Ğ°m­•åtè€…ÕÉÉ•¹Ñm­•åtô°(€€€ô¤ì(€ôì((€½¹ÍĞ•‘¥ÑA•Éµ¥ÍÍ¥½¸€ô€¡¥Ñ•´èUÍ•ÉA•Éµ¥ÍÍ¥½¸¤€ôøì(€€€Í•ÑA•Éµ¥ÍÍ¥½¹½É´¡ì(€€€€€¥è¥Ñ•´¹¥ñğÕ¥ ¤°(€€€€€•µ…¥°èÑ½1½¥¹%¡¥Ñ•´¹•µ…¥°ñğ€ˆˆ¤°(€€€€€É½±”è¥Ñ•´¹É½±”ñğ€‰™¥•±ˆ°(€€€€€Á•Éµ¥ÍÍ¥½¹Ìè¥Ñ•´¹Á•Éµ¥ÍÍ¥½¹Ìñğíô°(€€€ô¤ì(€ôì((€½¹ÍĞ™¥•±‘A•Éµ¥ÍÍ¥½¹É½ÕÁÌ€ôl(€€€ì±…‰•°è€‹ªÖ³®ˆ°­•åÌèl‰¹•Üˆ°€‰±¥ÍĞˆ°€‰ÍÑ…ÑÕÌˆ°€‰‰Õ±­}ÑÉ…¹Í™•Èˆ°€‰É••¥ÁÑ}Á¡½Ñ½Ìˆ°€‰Ù•¹‘½É}…½Õ¹ÑÌ‰tô°(€€€ì±…‰•°è€‹²æÓ®Npˆ°­•åÌèl‰…É‘}ÕÍ”ˆ°€‰…É‘}±¥ÍĞˆ°€‰…É‘}ÍÑ…ÑÌ‰tô°(€€€ì±…‰•°è€‹²‚W®æˆ°­•åÌèl‰µ…¥¹Ñ}¹•Üˆ°€‰µ…¥¹Ñ}±¥ÍĞˆ°€‰µ…¥¹Ñ}ÍÑ…ÑÌˆ°€‰µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìˆ°€‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•}¹•Üˆ°€‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ì‰tô°(€€€ì±…‰•°è€‹ªÎ×¶×
ßªâÃ²Ò ˆ°­•åÌèl‰±…å½ÕĞˆ°€‰‰¥‘}¹½Ñ¥•Ìˆ°€‰Ù•¹‘½ÉÌˆ°€‰İ…É•¡½ÕÍ•}É½ÕÁÌˆ°€‰¥Ñ•µÌˆ°€‰Á•Éµ¥ÑÌ‰tô°(€t¹µ…À ¡É½ÕÀ¤€ôø€¡ì(€€€€¸¸¹É½ÕÀ°(€€€¥Ñ•µÌèIA}AI5%MM%=9}5=U1L¹™¥±Ñ•È ¡µ½‘Õ±”¤€ôøÉ½ÕÀ¹­•åÌ¹¥¹±Õ‘•Ì¡µ½‘Õ±”¹­•ä¤¤°(€ô¤¤ì((€É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÁ…”ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É¼ˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸ûªÒ®š³²z@ƒ²‚²j¤ğ½ÍÁ…¸ø(€€€€€€€€€€ñ Èû®ÂÇ²^ƒ®Â<ƒªÚ3¶VsªÒ®š°ğ½ Èø(€€€€€€€€€€ñÀû®6Ã²vÓ¶Àƒ®ÎÓ¶bàƒ²zG²^ªÎğƒ²²nC®Îƒ²
³²j¤ƒªÚ3¶Vs²vƒ¶VsªÎÏ²^C²pƒªÒ®š³¶V§®.#®.¸ğ½Àø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥ˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸ûªÖ³®ğ½ÍÁ…¸øñˆùíÁÕÉ¡…Í•Ì¹±•¹Ñ¡ôğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²‚W®æğ½ÍÁ…¸øñˆùíµ…¥¹ÑÌ¹±•¹Ñ¡ôğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²æÓ®Npğ½ÍÁ…¸øñˆùí…É‘UÍ•Ì¹±•¹Ñ¡ôğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²‚W®æ²vó²‚Tğ½ÍÁ…¸øñˆùíµ…¥¹Ñ•¹…¹•M¡•‘Õ±•Ì¹±•¹Ñ¡ôğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²zG²^®†sªŞàğ½ÍÁ…¸øñˆùí…Ñ¥Ù¥Ñå1½Ìü¹±•¹Ñ ñğ€Áôğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û¶rÓ²¶Ôğ½ÍÁ…¸øñˆùí‘•±•Ñ•‘I•½É‘Ìü¹±•¹Ñ ñğ€Áôğ½ˆøğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µµ…¹…•µ•¹ĞµÍ•Ñ¥½¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¸µÍ•Ñ¥½¸µ¡•…ˆø(€€€€€€€€€€ñÍÁ…¸øÀÄğ½ÍÁ…¸ø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñ Ìû®6Ã²vÓ¶Àƒ®ÎÓ¶bàğ½ Ìø(€€€€€€€€€€€€ñÀû®ÂÇ²^²v ƒ²V#²‚¶VcªÊ0ƒ®ÎÓªÒ¶VcªÎ€°ƒ®Î×ªÖ³²f ƒ²f²‚²
·²‚s®*Pƒ¶V²jS¶VpƒªÊ÷²jÃ²^C®0ƒ².“¶Z'¶Vc²ã²jP¸ğ½Àø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÉ¥ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ…É‰…­ÕÀµµ…¥¸µ…Éˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ…Éµ¡•…ˆø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰‰…­ÕÀµ…Éµ­¥­•Èˆù	-U@ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñ Ìû®6Ã²vÓ¶Àƒ®ÂÇ²^ğ½ Ìø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ•´û²‚WªâÃ²‚²ró®†pƒ².“¶Z$ƒªÚ3²z”ğ½•´ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñÀû®Î×ªÖ³²j¤ƒ®6Ã²vÓ¶Ã²f ƒ²Ê£®Ú ƒ²nC®Îã²vƒ®
Ó®‚“®Âo²VAƒ®bC®*Pƒ²fã²z”ƒ²‚²z—²z—²æc²^@ƒ®ÎÓªÒ¶V§®.#®.¸ğ½Àø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµÉ•½µµ•¹‘•µ‰½àˆø(€€€€€€€€€€€€€€ñÍÑÉ½¹œûªÚ3²z”ƒ®ÂÇ²^ğ½ÍÑÉ½¹œø(€€€€€€€€€€€€€€ñÍÁ…¸û²
³²
İA
ß²v3²Ç¶23²vóªÎğƒ®Î×ªÖ³²j¤)M=;²vƒ¶>Ó®6Pƒ¶Vc®
c²^@ƒ¶V£ªî`ƒ²‚²z—¶V§®.#®.¸ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆ‘¥Í…‰±•õí‰…­ÕÁM…Ù¥¹œñğ…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍåô½¹±¥¬õí‘½İ¹±½…‘	…­ÕÁ]¥Ñ¡ÑÑ…¡µ•¹ÑÍôø(€€€€€€€€€€€€€€€í…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍä€ü…ÑÑ…¡µ•¹Ñ	…­ÕÁAÉ½É•ÍÌñğ€‹²Ê£®Ú ƒ®ÂÇ²^ƒ²’D¸¸¸ˆ€è€‹²Ê£®Ú ƒ¶>³¶V ƒ²‚²ÊĞƒ®ÂÇ²^‰ô(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµÍ•½¹‘…Éäµ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸‘¥Í…‰±•õí‰…­ÕÁM…Ù¥¹œñğ…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍåô½¹±¥¬õí•áÁ½ÉÑÕ±±	…­ÕÁôø(€€€€€€€€€€€€€€€í‰…­ÕÁM…Ù¥¹œ€ü€‹®ÂÇ²^ƒ²w²Äƒ²’D¸¸¸ˆ€è€‹®6Ã²vÓ¶Àƒ²‚²ÊĞƒ®ÂÇ²^‰ô(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸‘¥Í…‰±•õí‰…­ÕÁM…Ù¥¹œñğ…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍåô½¹±¥¬õí•áÁ½ÉÑ	…­ÕÁMÕµµ…Éåá•±ôû®ÂÇ²^ƒ¶b¶f¤ƒ²^G² ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸‘¥Í…‰±•õí‰…­ÕÁM…Ù¥¹œñğ…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍåô½¹±¥¬õí‘½İ¹±½…‘)Í½¹	…­ÕÁôû¶b²z°ƒ¶fS®¦ĞƒªÂ®. ƒ®ÂÇ²^ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ…É‘…¹•Èµé½¹”É•ÍÑ½É”µ…Éˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ…Éµ¡•…ˆø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰‰…­ÕÀµ…Éµ­¥­•È‘…¹•ÈˆùIMQ=Iğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñ Ìû®ÂÇ²^ƒ®Î×ªÖ°ğ½ Ìø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñÀù)M=8ƒ®ÂÇ²^²v`ƒªÂg²v %ƒ²zC®3®–ğƒ®6»²ZÓ²R®.#®.¸ƒ®Î×ªÖ°ƒ²‚²^@ƒ¶b²z°ƒ²zC®3®–ğƒ®¢ó²‚ ƒ®ÂÇ²^¶Vc²ã²jP¸ğ½Àø(€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õíÉ•ÍÑ½É”µ™¥±”µÁ¥­•È‘íÉ•ÍÑ½É•¥±”€ü€ˆÍ•±•Ñ•ˆ€è€ˆ‰õôø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰™¥±”ˆ…•ÁĞô‰…ÁÁ±¥…Ñ¥½¸½©Í½¸°¹©Í½¸ˆ½¹¡…¹”õì¡”¤€ôøÍ•ÑI•ÍÑ½É•¥±”¡”¹Ñ…É•Ğ¹™¥±•Ìü¹lÁtñğ¹Õ±°¥ô€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸ùíÉ•ÍÑ½É•¥±”ü¹¹…µ”ñğ€‹®Î×ªÖ³¶V€)M=8ƒ¶23²vğƒ²ƒ¶t‰ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñˆû²Âû²V®ÎÓªâÀğ½ˆø(€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘…¹•ÈÉ•ÍÑ½É”µÍÕ‰µ¥Ğˆ‘¥Í…‰±•õíÉ•ÍÑ½É•	ÕÍäñğ€…É•ÍÑ½É•¥±•ô½¹±¥¬õíÉ•ÍÑ½É•)Í½¹	…­ÕÁôø(€€€€€€€€€€€€€íÉ•ÍÑ½É•	ÕÍä€ü€‹®Î×ªÖ°ƒ²’D¸¸¸ˆ€è€‹²ƒ¶w¶Vpƒ®ÂÇ²^ƒ®Î×ªÖ°‰ô(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ…ÉÍÑ½É…”µ±•…¹ÕÀµ…Éˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ…Éµ¡•…ˆø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰‰…­ÕÀµ…Éµ­¥­•ÈˆùMQ=Iğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñ Ìû®¾ã²
³²j¤ƒ²Ê£®Ú¶23²vğƒ²‚W®š°ğ½ Ìø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ•´øß²vğƒ²vÓ²ƒ®¾ã²^ÃªÊÀƒ¶23²vó®0ğ½•´ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñÀû¶b²z°ƒ²zC®3²f ƒ¶rÓ²¶×²^C²pƒ²
³²j§¶Vc®*Pƒ²Ê£®Ú®*Pƒ®ÎÓ¶bã¶VcªÎ€°ƒ²^ÃªÊÃ®Bc² ƒ²V+²v ƒ²b“®zc®Bpƒ¶23²vó®0ƒ²Âû²*×®.#®.¸ğ½Àø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµÍÑ…ĞµÉ¥ÍÑ½É…”µ±•…¹ÕÀµÍÑ…ÑÌˆø(€€€€€€€€€€€€€€ñ‘¥ØøñˆùíÍÑ½É…•±•…¹ÕÁMÕµµ…Éäü¹Í…¹¹•€üü€ˆ´‰ôğ½ˆøñÍÁ…¸ûªÊ²
°ƒ¶23²vğğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥ØøñˆùíÍÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¹±•¹Ñ¡ôğ½ˆøñÍÁ…¸û²‚W®š°ƒ¶n®ÎĞğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Øøñˆùí™½Éµ…ÑMÑ½É…•M¥é”¡ÍÑ½É…•±•…¹ÕÁMÕµµ…Éäü¹…¹‘¥‘…Ñ•	åÑ•Ìñğ€À¥ôğ½ˆøñÍÁ…¸û²‚W®š°ƒ²j§®~$ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€ì„…ÍÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¹±•¹Ñ €˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞˆø(€€€€€€€€€€€€€€€íÍÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¹µ…À ¡¥Ñ•´¤€ôø€ (€€€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõí€‘í¥Ñ•´¹‰Õ­•Ñô¼‘í¥Ñ•´¹Á…Ñ¡õôø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí¥Ñ•´¹‰Õ­•Ñôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñˆÑ¥Ñ±”õí¥Ñ•´¹Á…Ñ¡ôùí¥Ñ•´¹Á…Ñ¡ôğ½ˆø(€€€€€€€€€€€€€€€€€€€€ñ•´ùí™½Éµ…ÑMÑ½É…•M¥é”¡¥Ñ•´¹Í¥é”¥ôğ½•´ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø½Á•¹MÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ”¡¥Ñ•´¥ôû®ÎÓªâÀğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸‘¥Í…‰±•õíÍÑ½É…•±•…¹ÕÁ	ÕÍäñğ…ÑÑ…¡µ•¹Ñ	…­ÕÁ	ÕÍäñğ‰…­ÕÁM…Ù¥¹ô½¹±¥¬õíÍ…¹U¹ÕÍ•‘ÑÑ…¡µ•¹ÑÍôø(€€€€€€€€€€€€€€€íÍÑ½É…•±•…¹ÕÁ	ÕÍä€ü€‹ªÊ²
°ƒ²’D¸¸¸ˆ€è€‹®¾ã²
³²j¤ƒ¶23²vğƒªÊ²
°‰ô(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘…¹•Èˆ‘¥Í…‰±•õíÍÑ½É…•±•…¹ÕÁ	ÕÍäñğ€…ÍÑ½É…•±•…¹ÕÁ…¹‘¥‘…Ñ•Ì¹±•¹Ñ¡ô½¹±¥¬õí‘•±•Ñ•U¹ÕÍ•‘ÑÑ…¡µ•¹ÑÍôø(€€€€€€€€€€€€€€€ƒ²‚W®š°ƒ¶n®ÎĞƒ²f²‚²
·²‚p(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ…É…‘µ¥¸µµ…¹…•µ•¹ĞµÍ•Ñ¥½¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ¡•…ˆø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñ Ìû²²n@ƒªÚ3¶VsªÒ®š°ğ½ Ìø(€€€€€€€€€€€€ñÀû²²n@ƒ²V²vÓ®RS²f ƒ²^·¶Vƒ²vƒ®NÇ®†w¶VcªÎ€°ƒ¶b²z—²²nC²^CªÊ0ƒ¶V²jS¶Vpƒ®¦S®&Ó®0ƒ²ƒ¶w¶VĞƒ¶^#²j§¶V§®.#®.¸ğ½Àø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñˆ±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µÕÍ•Èµ½Õ¹Ğˆû®NÇ®†tƒ²²n@íÕÍ•ÉA•Éµ¥ÍÍ¥½¹Ì¹±•¹Ñ¡÷®ªğ½ˆø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µÉ½±”µÕ¥‘”ˆø(€€€€€€€€€€ñ‘¥ØøñˆûªÒ®š³²z@ğ½ˆøñÍÁ…¸û²‚²ÊĞƒªâÃ®*”ƒ²
³²j¤ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€ñ‘¥Øøñˆû²
³®²Ó².“²²n@ğ½ˆøñÍÁ…¸û®NÇ®†w
ß²†Ã¶j0ƒ²’G².°ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€ñ‘¥Øøñˆû¶b²z—²²n@ğ½ˆøñÍÁ…¸û²ƒ¶w¶Vpƒ®¦S®&Ó®0ƒ²
³²j¤ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ™½É´ˆø(€€€€€€€€€€ñ¥•±±…‰•°ô‹²²n@ƒ²V²vÓ®RPˆø(€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíÁ•Éµ¥ÍÍ¥½¹½É´¹•µ…¥±ô½¹¡…¹”õì¡”¤€ôøÍ•ÑA•Éµ¥ÍÍ¥½¹½É´¡ì€¸¸¹Á•Éµ¥ÍÍ¥½¹½É´°•µ…¥°è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ôÁ±…•¡½±‘•Èô‹²b è™¥•±ÀÄˆ€¼ø(€€€€€€€€€€ğ½¥•±ø(€€€€€€€€€€ñ¥•±±…‰•°ô‹ªÚ3¶Vpƒ®.£ªÎˆø(€€€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíÁ•Éµ¥ÍÍ¥½¹½É´¹É½±•ô½¹¡…¹”õì¡”¤€ôøÍ•ÑA•Éµ¥ÍÍ¥½¹½É´¡ì€¸¸¹Á•Éµ¥ÍÍ¥½¹½É´°É½±”è”¹Ñ…É•Ğ¹Ù…±Õ”…ÌUÍ•ÉI½±”ô¥ôø(€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰½™™¥”ˆû²
³®²Ó².“²²n@ğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰™¥•±ˆû¶b²z—²²n@ğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€ğ½¥•±ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…ÉäÁ•Éµ¥ÍÍ¥½¸µÍ…Ù”µ‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ…Ù•UÍ•ÉA•Éµ¥ÍÍ¥½¸ ¥ôûªÚ3¶Vpƒ²‚²z”ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ¥µ¡•±Àˆû²²n@ƒ²V²vÓ®RS®*P€ñˆù™¥•±ÀÄğ½ˆû²Êc®~ğƒ²z®‚—¶Vc®¦Ğƒ®
Ó®Ú ƒ®†sªŞã²vàƒªÎ²‚Tƒ¶bW².w²ró®†pƒ²zC®>dƒ²‚²z—®B§®.#®.¸ğ½Àø((€€€€€€€íÁ•Éµ¥ÍÍ¥½¹½É´¹É½±”€ôôô€‰™¥•±ˆ€˜˜€ (€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ¡•­Ìˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ‘•™…Õ±Ğµ…•ÍÌˆøñˆûªâÃ®Îàƒ¶^#²j¤ğ½ˆøñÍÁ…¸û¶f ƒ
ÜƒªÎ×² ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€í™¥•±‘A•Éµ¥ÍÍ¥½¹É½ÕÁÌ¹µ…À ¡É½ÕÀ¤€ôø€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀˆ­•äõíÉ½ÕÀ¹±…‰•±ôø(€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíÉ½ÕÀ¹±…‰•±ôğ½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€íÉ½ÕÀ¹¥Ñ•µÌ¹µ…À ¡´¤€ôø€ (€€€€€€€€€€€€€€€€€€€€ñ±…‰•°­•äõí´¹­•åôø(€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õì„…Á•Éµ¥ÍÍ¥½¹½É´¹Á•Éµ¥ÍÍ¥½¹Ìü¹m´¹­•åuô½¹¡…¹”õì ¤€ôøÑ½±•A•Éµ¥ÍÍ¥½¸¡´¹­•ä¥ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí´¹±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¥ô((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ±¥ÍĞˆø(€€€€€€€€€íÕÍ•ÉA•Éµ¥ÍÍ¥½¹Ì¹±•¹Ñ €üÕÍ•ÉA•Éµ¥ÍÍ¥½¹Ì¹µ…À ¡¥Ñ•´èUÍ•ÉA•Éµ¥ÍÍ¥½¸¤€ôø€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µÉ½Üˆ­•äõí¥Ñ•´¹•µ…¥±ôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÁ•ÉÍ½¸ˆø(€€€€€€€€€€€€€€€€ñˆùíÑ½1½¥¹%¡¥Ñ•´¹•µ…¥°¥ôğ½ˆø(€€€€€€€€€€€€€€€€ñÍÁ…¸ùí¥Ñ•´¹É½±”€ôôô€‰½™™¥”ˆ€ü€‹²
³®²Ó².“²²n@ˆ€è¥Ñ•´¹É½±”€ôôô€‰™¥•±ˆ€ü€‹¶b²z—²²n@ˆ€è€‹ªÒ®š³²z@‰ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ•´±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÍÑ…ÑÕÌˆùí¥Ñ•´¹É½±”€ôôô€‰™¥•±ˆ€ü€‘í=‰©•Ğ¹Ù…±Õ•Ì¡¥Ñ•´¹Á•Éµ¥ÍÍ¥½¹Ìñğíô¤¹™¥±Ñ•È¡	½½±•…¸¤¹±•¹Ñ¡÷ªÂpƒ®¦S®&Ğƒ¶^#²j¥€€è€‹²"c²‚W
ß²
·²‚pƒ²‚s²fàƒªÂ®*”‰ôğ½•´ø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µÉ½Üµ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôø•‘¥ÑA•Éµ¥ÍÍ¥½¸¡¥Ñ•´¥ôû²"c²‚Tğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘…¹•Èˆ½¹±¥¬õì ¤€ôø‘•±•Ñ•UÍ•ÉA•Éµ¥ÍÍ¥½¸¡¥Ñ•´¹•µ…¥°¥ôû²
·²‚pğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¤¤€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰Á•Éµ¥ÍÍ¥½¸µ•µÁÑäˆû®NÇ®†w®Bpƒ²²n@ƒªÚ3¶Vs²vĞƒ²^²*×®.#®.¸ğ½‘¥Øùô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€ğ½Í•Ñ¥½¸ø(€€¤ì)ô(()™Õ¹Ñ¥½¸!½µ•…Í¡‰½…É¡ì(€ÁÕÉ¡…Í•Ì°(€µ…¥¹ÑÌ°(€…É‘UÍ•Ì°(€µ…¥¹Ñ•¹…¹•M¡•‘Õ±•Ì€ômt°(€É••¥ÁÑA¡½Ñ½Ì€ômt°(€µ…¥¹Ñ•¹…¹•A¡½Ñ½Ì€ômt°(€Í¥Ñ•9½Ñ¥•Ì€ômt°(€‘•±•Ñ•‘I•½É‘Ì€ômt°(€Í•Ñ5•¹ÕQ…ˆ°(€ÕÉÉ•¹ÑI½±”°(€±½½ÕĞ°)ôèì(€ÁÕÉ¡…Í•ÌèAÕÉ¡…Í•mtì(€µ…¥¹ÑÌè5…¥¹Ñmtì(€…É‘UÍ•Ìè…É‘UÍ•mtì(€µ…¥¹Ñ•¹…¹•M¡•‘Õ±•Ìüè5…¥¹Ñ•¹…¹•M¡•‘Õ±•mtì(€É••¥ÁÑA¡½Ñ½ÌüèI••¥ÁÑA¡½Ñ½mtì(€µ…¥¹Ñ•¹…¹•A¡½Ñ½Ìüè5…¥¹Ñ•¹…¹•A¡½Ñ½mtì(€Í¥Ñ•9½Ñ¥•ÌüèM¥Ñ•9½Ñ¥•mtì(€‘•±•Ñ•‘I•½É‘Ìüè•±•Ñ•‘I•½É‘mtì(€Í•Ñ5•¹ÕQ…ˆüè€¡Ñ…ˆèÍÑÉ¥¹œ¤€ôøÙ½¥ì(€ÕÉÉ•¹ÑI½±”üèUÍ•ÉI½±”ì(€±½½ÕĞüè€ ¤€ôøÙ½¥ì)ô¤ì(€½¹ÍĞ¥Í!½µ•%µ…•UÉ°€ô€¡ÕÉ°èÍÑÉ¥¹œ¤€ôøì(€€€½¹ÍĞ½É¥¥¹…°€ôMÑÉ¥¹œ¡ÕÉ°ñğ€ˆˆ¤ì(€€€½¹ÍĞÑ…É•Ğ€ô½É¥¥¹…°¹Ñ½1½İ•É…Í” ¤¹ÍÁ±¥Ğ ˆüˆ¥lÁtì(€€€½¹ÍĞ¥Í-¹½İ¹%µ…”€ô€½p¸¡©Áñ©Á•ñÁ¹ñİ•‰Áñ¥™ñ¡•¥Œ¤¼¹Ñ•ÍĞ¡Ñ…É•Ğ¤ì(€€€½¹ÍĞ¥Í-¹½İ¹9½¹%µ…”€ô€½p¸¡Á‘™ñµÀÍñ´Ñ…ñİ…Ùñİ•‰µñ½ñ……Œ¤¼¹Ñ•ÍĞ¡Ñ…É•Ğ¤ì(€€€É•ÑÕÉ¸¥Í-¹½İ¹%µ…”ñğ½É¥¥¹…°¹ÍÑ…ÉÑÍ]¥Ñ  ‰‰±½ˆèˆ¤ñğ€ …¥Í-¹½İ¹9½¹%µ…”€˜˜½É¥¥¹…°¹¥¹±Õ‘•Ì ˆ½ÍÑ½É…”¼ˆ¤¤ì(€ôì(€½¹ÍĞÑ½‘…ä€ô•ÑQ½‘…å-•ä ¤ì(€½¹ÍĞµ½¹Ñ¡-•ä€ôÑ½‘…ä¹Í±¥” À°€Ü¤ì(€½¹ÍĞÁÉ•Ù¥½ÕÍ5½¹Ñ¡-•ä€ôµ½¹Ñ¡-•å]¥Ñ¡=™™Í•Ğ¡Ñ½‘…ä°€´Ä¤ì(€½¹ÍĞÑÉ•¹‘5½¹Ñ¡-•åÌ€ôÉÉ…ä¹™É½´¡ì±•¹Ñ è€Øô°€¡|°¥¹‘•à¤€ôøµ½¹Ñ¡-•å]¥Ñ¡=™™Í•Ğ¡Ñ½‘…ä°¥¹‘•à€´€Ô¤¤ì(€½¹ÍĞÑ½‘…åAÕÉ¡…Í•Ì€ôÁÕÉ¡…Í•Ì¹™¥±Ñ•È ¡À¤€ôøÀ¹‘…Ñ”€ôôôÑ½‘…ä¤ì(€½¹ÍĞµ½¹Ñ¡AÕÉ¡…Í•Ì€ôÁÕÉ¡…Í•Ì¹™¥±Ñ•È ¡À¤€ôøMÑÉ¥¹œ¡À¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡µ½¹Ñ¡-•ä¤¤ì(€½¹ÍĞµ½¹Ñ¡…É‘Ì€ô…É‘UÍ•Ì¹™¥±Ñ•È ¡Œ¤€ôøMÑÉ¥¹œ¡Œ¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡µ½¹Ñ¡-•ä¤¤ì(€½¹ÍĞÑ½‘…å5…¥¹ÑÌ€ôµ…¥¹ÑÌ¹™¥±Ñ•È ¡´¤€ôø´¹‘…Ñ”€ôôôÑ½‘…ä¤ì(€½¹ÍĞİ••­	…Í•…Ñ”€ô¹•Ü…Ñ”¡€‘íÑ½‘…åõPÄÈèÀÀèÀÁ€¤ì(€½¹ÍĞİ••­…ä€ôİ••­	…Í•…Ñ”¹•Ñ…ä ¤ì(€½¹ÍĞİ••­5½¹‘…ä€ô¹•Ü…Ñ”¡İ••­	…Í•…Ñ”¤ì(€İ••­5½¹‘…ä¹Í•Ñ…Ñ”¡İ••­	…Í•…Ñ”¹•Ñ…Ñ” ¤€¬€¡İ••­…ä€ôôô€À€ü€´Ø€è€Ä€´İ••­…ä¤¤ì(€½¹ÍĞİ••­MÕ¹‘…ä€ô¹•Ü…Ñ”¡İ••­5½¹‘…ä¤ì(€İ••­MÕ¹‘…ä¹Í•Ñ…Ñ”¡İ••­5½¹‘…ä¹•Ñ…Ñ” ¤€¬€Ø¤ì(€½¹ÍĞİ••­MÑ…ÉÑ-•ä€ôÑ½…Ñ•-•ä¡İ••­5½¹‘…ä¤ì(€½¹ÍĞİ••­¹‘-•ä€ôÑ½…Ñ•-•ä¡İ••­MÕ¹‘…ä¤ì(€½¹ÍĞÑ½‘…åM¡•‘Õ±•Ì€ôµ…¥¹Ñ•¹…¹•M¡•‘Õ±•Ì¹™¥±Ñ•È ¡à¤€ôøà¹Í¡•‘Õ±•}‘…Ñ”€ôôôÑ½‘…ä€˜˜à¹ÍÑ…ÑÕÌ€„ôô€‹²f®0ˆ¤ì(€½¹ÍĞ…±±]••­M¡•‘Õ±•Ì€ôµ…¥¹Ñ•¹…¹•M¡•‘Õ±•Ì(€€€€¹™¥±Ñ•È ¡à¤€ôøì(€€€€€½¹ÍĞÍ¡•‘Õ±•…Ñ”€ôMÑÉ¥¹œ¡à¹Í¡•‘Õ±•}‘…Ñ”ñğ€ˆˆ¤ì(€€€€€É•ÑÕÉ¸Í¡•‘Õ±•…Ñ”€øôİ••­MÑ…ÉÑ-•ä€˜˜Í¡•‘Õ±•…Ñ”€ğôİ••­¹‘-•äì(€€€ô¤(€€€€¹Í½ÉĞ ¡„°ˆ¤€ôøMÑÉ¥¹œ¡„¹Í¡•‘Õ±•}‘…Ñ”ñğ€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹Í¡•‘Õ±•}‘…Ñ”ñğ€ˆˆ¤¤¤ì(€½¹ÍĞİ••­M¡•‘Õ±•Ì€ô…±±]••­M¡•‘Õ±•Ì¹™¥±Ñ•È ¡à¤€ôøà¹ÍÑ…ÑÕÌ€„ôô€‹²f®0ˆ¤ì(€½¹ÍĞİ••­…±•¹‘…É…åÌ€ôÉÉ…ä¹™É½´¡ì±•¹Ñ è€Üô°€¡|°¥¹‘•à¤€ôøì(€€€½¹ÍĞ€ô¹•Ü…Ñ”¡İ••­5½¹‘…ä¤ì(€€€¹Í•Ñ…Ñ”¡İ••­5½¹‘…ä¹•Ñ…Ñ” ¤€¬¥¹‘•à¤ì(€€€½¹ÍĞ‘…Ñ•-•ä€ôÑ½…Ñ•-•ä¡¤ì(€€€É•ÑÕÉ¸ì(€€€€€‘…Ñ•-•ä°(€€€€€‘…å1…‰•°èl‹²vğˆ°€‹²nPˆ°€‹¶fPˆ°€‹²"`ˆ°€‹®ª¤ˆ°€‹ªâ ˆ°€‹¶€‰um¹•Ñ…ä ¥t°(€€€€€‘…åQ•áĞè€‘í¹•Ñ5½¹Ñ  ¤€¬€Åô¼‘í¹•Ñ…Ñ” ¥õ€°(€€€€€Í¡•‘Õ±•Ìèİ••­M¡•‘Õ±•Ì¹™¥±Ñ•È ¡Ì¤€ôøÌ¹Í¡•‘Õ±•}‘…Ñ”€ôôô‘…Ñ•-•ä¤°(€€€ôì(€ô¤ì((€½¹ÍĞ…Ñ¥Ù•9½Ñ¥•Ì€ô€¡Í¥Ñ•9½Ñ¥•Ìñğmt¤¹™¥±Ñ•È ¡¸¤€ôø¸¹¥Í}…Ñ¥Ù”€„ôô™…±Í”¤¹Í±¥” À°€Ô¤ì(€½¹ÍĞÉ••¹ÑAÕÉ¡…Í•Ì€ôl¸¸¹ÁÕÉ¡…Í•Ít¹Í½ÉĞ ¡„°ˆ¤€ôøMÑÉ¥¹œ¡ˆ¹‘…Ñ”ñğ€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹‘…Ñ”ñğ€ˆˆ¤¤¤¹Í±¥” À°€Ô¤ì(€½¹ÍĞÉ••¹Ñ5…¥¹ÑÌ€ôl¸¸¹µ…¥¹ÑÍt¹Í½ÉĞ ¡„°ˆ¤€ôøMÑÉ¥¹œ¡ˆ¹‘…Ñ”ñğ€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹‘…Ñ”ñğ€ˆˆ¤¤¤¹Í±¥” À°€Ô¤ì(€½¹ÍĞÑ½‘…åAÕÉ¡…Í•Q½Ñ…°€ôÑ½‘…åAÕÉ¡…Í•Ì¹É•‘Õ” ¡ÍÕ´°À¤€ôøÍÕ´€¬9Õµ‰•È¡À¹Ñ½Ñ…°ñğ€À¤°€À¤ì(€½¹ÍĞµ½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°€ôµ½¹Ñ¡AÕÉ¡…Í•Ì¹É•‘Õ” ¡ÍÕ´°À¤€ôøÍÕ´€¬9Õµ‰•È¡À¹Ñ½Ñ…°ñğ€À¤°€À¤ì(€½¹ÍĞµ½¹Ñ¡…É‘Q½Ñ…°€ôµ½¹Ñ¡…É‘Ì¹É•‘Õ” ¡ÍÕ´°Œ¤€ôøÍÕ´€¬9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤°€À¤ì(€½¹ÍĞµ½¹Ñ¡5…¥¹ÑQ½Ñ…°€ôµ…¥¹ÑÌ(€€€€¹™¥±Ñ•È ¡´¤€ôøMÑÉ¥¹œ¡´¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡µ½¹Ñ¡-•ä¤¤(€€€€¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬9Õµ‰•È¡´¹Ñ½Ñ…°ñğ´¹½ÍĞñğ€À¤°€À¤ì(€½¹ÍĞÁÉ•Ù¥½ÕÍ5½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°€ôÁÕÉ¡…Í•Ì(€€€€¹™¥±Ñ•È ¡À¤€ôøMÑÉ¥¹œ¡À¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡ÁÉ•Ù¥½ÕÍ5½¹Ñ¡-•ä¤¤(€€€€¹É•‘Õ” ¡ÍÕ´°À¤€ôøÍÕ´€¬9Õµ‰•È¡À¹Ñ½Ñ…°ñğ€À¤°€À¤ì(€½¹ÍĞÁÉ•Ù¥½ÕÍ5½¹Ñ¡…É‘Q½Ñ…°€ô…É‘UÍ•Ì(€€€€¹™¥±Ñ•È ¡Œ¤€ôøMÑÉ¥¹œ¡Œ¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡ÁÉ•Ù¥½ÕÍ5½¹Ñ¡-•ä¤¤(€€€€¹É•‘Õ” ¡ÍÕ´°Œ¤€ôøÍÕ´€¬9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤°€À¤ì(€½¹ÍĞÁÉ•Ù¥½ÕÍ5½¹Ñ¡5…¥¹ÑQ½Ñ…°€ôµ…¥¹ÑÌ(€€€€¹™¥±Ñ•È ¡´¤€ôøMÑÉ¥¹œ¡´¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡ÁÉ•Ù¥½ÕÍ5½¹Ñ¡-•ä¤¤(€€€€¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬9Õµ‰•È¡´¹Ñ½Ñ…°ñğ´¹½ÍĞñğ€À¤°€À¤ì(€½¹ÍĞÁÕÉ¡…Í•QÉ•¹€ôÑÉ•¹‘5½¹Ñ¡-•åÌ¹µ…À ¡­•ä¤€ôøÁÕÉ¡…Í•Ì(€€€€¹™¥±Ñ•È ¡À¤€ôøMÑÉ¥¹œ¡À¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡­•ä¤¤(€€€€¹É•‘Õ” ¡ÍÕ´°À¤€ôøÍÕ´€¬9Õµ‰•È¡À¹Ñ½Ñ…°ñğ€À¤°€À¤¤ì(€½¹ÍĞ…É‘QÉ•¹€ôÑÉ•¹‘5½¹Ñ¡-•åÌ¹µ…À ¡­•ä¤€ôø…É‘UÍ•Ì(€€€€¹™¥±Ñ•È ¡Œ¤€ôøMÑÉ¥¹œ¡Œ¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡­•ä¤¤(€€€€¹É•‘Õ” ¡ÍÕ´°Œ¤€ôøÍÕ´€¬9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤°€À¤¤ì(€½¹ÍĞµ…¥¹ÑQÉ•¹€ôÑÉ•¹‘5½¹Ñ¡-•åÌ¹µ…À ¡­•ä¤€ôøµ…¥¹ÑÌ(€€€€¹™¥±Ñ•È ¡´¤€ôøMÑÉ¥¹œ¡´¹‘…Ñ”ñğ€ˆˆ¤¹ÍÑ…ÉÑÍ]¥Ñ ¡­•ä¤¤(€€€€¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬9Õµ‰•È¡´¹Ñ½Ñ…°ñğ´¹½ÍĞñğ€À¤°€À¤¤ì(€½¹ÍĞ½µÁ±•Ñ•‘]••­M¡•‘Õ±•Ì€ô…±±]••­M¡•‘Õ±•Ì¹™¥±Ñ•È ¡Í¡•‘Õ±”¤€ôøÍ¡•‘Õ±”¹ÍÑ…ÑÕÌ€ôôô€‹²f®0ˆ¤¹±•¹Ñ ì(€½¹ÍĞİ••­½µÁ±•Ñ¥½¹I…Ñ”€ô…±±]••­M¡•‘Õ±•Ì¹±•¹Ñ (€€€€ü5…Ñ ¹É½Õ¹ ¡½µÁ±•Ñ•‘]••­M¡•‘Õ±•Ì€¼…±±]••­M¡•‘Õ±•Ì¹±•¹Ñ ¤€¨€ÄÀÀ¤(€€€€è€Àì(€½¹ÍĞÁ•¹‘¥¹I••¥ÁÑA¡½Ñ½Ì€ôÉ••¥ÁÑA¡½Ñ½Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø€…¥Ñ•´¹¥Í}ÁÉ½•ÍÍ•¤ì(€½¹ÍĞÁ•¹‘¥¹5…¥¹Ñ•¹…¹•A¡½Ñ½Ì€ôµ…¥¹Ñ•¹…¹•A¡½Ñ½Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø€…¥Ñ•´¹¥Í}ÁÉ½•ÍÍ•¤ì(€½¹ÍĞÕÉ•¹Ñ5…¥¹Ñ•¹…¹•A¡½Ñ½Ì€ôµ…¥¹Ñ•¹…¹•A¡½Ñ½Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹¥Í}ÕÉ•¹Ğ€˜˜€…¥Ñ•´¹¥Í}ÁÉ½•ÍÍ•¤ì(€½¹ÍĞÉ••¹ÑA¡½Ñ½%Ñ•µÌ€ôl¸¸¹µ…¥¹ÑÍt(€€€€¹Í½ÉĞ ¡„°ˆ¤€ôøMÑÉ¥¹œ¡ˆ¹‘…Ñ”ñğ€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹‘…Ñ”ñğ€ˆˆ¤¤¤(€€€€¹™±…Ñ5…À ¡µ…¥¹Ğ¤€ôø(€€€€€€¡µ…¥¹Ğ¹¥µ…•}ÕÉ±Ìñğ€¡µ…¥¹Ğ¹¥µ…•}ÕÉ°€ümµ…¥¹Ğ¹¥µ…•}ÕÉ±t€èmt¤¤(€€€€€€€€¹™¥±Ñ•È ¡ÕÉ°¤€ôø¥Í!½µ•%µ…•UÉ°¡ÕÉ°¤¤(€€€€€€€€¹µ…À ¡ÕÉ°°¥¹‘•à¤€ôø€¡ì(€€€€€€€€€¥è€‘íµ…¥¹Ğ¹¥‘ôµµ…¥¹Ğµ±½½­ÕÀ´‘í¥¹‘•áõ€°(€€€€€€€€€ÕÉ°°(€€€€€€€€€ÑåÁ”è€‹²‚W®æˆ°(€€€€€€€€€Ñ¥Ñ±”èµ…¥¹Ğ¹İ…É•¡½ÕÍ”ñğ€‹²‚W®æ²
³²ˆ°(€€€€€€€€€µ•Ñ„èµ…¥¹Ğ¹Ñ¥Ñ±”ñğµ…¥¹Ğ¹‘•Ñ…¥°ñğ€‹²‚W®æ²zG²^ˆ°(€€€€€€€€€‘…Ñ”èµ…¥¹Ğ¹‘…Ñ”ñğ€ˆˆ°(€€€€€€€€€Ñ…ˆè€‰µ…¥¹Ñ}±¥ÍĞˆ°(€€€€€€€ô¤¤(€€€€¤(€€€€¹Í±¥” À°€Ğ¤ì((€¥˜€¡ÕÉÉ•¹ÑI½±”€ôôô€‰™¥•±ˆ¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ¡½µ”ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÑ½Á‰…Èˆø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñÍÑÉ½¹œû¶s®ª²
Ã²^ªÂs®Âpğ½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÍÁ…¸û¶b²z—²²n@ƒ²‚²j¤ğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí±½½ÕÑôû®†sªŞã²V²nğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ¡•É¼ˆø(€€€€€€€€€€ñÍµ…±°û²V#®W¶Vc²ã²jP°ƒ¶b²z—¶2 ƒ®.`„ğ½Íµ…±°ø(€€€€€€€€€€ñ Èû²b“®*c®>ƒ²V#²‚²vĞƒ²Ös²jÃ²ƒ²z®.#®.„ğ½ Èø(€€€€€€€€€€ñÀûªÎ×² ƒ¶fW²và°ƒ²
³²ƒ®NÇ®†t°ƒ²‚W®æ²vó²‚W²vƒ®æƒ®–ÓªÊ0ƒ²Êc®š³¶Vc²ã²jP¸ğ½Àø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ¡•É¼µÑ…Ìˆø(€€€€€€€€€€€€ñÍÁ…¸ûÂ~NíÑ½‘…åôğ½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸û²‚W®æ²vó²‚TíÑ½‘…åM¡•‘Õ±•Ì¹±•¹Ñ¡÷ªÆĞğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ¹½Ñ¥”ˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰Í¥Ñ•}¹½Ñ¥•Ìˆ¥ôø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñˆûÂ~NˆƒªÎ×²²
³¶V´ğ½ˆø(€€€€€€€€€€€í…Ñ¥Ù•9½Ñ¥•ÍlÁt€ü€ (€€€€€€€€€€€€€€ğø(€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí…Ñ¥Ù•9½Ñ¥•ÍlÁt¹Ñ¥Ñ±”ñğ€‹²‚s®ª¤ƒ²^²v0‰ôğ½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€ñÍÁ…¸ùì¡…Ñ¥Ù•9½Ñ¥•ÍlÁt¹É•…Ñ•‘}…Ğñğ…Ñ¥Ù•9½Ñ¥•ÍlÁt¹¹½Ñ¥•}‘…Ñ”ñğ€ˆˆ¤¹Í±¥” À°€ÄÀ¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ¼ø(€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€ñÍÑÉ½¹œû®NÇ®†w®BpƒªÎ×²ªÂ ƒ²^²*×®.#®.¸ğ½ÍÑÉ½¹œø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ•´û®6S®ÎÓªâÀƒŠèğ½•´ø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‰±Õ”ˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰É••¥ÁÑ}Á¡½Ñ½Ìˆ¥ôø(€€€€€€€€€€€€ñ¤ûÂ~NÜğ½¤ø(€€€€€€€€€€€€ñˆû²zªÎƒ²
³²ƒ®NÇ®†tğ½ˆø(€€€€€€€€€€€€ñÍÁ…¸û²zC²z°ƒ²zªÎ€ƒ²
³²ªÎğƒ®
Ó²j§²vƒ®NÇ®†w¶V§®.#®.¸ğ½ÍÁ…¸ø(€€€€€€€€€€€€ñ•´ûŠèğ½•´ø(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø((€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰É••¸ˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìˆ¥ôø(€€€€€€€€€€€€ñ¤ûÂ~Rœğ½¤ø(€€€€€€€€€€€€ñˆû²‚W®æ²
³²ƒ®NÇ®†tğ½ˆø(€€€€€€€€€€€€ñÍÁ…¸û²‚W®æƒ²zG²^ƒ²
³²ªÎğƒ®
Ó²j§²vƒ®NÇ®†w¶V§®.#®.¸ğ½ÍÁ…¸ø(€€€€€€€€€€€€ñ•´ûŠèğ½•´ø(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø((€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰½É…¹”ˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìˆ¥ôø(€€€€€€€€€€€€ñ¤ûÂ~Nğ½¤ø(€€€€€€€€€€€€ñˆû²‚W®æƒ²vó²‚Tğ½ˆø(€€€€€€€€€€€€ñÍÁ…¸û²b#²‚W®Bpƒ²‚W®æ²vó²‚W²vƒ¶fW²vã¶V§®.#®.¸ğ½ÍÁ…¸ø(€€€€€€€€€€€€ñ•´ûŠèğ½•´ø(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø((€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÕÉÁ±”ˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ}±¥ÍĞˆ¥ôø(€€€€€€€€€€€€ñ¤ûÂ~Nğ½¤ø(€€€€€€€€€€€€ñˆû²zG²^ƒ®
Ó²^´ƒ²†Ã¶j0ğ½ˆø(€€€€€€€€€€€€ñÍÁ…¸û®NÇ®†w¶Vpƒ²zG²^ƒ®
Ó²^·²vƒ¶fW²vã¶V§®.#®.¸ğ½ÍÁ…¸ø(€€€€€€€€€€€€ñ•´ûŠèğ½•´ø(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÍÕµµ…Éäˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÁ…¹•°µ¡•…ˆø(€€€€€€€€€€€€ñ Ìû²b“®*c²v`ƒ¶b¶f¤ğ½ Ìø(€€€€€€€€€€€€ñÍÁ…¸ùíÑ½‘…åôƒªâÃ²’ ğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥ˆø(€€€€€€€€€€€€ñ‘¥Øøñ¤ûÂ~NÜğ½¤øñˆùíÉ••¥ÁÑA¡½Ñ½Ì¹±•¹Ñ¡ôğ½ˆøñÍÁ…¸û²zªÎ€ƒ²
³²ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Øøñ¤ûÂ~Rœğ½¤øñˆùíµ…¥¹Ñ•¹…¹•A¡½Ñ½Ì¹±•¹Ñ¡ôğ½ˆøñÍÁ…¸û²‚W®æƒ²
³²ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Øøñ¤ûÂ~Nğ½¤øñˆùíÑ½‘…åM¡•‘Õ±•Ì¹±•¹Ñ¡ôğ½ˆøñÍÁ…¸û²‚W®æƒ²vó²‚Tğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Øøñ¤ûÂ~Nˆğ½¤øñˆùí…Ñ¥Ù•9½Ñ¥•Ì¹±•¹Ñ¡ôğ½ˆøñÍÁ…¸ûªÎ×² ğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÁ…¹•±Ìˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÁ…¹•°ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÁ…¹•°µ¡•…ˆø(€€€€€€€€€€€€€€ñ Ìû²b“®*c²v`ƒ²vó²‚Tğ½ Ìø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìˆ¥ôû®6S®ÎÓªâÀğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ±¥ÍĞˆø(€€€€€€€€€€€€€íÑ½‘…åM¡•‘Õ±•Ì¹±•¹Ñ €üÑ½‘…åM¡•‘Õ±•Ì¹Í±¥” À°€Ì¤¹µ…À ¡Ì¤€ôø€ (€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõíÌ¹¥‘ô½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìˆ¥ôø(€€€€€€€€€€€€€€€€€€ñˆùíÌ¹•ÅÕ¥Áµ•¹Ñ}¹…µ”ñğ€‹²z—®æ®ªƒ²^²v0‰ôğ½ˆø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÌ¹İ½É­}‘•Ñ…¥°ñğ€‹²zG²^®
Ó²j¤ƒ²^²v0‰ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€¤¤€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ•µÁÑäˆû²b“®*`ƒ®NÇ®†w®Bpƒ²vó²‚W²vĞƒ²^²*×®.#®.¸ğ½‘¥Øùô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÁ…¹•°ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµÁ…¹•°µ¡•…ˆø(€€€€€€€€€€€€€€ñ Ìû²ÖsªŞğƒªÎ×² ğ½ Ìø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰Í¥Ñ•}¹½Ñ¥•Ìˆ¥ôû®6S®ÎÓªâÀğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ±¥ÍĞˆø(€€€€€€€€€€€€€í…Ñ¥Ù•9½Ñ¥•Ì¹±•¹Ñ €ü…Ñ¥Ù•9½Ñ¥•Ì¹Í±¥” À°€Ì¤¹µ…À ¡¹½Ñ¥”¤€ôø€ (€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõí¹½Ñ¥”¹¥‘ô½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰Í¥Ñ•}¹½Ñ¥•Ìˆ¥ôø(€€€€€€€€€€€€€€€€€€ñˆùí¹½Ñ¥”¹Ñ¥Ñ±”ñğ€‹²‚s®ª¤ƒ²^²v0‰ôğ½ˆø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùì¡¹½Ñ¥”¹É•…Ñ•‘}…Ğñğ¹½Ñ¥”¹¹½Ñ¥•}‘…Ñ”ñğ€ˆˆ¤¹Í±¥” À°€ÄÀ¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€¤¤€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ…ÁÀµ•µÁÑäˆû®NÇ®†w®BpƒªÎ×²ªÂ ƒ²^²*×®.#®.¸ğ½‘¥Øùô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½Í•Ñ¥½¸ø(€€€€¤ì(€ô((€½¹ÍĞ­Á¥…É‘Ì€ôl(€€€ì(€€€€€±…‰•°è€‹²b“®*`ƒªÖ³®“ªâ#²V„ˆ°(€€€€€Ù…±Õ”è€‘íµ½¹•ä¡Ñ½‘…åAÕÉ¡…Í•Q½Ñ…°¥÷²nA€°(€€€€€ÍÕˆèƒ²b“®*`€‘íÑ½‘…åAÕÉ¡…Í•Ì¹±•¹Ñ¡÷ªÆĞƒ
Üƒ²vÓ®Ê#®.°€‘íµ½¹•ä¡µ½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°¥÷²nA€°(€€€€€¥½¸è€‹Â~nHˆ°(€€€€€Ñ½¹”è€‰‰±Õ”ˆ°(€€€€€Ñ…ˆè€‰±¥ÍĞˆ°(€€€ô°(€€€ì(€€€€€±…‰•°è€‹²vÓ®Ê#®.°ƒ²æÓ®Ns²
³²j¤ˆ°(€€€€€Ù…±Õ”è€‘íµ½¹•ä¡µ½¹Ñ¡…É‘Q½Ñ…°¥÷²nA€°(€€€€€ÍÕˆèƒ²vÓ®Ê#®.°€‘íµ½¹Ñ¡…É‘Ì¹±•¹Ñ¡÷ªÆÑ€°(€€€€€¥½¸è€‹Â~JÌˆ°(€€€€€Ñ½¹”è€‰É••¸ˆ°(€€€€€Ñ…ˆè€‰…É‘}±¥ÍĞˆ°(€€€ô°(€€€ì(€€€€€±…‰•°è€‹²vÓ®Ê#®.°ƒ²‚W®æ®æˆ°(€€€€€Ù…±Õ”è€‘íµ½¹•ä¡µ½¹Ñ¡5…¥¹ÑQ½Ñ…°¥÷²nA€°(€€€€€ÍÕˆèƒ²b“®*`ƒ²‚W®æ€‘íÑ½‘…å5…¥¹ÑÌ¹±•¹Ñ¡÷ªÆÑ€°(€€€€€¥½¸è€‹Â~Rœˆ°(€€€€€Ñ½¹”è€‰½É…¹”ˆ°(€€€€€Ñ…ˆè€‰µ…¥¹Ñ}±¥ÍĞˆ°(€€€ô°(€€€ì(€€€€€±…‰•°è€‹®¾ã²Êc®š°ƒ²zªÎƒ²
³²ˆ°(€€€€€Ù…±Õ”è€‘íÁ•¹‘¥¹I••¥ÁÑA¡½Ñ½Ì¹±•¹Ñ¡÷ªÆÑ€°(€€€€€ÍÕˆèƒ²‚²ÊĞ€‘íÉ••¥ÁÑA¡½Ñ½Ì¹±•¹Ñ¡÷ªÆĞƒ²’E€°(€€€€€¥½¸è€‹Â~Zó¾â<ˆ°(€€€€€Ñ½¹”è€‰ÁÕÉÁ±”ˆ°(€€€€€Ñ…ˆè€‰É••¥ÁÑ}Á¡½Ñ½Ìˆ°(€€€ô°(€€€ì(€€€€€±…‰•°è€‹®¾ã²Êc®š°ƒ²‚W®æ²
³²ˆ°(€€€€€Ù…±Õ”è€‘íÁ•¹‘¥¹5…¥¹Ñ•¹…¹•A¡½Ñ½Ì¹±•¹Ñ¡÷ªÆÑ€°(€€€€€ÍÕˆèƒ²‚²ÊĞ€‘íµ…¥¹Ñ•¹…¹•A¡½Ñ½Ì¹±•¹Ñ¡÷ªÆĞƒ²’E€°(€€€€€¥½¸è€‹Â~Àˆ°(€€€€€Ñ½¹”è€‰É•ˆ°(€€€€€Ñ…ˆè€‰µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìˆ°(€€€ô°(€€€ì(€€€€€±…‰•°è€‹ªâÓªâ$ƒ²‚W®æªÆĞˆ°(€€€€€Ù…±Õ”è€‘íÕÉ•¹Ñ5…¥¹Ñ•¹…¹•A¡½Ñ½Ì¹±•¹Ñ¡÷ªÆÑ€°(€€€€€ÍÕˆè€‹®¾ã²Êc®š°ƒªâÓªâ$ƒªâÃ²’ ˆ°(€€€€€¥½¸è€‹Šjƒ¾â<ˆ°(€€€€€Ñ½¹”è€‰…µ‰•Èˆ°(€€€€€Ñ…ˆè€‰µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìˆ°(€€€ô°(€tì((€½¹ÍĞmÍ•±•Ñ•‘…±•¹‘…É…Ñ”°Í•ÑM•±•Ñ•‘…±•¹‘…É…Ñ•t€ôÕÍ•MÑ…Ñ”ñì(€€€‘…Ñ•-•äèÍÑÉ¥¹œì(€€€Í¡•‘Õ±•Ìè5…¥¹Ñ•¹…¹•M¡•‘Õ±•mtì(€ôğ¹Õ±°ø¡¹Õ±°¤ì((€É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÍ¡•±°µ½‘•É¸µ¡½µ”µÍ¡•±°µÁÉ¼ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ¼ˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ•å•‰É½ÜˆùQ5eU9I@M!	=Iğ½ÍÁ…¸ø(€€€€€€€€€€ñ Èû®2².s®ÎÓ®Npğ½ Èø(€€€€€€€€€€ñÀûªÒ®š³²zC®.`°ƒ²b“®*c®>ƒ²V#²‚¶Vpƒ¶Vc® ƒ®Bc²ã²jP¸ƒªÖ³®ƒ
Üƒ²‚W®æƒ
Üƒ²æÓ®Npƒ
Üƒ²
³²ƒ
Üƒ®†sªŞã®–ğƒ¶Vpƒ¶fS®¦Ó²^C²pƒ¶fW²vã¶V§®.#®.¸ğ½Àø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñÍÁ…¸ûÂ~NíÑ½‘…åôğ½ÍÁ…¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøİ¥¹‘½Ü¹±½…Ñ¥½¸¹É•±½… ¥ôûŠìƒ²#®†sªÎƒ²æ ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µ‘…Í¡‰½…ÉµÑ½ÀµÉ½Üˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µ‘…Í¡‰½…ÉµÑ½Àµ±•™Ğˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ­Á¥Ìµ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼ˆø(€€€€€€€€€€€í­Á¥…É‘Ì¹µ…À ¡…É¤€ôø€ (€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”õíµ½‘•É¸µ¡½µ”µ­Á¤€‘í…É¹Ñ½¹•õô­•äõí…É¹±…‰•±ô½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸¡…É¹Ñ…ˆ¥ôø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¸ˆùí…É¹¥½¹ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ­Á¤µÑ•áĞˆø(€€€€€€€€€€€€€€€€€€ñ•´ùí…É¹±…‰•±ôğ½•´ø(€€€€€€€€€€€€€€€€€€ñˆùí…É¹Ù…±Õ•ôğ½ˆø(€€€€€€€€€€€€€€€€€€ñÍµ…±°ùí…É¹ÍÕ‰ôğ½Íµ…±°ø(€€€€€€€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñ¤û²zC²ã¶z ƒ®ÎÓªâÀƒŠèğ½¤ø(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥Àˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰É••¥ÁÑ}Á¡½Ñ½Ìˆ¥ôø(€€€€€€€€€€€€€€ñÍÁ…¸û²zªÎ€ƒ²Êc®š³®2ªâÀğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñˆùíÁ•¹‘¥¹I••¥ÁÑA¡½Ñ½Ì¹±•¹Ñ¡÷ªÆĞğ½ˆø(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìˆ¥ôø(€€€€€€€€€€€€€€ñÍÁ…¸û²‚W®æƒ²Êc®š³®2ªâÀğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñˆùíÁ•¹‘¥¹5…¥¹Ñ•¹…¹•A¡½Ñ½Ì¹±•¹Ñ¡÷ªÆĞğ½ˆø(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìˆ¥ôø(€€€€€€€€€€€€€€ñÍÁ…¸û²vÓ®Ê#²ğƒ²‚W®æ²vó²‚Tğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñˆùíİ••­M¡•‘Õ±•Ì¹±•¹Ñ¡÷ªÆĞğ½ˆø(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€íÕÉÉ•¹ÑI½±”€ôôô€‰…‘µ¥¸ˆ€˜˜€ (€€€€€€€€€€€€€€ğø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰ÑÉ…Í¡}‰¥¸ˆ¥ôø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸û¶rÓ²¶Ôƒ®ÎÓªÒ ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñˆùí‘•±•Ñ•‘I•½É‘Ì¹±•¹Ñ¡÷ªÆĞğ½ˆø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ¼ø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°¡½µ”µ¹½Ñ¥”µÁ…¹•°¡½µ”µ¹½Ñ¥”µÁ…¹•°µÑ½Àˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…ˆø(€€€€€€€€€€€€ñ ÌûªÎ×²²
³¶V´ğ½ Ìø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰Í¥Ñ•}¹½Ñ¥•Ìˆ¥ôû²‚²ÊĞƒ®ÎÓªâÀƒŠèğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ±¥ÍĞˆø(€€€€€€€€€€€í…Ñ¥Ù•9½Ñ¥•Ì¹±•¹Ñ €ü…Ñ¥Ù•9½Ñ¥•Ì¹Í±¥” À°€Ì¤¹µ…À ¡¹½Ñ¥”¤€ôø€ (€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ¹½Ñ¥”µÉ½Üˆ­•äõí¹½Ñ¥”¹¥‘ô½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰Í¥Ñ•}¹½Ñ¥•Ìˆ¥ôø(€€€€€€€€€€€€€€€€ñÍÁ…¸ûªÎ×² ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆùí¹½Ñ¥”¹Ñ¥Ñ±”ñğ€‹²‚s®ª¤ƒ²^²v0‰ôğ½ˆø(€€€€€€€€€€€€€€€€ñ•´ùì¡¹½Ñ¥”¹É•…Ñ•‘}…Ğñğ¹½Ñ¥”¹¹½Ñ¥•}‘…Ñ”ñğ€ˆˆ¤¹Í±¥” À°€ÄÀ¥ôğ½•´ø(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€¤¤€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ•µÁÑäˆû®NÇ®†w®BpƒªÎ×²ªÂ ƒ²^²*×®.#®.¸ğ½‘¥Øùô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µ‘…Í¡‰½…Éµµ…¥¸µÉ½Üˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°¡½µ”µÉ••¹Ğµ…Ñ¥Ù¥ÑäµÁ…¹•°ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…ˆø(€€€€€€€€€€€€ñ Ìû²ÖsªŞğƒ¶fs®>dğ½ Ìø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÁ…¹•°µ±¥¹¬µÉ½ÕÀˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰±¥ÍĞˆ¥ôûªÖ³®ƒ²‚²ÊĞƒŠèğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ}±¥ÍĞˆ¥ôû²‚W®æƒ²‚²ÊĞƒŠèğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹Ğµ…Ñ¥Ù¥ÑäµÉ¥ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹Ğµ‰±½¬ˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹Ğµ‰±½¬µÑ¥Ñ±”ˆø(€€€€€€€€€€€€€€€€ñÍÁ…¸ûÂ~nHğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆû²ÖsªŞğƒªÖ³®ğ½ˆø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹Ğµ±¥ÍĞˆø(€€€€€€€€€€€€€€€íÉ••¹ÑAÕÉ¡…Í•Ì¹±•¹Ñ €üÉ••¹ÑAÕÉ¡…Í•Ì¹Í±¥” À°€Ô¤¹µ…À ¡À¤€ôø€ (€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹ĞµÉ½Üˆ­•äõíÀ¹¥‘ô½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰±¥ÍĞˆ¥ôø(€€€€€€€€€€€€€€€€€€€€ñ•´ùì¡À¹‘…Ñ”ñğ€ˆˆ¤¹Í±¥” Ô¤ñğ€ˆ´‰ôğ½•´ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí•ÑAÕÉ¡…Í•%Ñ•µMÕµµ…Éä¡À¥ôğ½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÀ¹Ù•¹‘½Èñğ€ˆ´‰ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñˆùíµ½¹•ä¡À¹Ñ½Ñ…°¥÷²n@ğ½ˆø(€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€¤¤€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ•µÁÑäˆûªÖ³®“®
Ó²^·²vĞƒ²^²*×®.#®.¸ğ½‘¥Øùô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹ĞµÑ½Ñ…°ˆø(€€€€€€€€€€€€€€€€ñÍÁ…¸û²vÓ®Ê#®.°ƒªÖ³®“ªâ#²V„ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆùíµ½¹•ä¡µ½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°¥÷²n@ğ½ˆø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹Ğµ‰±½¬ˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹Ğµ‰±½¬µÑ¥Ñ±”ˆø(€€€€€€€€€€€€€€€€ñÍÁ…¸ûÂ~Rœğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆû²ÖsªŞğƒ²‚W®æğ½ˆø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹Ğµ±¥ÍĞˆø(€€€€€€€€€€€€€€€íÉ••¹Ñ5…¥¹ÑÌ¹±•¹Ñ €üÉ••¹Ñ5…¥¹ÑÌ¹Í±¥” À°€Ô¤¹µ…À ¡´¤€ôø€ (€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹ĞµÉ½Üˆ­•äõí´¹¥‘ô½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ}±¥ÍĞˆ¥ôø(€€€€€€€€€€€€€€€€€€€€ñ•´ùì¡´¹‘…Ñ”ñğ€ˆˆ¤¹Í±¥” Ô¤ñğ€ˆ´‰ôğ½•´ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí´¹Ñ¥Ñ±”ñğ€‹²‚W®æ‰ôğ½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí´¹İ…É•¡½ÕÍ”ñğ€ˆ´‰ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñˆùíµ½¹•ä¡´¹Ñ½Ñ…°ñğ´¹½ÍĞ¥÷²n@ğ½ˆø(€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€¤¤€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ•µÁÑäˆû²‚W®æ®
Ó²^·²vĞƒ²^²*×®.#®.¸ğ½‘¥Øùô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹ĞµÑ½Ñ…°É••¸ˆø(€€€€€€€€€€€€€€€€ñÍÁ…¸û²vÓ®Ê#®.°ƒ²‚W®æƒ®æ²j¤ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆùíµ½¹•ä¡µ½¹Ñ¡5…¥¹ÑQ½Ñ…°¥÷²n@ğ½ˆø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°¡½µ”µİ••¬µ…±•¹‘…ÈµÁ…¹•°ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…ˆø(€€€€€€€€€€€€ñ Ìû²vÓ®Ê#²ğƒ²‚W®æ²vó²‚Tğ½ Ìø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìˆ¥ôû²‚²ÊĞƒ®ÎÓªâÀƒŠèğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µİ••¬µÉ…¹”ˆùíİ••­MÑ…ÉÑ-•åôøíİ••­¹‘-•åôğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µİ••¬µ…±•¹‘…ÈµÉ¥ˆø(€€€€€€€€€€€íİ••­…±•¹‘…É…åÌ¹µ…À ¡‘…ä¤€ôø€ (€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€­•äõí‘…ä¹‘…Ñ•-•åô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí¡½µ”µİ••¬µ‘…ä€‘í‘…ä¹‘…Ñ•-•ä€ôôôÑ½‘…ä€ü€‰Ñ½‘…äˆ€è€ˆ‰ô€‘í‘…ä¹Í¡•‘Õ±•Ì¹±•¹Ñ €ü€‰¡…Ìµİ½É¬ˆ€è€ˆ‰õô(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì(€€€€€€€€€€€€€€€€€¥˜€¡‘…ä¹Í¡•‘Õ±•Ì¹±•¹Ñ ¤Í•ÑM•±•Ñ•‘…±•¹‘…É…Ñ”¡ì‘…Ñ•-•äè‘…ä¹‘…Ñ•-•ä°Í¡•‘Õ±•Ìè‘…ä¹Í¡•‘Õ±•Ìô¤ì(€€€€€€€€€€€€€€€€€•±Í”Í•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•}¹•Üˆ¤ì(€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñÍÁ…¸ùí‘…ä¹‘…åQ•áÑô€¡í‘…ä¹‘…å1…‰•±ô¤ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€í‘…ä¹‘…Ñ•-•ä€ôôôÑ½‘…ä€˜˜€ñ¤û²b“®*`ğ½¤ùô(€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€í‘…ä¹Í¡•‘Õ±•Ì¹±•¹Ñ €ü‘…ä¹Í¡•‘Õ±•Ì¹Í±¥” À°€Ì¤¹µ…À ¡Ì¤€ôø€ (€€€€€€€€€€€€€€€€€€€€ñ•´­•äõíÌ¹¥‘ôùíÌ¹•ÅÕ¥Áµ•¹Ñ}¹…µ”ñğ€‹²z—®æ‰ôƒ
ÜíÌ¹İ½É­}‘•Ñ…¥°ñğ€‹²zG²^‰ôğ½•´ø(€€€€€€€€€€€€€€€€€€¤¤€è€ñÍµ…±°ø´ğ½Íµ…±°ùô(€€€€€€€€€€€€€€€€€í‘…ä¹Í¡•‘Õ±•Ì¹±•¹Ñ €ø€Ì€˜˜€ñÍµ…±°û²fàí‘…ä¹Í¡•‘Õ±•Ì¹±•¹Ñ €´€Í÷ªÆĞğ½Íµ…±°ùô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€í‘…ä¹Í¡•‘Õ±•Ì¹±•¹Ñ €ø€À€˜˜€ñˆùí‘…ä¹Í¡•‘Õ±•Ì¹±•¹Ñ¡÷ªÆĞğ½ˆùô(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¹¤µ…±•¹‘…Èµ±••¹ˆø(€€€€€€€€€€€€ñÍÁ…¸øñ¤±…ÍÍ9…µ”ô‰Ñ½‘…äµ‘½Ğˆ€¼û²b“®*`ğ½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸øñ¤±…ÍÍ9…µ”ô‰İ½É¬µ‘½Ğˆ€¼û²‚W®æ²vó²‚Tğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÁ¡½Ñ¼µÍ¡½ÉÑÕĞµÉ½Üˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µÁ…¹•°ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…ˆø(€€€€€€€€€€€€ñ Ìû²ÖsªŞğƒ²
³²ğ½ Ìø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÁ…¹•°µ±¥¹¬µÉ½ÕÀˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ}±¥ÍĞˆ¥ôû²‚W®æ²†Ã¶j0ƒŠèğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€íÉ••¹ÑA¡½Ñ½%Ñ•µÌ¹±•¹Ñ €ü€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µÉ¥ˆø(€€€€€€€€€€€€€íÉ••¹ÑA¡½Ñ½%Ñ•µÌ¹µ…À ¡Á¡½Ñ¼¤€ôø€ (€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõíÁ¡½Ñ¼¹¥‘ô±…ÍÍ9…µ”ô‰¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µ…Éˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸¡Á¡½Ñ¼¹Ñ…ˆ¥ôø(€€€€€€€€€€€€€€€€€€ñ¥µœÍÉŒõíÁ¡½Ñ¼¹ÕÉ±ô…±ĞõíÁ¡½Ñ¼¹Ñ¥Ñ±•ô€¼ø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÁ¡½Ñ¼¹ÑåÁ•ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñˆùíÁ¡½Ñ¼¹Ñ¥Ñ±•ôğ½ˆø(€€€€€€€€€€€€€€€€€€ñ•´ùíÁ¡½Ñ¼¹µ•Ñ„ñğ€ˆ´‰ôğ½•´ø(€€€€€€€€€€€€€€€€€€ñÍµ…±°ùíMÑÉ¥¹œ¡Á¡½Ñ¼¹‘…Ñ”ñğ€ˆˆ¤¹Í±¥” Ô°€ÄÀ¤ñğ€ˆ´‰ôğ½Íµ…±°ø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¤€è€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µ•µÁÑäˆû²‚W®æ²†Ã¶j3²^@ƒ®NÇ®†w®Bpƒ²
³²²vĞƒ²^²*×®.#®.¸ğ½‘¥Øø(€€€€€€€€€€¥ô(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°¡½µ”µÍ¡½ÉÑÕĞµÁ…¹•°ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…ˆø(€€€€€€€€€€€€ñ Ìû®ÂS®†sªÂªâÀğ½ Ìø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü¡½µ”µÍ¡½ÉÑÕĞµÉ½Üµ¥¹±¥¹”ˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰¹•Üˆ¥ôøñÍÁ…¸ûÂ~nHğ½ÍÁ…¸øñˆûªÖ³®ƒ®NÇ®†tğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ}¹•Üˆ¥ôøñÍÁ…¸ûÂ~Rœğ½ÍÁ…¸øñˆû²‚W®æƒ®NÇ®†tğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰¥Ñ•µÌˆ¥ôøñÍÁ…¸ûÂ~R8ğ½ÍÁ…¸øñˆû¶J#®ª¤ƒªÊ²$ğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰±¥ÍĞˆ¥ôøñÍÁ…¸ûÂ~>ß¾â<ğ½ÍÁ…¸øñˆû²ÖsªŞğƒ®.£ªÂ ğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰…É‘}ÕÍ”ˆ¥ôøñÍÁ…¸ûÂ~JÌğ½ÍÁ…¸øñˆû²æÓ®Npƒ²
³²j¤ƒ®NÇ®†tğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰Í¥Ñ•}¹½Ñ¥•Ìˆ¥ôøñÍÁ…¸ûÂ~RPğ½ÍÁ…¸øñˆûªÎ×²²
³¶V´ğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡½µ”µµ½¹Ñ µÍÑ…ĞµÉ¥ˆø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½µ”µµ½¹Ñ µÍÑ…Ğ¡½µ”µ¥¹Í¥¡ĞµÍÑ…Ğ‰±Õ”ˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰ÍÑ…ÑÕÌˆ¥ôø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡½µ”µ¥¹Í¥¡Ğµ½Áäˆø(€€€€€€€€€€€€ñ•´ûªÖ³®“®æƒ²‚²nPƒ®2®æğ½•´ø(€€€€€€€€€€€€ñˆ±…ÍÍ9…µ”õíµ½¹Ñ¡¡…¹•Q½¹”¡µ½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°°ÁÉ•Ù¥½ÕÍ5½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°¥ôùíµ½¹Ñ¡¡…¹•1…‰•°¡µ½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°°ÁÉ•Ù¥½ÕÍ5½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°¥ôğ½ˆø(€€€€€€€€€€€€ñÍµ…±°û²vÓ®Ê#®.°íµ½¹•ä¡µ½¹Ñ¡AÕÉ¡…Í•Q½Ñ…°¥÷²n@ğ½Íµ…±°ø(€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€ñ5¥¹¥MÁ…É­±¥¹”Ù…±Õ•ÌõíÁÕÉ¡…Í•QÉ•¹‘ô½±½ÈôˆŒÈÔØÍ•ˆˆ€¼ø(€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½µ”µµ½¹Ñ µÍÑ…Ğ¡½µ”µ¥¹Í¥¡ĞµÍÑ…ĞÁÕÉÁ±”ˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰…É‘}ÍÑ…ÑÌˆ¥ôø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡½µ”µ¥¹Í¥¡Ğµ½Áäˆø(€€€€€€€€€€€€ñ•´û²æÓ®Ns®æƒ²‚²nPƒ®2®æğ½•´ø(€€€€€€€€€€€€ñˆ±…ÍÍ9…µ”õíµ½¹Ñ¡¡…¹•Q½¹”¡µ½¹Ñ¡…É‘Q½Ñ…°°ÁÉ•Ù¥½ÕÍ5½¹Ñ¡…É‘Q½Ñ…°¥ôùíµ½¹Ñ¡¡…¹•1…‰•°¡µ½¹Ñ¡…É‘Q½Ñ…°°ÁÉ•Ù¥½ÕÍ5½¹Ñ¡…É‘Q½Ñ…°¥ôğ½ˆø(€€€€€€€€€€€€ñÍµ…±°û²vÓ®Ê#®.°íµ½¹•ä¡µ½¹Ñ¡…É‘Q½Ñ…°¥÷²n@ğ½Íµ…±°ø(€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€ñ5¥¹¥MÁ…É­±¥¹”Ù…±Õ•Ìõí…É‘QÉ•¹‘ô½±½ÈôˆŒİŒÍ…•ˆ€¼ø(€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½µ”µµ½¹Ñ µÍÑ…Ğ¡½µ”µ¥¹Í¥¡ĞµÍÑ…ĞÉ••¸ˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ}ÍÑ…ÑÌˆ¥ôø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡½µ”µ¥¹Í¥¡Ğµ½Áäˆø(€€€€€€€€€€€€ñ•´û²‚W®æ®æƒ²‚²nPƒ®2®æğ½•´ø(€€€€€€€€€€€€ñˆ±…ÍÍ9…µ”õíµ½¹Ñ¡¡…¹•Q½¹”¡µ½¹Ñ¡5…¥¹ÑQ½Ñ…°°ÁÉ•Ù¥½ÕÍ5½¹Ñ¡5…¥¹ÑQ½Ñ…°¥ôùíµ½¹Ñ¡¡…¹•1…‰•°¡µ½¹Ñ¡5…¥¹ÑQ½Ñ…°°ÁÉ•Ù¥½ÕÍ5½¹Ñ¡5…¥¹ÑQ½Ñ…°¥ôğ½ˆø(€€€€€€€€€€€€ñÍµ…±°û²vÓ®Ê#®.°íµ½¹•ä¡µ½¹Ñ¡5…¥¹ÑQ½Ñ…°¥÷²n@ğ½Íµ…±°ø(€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€ñ5¥¹¥MÁ…É­±¥¹”Ù…±Õ•Ìõíµ…¥¹ÑQÉ•¹‘ô½±½ÈôˆŒÀÔäØØäˆ€¼ø(€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½µ”µµ½¹Ñ µÍÑ…Ğ¡½µ”µ¥¹Í¥¡ĞµÍÑ…Ğ…µ‰•Èˆ½¹±¥¬õì ¤€ôøÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìˆ¥ôø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡½µ”µ¥¹Í¥¡Ğµ½Áäˆø(€€€€€€€€€€€€ñ•´û²‚W®æ²vó²‚Tƒ²f®3²r ğ½•´ø(€€€€€€€€€€€€ñˆùíİ••­½µÁ±•Ñ¥½¹I…Ñ•ô”ğ½ˆø(€€€€€€€€€€€€ñÍµ…±°ùí½µÁ±•Ñ•‘]••­M¡•‘Õ±•Íô½í…±±]••­M¡•‘Õ±•Ì¹±•¹Ñ¡÷ªÆĞƒ²f®0ğ½Íµ…±°ø(€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¡½µ”µ½µÁ±•Ñ¥½¸µÉ¥¹œˆÍÑå±”õíì‰…­É½Õ¹è½¹¥ŒµÉ…‘¥•¹Ğ ˜Ôå”Áˆ€‘íİ••­½µÁ±•Ñ¥½¹I…Ñ”€¨€Ì¸Ùõ‘•œ°”á•‘˜Ì€Á‘•œ¥€õô…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆø(€€€€€€€€€€€€ñ¤€¼ø(€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø(€€€€€íÍ•±•Ñ•‘…±•¹‘…É…Ñ”€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ‘•Ñ…¥°µ‰…­‘É½Àˆ½¹±¥¬õì ¤€ôøÍ•ÑM•±•Ñ•‘…±•¹‘…É…Ñ”¡¹Õ±°¥ôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ‘•Ñ…¥°µµ½‘…°ˆ½¹±¥¬õì¡”¤€ôø”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¥ôø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ‘•Ñ…¥°µ¡•…ˆø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñÍÁ…¸û²‚W®æ²vó²‚Tƒ²²àğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñ ÌùíÍ•±•Ñ•‘…±•¹‘…É…Ñ”¹‘…Ñ•-•åôğ½ Ìø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑM•±•Ñ•‘…±•¹‘…É…Ñ”¡¹Õ±°¥ôû\ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ‘•Ñ…¥°µ±¥ÍĞˆø(€€€€€€€€€€€€€íÍ•±•Ñ•‘…±•¹‘…É…Ñ”¹Í¡•‘Õ±•Ì¹µ…À ¡Ì¤€ôø€ (€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´ˆ­•äõíÌ¹¥‘ôø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´µÑ½Àˆø(€€€€€€€€€€€€€€€€€€€€ñˆùíÌ¹•ÅÕ¥Áµ•¹Ñ}¹…µ”ñğ€‹²z—®æ®ªƒ²^²v0‰ôğ½ˆø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õí…±•¹‘…Èµ‘•Ñ…¥°µ‰…‘”€‘íÌ¹ÁÉ¥½É¥Ñä€ôôô€‹ªâÓªâ$ˆ€ü€‰ÕÉ•¹Ğˆ€è€ˆ‰õôùíÌ¹ÁÉ¥½É¥Ñäñğ€‹®ÎÓ¶Ô‰ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñÀùíÌ¹İ½É­}‘•Ñ…¥°ñğ€‹²zG²^®
Ó²j¤ƒ²^²v0‰ôğ½Àø(€€€€€€€€€€€€€€€€€€ñ‘°ø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Øøñ‘Ğû®.Ó®.ç²z@ğ½‘Ğøñ‘ùíÌ¹İ½É­•É}¹…µ”ñğ€‹®¾ã²²‚T‰ôğ½‘øğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Øøñ‘Ğû²¶pğ½‘Ğøñ‘ùíÌ¹ÍÑ…ÑÕÌñğ€‹²b#²‚T‰ôğ½‘øğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Øøñ‘Ğû®¦S®ª ğ½‘Ğøñ‘ùíÌ¹µ•µ¼ñğ€ˆ´‰ôğ½‘øğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½‘°ø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ‘•Ñ…¥°µ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑM•±•Ñ•‘…±•¹‘…É…Ñ”¡¹Õ±°¥ôû®.¯ªâÀğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆ½¹±¥¬õì ¤€ôøìÍ•ÑM•±•Ñ•‘…±•¹‘…É…Ñ”¡¹Õ±°¤ìÍ•Ñ5•¹ÕQ…ˆü¸ ‰µ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìˆ¤ìõôû²‚W®æ²vó²‚W²†Ã¶j3®†pƒ²vÓ®>dğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€ğ½Í•Ñ¥½¸ø(€€¤ì)ô()™Õ¹Ñ¥½¸…É‘UÍ•MÑ…ÑÌ¡ì…É‘UÍ•Ìôèì…É‘UÍ•Ìè…É‘UÍ•mtô¤ì(€½¹ÍĞm™É½´°Í•ÑÉ½µt€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞmÑ¼°Í•ÑQ½t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞmÕÍ•É9…µ”°Í•ÑUÍ•É9…µ•t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞmÁ±…”°Í•ÑA±…•t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì((€½¹ÍĞ™¥±Ñ•É•€ôÕÍ•5•µ¼  ¤€ôøì(€€€É•ÑÕÉ¸…É‘UÍ•Ì¹™¥±Ñ•È ¡Œ¤€ôøì(€€€€€½¹ÍĞ€ôŒ¹‘…Ñ”ñğ€ˆˆì(€€€€€½¹ÍĞ½­É½´€ô€…™É½´ñğ€øô™É½´ì(€€€€€½¹ÍĞ½­Q¼€ô€…Ñ¼ñğ€ğôÑ¼ì(€€€€€½¹ÍĞ½­UÍ•È€ô€…ÕÍ•É9…µ”ñğ€¡Œ¹ÕÍ•É}¹…µ”ñğ€ˆˆ¤¹¥¹±Õ‘•Ì¡ÕÍ•É9…µ”¤ì(€€€€€½¹ÍĞ½­A±…”€ô€…Á±…”ñğ€¡Œ¹Á±…”ñğ€ˆˆ¤¹¥¹±Õ‘•Ì¡Á±…”¤ì(€€€€€É•ÑÕÉ¸½­É½´€˜˜½­Q¼€˜˜½­UÍ•È€˜˜½­A±…”ì(€€€ô¤ì(€ô°m…É‘UÍ•Ì°™É½´°Ñ¼°ÕÍ•É9…µ”°Á±…•t¤ì((€½¹ÍĞÍÕµµ…Éä€ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞÑ½Ñ…°€ô™¥±Ñ•É•¹É•‘Õ” ¡ÍÕ´°Œ¤€ôøÍÕ´€¬9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤°€À¤ì((€€€½¹ÍĞ‰åUÍ•È€ô¹•Ü5…ÀñÍÑÉ¥¹œ°¹Õµ‰•Èø ¤ì(€€€½¹ÍĞ‰åA±…”€ô¹•Ü5…ÀñÍÑÉ¥¹œ°¹Õµ‰•Èø ¤ì((€€€™¥±Ñ•É•¹™½É…  ¡Œ¤€ôøì(€€€€€½¹ÍĞÔ€ôŒ¹ÕÍ•É}¹…µ”ñğ€‹®¾ã²²‚Tˆì(€€€€€½¹ÍĞÀ€ôŒ¹Á±…”ñğ€‹®¾ã²²‚Tˆì(€€€€€‰åUÍ•È¹Í•Ğ¡Ô°€¡‰åUÍ•È¹•Ğ¡Ô¤ñğ€À¤€¬9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤¤ì(€€€€€‰åA±…”¹Í•Ğ¡À°€¡‰åA±…”¹•Ğ¡À¤ñğ€À¤€¬9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤¤ì(€€€ô¤ì((€€€½¹ÍĞÑ½ÁUÍ•È€ôÉÉ…ä¹™É½´¡‰åUÍ•È¹•¹ÑÉ¥•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôø‰lÅt€´…lÅt¥lÁtì(€€€½¹ÍĞÑ½ÁA±…”€ôÉÉ…ä¹™É½´¡‰åA±…”¹•¹ÑÉ¥•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôø‰lÅt€´…lÅt¥lÁtì((€€€É•ÑÕÉ¸ì(€€€€€½Õ¹Ğè™¥±Ñ•É•¹±•¹Ñ °(€€€€€Ñ½Ñ…°°(€€€€€…Ùœè™¥±Ñ•É•¹±•¹Ñ €ü5…Ñ ¹É½Õ¹¡Ñ½Ñ…°€¼™¥±Ñ•É•¹±•¹Ñ ¤€è€À°(€€€€€Ñ½ÁUÍ•É9…µ”èÑ½ÁUÍ•Èü¹lÁtñğ€ˆ´ˆ°(€€€€€Ñ½ÁUÍ•ÉQ½Ñ…°èÑ½ÁUÍ•Èü¹lÅtñğ€À°(€€€€€Ñ½ÁA±…•9…µ”èÑ½ÁA±…”ü¹lÁtñğ€ˆ´ˆ°(€€€€€Ñ½ÁA±…•Q½Ñ…°èÑ½ÁA±…”ü¹lÅtñğ€À°(€€€ôì(€ô°m™¥±Ñ•É•‘t¤ì((€½¹ÍĞ‰å5½¹Ñ €ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞµ…À€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ìµ½¹Ñ èÍÑÉ¥¹œì½Õ¹Ğè¹Õµ‰•ÈìÑ½Ñ…°è¹Õµ‰•Èôø ¤ì(€€€™¥±Ñ•É•¹™½É…  ¡Œ¤€ôøì(€€€€€½¹ÍĞµ½¹Ñ €ô€¡Œ¹‘…Ñ”ñğ€‹®¾ã²²‚Tˆ¤¹Í±¥” À°€Ü¤ñğ€‹®¾ã²²‚Tˆì(€€€€€½¹ÍĞÕÈ€ôµ…À¹•Ğ¡µ½¹Ñ ¤ñğìµ½¹Ñ °½Õ¹Ğè€À°Ñ½Ñ…°è€Àôì(€€€€€ÕÈ¹½Õ¹Ğ€¬ô€Äì(€€€€€ÕÈ¹Ñ½Ñ…°€¬ô9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤ì(€€€€€µ…À¹Í•Ğ¡µ½¹Ñ °ÕÈ¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸ÉÉ…ä¹™É½´¡µ…À¹Ù…±Õ•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹µ½¹Ñ ¹±½…±•½µÁ…É”¡„¹µ½¹Ñ ¤¤ì(€ô°m™¥±Ñ•É•‘t¤ì((€½¹ÍĞ‰åUÍ•È€ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞµ…À€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ìÕÍ•É}¹…µ”èÍÑÉ¥¹œì½Õ¹Ğè¹Õµ‰•ÈìÑ½Ñ…°è¹Õµ‰•Èôø ¤ì(€€€™¥±Ñ•É•¹™½É…  ¡Œ¤€ôøì(€€€€€½¹ÍĞ¹…µ”€ôŒ¹ÕÍ•É}¹…µ”ñğ€‹®¾ã²²‚Tˆì(€€€€€½¹ÍĞÕÈ€ôµ…À¹•Ğ¡¹…µ”¤ñğìÕÍ•É}¹…µ”è¹…µ”°½Õ¹Ğè€À°Ñ½Ñ…°è€Àôì(€€€€€ÕÈ¹½Õ¹Ğ€¬ô€Äì(€€€€€ÕÈ¹Ñ½Ñ…°€¬ô9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤ì(€€€€€µ…À¹Í•Ğ¡¹…µ”°ÕÈ¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸ÉÉ…ä¹™É½´¡µ…À¹Ù…±Õ•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹Ñ½Ñ…°€´„¹Ñ½Ñ…°¤ì(€ô°m™¥±Ñ•É•‘t¤ì((€½¹ÍĞ‰åA±…”€ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞµ…À€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ìÁ±…”èÍÑÉ¥¹œì½Õ¹Ğè¹Õµ‰•ÈìÑ½Ñ…°è¹Õµ‰•Èôø ¤ì(€€€™¥±Ñ•É•¹™½É…  ¡Œ¤€ôøì(€€€€€½¹ÍĞ¹…µ”€ôŒ¹Á±…”ñğ€‹®¾ã²²‚Tˆì(€€€€€½¹ÍĞÕÈ€ôµ…À¹•Ğ¡¹…µ”¤ñğìÁ±…”è¹…µ”°½Õ¹Ğè€À°Ñ½Ñ…°è€Àôì(€€€€€ÕÈ¹½Õ¹Ğ€¬ô€Äì(€€€€€ÕÈ¹Ñ½Ñ…°€¬ô9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤ì(€€€€€µ…À¹Í•Ğ¡¹…µ”°ÕÈ¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸ÉÉ…ä¹™É½´¡µ…À¹Ù…±Õ•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹Ñ½Ñ…°€´„¹Ñ½Ñ…°¤¹Í±¥” À°€ÌÀ¤ì(€ô°m™¥±Ñ•É•‘t¤ì((€½¹ÍĞÉ••¹Ğ€ôÕÍ•5•µ¼  ¤€ôøì(€€€É•ÑÕÉ¸l¸¸¹™¥±Ñ•É•‘t¹Í½ÉĞ ¡„°ˆ¤€ôøMÑÉ¥¹œ¡ˆ¹‘…Ñ”ñğ€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹‘…Ñ”ñğ€ˆˆ¤¤¤¹Í±¥” À°€ÈÀ¤ì(€ô°m™¥±Ñ•É•‘t¤ì((€É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…Éˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰•Ñİ••¸ˆøñ Èû²æÓ®Ns¶×ªÎğ½ Èøñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôø‘½İ¹±½…‘á•°¡ƒ²æÓ®Ns¶×ªÎ|‘íÑ½‘…åQ•áĞ ¥õ€°İ¥Ñ¡Q½Ñ…±I½Ü (€™¥±Ñ•É•¹µ…À ¡Œ¤€ôø€¡ìƒ²
³²j§²vó²z@èŒ¹‘…Ñ”°ƒ®.Ó®.ç²z@èŒ¹ÕÍ•É}¹…µ”°ƒ²
³²j§²Ê`èŒ¹Á±…”°ƒªâ#²V„èŒ¹…µ½Õ¹Ğ°ƒ®¦S®ª èŒ¹µ•µ¼ñğ€ˆˆ°ƒ²b²"c²štèŒ¹¥µ…•}ÕÉ°ñğ€ˆˆô¤¤°(€ìƒ²
³²j§²vó²z@è€‹²Òw¶V§ªÎˆ°ƒªâ#²V„è™¥±Ñ•É•¹É•‘Õ” ¡ÍÕ´°Œ¤€ôøÍÕ´€¬9Õµ‰•È¡Œ¹…µ½Õ¹Ğñğ€À¤°€À¤ô(¤¥ôû²^G² ƒ®.“²jÓ®†s®Npğ½‰ÕÑÑ½¸øğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥Ôˆø(€€€€€€€€ñ¥•±±…‰•°ô‹².s²zG²vğˆøñ…Ñ•%¹ÁÕĞÙ…±Õ”õí™É½µô½¹¡…¹”õíÍ•ÑÉ½µô€¼øğ½¥•±ø(€€€€€€€€ñ¥•±±…‰•°ô‹²Š®3²vğˆøñ…Ñ•%¹ÁÕĞÙ…±Õ”õíÑ½ô½¹¡…¹”õíÍ•ÑQ½ô€¼øğ½¥•±ø(€€€€€€€€ñ¥•±±…‰•°ô‹®.Ó®.ç²z@ˆøñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹®.Ó®.ç²z@ƒªÊ²$ˆÙ…±Õ”õíÕÍ•É9…µ•ô½¹¡…¹”õì¡”¤€ôøÍ•ÑUÍ•É9…µ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô€¼øğ½¥•±ø(€€€€€€€€ñ¥•±±…‰•°ô‹²
³²j§²Ê`ˆøñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹²
³²j§²Ê`ƒªÊ²$ˆÙ…±Õ”õíÁ±…•ô½¹¡…¹”õì¡”¤€ôøÍ•ÑA±…”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô€¼øğ½¥•±ø(€€€€€€€€ñ¥•±±…‰•°ô‹²Ò#ªâÃ¶fPˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøìÍ•ÑÉ½´ ˆˆ¤ìÍ•ÑQ¼ ˆˆ¤ìÍ•ÑUÍ•É9…µ” ˆˆ¤ìÍ•ÑA±…” ˆˆ¤ìõôûªÊ²$ƒ²Ò#ªâÃ¶fPğ½‰ÕÑÑ½¸øğ½¥•±ø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÑ…ÑÕÌµ…É‘Ìˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²æÓ®Ns²
³²j¤ƒªÆÓ²"`ğ½ÍÁ…¸øñˆùíÍÕµµ…Éä¹½Õ¹Ñ÷ªÆĞğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²Òtƒ²
³²j§ªâ#²V„ğ½ÍÁ…¸øñˆùíµ½¹•ä¡ÍÕµµ…Éä¹Ñ½Ñ…°¥÷²n@ğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸ûªÆÓ®.äƒ¶>'ªŞ€ğ½ÍÁ…¸øñˆùíµ½¹•ä¡ÍÕµµ…Éä¹…Ùœ¥÷²n@ğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²ÖsªÎ€ƒ²
³²j¤ƒ®.Ó®.ç²z@ğ½ÍÁ…¸øñˆùíÍÕµµ…Éä¹Ñ½ÁUÍ•É9…µ•ôñ‰È€¼ùíµ½¹•ä¡ÍÕµµ…Éä¹Ñ½ÁUÍ•ÉQ½Ñ…°¥÷²n@ğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²ÖsªÎ€ƒ²
³²j§²Ê`ğ½ÍÁ…¸øñˆùíÍÕµµ…Éä¹Ñ½ÁA±…•9…µ•ôñ‰È€¼ùíµ½¹•ä¡ÍÕµµ…Éä¹Ñ½ÁA±…•Q½Ñ…°¥÷²n@ğ½ˆøğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ Ìû²nS®Îƒ²æÓ®Ns²
³²j¤ğ½ Ìø(€€€€€€ñMÉ½±±Q…‰±”ø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û²nPğ½Ñ øñÑ ûªÆÓ²"`ğ½Ñ øñÑ û¶V§ªÎğ½Ñ øğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€ì…‰å5½¹Ñ ¹±•¹Ñ €ü€ñÑÈøñÑ½±MÁ…¸õìÍô±…ÍÍ9…µ”ô‰•µÁÑäˆû²†Ã¶j3®Bpƒ²nS®Îƒ²æÓ®Ns²
³²j¤ƒ²^²v0ğ½Ñøğ½ÑÈø€è‰å5½¹Ñ ¹µ…À ¡´¤€ôø€ (€€€€€€€€€€€€€€ñÑÈ­•äõí´¹µ½¹Ñ¡ôø(€€€€€€€€€€€€€€€€ñÑùí´¹µ½¹Ñ¡ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùí´¹½Õ¹Ñôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğ‰½±ˆùíµ½¹•ä¡´¹Ñ½Ñ…°¥ôğ½Ñø(€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€ğ½MÉ½±±Q…‰±”ø((€€€€€€ñ Ìû®.Ó®.ç²zC®Îƒ²æÓ®Ns²
³²j¤ğ½ Ìø(€€€€€€ñMÉ½±±Q…‰±”ø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û²"s²rğ½Ñ øñÑ û²zG²^²z@ğ½Ñ øñÑ ûªÆÓ²"`ğ½Ñ øñÑ û¶V§ªÎğ½Ñ øğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€ì…‰åUÍ•È¹±•¹Ñ €ü€ñÑÈøñÑ½±MÁ…¸õìÑô±…ÍÍ9…µ”ô‰•µÁÑäˆû²†Ã¶j3®Bpƒ®.Ó®.ç²zC®Îƒ²æÓ®Ns²
³²j¤ƒ²^²v0ğ½Ñøğ½ÑÈø€è‰åUÍ•È¹µ…À ¡Ô°¤¤€ôø€ (€€€€€€€€€€€€€€ñÑÈ­•äõíÔ¹ÕÍ•É}¹…µ•ôø(€€€€€€€€€€€€€€€€ñÑùí¤€¬€Åôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùíÔ¹ÕÍ•É}¹…µ•ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùíÔ¹½Õ¹Ñôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğ‰½±ˆùíµ½¹•ä¡Ô¹Ñ½Ñ…°¥ôğ½Ñø(€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€ğ½MÉ½±±Q…‰±”ø((€€€€€€ñ Ìû²
³²j§²Êc®Îƒ²æÓ®Ns²
³²j¤Q=@€ÌÀğ½ Ìø(€€€€€€ñMÉ½±±Q…‰±”ø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û²"s²rğ½Ñ øñÑ û²
³²j§²Ê`ğ½Ñ øñÑ ûªÆÓ²"`ğ½Ñ øñÑ û¶V§ªÎğ½Ñ øğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€ì…‰åA±…”¹±•¹Ñ €ü€ñÑÈøñÑ½±MÁ…¸õìÑô±…ÍÍ9…µ”ô‰•µÁÑäˆû²†Ã¶j3®Bpƒ²
³²j§²Êc®Îƒ²æÓ®Ns²
³²j¤ƒ²^²v0ğ½Ñøğ½ÑÈø€è‰åA±…”¹µ…À ¡À°¤¤€ôø€ (€€€€€€€€€€€€€€ñÑÈ­•äõíÀ¹Á±…•ôø(€€€€€€€€€€€€€€€€ñÑùí¤€¬€Åôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùíÀ¹Á±…•ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùíÀ¹½Õ¹Ñôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğ‰½±ˆùíµ½¹•ä¡À¹Ñ½Ñ…°¥ôğ½Ñø(€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€ğ½MÉ½±±Q…‰±”ø((€€€€€€ñ Ìû²ÖsªŞğƒ²æÓ®Ns²
³²j¤ƒ®
Ó²^´ğ½ Ìø(€€€€€€ñMÉ½±±Q…‰±”ø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û²vó²z@ğ½Ñ øñÑ û®.Ó®.ç²z@ğ½Ñ øñÑ û²
³²j§²Ê`ğ½Ñ øñÑ ûªâ#²V„ğ½Ñ øñÑ û²b²"c²štğ½Ñ øğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€ì…É••¹Ğ¹±•¹Ñ €ü€ñÑÈøñÑ½±MÁ…¸õìÕô±…ÍÍ9…µ”ô‰•µÁÑäˆû²ÖsªŞğƒ²æÓ®Ns²
³²j¤ƒ²^²v0ğ½Ñøğ½ÑÈø€èÉ••¹Ğ¹µ…À ¡Œ¤€ôø€ (€€€€€€€€€€€€€€ñÑÈ­•äõíŒ¹¥‘ôø(€€€€€€€€€€€€€€€€ñÑùíŒ¹‘…Ñ”ñğ€ˆ´‰ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùíŒ¹ÕÍ•É}¹…µ”ñğ€ˆ´‰ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùíŒ¹Á±…”ñğ€ˆ´‰ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğ‰½±ˆùíµ½¹•ä¡Œ¹…µ½Õ¹Ğ¥ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑøñÑÑ…¡µ•¹ÑÉ½ÕÀÕÉ±ÌõíŒ¹¥µ…•}ÕÉ±Ìñğ€¡Œ¹¥µ…•}ÕÉ°€ümŒ¹¥µ…•}ÕÉ±t€èmt¥ô€¼øğ½Ñø(€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€ğ½MÉ½±±Q…‰±”ø(€€€€ğ½Í•Ñ¥½¸ø(€€¤ì)ô(()™Õ¹Ñ¥½¸5…¥¹Ñ•¹…¹•MÑ…ÑÌ¡ìµ…¥¹ÑÌôèìµ…¥¹ÑÌè5…¥¹Ñmtô¤ì(€½¹ÍĞm™É½´°Í•ÑÉ½µt€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞmÑ¼°Í•ÑQ½t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞmİ…É•¡½ÕÍ”°Í•Ñ]…É•¡½ÕÍ•t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍĞm­•åİ½É°Í•Ñ-•åİ½É‘t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì((€½¹ÍĞ™¥±Ñ•É•€ôÕÍ•5•µ¼  ¤€ôøì(€€€É•ÑÕÉ¸µ…¥¹ÑÌ¹™¥±Ñ•È ¡´¤€ôøì(€€€€€½¹ÍĞ€ô´¹‘…Ñ”ñğ€ˆˆì(€€€€€½¹ÍĞ½­É½´€ô€…™É½´ñğ€øô™É½´ì(€€€€€½¹ÍĞ½­Q¼€ô€…Ñ¼ñğ€ğôÑ¼ì(€€€€€½¹ÍĞ½­]…É•¡½ÕÍ”€ô€…İ…É•¡½ÕÍ”ñğ€¡´¹İ…É•¡½ÕÍ”ñğ€ˆˆ¤¹¥¹±Õ‘•Ì¡İ…É•¡½ÕÍ”¤ì(€€€€€½¹ÍĞ½­-•åİ½É€ô€…­•åİ½Éñğ€‘í´¹Ñ¥Ñ±”ñğ€ˆ‰ô€‘í´¹‘•Ñ…¥°ñğ€ˆ‰ô€‘í´¹µ…¹…•Èñğ€ˆ‰õ€¹¥¹±Õ‘•Ì¡­•åİ½É¤ì(€€€€€É•ÑÕÉ¸½­É½´€˜˜½­Q¼€˜˜½­]…É•¡½ÕÍ”€˜˜½­-•åİ½Éì(€€€ô¤ì(€ô°mµ…¥¹ÑÌ°™É½´°Ñ¼°İ…É•¡½ÕÍ”°­•åİ½É‘t¤ì((€½¹ÍĞ•ÑMÕÁÁ±ä€ô€¡´è5…¥¹Ğ¤€ôø9Õµ‰•È¡´¹ÍÕÁÁ±åQ½Ñ…°ñğ€¡´¹¥Ñ•µÌñğmt¤¹É•‘Õ” ¡ÍÕ´è¹Õµ‰•È°Èè…¹ä¤€ôøÍÕ´€¬9Õµ‰•È¡È¹ÍÕÁÁ±äñğ€À¤°€À¤¤ì(€½¹ÍĞ•ÑY…Ğ€ô€¡´è5…¥¹Ğ¤€ôø9Õµ‰•È¡´¹Ù…ÑQ½Ñ…°ñğ€¡´¹¥Ñ•µÌñğmt¤¹É•‘Õ” ¡ÍÕ´è¹Õµ‰•È°Èè…¹ä¤€ôøÍÕ´€¬9Õµ‰•È¡È¹Ù…Ğñğ€À¤°€À¤¤ì(€½¹ÍĞ•ÑQ½Ñ…°€ô€¡´è5…¥¹Ğ¤€ôø9Õµ‰•È¡´¹Ñ½Ñ…°ñğ´¹½ÍĞñğ€¡´¹¥Ñ•µÌñğmt¤¹É•‘Õ” ¡ÍÕ´è¹Õµ‰•È°Èè…¹ä¤€ôøÍÕ´€¬9Õµ‰•È¡È¹Ñ½Ñ…°ñğ€À¤°€À¤¤ì((€½¹ÍĞÍÕµµ…Éä€ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞÍÕÁÁ±ä€ô™¥±Ñ•É•¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬•ÑMÕÁÁ±ä¡´¤°€À¤ì(€€€½¹ÍĞÙ…Ğ€ô™¥±Ñ•É•¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬•ÑY…Ğ¡´¤°€À¤ì(€€€½¹ÍĞÑ½Ñ…°€ô™¥±Ñ•É•¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬•ÑQ½Ñ…°¡´¤°€À¤ì((€€€½¹ÍĞ‰å] €ô¹•Ü5…ÀñÍÑÉ¥¹œ°¹Õµ‰•Èø ¤ì(€€€™¥±Ñ•É•¹™½É…  ¡´¤€ôøì(€€€€€½¹ÍĞ¹…µ”€ô´¹İ…É•¡½ÕÍ”ñğ€‹®¾ã²²‚Tˆì(€€€€€‰å] ¹Í•Ğ¡¹…µ”°€¡‰å] ¹•Ğ¡¹…µ”¤ñğ€À¤€¬•ÑQ½Ñ…°¡´¤¤ì(€€€ô¤ì((€€€½¹ÍĞÑ½Á]…É•¡½ÕÍ”€ôÉÉ…ä¹™É½´¡‰å] ¹•¹ÑÉ¥•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôø‰lÅt€´…lÅt¥lÁtì((€€€É•ÑÕÉ¸ì(€€€€€½Õ¹Ğè™¥±Ñ•É•¹±•¹Ñ °(€€€€€ÍÕÁÁ±ä°(€€€€€Ù…Ğ°(€€€€€Ñ½Ñ…°°(€€€€€Ñ½Á]…É•¡½ÕÍ•9…µ”èÑ½Á]…É•¡½ÕÍ”ü¹lÁtñğ€ˆ´ˆ°(€€€€€Ñ½Á]…É•¡½ÕÍ•Q½Ñ…°èÑ½Á]…É•¡½ÕÍ”ü¹lÅtñğ€À°(€€€ôì(€ô°m™¥±Ñ•É•‘t¤ì((€½¹ÍĞ‰å]…É•¡½ÕÍ”€ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞµ…À€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ìİ…É•¡½ÕÍ”èÍÑÉ¥¹œì½Õ¹Ğè¹Õµ‰•ÈìÍÕÁÁ±äè¹Õµ‰•ÈìÙ…Ğè¹Õµ‰•ÈìÑ½Ñ…°è¹Õµ‰•Èôø ¤ì(€€€™¥±Ñ•É•¹™½É…  ¡´¤€ôøì(€€€€€½¹ÍĞ¹…µ”€ô´¹İ…É•¡½ÕÍ”ñğ€‹®¾ã²²‚Tˆì(€€€€€½¹ÍĞÕÈ€ôµ…À¹•Ğ¡¹…µ”¤ñğìİ…É•¡½ÕÍ”è¹…µ”°½Õ¹Ğè€À°ÍÕÁÁ±äè€À°Ù…Ğè€À°Ñ½Ñ…°è€Àôì(€€€€€ÕÈ¹½Õ¹Ğ€¬ô€Äì(€€€€€ÕÈ¹ÍÕÁÁ±ä€¬ô•ÑMÕÁÁ±ä¡´¤ì(€€€€€ÕÈ¹Ù…Ğ€¬ô•ÑY…Ğ¡´¤ì(€€€€€ÕÈ¹Ñ½Ñ…°€¬ô•ÑQ½Ñ…°¡´¤ì(€€€€€µ…À¹Í•Ğ¡¹…µ”°ÕÈ¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸ÉÉ…ä¹™É½´¡µ…À¹Ù…±Õ•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹Ñ½Ñ…°€´„¹Ñ½Ñ…°¤ì(€ô°m™¥±Ñ•É•‘t¤ì((€½¹ÍĞ‰å5½¹Ñ €ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞµ…À€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ìµ½¹Ñ èÍÑÉ¥¹œì½Õ¹Ğè¹Õµ‰•ÈìÑ½Ñ…°è¹Õµ‰•Èôø ¤ì(€€€™¥±Ñ•É•¹™½É…  ¡´¤€ôøì(€€€€€½¹ÍĞµ½¹Ñ €ô€¡´¹‘…Ñ”ñğ€‹®¾ã²²‚Tˆ¤¹Í±¥” À°€Ü¤ñğ€‹®¾ã²²‚Tˆì(€€€€€½¹ÍĞÕÈ€ôµ…À¹•Ğ¡µ½¹Ñ ¤ñğìµ½¹Ñ °½Õ¹Ğè€À°Ñ½Ñ…°è€Àôì(€€€€€ÕÈ¹½Õ¹Ğ€¬ô€Äì(€€€€€ÕÈ¹Ñ½Ñ…°€¬ô•ÑQ½Ñ…°¡´¤ì(€€€€€µ…À¹Í•Ğ¡µ½¹Ñ °ÕÈ¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸ÉÉ…ä¹™É½´¡µ…À¹Ù…±Õ•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹µ½¹Ñ ¹±½…±•½µÁ…É”¡„¹µ½¹Ñ ¤¤ì(€ô°m™¥±Ñ•É•‘t¤ì((€½¹ÍĞ‰å%Ñ•´€ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞµ…À€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ì¥Ñ•´èÍÑÉ¥¹œì½Õ¹Ğè¹Õµ‰•ÈìÅÑäè¹Õµ‰•ÈìÑ½Ñ…°è¹Õµ‰•Èôø ¤ì(€€€™¥±Ñ•É•¹™½É…  ¡´¤€ôøì(€€€€€€¡´¹¥Ñ•µÌñğmt¤¹™½É…  ¡Èè…¹ä¤€ôøì(€€€€€€€½¹ÍĞ¹…µ”€ôÈ¹¥Ñ•´ñğ€‹®¾ã²²‚Tˆì(€€€€€€€½¹ÍĞÕÈ€ôµ…À¹•Ğ¡¹…µ”¤ñğì¥Ñ•´è¹…µ”°½Õ¹Ğè€À°ÅÑäè€À°Ñ½Ñ…°è€Àôì(€€€€€€€ÕÈ¹½Õ¹Ğ€¬ô€Äì(€€€€€€€ÕÈ¹ÅÑä€¬ô9Õµ‰•È¡È¹ÅÑäñğ€À¤ì(€€€€€€€ÕÈ¹Ñ½Ñ…°€¬ô9Õµ‰•È¡È¹Ñ½Ñ…°ñğ€À¤ì(€€€€€€€µ…À¹Í•Ğ¡¹…µ”°ÕÈ¤ì(€€€€€ô¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸ÉÉ…ä¹™É½´¡µ…À¹Ù…±Õ•Ì ¤¤¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹Ñ½Ñ…°€´„¹Ñ½Ñ…°¤¹Í±¥” À°€ÈÀ¤ì(€ô°m™¥±Ñ•É•‘t¤ì((€½¹ÍĞÉ••¹Ğ€ôÕÍ•5•µ¼  ¤€ôøì(€€€É•ÑÕÉ¸l¸¸¹™¥±Ñ•É•‘t¹Í½ÉĞ ¡„°ˆ¤€ôøMÑÉ¥¹œ¡ˆ¹‘…Ñ”ñğ€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹‘…Ñ”ñğ€ˆˆ¤¤¤¹Í±¥” À°€ÈÀ¤ì(€ô°m™¥±Ñ•É•‘t¤ì((€É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…Éˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰•Ñİ••¸ˆøñ Èû²‚W®æ¶×ªÎğ½ Èøñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôø‘½İ¹±½…‘á•°¡ƒ²‚W®æ¶×ªÎ|‘íÑ½‘…åQ•áĞ ¥õ€°İ¥Ñ¡Q½Ñ…±I½Ü (€™¥±Ñ•É•¹µ…À ¡´¤€ôø€¡ìƒ²vó²z@è´¹‘…Ñ”°ƒ²Â÷ªÎ€è´¹İ…É•¡½ÕÍ”°ƒ²‚s®ª¤è´¹Ñ¥Ñ±”°ƒ®
Ó²j¤è´¹‘•Ñ…¥°°ƒ²zG²^²z@è´¹µ…¹…•È°ƒªÎ×ªâ'ªÂ²V„è•ÑMÕÁÁ±ä¡´¤°ƒ®ÚªÂ²àè•ÑY…Ğ¡´¤°ƒ¶V§ªÎè•ÑQ½Ñ…°¡´¤ô¤¤°(€ìƒ²vó²z@è€‹²Òw¶V§ªÎˆ°ƒªÎ×ªâ'ªÂ²V„è™¥±Ñ•É•¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬•ÑMÕÁÁ±ä¡´¤°€À¤°ƒ®ÚªÂ²àè™¥±Ñ•É•¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬•ÑY…Ğ¡´¤°€À¤°ƒ¶V§ªÎè™¥±Ñ•É•¹É•‘Õ” ¡ÍÕ´°´¤€ôøÍÕ´€¬•ÑQ½Ñ…°¡´¤°€À¤ô(¤¥ôû²^G² ƒ®.“²jÓ®†s®Npğ½‰ÕÑÑ½¸øğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥Ôˆø(€€€€€€€€ñ¥•±±…‰•°ô‹².s²zG²vğˆøñ…Ñ•%¹ÁÕĞÙ…±Õ”õí™É½µô½¹¡…¹”õíÍ•ÑÉ½µô€¼øğ½¥•±ø(€€€€€€€€ñ¥•±±…‰•°ô‹²Š®3²vğˆøñ…Ñ•%¹ÁÕĞÙ…±Õ”õíÑ½ô½¹¡…¹”õíÍ•ÑQ½ô€¼øğ½¥•±ø(€€€€€€€€ñ¥•±±…‰•°ô‹²Â÷ªÎ€ˆøñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹²Â÷ªÎ€ƒ²vó®Ú ƒªÊ²$ˆÙ…±Õ”õíİ…É•¡½ÕÍ•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ]…É•¡½ÕÍ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô€¼øğ½¥•±ø(€€€€€€€€ñ¥•±±…‰•°ô‹²‚s®ª¤¿®
Ó²j¤¿²zG²^²z@ˆøñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹ªÊ²'²ZĞƒ²z®‚”ˆÙ…±Õ”õí­•åİ½É‘ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ-•åİ½É¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô€¼øğ½¥•±ø(€€€€€€€€ñ¥•±±…‰•°ô‹²Ò#ªâÃ¶fPˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøìÍ•ÑÉ½´ ˆˆ¤ìÍ•ÑQ¼ ˆˆ¤ìÍ•Ñ]…É•¡½ÕÍ” ˆˆ¤ìÍ•Ñ-•åİ½É ˆˆ¤ìõôûªÊ²$ƒ²Ò#ªâÃ¶fPğ½‰ÕÑÑ½¸øğ½¥•±ø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÑ…ÑÕÌµ…É‘Ìˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²‚W®æªÆÓ²"`ğ½ÍÁ…¸øñˆùíÍÕµµ…Éä¹½Õ¹Ñ÷ªÆĞğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸ûªÎ×ªâ'ªÂ²V„ğ½ÍÁ…¸øñˆùíµ½¹•ä¡ÍÕµµ…Éä¹ÍÕÁÁ±ä¥÷²n@ğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û®ÚªÂ²àğ½ÍÁ…¸øñˆùíµ½¹•ä¡ÍÕµµ…Éä¹Ù…Ğ¥÷²n@ğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²Òtƒ²‚W®æ®æğ½ÍÁ…¸øñˆùíµ½¹•ä¡ÍÕµµ…Éä¹Ñ½Ñ…°¥÷²n@ğ½ˆøğ½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û²ÖsªÎ€ƒ²²Úpƒ²Â÷ªÎ€ğ½ÍÁ…¸øñˆùíÍÕµµ…Éä¹Ñ½Á]…É•¡½ÕÍ•9…µ•ôñ‰È€¼ùíµ½¹•ä¡ÍÕµµ…Éä¹Ñ½Á]…É•¡½ÕÍ•Q½Ñ…°¥÷²n@ğ½ˆøğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ Ìû²Â÷ªÎƒ®Îƒ²‚W®æ®æğ½ Ìø(€€€€€€ñMÉ½±±Q…‰±”ø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û²"s²rğ½Ñ øñÑ û²Â÷ªÎ€ğ½Ñ øñÑ û²‚W®æªÆÓ²"`ğ½Ñ øñÑ ûªÎ×ªâ'ªÂ²V„ğ½Ñ øñÑ û®ÚªÂ²àğ½Ñ øñÑ û¶V§ªÎğ½Ñ øğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€ì…‰å]…É•¡½ÕÍ”¹±•¹Ñ €ü€ñÑÈøñÑ½±MÁ…¸õìÙô±…ÍÍ9…µ”ô‰•µÁÑäˆû²†Ã¶j3®Bpƒ²Â÷ªÎƒ®Îƒ²‚W®æ®æƒ²^²v0ğ½Ñøğ½ÑÈø€è‰å]…É•¡½ÕÍ”¹µ…À ¡Ü°¤¤€ôø€ (€€€€€€€€€€€€€€ñÑÈ­•äõíÜ¹İ…É•¡½ÕÍ•ôø(€€€€€€€€€€€€€€€€ñÑùí¤€¬€Åôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùíÜ¹İ…É•¡½ÕÍ•ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùíÜ¹½Õ¹Ñôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğˆùíµ½¹•ä¡Ü¹ÍÕÁÁ±ä¥ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğˆùíµ½¹•ä¡Ü¹Ù…Ğ¥ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğ‰½±ˆùíµ½¹•ä¡Ü¹Ñ½Ñ…°¥ôğ½Ñø(€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€ğ½MÉ½±±Q…‰±”ø((€€€€€€ñ Ìû²nS®Îƒ²‚W®æ®æğ½ Ìø(€€€€€€ñMÉ½±±Q…‰±”ø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û²nPğ½Ñ øñÑ û²‚W®æªÆÓ²"`ğ½Ñ øñÑ û¶V§ªÎğ½Ñ øğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€ì…‰å5½¹Ñ ¹±•¹Ñ €ü€ñÑÈøñÑ½±MÁ…¸õìÍô±…ÍÍ9…µ”ô‰•µÁÑäˆû²†Ã¶j3®Bpƒ²nS®Îƒ²‚W®æ®æƒ²^²v0ğ½Ñøğ½ÑÈø€è‰å5½¹Ñ ¹µ…À ¡´¤€ôø€ (€€€€€€€€€€€€€€ñÑÈ­•äõí´¹µ½¹Ñ¡ôø(€€€€€€€€€€€€€€€€ñÑùí´¹µ½¹Ñ¡ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùí´¹½Õ¹Ñôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğ‰½±ˆùíµ½¹•ä¡´¹Ñ½Ñ…°¥ôğ½Ñø(€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€ğ½MÉ½±±Q…‰±”ø((€€€€€€ñ Ìû¶J#®ª§®Îƒ²
³²j§ªâ#²V„Q=@€ÈÀğ½ Ìø(€€€€€€ñMÉ½±±Q…‰±”ø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û²"s²rğ½Ñ øñÑ û¶J#®ª¤ğ½Ñ øñÑ û²
³²j§¶j²"`ğ½Ñ øñÑ û²"c®~'¶V§ªÎğ½Ñ øñÑ ûªâ#²V‡¶V§ªÎğ½Ñ øğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€ì…‰å%Ñ•´¹±•¹Ñ €ü€ñÑÈøñÑ½±MÁ…¸õìÕô±…ÍÍ9…µ”ô‰•µÁÑäˆû²†Ã¶j3®Bpƒ¶J#®ª¤ƒ²
³²j§®
Ó²^´ƒ²^²v0ğ½Ñøğ½ÑÈø€è‰å%Ñ•´¹µ…À ¡¥Ğ°¤¤€ôø€ (€€€€€€€€€€€€€€ñÑÈ­•äõí¥Ğ¹¥Ñ•µôø(€€€€€€€€€€€€€€€€ñÑùí¤€¬€Åôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùí¥Ğ¹¥Ñ•µôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùí¥Ğ¹½Õ¹Ñôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğˆùíµ½¹•ä¡¥Ğ¹ÅÑä¥ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğ‰½±ˆùíµ½¹•ä¡¥Ğ¹Ñ½Ñ…°¥ôğ½Ñø(€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€ğ½MÉ½±±Q…‰±”ø((€€€€€€ñ Ìû²ÖsªŞğƒ²‚W®æ®
Ó²^´ğ½ Ìø(€€€€€€ñMÉ½±±Q…‰±”ø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û²vó²z@ğ½Ñ øñÑ û²Â÷ªÎ€ğ½Ñ øñÑ û²‚s®ª¤ğ½Ñ øñÑ û®
Ó²j¤ğ½Ñ øñÑ û¶V§ªÎğ½Ñ øğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€ì…É••¹Ğ¹±•¹Ñ €ü€ñÑÈøñÑ½±MÁ…¸õìÕô±…ÍÍ9…µ”ô‰•µÁÑäˆû²ÖsªŞğƒ²‚W®æ®
Ó²^´ƒ²^²v0ğ½Ñøğ½ÑÈø€èÉ••¹Ğ¹µ…À ¡´¤€ôø€ (€€€€€€€€€€€€€€ñÑÈ­•äõí´¹¥‘ôø(€€€€€€€€€€€€€€€€ñÑùí´¹‘…Ñ”ñğ€ˆ´‰ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùí´¹İ…É•¡½ÕÍ”ñğ€ˆ´‰ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑùí´¹Ñ¥Ñ±”ñğ€ˆ´‰ôğ½Ñø(€€€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÍ9…µ”ô‰µ…¥¹Ğµ‘•Ñ…¥°µÑ•áĞˆùí´¹‘•Ñ…¥°ñğ€ˆ´‰ôğ½ÍÁ…¸øğ½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰É¥¡Ğ‰½±ˆùíµ½¹•ä¡•ÑQ½Ñ…°¡´¤¥ôğ½Ñø(€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€ğ½MÉ½±±Q…‰±”ø(€€€€ğ½Í•Ñ¥½¸ø(€€¤ì)ô(()™Õ¹Ñ¥½¸M¥µÁ±•Y•¹‘½ÉQ…‰±”¡ìÙ•¹‘½ÉÌ°‘•±•Ñ•Y•¹‘½È°•‘¥ÑY•¹‘½È°¥Í‘µ¥¸ôè…¹ä¤ì(€É•ÑÕÉ¸€ñMÉ½±±Q…‰±”øñÑ…‰±”øñÑ¡•…øñÑÈøñÑ û²öS®Npğ½Ñ øñÑ û²¶bàğ½Ñ øñÑ û®2¶Fs²z@ğ½Ñ øñÑ û²‚¶fS®Ê#¶bàğ½Ñ øñÑ û®ª£®ÂS²vğğ½Ñ øñÑ û²ó²0ğ½Ñ øñÑ ûªÒ®š°ğ½Ñ øğ½ÑÈøğ½Ñ¡•…øñÑ‰½‘äùíÙ•¹‘½ÉÌ¹µ…À ¡ØèY•¹‘½È¤€ôø€ñÑÈ­•äõíØ¹¥‘ôøñÑùíØ¹½‘•ôğ½ÑøñÑùíØ¹¹…µ•ôğ½ÑøñÑùíØ¹½İ¹•Èñğ€ˆ´‰ôğ½ÑøñÑùíØ¹Á¡½¹”ñğ€ˆ´‰ôğ½ÑøñÑùíØ¹µ½‰¥±”ñğ€ˆ´‰ôğ½ÑøñÑùímØ¹…‘‘É•ÍÌ°Ø¹…‘‘É•ÍÍ}‘•Ñ…¥±t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ ˆ€ˆ¤ñğ€ˆ´‰ôğ½ÑøñÑùí¥Í‘µ¥¸€ü€ğøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¥½¸ˆ½¹±¥¬õì ¤€ôø•‘¥ÑY•¹‘½È¡Ø¥ôøñA•¹¥°Í¥é”õìÄÙô€¼øğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¥½¸ˆ½¹±¥¬õì ¤€ôø‘•±•Ñ•Y•¹‘½È¡Ø¹¥¥ôøñQÉ…Í ÈÍ¥é”õìÄÙô€¼øğ½‰ÕÑÑ½¸øğ¼ø€è€ˆ´‰ôğ½Ñøğ½ÑÈø¥ôğ½Ñ‰½‘äøğ½Ñ…‰±”øğ½MÉ½±±Q…‰±”øì)ô((¼¨)5=	%1}59U}U%P)µ•¹Õ}Ù…±Õ•Ìõl‰Õ±­}ÑÉ…¹Í™•Èœ°€…É‘}ÍÑ…ÑÌœ°€…É‘}ÕÍ”œ°€¡½µ”œ°€¥Ñ•µÌœ°€±…å½ÕĞœ°€±¥ÍĞœ°€µ…¥¹Ñ}±¥ÍĞœ°€µ…¥¹Ñ}¹•Üœ°€µ…¥¹Ñ}ÍÑ…ÑÌœ°€µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìœ°€¹•Üœ°€Á•Éµ¥ÑÌœ°€É••¥ÁÑ}Á¡½Ñ½Ìœ°€ÍÑ…ÑÕÌœ°€ÕÁ‘…Ñ•}¡¥ÍÑ½Éäœ°€ÕÁ‘…Ñ•}¹½Ñ¥•Ìœ°€Ù•¹‘½É}…½Õ¹ÑÌœ°€Ù•¹‘½ÉÌœ°€İ…É•¡½ÕÍ•}É½ÕÁÌt)É•¹‘•É}Ù…±Õ•Ìõl‰Õ±­}ÑÉ…¹Í™•Èœ°€…É‘}ÍÑ…ÑÌœ°€…É‘}ÕÍ”œ°€¡½µ”œ°€¥Ñ•µÌœ°€±…å½ÕĞœ°€±¥ÍĞœ°€µ…¥¹Ñ}±¥ÍĞœ°€µ…¥¹Ñ}¹•Üœ°€µ…¥¹Ñ}ÍÑ…ÑÌœ°€µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìœ°€¹•Üœ°€Á•Éµ¥ÑÌœ°€É••¥ÁÑ}Á¡½Ñ½Ìœ°€ÍÑ…ÑÕÌœ°€ÕÁ‘…Ñ•}¡¥ÍÑ½Éäœ°€ÕÁ‘…Ñ•}¹½Ñ¥•Ìœ°€Ù•¹‘½É}…½Õ¹ÑÌœ°€Ù•¹‘½ÉÌœ°€İ…É•¡½ÕÍ•}É½ÕÁÌt)µ¥ÍÍ¥¹}É•¹‘•Èõmt)µ¥ÍÍ¥¹}µ•¹Ôõmt(¨¼()½¹ÍĞÍÌ€ô€(©í‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½áô)¡Ñµ°±‰½‘ä°É½½Ñíİ¥‘Ñ èÄÀÀ”íµ¥¸µ¡•¥¡ĞèÄÀÀ”íµ…É¥¸èÀíÁ…‘‘¥¹œèÁô)‰½‘åí™½¹Ğµ™…µ¥±äèµ…ÁÁ±”µÍåÍÑ•´±	±¥¹­5…MåÍÑ•µ½¹Ğ°ÁÁ±”M½Ñ¡¥Œ9•¼œ°9½Ñ¼M…¹Ì-Hœ°5…±Õ¸½Ñ¡¥Œœ±É¥…°±Í…¹ÌµÍ•É¥˜í‰…­É½Õ¹èŒÁ˜ÄÜÉ„í½±½ÈèŒÁ˜ÄÜÉ„í½Ù•É™±½Üµàé¡¥‘‘•¹ô)‰ÕÑÑ½¹í‰½É‘•ÈèÀí‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàíÁ…‘‘¥¹œèåÁà€ÄÑÁàíÕÉÍ½ÈéÁ½¥¹Ñ•Èí‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…ÀèÙÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí‰…­É½Õ¹è”É”á˜ÀíÑÉ…¹Í¥Ñ¥½¸é‰…­É½Õ¹µ½±½È€¸ÄÙÌ•…Í”±‰½É‘•Èµ½±½È€¸ÄÙÌ•…Í”±½Á…¥Ñä€¸ÄÙÌ•…Í”±‰½àµÍ¡…‘½Ü€¸ÄÙÌ•…Í•ô)‰ÕÑÑ½¸é¡½Ù•Éí™¥±Ñ•Èé‰É¥¡Ñ¹•ÍÌ ¸äØ¥ô)‰ÕÑÑ½¸é‘¥Í…‰±•‘íÕÉÍ½Èé¹½Ğµ…±±½İ•í½Á…¥Ñäè¸ÔÔí™¥±Ñ•Èé¹½¹”í‰½àµÍ¡…‘½Üé¹½¹•ô)‰ÕÑÑ½¸é‘¥Í…‰±•é¡½Ù•Éí™¥±Ñ•Èé¹½¹•ô)¥¹ÁÕĞ±Ñ•áÑ…É•„±Í•±•Ñíİ¥‘Ñ èÄÀÀ”í‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äí‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàíÁ…‘‘¥¹œèåÁàí‰…­É½Õ¹è™™˜í½±½ÈèŒÁ˜ÄÜÉ„í™½¹Ğé¥¹¡•É¥ĞíÑÉ…¹Í¥Ñ¥½¸é‰½É‘•Èµ½±½È€¸ÄÙÌ•…Í”±‰½àµÍ¡…‘½Ü€¸ÄÙÌ•…Í•ô)¥¹ÁÕĞé™½ÕÌ±Ñ•áÑ…É•„é™½ÕÌ±Í•±•Ğé™½ÕÍí½ÕÑ±¥¹”é¹½¹”í‰½É‘•Èµ½±½ÈèŒÍˆàÉ˜Øí‰½àµÍ¡…‘½ÜèÀ€À€À€ÍÁàÉ‰„ Ôä°ÄÌÀ°ÈĞØ°¸ÄÈ¥ô)¥¹ÁÕÑmÉ•…‘½¹±åt±Ñ•áÑ…É•…mÉ•…‘½¹±åuí‰…­É½Õ¹è˜á™…™Œí½±½ÈèŒĞÜÔÔØåô)±…‰•±í™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèÜÀÀí½±½ÈèŒÌÌĞÄÔÔí‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µ‰½ÑÑ½´èÙÁáô(¹É•ÅÕ¥É•µµ…É­í‘¥ÍÁ±…äé¥¹±¥¹”µ‰±½¬íµ…É¥¸µ±•™ĞèÑÁàí½±½Èè‘ŒÈØÈØí™½¹Ğµİ•¥¡ĞèäÀÁô(¹…ÁÁíİ¥‘Ñ èÄÀÀ”íµ¥¸µ¡•¥¡ĞèÄÀÁÙ íµ…É¥¸èÀíÁ…‘‘¥¹œèÈÑÁàí‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½áô(¹¡•É½íİ¥‘Ñ èÄÀÀ”í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ äÁ‘•œ°ŒÈÔØÍ•ˆ°ŒÑ˜ĞÙ”Ô¤í½±½Èè™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàíÁ…‘‘¥¹œèÈÙÁà€ÌÉÁàí‰½àµÍ¡…‘½ÜèÀ€ÈÁÁà€ÔÁÁàÉ‰„ À°À°À°¸ÈÔ¥ô(¹µ…¥¸µÑ¥Ñ±•íµ…É¥¸èÀíÑ•áĞµ…±¥¸é•¹Ñ•Èí™½¹ĞµÍ¥é”èĞÉÁàí™½¹Ğµİ•¥¡ĞèäÀÀí±•ÑÑ•ÈµÍÁ…¥¹œèÑÁàí½±½Èéİ¡¥Ñ”íÑ•áĞµÍ¡…‘½ÜèÀ€ÑÁà€ÄÑÁàÉ‰„ À°À°À°¸ÌÔ¥ô(¹¡•É¼Áíµ…É¥¸èÄÁÁà€À€Àí½±½Èè‘‰•…™”íÑ•áĞµ…±¥¸é•¹Ñ•Èí™½¹ĞµÍ¥é”èÄáÁàí™½¹Ğµİ•¥¡ĞèØÀÀí±•ÑÑ•ÈµÍÁ…¥¹œèÉÁáô(¹±½…‘¥¹í‰…­É½Õ¹è™•˜ÍŒÜí½±½ÈèŒäÈĞÀÁ”í‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàíÁ…‘‘¥¹œèÄÉÁà€ÄÙÁàíµ…É¥¸èÄÑÁà€Áô(¹…ÁÀµÑ½…ÍÑì(€Á½Í¥Ñ¥½¸é™¥á•ì(€Ñ½ÀèÈÉÁàì(€É¥¡ĞèÈÉÁàì(€èµ¥¹‘•àèÄÀÀÀÀÀÀì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼µ¥¹µ…à À°Å™È¤…ÕÑ¼ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÅÁàì(€İ¥‘Ñ éµ¥¸ ÌäÁÁà±…±Œ ÄÀÁÙÜ€´€ÌÉÁà¤¤ì(€µ¥¸µ¡•¥¡ĞèØáÁàì(€Á…‘‘¥¹œèÄÍÁà€ÄÑÁàì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‰½É‘•ÈèÅÁàÍ½±¥€‰‰˜İÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄİÁàì(€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸äà¤ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ÔÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸È¤°À€ÍÁà€ÄÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¤ì(€…¹¥µ…Ñ¥½¸é…ÁÁQ½…ÍÑ%¸€¸ÈÑÌ•…Í”µ½ÕĞì(€‰…­‘É½Àµ™¥±Ñ•Èé‰±ÕÈ ÄÉÁà¤ì)ô(¹…ÁÀµÑ½…ÍĞ¹¥¹™½í‰½É‘•Èµ½±½Èè‰™‘‰™•ô(¹…ÁÀµÑ½…ÍĞµ¥½¹ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€İ¥‘Ñ èĞÁÁàì(€¡•¥¡ĞèĞÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€‰…­É½Õ¹è‘™”Üì(€½±½ÈèŒÄÙ„ÌÑ„ì)ô(¹…ÁÀµÑ½…ÍĞ¹¥¹™¼€¹…ÁÀµÑ½…ÍĞµ¥½¹í‰…­É½Õ¹è‘‰•…™”í½±½ÈèŒÈÔØÍ•‰ô(¹…ÁÀµÑ½…ÍĞµ½Áåí‘¥ÍÁ±…äéÉ¥í…ÀèÍÁàíµ¥¸µİ¥‘Ñ èÁô(¹…ÁÀµÑ½…ÍĞµ½ÁäÍÑÉ½¹í™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀí½±½ÈèŒÄÔàÀÍ‘ô(¹…ÁÀµÑ½…ÍĞ¹¥¹™¼€¹…ÁÀµÑ½…ÍĞµ½ÁäÍÑÉ½¹í½±½ÈèŒÅÑ•áô(¹…ÁÀµÑ½…ÍĞµ½ÁäÍÁ…¹í™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèàÀÀí±¥¹”µ¡•¥¡ĞèÄ¸ĞÔí½±½ÈèŒÌÌĞÄÔÔíİ½Éµ‰É•…¬é­••Àµ…±±ô(¹…ÁÀµÑ½…ÍĞù‰ÕÑÑ½¹ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€İ¥‘Ñ èÌÁÁàì(€¡•¥¡ĞèÌÁÁàì(€µ¥¸µİ¥‘Ñ èÌÁÁàì(€Á…‘‘¥¹œèÀì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒØĞÜĞáˆì)ô(¹…ÁÀµÑ½…ÍĞù¥ì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€±•™ĞèÀì(€‰½ÑÑ½´èÀì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÍÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ äÁ‘•œ°ŒÄÙ„ÌÑ„°ŒÑ…‘”àÀ¤ì(€ÑÉ…¹Í™½É´µ½É¥¥¸é±•™Ğì(€…¹¥µ…Ñ¥½¸é…ÁÁQ½…ÍÑQ¥µ•È€Ì¸ÉÌ±¥¹•…È™½Éİ…É‘Ìì)ô(¹…ÁÀµÑ½…ÍĞ¹¥¹™¼ù¥í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ äÁ‘•œ°ŒÈÔØÍ•ˆ°ŒØÁ„Õ™„¥ô)­•å™É…µ•Ì…ÁÁQ½…ÍÑ%¹í™É½µí½Á…¥ÑäèÀíÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÄÁÁà¤Í…±” ¸äà¥õÑ½í½Á…¥ÑäèÄíÑÉ…¹Í™½É´é¹½¹•õô)­•å™É…µ•Ì…ÁÁQ½…ÍÑQ¥µ•Éí™É½µíÑÉ…¹Í™½É´éÍ…±•` Ä¥õÑ½íÑÉ…¹Í™½É´éÍ…±•` À¥õô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜÀÁÁà¥ì(€€¹…ÁÀµÑ½…ÍÑíÑ½ÀèÄÉÁàíÉ¥¡ĞèÄÉÁàíİ¥‘Ñ é…±Œ ÄÀÁÙÜ€´€ÈÑÁà¤íµ¥¸µ¡•¥¡ĞèØÑÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁáô)ô(¹µ•¹Õí‘¥ÍÁ±…äé™±•àí…ÀèÄÉÁàí‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÄÈ¤í‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàíÁ…‘‘¥¹œèÄÁÁàíµ…É¥¸èÄáÁà€Àíİ¥‘Ñ èÄÀÀ•ô(¹µ•¹Ôù‰ÕÑÑ½¸°¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¹í‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸Äà¤í½±½Èéİ¡¥Ñ•ô(¹µ•¹Ôù‰ÕÑÑ½¸¹…Ñ¥Ù•í‰…­É½Õ¹è™…ŒÄÔí½±½ÈèŒÄÄÄàÈİô(¹µ•¹ÔµÉ½ÕÁíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù•ô(¹ÍÕ‰í‘¥ÍÁ±…äé¹½¹”íÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÑ½ÀèÄÀÀ”í±•™ĞèÀíÁ…‘‘¥¹œµÑ½ÀèÙÁàíèµ¥¹‘•àèÄÀÁô(¹ÍÕˆ‰ÕÑÑ½¹í‘¥ÍÁ±…äé‰±½¬íİ¥‘Ñ èÄÔÁÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÀí‰…­É½Õ¹éİ¡¥Ñ”í½±½ÈèŒÄÄÄàÈÜíÑ•áĞµ…±¥¸é±•™Ñô(¹ÍÕˆ‰ÕÑÑ½¸é™¥ÉÍĞµ¡¥±‘í‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁà€ÄÁÁà€À€Áô(¹ÍÕˆ‰ÕÑÑ½¸é±…ÍĞµ¡¥±‘í‰½É‘•ÈµÉ…‘¥ÕÌèÀ€À€ÄÁÁà€ÄÁÁáô(¹µ•¹ÔµÉ½ÕÀé¡½Ù•È€¹ÍÕ‰í‘¥ÍÁ±…äé‰±½­ô(¹…É‘íİ¥‘Ñ èÄÀÀ”í‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸äĞ¤í‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàíÁ…‘‘¥¹œèÈÉÁàíµ…É¥¸µÑ½ÀèÄáÁàí‰½àµÍ¡…‘½ÜèÀ€ÈÁÁà€ÔÁÁàÉ‰„ À°À°À°¸È¥ô(¹…É Éíµ…É¥¸èÀ€À€ÄáÁàíÑ•áĞµ…±¥¸é•¹Ñ•Éô(¹É¥Éí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È°Å™È¤í…ÀèÄÑÁáô(¹É¥Íí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì°Å™È¤í…ÀèÄÑÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô(¹É¥Õí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ô°Å™È¤í…ÀèÄÑÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô(¹Ñİ½í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèÈÑÁáô(¹™¥•±‘íµ…É¥¸µ‰½ÑÑ½´èÄÉÁáô(¹Í•…É µİÉ…ÁíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù•ô(¹‘É½Á‘½İ¹íÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”í±•™ĞèÀíÉ¥¡ĞèÀíÑ½ÀèÄÀÀ”íèµ¥¹‘•àèäääääí‰…­É½Õ¹è™™˜í‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äí‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàí‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÌÁÁàÉ‰„ À°À°À°¸Äà¤íµ…àµ¡•¥¡ĞèÌÈÁÁàí½Ù•É™±½Üé…ÕÑ½ô(¹‘É½Á‘½İ¸µ¥Ñ•µíÁ…‘‘¥¹œèÄÁÁàíÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹‘É½Á‘½İ¸µ¥Ñ•´é¡½Ù•È°¹‘É½Á‘½İ¸µ¥Ñ•´¹­•å‰½…Éµ…Ñ¥Ù•í‰…­É½Õ¹è•…˜É™™ô(¹‘É½Á‘½İ¸µ•µÁÑåíÁ…‘‘¥¹œèÄÁÁàí½±½ÈèŒäÑ„Íˆáô(¹Ñ…‰±”µİÉ…Áí½Ù•É™±½ÜéÙ¥Í¥‰±”í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàíµ…É¥¸µÑ½ÀèÄÑÁáô(¹ÍÉ½±°µÑ…‰±•í½Ù•É™±½Üé…ÕÑ¼í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàíµ…É¥¸µÑ½ÀèÄÑÁàíµ…àµ¡•¥¡ĞèĞÈÁÁáô)Ñ…‰±•íİ¥‘Ñ èÄÀÀ”í‰½É‘•Èµ½±±…ÁÍ”é½±±…ÁÍ”í‰…­É½Õ¹éİ¡¥Ñ•ô)Ñ¡í‰…­É½Õ¹è”É”á˜ÀíÑ•áĞµ…±¥¸é±•™ĞíÁ…‘‘¥¹œèÄÁÁàíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô)Ñ‘í‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”É”á˜ÀíÁ…‘‘¥¹œèáÁàíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô)Ñ¥¹ÁÕÑí¡•¥¡ĞèÌÙÁáô(¹É¥¡ÑíÑ•áĞµ…±¥¸éÉ¥¡Ñô(¹‰½±‘í™½¹Ğµİ•¥¡ĞèàÀÁô(¹‰•Ñİ••¹í‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÙÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èíµ…É¥¸èÄÑÁà€Áô(¹Ñ½Ñ…±ÍíÑ•áĞµ…±¥¸éÉ¥¡Ñô(¹Ñ½Ñ…±Ì€¹‰¥í™½¹ĞµÍ¥é”èÈÁÁàí™½¹Ğµİ•¥¡ĞèàÀÀíµ…É¥¸µÑ½ÀèÕÁáô(¹…Ñ¥½¹Íí‘¥ÍÁ±…äé™±•àí…ÀèÄÁÁàíµ…É¥¸µÑ½ÀèÄÙÁáô(¹É¥¡Ğµ…Ñ¥½¹Íí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹‘ô(¹ÁÉ¥µ…Éåí‰…­É½Õ¹èŒÄÙ„ÌÑ„í½±½Èéİ¡¥Ñ•ô(¹ÁÉ¥µ…Éäé‘¥Í…‰±•‘í‰…­É½Õ¹èŒäÑ„Íˆàí½±½Èè˜á™…™ô(¹•¹ÑÉäµ…Ñ¥½¹ÍíÁ…‘‘¥¹œµÑ½ÀèÄÙÁàíµ…É¥¸µÑ½ÀèÈÁÁàí‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”É”á˜Áô(¹•¹ÑÉäµ…Ñ¥½¹Ì‰ÕÑÑ½¹íµ¥¸µİ¥‘Ñ èÄÈÁÁàí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Éô(¹µ…¥¹Ğµ‘•Ñ…¥°µ¥¹ÁÕÑíµ¥¸µ¡•¥¡ĞèÜáÁàí±¥¹”µ¡•¥¡ĞèÄ¸ÔíÉ•Í¥é”éÙ•ÉÑ¥…±ô(¹¥½¹íÁ…‘‘¥¹œèÙÁà€áÁàíµ…É¥¸µÉ¥¡ĞèÑÁáô(¹ÕÁ±½…‘í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…ÀèİÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•ÈíÁ…‘‘¥¹œèåÁà€ÄÑÁàí‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äí‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàí‰…­É½Õ¹è™™˜íÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹ÕÁ±½…¥¹ÁÕÑí‘¥ÍÁ±…äé¹½¹•ô(¹ÕÁ±½…¹ÕÁ±½…µ‰ÕÍåí‰…­É½Õ¹è˜Å˜Õ˜äí½±½ÈèŒØĞÜĞáˆíÕÉÍ½Èéİ…¥ĞíÁ½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹•ô(¹•µÁÑåíÑ•áĞµ…±¥¸é•¹Ñ•Èí½±½ÈèŒØĞÜĞáˆíÁ…‘‘¥¹œèÌÙÁáô(¹¡½µ”µ¥µí¡•¥¡ĞèØÈÁÁàí‰…­É½Õ¹è˜Å˜Õ˜äí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èí½Ù•É™±½Üé¡¥‘‘•¹ô(¹¡½µ”µ¥µœ¥µíİ¥‘Ñ èÄÀÀ”í¡•¥¡ĞèÄÀÀ”í½‰©•Ğµ™¥Ğé½¹Ñ…¥¹ô(¹¡½µ”µ‰ÕÑÑ½¹Íí‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èí…ÀèÄÙÁàíµ…É¥¸µÑ½ÀèÄáÁáô(¹µ½‘…°µ‰…­‘É½ÁíÁ½Í¥Ñ¥½¸é™¥á•í¥¹Í•ĞèÀí‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ØÔ¤í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èíèµ¥¹‘•àèäääääåô(¹µ½‘…°µ‰½áíİ¥‘Ñ éµ¥¸ ØÈÁÁà°äÉÙÜ¤í‰…­É½Õ¹éİ¡¥Ñ”í‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàíÁ…‘‘¥¹œèÈÑÁàí‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€àÁÁàÉ‰„ À°À°À°¸ÌÔ¥ô(¹µ½‘…°µ‰½à Éíµ…É¥¸èÀ€À€ÄáÁáô(¹ÍÑ…ÑÕÌµ…É‘Íí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ô°Å™È¤í…ÀèÄÑÁàíµ…É¥¸èÄÙÁà€Áô(¹ÍÑ…ÑÕÌµ…É‘Ì‘¥Ùí‰…­É½Õ¹è˜á™…™Œí‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàíÁ…‘‘¥¹œèÄÙÁáô(¹ÍÑ…ÑÕÌµ…É‘ÌÍÁ…¹í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÍÁàíµ…É¥¸µ‰½ÑÑ½´èáÁáô(¹ÍÑ…ÑÕÌµ…É‘Ì‰í™½¹ĞµÍ¥é”èÈÁÁáô((¹µ…¥¹Ğµ™¥±Ñ•Éí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄÜÁÁà€ÄÜÁÁà€ÈØÁÁà€Å™È€ÄÈÁÁàí…ÀèÄÉÁàí…±¥¸µ¥Ñ•µÌé•¹íµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô(¹µ…¥¹Ğµ™¥±Ñ•È€¹™¥•±‘íµ…É¥¸µ‰½ÑÑ½´èÁô(¹µ…¥¹Ğµ™¥±Ñ•È‰ÕÑÑ½¹í¡•¥¡ĞèĞÁÁàí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Éô(¹±¥¹¬µ‰Ñ¹ì(€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğì(€½±½ÈèŒÈÔØÍ•ˆì(€Ñ•áĞµ‘•½É…Ñ¥½¸éÕ¹‘•É±¥¹”ì(€Á…‘‘¥¹œèÀì(€‰½É‘•Èé¹½¹”ì(€™½¹Ğé¥¹¡•É¥Ğì(€™½¹Ğµİ•¥¡ĞèØÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹İ¥‘”µµ½‘…±íİ¥‘Ñ éµ¥¸ ÄÄÀÁÁà°äÑÙÜ¥ô((¹¥Ñ•´µÍ•…É¡í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€ÄÄÁÁàí…ÀèÄÉÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èíµ…É¥¸èÄÁÁà€À€ÄÙÁáô(¹¥Ñ•´µÍ•…É ÍÁ…¹í™½¹ĞµÍ¥é”èÄÍÁàí½±½ÈèŒØĞÜĞáˆíÑ•áĞµ…±¥¸éÉ¥¡Ñô()µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì¹µ…¥¹Ğµ™¥±Ñ•ÉíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éõô(((¹¥Ñ•´µÍ•…É¡í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€ÄÄÁÁàí…ÀèÄÉÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èíµ…É¥¸èÄÁÁà€À€ÄÙÁáô(¹¥Ñ•´µÍ•…É ÍÁ…¹í™½¹ĞµÍ¥é”èÄÍÁàí½±½ÈèŒØĞÜĞáˆíÑ•áĞµ…±¥¸éÉ¥¡Ñô()µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì¹É¥È°¹É¥Ì°¹É¥Ô°¹Ñİ¼°¹ÍÑ…ÑÕÌµ…É‘ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹µ•¹Õí™±•àµİÉ…ÀéİÉ…Áô¹¡½µ”µ¥µí¡•¥¡ĞèÌÈÁÁáõô(¼¨Ñ…‰±”…±¥¹µ•¹Ğ™¥à½¹±ä€¨¼)Ñ¡ì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€Ù•ÉÑ¥…°µ…±¥¸éµ¥‘‘±”ì)ô)Ñ‘ì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€Ù•ÉÑ¥…°µ…±¥¸éµ¥‘‘±”ì)ô)Ñ¹É¥¡Ğ°)Ñ ¹É¥¡Ğ°(¹É¥¡Ñì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô)Ñé±…ÍĞµ¡¥±°)Ñ é±…ÍĞµ¡¥±‘ì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô)Ñ€¹¥½¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì)ô(¹ÍÉ½±°µÑ…‰±”Ñ °(¹ÍÉ½±°µÑ…‰±”Ñ°(¹Ñ…‰±”µİÉ…ÀÑ °(¹Ñ…‰±”µİÉ…ÀÑ‘ì(€Á…‘‘¥¹œèÄÁÁà€áÁàì)ô((¹µ…¥¹Ğµ‘•Ñ…¥°µÑ•áÑì(€™½¹ĞµÍ¥é”èÄÑÁàì(€½±½ÈèŒØĞÜĞáˆì)ô((¹±½¥¸µÁ…•ì(€µ¥¸µ¡•¥¡ĞèÄÀÁÙ ì(€İ¥‘Ñ èÄÀÀ”ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€‰…­É½Õ¹è(€€€É…‘¥…°µÉ…‘¥•¹Ğ¡¥É±”…ĞÑ½À±•™Ğ°É‰„ ÌÜ°ää°ÈÌÔ°¸ÈÔ¤°ÑÉ…¹ÍÁ…É•¹Ğ€ÌÀ”¤°(€€€É…‘¥…°µÉ…‘¥•¹Ğ¡¥É±”…Ğ‰½ÑÑ½´É¥¡Ğ°É‰„ Üä°ÜÀ°ÈÈä°¸Äà¤°ÑÉ…¹ÍÁ…É•¹Ğ€ÌÔ”¤°(€€€±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÁ˜ÄÜÉ„€À”°ŒÄÄÄàÈÜ€ĞÔ”°ŒÅ”ÈäÍˆ€ÄÀÀ”¤ì(€Á…‘‘¥¹œèÈÑÁàì)ô((¹±½¥¸µ…É‘ì(€İ¥‘Ñ éµ¥¸ ĞÌÁÁà°äÕÙÜ¤ì(€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸äÜ¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈáÁàì(€Á…‘‘¥¹œèĞÉÁà€ÌÙÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÈÕÁà€àÁÁàÉ‰„ À°À°À°¸ĞÔ¤ì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€…ÀèÄÉÁàì(€‰½É‘•ÈèÅÁàÍ½±¥É‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸Ğ¤ì)ô((¹±½¥¸µ‰…‘•ì(€µ…É¥¸èÀ…ÕÑ¼€áÁàì(€Á…‘‘¥¹œèÙÁà€ÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œèÅÁàì)ô((¹±½¥¸µ…É Åì(€µ…É¥¸èÀì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€™½¹ĞµÍ¥é”èĞáÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œèÉÁàì(€½±½ÈèŒÄÄÄàÈÜì)ô((¹±½¥¸µ…ÉÁì(€µ…É¥¸èÀ€À€ÄáÁàì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÕÁàì(€™½¹Ğµİ•¥¡ĞèÜÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œèÅÁàì)ô((¹±½¥¸µ…É±…‰•±ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€½±½ÈèŒÌÌĞÄÔÔì(€µ…É¥¸µ‰½ÑÑ½´è´ÑÁàì)ô((¹±½¥¸µ…É¥¹ÁÕÑì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÔÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äì(€‰…­É½Õ¹è˜á™…™Œì(€Á…‘‘¥¹œèÀ€ÄÙÁàì(€™½¹ĞµÍ¥é”èÄÕÁàì(€ÑÉ…¹Í¥Ñ¥½¸è¸ÄÕÌì(€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì)ô((¹±½¥¸µ…É¥¹ÁÕĞé™½ÕÍì(€½ÕÑ±¥¹”é¹½¹”ì(€‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆì(€‰…­É½Õ¹éİ¡¥Ñ”ì(€‰½àµÍ¡…‘½ÜèÀ€À€À€ÑÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÄÈ¤ì)ô((¹±½¥¸µ‰ÕÑÑ½¹ì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÔÑÁàì(€‰½É‘•Èé¹½¹”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ äÁ‘•œ°ŒÈÔØÍ•ˆ°ŒÑ˜ĞÙ”Ô¤ì(€½±½Èéİ¡¥Ñ”ì(€™½¹ĞµÍ¥é”èÄÙÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€µ…É¥¸µÑ½ÀèáÁàì(€ÑÉ…¹Í¥Ñ¥½¸è¸ÄÕÌì)ô((¹±½¥¸µ‰ÕÑÑ½¸é¡½Ù•Éì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÅÁà¤ì(€‰½àµÍ¡…‘½ÜèÀ€ÄÑÁà€ÌÁÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸Èà¤ì)ô((¹±½¥¸µ•ÉÉ½Éì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèŒääÅˆÅˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€Á…‘‘¥¹œèÄÉÁàì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÜÀÀì)ô((¹ÕÍ•Èµ‰½áì(€µ…É¥¸µ±•™Ğé…ÕÑ¼ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèáÁàì)ô((¹ÕÍ•Èµ‰½àÍÁ…¹ì(€½±½Èè”É”á˜Àì(€™½¹ĞµÍ¥é”èÄÍÁàì)ô((¹ÕÍ•Èµ‰½à‰ÕÑÑ½¹ì(€‰…­É½Õ¹èŒÌÌĞÄÔÔì(€½±½Èéİ¡¥Ñ”ì)ô((¹‘…Í¡‰½…ÉµİÉ…Áì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€…ÀèÄáÁàì)ô(¹‘…Í¡‰½…ÉµÑ¥Ñ±”µÉ½İì(€‰…­É½Õ¹éİ¡¥Ñ”ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€Á…‘‘¥¹œèÈÁÁà€ÈÉÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÉÁà€ÄÁÁàÉ‰„ À°À°À°¸ÀÔ¤ì)ô(¹‘…Í¡‰½…ÉµÑ¥Ñ±”µÉ½Ü Éì(€µ…É¥¸èÀì(€™½¹ĞµÍ¥é”èÈÙÁàì)ô(¹‘…Í¡‰½…ÉµÑ¥Ñ±”µÉ½ÜÁì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèÜÀÀì)ô(¹‘…Í¡‰½…ÉµÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à ÈĞÁÁà°Å™È¤¤ì(€…ÀèÄÙÁàì)ô(¹‘…Í¡‰½…Éµ…É‘ì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€Á…‘‘¥¹œèÈÉÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÉÁà€ÄÁÁàÉ‰„ À°À°À°¸ÀÔ¤ì)ô(¹‘…Í¡‰½…Éµ…ÉÍÁ…¹ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô(¹‘…Í¡‰½…Éµ…É‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÄÉÁàì(€™½¹ĞµÍ¥é”èÌÁÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì)ô(¹‘…Í¡‰½…ÉµÑİ½ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€…ÀèÄáÁàì)ô(¹‘…Í¡‰½…ÉµÁ…¹•±ì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€Á…‘‘¥¹œèÄáÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÉÁà€ÄÁÁàÉ‰„ À°À°À°¸ÀÔ¤ì)ô(¹‘…Í¡‰½…ÉµÁ…¹•° Íì(€µ…É¥¸èÀ€À€ÄÑÁàì)ô(¹‘…Í¡‰½…ÉµÑ…‰±•ì(€İ¥‘Ñ èÄÀÀ”ì(€‰½É‘•Èµ½±±…ÁÍ”é½±±…ÁÍ”ì)ô(¹‘…Í¡‰½…ÉµÑ…‰±”Ñ¡ì(€‰…­É½Õ¹è•™˜Ù™˜ì(€Á…‘‘¥¹œèÄÁÁàì(€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€‘‰•…™”ì(€Ñ•áĞµ…±¥¸é±•™Ğì)ô(¹‘…Í¡‰½…ÉµÑ…‰±”Ñ‘ì(€Á…‘‘¥¹œèÄÁÁàì(€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€˜Å˜Õ˜äì)ô)µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‘…Í¡‰½…ÉµÑİ½ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô((¹‘…Ñ”µ½µ‰½ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€ĞÑÁàì(€…ÀèáÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì)ô(¹‘…Ñ”µ½µ‰¼¥¹ÁÕÑmÑåÁ”ô‰‘…Ñ”‰uì(€Á…‘‘¥¹œèÀì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€½±½ÈéÑÉ…¹ÍÁ…É•¹Ğì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹‘…Ñ”µ½µ‰¼¥¹ÁÕÑmÑåÁ”ô‰‘…Ñ”‰tèèµİ•‰­¥Ğµ…±•¹‘…ÈµÁ¥­•Èµ¥¹‘¥…Ñ½Éì(€½Á…¥ÑäèÄì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€İ¥‘Ñ èÈÉÁàì(€¡•¥¡ĞèÈÉÁàì(€µ…É¥¸é…ÕÑ¼ì)ô((¼¨€ôôôôô5½‰¥±”U$=ÁÑ¥µ¥é…Ñ¥½¸€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€€¹…ÁÁì(€€€Á…‘‘¥¹œèÄÑÁàì(€ô((€€¹¡•É½ì(€€€Á…‘‘¥¹œèÄáÁà€ÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô((€€¹µ…¥¸µÑ¥Ñ±•ì(€€€™½¹ĞµÍ¥é”èÈáÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Èì(€ô((€€¹¡•É¼Áì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€ô((€€¹µ•¹Õì(€€€‘¥ÍÁ±…äé™±•àì(€€€™±•àµİÉ…ÀéİÉ…Àì(€€€…ÀèáÁàì(€€€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€€€Á…‘‘¥¹œèÄÁÁàì(€€€Á½Í¥Ñ¥½¸éÍÑ¥­äì(€€€Ñ½ÀèÀì(€€€èµ¥¹‘•àèÔÀì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¤ì(€ô((€€¹µ•¹Ô€ø‰ÕÑÑ½¸°(€€¹µ•¹ÔµÉ½ÕÀ€ø‰ÕÑÑ½¸°(€€¹ÕÍ•Èµ‰½à‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€€€Á…‘‘¥¹œèÄÁÁà€ÄÍÁàì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€ô((€€¹µ•¹ÔµÉ½ÕÁì(€€€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì(€ô((€€¹µ•¹ÔµÉ½ÕÀ€¹ÍÕ‰ì(€€€µ¥¸µİ¥‘Ñ èÄÔÁÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€ô((€€¹µ•¹ÔµÉ½ÕÀ€¹ÍÕˆ‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€€€Á…‘‘¥¹œèÄÁÁà€ÄÉÁàì(€ô((€€¹ÕÍ•Èµ‰½áì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€‘¥ÍÁ±…äé™±•àì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…ÀèáÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€Á…‘‘¥¹œèáÁà€ÑÁà€Àì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€ô((€€¹…É‘ì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€€€µ…É¥¸µÑ½ÀèÄÑÁàì(€ô((€€¹…É Éì(€€€™½¹ĞµÍ¥é”èÈÉÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì(€ô((€€¹É¥Ì°(€€¹É¥Ô°(€€¹Ñİ¼°(€€¹‘…Í¡‰½…ÉµÑİ½ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô((€¥¹ÁÕĞ°(€Í•±•Ğ°(€Ñ•áÑ…É•„°(€‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€€€™½¹ĞµÍ¥é”èÄÙÁàì(€ô((€±…‰•±ì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€ô((€€¹…Ñ¥½¹Ì°(€€¹É¥¡Ğµ…Ñ¥½¹Ì°(€€¹‰•Ñİ••¹ì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì(€€€…ÀèÄÁÁàì(€ô((€€¹…Ñ¥½¹Ì‰ÕÑÑ½¸°(€€¹É¥¡Ğµ…Ñ¥½¹Ì‰ÕÑÑ½¸°(€€¹‰•Ñİ••¸‰ÕÑÑ½¸°(€€¹ÕÁ±½…‘ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€ô((€€¹Ñ…‰±”µİÉ…À°(€€¹ÍÉ½±°µÑ…‰±•ì(€€€½Ù•É™±½Üµàé…ÕÑ¼ì(€€€€µİ•‰­¥Ğµ½Ù•É™±½ÜµÍÉ½±±¥¹œéÑ½Õ ì(€ô((€Ñ…‰±•ì(€€€µ¥¸µİ¥‘Ñ èÜØÁÁàì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€ô((€Ñ °(€Ñ‘ì(€€€Á…‘‘¥¹œèåÁà€áÁàì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€ô((€€¹‘…Í¡‰½…ÉµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÉÁàì(€ô((€€¹‘…Í¡‰½…Éµ…É‘ì(€€€Á…‘‘¥¹œèÄáÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€ô((€€¹‘…Í¡‰½…Éµ…É‰ì(€€€™½¹ĞµÍ¥é”èÈÑÁàì(€ô((€€¹‘…Í¡‰½…ÉµÑ¥Ñ±”µÉ½İì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€ô((€€¹‘…Í¡‰½…ÉµÑ¥Ñ±”µÉ½Ü Éì(€€€™½¹ĞµÍ¥é”èÈÉÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁ…¹•±ì(€€€Á…‘‘¥¹œèÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€ô((€€¹‘…Ñ”µ½µ‰½ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€ĞáÁàì(€ô((€€¹Í•…É µİÉ…Áì(€€€µ¥¸µİ¥‘Ñ èÀì(€ô((€€¹‘É½Á‘½İ¹ì(€€€µ…àµ¡•¥¡ĞèÈØÁÁàì(€€€½Ù•É™±½Üé…ÕÑ¼ì(€ô((€€¹¡½µ”µ¥µœ¥µì(€€€µ…àµİ¥‘Ñ èÄÀÀ”ì(€€€¡•¥¡Ğé…ÕÑ¼ì(€ô((€€¹¡½µ”µ‰ÕÑÑ½¹Íì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€€€…ÀèÄÁÁàì(€ô((€€¹Ñ½Ñ…±Íì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèáÁàì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€ô((€€¹Ñ½Ñ…±Ì€¹‰¥ì(€€€™½¹ĞµÍ¥é”èÄáÁàì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€ÔÈÁÁà¥ì(€€¹…ÁÁì(€€€Á…‘‘¥¹œèÄÁÁàì(€ô((€€¹µ…¥¸µÑ¥Ñ±•ì(€€€™½¹ĞµÍ¥é”èÈÑÁàì(€ô((€€¹µ•¹Õì(€€€…ÀèÙÁàì(€€€Á…‘‘¥¹œèáÁàì(€ô((€€¹µ•¹Ô€ø‰ÕÑÑ½¸°(€€¹µ•¹ÔµÉ½ÕÀ€ø‰ÕÑÑ½¹ì(€€€™±•àèÄ€Ä…±Œ ÔÀ”€´€ÙÁà¤ì(€ô((€€¹…É‘ì(€€€Á…‘‘¥¹œèÄÍÁàì(€ô((€€¹…É Éì(€€€™½¹ĞµÍ¥é”èÈÁÁàì(€ô((€Ñ…‰±•ì(€€€µ¥¸µİ¥‘Ñ èØàÁÁàì(€ô((€€¹‘…Í¡‰½…Éµ…É‰ì(€€€™½¹ĞµÍ¥é”èÈÉÁàì(€ô)ô((¼¨€ôôôôô5½‰¥±”…Í¡‰½…É¥Ğ¥à€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€¡Ñµ°°(€‰½‘ä°(€€É½½Ñì(€€€µ…àµİ¥‘Ñ èÄÀÀ”ì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸ì(€ô((€€¹…ÁÁì(€€€µ…àµİ¥‘Ñ èÄÀÀ”ì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸ì(€€€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì(€ô((€€¹µ•¹Õì(€€€‰…­É½Õ¹è™™™™™˜ì(€€€½±½ÈèŒÄÄÄàÈÜì(€ô((€€¹µ•¹Ô€ø‰ÕÑÑ½¸°(€€¹µ•¹ÔµÉ½ÕÀ€ø‰ÕÑÑ½¹ì(€€€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è˜Å˜Õ˜äì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€ô((€€¹µ•¹Ô€ø‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€€€‰…­É½Õ¹è™…ŒÄÔì(€€€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÕÍ•Èµ‰½áì(€€€½±½ÈèŒÌÌĞÄÔÔì(€ô((€€¹‘…Í¡‰½…ÉµİÉ…À°(€€¹‘…Í¡‰½…ÉµÁ…¹•°°(€€¹‘…Í¡‰½…Éµ…É°(€€¹‘…Í¡‰½…ÉµÑ¥Ñ±”µÉ½İì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ…àµİ¥‘Ñ èÄÀÀ”ì(€€€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€ô((€€¹‘…Í¡‰½…ÉµÑ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ…‰±”µ±…å½ÕĞé™¥á•ì(€ô((€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñ °(€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñ‘ì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€€€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€Á…‘‘¥¹œèåÁà€ÙÁàì(€ô((€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñ é™¥ÉÍĞµ¡¥±°(€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñé™¥ÉÍĞµ¡¥±‘ì(€€€İ¥‘Ñ èàÙÁàì(€ô((€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñ é±…ÍĞµ¡¥±°(€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñé±…ÍĞµ¡¥±‘ì(€€€İ¥‘Ñ é…ÕÑ¼ì(€ô((€€¹ÍÉ½±°µÑ…‰±”Ñ…‰±”°(€€¹Ñ…‰±”µİÉ…ÀÑ…‰±•ì(€€€µ¥¸µİ¥‘Ñ èÜØÁÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁ…¹•° Íì(€€€™½¹ĞµÍ¥é”èÄáÁàì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°ì(€ô((€€¹‘…Í¡‰½…Éµ…É‰ì(€€€İ½Éµ‰É•…¬é‰É•…¬µ…±°ì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€ÔÈÁÁà¥ì(€€¹µ•¹Õì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô((€€¹µ•¹Ô€ø‰ÕÑÑ½¸°(€€¹µ•¹ÔµÉ½ÕÀ€ø‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€™±•àéÕ¹Í•Ğì(€ô((€€¹ÕÍ•Èµ‰½áì(€€€É¥µ½±Õµ¸èÄ€¼€´Äì(€ô((€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñ °(€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñ‘ì(€€€™½¹ĞµÍ¥é”èÄÄ¸ÕÁàì(€ô((€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñ é™¥ÉÍĞµ¡¥±°(€€¹‘…Í¡‰½…ÉµÑ…‰±”Ñé™¥ÉÍĞµ¡¥±‘ì(€€€İ¥‘Ñ èàÁÁàì(€ô((€€¹ÍÉ½±°µÑ…‰±”Ñ…‰±”°(€€¹Ñ…‰±”µİÉ…ÀÑ…‰±•ì(€€€µ¥¸µİ¥‘Ñ èÜÈÁÁàì(€ô)ô((¼¨€ôôôôô½µÁ…Ğ5½‰¥±”5•¹Ô€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€€¹µ•¹Õì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€™±•àµİÉ…Àé¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé…ÕÑ¼ì(€€€½Ù•É™±½ÜµäéÙ¥Í¥‰±”ì(€€€…ÀèÙÁàì(€€€Á…‘‘¥¹œèáÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€ÍÉ½±±‰…Èµİ¥‘Ñ é¹½¹”ì(€€€€µİ•‰­¥Ğµ½Ù•É™±½ÜµÍÉ½±±¥¹œéÑ½Õ ì(€ô((€€¹µ•¹Ôèèµİ•‰­¥ĞµÍÉ½±±‰…Éì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹µ•¹Ô€ø‰ÕÑÑ½¸°(€€¹µ•¹ÔµÉ½ÕÀ€ø‰ÕÑÑ½¹ì(€€€™±•àèÀ€À…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ é…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÌÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèÌÙÁàì(€€€Á…‘‘¥¹œèİÁà€ÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€ô((€€¹µ•¹ÔµÉ½ÕÁì(€€€™±•àèÀ€À…ÕÑ¼ì(€ô((€€¹µ•¹ÔµÉ½ÕÀ€¹ÍÕ‰ì(€€€Á½Í¥Ñ¥½¸é™¥á•ì(€€€Ñ½ÀèÄÌÉÁàì(€€€±•™ĞèÄÉÁàì(€€€É¥¡ĞèÄÉÁàì(€€€İ¥‘Ñ é…ÕÑ¼ì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€èµ¥¹‘•àèääääì(€€€‘¥ÍÁ±…äé¹½¹”ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€€€…ÀèáÁàì(€€€Á…‘‘¥¹œèÄÁÁàì(€€€‰…­É½Õ¹è™™™™™˜ì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÌÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Äà¤ì(€ô((€€¹µ•¹ÔµÉ½ÕÀé¡½Ù•È€¹ÍÕˆ°(€€¹µ•¹ÔµÉ½ÕÀé™½ÕÌµİ¥Ñ¡¥¸€¹ÍÕ‰ì(€€€‘¥ÍÁ±…äéÉ¥ì(€ô((€€¹µ•¹ÔµÉ½ÕÀ€¹ÍÕˆ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€ô((€€¹ÕÍ•Èµ‰½áì(€€€™±•àèÀ€À…ÕÑ¼ì(€€€İ¥‘Ñ é…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ éµ…àµ½¹Ñ•¹Ğì(€€€‘¥ÍÁ±…äé™±•àì(€€€…ÀèÙÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€Á…‘‘¥¹œèÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÕÍ•Èµ‰½àÍÁ…¹ì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹ÕÍ•Èµ‰½à‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÌÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèÌÙÁàì(€€€Á…‘‘¥¹œèİÁà€ÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€ÔÈÁÁà¥ì(€€¹µ•¹Õì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ•¹Ô€ø‰ÕÑÑ½¸°(€€¹µ•¹ÔµÉ½ÕÀ€ø‰ÕÑÑ½¹ì(€€€™±•àèÀ€À…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ•¹ÔµÉ½ÕÀ€¹ÍÕ‰ì(€€€Ñ½ÀèÄÈÉÁàì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô)ô((¼¨€ôôôôô5½‰¥±”	½ÑÑ½´9…Ù¥…Ñ¥½¸€ôôôôô€¨¼(¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ùì(€‘¥ÍÁ±…äé¹½¹”ì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ùì(€€€Á½Í¥Ñ¥½¸é™¥á•ì(€€€±•™ĞèÀì(€€€É¥¡ĞèÀì(€€€‰½ÑÑ½´èÀì(€€€¡•¥¡ĞèØÙÁàì(€€€‰…­É½Õ¹è™™™™™˜ì(€€€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”Õ”İ•ˆì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ô°Å™È¤ì(€€€…ÀèÙÁàì(€€€Á…‘‘¥¹œèİÁà€áÁàì(€€€èµ¥¹‘•àèäääääì(€€€‰½àµÍ¡…‘½ÜèÀ€´áÁà€ÌÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄÀ¤ì(€€€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¹ì(€€€‰½É‘•ÈèÀì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€™½¹Ğµİ•¥¡ĞèäÀÀì(€€€½±½ÈèŒÌÌĞÄÔÔì(€€€µ¥¸µ¡•¥¡ĞèĞáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÑÁà€ÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€€€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€€€½±½Èè™™™™™˜ì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¸é…Ñ¥Ù•ì(€€€ÑÉ…¹Í™½É´éÍ…±” ¸äÜ¤ì(€ô((€€¹…ÁÁì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èäÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ•¹Õì(€€€Á…‘‘¥¹œèİÁà€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÕÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ•¹Ô€ø‰ÕÑÑ½¸°(€€¹µ•¹ÔµÉ½ÕÀ€ø‰ÕÑÑ½¸°(€€¹ÕÍ•Èµ‰½à‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÌÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèÌÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÙÁà€ÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÕÍ•Èµ‰½áì(€€€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€ÔÈÁÁà¥ì(€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ùì(€€€¡•¥¡ĞèØÑÁàì(€€€Á…‘‘¥¹œèÙÁàì(€€€…ÀèÕÁàì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¹ì(€€€™½¹ĞµÍ¥é”èÄÄ¸ÕÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€ô((€€¹…ÁÁì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èàáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô±•…¹•È5½‰¥±”ÁÀ1…å½ÕĞ€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€€¹µ•¹Õì(€€€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹¡•É½ì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì(€€€Á…‘‘¥¹œèÈÉÁà€ÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¸µÑ¥Ñ±•ì(€€€™½¹ĞµÍ¥é”èÌÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±•ÑÑ•ÈµÍÁ…¥¹œèÅÁàì(€ô((€€¹¡•É¼Áì(€€€µ…É¥¸µÑ½ÀèÙÁàì(€€€™½¹ĞµÍ¥é”èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‘…Í¡‰½…ÉµÉ¥‘ì(€€€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‘…Í¡‰½…Éµ…É‘ì(€€€Á…‘‘¥¹œèÄáÁà€ÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèäÉÁàì(€€€‘¥ÍÁ±…äé™±•àì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‘…Í¡‰½…Éµ…ÉÍÁ…¹ì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µ‰½ÑÑ½´èáÁàì(€ô((€€¹‘…Í¡‰½…Éµ…É‰ì(€€€µ…É¥¸µÑ½ÀèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÈÙÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‘…Í¡‰½…ÉµÁ…¹•±ì(€€€Á…‘‘¥¹œèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‘…Í¡‰½…ÉµÁ…¹•° Íì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€€€™½¹ĞµÍ¥é”èÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ùì(€€€¡•¥¡ĞèØÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÙÁà€áÁà…±Œ ÙÁà€¬•¹Ø¡Í…™”µ…É•„µ¥¹Í•Ğµ‰½ÑÑ½´¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸äØ¤€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­‘É½Àµ™¥±Ñ•Èé‰±ÕÈ ÄÙÁà¤ì(€€€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”Õ”İ•ˆì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ô°Å™È¤ì(€€€…ÀèÙÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèĞáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèĞáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è˜á™…™Œ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒÌÌĞÄÔÔ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€€€‰…­É½Õ¹èŒÈÔØÍ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÄáÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈÔ¤ì(€ô((€€¹µ½‰¥±”µµ½É”µÍ¡••Ñì(€€€Á½Í¥Ñ¥½¸é™¥á•ì(€€€±•™ĞèÄÉÁàì(€€€É¥¡ĞèÄÉÁàì(€€€‰½ÑÑ½´èÜÙÁàì(€€€èµ¥¹‘•àèääääàì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€€€…ÀèáÁàì(€€€Á…‘‘¥¹œèÄÉÁàì(€€€‰…­É½Õ¹è™™™™™˜ì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ÔÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÈÈ¤ì(€ô((€€¹µ½‰¥±”µµ½É”µÍ¡••Ğ‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€€€‰½É‘•ÈèÀì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜Å˜Õ˜äì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€€€™½¹Ğµİ•¥¡ĞèäÀÀì(€ô((€€¹…ÁÁì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èàÙÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€ÔÈÁÁà¥ì(€€¹¡•É½ì(€€€Á…‘‘¥¹œèÈÁÁà€ÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¸µÑ¥Ñ±•ì(€€€™½¹ĞµÍ¥é”èÈáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‘…Í¡‰½…Éµ…É‘ì(€€€µ¥¸µ¡•¥¡ĞèàÙÁàì(€ô((€€¹‘…Í¡‰½…Éµ…É‰ì(€€€™½¹ĞµÍ¥é”èÈÑÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µµ½É”µÍ¡••Ñì(€€€‰½ÑÑ½´èÜÉÁàì(€ô)ô((¼¨€ôôôôô5½‰¥±”	½ÑÑ½´5•¹Ô•Ñ…¥°¥à€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¹ì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µµ½É”µÍ¡••Ñì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µµ½É”µÍ¡••Ğ‰ÕÑÑ½¹ì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€ÔÈÁÁà¥ì(€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¹ì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô(((¹…ÑÑ…¡µ•¹ĞµÍÕµµ…Éäµ‰ÕÑÑ½¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€…ÀèÙÁàì(€µ¥¸µİ¥‘Ñ èÜÉÁàì(€Á…‘‘¥¹œèÙÁà€åÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰•…™”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÅ”ĞÁ…˜ì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹…ÑÑ…¡µ•¹ĞµÍÕµµ…Éäµ‰ÕÑÑ½¸é¡½Ù•Éì(€‰…­É½Õ¹è‘‰•…™”ì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ‰…­‘É½Áì(€Á½Í¥Ñ¥½¸é™¥á•ì(€¥¹Í•ĞèÀì(€èµ¥¹‘•àèäääääì(€‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÔÔ¤ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€Á…‘‘¥¹œèÈÑÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµµ½‘…±ì(€İ¥‘Ñ éµ¥¸ àØÁÁà°€äÑÙÜ¤ì(€µ…àµ¡•¥¡ĞèàáÙ ì(€½Ù•É™±½Üé…ÕÑ¼ì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€äÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÌÔ¤ì(€Á…‘‘¥¹œèÈÉÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÙÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì(€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”Õ”İ•ˆì(€Á…‘‘¥¹œµ‰½ÑÑ½´èÄÑÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ¡•… Éì(€µ…É¥¸èÀ€À€ÙÁàì(€™½¹ĞµÍ¥é”èÈÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ¡•…Áì(€µ…É¥¸èÀì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•ÈµÍ•Ñ¥½¹ì(€µ…É¥¸µÑ½ÀèÄáÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•ÈµÍ•Ñ¥½¸ Íì(€µ…É¥¸èÀ€À€ÄÁÁàì(€™½¹ĞµÍ¥é”èÄÕÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€½±½ÈèŒÄÄÄàÈÜì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ¥µ…”µÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥±°°µ¥¹µ…à ÄÔÁÁà°€Å™È¤¤ì(€…ÀèÄÁÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ¥µ…”µÉ¥…ì(€‘¥ÍÁ±…äé‰±½¬ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‰…­É½Õ¹è˜á™…™Œì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ¥µ…”µÉ¥¥µì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÄÌÁÁàì(€½‰©•Ğµ™¥Ğé½Ù•Èì(€‘¥ÍÁ±…äé‰±½¬ì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ…Õ‘¥¼µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÁÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ…Õ‘¥½ì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰•…™”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è˜á™…™Œì(€Á…‘‘¥¹œèÄÉÁàì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèáÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ…Õ‘¥¼…Õ‘¥½ì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÌÙÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ…Õ‘¥¼„°(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ±¥¹¬µ±¥ÍĞ…ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€Ñ•áĞµ‘•½É…Ñ¥½¸é¹½¹”ì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ±¥¹¬µ±¥ÍÑì(€‘¥ÍÁ±…äé™±•àì(€™±•àµİÉ…ÀéİÉ…Àì(€…ÀèáÁàì)ô(¹…ÑÑ…¡µ•¹ĞµÙ¥•İ•Èµ±¥¹¬µ±¥ÍĞ…ì(€Á…‘‘¥¹œèåÁà€ÄÉÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰•…™”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µ…ÑÑ…¡µ•¹Ğµ‰½áì(€µ…É¥¸µÑ½ÀèÄÙÁàì(€Á…‘‘¥¹œèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è˜á™…™Œì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µ…ÑÑ…¡µ•¹Ğµ‰½à Íì(€µ…É¥¸èÀ€À€ÄÁÁàì(€™½¹ĞµÍ¥é”èÄÕÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¼¨€ôôôôô5½‰¥±”…É1¥ÍĞ€¬ÑÑ…¡µ•¹ĞAÉ•Ù¥•Ü€ôôôôô€¨¼(¹µ½‰¥±”µ…Éµ±¥ÍÑì(€‘¥ÍÁ±…äé¹½¹”ì)ô((¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€İ¥‘Ñ èÜÑÁàì(€¡•¥¡ĞèÜÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€Ñ•áĞµ‘•½É…Ñ¥½¸é¹½¹”ì)ô((¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü¥µì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÄÀÀ”ì(€½‰©•Ğµ™¥Ğé½Ù•Èì)ô((¹Á‘˜µÑ¡Õµ‰ì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÄÀÀ”ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€‰…­É½Õ¹è‘ŒÈØÈØì(€½±½Èè™™™™™˜ì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹™¥±”µÙ¥•Üµ‰Ñ¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€µ¥¸µ¡•¥¡ĞèÌÉÁàì(€Á…‘‘¥¹œèÙÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€½±½Èè™™™™™˜ì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€Ñ•áĞµ‘•½É…Ñ¥½¸é¹½¹”ì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€€¹…É€¹ÍÉ½±°µÑ…‰±•ì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹µ½‰¥±”µ…Éµ±¥ÍÑì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèÄÉÁàì(€€€µ…É¥¸µÑ½ÀèÄÉÁàì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ…É‘ì(€€€‰…­É½Õ¹è™™™™™˜ì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€€€Á…‘‘¥¹œèÄÕÁàì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèÄÍÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÈÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÜ¤ì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµÑ½Áì(€€€‘¥ÍÁ±…äé™±•àì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€…ÀèÄÉÁàì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµÑ½À‰ì(€€€™½¹ĞµÍ¥é”èÄÕÁàì(€€€½±½ÈèŒÄÄÄàÈÜì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµÑ½ÀÍÁ…¹ì(€€€™½¹ĞµÍ¥é”èÄÕÁàì(€€€™½¹Ğµİ•¥¡ĞèäÀÀì(€€€½±½ÈèŒÈÔØÍ•ˆì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘åì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèåÁàì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€€€½±½ÈèŒÄÄÄàÈÜì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘ä‘¥Ùì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèÑÁàì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘ä±…‰•±ì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€™½¹Ğµİ•¥¡ĞèäÀÀì(€€€½±½ÈèŒØĞÜĞáˆì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘äÁì(€€€µ…É¥¸èÀì(€€€İ½Éµ‰É•…¬é‰É•…¬µİ½Éì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ…ÑÑ…¡µ•¹Ñì(€€€‘¥ÍÁ±…äé™±•àì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€ô((€€¹µ½‰¥±”µ…Éµ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äé™±•àì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€€€…ÀèáÁàì(€ô((€€¹µ½‰¥±”µ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÌÙÁàì(€€€Á…‘‘¥¹œèİÁà€ÄÉÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€€€‰½É‘•ÈèÀì(€€€‰…­É½Õ¹è˜Å˜Õ˜äì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèäÀÀì(€ô((€€¹µ½‰¥±”µ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¸é±…ÍĞµ¡¥±‘ì(€€€‰…­É½Õ¹è™•”É”Èì(€€€½±½ÈèŒääÅˆÅˆì(€ô)ô((¼¨€ôôôôôA=ÕÑÁÕĞ€¬5Õ±Ñ¥Á±”5…¥¹Ñ•¹…¹”ÑÑ…¡µ•¹ÑÌ€ôôôôô€¨¼(¹…ÑÑ…¡µ•¹Ğµ¡¥ÁÍì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì)ô((¹…ÑÑ…¡µ•¹Ğµ¡¥ÁÌ…ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€µ¥¸µ¡•¥¡ĞèÌÑÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€Á…‘‘¥¹œèÙÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÅÑ•àì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€™½¹ĞµÍ¥é”èÄÍÁàì(€Ñ•áĞµ‘•½É…Ñ¥½¸é¹½¹”ì)ô((¹…ÑÑ…¡µ•¹Ğµ¡¥ÁÌÍÁ…¹ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹…ÑÑ…¡µ•¹ĞµÉ½ÕÁì(€‘¥ÍÁ±…äé™±•àì(€…ÀèÙÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì)ô((¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀµ¥Ñ•µì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì)ô((¹…ÑÑ…¡µ•¹ĞµÉ•µ½Ù”µ‰ÕÑÑ½¹ì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€Ñ½Àè´İÁàì(€É¥¡Ğè´İÁàì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€İ¥‘Ñ èÈÑÁàì(€¡•¥¡ĞèÈÑÁàì(€µ¥¸µİ¥‘Ñ èÈÑÁàì(€Á…‘‘¥¹œèÀì(€‰½É‘•ÈèÉÁàÍ½±¥€™™˜ì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘ŒÈØÈØì(€½±½Èè™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÉÁà€áÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÈÈ¤ì(€èµ¥¹‘•àèÈì)ô((¹…ÑÑ…¡µ•¹ĞµÉ•µ½Ù”µ‰ÕÑÑ½¸é¡½Ù•Éì(€‰…­É½Õ¹èˆäÅŒÅŒì)ô((¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€İ¥‘Ñ èÔÙÁàì(€¡•¥¡ĞèÔÙÁàì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÁì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€ô((€€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€€€İ¥‘Ñ èØÑÁàì(€€€¡•¥¡ĞèØÑÁàì(€ô)ô((¼¨€ôôôôôUÁ‘…Ñ”9½Ñ¥”A½ÁÕÀ€ôôôôô€¨¼(¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰…­‘É½Áì(€Á½Í¥Ñ¥½¸é™¥á•ì(€¥¹Í•ĞèÀì(€‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Ğà¤ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€Á…‘‘¥¹œèÄáÁàì(€èµ¥¹‘•àèÄÀÀÀÀÀì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÁì(€İ¥‘Ñ éµ¥¸ ÔÈÁÁà°€äÑÙÜ¤ì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€äÁÁàÉ‰„ À°À°À°¸ÌÔ¤ì(€Á…‘‘¥¹œèÈÉÁàì(€½±½ÈèŒÄÄÄàÈÜì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÙÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ¡•…ÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€Á…‘‘¥¹œèÕÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œè¸áÁàì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ¡•… Éì(€µ…É¥¸èáÁà€À€Àì(€™½¹ĞµÍ¥é”èÈÑÁàì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ¡•…‰ÕÑÑ½¹ì(€İ¥‘Ñ èÌÙÁàì(€¡•¥¡ĞèÌÙÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(((¹ÕÁ‘…Ñ”µÁ½ÁÕÀ±¥ì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÍÁàì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀ±¤ÍÑÉ½¹ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀ±¤ÍÁ…¹ì(€½±½ÈèŒÌÌĞÄÔÔì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀÕ±ì(€µ…É¥¸èÀì(€Á…‘‘¥¹œèÀ€À€À€ÈÁÁàì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèåÁàì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÕÁàì(€™½¹Ğµİ•¥¡ĞèÜÀÀì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰½ÑÑ½µì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÉÁàì(€µ…É¥¸µÑ½ÀèÈÁÁàì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰½ÑÑ½´±…‰•±ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèáÁàì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰½ÑÑ½´¥¹ÁÕÑì(€İ¥‘Ñ èÄİÁàì(€¡•¥¡ĞèÄİÁàì(€…•¹Ğµ½±½ÈèŒÈÔØÍ•ˆì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰½ÑÑ½´‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èäÙÁàì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ è€äÀÁÁà¥ì(€€¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰…­‘É½Áì(€€€…±¥¸µ¥Ñ•µÌé™±•àµ•¹ì(€€€Á…‘‘¥¹œèÄÉÁàì(€ô((€€¹ÕÁ‘…Ñ”µÁ½ÁÕÁì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁà€ÈÑÁà€ÄáÁà€ÄáÁàì(€€€Á…‘‘¥¹œèÈÁÁàì(€ô((€€¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ¡•… Éì(€€€™½¹ĞµÍ¥é”èÈÉÁàì(€ô((€€¹ÕÁ‘…Ñ”µÁ½ÁÕÀÕ±ì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€ô((€€¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰½ÑÑ½µì(€€€™±•àµ‘¥É•Ñ¥½¸éÉ½Üì(€ô)ô((¼¨€ôôôôô5Õ±Ñ¥Á±”…ÉI••¥ÁĞÑÑ…¡µ•¹ÑÌ€ôôôôô€¨¼(¹…ÑÑ…¡µ•¹Ğµ¡¥ÁÍì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì)ô((¹…ÑÑ…¡µ•¹Ğµ¡¥ÁÌ…ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€µ¥¸µ¡•¥¡ĞèÌÑÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€Á…‘‘¥¹œèÙÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÅÑ•àì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€™½¹ĞµÍ¥é”èÄÍÁàì(€Ñ•áĞµ‘•½É…Ñ¥½¸é¹½¹”ì)ô((¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€İ¥‘Ñ èÜÑÁàì(€¡•¥¡ĞèÜÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€Ñ•áĞµ‘•½É…Ñ¥½¸é¹½¹”ì)ô((¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü¥µì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÄÀÀ”ì(€½‰©•Ğµ™¥Ğé½Ù•Èì)ô((¹Á‘˜µÑ¡Õµ‰ì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÄÀÀ”ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€‰…­É½Õ¹è‘ŒÈØÈØì(€½±½Èè™™™™™˜ì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹…ÑÑ…¡µ•¹ĞµÉ½ÕÁì(€‘¥ÍÁ±…äé™±•àì(€…ÀèÙÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì)ô((¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€İ¥‘Ñ èÔÙÁàì(€¡•¥¡ĞèÔÙÁàì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÁì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€ô((€€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€€€İ¥‘Ñ èØÑÁàì(€€€¡•¥¡ĞèØÑÁàì(€ô)ô((¼¨€ôôôôôMÕÁ…‰…Í”AÉ½‘ÕÑ¥½¸1¥¹”!½ÑÍÁ½Ğ‘¥Ñ½È€ôôôôô€¨¼(¹±…å½ÕĞµµ…Áì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì(€İ¥‘Ñ èÄÀÀ”ì(€µ…É¥¸èÀ…ÕÑ¼ì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€½Ù•É™±½Üé¡¥‘‘•¸ì)ô((¹±…å½ÕĞµµ…À¥µì(€‘¥ÍÁ±…äé‰±½¬ì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡Ğé…ÕÑ¼ì)ô((¹±…å½ÕĞµ¡½ÑÍÁ½Ñì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” ´ÔÀ”°€´ÔÀ”¤ì(€‰½É‘•ÈèÉÁàÍ½±¥ÑÉ…¹ÍÁ…É•¹Ğì(€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğì(€½±½ÈèŒÄÄÄàÈÜì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€Á…‘‘¥¹œèÀì(€ÑÉ…¹Í¥Ñ¥½¸è¸ÄÕÌ•…Í”ì(€Ñ½Õ µ…Ñ¥½¸é¹½¹”ì(€ÕÍ•ÈµÍ•±•Ğé¹½¹”ì)ô((¹±…å½ÕĞµ¡½ÑÍÁ½ĞÍÁ…¹ì(€‘¥ÍÁ±…äé¹½¹”ì)ô((¹±…å½ÕĞµµ…À¹•‘¥Ñ¥¹œ€¹±…å½ÕĞµ¡½ÑÍÁ½ĞÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€±•™ĞèÔÀ”ì(€Ñ½ÀèÔÀ”ì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” ´ÔÀ”°€´ÔÀ”¤ì(€µ…àµİ¥‘Ñ èäØ”ì(€Á…‘‘¥¹œèÍÁà€İÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹èŒÁ˜ÄÜÉ„ì(€½±½Èè™™™™™˜ì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÄÔì(€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°ì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹”ì)ô((¹±…å½ÕĞµ¡½ÑÍÁ½Ğé¡½Ù•Éì(€‰…­É½Õ¹éÉ‰„ ÈĞÔ°ÄÔà°ÄÄ°¸ÄÀ¤ì(€‰½àµÍ¡…‘½ÜèÀ€À€À€ÑÁàÉ‰„ ÈĞÔ°ÄÔà°ÄÄ°¸Àà¤ì)ô((¹±…å½ÕĞµ¡½ÑÍÁ½Ğ¹Í•±•Ñ•‘ì(€‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆì(€‰…­É½Õ¹éÉ‰„ ÌÜ°ää°ÈÌÔ°¸Äà¤ì(€‰½àµÍ¡…‘½ÜèÀ€À€À€ÑÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÄØ¤ì)ô((¹±…å½ÕĞµ•‘¥Ğµ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì)ô((¹±…å½ÕĞµ•‘¥Ğµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèÌÙÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€Á…‘‘¥¹œèİÁà€ÄÅÁàì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹±…å½ÕĞµ•‘¥ĞµÕ¥‘•ì(€µ…É¥¸èÄÁÁà€À€ÄÑÁàì(€Á…‘‘¥¹œèÄÁÁà€ÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è™™™‰•ˆì(€½±½ÈèŒäÈĞÀÁ”ì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô((¹±…å½ÕĞµ•‘¥ĞµÕ¥‘”‰ì(€½±½ÈèŒÅÑ•àì(€µ…É¥¸èÀ€ÑÁàì)ô((¹±…å½ÕĞµ•‘¥ĞµÕ¥‘”ÍÑÉ½¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÙÁàì(€½±½ÈèŒÈÔØÍ•ˆì)ô((¹±…å½ÕĞµµ…À¹•‘¥Ñ¥¹ì(€½ÕÑ±¥¹”èÍÁà‘…Í¡•€˜Ôå”Áˆì(€½ÕÑ±¥¹”µ½™™Í•ĞèÑÁàì)ô((¹±…å½ÕĞµµ…À¹•‘¥Ñ¥¹œ€¹±…å½ÕĞµ¡½ÑÍÁ½Ñì(€ÕÉÍ½ÈéÉ…ˆì(€ÑÉ…¹Í¥Ñ¥½¸é¹½¹”ì(€‰½É‘•Èµ½±½ÈéÉ‰„ ÈĞÔ°ÄÔà°ÄÄ°¸àÈ¤ì(€‰…­É½Õ¹éÉ‰„ ÈĞÔ°ÄÔà°ÄÄ°¸ÄĞ¤ì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹±…å½ÕĞµ•‘¥Ğµ…Ñ¥½¹Íì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì°€Å™È¤ì(€€€…ÀèáÁàì(€ô((€€¹±…å½ÕĞµ•‘¥Ğµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€Á…‘‘¥¹œèİÁà€áÁàì(€ô((€€¹±…å½ÕĞµ•‘¥ĞµÕ¥‘•ì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô((€€¹±…å½ÕĞµ¡½ÑÍÁ½ĞÍÁ…¹ì(€€€™½¹ĞµÍ¥é”èáÁàì(€€€Á…‘‘¥¹œèÉÁà€ÑÁàì(€ô)ô((¼¨€ôôôôô!½ÑÍÁ½ĞM¥‘”I•Í¥é”!…¹‘±”€ôôôôô€¨¼(¹±…å½ÕĞµÉ•Í¥é”µ¡…¹‘±•ì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€É¥¡Ğè´áÁàì(€‰½ÑÑ½´è´áÁàì(€İ¥‘Ñ èÄáÁàì(€¡•¥¡ĞèÄáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€‰½É‘•ÈèÍÁàÍ½±¥€™™™™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÉÁà€ÄÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÌÔ¤ì(€ÕÉÍ½Èé¹İÍ”µÉ•Í¥é”ì(€Ñ½Õ µ…Ñ¥½¸é¹½¹”ì(€èµ¥¹‘•àèÄÀì)ô((¹±…å½ÕĞµÉ•Í¥é”µ¡…¹‘±”èé…™Ñ•Éì(€½¹Ñ•¹Ğèˆˆì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€±•™ĞèÔÀ”ì(€Ñ½ÀèÔÀ”ì(€İ¥‘Ñ èÙÁàì(€¡•¥¡ĞèÙÁàì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” ´ÔÀ”°€´ÔÀ”¤ì(€‰½É‘•ÈµÉ¥¡ĞèÉÁàÍ½±¥€™™˜ì(€‰½É‘•Èµ‰½ÑÑ½´èÉÁàÍ½±¥€™™˜ì)ô((¼¨€ôôôôôAI<9½Ñ¥”	½…É•Í¥¸€ôôôôô€¨¼(¹¹½Ñ¥”µÁÉ¼µİÉ…Áì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°€Ä¸ÈÉ™È¤µ¥¹µ…à ĞÌÁÁà°€¸å™È¤ì(€…ÀèÄáÁàì(€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞì)ô((¹¹½Ñ¥”µÁÉ¼µ±•™Ñì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì(€Á…‘‘¥¹œèÈáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€‰…­É½Õ¹è(€€€É…‘¥…°µÉ…‘¥•¹Ğ¡¥É±”…Ğ€äà”€Ø”°É‰„ ÈÔÀ°ÈÀĞ°ÈÄ°¸Äà¤°ÑÉ…¹ÍÁ…É•¹Ğ€ÈÀ”¤°(€€€±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°€™™™…˜À€À”°€™™™™™˜€ÜÈ”¤ì(€‰½É‘•ÈèÅÁàÍ½±¥É‰„ ÈÈØ°ÈÌÈ°ÈĞÀ°¸ä¤ì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ĞÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄØ¤ì(€½Ù•É™±½Üé¡¥‘‘•¸ì)ô((¹¹½Ñ¥”µÁÉ¼µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄáÁàì(€µ…É¥¸µ‰½ÑÑ½´èÈÁÁàì)ô((¹¹½Ñ¥”µÁÉ¼µ¡•… Éì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÌÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÀÕ•´ì)ô((¹¹½Ñ¥”µÁÉ¼µ¡•…Áì(€µ…É¥¸èİÁà€À€Àì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÕÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹¹½Ñ¥”µÁ¥¹ì(€İ¥‘Ñ èäÉÁàì(€µ¥¸µ¡•¥¡ĞèÜÑÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€ÑÉ…¹Í™½É´éÉ½Ñ…Ñ” Õ‘•œ¤ì(€‰…­É½Õ¹è™‘”Øá„ì(€½±½ÈèŒÜÄÍ˜ÄÈì(€‰½É‘•ÈµÉ…‘¥ÕÌèİÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Äà¤ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰Íì(€‘¥ÍÁ±…äé™±•àì(€…ÀèÄÁÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€µ…É¥¸µ‰½ÑÑ½´èÄİÁàì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰Ì‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èÜÙÁàì(€µ¥¸µ¡•¥¡ĞèÌáÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è™™™™™˜ì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔ¤ì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰Ì‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆì(€½±½Èè™™™™™˜ì)ô((¹¹½Ñ¥”µÁÉ¼µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÁÁàì)ô((¹¹½Ñ¥”µÁÉ¼µ¥Ñ•µì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèàÑÁà€Å™Èì(€…ÀèÄÉÁàì(€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì)ô((¹¹½Ñ¥”µÁÉ¼µ‘…Ñ•ì(€µ¥¸µ¡•¥¡ĞèÜÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÄÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¤ì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€Á…‘‘¥¹œèáÁà€ÙÁàì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì)ô((¹¹½Ñ¥”µÁÉ¼µ‘…Ñ”ÍÑÉ½¹ì(€½±½Èè•˜ĞĞĞĞì(€™½¹ĞµÍ¥é”èÄÍÁàì(€±¥¹”µ¡•¥¡ĞèÄì)ô((¹¹½Ñ¥”µÁÉ¼µ‘…Ñ”‰ì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄáÁàì(€±¥¹”µ¡•¥¡ĞèÄ¸Äì)ô((¹¹½Ñ¥”µÁÉ¼µ‘…Ñ”•µì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€É¥¡ĞèİÁàì(€‰½ÑÑ½´èÕÁàì(€½±½Èè•˜ĞĞĞĞì(€™½¹ĞµÍ¥é”èåÁàì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µ‰½‘åì(€µ¥¸µ¡•¥¡ĞèÜÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸äĞ¤ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€Á…‘‘¥¹œèÄÍÁà€ÄÕÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÕÁà€ÄÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔ¤ì)ô((¹¹½Ñ¥”µÁÉ¼µ‰…‘”µÉ½İì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€µ…É¥¸µ‰½ÑÑ½´èİÁàì)ô((¹¹½Ñ¥”µÁÉ¼µ‰…‘”µÉ½ÜÍÁ…¸°(¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½Ü‰ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€İ¥‘Ñ éµ…àµ½¹Ñ•¹Ğì(€Á…‘‘¥¹œèÑÁà€áÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è”Õ”İ•ˆì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µ‰…‘”µÉ½ÜÍÁ…¸¹¡½Ğ°(¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½Üˆ¹É•‘ì(€‰…­É½Õ¹è™•”É”Èì(€½±½Èè‘ŒÈØÈØì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½Üˆ¹É…åì(€‰…­É½Õ¹è”Õ”İ•ˆì(€½±½ÈèŒĞÜÔÔØäì)ô((¹¹½Ñ¥”µÁÉ¼µ‰½‘ä Íì(€µ…É¥¸èÀ€À€ÕÁàì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÈÔì)ô((¹¹½Ñ¥”µÁÉ¼µ‰½‘äÁì(€µ…É¥¸èÀì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÜÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔì)ô((¹¹½Ñ¥”µÁÉ¼µ‰½ÑÑ½µì(€µ…É¥¸µÑ½ÀèÄÑÁàì(€µ¥¸µ¡•¥¡ĞèÔÉÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÜÈ¤ì(€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µÉ¥¡Ñì(€Á…‘‘¥¹œèÈÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ĞÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄØ¤ì)ô((¹¹½Ñ¥”µÁÉ¼µ…‘µ¥¸µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÑÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹¹½Ñ¥”µÁÉ¼µ…‘µ¥¸µ¡•… Éì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µ…‘µ¥¸µ¡•…Íµ…±±ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µ…‘µ¥¸µ¡•…‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèÌáÁàì(€Á…‘‘¥¹œèáÁà€ÄÑÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µ…‘µ¥¸µ¡•…‰ÕÑÑ½¸¹ÁÉ¥µ…Éåì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€½±½Èè™™™™™˜ì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰±•ì(€‘¥ÍÁ±…äéÉ¥ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€½Ù•É™±½Üé¡¥‘‘•¸ì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µ¡•…°(¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½İì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄÈÁÁà€ÄÄÁÁà€Å™È€ÄÔÁÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰±”¹½µÁ…Ğ€¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µ¡•…°(¹¹½Ñ¥”µÁÉ¼µÑ…‰±”¹½µÁ…Ğ€¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½İì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄÈÁÁà€Å™È€ÄÔÁÁàì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µ¡•…‘ì(€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€‰…­É½Õ¹è˜á™…™Œì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µ¡•…ÍÁ…¸°(¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½ÜÍÁ…¹ì(€Á…‘‘¥¹œèÄÁÁà€ÄÉÁàì)ô((¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½İì(€µ¥¸µ¡•¥¡ĞèÔÑÁàì(€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”Õ”İ•ˆì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€…ÀèİÁàì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì)ô((¹¹½Ñ¥”µÁÉ¼µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èÔÑÁàì(€µ¥¸µ¡•¥¡ĞèÌÉÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèåÁàì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€½±½Èè™™™™™˜ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹¹½Ñ¥”µÁÉ¼µ…Ñ¥½¹Ì‰ÕÑÑ½¸¹‘…¹•Éì(€‰…­É½Õ¹è•˜ĞĞĞĞì)ô((¹¹½Ñ¥”µÁÉ¼µÑ¥Áì(€µ…É¥¸µÑ½ÀèÄáÁàì(€Á…‘‘¥¹œèÄÙÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°€™•˜ÍŒÜ°€™‘”Øá„¤ì(€½±½ÈèŒÜàÌÔÁ˜ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÄáÁàÉ‰„ ÈĞÔ°ÄÔà°ÄÄ°¸ÄÔ¤ì)ô((¹¹½Ñ¥”µÁÉ¼µÑ¥À‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µ‰½ÑÑ½´èáÁàì)ô((¹¹½Ñ¥”µÁÉ¼µÑ¥ÀÁì(€µ…É¥¸èÕÁà€Àì(€±¥¹”µ¡•¥¡ĞèÄ¸Ôì)ô((¹¹½Ñ¥”µ™½É´µÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÈÈÁÁà€Å™Èì(€…ÀèÄÉÁàì)ô((¹¹½Ñ¥”µÁÉ¼µ•µÁÑåì(€Á…‘‘¥¹œèÈÑÁàì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÄàÁÁà¥ì(€€¹¹½Ñ¥”µÁÉ¼µİÉ…Áì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹¹½Ñ¥”µÁÉ¼µİÉ…Áì(€€€…ÀèÄÉÁàì(€ô((€€¹¹½Ñ¥”µÁÉ¼µ±•™Ğ°(€€¹¹½Ñ¥”µÁÉ¼µÉ¥¡Ñì(€€€Á…‘‘¥¹œèÄáÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€ô((€€¹¹½Ñ¥”µÁÉ¼µ¡•…°(€€¹¹½Ñ¥”µÁÉ¼µ…‘µ¥¸µ¡•…‘ì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì(€ô((€€¹¹½Ñ¥”µÁ¥¹ì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹¹½Ñ¥”µÁÉ¼µ¡•… Éì(€€€™½¹ĞµÍ¥é”èÈÑÁàì(€ô((€€¹¹½Ñ¥”µÁÉ¼µ¥Ñ•µì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÜÁÁà€Å™Èì(€€€…ÀèåÁàì(€ô((€€¹¹½Ñ¥”µÁÉ¼µ‰½‘äÁì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹¹½Ñ¥”µÁÉ¼µÑ…‰±•ì(€€€‰½É‘•ÈèÀì(€€€…ÀèáÁàì(€ô((€€¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µ¡•…‘ì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½Ü°(€€¹¹½Ñ¥”µÁÉ¼µÑ…‰±”¹½µÁ…Ğ€¹¹½Ñ¥”µÁÉ¼µÑ…‰±”µÉ½İì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€ô((€€¹¹½Ñ¥”µÁÉ¼µ…Ñ¥½¹Íì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€€€Á…‘‘¥¹œèÀ€ÄÉÁà€ÄÉÁàì(€ô((€€¹¹½Ñ¥”µ™½É´µÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô((¼¨€ôôôôô9½Ñ¥”A…”¥àèÙ¥•Üµ½¹±ä…¹É•…‘…‰±”€ôôôôô€¨¼(¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±åì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ±•™Ñì(€µ…àµİ¥‘Ñ é¹½¹”ì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘åì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÑÁàì(€µ¥¸µ¡•¥¡ĞèÜÉÁàì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰…‘”µÉ½İì(€µ…É¥¸èÀì(€™±•àèÀ€À…ÕÑ¼ì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘ä Íì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔì(€Ñ•áĞµ…±¥¸é±•™Ğì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ¥Ñ•µì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèàÙÁà€Å™Èì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘åì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèİÁàì(€ô((€€¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘ä Íì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€ô)ô((¼¨€ôôôôô9½Ñ¥”…±¥¹µ•¹Ğ¡½Ñ™¥à€ôôôôô€¨¼(¹¹½Ñ¥”µÁÉ¼µ±¥ÍÑì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô((¹¹½Ñ¥”µÁÉ¼µ¥Ñ•µì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì)ô((¹¹½Ñ¥”µÁÉ¼µ‰½‘åì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹¹½Ñ¥”µÁÉ¼µ‰…‘”µÉ½İì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€™±•àèÀ€À…ÕÑ¼ì)ô((¹¹½Ñ¥”µÁÉ¼µ‰½‘ä Íì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€™±•àèÄì(€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄİÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔ€…¥µÁ½ÉÑ…¹Ğì(€±•ÑÑ•ÈµÍÁ…¥¹œè´À¸ÀÉ•´ì)ô((¹¹½Ñ¥”µÁÉ¼µ‘…Ñ•ì(€™±•àµÍ¡É¥¹¬èÀì)ô((¹¹½Ñ¥”µÁÉ¼µ•µÁÑåì(€µ¥¸µ¡•¥¡ĞèÄØÁÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹¹½Ñ¥”µÁÉ¼µ‰½‘åì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèİÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹¹½Ñ¥”µÁÉ¼µ‰½‘ä Íì(€€€™½¹ĞµÍ¥é”èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô9½Ñ¥”ÉÉ½È5•ÍÍ…”€ôôôôô€¨¼(¹¹½Ñ¥”µÁÉ¼µ•ÉÉ½Éì(€µ…É¥¸èÀ€À€ÄÉÁàì(€Á…‘‘¥¹œèÄÉÁà€ÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèŒääÅˆÅˆì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€‰½É‘•ÈèÅÁàÍ½±¥€™•…„ì)ô((¼¨€ôôôôô9½Ñ¥”ÕÑ¼Må¹Œ€¬±¥¹µ•¹ĞA½±¥Í €ôôôôô€¨¼(¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ±•™Ñì(€Á…‘‘¥¹œèÈÑÁà€ÈáÁàì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÁÁàì(€µ…É¥¸µÑ½ÀèÄÙÁàì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ¥Ñ•µì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèàÉÁà€Å™Èì(€…ÀèÄÉÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‘…Ñ•ì(€µ¥¸µ¡•¥¡ĞèØÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘åì(€µ¥¸µ¡•¥¡ĞèØÑÁàì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÄÉÁà€ÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞ¤ì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰…‘”µÉ½İì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€™±•àèÀ€À…ÕÑ¼ì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘ä Íì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€™±•àèÄì(€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔ€…¥µÁ½ÉÑ…¹Ğì(€±•ÑÑ•ÈµÍÁ…¥¹œè´À¸ÀÉ•´ì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘äÁì(€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì)ô((¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ•µÁÑåì(€µ¥¸µ¡•¥¡ĞèÄÔÁÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ±•™Ñì(€€€Á…‘‘¥¹œèÄáÁàì(€ô((€€¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ¥Ñ•µì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÜÁÁà€Å™Èì(€€€…ÀèåÁàì(€ô((€€¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘åì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèİÁà€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹¹½Ñ¥”µÁÉ¼µİÉ…À¹¹½Ñ¥”µ½¹±ä€¹¹½Ñ¥”µÁÉ¼µ‰½‘ä Íì(€€€™½¹ĞµÍ¥é”èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôôA•Éµ¥ĞI•¹•İ…°5…¹…•µ•¹Ğ±•…¸U$€ôôôôô€¨¼(¹Á•Éµ¥ĞµÁ…•ì(€Á…‘‘¥¹œèÈÙÁàì)ô((¹Á•Éµ¥Ğµ¡•…‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼…ÕÑ¼ì(€…ÀèÄÑÁàì(€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹Á•Éµ¥Ğµ¡•… Éì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Á•Éµ¥Ğµ¡•…Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Á•Éµ¥ĞµÍÕµµ…Éåì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì)ô((¹Á•Éµ¥ĞµÍÕµµ…ÉäÍÁ…¹ì(€µ¥¸µ¡•¥¡ĞèÌáÁàì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÙÁàì(€Á…‘‘¥¹œèáÁà€ÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹Á•Éµ¥ĞµÍÕµµ…Éä‰ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÙÁàì)ô((¹Á•Éµ¥ĞµÁ…”€¹É¥Ô°(¹Á•Éµ¥ĞµÁ…”€¹É¥Íì(€…ÀèÄÉÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì)ô((¹Á•Éµ¥ĞµÁ…”€¹É¥¡Ğµ…Ñ¥½¹Íì(€µ…É¥¸èÄÑÁà€À€ÄáÁàì)ô((¹‘…¹•ÈµÑ•áÑì(€½±½Èè‘ŒÈØÈØì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹İ…É¸µÑ•áÑì(€½±½ÈèäÜÜÀØì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Á•Éµ¥ĞµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€‘¥ÍÁ±…äé¹½¹”ì)ô((¹Á•Éµ¥Ğµ…Éµ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È°µ¥¹µ…à À°€Å™È¤¤ì(€…ÀèÄÉÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô((¹Á•Éµ¥Ğµ…É‘ì(€Á…‘‘¥¹œèÄÙÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÄáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹Á•Éµ¥Ğµ…Éµµ…¥¹ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄÑÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô((¹Á•Éµ¥ĞµÑ¥Ñ±”µ…É•…ì(€µ¥¸µİ¥‘Ñ èÀì)ô((¹Á•Éµ¥Ğµ½µÁ…¹åì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€İ¥‘Ñ éµ…àµ½¹Ñ•¹Ğì(€µ…àµİ¥‘Ñ èÄÀÀ”ì(€Á…‘‘¥¹œèÑÁà€åÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€µ…É¥¸µ‰½ÑÑ½´èáÁàì)ô((¹Á•Éµ¥ĞµÑ¥Ñ±”µ…É•„‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄİÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì(€İ½Éµ‰É•…¬é­••Àµ…±°ì)ô((¹Á•Éµ¥ĞµÑ¥Ñ±”µ…É•„Áì(€µ…É¥¸èÕÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Á•Éµ¥Ğµ‘‘…äµ‰½áì(€µ¥¸µİ¥‘Ñ èäÑÁàì(€‘¥ÍÁ±…äéÉ¥ì(€©ÕÍÑ¥™äµ¥Ñ•µÌé•¹ì(€…ÀèÕÁàì)ô((¹Á•Éµ¥Ğµ‘‘…äµ‰½àÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€µ¥¸µİ¥‘Ñ èØáÁàì(€Á…‘‘¥¹œèİÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘™”Üì(€½±½ÈèŒÄØØÔÌĞì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Á•Éµ¥Ğµ‘‘…äµ‰½àÍÁ…¸¹İ…É¹ì(€‰…­É½Õ¹è™•˜ÍŒÜì(€½±½ÈèŒäÈĞÀÁ”ì)ô((¹Á•Éµ¥Ğµ‘‘…äµ‰½àÍÁ…¸¹‘…¹•Éì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèŒääÅˆÅˆì)ô((¹Á•Éµ¥Ğµ‘‘…äµ‰½àÍµ…±±ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹Á•Éµ¥Ğµ¥¹™¼µÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È°µ¥¹µ…à À°€Å™È¤¤ì(€…ÀèáÁàì(€Á…‘‘¥¹œèÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€••˜É˜Üì)ô((¹Á•Éµ¥Ğµ¥¹™¼µÉ¥±…‰•±ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µ‰½ÑÑ½´èÑÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Á•Éµ¥Ğµ¥¹™¼µÉ¥Áì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì(€İ½Éµ‰É•…¬é‰É•…¬µİ½Éì)ô((¹Á•Éµ¥Ğµµ•µ½ì(€µ…É¥¸µÑ½ÀèÄÁÁàì(€Á…‘‘¥¹œèÄÁÁà€ÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è™™™‰•ˆì(€½±½ÈèŒäÈĞÀÁ”ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸Ğì)ô((¹Á•Éµ¥Ğµ…Éµ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÉÁàì)ô((¹Á•Éµ¥Ğµ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèÌÑÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€Á…‘‘¥¹œèİÁà€ÄÉÁàì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€½±½Èè™™™™™˜ì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹Á•Éµ¥Ğµ…Éµ…Ñ¥½¹Ì€¹‘…¹•Èµ‰Ñ¹ì(€‰…­É½Õ¹è•˜ĞĞĞĞì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì(€€¹Á•Éµ¥Ğµ¡•…‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô((€€¹Á•Éµ¥ĞµÍÕµµ…Éåì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€ô((€€¹Á•Éµ¥Ğµ…Éµ±¥ÍÑì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹Á•Éµ¥ĞµÁ…•ì(€€€Á…‘‘¥¹œèÄáÁàì(€ô((€€¹Á•Éµ¥Ğµ…É‘ì(€€€Á…‘‘¥¹œèÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€ô((€€¹Á•Éµ¥Ğµ…Éµµ…¥¹ì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€ô((€€¹Á•Éµ¥Ğµ‘‘…äµ‰½áì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€‘¥ÍÁ±…äé™±•àì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€ô((€€¹Á•Éµ¥Ğµ¥¹™¼µÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô((¼¨€ôôôôôA•Éµ¥Ğ½µÁ…¹ä¥±Ñ•ÈQ…‰Ì€ôôôôô€¨¼(¹Á•Éµ¥Ğµ½µÁ…¹äµÑ…‰Íì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì)ô((¹Á•Éµ¥Ğµ½µÁ…¹äµÑ…‰Ì‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èØÑÁàì(€µ¥¸µ¡•¥¡ĞèÌáÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è™™™™™˜ì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞ¤ì)ô((¹Á•Éµ¥Ğµ½µÁ…¹äµÑ…‰Ì‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€‰…­É½Õ¹è™…ŒÄÔì(€‰½É‘•Èµ½±½Èè™…ŒÄÔì(€½±½ÈèŒÄÄÄàÈÜì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì(€€¹Á•Éµ¥Ğµ½µÁ…¹äµÑ…‰Íì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹Á•Éµ¥Ğµ½µÁ…¹äµÑ…‰Íì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì°€Å™È¤ì(€ô((€€¹Á•Éµ¥Ğµ½µÁ…¹äµÑ…‰Ì‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€ô)ô((¼¨€ôôôôô	Õ±¬QÉ…¹Í™•ÈA…”€ôôôôô€¨¼(¹‰Õ±¬µÑÉ…¹Í™•ÈµÁ…•ì(€Á…‘‘¥¹œèÈÙÁàì)ô((¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄÑÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•… Éì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•…Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹‰Õ±¬µÑÉ…¹Í™•Èµ™¥±Ñ•Éì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄàÁÁà€ÈØÁÁà€Å™È…ÕÑ¼ì(€…ÀèÄÉÁàì(€…±¥¸µ¥Ñ•µÌé•¹ì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µµÕ±Ñ¥Í•±•Ñì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µÑ½±•ì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèĞÉÁàì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÁÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è™™™™™˜ì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€Á…‘‘¥¹œèÀ€ÄÉÁàì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µÑ½±”ÍÁ…¹ì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µ‘É½Á‘½İ¹ì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€Ñ½ÀèĞáÁàì(€±•™ĞèÀì(€İ¥‘Ñ èĞØÁÁàì(€µ…àµİ¥‘Ñ é…±Œ ÄÀÁÙÜ€´€ÌÙÁà¤ì(€èµ¥¹‘•àèĞÀì(€Á…‘‘¥¹œèÄÉÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ĞÕÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Äà¤ì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€µ…É¥¸µ‰½ÑÑ½´èáÁàì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€™±•àèÄì(€µ¥¸µ¡•¥¡ĞèÌÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µÍ•…É¡ì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÌáÁàì(€µ…É¥¸µ‰½ÑÑ½´èáÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€Á…‘‘¥¹œèÀ€ÄÁÁàì(€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µ±¥ÍÑì(€µ…àµ¡•¥¡ĞèĞÈÁÁàì(€½Ù•É™±½Üé…ÕÑ¼ì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€…ÀèÑÁàì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µ½ÁÑ¥½¹ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèáÁàì(€Á…‘‘¥¹œèáÁà€åÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µ½ÁÑ¥½¸é¡½Ù•Éì(€‰…­É½Õ¹è˜Å˜Õ˜äì)ô((¹‰Õ±¬µİ…É•¡½ÕÍ”µ½ÁÑ¥½¸¥¹ÁÕÑì(€İ¥‘Ñ èÄÕÁàì(€¡•¥¡ĞèÄÕÁàì(€…•¹Ğµ½±½ÈèŒÈÔØÍ•ˆì)ô((¹‰Õ±¬µÍÕµµ…Éåì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì)ô((¹‰Õ±¬µÍÕµµ…ÉäÍÁ…¹ì(€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÙÁàì(€Á…‘‘¥¹œèáÁà€ÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹‰Õ±¬µÍÕµµ…Éä‰ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÙÁàì)ô((¹‰Õ±¬µÑÉ…¹Í™•Èµ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È°µ¥¹µ…à À°€Å™È¤¤ì(€…ÀèÄÉÁàì)ô((¹‰Õ±¬µÑÉ…¹Í™•Èµ…É‘ì(€Á…‘‘¥¹œèÄÙÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÄáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹‰Õ±¬µÑÉ…¹Í™•Èµ…É¹µ¥ÍÍ¥¹ì(€‰½É‘•Èµ½±½Èè™•…„ì(€‰…­É½Õ¹è™™˜İ˜Üì)ô((¹‰Õ±¬µ…Éµµ…¥¹ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄÑÁàì)ô((¹‰Õ±¬µ…Éµµ…¥¸‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèİÁàì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄİÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰Õ±¬µ…Éµµ…¥¸Áì(€µ…É¥¸èÕÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹‰Õ±¬µ…Éµµ…¥¸ÍÑÉ½¹ì(€µ¥¸µİ¥‘Ñ éµ…àµ½¹Ñ•¹Ğì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰Õ±¬µÍÑ…ÑÕÍì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€Á…‘‘¥¹œèÑÁà€åÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰Õ±¬µÍÑ…ÑÕÌ¹½­ì(€‰…­É½Õ¹è‘™”Üì(€½±½ÈèŒÄØØÔÌĞì)ô((¹‰Õ±¬µÍÑ…ÑÕÌ¹µ¥ÍÍ¥¹ì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèŒääÅˆÅˆì)ô((¹‰Õ±¬µ…Éµµ•µ½ì(€µ…É¥¸µÑ½ÀèÄÉÁàì(€Á…‘‘¥¹œèÄÁÁà€ÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è˜á™…™Œì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•…‘ì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€ô((€€¹‰Õ±¬µÑÉ…¹Í™•Èµ™¥±Ñ•Éì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô((€€¹‰Õ±¬µÍÕµµ…Éåì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€ô((€€¹‰Õ±¬µÑÉ…¹Í™•Èµ±¥ÍÑì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‰Õ±¬µÑÉ…¹Í™•ÈµÁ…•ì(€€€Á…‘‘¥¹œèÄáÁàì(€ô((€€¹‰Õ±¬µ…Éµµ…¥¹ì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€ô)ô((¼¨€ôôôôô	Õ±¬QÉ…¹Í™•È‘¥Ğ¥•±‘Ì€ôôôôô€¨¼(¹‰Õ±¬µ•‘¥ĞµÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèäÁÁà€Å™È€ÄÈÁÁà€Å™È€Å™Èì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÉÁàì)ô((¹‰Õ±¬µ•‘¥ĞµÉ¥€¹™¥•±‘ì(€µ…É¥¸èÀì)ô((¹‰Õ±¬µ•‘¥ĞµÉ¥±…‰•±ì(€™½¹ĞµÍ¥é”èÄÅÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰Õ±¬µ•‘¥ĞµÉ¥¥¹ÁÕÑì(€¡•¥¡ĞèÌÙÁàì(€™½¹ĞµÍ¥é”èÄÍÁàì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì(€€¹‰Õ±¬µ•‘¥ĞµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‰Õ±¬µ•‘¥ĞµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô((¼¨€ôôôôô	Õ±¬QÉ…¹Í™•ÈM•±•Ñ¥½¸A½ÁÕÀ€ôôôôô€¨¼(¹‰Õ±¬µÍ•±•Ğµ½Ù•É±…åíÁ½Í¥Ñ¥½¸é™¥á•í¥¹Í•ĞèÀíèµ¥¹‘•àèäääääí‘¥ÍÁ±…äéÉ¥íÁ±…”µ¥Ñ•µÌé•¹Ñ•Èí‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Ôà¤íÁ…‘‘¥¹œèÄáÁáô(¹‰Õ±¬µÍ•±•Ğµµ½‘…±íİ¥‘Ñ éµ¥¸ àØÁÁà°äÙÙÜ¤íµ…àµ¡•¥¡ĞèàÙÙ í½Ù•É™±½Üé¡¥‘‘•¸í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µÉ½İÌé…ÕÑ¼…ÕÑ¼€Å™È…ÕÑ¼í‰…­É½Õ¹è™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàí‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€äÁÁàÉ‰„ À°À°À°¸ÌÔ¥ô(¹‰Õ±¬µÍ•±•Ğµ¡•…‘í‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÑÁàíÁ…‘‘¥¹œèÈÉÁà€ÈÑÁà€ÄÑÁàí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”Õ”İ•‰ô(¹‰Õ±¬µÍ•±•Ğµ¡•… Éíµ…É¥¸èÀí½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÈÉÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô(¹‰Õ±¬µÍ•±•Ğµ¡•…Áíµ…É¥¸èÙÁà€À€Àí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèàÀÁô(¹‰Õ±¬µÍ•±•Ğµ¡•…‰ÕÑÑ½¸°¹‰Õ±¬µÍ•±•Ğµ…Ñ¥½¹Ì‰ÕÑÑ½¸°¹‰Õ±¬µÍ•±•Ğµ‰½ÑÑ½´‰ÕÑÑ½¹í‰½É‘•ÈèÀí‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàíÁ…‘‘¥¹œèåÁà€ÄÑÁàí‰…­É½Õ¹è˜Å˜Õ˜äí½±½ÈèŒÌÌĞÄÔÔí™½¹Ğµİ•¥¡ĞèÄÀÀÀíÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹‰Õ±¬µÍ•±•Ğµ…Ñ¥½¹Íí‘¥ÍÁ±…äé™±•àí…ÀèáÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí™±•àµİÉ…ÀéİÉ…ÀíÁ…‘‘¥¹œèÄÑÁà€ÈÑÁàí‰…­É½Õ¹è˜á™…™Œí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”Õ”İ•‰ô(¹‰Õ±¬µÍ•±•Ğµ…Ñ¥½¹ÌÍÑÉ½¹íµ…É¥¸µ±•™Ğé…ÕÑ¼í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÕÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô(¹‰Õ±¬µÍ•±•Ğµ±¥ÍÑí½Ù•É™±½Üé…ÕÑ¼íÁ…‘‘¥¹œèÄÉÁà€ÈÑÁàí‘¥ÍÁ±…äéÉ¥í…ÀèáÁáô(¹‰Õ±¬µÍ•±•ĞµÉ½İí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÈáÁà€Å™È€ÄÀÁÁà€ÄÌÁÁàí…ÀèÄÁÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èíµ¥¸µ¡•¥¡ĞèĞáÁàíÁ…‘‘¥¹œèÄÁÁà€ÄÉÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàí‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆí‰…­É½Õ¹è™™™ô(¹‰Õ±¬µÍ•±•ĞµÉ½Ü¹µ¥ÍÍ¥¹í‰…­É½Õ¹è™™˜İ˜Üí‰½É‘•Èµ½±½Èè™•……ô(¹‰Õ±¬µÍ•±•ĞµÉ½Ü¥¹ÁÕÑíİ¥‘Ñ èÄáÁàí¡•¥¡ĞèÄáÁàí…•¹Ğµ½±½ÈèŒÈÔØÍ•‰ô(¹‰Õ±¬µÍ•±•ĞµÉ½ÜÍÁ…¹í½±½ÈèŒÄÄÄàÈÜí™½¹Ğµİ•¥¡ĞèÄÀÀÁô(¹‰Õ±¬µÍ•±•ĞµÉ½Ü•µíİ¥‘Ñ éµ…àµ½¹Ñ•¹ĞíÁ…‘‘¥¹œèÑÁà€áÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹è‘™”Üí½±½ÈèŒÄØØÔÌĞí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô(¹‰Õ±¬µÍ•±•ĞµÉ½Ü¹µ¥ÍÍ¥¹œ•µí‰…­É½Õ¹è™•”É”Èí½±½ÈèŒääÅˆÅ‰ô(¹‰Õ±¬µÍ•±•ĞµÉ½Ü‰íÑ•áĞµ…±¥¸éÉ¥¡Ğí½±½ÈèŒÄÄÄàÈÜí™½¹Ğµİ•¥¡ĞèÄÀÀÁô(¹‰Õ±¬µÍ•±•Ğµ‰½ÑÑ½µí‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹í…ÀèáÁàíÁ…‘‘¥¹œèÄÙÁà€ÈÑÁà€ÈÉÁàí‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”Õ”İ•‰ô(¹‰Õ±¬µÍ•±•Ğµ‰½ÑÑ½´€¹ÁÉ¥µ…Éåí‰…­É½Õ¹èŒÄÙ„ÌÑ„í½±½Èè™™™ô)µ•‘¥„€¡µ…àµİ¥‘Ñ èÜÀÁÁà¥ì¹‰Õ±¬µÍ•±•ĞµÉ½İíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÈáÁà€Å™Éô¹‰Õ±¬µÍ•±•ĞµÉ½Ü•´°¹‰Õ±¬µÍ•±•ĞµÉ½Ü‰íÉ¥µ½±Õµ¸èÈíÑ•áĞµ…±¥¸é±•™Ñô¹‰Õ±¬µÍ•±•Ğµ…Ñ¥½¹ÌÍÑÉ½¹íµ…É¥¸µ±•™ĞèÀíİ¥‘Ñ èÄÀÀ•õô((¼¨€ôôôôôY•¹‘½È½Õ¹Ğ5…¹…•µ•¹Ğ€ôôôôô€¨¼(¹Ù•¹‘½Èµ…½Õ¹Ğµ…‘µ…É‘íµ…É¥¸èÄÙÁà€À€ÄáÁàíÁ…‘‘¥¹œèÄáÁàí‰½É‘•ÈèÅÁàÍ½±¥€‘‰•…™”í‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàí‰…­É½Õ¹è˜á™‰™™ô¹Ù•¹‘½Èµ…½Õ¹Ğµ…‘µ¡•…‘í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁàíµ…É¥¸µ‰½ÑÑ½´èÄÉÁáô¹Ù•¹‘½Èµ…½Õ¹Ğµ…‘µ¡•… Ííµ…É¥¸èÀí½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄİÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹Ù•¹‘½Èµ…½Õ¹Ğµ…‘µ¡•…Áíµ…É¥¸èÕÁà€À€Àí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèàÀÁô¹Ù•¹‘½Èµ…½Õ¹Ğµ…‘µ¡•…‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äí‰…­É½Õ¹éİ¡¥Ñ”í‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàíÁ…‘‘¥¹œèåÁà€ÄÉÁàí™½¹Ğµİ•¥¡ĞèäÀÀíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹Ù•¹‘½Èµ…½Õ¹ĞµÁ…•ì(€Á…‘‘¥¹œèÈÙÁàì)ô((¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÙÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•… Éì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Ù•¹‘½Èµ…½Õ¹Ğµ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÑÁàì)ô((¹Ù•¹‘½Èµ…½Õ¹Ğµ…É‘ì(€Á…‘‘¥¹œèÄáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÄáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹Ù•¹‘½Èµ…½Õ¹ĞµÑ¥Ñ±•ì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô((¹Ù•¹‘½Èµ…½Õ¹ĞµÑ¥Ñ±”ÍÑÉ½¹ì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Ù•¹‘½Èµ…½Õ¹ĞµÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ô±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÁÁàì)ô((¹Ù•¹‘½Èµ…½Õ¹Ğµ‰½ÑÑ½µì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô((¹Ù•¹‘½Èµ…½Õ¹Ğµ‰½ÑÑ½´€¹ÁÉ¥µ…Éåì(€µ¥¸µİ¥‘Ñ èÄÈÁÁàì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÈÀÁÁà¥ì(€€¹Ù•¹‘½Èµ…½Õ¹ĞµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤ì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÜÀÁÁà¥ì(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…‘ì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€ô((€€¹Ù•¹‘½Èµ…½Õ¹ĞµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô((¼¨€ôôôôô%¹±¥¹”…Ñ”A¥­•È€ôôôôô€¨¼(¹‘…Ñ”µ¥¹ÁÕĞµİÉ…Áì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤€ĞÑÁàì(€…ÀèáÁàì(€İ¥‘Ñ èÄÀÀ”ì)ô((¹‘…Ñ”µ¥¹ÁÕĞµİÉ…À€¹‘…Ñ”µÑ•áĞµ¥¹ÁÕÑì(€İ¥‘Ñ èÄÀÀ”ì(€µ¥¸µİ¥‘Ñ èÀì)ô((¹‘…Ñ”µÁ¥­•Èµ¥¹ÁÕÑì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€É¥¡ĞèÀì(€Ñ½ÀèÀì(€İ¥‘Ñ èĞÑÁàì(€¡•¥¡ĞèÄÀÀ”ì(€½Á…¥ÑäèÀì(€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹”ì)ô((¹‘…Ñ”µÁ¥­•Èµ‰ÕÑÑ½¹ì(€İ¥‘Ñ èĞÑÁàì(€µ¥¸µİ¥‘Ñ èĞÑÁàì(€¡•¥¡ĞèÄÀÀ”ì(€µ¥¸µ¡•¥¡ĞèÌáÁàì(€Á…‘‘¥¹œèÀì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€‰…­É½Õ¹è˜á™…™Œì(€½±½ÈèŒÌÌĞÄÔÔì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€™½¹ĞµÍ¥é”èÄİÁàì(€±¥¹”µ¡•¥¡ĞèÄì)ô((¹‘…Ñ”µÁ¥­•Èµ‰ÕÑÑ½¸é¡½Ù•È°(¹‘…Ñ”µÁ¥­•Èµ‰ÕÑÑ½¸é™½ÕÌµÙ¥Í¥‰±•ì(€‰…­É½Õ¹è•™˜Ù™˜ì(€‰½É‘•Èµ½±½ÈèŒØÁ„Õ™„ì(€½ÕÑ±¥¹”é¹½¹”ì(€‰½àµÍ¡…‘½ÜèÀ€À€À€ÍÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÄÈ¤ì)ô((¼¨€ôôôôôI••¥ÁĞA¡½Ñ¼I•¥ÍÑ•È€ôôôôô€¨¼(¹É••¥ÁĞµÁ¡½Ñ¼µÁ…•ì(€Á…‘‘¥¹œèÈÙÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÑÁàì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ¡•… Éì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ¡•…Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ™½Éµì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄàÁÁàµ¥¹µ…à ÈÈÁÁà°€Å™È¤µ¥¹µ…à ÈàÁÁà°€Ä¸Ñ™È¤€ÈÈÁÁàì(€…ÀèÄÉÁàì(€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞì(€Á…‘‘¥¹œèÄÙÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ™½É´Ñ•áÑ…É•…ì(€İ¥‘Ñ èÄÀÀ”ì(€É•Í¥é”éÙ•ÉÑ¥…°ì(€µ¥¸µ¡•¥¡ĞèàáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äì(€Á…‘‘¥¹œèÄÉÁà€ÄÑÁàì(€™½¹Ğµ™…µ¥±äé¥¹¡•É¥Ğì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÕÁ±½…‘ì(€µ¥¸µ¡•¥¡ĞèĞáÁàì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€…ÀèáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€½±½Èè™™™™™˜ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÕÁ±½…¥¹ÁÕÑì(€‘¥ÍÁ±…äé¹½¹”ì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÍ•±•Ñ•‘ì(€µ…É¥¸µÑ½ÀèáÁàì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÉÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ…É‘ì(€Á…‘‘¥¹œèÄÙÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÄáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ…É¹ÁÉ½•ÍÍ•‘ì(€‰…­É½Õ¹è˜á™…™Œì(€½Á…¥Ñäè¸àÈì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ…Éµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÑÁàì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ…Éµ¡•…ÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€Á…‘‘¥¹œèÑÁà€åÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€µ…É¥¸µ‰½ÑÑ½´èáÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ…Éµ¡•…ÍÁ…¸¹Á•¹‘¥¹ì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèŒääÅˆÅˆì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ…Éµ¡•…ÍÁ…¸¹ÁÉ½•ÍÍ•‘ì(€‰…­É½Õ¹è‘™”Üì(€½±½ÈèŒÄØØÔÌĞì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ…Éµ¡•…‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄİÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ…Éµ¡•…Áì(€µ…É¥¸èÕÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µµ•µ½ì(€µ…É¥¸µÑ½ÀèÄÉÁàì(€Á…‘‘¥¹œèÄÉÁà€ÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™™™‰•ˆì(€½±½ÈèŒäÈĞÀÁ”ì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÑ¡Õµ‰Íì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€µ…É¥¸µÑ½ÀèÄÉÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÑ¡Õµ‰Ì¥µì(€İ¥‘Ñ èäÉÁàì(€¡•¥¡ĞèäÉÁàì(€½‰©•Ğµ™¥Ğé½Ù•Èì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µµ½É•ì(€İ¥‘Ñ èäÉÁàì(€¡•¥¡ĞèäÉÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒĞÜÔÔØäì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ‰…­‘É½Áì(€Á½Í¥Ñ¥½¸é™¥á•ì(€¥¹Í•ĞèÀì(€èµ¥¹‘•àèäääääì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ØÈ¤ì(€Á…‘‘¥¹œèÄáÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•İì(€İ¥‘Ñ éµ¥¸ äØÁÁà°€äÙÙÜ¤ì(€µ…àµ¡•¥¡ĞèàáÙ ì(€½Ù•É™±½Üé…ÕÑ¼ì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€Á…‘‘¥¹œèÈÉÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€äÁÁàÉ‰„ À°À°À°¸ÌÔ¤ì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÑÁàì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•… Éì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÈÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•…Áì(€µ…É¥¸èÕÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¥µ…•Íì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥±°°µ¥¹µ…à ÈÈÁÁà°€Å™È¤¤ì(€…ÀèÄÉÁàì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¥µ…•Ì¥µì(€İ¥‘Ñ èÄÀÀ”ì(€µ…àµ¡•¥¡ĞèÔÈÁÁàì(€½‰©•Ğµ™¥Ğé½¹Ñ…¥¸ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰…­É½Õ¹è˜á™…™Œì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì(€€¹É••¥ÁĞµÁ¡½Ñ¼µ™½Éµì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹É••¥ÁĞµÁ¡½Ñ¼µÁ…•ì(€€€Á…‘‘¥¹œèÄáÁàì(€ô((€€¹É••¥ÁĞµÁ¡½Ñ¼µ¡•…°(€€¹É••¥ÁĞµÁ¡½Ñ¼µ…Éµ¡•…‘ì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€ô((€€¹É••¥ÁĞµÁ¡½Ñ¼µ™½Éµì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€€€Á…‘‘¥¹œèÄÑÁàì(€ô((€€¹É••¥ÁĞµÁ¡½Ñ¼µÑ¡Õµ‰Ì¥µœ°(€€¹É••¥ÁĞµÁ¡½Ñ¼µµ½É•ì(€€€İ¥‘Ñ èÜÑÁàì(€€€¡•¥¡ĞèÜÑÁàì(€ô)ô((¼¨€ôôôôôI••¥ÁĞA¡½Ñ¼AÉ•Ù¥•Ü5½‰¥±”¥à€ôôôôô€¨¼(¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ‰…­‘É½Áì(€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì(€Á±…”µ¥Ñ•µÌéÍÑ…ÉĞ•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½Üé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•İì(€İ¥‘Ñ éµ¥¸ äàÁÁà°€äÙÙÜ¤€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸èÈÑÁà…ÕÑ¼€äÁÁà€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•…‘ì(€Á½Í¥Ñ¥½¸éÍÑ¥­äì(€Ñ½ÀèÀì(€èµ¥¹‘•àèÈì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÙÁà€ÑÁà€ÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸µ‰½ÑÑ½´èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”Õ”İ•ˆì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•… Éì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÈÉÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸ÈÔ€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•…Áì(€µ…É¥¸èÙÁà€À€À€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒØĞÜĞáˆ€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÕÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•…ÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèáÁàì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•…‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èÜÉÁàì(€µ¥¸µ¡•¥¡ĞèĞÙÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è”É”á˜Àì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄÕÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¥µ…•Íì(€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥±°°µ¥¹µ…à ÈĞÁÁà°€Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¥µ…•Ì…ì(€‘¥ÍÁ±…äé‰±½¬ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€½Ù•É™±½Üé¡¥‘‘•¸ì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¥µ…•Ì¥µì(€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€½‰©•Ğµ™¥Ğé½¹Ñ…¥¸€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÀ€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµÁ¡½Ñ¼µ¹¼µ¥µ…•ì(€µ¥¸µ¡•¥¡ĞèÄàÁÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÜÀÁÁà¥ì(€€¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ‰…­‘É½Áì(€€€Á…‘‘¥¹œèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•İì(€€€İ¥‘Ñ é…±Œ ÄÀÁÙÜ€´€ÈÁÁà¤€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÄÁÁà…ÕÑ¼€äÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¡•… Éì(€€€™½¹ĞµÍ¥é”èÈÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµÁ¡½Ñ¼µÁÉ•Ù¥•Üµ¥µ…•Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôôI••¥ÁĞA¡½Ñ¼±•…¸I•‘•Í¥¸€ôôôôô€¨¼(¹É••¥ÁĞµÁ¡½Ñ¼µÁ…”µ±•…¹ì(€Á…‘‘¥¹œèÈáÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµ±•…¸µÑ¥Ñ±•ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼€Å™È…ÕÑ¼ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÑÁàì(€µ…É¥¸µ‰½ÑÑ½´èÈÉÁàì)ô((¹É••¥ÁĞµ±•…¸µ¥½¹ì(€İ¥‘Ñ èÔÉÁàì(€¡•¥¡ĞèÔÉÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÈÙÁàì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÄáÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÄĞ¤ì)ô((¹É••¥ÁĞµ±•…¸µÑ¥Ñ±” Éì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÈÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµ±•…¸µÑ¥Ñ±”Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹É••¥ÁĞµÉ•™É•Í µ‰Ñ¹ì(€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€Á…‘‘¥¹œèÀ€ÄÙÁàì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹É••¥ÁĞµ±•…¸µ™½É´µİÉ…Áì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€À¸å™Èì(€…ÀèÄÙÁàì(€µ…É¥¸µ‰½ÑÑ½´èÈÑÁàì)ô((¹É••¥ÁĞµ±•…¸µ™½É´µ…É°(¹É••¥ÁĞµ±•…¸µÕÁ±½…µ…É‘ì(€Á…‘‘¥¹œèÈÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔ¤ì)ô((¹É••¥ÁĞµ…ÉµÍ•Ñ¥½¸µÑ¥Ñ±•ì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµ±•…¸µÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÈÈÁÁà€Å™Èì(€…ÀèÄÉÁàì)ô((¹É••¥ÁĞµ±•…¸µÑ•áÑ…É•…ì(€İ¥‘Ñ èÄÀÀ”ì(€µ¥¸µ¡•¥¡ĞèÄÈáÁàì(€É•Í¥é”éÙ•ÉÑ¥…°ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äì(€Á…‘‘¥¹œèÄÑÁà€ÄÙÁàì(€™½¹Ğµ™…µ¥±äé¥¹¡•É¥Ğì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸Ôì(€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì)ô((¹É••¥ÁĞµÍÕ‰µ¥Ğµ±•…¹ì(€İ¥‘Ñ èÄÀÀ”ì(€µ¥¸µ¡•¥¡ĞèÔÉÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÄÙ„ÌÑ„°ŒÄÔàÀÍ¤ì(€½±½Èè™™™™™˜ì(€™½¹ĞµÍ¥é”èÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÈÉÁàÉ‰„ ÈÈ°ÄØÌ°ÜĞ°¸Äà¤ì)ô((¹É••¥ÁĞµ‘É½Áé½¹•ì(€µ¥¸µ¡•¥¡ĞèÈÀáÁàì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€…ÀèáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€‰½É‘•ÈèÉÁà‘…Í¡•€ŒäÍŒÕ™ì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°•™˜Ù™˜°™™™™™˜¤ì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€ÑÉ…¹Í¥Ñ¥½¸è¸ÄÙÌ•…Í”ì)ô((¹É••¥ÁĞµ‘É½Áé½¹”é¡½Ù•Éì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÉÁà¤ì(€‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆì)ô((¹É••¥ÁĞµ‘É½Áé½¹”¥¹ÁÕÑì(€‘¥ÍÁ±…äé¹½¹”ì)ô((¹É••¥ÁĞµ‘É½Àµ¥½¹ì(€İ¥‘Ñ èÔÉÁàì(€¡•¥¡ĞèÔÉÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€½±½Èè™™™™™˜ì(€™½¹ĞµÍ¥é”èÈÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµ‘É½Áé½¹”ÍÑÉ½¹ì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµ‘É½Áé½¹”ÍÁ…¹ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹É••¥ÁĞµ™¥±”µ½Õ¹Ñì(€µ…É¥¸µÑ½ÀèÄÉÁàì(€Ñ•áĞµ…±¥¸éÉ¥¡Ğì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµ±¥ÍĞµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµ•¹ì(€µ…É¥¸èÑÁà€À€ÄÑÁàì)ô((¹É••¥ÁĞµ±¥ÍĞµ¡•… Íì(€µ…É¥¸èÀì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÈÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµ±¥ÍĞµ¡•…Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹É••¥ÁĞµ±•…¸µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥±°±µ¥¹µ…à ÌÌÁÁà°Å™È¤¤ì(€…ÀèÄÑÁàì)ô((¹É••¥ÁĞµ±•…¸µ…É‘ì(€Á…‘‘¥¹œèÄáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔ¤ì)ô((¹É••¥ÁĞµ±•…¸µ…É¹Á•¹‘¥¹ì(€‰½É‘•Èµ±•™ĞèÙÁàÍ½±¥€•˜ĞĞĞĞì)ô((¹É••¥ÁĞµ±•…¸µ…É¹ÁÉ½•ÍÍ•‘ì(€‰½É‘•Èµ±•™ĞèÙÁàÍ½±¥€ŒÄÙ„ÌÑ„ì(€‰…­É½Õ¹è™‰™•™Œì)ô((¹É••¥ÁĞµ±•…¸µ…ÉµÑ½Áì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÁÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì)ô((¹É••¥ÁĞµ‰…‘•ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€µ¥¸µ¡•¥¡ĞèÈáÁàì(€Á…‘‘¥¹œèÀ€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµ‰…‘”¹Á•¹‘¥¹ì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèŒääÅˆÅˆì)ô((¹É••¥ÁĞµ‰…‘”¹ÁÉ½•ÍÍ•‘ì(€‰…­É½Õ¹è‘™”Üì(€½±½ÈèŒÄØØÔÌĞì)ô((¹É••¥ÁĞµ±•…¸µ…ÉµÑ½ÀÍµ…±±ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹É••¥ÁĞµÙ•¹‘½Èµ¹…µ•ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸Ìì)ô((¹É••¥ÁĞµÉ•…Ñ•µ‰åì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹É••¥ÁĞµ±•…¸µµ•µ½ì(€µ…É¥¸µÑ½ÀèÄÉÁàì(€µ¥¸µ¡•¥¡ĞèĞÙÁàì(€Á…‘‘¥¹œèÄÉÁà€ÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è˜á™…™Œì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔì)ô((¹É••¥ÁĞµ±•…¸µÑ¡Õµ‰Íì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì°Å™È¤ì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÉÁàì)ô((¹É••¥ÁĞµ±•…¸µÑ¡Õµ‰Ì¥µœ°(¹É••¥ÁĞµ¹¼µÑ¡Õµˆ°(¹É••¥ÁĞµµ½É”µÑ¡Õµ‰ì(€İ¥‘Ñ èÄÀÀ”ì(€…ÍÁ•ĞµÉ…Ñ¥¼èÄ¼À¸ÜÈì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰…­É½Õ¹è˜á™…™Œì(€½‰©•Ğµ™¥Ğé½Ù•Èì)ô((¹É••¥ÁĞµ±•…¸µÑ¡Õµ‰Ì¥µì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹É••¥ÁĞµ¹¼µÑ¡Õµˆ°(¹É••¥ÁĞµµ½É”µÑ¡Õµ‰ì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Íì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™È…ÕÑ¼ì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô((¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è”É”á˜Àì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹½µÁ±•Ñ•ì(€‰…­É½Õ¹èŒÄÙ„ÌÑ„ì(€½±½Èè™™™™™˜ì)ô((¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹‘•±•Ñ•ì(€‰…­É½Õ¹è•˜ĞĞĞĞì(€½±½Èè™™™™™˜ì(€Á…‘‘¥¹œèÀ€ÄÑÁàì)ô((¹É••¥ÁĞµ±•…¸µ•µÁÑåì(€É¥µ½±Õµ¸èÄ¼´Äì(€µ¥¸µ¡•¥¡ĞèÈÈÁÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€‰…­É½Õ¹è™™™™™˜ì(€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄİÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì(€€¹É••¥ÁĞµ±•…¸µ™½É´µİÉ…Áì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹É••¥ÁĞµÁ¡½Ñ¼µÁ…”µ±•…¹ì(€€€Á…‘‘¥¹œèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µÑ¥Ñ±•ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼€Å™Èì(€ô((€€¹É••¥ÁĞµÉ•™É•Í µ‰Ñ¹ì(€€€É¥µ½±Õµ¸èÄ¼´Äì(€€€İ¥‘Ñ èÄÀÀ”ì(€ô((€€¹É••¥ÁĞµ±•…¸µÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô((€€¹É••¥ÁĞµ±•…¸µ™½É´µ…É°(€€¹É••¥ÁĞµ±•…¸µÕÁ±½…µ…É‘ì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€ô((€€¹É••¥ÁĞµ‘É½Áé½¹•ì(€€€µ¥¸µ¡•¥¡ĞèÄÔÁÁàì(€ô((€€¹É••¥ÁĞµ±•…¸µ±¥ÍÑì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô((¼¨€ôôôôô5½‰¥±”EÕ¥¬MÑ…ÉĞ5•¹Ô€ôôôôô€¨¼(¹µ½‰¥±”µÅÕ¥¬µÍÑ…ÉÑì(€‘¥ÍÁ±…äé¹½¹”ì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ½‰¥±”µÅÕ¥¬µÍÑ…ÉÑì(€€€Á½Í¥Ñ¥½¸é™¥á•ì(€€€¥¹Í•ĞèÀì(€€€èµ¥¹‘•àèÄÀÀÀÀÀì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€€€Á…‘‘¥¹œèÈÉÁàì(€€€‰…­É½Õ¹èŒÁ˜ÄÜÉ„ì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ…É‘ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ…àµİ¥‘Ñ èĞÌÁÁàì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèÄÙÁàì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ±½½ì(€€€µ¥¸µ¡•¥¡ĞèÄÌÉÁàì(€€€‘¥ÍÁ±…äé™±•àì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÌÁÁàì(€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÑ˜ĞÙ”Ô¤ì(€€€½±½Èè™™™™™˜ì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ĞÉÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÌÈ¤ì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ±½¼ÍÑÉ½¹ì(€€€™½¹ĞµÍ¥é”èÌÑÁàì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´ÅÁàì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ±½¼ÍÁ…¹ì(€€€µ…É¥¸µÑ½ÀèÄÁÁàì(€€€™½¹ĞµÍ¥é”èÄáÁàì(€€€™½¹Ğµİ•¥¡ĞèäÀÀì(€€€½Á…¥Ñäè¸äì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µÑ¥Ñ±•ì(€€€Á…‘‘¥¹œèÑÁà€ÑÁà€Àì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µÑ¥Ñ±” Éì(€€€µ…É¥¸èÀì(€€€½±½Èè™™™™™˜ì(€€€™½¹ĞµÍ¥é”èÈÑÁàì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µÑ¥Ñ±”Áì(€€€µ…É¥¸èÙÁà€À€Àì(€€€½±½Èè‰Õ”Äì(€€€™½¹ĞµÍ¥é”èÄÕÁàì(€€€™½¹Ğµİ•¥¡ĞèàÀÀì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ‰Ñ¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ¥¸µ¡•¥¡ĞèäÉÁàì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€…ÀèÄÙÁàì(€€€‰½É‘•ÈèÀì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÙÁàì(€€€Á…‘‘¥¹œèÄáÁàì(€€€‰…­É½Õ¹è™™™™™˜ì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÑÁà€ÌÁÁàÉ‰„ À°À°À°¸Äà¤ì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ‰Ñ¸ÍÁ…¹ì(€€€İ¥‘Ñ èÔÑÁàì(€€€¡•¥¡ĞèÔÑÁàì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€€€™½¹ĞµÍ¥é”èÈáÁàì(€€€™±•àé¹½¹”ì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ‰Ñ¸¹Á¡½Ñ¼ÍÁ…¹ì(€€€‰…­É½Õ¹è‘‰•…™”ì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ‰Ñ¸¹µ…¥¹ĞÍÁ…¹ì(€€€‰…­É½Õ¹è™•˜ÍŒÜì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ‰Ñ¸¹¡½µ”ÍÁ…¹ì(€€€‰…­É½Õ¹è‘™”Üì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ‰Ñ¸‰ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€™½¹ĞµÍ¥é”èÈÅÁàì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÔì(€ô((€€¹µ½‰¥±”µÅÕ¥¬µ‰Ñ¸Íµ…±±ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€µ…É¥¸µÑ½ÀèÕÁàì(€€€½±½ÈèŒØĞÜĞáˆì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèàÀÀì(€ô)ô((¼¨€ôôôôô5…¥¹Ñ•¹…¹”A¡½Ñ¼I•¥ÍÑ•È€ôôôôô€¨¼(¹É••¥ÁĞµ±•…¸µ¥½¸¹µ…¥¹Ñì(€‰…­É½Õ¹è™•˜ÍŒÜì(€½±½ÈèŒäÈĞÀÁ”ì)ô((¹µ…¥¹Ñ•¹…¹”µ‘É½Áé½¹•ì(€‰½É‘•Èµ½±½Èè™‰‰˜ÈĞ€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°™™™‰•ˆ°™™™™™˜¤€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ñ•¹…¹”µÍÕ‰µ¥Ñì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°˜Ôå”Áˆ°äÜÜÀØ¤€…¥µÁ½ÉÑ…¹Ğì(€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÈÉÁàÉ‰„ ÈĞÔ°ÄÔà°ÄÄ°¸Äà¤€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ñ•¹…¹”µÕÉ•¹Ğµ¡•­ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÁÁàì(€½±½ÈèˆäÅŒÅŒì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹µ…¥¹Ñ•¹…¹”µÕÉ•¹Ğµ¡•¬¥¹ÁÕÑì(€İ¥‘Ñ èÄáÁàì(€¡•¥¡ĞèÄáÁàì(€…•¹Ğµ½±½Èè‘ŒÈØÈØì)ô((¹µ…¥¹Ñ•¹…¹”µÕÉ•¹Ğµ‰…‘•ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€İ¥‘Ñ éµ…àµ½¹Ñ•¹Ğì(€µ…É¥¸µÑ½ÀèáÁàì(€Á…‘‘¥¹œèÕÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèŒääÅˆÅˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹µ…¥¹Ñ•¹…¹”µÁ¡½Ñ¼µÁ…”µ±•…¸€¹É••¥ÁĞµ±•…¸µ…É¹Á•¹‘¥¹ì(€‰½É‘•Èµ±•™Ğµ½±½Èè˜Ôå”Áˆì)ô((¼¨€ôôôôô¹ÍÕÉ”5…¥¹Ñ•¹…¹”A¡½Ñ¼5•¹ÔY¥Í¥‰±”€ôôôôô€¨¼(¹µ•¹Ô€¹‘É½Á‘½İ¸°(¹µ•¹Ô€¹ÍÕ‰µ•¹Ô°(¹¹…Øµ‘É½Á‘½İ¸°(¹‘É½Á‘½İ¸µµ•¹Õì(€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€èµ¥¹‘•àèääää€…¥µÁ½ÉÑ…¹Ğì)ô((¼¨€ôôôôô¥á•5…¥¹Ñ•¹…¹”É½Á‘½İ¸5•¹Ô€ôôôôô€¨¼(¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕ‰ì(€µ¥¸µİ¥‘Ñ èÄØÁÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€èµ¥¹‘•àèäääää€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé¡½Ù•È€¹µ…¥¹ĞµÍÕˆ°(¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé™½ÕÌµİ¥Ñ¡¥¸€¹µ…¥¹ĞµÍÕ‰ì(€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¹ì(€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€İ¥‘Ñ èÄØÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕ‰ì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé¡½Ù•È€¹µ…¥¹ĞµÍÕˆ°(€€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé™½ÕÌµİ¥Ñ¡¥¸€¹µ…¥¹ĞµÍÕ‰ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô½É”5…¥¹Ñ•¹…¹”É½Á‘½İ¸€Ğ%Ñ•µÌ€ôôôôô€¨¼(¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÁì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕ‰ì(€‘¥ÍÁ±…äé¹½¹”ì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”€…¥µÁ½ÉÑ…¹Ğì(€Ñ½ÀèÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€±•™ĞèÀ€…¥µÁ½ÉÑ…¹Ğì(€èµ¥¹‘•àèääääää€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µİ¥‘Ñ èÄÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œµÑ½ÀèÙÁà€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğ€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé¡½Ù•È€¹µ…¥¹ĞµÍÕˆ°(¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé™½ÕÌµİ¥Ñ¡¥¸€¹µ…¥¹ĞµÍÕ‰ì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¹ì(€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€İ¥‘Ñ èÄÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèåÁà€ÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÀ€…¥µÁ½ÉÑ…¹Ğì(€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é™¥ÉÍĞµ¡¥±‘ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁà€ÄÁÁà€À€À€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é±…ÍĞµ¡¥±‘ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÀ€À€ÄÁÁà€ÄÁÁà€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕ‰ì(€€€Á½Í¥Ñ¥½¸é™¥á•€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ½ÀèÄÌÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±•™ĞèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€É¥¡ĞèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ é…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÌÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Äà¤€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé¡½Ù•È€¹µ…¥¹ĞµÍÕˆ°(€€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé™½ÕÌµİ¥Ñ¡¥¸€¹µ…¥¹ĞµÍÕ‰ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è˜á™…™Œ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôôMÑ…¹‘…±½¹”5…¥¹Ñ•¹…¹”A¡½Ñ¼	ÕÑÑ½¸€ôôôôô€¨¼(¹µ•¹Ô€ø‰ÕÑÑ½¸¹µ…¥¹Ñ•¹…¹”µÁ¡½Ñ¼µÍÑ…¹‘…±½¹”°(¹µ•¹Ô‰ÕÑÑ½¹m½¹±¥¬¨ô‰µ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ì‰uì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô((¼¨€ôôôôô±•…¸5…¥¹Ñ•¹…¹”É½Á‘½İ¸¥á•€ôôôôô€¨¼(¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÁì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕ‰ì(€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”€…¥µÁ½ÉÑ…¹Ğì(€Ñ½ÀèÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€±•™ĞèÀ€…¥µÁ½ÉÑ…¹Ğì(€èµ¥¹‘•àèääääää€…¥µÁ½ÉÑ…¹Ğì(€İ¥‘Ñ èÄÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µİ¥‘Ñ èÄÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÙÁà€À€À€À€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğ€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé¡½Ù•È€¹µ…¥¹ĞµÍÕˆ°(¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé™½ÕÌµİ¥Ñ¡¥¸€¹µ…¥¹ĞµÍÕ‰ì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¹ì(€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€İ¥‘Ñ èÄÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µİ¥‘Ñ èÄÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèĞÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèĞÁÁà€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèåÁà€ÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÀ€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÔÀÀ€…¥µÁ½ÉÑ…¹Ğì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì(€‰½àµÍ¡…‘½Üé¹½¹”€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é™¥ÉÍĞµ¡¥±‘ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁà€ÄÁÁà€À€À€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é±…ÍĞµ¡¥±‘ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÀ€À€ÄÁÁà€ÄÁÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é¡½Ù•Éì(€‰…­É½Õ¹è˜Å˜Õ˜ä€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕ‰ì(€€€Á½Í¥Ñ¥½¸é™¥á•€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ½ÀèÄÌÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±•™ĞèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€É¥¡ĞèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ é…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÌÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Äà¤€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé¡½Ù•È€¹µ…¥¹ĞµÍÕˆ°(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀé™½ÕÌµİ¥Ñ¡¥¸€¹µ…¥¹ĞµÍÕ‰ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è˜á™…™Œ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5…¥¹Ñ•¹…¹”A¡½Ñ¼5•¹ÔY¥Í¥‰¥±¥Ñä¥¹…°¥à€ôôôôô€¨¼(¹µ•¹ÔµÉ½ÕÀ€¹ÍÕ‰ì(€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€èµ¥¹‘•àèääääää€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹ÔµÉ½ÕÀé¡½Ù•È€¹ÍÕˆ°(¹µ•¹ÔµÉ½ÕÀé™½ÕÌµİ¥Ñ¡¥¸€¹ÍÕ‰ì(€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹ÔµÉ½ÕÀ€¹ÍÕˆ‰ÕÑÑ½¹ì(€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€Ù¥Í¥‰¥±¥ÑäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€½Á…¥ÑäèÄ€…¥µÁ½ÉÑ…¹Ğì(€İ¥‘Ñ èÄÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèĞÁÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèĞÁÁà€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸È€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ½‰¥±”µÍ¡••Ğ°(€€¹µ½‰¥±”µÍ¡••ĞµÁ…¹•°°(€€¹µ½‰¥±”µÍ¡••Ğµ½¹Ñ•¹Ñì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µÍ¡••Ğ‰ÕÑÑ½¸°(€€¹µ½‰¥±”µÍ¡••ĞµÁ…¹•°‰ÕÑÑ½¸°(€€¹µ½‰¥±”µÍ¡••Ğµ½¹Ñ•¹Ğ‰ÕÑÑ½¹ì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€Ù¥Í¥‰¥±¥ÑäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€½Á…¥ÑäèÄ€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5…¥¹Ñ•¹…¹”É½Á‘½İ¸½¹Ğ5…Ñ €ôôôôô€¨¼(¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¹ì(€™½¹Ğµİ•¥¡ĞèÔÀÀ€…¥µÁ½ÉÑ…¹Ğì(€±•ÑÑ•ÈµÍÁ…¥¹œèÀ€…¥µÁ½ÉÑ…¹Ğì)ô((¼¨€ôôôôô5…¥¹Ñ•¹…¹”É½Á‘½İ¸M…µ”]•¥¡Ğ€ôôôôô€¨¼(¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¹ì(€™½¹Ğµ™…µ¥±äè¥¹¡•É¥Ğ€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”è€ÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡Ğè€ÔÀÀ€…¥µÁ½ÉÑ…¹Ğì(€±•ÑÑ•ÈµÍÁ…¥¹œè€À€…¥µÁ½ÉÑ…¹Ğì)ô((¼¨€ôôôôô5½‰¥±”1½½ÕĞ	ÕÑÑ½¸€ôôôôô€¨¼(¹µ½‰¥±”µÅÕ¥¬µ±½½ÕÑì(€İ¥‘Ñ èÄÀÀ”ì(€µ¥¸µ¡•¥¡ĞèÔÑÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€‰…­É½Õ¹è•˜ĞĞĞĞì(€½±½Èè™™™™™˜ì(€™½¹ĞµÍ¥é”èÄİÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÈÙÁàÉ‰„ ÈÌä°Øà°Øà°¸ÈÔ¤ì)ô((¹µ½‰¥±”µÍ¡••Ğµ±½½ÕÑì(€‰…­É½Õ¹è•˜ĞĞĞĞ€…¥µÁ½ÉÑ…¹Ğì(€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì)ô((¼¨€ôôôôô5½‰¥±”Õ±°5•¹ÔY¥Í¥‰¥±¥Ñä€¬½¹Ğ9½Éµ…±¥é”€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€¡Ñµ°°‰½‘ä°€É½½Ğ°€¹…ÁÁì(€€€™½¹Ğµ™…µ¥±äèµ…ÁÁ±”µÍåÍÑ•´±	±¥¹­5…MåÍÑ•µ½¹Ğ°‰ÁÁ±”M½Ñ¡¥Œ9•¼ˆ°‰9½Ñ¼M…¹Ì-Hˆ°‰5…±Õ¸½Ñ¡¥Œˆ±É¥…°±Í…¹ÌµÍ•É¥˜€…¥µÁ½ÉÑ…¹Ğì(€€€€µİ•‰­¥Ğµ™½¹ĞµÍµ½½Ñ¡¥¹œé…¹Ñ¥…±¥…Í•ì(€€€Ñ•áĞµÉ•¹‘•É¥¹œé½ÁÑ¥µ¥é•1•¥‰¥±¥Ñäì(€ô((€€¹…ÁÁì(€€€µ¥¸µ¡•¥¡ĞèÄÀÁ‘Ù €…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµäé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èäÙÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…É‘ì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹Ñ…‰±”µİÉ…À°(€€¹ÍÉ½±°µÑ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜµäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€€µİ•‰­¥Ğµ½Ù•É™±½ÜµÍÉ½±±¥¹œéÑ½Õ €…¥µÁ½ÉÑ…¹Ğì(€ô((€¥¹ÁÕĞ°Ñ•áÑ…É•„°Í•±•Ñì(€€€™½¹ĞµÍ¥é”èÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÜÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€‰ÕÑÑ½¹ì(€€€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5½‰¥±”AÕÉ¡…Í”1½½­ÕÀ…É‘Ì€ôôôôô€¨¼(¹µ½‰¥±”µÁÕÉ¡…Í”µ…É‘Íì(€‘¥ÍÁ±…äé¹½¹”ì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…É‘Íì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÉÁàì(€€€µ…É¥¸µÑ½ÀèÄáÁàì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…É‘ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€€€‰…­É½Õ¹è™™™™™˜ì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€€€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÜ¤ì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ¡•…‘ì(€€€‘¥ÍÁ±…äé™±•àì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…ÀèÄÁÁàì(€€€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ¡•…ÍÑÉ½¹ì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€™½¹ĞµÍ¥é”èÄİÁàì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Ìì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ¡•…ÍÁ…¹ì(€€€½±½ÈèŒØĞÜĞáˆì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèàÀÀì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…ÉµÉ½İì(€€€‘¥ÍÁ±…äé™±•àì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…ÀèÄÁÁàì(€€€Á…‘‘¥¹œèİÁà€Àì(€€€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€˜Å˜Õ˜äì(€€€½±½ÈèŒÌÌĞÄÔÔì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€€€™½¹Ğµİ•¥¡ĞèàÀÀì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…ÉµÉ½Ü‰ì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€€€Ñ•áĞµ…±¥¸éÉ¥¡Ğì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€€€…ÀèáÁàì(€€€µ…É¥¸µÑ½ÀèÄÉÁàì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€€€‰½É‘•ÈèÀì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€€€‰…­É½Õ¹è”É”á˜Àì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ô)ô((¼¨€ôôôôô5½‰¥±”±°5•¹ÔÕ‘¥Ğ¥à€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€¡Ñµ°°(€‰½‘ä°(€€É½½Ñì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµäé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµ™…µ¥±äèµ…ÁÁ±”µÍåÍÑ•´±	±¥¹­5…MåÍÑ•µ½¹Ğ°‰ÁÁ±”M½Ñ¡¥Œ9•¼ˆ°‰9½Ñ¼M…¹Ì-Hˆ°‰5…±Õ¸½Ñ¡¥Œˆ±É¥…°±Í…¹ÌµÍ•É¥˜€…¥µÁ½ÉÑ…¹Ğì(€€€€µİ•‰­¥Ğµ™½¹ĞµÍµ½½Ñ¡¥¹œé…¹Ñ¥…±¥…Í•ì(€€€Ñ•áĞµÉ•¹‘•É¥¹œé½ÁÑ¥µ¥é•1•¥‰¥±¥Ñäì(€ô((€€¹…ÁÁì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÄÀÁ‘Ù €…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜµäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄÑÁà€ÄÁÁà€ÄÀÑÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹¡•É½ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÌÑÁà€ÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¸µÑ¥Ñ±•ì(€€€™½¹ĞµÍ¥é”èÌÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´ÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÄØ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹¡•É¼Áì(€€€™½¹ĞµÍ¥é”èÄİÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±•ÑÑ•ÈµÍÁ…¥¹œèÅÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…É‘ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…É Éì(€€€™½¹ĞµÍ¥é”èÈÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÔ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€À€ÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…É Íì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€Ù¥Í¥‰¥±¥ÑäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€½Á…¥ÑäèÄ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÈÉÁà€À€ÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄåÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‰•Ñİ••¹ì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‰•Ñİ••¸‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÔÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É¥È°(€€¹É¥Ì°(€€¹É¥Ô°(€€¹Ñİ½ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹™¥•±°(€€¹¥Ñ•´µÍ•…É °(€€¹ÍÑ…ÑÕÌµ…É‘Ì°(€€¹‘…Í¡‰½…ÉµİÉ…À°(€€¹‘…Í¡‰½…ÉµÁ…¹•°°(€€¹‘…Í¡‰½…Éµ…É°(€€¹¹½Ñ¥”µÁÉ¼µİÉ…À°(€€¹É••¥ÁĞµ±•…¸µ±¥ÍĞ°(€€¹É••¥ÁĞµÁ¡½Ñ¼µ±¥ÍĞ°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ±¥ÍÑì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€Ù¥Í¥‰¥±¥ÑäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€½Á…¥ÑäèÄ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€ô((€¥¹ÁÕĞ°(€Ñ•áÑ…É•„°(€Í•±•Ñì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÔÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÜÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµ™…µ¥±äèµ…ÁÁ±”µÍåÍÑ•´±	±¥¹­5…MåÍÑ•µ½¹Ğ°‰ÁÁ±”M½Ñ¡¥Œ9•¼ˆ°‰9½Ñ¼M…¹Ì-Hˆ°‰5…±Õ¸½Ñ¡¥Œˆ±É¥…°±Í…¹ÌµÍ•É¥˜€…¥µÁ½ÉÑ…¹Ğì(€ô((€Ñ•áÑ…É•…ì(€€€µ¥¸µ¡•¥¡ĞèÄÈÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€‰ÕÑÑ½¹ì(€€€™½¹Ğµ™…µ¥±äèµ…ÁÁ±”µÍåÍÑ•´±	±¥¹­5…MåÍÑ•µ½¹Ğ°‰ÁÁ±”M½Ñ¡¥Œ9•¼ˆ°‰9½Ñ¼M…¹Ì-Hˆ°‰5…±Õ¸½Ñ¡¥Œˆ±É¥…°±Í…¹ÌµÍ•É¥˜€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÍÑ…ÑÕÌµ…É‘Íì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÄáÁà€À€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÍÑ…ÑÕÌµ…É‘Ì€ø‘¥Ùì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèäÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÍÑ…ÑÕÌµ…É‘ÌÍÁ…¹ì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒØĞÜĞáˆ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µ‰½ÑÑ½´èáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÍÑ…ÑÕÌµ…É‘Ì‰ì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒÄÄÄàÈÜ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÈÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔ€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é‰É•…¬µİ½É€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÍÉ½±°µÑ…‰±”°(€€¹Ñ…‰±”µİÉ…À°(€€¹Ñ…‰±”µ½¹Ñ…¥¹•Éì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€Ù¥Í¥‰¥±¥ÑäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€½Á…¥ÑäèÄ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜµäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€€µİ•‰­¥Ğµ½Ù•É™±½ÜµÍÉ½±±¥¹œéÑ½Õ €…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÄÁÁà€À€ÈÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÍÉ½±°µÑ…‰±”Ñ…‰±”°(€€¹Ñ…‰±”µİÉ…ÀÑ…‰±”°(€Ñ…‰±•ì(€€€‘¥ÍÁ±…äéÑ…‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èØàÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ…‰±”µ±…å½ÕĞé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€ô((€Ñ °(€Ñ‘ì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹•µÁÑåì(€€€‘¥ÍÁ±…äéÑ…‰±”µ•±°€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèàÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒØĞÜĞáˆ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¹Ğµ‘•Ñ…¥°µÑ•áÑì(€€€‘¥ÍÁ±…äé¥¹±¥¹”µ‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ èÈØÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é‰É•…¬µİ½É€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…É‘Íì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ùì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€èµ¥¹‘•àèÄÀÀÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µµ½É”µÍ¡••Ñì(€€€èµ¥¹‘•àèÄÀÀÀÀÄ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡ĞèÜá‘Ù €…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµäé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨A²^C²s®*PƒªÖ³®“²†Ã¶j0ƒ®ª£®ÂS²vğƒ²æÓ®Npƒ²"£ªæ ƒ²rƒ² €¨¼)µ•‘¥„€¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€€¹µ½‰¥±”µÁÕÉ¡…Í”µ…É‘Íì(€€€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôôUÁ‘…Ñ”A½ÁÕÀ½µÁ…Ğ€¬±½Í…‰±”€ôôôôô€¨¼(¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰…­‘É½Áì(€Á…‘‘¥¹œèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½Üé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÁì(€İ¥‘Ñ éµ¥¸ ÔØÁÁà°€äÑÙÜ¤€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡ĞèÜá‘Ù €…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½Üé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ¡•…‘ì(€Á½Í¥Ñ¥½¸éÍÑ¥­ä€…¥µÁ½ÉÑ…¹Ğì(€Ñ½ÀèÀ€…¥µÁ½ÉÑ…¹Ğì(€èµ¥¹‘•àèÈ€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œµ‰½ÑÑ½´èÄÁÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ¡•…‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁà€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è•˜ĞĞĞĞ€…¥µÁ½ÉÑ…¹Ğì(€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÈÉÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀÕ±ì(€µ…àµ¡•¥¡ĞèÌÉ‘Ù €…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½Üé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œµÉ¥¡ĞèÑÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀ±¥ì(€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèäÉÁà€Å™È€…¥µÁ½ÉÑ…¹Ğì(€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀ±¤ÍÁ…¹ì(€‘¥ÍÁ±…äèµİ•‰­¥Ğµ‰½à€…¥µÁ½ÉÑ…¹Ğì(€€µİ•‰­¥Ğµ±¥¹”µ±…µÀèÈ€…¥µÁ½ÉÑ…¹Ğì(€€µİ•‰­¥Ğµ‰½àµ½É¥•¹ĞéÙ•ÉÑ¥…°€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½Üé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸Ğ€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰½ÑÑ½µì(€Á½Í¥Ñ¥½¸éÍÑ¥­ä€…¥µÁ½ÉÑ…¹Ğì(€‰½ÑÑ½´èÀ€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œµÑ½ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÕÁ‘…Ñ”µÁ½ÁÕÀµ‰½ÑÑ½´€¹ÁÉ¥µ…Éåì(€µ¥¸µ¡•¥¡ĞèĞÙÁà€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹ÕÁ‘…Ñ”µÁ½ÁÕÁì(€€€µ…àµ¡•¥¡ĞèÜÉ‘Ù €…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÕÁ‘…Ñ”µÁ½ÁÕÀ±¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹ÕÁ‘…Ñ”µÁ½ÁÕÀ±¤ÍÑÉ½¹ì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôôA¡½Ñ¼Q¼I•¥ÍÑ•È1¥¹¬	ÕÑÑ½¹Ì€ôôôôô€¨¼(¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Íì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à äÉÁà°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹±¥¹­ì(€‰…­É½Õ¹èŒÈÔØÍ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµÍÕ‰µ¥Ğµ±•…¸é‘¥Í…‰±•‘ì(€½Á…¥Ñäè¸ØÈì(€ÕÉÍ½Èé¹½Ğµ…±±½İ•ì)ô((¼¨€ôôôôôU¹¥™¥•á•°½A½İ¹±½…	ÕÑÑ½¹Ì€ôôôôô€¨¼(¹‰•Ñİ••¸€ø‰ÕÑÑ½¸°(¹‰Õ±¬µ‘½İ¹±½…µ‰Ñ¸°(¹‰Õ±¬µÑÉ…¹Í™•Èµ‘½İ¹±½…°)‰ÕÑÑ½¹m±…ÍÌ¨ô‰•á•°‰t°)‰ÕÑÑ½¹m±…ÍÌ¨ô‰‘½İ¹±½…‰uì(€µ¥¸µ¡•¥¡ĞèĞÙÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÀ€ÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÅÑ•à¤€…¥µÁ½ÉÑ…¹Ğì(€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÉÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈÀ¤€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì)ô((¹‰•Ñİ••¹ì(€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì)ô((¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹Í•½¹‘…Éåì(€‰…­É½Õ¹èŒĞÜÔÔØä€…¥µÁ½ÉÑ…¹Ğì(€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‰•Ñİ••¸€ø‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôôU¹¥™¥•A…”!•…‘•È€¼½İ¹±½…	ÕÑÑ½¸±¥¹µ•¹Ğ€ôôôôô€¨¼(¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± Éì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµÍ•±˜éÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì)ô((¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¹ì(€©ÕÍÑ¥™äµÍ•±˜é•¹€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µİ¥‘Ñ èÄÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÀ€ÄÙÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸é™¥ÉÍĞµ½˜µÑåÁ•ì(€É¥µ½±Õµ¸é…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì)ô((¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸€¬‰ÕÑÑ½¹ì(€µ…É¥¸µ±•™ĞèÀ€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± Éì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµÍ•±˜é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµÍ•±˜éÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨ƒªÖ³®“²†Ã¶j0ƒ¶V¶Ã²f ƒ¶FpƒªÂªÊ¤ƒ²‚W®š°€¨¼(¹…É€ø€¹É¥Ô€¬€¹µ½‰¥±”µÁÕÉ¡…Í”µ…É‘Ì°(¹…É€ø€¹É¥Ô€¬€¹ÍÉ½±°µÑ…‰±•ì(€µ…É¥¸µÑ½ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¼¨€ôôôôôA¡½Ñ¼1¥¹¬A¥­•È5½‘…°€ôôôôô€¨¼(¹Á¡½Ñ¼µ±¥¹¬µµ½‘…°µ‰…­‘É½Áì(€Á½Í¥Ñ¥½¸é™¥á•ì(€¥¹Í•ĞèÀì(€èµ¥¹‘•àèÄÀÀÀÀÈì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€Á…‘‘¥¹œèÈÁÁàì(€‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÔÔ¤ì)ô((¹Á¡½Ñ¼µ±¥¹¬µµ½‘…±ì(€İ¥‘Ñ éµ¥¸ ÜØÁÁà°€äÙÙÜ¤ì(€µ…àµ¡•¥¡ĞèàÉ‘Ù ì(€½Ù•É™±½Üé…ÕÑ¼ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€‰…­É½Õ¹è™™™™™˜ì(€Á…‘‘¥¹œèÈÁÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÈÑÁà€àÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÌÔ¤ì)ô((¹Á¡½Ñ¼µ±¥¹¬µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÑÁàì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô((¹Á¡½Ñ¼µ±¥¹¬µ¡•… Éì(€µ…É¥¸èÀì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Á¡½Ñ¼µ±¥¹¬µ¡•…Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Á¡½Ñ¼µ±¥¹¬µ¡•…‰ÕÑÑ½¹ì(€‰…­É½Õ¹è”É”á˜Àì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Á¡½Ñ¼µ±¥¹¬µÍ•…É¡ì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô((¹Á¡½Ñ¼µ±¥¹¬µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÁÁàì)ô((¹Á¡½Ñ¼µ±¥¹¬µ¥Ñ•µì(€İ¥‘Ñ èÄÀÀ”ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼ì(€…ÀèÄÉÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€Ñ•áĞµ…±¥¸é±•™Ğì(€Á…‘‘¥¹œèÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì)ô((¹Á¡½Ñ¼µ±¥¹¬µ¥Ñ•´ÍÑÉ½¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€™½¹ĞµÍ¥é”èÄÙÁàì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Á¡½Ñ¼µ±¥¹¬µ¥Ñ•´ÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÑÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Á¡½Ñ¼µ±¥¹¬µ¥Ñ•´Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ…Ñ¥½¹Ì°(¹µ½‰¥±”µ…Éµ…Ñ¥½¹Íì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à àÑÁà°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹Á¡½Ñ¼µ±¥¹¬µµ½‘…°µ‰…­‘É½Áì(€€€Á…‘‘¥¹œèÄÉÁàì(€€€Á±…”µ¥Ñ•µÌé•¹•¹Ñ•Èì(€ô((€€¹Á¡½Ñ¼µ±¥¹¬µµ½‘…±ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ…àµ¡•¥¡ĞèàÙ‘Ù ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁà€ÈÑÁà€À€Àì(€ô((€€¹Á¡½Ñ¼µ±¥¹¬µ¥Ñ•µì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô((¼¨€ôôôôô5½‰¥±”I••¥ÁĞ½5…¥¹Ñ•¹…¹”A¡½Ñ¼Ñ¥½¸	ÕÑÑ½¹ÌY¥Í¥‰±”€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹É••¥ÁĞµ±•…¸µ±¥ÍĞ°(€€¹É••¥ÁĞµ±•…¸µ…É°(€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Íì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µÑ½ÀèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€Ù¥Í¥‰¥±¥ÑäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€½Á…¥ÑäèÄ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄÅÁà€áÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÔ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é­••Àµ…±°€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹±¥¹­ì(€€€‰…­É½Õ¹èŒÈÔØÍ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹Í•½¹‘…Éåì(€€€‰…­É½Õ¹èŒĞÜÔÔØä€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹½µÁ±•Ñ•ì(€€€‰…­É½Õ¹èŒÄÙ„ÌÑ„€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹‘•±•Ñ•ì(€€€‰…­É½Õ¹è•˜ĞĞĞĞ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èĞÌÁÁà¥ì(€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5½‰¥±”A¡½Ñ¼…É‘Ì½µÁ…ĞÑ¥½¸	ÕÑÑ½¹Ì%90€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹É••¥ÁĞµ±•…¸µ…É‘ì(€€€Á…‘‘¥¹œèÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µÑ¡Õµˆ°(€€¹É••¥ÁĞµ±•…¸µ…É¥µì(€€€µ…àµİ¥‘Ñ èäÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡ĞèÜáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€½‰©•Ğµ™¥Ğé½Ù•È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µÑ½ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€Ù¥Í¥‰¥±¥ÑäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€½Á…¥ÑäèÄ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÙÁà€áÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÄÔ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é­••Àµ…±°€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹±¥¹­ì(€€€‰…­É½Õ¹èŒÈÔØÍ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹Í•½¹‘…Éåì(€€€‰…­É½Õ¹èŒĞÜÔÔØä€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹½µÁ±•Ñ•ì(€€€‰…­É½Õ¹èŒÄÙ„ÌÑ„€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì€¹‘•±•Ñ•ì(€€€‰…­É½Õ¹è•˜ĞĞĞĞ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì‰ÕÑÑ½¸é¹Ñ µ¡¥± Ô¥ì(€€€É¥µ½±Õµ¸èÄ€¼€´Ä€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÌàÁÁà¥ì(€€¹É••¥ÁĞµ±•…¸µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€™½¹ĞµÍ¥é”èÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÕÁà€ÙÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô1½½­ÕÀA…•ÌÕ±°!•¥¡Ğ1…å½ÕĞ€ôôôôô€¨¼(¹±½½­ÕÀµÁ…•ì(€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÌÁÁà¤€…¥µÁ½ÉÑ…¹Ğì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸€…¥µÁ½ÉÑ…¹Ğì)ô((¹±½½­ÕÀµÁ…”€ø€¹ÍÉ½±°µÑ…‰±”°(¹±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€™±•àèÄ€Ä…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèĞÌÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÌÔÕÁà¤€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½Üé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì)ô((¹±½½­ÕÀµÁ…”Ñ…‰±•ì(€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì)ô((¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”°(¹µ…¥¹Ğµ±½½­ÕÀµÁ…•ì(€Á…‘‘¥¹œµ‰½ÑÑ½´èÈÁÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¼¨ƒ²‚W®æƒ®Ns®†·®.“²jĞƒªâ²R£®–ğƒ®.“®–àƒ®¦S®&Ó²f ƒ®>g²vó¶VcªÊ0€¨¼(¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸°(¹µ•¹ÔµÉ½ÕÀ€¹ÍÕˆ‰ÕÑÑ½¹ì(€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÜÀÀ€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸È€…¥µÁ½ÉÑ…¹Ğì(€±•ÑÑ•ÈµÍÁ…¥¹œèÀ€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕ‰ì(€µ¥¸µİ¥‘Ñ èäÙÁà€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€€¹±½½­ÕÀµÁ…•ì(€€€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÄÕÁà¤€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹±½½­ÕÀµÁ…”€ø€¹ÍÉ½±°µÑ…‰±”°(€€¹±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€€€µ¥¸µ¡•¥¡ĞèĞÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÌĞÁÁà¤€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹±½½­ÕÀµÁ…•ì(€€€µ¥¸µ¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€€€µ¥¸µ¡•¥¡ĞèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô…É1½½­ÕÀMÁ±¥Ğ5•¹Ô€ôôôôô€¨¼(¹…Éµ±½½­ÕÀµÁ…•ì(€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÄÕÁà¤€…¥µÁ½ÉÑ…¹Ğì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸€…¥µÁ½ÉÑ…¹Ğì)ô((¹…Éµ±½½­ÕÀµÁ…”€ø€¹ÍÉ½±°µÑ…‰±”°(¹…Éµ±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€™±•àèÄ€Ä…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèĞÜÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÌĞÁÁà¤€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½Üé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹…Éµ±½½­ÕÀµÁ…•ì(€€€µ¥¸µ¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…Éµ±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€€€µ¥¸µ¡•¥¡ĞèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµ¡•¥¡Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôôU¹¥™¥•½İ¹±½…€¼AÉ¥¹Ğ	ÕÑÑ½¹Ì¥¹…°€ôôôôô€¨¼(¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(¹±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(¹…Éµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± È°(¹±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± È°(¹…Éµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± Éì(€©ÕÍÑ¥™äµÍ•±˜éÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì(€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì)ô((¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸°(¹±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸°(¹…Éµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸°(¹‰Õ±¬µÑÉ…¹Í™•Èµ‘½İ¹±½…°)‰ÕÑÑ½¹m½¹±¥¬¨ô‰‘½İ¹±½…‘á•°‰t°)‰ÕÑÑ½¹m½¹±¥¬¨ô‰‘½İ¹±½…‘A‘˜‰uì(€µ¥¸µİ¥‘Ñ èÄÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÀ€ÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÅÑ•à¤€…¥µÁ½ÉÑ…¹Ğì(€½±½Èè™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÉÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈÈ¤€…¥µÁ½ÉÑ…¹Ğì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•à€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì)ô((¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸é¡½Ù•È°(¹±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸é¡½Ù•È°(¹…Éµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸é¡½Ù•È°(¹‰Õ±¬µÑÉ…¹Í™•Èµ‘½İ¹±½…é¡½Ù•Éì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÅÁà¤ì(€™¥±Ñ•Èé‰É¥¡Ñ¹•ÍÌ Ä¸ÀÌ¤ì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹…Éµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± È°(€€¹±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± È°(€€¹…Éµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± Éì(€€€©ÕÍÑ¥™äµÍ•±˜é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹…É€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸°(€€¹±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¸°(€€¹…Éµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨ƒ²‚W®æ²†Ã¶j0ƒ²®. ƒ®Ê¶*ğƒ®²Û²v0ƒ¶×²vğ€¨¼(¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±€ø‘¥Ùì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµÍ•±˜é•¹€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€ø€¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±€ø‘¥Ùì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5…¥¹Ñ•¹…¹”1½½­ÕÀÑÑ…¡µ•¹ĞQ¡Õµ‰¹…¥°5…Ñ €ôôôôô€¨¼(¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ°(¹µ½‰¥±”µ…Éµ±¥ÍĞµµ…¥¹ÑÌ€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ°(¹µ…¥¹Ğµµ½‘…°µ…ÑÑ…¡µ•¹ÑÌ€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÁì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÙÁà€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€™±•àµİÉ…ÀéİÉ…À€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü°(¹µ½‰¥±”µ…Éµ±¥ÍĞµµ…¥¹ÑÌ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü°(¹µ…¥¹Ğµµ½‘…°µ…ÑÑ…¡µ•¹ÑÌ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€İ¥‘Ñ èĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€½Ù•É™±½Üé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è˜á™…™Œ€…¥µÁ½ÉÑ…¹Ğì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü¥µœ°(¹µ½‰¥±”µ…Éµ±¥ÍĞµµ…¥¹ÑÌ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü¥µœ°(¹µ…¥¹Ğµµ½‘…°µ…ÑÑ…¡µ•¹ÑÌ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü¥µì(€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€½‰©•Ğµ™¥Ğé½Ù•È€…¥µÁ½ÉÑ…¹Ğì)ô((¹µ…¥¹Ğµµ½‘…°µ…ÑÑ…¡µ•¹ÑÍì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÁÁàì(€µ…É¥¸èÄÉÁà€Àì(€Á…‘‘¥¹œèÄÁÁà€ÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ½‰¥±”µ…Éµ±¥ÍĞµµ…¥¹ÑÌ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€€€İ¥‘Ñ èÔÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèÔÙÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¹Ğµµ½‘…°µ…ÑÑ…¡µ•¹ÑÍì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèáÁàì(€ô)ô((¼¨€ôôôôô5…¥¹Ñ•¹…¹”M¡•‘Õ±”•…ÑÕÉ”€ôôôôô€¨¼(¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä°(¹Í¡•‘Õ±”µÍÑ…ÑÕÍì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€µ¥¸µİ¥‘Ñ èĞáÁàì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€Á…‘‘¥¹œèÕÁà€áÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô(¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä»ªâÓªâ%ì‰…­É½Õ¹è™•”É”Èì½±½ÈèˆäÅŒÅŒìô(¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä»®K²v1ì‰…­É½Õ¹è™™•‘Ôì½±½ÈèŒÈĞÄÁŒìô(¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä»®ÎÓ¶Õì‰…­É½Õ¹è”Á˜É™”ì½±½ÈèŒÀÌØå„Äìô(¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä»®
»²v1ì‰…­É½Õ¹è‘™”Üì½±½ÈèŒÄÔàÀÍìô(¹Í¡•‘Õ±”µÍÑ…ÑÕÌ»²b#²‚Uì‰…­É½Õ¹è™™•‘Ôì½±½ÈèŒÈĞÄÁŒìô(¹Í¡•‘Õ±”µÍÑ…ÑÕÌ»²¶Z'²’Eì‰…­É½Õ¹è‘‰•…™”ì½±½ÈèŒÅÑ•àìô(¹Í¡•‘Õ±”µÍÑ…ÑÕÌ»²f®1ì‰…­É½Õ¹è‘™”Üì½±½ÈèŒÄÔàÀÍìô(¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁ…”°(¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µ±¥ÍĞµÁ…•ì(€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÄÕÁà¤€…¥µÁ½ÉÑ…¹Ğì)ô(¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µ±¥ÍĞµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€™±•àèÄ€Ä…ÕÑ¼ì(€µ¥¸µ¡•¥¡ĞèĞÌÁÁàì(€µ…àµ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÌØÁÁà¤ì(€½Ù•É™±½Üé…ÕÑ¼ì)ô)µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁ…”°(€€¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µ±¥ÍĞµÁ…•ìµ¥¸µ¡•¥¡Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğìô(€€¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µ±¥ÍĞµÁ…”€¹ÍÉ½±°µÑ…‰±•ìµ¥¸µ¡•¥¡ĞèÀìµ…àµ¡•¥¡Ğé¹½¹”ìô)ô((¼¨€ôôôôô5…¥¹Ñ•¹…¹”M¡•‘Õ±”AÉ¼I•‘•Í¥¸€ôôôôô€¨¼(¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µÁ…”°(¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µ±¥ÍÑì(€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÄÁÁà¤ì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€Á…‘‘¥¹œèÈÉÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ĞÕÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄÀ¤ì)ô((¹Í¡•‘Õ±”µÁÉ¼µ¡•É¼°(¹Í¡•‘Õ±”µ±¥ÍĞµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄáÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µ•å•‰É½İì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€Á…‘‘¥¹œèÙÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€µ…É¥¸µ‰½ÑÑ½´èáÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µ¡•É¼ È°(¹Í¡•‘Õ±”µ±¥ÍĞµ¡•… Éì(€µ…É¥¸èÀì(€™½¹ĞµÍ¥é”èÈáÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÕÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µ¡•É¼À°(¹Í¡•‘Õ±”µ±¥ÍĞµ¡•…Áì(€µ…É¥¸èáÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Í¡•‘Õ±”µÁÉ¼µ¡½ÍĞ°(¹Í¡•‘Õ±”µ±¥ÍĞµ¡•…€ø‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€Á…‘‘¥¹œèÀ€ÄáÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÅÑ•à¤ì(€½±½Èè™™˜ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÈÕÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈÈ¤ì)ô((¹Í¡•‘Õ±”µÁÉ¼µ±…å½ÕÑì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Ä¸Ù™È¤µ¥¹µ…à ÌÈÁÁà°¸á™È¤ì(€…ÀèÄáÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…É°(¹Í¡•‘Õ±”µÁÉ¼µÁÉ•Ù¥•Ü°(¹Í¡•‘Õ±”µÑ…‰±”µ…É°(¹Í¡•‘Õ±”µ™¥±Ñ•Èµ…É‘ì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÄáÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…ÉµÑ¥Ñ±•ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÁÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…ÉµÑ¥Ñ±”‰ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…ÉµÑ¥Ñ±”ÍÁ…¹ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¡•‘Õ±”µÁÉ¼µÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÑÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…ÉÑ•áÑ…É•…ì(€µ¥¸µ¡•¥¡ĞèÄÄáÁàì(€É•Í¥é”éÙ•ÉÑ¥…°ì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€…ÀèÄÁÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€Á…‘‘¥¹œèÀ€ÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¡•‘Õ±”µÁÉ¼µÍ¥‘•ì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÑÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…É°(¹Í¡•‘Õ±”µÍÕµµ…Éäµ…É‘ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÄáÁàì(€‰½É‘•ÈèÅÁàÍ½±¥É‰„ ÄĞà°ÄØÌ°ÄàĞ°¸ÈÈ¤ì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…ÉÍÁ…¸°(¹Í¡•‘Õ±”µÍÕµµ…Éäµ…ÉÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€µ…É¥¸µ‰½ÑÑ½´èáÁàì)ô((¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…Éˆ°(¹Í¡•‘Õ±”µÍÕµµ…Éäµ…É‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€™½¹ĞµÍ¥é”èÌÁÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±¥¹”µ¡•¥¡ĞèÄì)ô((¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…ÉÍµ…±°°(¹Í¡•‘Õ±”µÍÕµµ…Éäµ…ÉÍµ…±±ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèáÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…É¹‰±Õ”°(¹Í¡•‘Õ±”µÍÕµµ…Éäµ…É¹‰±Õ•í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°•™˜Ù™˜°‘‰•…™”¤íô(¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…É¹É•°(¹Í¡•‘Õ±”µÍÕµµ…Éäµ…É¹É•‘í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°™™˜Å˜È°™•”É”È¤íô(¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…É¹É••¸°(¹Í¡•‘Õ±”µÍÕµµ…Éäµ…É¹É••¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°˜Á™‘˜Ğ°‘™”Ü¤íô(¹Í¡•‘Õ±”µÍÕµµ…Éäµ…É¹ÁÕÉÁ±•í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°˜Õ˜Í™˜°•‘”å™”¤íô((¹Í¡•‘Õ±”µÁÉ¼µÁÉ•Ù¥•ÜµÉ½İì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÉÁàì(€Á…‘‘¥¹œèÄÉÁà€Àì(€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€˜Å˜Õ˜äì)ô((¹Í¡•‘Õ±”µÁÉ¼µÁÉ•Ù¥•ÜµÉ½ÜÍÑÉ½¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¡•‘Õ±”µÁÉ¼µÁÉ•Ù¥•ÜµÉ½ÜÁì(€µ…É¥¸èÑÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Í¡•‘Õ±”µÁÉ¼µ•µÁÑåì(€Á…‘‘¥¹œèÈÑÁàì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€½±½ÈèŒäÑ„Íˆàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì)ô((¹Í¡•‘Õ±”µÍÕµµ…ÉäµÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÑÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì)ô((¹Í¡•‘Õ±”µ™¥±Ñ•Èµ…É‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ô±µ¥¹µ…à À°Å™È¤¤…ÕÑ¼ì(€…ÀèÄÉÁàì(€…±¥¸µ¥Ñ•µÌé•¹ì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì)ô((¹Í¡•‘Õ±”µÉ•Í•Ğµ‰Ñ¹ì(€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è”É”á˜Àì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€Á…‘‘¥¹œèÀ€ÄÙÁàì)ô((¹Í¡•‘Õ±”µÑ…‰±”µ…É‘ì(€Á…‘‘¥¹œèÀì(€½Ù•É™±½Üé¡¥‘‘•¸ì)ô((¹Í¡•‘Õ±”µÑ…‰±”µ…É€¹ÍÉ½±°µÑ…‰±•ì(€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÀ€…¥µÁ½ÉÑ…¹Ğì(€µ…àµ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ĞàÁÁà¤ì(€µ¥¸µ¡•¥¡ĞèÌØÁÁàì)ô((¹Í¡•‘Õ±”µÑ…‰±”µ…ÉÑ¡ì(€‰…­É½Õ¹è••˜Ñ™ˆ€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒÁ˜ÄÜÉ„€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÑ…‰±”µ…ÉÑ‘ì(€¡•¥¡ĞèĞÙÁàì)ô((¹Í¡•‘Õ±”µÉ½Üµ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€…ÀèÙÁàì)ô((¹Í¡•‘Õ±”µÉ½Üµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèÌÁÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèåÁàì(€Á…‘‘¥¹œèÀ€åÁàì(€‰…­É½Õ¹è”É”á˜Àì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¡•‘Õ±”µÉ½Üµ…Ñ¥½¹Ì€¹‘…¹•Éì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèˆäÅŒÅŒì)ô((¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä°(¹Í¡•‘Õ±”µÍÑ…ÑÕÍì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€µ¥¸µİ¥‘Ñ èÔÉÁàì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€Á…‘‘¥¹œèÕÁà€åÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô((¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä»ªâÓªâ%ì‰…­É½Õ¹è™•”É”Èì½±½ÈèˆäÅŒÅŒìô(¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä»®K²v1ì‰…­É½Õ¹è™™•‘Ôì½±½ÈèŒÈĞÄÁŒìô(¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä»®ÎÓ¶Õì‰…­É½Õ¹è‘‰•…™”ì½±½ÈèŒÅÑ•àìô(¹Í¡•‘Õ±”µÁÉ¥½É¥Ñä»®
»²v1ì‰…­É½Õ¹è‘™”Üì½±½ÈèŒÄÔàÀÍìô(¹Í¡•‘Õ±”µÍÑ…ÑÕÌ»²b#²‚Uì‰…­É½Õ¹è™™•‘Ôì½±½ÈèŒÈĞÄÁŒìô(¹Í¡•‘Õ±”µÍÑ…ÑÕÌ»²¶Z'²’Eì‰…­É½Õ¹è‘‰•…™”ì½±½ÈèŒÅÑ•àìô(¹Í¡•‘Õ±”µÍÑ…ÑÕÌ»²f®1ì‰…­É½Õ¹è‘™”Üì½±½ÈèŒÄÔàÀÍìô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì(€€¹Í¡•‘Õ±”µÁÉ¼µ±…å½ÕÑíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èíô(€€¹Í¡•‘Õ±”µÍÕµµ…ÉäµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤íô(€€¹Í¡•‘Õ±”µ™¥±Ñ•Èµ…É‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤íô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µÁ…”°(€€¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µ±¥ÍÑì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€€€µ¥¸µ¡•¥¡Ğé…ÕÑ¼ì(€ô((€€¹Í¡•‘Õ±”µÁÉ¼µ¡•É¼°(€€¹Í¡•‘Õ±”µ±¥ÍĞµ¡•…‘ì(€€€‘¥ÍÁ±…äéÉ¥ì(€ô((€€¹Í¡•‘Õ±”µÁÉ¼µ¡•É¼ È°(€€¹Í¡•‘Õ±”µ±¥ÍĞµ¡•… Éì(€€€™½¹ĞµÍ¥é”èÈÑÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹Í¡•‘Õ±”µÁÉ¼µÉ¥°(€€¹Í¡•‘Õ±”µÍÕµµ…ÉäµÉ¥°(€€¹Í¡•‘Õ±”µ™¥±Ñ•Èµ…É‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô((€€¹Í¡•‘Õ±”µÁÉ¼µ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô((€€¹Í¡•‘Õ±”µÑ…‰±”µ…É‘ì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹Í¡•‘Õ±”µµ½‰¥±”µ±¥ÍÑì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5…¥¹Ñ•¹…¹”M¡•‘Õ±”5½‘•É¸A½±¥Í €¬ÅÕ¥Áµ•¹ĞM•±•Ğ€ôôôôô€¨¼(¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µÁ…•ì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™…™Œ€À”°••˜Ñ™ˆ€ÄÀÀ”¤€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈèÅÁàÍ½±¥É‰„ ÄĞà°ÄØÌ°ÄàĞ°¸ÈĞ¤€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ¡•É½ì(€Á…‘‘¥¹œèÙÁà€ÑÁà€áÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ¡•É¼ Éì(€™½¹ĞµÍ¥é”èÌÁÁà€…¥µÁ½ÉÑ…¹Ğì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸áÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ±…å½ÕÑì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Ä¸ĞÕ™È¤µ¥¹µ…à ÌØÁÁà°¸ÜÕ™È¤€…¥µÁ½ÉÑ…¹Ğì(€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…É‘ì(€Á…‘‘¥¹œèÈÑÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈáÁà€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸äĞ¤€…¥µÁ½ÉÑ…¹Ğì(€‰½àµÍ¡…‘½ÜèÀ€ÈÁÁà€ØÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¤€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…ÉµÑ¥Ñ±”¹µ½‘•É¹ì(€Á…‘‘¥¹œèÀ€À€ÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜Ü€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…ÉµÑ¥Ñ±”¹µ½‘•É¸Íµ…±±ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÕÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Í¡•‘Õ±”µÁÉ¼µÉ¥‘ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€…ÀèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸µÑ½ÀèÄáÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…É€¹™¥•±±…‰•±ì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒÌÌĞÄÔÔ€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸µ‰½ÑÑ½´èİÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…É¥¹ÁÕĞ°(¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…ÉÍ•±•Ğ°(¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…ÉÑ•áÑ…É•…ì(€µ¥¸µ¡•¥¡ĞèĞáÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈèÅÁàÍ½±¥€á”Å•”€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèàÀÀ€…¥µÁ½ÉÑ…¹Ğì(€Á…‘‘¥¹œèÀ€ÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€ÑÉ…¹Í¥Ñ¥½¸è¸ÄáÌ•…Í”€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…ÉÑ•áÑ…É•…ì(€Á…‘‘¥¹œèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèÄÄÁÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…É¥¹ÁÕĞé™½ÕÌ°(¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…ÉÍ•±•Ğé™½ÕÌ°(¹Í¡•‘Õ±”µÁÉ¼µ™½É´µ…ÉÑ•áÑ…É•„é™½ÕÍì(€½ÕÑ±¥¹”é¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€‰½àµÍ¡…‘½ÜèÀ€À€À€ÑÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÄÈ¤€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µ•ÅÕ¥Áµ•¹Ğµ¡¥ÁÍì(€µ…É¥¸èÄÑÁà€À€ÄÙÁàì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèáÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€Á…‘‘¥¹œèÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì)ô((¹Í¡•‘Õ±”µ•ÅÕ¥Áµ•¹Ğµ¡¥ÁÌÍÁ…¹ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€µ…É¥¸µÉ¥¡ĞèÉÁàì)ô((¹Í¡•‘Õ±”µ•ÅÕ¥Áµ•¹Ğµ¡¥ÁÌ‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèÌÉÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€Á…‘‘¥¹œèÀ€ÄÉÁàì(€‰…­É½Õ¹è”Á•™˜ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¡•‘Õ±”µ•ÅÕ¥Áµ•¹Ğµ¡¥ÁÌ‰ÕÑÑ½¸é¡½Ù•Éì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€½±½Èè™™˜ì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…Ñ¥½¹Íì(€Á…‘‘¥¹œµÑ½ÀèÄÑÁàì(€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€••˜É˜Üì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…Ñ¥½¹Ì€¹ÁÉ¥µ…Éåì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÄÙ„ÌÑ„°ŒÄÔàÀÍ¤€…¥µÁ½ÉÑ…¹Ğì(€½±½Èè™™˜€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÈÑÁàÉ‰„ ÈÈ°ÄØÌ°ÜĞ°¸ÈĞ¤ì)ô((¹Í¡•‘Õ±”µÁÉ¼µ…Ñ¥½¹Ì‰ÕÑÑ½¸é¹½Ğ ¹ÁÉ¥µ…Éä¥ì(€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€‰…­É½Õ¹è”É”á˜À€…¥µÁ½ÉÑ…¹Ğì(€½±½ÈèŒÌÌĞÄÔÔ€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µÍ¥‘•ì(€…ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…É‘ì(€µ¥¸µ¡•¥¡ĞèÄÀÙÁà€…¥µÁ½ÉÑ…¹Ğì(€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µµ¥¹¤µ…É‰ì(€™½¹ĞµÍ¥é”èÌÉÁà€…¥µÁ½ÉÑ…¹Ğì)ô((¹Í¡•‘Õ±”µÁÉ¼µÁÉ•Ù¥•İì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁà€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÈÀÁÁà¥ì(€€¹Í¡•‘Õ±”µÁÉ¼µ±…å½ÕÑì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹Í¡•‘Õ±”µÁÉ¼µÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹Í¡•‘Õ±”µÁÉ¼µÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹Í¡•‘Õ±”µ•ÅÕ¥Áµ•¹Ğµ¡¥ÁÍì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô((€€¹Í¡•‘Õ±”µ•ÅÕ¥Áµ•¹Ğµ¡¥ÁÌÍÁ…¹ì(€€€É¥µ½±Õµ¸èÄ€¼€´Äì(€ô((€€¹Í¡•‘Õ±”µÁÉ¼µ…Ñ¥½¹Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô)ô(((¼¨€ôôôôôAÕÉ¡…Í”%Ñ•´•Ñ…¥°5½‘…°€ôôôôô€¨¼(¹ÁÕÉ¡…Í”µ¥Ñ•´µ‘•Ñ…¥°µ‰ÕÑÑ½¹ì(€‰½É‘•ÈèÀì(€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹Ğé¥¹¡•É¥Ğì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€Á…‘‘¥¹œèÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€Ñ•áĞµ‘•½É…Ñ¥½¸éÕ¹‘•É±¥¹”ì(€Ñ•áĞµÕ¹‘•É±¥¹”µ½™™Í•ĞèÍÁàì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µµ½‘…°µ‰…­‘É½Áì(€Á½Í¥Ñ¥½¸é™¥á•ì(€¥¹Í•ĞèÀì(€èµ¥¹‘•àèÄÀÀÀÀì(€‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ĞÔ¤ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€Á…‘‘¥¹œèÄáÁàì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µµ½‘…±ì(€İ¥‘Ñ éµ¥¸ äàÁÁà°äÙÙÜ¤ì(€µ…àµ¡•¥¡ĞèàáÙ ì(€½Ù•É™±½Üé…ÕÑ¼ì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÈÁÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€äÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÌÔ¤ì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µµ½‘…°µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÑÁàì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µµ½‘…°µ¡•… Éì(€µ…É¥¸èÀì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€½±½ÈèŒÁ˜ÄÜÉ„ì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µµ½‘…°µ¡•…Áì(€µ…É¥¸èÙÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µµ½‘…°µ¡•…‰ÕÑÑ½¹ì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€Á…‘‘¥¹œèÄÁÁà€ÄÑÁàì(€‰…­É½Õ¹è”É”á˜Àì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µÑ…‰±”Ñ¡ì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µÑ½Ñ…±ì(€‘¥ÍÁ±…äé™±•àì(€™±•àµİÉ…ÀéİÉ…Àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€…ÀèÄÁÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µÑ½Ñ…°ÍÁ…¸°(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µÑ½Ñ…°‰ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€µ¥¸µ¡•¥¡ĞèÌáÁàì(€Á…‘‘¥¹œèÀ€ÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹ÁÕÉ¡…Í”µ‘•Ñ…¥°µÑ½Ñ…°‰ì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì)ô((¼¨€ôôôôô!½µ”…Í¡‰½…ÉAÉ¼I•‘•Í¥¸€ôôôôô€¨¼(¹‘…Í¡‰½…ÉµÁÉ¼µİÉ…Áì(€Á…‘‘¥¹œèÈÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™…™Œ€À”°••˜Ñ™ˆ€ÄÀÀ”¤ì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ÔÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄÀ¤ì(€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÄÁÁà¤ì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ¡•É½ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄáÁàì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ¡•É¼ÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€Á…‘‘¥¹œèÙÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ¡•É¼ Éì(€µ…É¥¸èáÁà€À€ÑÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÌÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ¡•É¼Áì(€µ…É¥¸èÀì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ‘…Ñ•ì(€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€Á…‘‘¥¹œèÀ€ÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™™˜ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¥Íì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÑÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¥ì(€Ñ•áĞµ…±¥¸é±•™Ğì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÄáÁàì(€µ¥¸µ¡•¥¡ĞèÄÈáÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÄÑÁà€ÌÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¤ì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤ÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÈáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤•µì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèáÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤¹‰±Õ•í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°•™˜Ù™˜°‘‰•…™”¤íô(¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤¹É•‘í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°™™˜Å˜È°™•”É”È¤íô(¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤¹É••¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°˜Á™‘˜Ğ°‘™”Ü¤íô(¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤¹ÁÕÉÁ±•í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°˜Õ˜Í™˜°•‘”å™”¤íô((¹‘…Í¡‰½…ÉµÁÉ¼µµ…¥¹ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Ä¸ØÕ™È¤µ¥¹µ…à ÌÌÁÁà°¸ÜÕ™È¤ì(€…ÀèÄÙÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ±•™Ğ°(¹‘…Í¡‰½…ÉµÁÉ¼µÉ¥¡Ñì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÙÁàì(€…±¥¸µ½¹Ñ•¹ĞéÍÑ…ÉĞì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÍÁ±¥Ñì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€…ÀèÄÙÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•±ì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÄÙÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì(€½Ù•É™±½Üé¡¥‘‘•¸ì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•°µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÉÁàì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•° Íì(€µ…É¥¸èÀì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•°Áì(€µ…É¥¸èÕÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•°µ¡•…‰ÕÑÑ½¹ì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€µ¥¸µ¡•¥¡ĞèÌÑÁàì(€Á…‘‘¥¹œèÀ€ÄÉÁàì(€‰…­É½Õ¹è”Á•™˜ì(€½±½ÈèŒÅÑ•àì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‘…Í¡‰½…ÉµÍ¡•‘Õ±”µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèáÁàì)ô((¹‘…Í¡‰½…ÉµÍ¡•‘Õ±”µÉ½İì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼…ÕÑ¼ì(€…ÀèÄÁÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€Á…‘‘¥¹œèÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈèÅÁàÍ½±¥€•‘˜É˜Üì)ô((¹‘…Í¡‰½…ÉµÍ¡•‘Õ±”µÉ½ÜÍÑÉ½¹ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‘…Í¡‰½…ÉµÍ¡•‘Õ±”µÉ½ÜÁì(€µ…É¥¸èÑÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±•ì(€İ¥‘Ñ èÄÀÀ”ì(€‰½É‘•Èµ½±±…ÁÍ”é½±±…ÁÍ”ì(€™½¹ĞµÍ¥é”èÄÍÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ¡ì(€‰…­É½Õ¹è••˜Ñ™ˆì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€Á…‘‘¥¹œèÄÁÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ‘ì(€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€˜Å˜Õ˜äì(€Á…‘‘¥¹œèÄÁÁàì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µ™••°(¹‘…Í¡‰½…Éµµ¥¹¤µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÁÁàì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½İì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔáÁà€Å™Èì(€…ÀèÄÁÁàì(€Ñ•áĞµ…±¥¸é±•™Ğì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€Á…‘‘¥¹œèÄÁÁàì(€‰…­É½Õ¹è˜á™…™Œì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÑ¡Õµ‰ì(€İ¥‘Ñ èÔáÁàì(€¡•¥¡ĞèÔáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è”É”á˜Àì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÑ¡Õµˆ¥µì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÄÀÀ”ì(€½‰©•Ğµ™¥Ğé½Ù•Èì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÍÑÉ½¹œ°(¹‘…Í¡‰½…Éµµ¥¹¤µÉ½Ü‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÀ°(¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÍµ…±°°(¹‘…Í¡‰½…Éµµ¥¹¤µÉ½Ü•µì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÍÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹‘…Í¡‰½…Éµµ¥¹¤µÉ½İì(€Á…‘‘¥¹œèÄÁÁà€Àì(€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€˜Å˜Õ˜äì)ô((¹‘…Í¡‰½…Éµµ¥¹¤µÉ½ÜÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€µ…É¥¸µ‰½ÑÑ½´èÍÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ•µÁÑåì(€Á…‘‘¥¹œèÈÉÁàì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€½±½ÈèŒäÑ„Íˆàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€‰…­É½Õ¹è˜á™…™Œì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÄÈÀÁÁà¥ì(€€¹‘…Í¡‰½…ÉµÁÉ¼µµ…¥¸°(€€¹‘…Í¡‰½…ÉµÁÉ¼µÍÁ±¥Ñì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô(€€¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¥Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤ì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‘…Í¡‰½…ÉµÁÉ¼µİÉ…Áì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€µ¥¸µ¡•¥¡Ğé…ÕÑ¼ì(€ô(€€¹‘…Í¡‰½…ÉµÁÉ¼µ¡•É½ì(€€€‘¥ÍÁ±…äéÉ¥ì(€ô(€€¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¥Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô(€€¹‘…Í¡‰½…ÉµÍ¡•‘Õ±”µÉ½İì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô((¼¨€ôôôôô…Í¡‰½…É5½‰¥±”Q•áĞ=Ù•É™±½Ü¥à€¬I••¹ĞAÕÉ¡…Í•Ì€ôôôôô€¨¼(¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±•ì(€Ñ…‰±”µ±…å½ÕĞé™¥á•ì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ °(¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ‘ì(€İ½Éµ‰É•…¬é­••Àµ…±°ì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô((¹‘…Í¡‰½…ÉµÁÕÉ¡…Í”µÙ•¹‘½ÈµÉ½İì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄ¸ÈÕ™È€¸ÜÕ™Èì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•±ì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…­ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬Ñ¡•…‘ì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬Ñ‰½‘åì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèÄÁÁàì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬ÑÉì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèÙÁàì(€€€Á…‘‘¥¹œèÄÉÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬Ñ‘ì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÜÑÁà€Å™Èì(€€€…ÀèáÁàì(€€€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ½Ù•É™±½Üé±¥À€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é‰É•…¬µİ½É€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬Ñèé‰•™½É•ì(€€€½¹Ñ•¹Ğé…ÑÑÈ¡‘…Ñ„µ±…‰•°¤ì(€€€½±½ÈèŒØĞÜĞáˆì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬Ñ¹É¥¡Ñì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ°(€€¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ¡ì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹‘…Í¡‰½…ÉµÁÕÉ¡…Í”µÙ•¹‘½ÈµÉ½İì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5½‰¥±”…Í¡‰½…ÉA½±¥Í €¬U$½¹Í¥ÍÑ•¹ä€ôôôôô€¨¼(¹‘…Í¡‰½…ÉµÁÉ¼µİÉ…Áì(€Á…‘‘¥¹œèÈÁÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•±ì(€ÑÉ…¹Í¥Ñ¥½¸é…±°€¸ÄáÌ•…Í”ì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•°é¡½Ù•Éì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÉÁà¤ì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ÌáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄÀ¤ì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•° Íì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÑÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•°µ¡•…‰ÕÑÑ½¸°(¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤°(¹•á•°µ‘½İ¹±½…µ‰Ñ¸°(¹Á‘˜µ‘½İ¹±½…µ‰Ñ¹ì(€ÑÉ…¹Í¥Ñ¥½¸é…±°€¸ÄÕÌ•…Í”ì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•°µ¡•…‰ÕÑÑ½¸é¡½Ù•È°(¹•á•°µ‘½İ¹±½…µ‰Ñ¸é¡½Ù•È°(¹Á‘˜µ‘½İ¹±½…µ‰Ñ¸é¡½Ù•Éì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÅÁà¤ì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ¡ì(€¡•¥¡ĞèĞÉÁàì(€™½¹ĞµÍ¥é”èÄÍÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ‘ì(€¡•¥¡ĞèĞÉÁàì(€™½¹ĞµÍ¥é”èÄÍÁàì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½İì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÍÑÉ½¹ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€±¥¹”µ¡•¥¡ĞèÄ¸Èì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÁì(€™½¹ĞµÍ¥é”èÄÅÁàì)ô((¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÍµ…±±ì(€™½¹ĞµÍ¥é”èÄÁÁàì)ô((¹‘…Í¡‰½…Éµµ¥¹¤µÉ½İì(€Á…‘‘¥¹œèÄÉÁà€Àì)ô((¹‘…Í¡‰½…Éµµ¥¹¤µÉ½Ü‰ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€±¥¹”µ¡•¥¡ĞèÄ¸Ìì)ô((¹‘…Í¡‰½…Éµµ¥¹¤µÉ½Ü•µì(€™½¹ĞµÍ¥é”èÄÅÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¥ì(€µ¥¸µ¡•¥¡ĞèÄÄáÁàì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤‰ì(€±¥¹”µ¡•¥¡ĞèÄì)ô((¹‘…Í¡‰½…ÉµÁÉ¼µ•µÁÑåì(€µ¥¸µ¡•¥¡ĞèàáÁàì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‘…Í¡‰½…ÉµÁÉ¼µİÉ…Áì(€€€Á…‘‘¥¹œèÄÉÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ¡•É½ì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ¡•É¼ Éì(€€€™½¹ĞµÍ¥é”èÈÑÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ¡•É¼Áì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Ğì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ‘…Ñ•ì(€€€İ¥‘Ñ éµ…àµ½¹Ñ•¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€µ¥¸µ¡•¥¡ĞèÌÑÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¥Íì(€€€…ÀèÄÁÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¥ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€€€µ¥¸µ¡•¥¡Ğé…ÕÑ¼ì(€€€Á…‘‘¥¹œèÄÑÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤ÍÁ…¹ì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èáÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤‰ì(€€€™½¹ĞµÍ¥é”èÈÑÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ­Á¤•µì(€€€µ…É¥¸µÑ½ÀèÙÁàì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µµ…¥¸°(€€¹‘…Í¡‰½…ÉµÁÉ¼µ±•™Ğ°(€€¹‘…Í¡‰½…ÉµÁÉ¼µÉ¥¡Ğ°(€€¹‘…Í¡‰½…ÉµÁÉ¼µÍÁ±¥Ñì(€€€…ÀèÄÉÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•±ì(€€€Á…‘‘¥¹œèÄÉÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•°µ¡•…‘ì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•°µ¡•…‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÌÁÁàì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€€€Á…‘‘¥¹œèÀ€ÄÁÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µÁ…¹•° Íì(€€€™½¹ĞµÍ¥é”èÄİÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ°(€€¹‘…Í¡‰½…ÉµÁÉ¼µÑ…‰±”Ñ¡ì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬Ñ‰½‘åì(€€€…ÀèáÁàì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬ÑÉì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€Á…‘‘¥¹œèÄÁÁàì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬Ñ‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèØÉÁà€Å™Èì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì(€ô((€€¹‘…Í¡‰½…Éµµ½‰¥±”µÍÑ…¬Ñèé‰•™½É•ì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µ™••‘ì(€€€…ÀèáÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½İì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔÉÁà€Å™Èì(€€€Á…‘‘¥¹œèáÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÑ¡Õµ‰ì(€€€İ¥‘Ñ èÔÉÁàì(€€€¡•¥¡ĞèÔÉÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÍÑÉ½¹ì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÁì(€€€™½¹ĞµÍ¥é”èÄÁÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁ¡½Ñ¼µÉ½ÜÍµ…±±ì(€€€‘¥ÍÁ±…äèµİ•‰­¥Ğµ‰½àì(€€€€µİ•‰­¥Ğµ±¥¹”µ±…µÀèÈì(€€€€µİ•‰­¥Ğµ‰½àµ½É¥•¹ĞéÙ•ÉÑ¥…°ì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€ô((€€¹‘…Í¡‰½…Éµµ¥¹¤µÉ½İì(€€€Á…‘‘¥¹œèÄÁÁà€Àì(€ô((€€¹‘…Í¡‰½…Éµµ¥¹¤µÉ½Ü‰ì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€ô((€€¹‘…Í¡‰½…Éµµ¥¹¤µÉ½Ü•µì(€€€™½¹ĞµÍ¥é”èÄÁÁàì(€ô((€€¹‘…Í¡‰½…ÉµÍ¡•‘Õ±”µÉ½İì(€€€Á…‘‘¥¹œèÄÁÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€ô((€€¹‘…Í¡‰½…ÉµÍ¡•‘Õ±”µÉ½ÜÍÑÉ½¹ì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€ô((€€¹‘…Í¡‰½…ÉµÍ¡•‘Õ±”µÉ½ÜÁì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€ô((€€¹‘…Í¡‰½…ÉµÁÉ¼µ•µÁÑåì(€€€µ¥¸µ¡•¥¡ĞèÜÉÁàì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€ô((€€¼¨ƒ²‚²ÊĞƒ®¦S®&ĞU$ƒ¶×²vğ€¨¼(€€¹•á•°µ‘½İ¹±½…µ‰Ñ¸°(€€¹Á‘˜µ‘½İ¹±½…µ‰Ñ¹ì(€€€µ¥¸µ¡•¥¡ĞèÌÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÀ€ÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€Ñ…‰±•ì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€ô((€¥¹ÁÕĞ°(€Í•±•Ğ°(€Ñ•áÑ…É•…ì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€Ñ•áÑ…É•…ì(€€€µ¥¸µ¡•¥¡ĞèàÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5½‰¥±”1½½­ÕÀ…É‘Ìè5…¥¹Ñ•¹…¹”€¼…ÉUÍ”5…Ñ AÕÉ¡…Í”MÑå±”€ôôôôô€¨¼)µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¼¨ƒ²‚W®æ²†Ã¶j0¿²æÓ®Ns²†Ã¶j0ƒªÎ×¶Ôƒ²æÓ®Ns¶fP€¨¼(€€¹µ½‰¥±”µ…Éµ±¥ÍĞ°(€€¹µ½‰¥±”µ…Éµ±¥ÍĞµµ…¥¹ÑÌ°(€€¹µ½‰¥±”µ…Éµ±¥ÍĞµ…É‘Íì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µÑ½ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ…É°(€€¹µ½‰¥±”µµ…¥¹Ğµ…É°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ…É‘ì(€€€‰…­É½Õ¹è™™™™™˜€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÜ¤€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµÑ½À°(€€¹µ½‰¥±”µµ…¥¹Ğµ…ÉµÑ½À°(€€¹µ½‰¥±”µ…ÉµÕÍ”µÑ½Áì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜Ü€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµÑ½Àˆ°(€€¹µ½‰¥±”µµ…¥¹Ğµ…ÉµÑ½Àˆ°(€€¹µ½‰¥±”µ…ÉµÕÍ”µÑ½À‰ì(€€€½±½ÈèŒÁ˜ÄÜÉ„€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄİÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÔ€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é­••Àµ…±°€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜµİÉ…Àé…¹åİ¡•É”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµÑ½ÀÍÁ…¸°(€€¹µ½‰¥±”µµ…¥¹Ğµ…ÉµÑ½ÀÍÁ…¸°(€€¹µ½‰¥±”µ…ÉµÕÍ”µÑ½ÀÍÁ…¹ì(€€€™±•àèÀ€À…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÕÁà€åÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è•™˜Ù™˜€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒÅÑ•à€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘ä°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ‰½‘ä°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ‰½‘åì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘ä€ø‘¥Ø°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ‰½‘ä€ø‘¥Ø°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ‰½‘ä€ø‘¥Ùì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è˜á™…™Œ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘ä±…‰•°°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ‰½‘ä±…‰•°°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ‰½‘ä±…‰•±ì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µ‰½ÑÑ½´èÕÁà€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒØĞÜĞáˆ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘äÀ°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ‰½‘äÀ°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ‰½‘äÁì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒÁ˜ÄÜÉ„€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔ€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é­••Àµ…±°€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜµİÉ…Àé…¹åİ¡•É”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘ä€¹İ¥‘”°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ‰½‘ä€¹İ¥‘”°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ‰½‘ä€¹İ¥‘”°(€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘ä€ø‘¥Øé±…ÍĞµ¡¥±é¹Ñ µ¡¥±¡½‘¤°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ‰½‘ä€ø‘¥Øé±…ÍĞµ¡¥±é¹Ñ µ¡¥±¡½‘¤°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ‰½‘ä€ø‘¥Øé±…ÍĞµ¡¥±é¹Ñ µ¡¥±¡½‘¥ì(€€€É¥µ½±Õµ¸èÄ€¼€´Ä€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ…Éµ…Ñ¥½¹Ì°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ…Ñ¥½¹Ì°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à àÉÁà°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µÑ½ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¸°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¸°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÀ€áÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è”É”á˜À€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒÁ˜ÄÜÉ„€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¸é™¥ÉÍĞµ¡¥±°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¸é™¥ÉÍĞµ¡¥±°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ…Ñ¥½¹Ì‰ÕÑÑ½¸é™¥ÉÍĞµ¡¥±‘ì(€€€‰…­É½Õ¹è‘‰•…™”€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒÅÑ•à€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¸é±…ÍĞµ¡¥±°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¸é±…ÍĞµ¡¥±°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ…Ñ¥½¹Ì‰ÕÑÑ½¸é±…ÍĞµ¡¥±‘ì(€€€‰…­É½Õ¹è™•”É”È€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèˆäÅŒÅŒ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¼¨ƒ²‚W®æ²†Ã¶j0¿²æÓ®Ns²†Ã¶j3®*Pƒ®ª£®ÂS²vó²^C²pAƒ¶Fpƒ²"£ªâÃªÎ€ƒ²æÓ®Npƒ²jÃ²€€¨¼(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±”°(€€¹…Éµ±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€€€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ½‰¥±”µ…Éµ±¥ÍĞ°(€€¹…Éµ±½½­ÕÀµÁ…”€¹µ½‰¥±”µ…Éµ±¥ÍÑì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¼¨ƒªâ#²V„¿¶V§ªÎƒªÂW²†À€¨¼(€€¹µ½‰¥±”µ…ÉµÕÍ”µ‰½‘äÀ¹…µ½Õ¹Ğ°(€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘äÀ¹…µ½Õ¹Ğ°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ‰½‘äÀ¹…µ½Õ¹Ñì(€€€½±½ÈèŒÅÑ•à€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÕÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¼¨ƒ²
³²½A¿²v3²Äƒ²Ê£®Ú ƒ²6ã®“²vğ€¨¼(€€¹µ½‰¥±”µµ…¥¹Ğµ…É€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ°(€€¹µ½‰¥±”µ±¥ÍĞµ…É€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÁì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µµ…¥¹Ğµ…É€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü°(€€¹µ½‰¥±”µ±¥ÍĞµ…É€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€€€İ¥‘Ñ èÔÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèÔÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èÌäÁÁà¥ì(€€¹µ½‰¥±”µ±¥ÍĞµ‰½‘ä°(€€¹µ½‰¥±”µµ…¥¹Ğµ…Éµ‰½‘ä°(€€¹µ½‰¥±”µ…ÉµÕÍ”µ‰½‘åì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµÑ½À°(€€¹µ½‰¥±”µµ…¥¹Ğµ…ÉµÑ½À°(€€¹µ½‰¥±”µ…ÉµÕÍ”µÑ½Áì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‰¥±”µ±¥ÍĞµÑ½ÀÍÁ…¸°(€€¹µ½‰¥±”µµ…¥¹Ğµ…ÉµÑ½ÀÍÁ…¸°(€€¹µ½‰¥±”µ…ÉµÕÍ”µÑ½ÀÍÁ…¹ì(€€€İ¥‘Ñ éµ…àµ½¹Ñ•¹Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô	…­ÕÀ…¹A•Éµ¥ÍÍ¥½¸A…”€ôôôôô€¨¼(¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÁ…•ì(€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÄÁÁà¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€Á…‘‘¥¹œèÈÉÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™…™Œ€À”°••˜Ñ™ˆ€ÄÀÀ”¤ì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ÔÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄÀ¤ì)ô((¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É½ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄáÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É¼ÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€Á…‘‘¥¹œèÙÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É¼ Éì(€µ…É¥¸èáÁà€À€ÑÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÌÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É¼Áì(€µ…É¥¸èÀì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€…ÀèÄÙÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì)ô((¹‰…­ÕÀµ…É°(¹Á•Éµ¥ÍÍ¥½¸µ…É‘ì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÄáÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹‰…­ÕÀµ…É Ì°(¹Á•Éµ¥ÍÍ¥½¸µ…É Íì(€µ…É¥¸èÀ€À€áÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÈÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰…­ÕÀµ…ÉÀ°(¹Á•Éµ¥ÍÍ¥½¸µ…ÉÁì(€µ…É¥¸èÀ€À€ÄÑÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹‰…­ÕÀµÍÑ…ĞµÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ°Å™È¤ì(€…ÀèÄÁÁàì(€µ…É¥¸èÄÑÁà€Àì)ô((¹‰…­ÕÀµÍÑ…ĞµÉ¥‘¥Ùì(€Á…‘‘¥¹œèÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è˜á™…™Œì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô((¹‰…­ÕÀµÍÑ…ĞµÉ¥‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÈÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰…­ÕÀµÍÑ…ĞµÉ¥ÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÑÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹‰…­ÕÀµ…Ñ¥½¹Ì°(¹Á•Éµ¥ÍÍ¥½¸µ™½Éµì(€‘¥ÍÁ±…äé™±•àì(€…ÀèÄÁÁàì(€…±¥¸µ¥Ñ•µÌé•¹ì(€™±•àµİÉ…ÀéİÉ…Àì)ô((¹‰…­ÕÀµ…É‰ÕÑÑ½¸°(¹Á•Éµ¥ÍÍ¥½¸µ…É‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€Á…‘‘¥¹œèÀ€ÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰…­É½Õ¹è”É”á˜Àì(€½±½ÈèŒÁ˜ÄÜÉ„ì)ô((¹‰…­ÕÀµ…É‰ÕÑÑ½¸¹ÁÉ¥µ…Éä°(¹Á•Éµ¥ÍÍ¥½¸µ…É‰ÕÑÑ½¸¹ÁÉ¥µ…Éåì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÅÑ•à¤ì(€½±½Èè™™˜ì)ô((¹‰…­ÕÀµ…É‰ÕÑÑ½¸¹‘…¹•È°(¹Á•Éµ¥ÍÍ¥½¸µ…É‰ÕÑÑ½¸¹‘…¹•Éì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèˆäÅŒÅŒì)ô((¹‘…¹•Èµé½¹•ì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°™™˜°™™˜Å˜È¤ì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµ…É‘ì(€É¥µ½±Õµ¸èÄ€¼€´Äì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°™™˜°˜á™‰™˜¤ì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµÍÑ…ÑÍì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤ì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèİÁàì(€µ…àµ¡•¥¡ĞèÌÌÁÁàì(€½Ù•É™±½Üé…ÕÑ¼ì(€µ…É¥¸èÄÉÁà€À€ÄÑÁàì(€Á…‘‘¥¹œèÄÉÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è˜á™…™Œì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞ‘¥Ùì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄÌÁÁàµ¥¹µ…à À°Å™È¤€äÁÁà€ÔáÁàì(€…ÀèÄÁÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€µ¥¸µİ¥‘Ñ èÀì(€Á…‘‘¥¹œèİÁà€áÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€‰…­É½Õ¹è™™˜ì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞÍÁ…¸°(¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞ•µì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞ‰ì(€µ¥¸µİ¥‘Ñ èÀì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞ•µì(€Ñ•áĞµ…±¥¸éÉ¥¡Ğì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞ‘¥Øù‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèÌÁÁàì(€Á…‘‘¥¹œèÀ€åÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰™‘‰™”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèåÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô((¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞÁì(€µ…É¥¸èÀì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô((¹Á•Éµ¥ÍÍ¥½¸µ¡•­Íì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèáÁàì(€µ…É¥¸èÄÙÁà€Àì(€Á…‘‘¥¹œèÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è˜á™…™Œì)ô((¹Á•Éµ¥ÍÍ¥½¸µ¡•­Ì±…‰•±ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèáÁàì(€Á…‘‘¥¹œèåÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è™™˜ì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€½±½ÈèŒÌÌĞÄÔÔì)ô((¹Á•Éµ¥ÍÍ¥½¸µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÁÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô((¹Á•Éµ¥ÍÍ¥½¸µÉ½İì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼…ÕÑ¼…ÕÑ¼ì(€…ÀèÄÁÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€Á…‘‘¥¹œèÄÉÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è™™˜ì)ô((¹Á•Éµ¥ÍÍ¥½¸µÉ½Ü‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Á•Éµ¥ÍÍ¥½¸µÉ½ÜÍÁ…¸°(¹Á•Éµ¥ÍÍ¥½¸µÉ½Ü•µì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÁ…•ì(€€€Á…‘‘¥¹œèÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô(€€¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô(€€¹‰…­ÕÀµÍÑ…ĞµÉ¥°(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•­Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½İì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô(€€¹Á•Éµ¥ÍÍ¥½¸µ™½Éµì(€€€‘¥ÍÁ±…äéÉ¥ì(€ô(€€¹ÍÑ½É…”µ±•…¹ÕÀµÍÑ…ÑÍì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤ì(€ô(€€¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞ‘¥Ùì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèàÉÁàµ¥¹µ…à À°Å™È¤€ÔÙÁà€ĞáÁàì(€€€…ÀèİÁàì(€ô)ô((¼¨€ôôôôôA•Éµ¥ÍÍ¥½¸İ…É”5•¹Ô!¥‘”€ôôôôô€¨¼(¹Á•Éµ¥ÍÍ¥½¸µ…İ…É”µµ½‰¥±”µ¹…Ùì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à ÜÙÁà°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹Á•Éµ¥ÍÍ¥½¸µ…İ…É”µµ•¹Ô€¹µ•¹ÔµÉ½ÕÀ°(€€¹Á•Éµ¥ÍÍ¥½¸µ…İ…É”µµ•¹Ô€ø‰ÕÑÑ½¹ì(€€€‘¥ÍÁ±…äé¹½¹”ì(€ô)ô((¼¨€ôôôôô5½‰¥±”A•Éµ¥ÍÍ¥½¸	½ÑÑ½´9…Ø¥¹…°€ôôôôô€¨¼(¹Á•Éµ¥ÍÍ¥½¸µ…İ…É”µµ½‰¥±”µ¹…Ùì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à ÜÉÁà°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì)ô(¹Á•Éµ¥ÍÍ¥½¸µ…İ…É”µµ½‰¥±”µ¹…Ø‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì)ô((¼¨€ôôôôôM¥Ñ”9½Ñ¥”•…ÑÕÉ”€ôôôôô€¨¼(¹Í¥Ñ”µ¹½Ñ¥”µÁ…•ì(€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÄÁÁà¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€Á…‘‘¥¹œèÈÉÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™…™Œ€À”°••˜Ñ™ˆ€ÄÀÀ”¤ì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ÔÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄÀ¤ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ¡•É½ì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ¡•É¼ÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€Á…‘‘¥¹œèÙÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ¡•É¼ Éì(€µ…É¥¸èáÁà€À€ÑÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÌÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ¡•É¼Áì(€µ…É¥¸èÀì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ™½É´µ…É°(¹Í¥Ñ”µ¹½Ñ¥”µ…É‘ì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÄáÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ™½É´µ…É‘ì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ™½É´µ¡•… Íì(€µ…É¥¸èÀ€À€ÙÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÈÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ™½É´µ¡•…Áì(€µ…É¥¸èÀ€À€ÄÑÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ™½É´µÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄàÁÁà€ÄØÁÁà€Å™Èì(€…ÀèÄÉÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ™½É´µ…ÉÑ•áÑ…É•…ì(€µ¥¸µ¡•¥¡ĞèÄÄÁÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…Ñ¥½¹Ì°(¹Í¥Ñ”µ¹½Ñ¥”µ…Éµ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÉÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…Ñ¥½¹Ì‰ÕÑÑ½¸°(¹Í¥Ñ”µ¹½Ñ¥”µ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€Á…‘‘¥¹œèÀ€ÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰…­É½Õ¹è”É”á˜Àì(€½±½ÈèŒÁ˜ÄÜÉ„ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…Ñ¥½¹Ì€¹ÁÉ¥µ…Éåì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÅÑ•à¤ì(€½±½Èè™™˜ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…Éµ…Ñ¥½¹Ì€¹‘…¹•Éì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèˆäÅŒÅŒì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄÉÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…ÉµÑ½Áì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÁÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…ÉµÑ½ÀÍÁ…¹ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…ÉµÑ½À•µì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€Á…‘‘¥¹œèÕÁà€ÄÁÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…É»ªâÓªâ$€¹Í¥Ñ”µ¹½Ñ¥”µ…ÉµÑ½À•µì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèˆäÅŒÅŒì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…É»²’G²jP€¹Í¥Ñ”µ¹½Ñ¥”µ…ÉµÑ½À•µì(€‰…­É½Õ¹è™™•‘Ôì(€½±½ÈèŒÈĞÄÁŒì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…É Íì(€µ…É¥¸èÀ€À€áÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ…ÉÁì(€µ…É¥¸èÀì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÔÔì(€İ¡¥Ñ”µÍÁ…”éÁÉ”µİÉ…Àì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ¥¹¤•µì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÑÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹Í¥Ñ”µ¹½Ñ¥”µÁ…•ì(€€€Á…‘‘¥¹œèÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô((€€¹Í¥Ñ”µ¹½Ñ¥”µ™½É´µÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô((€€¹Í¥Ñ”µ¹½Ñ¥”µ…Ñ¥½¹Ì°(€€¹Í¥Ñ”µ¹½Ñ¥”µ…Éµ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô)ô((¼¨€ôôôôôM¥Ñ”9½Ñ¥”5½‘•É¸I•‘•Í¥¸€ôôôôô€¨¼(¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÁ…•ì(€µ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÄÁÁà¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÙÁàì(€Á…‘‘¥¹œèÈÑÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™…™Œ€À”°•‘˜Ñ™˜€ÄÀÀ”¤ì(€‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ÔÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄÀ¤ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄáÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ¡•…ÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€Á…‘‘¥¹œèÙÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ¡•… Éì(€µ…É¥¸èáÁà€À€ÑÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÌÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸áÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ¡•…Áì(€µ…É¥¸èÀì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÍÕµµ…Éåì(€µ¥¸µİ¥‘Ñ èÄØÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÄÙÁàì(€‰…­É½Õ¹è™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¤ì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÍÕµµ…Éä‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÌÑÁàì(€±¥¹”µ¡•¥¡ĞèÄì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÍÕµµ…Éä•´°(¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÍÕµµ…ÉäÍÑÉ½¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÙÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•ÉÉ½Éì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì(€Á…‘‘¥¹œèÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèŒääÅˆÅˆì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½Èµ…É‘ì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÙÁàì(€Á…‘‘¥¹œèÈÁÁàì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€ÄÑÁà€ÌÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¤ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½ÈµÑ¥Ñ±•ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄÑÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½ÈµÑ¥Ñ±” Íì(€µ…É¥¸èÀ€À€ÕÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÈÅÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½ÈµÑ¥Ñ±”Áì(€µ…É¥¸èÀì(€½±½ÈèŒØĞÜĞáˆì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½ÈµÑ¥Ñ±”Í•±•Ñì(€µ¥¸µİ¥‘Ñ èÄÌÁÁàì(€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€á”Å•”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€Á…‘‘¥¹œèÀ€ÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰…­É½Õ¹è˜á™…™Œì)ô((¹Í¥Ñ”µ¹½Ñ¥”µÑ¥Ñ±”µ¥¹ÁÕĞ°(¹Í¥Ñ”µ¹½Ñ¥”µ½¹Ñ•¹Ğµ¥¹ÁÕÑì(€İ¥‘Ñ èÄÀÀ”ì(€‰½É‘•ÈèÅÁàÍ½±¥€á”Å•”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹è™™˜ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì)ô((¹Í¥Ñ”µ¹½Ñ¥”µÑ¥Ñ±”µ¥¹ÁÕÑì(€µ¥¸µ¡•¥¡ĞèÔÉÁàì(€Á…‘‘¥¹œèÀ€ÄÙÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì(€™½¹ĞµÍ¥é”èÄÙÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ½¹Ñ•¹Ğµ¥¹ÁÕÑì(€µ¥¸µ¡•¥¡ĞèÄÔÁÁàì(€Á…‘‘¥¹œèÄÙÁàì(€É•Í¥é”éÙ•ÉÑ¥…°ì(€±¥¹”µ¡•¥¡ĞèÄ¸ÔÔì)ô((¹Í¥Ñ”µ¹½Ñ¥”µÑ¥Ñ±”µ¥¹ÁÕĞé™½ÕÌ°(¹Í¥Ñ”µ¹½Ñ¥”µ½¹Ñ•¹Ğµ¥¹ÁÕĞé™½ÕÌ°(¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½ÈµÑ¥Ñ±”Í•±•Ğé™½ÕÍì(€½ÕÑ±¥¹”é¹½¹”ì(€‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€À€À€ÑÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÄÈ¤ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½Èµ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€…ÀèÄÁÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½Èµ…Ñ¥½¹Ì‰ÕÑÑ½¸°(¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€Á…‘‘¥¹œèÀ€ÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰…­É½Õ¹è”É”á˜Àì(€½±½ÈèŒÁ˜ÄÜÉ„ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½Èµ…Ñ¥½¹Ì€¹ÁÉ¥µ…Éåì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÅÑ•à¤ì(€½±½Èè™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÉÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈĞ¤ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ±¥ÍÑì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à ÈàÁÁà°Å™È¤¤ì(€…ÀèÄÑÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…É‘ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€Á…‘‘¥¹œèÄáÁàì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì(€‰½É‘•Èµ±•™ĞèáÁàÍ½±¥€ŒÍˆàÉ˜Øì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…É»ªâÓªâ%ì(€‰½É‘•Èµ±•™Ğµ½±½Èè•˜ĞĞĞĞì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°™™˜°™™˜Å˜È¤ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…É»²’G²jQì(€‰½É‘•Èµ±•™Ğµ½±½Èè˜äÜÌÄØì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°™™˜°™™˜İ•¤ì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½Áì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÁÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½À•µì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€Á…‘‘¥¹œèÕÁà€ÄÁÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…É»ªâÓªâ$€¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½À•µì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèˆäÅŒÅŒì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…É»²’G²jP€¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½À•µì(€‰…­É½Õ¹è™™•‘Ôì(€½±½ÈèŒÈĞÄÁŒì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½ÀÍÁ…¹ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…É Íì(€µ…É¥¸èÀ€À€ÄÁÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉÁì(€µ…É¥¸èÀì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸Øì(€İ¡¥Ñ”µÍÁ…”éÁÉ”µİÉ…Àì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…Ñ¥½¹Ì€¹‘…¹•Éì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèˆäÅŒÅŒì)ô((¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ•µÁÑåì(€É¥µ½±Õµ¸èÄ€¼€´Äì(€Á…‘‘¥¹œèĞÉÁàì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€½±½ÈèŒäÑ„Íˆàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€‰…­É½Õ¹è™™˜ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÁ…•ì(€€€Á…‘‘¥¹œèÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô(€€¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ¡•…°(€€¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½ÈµÑ¥Ñ±•ì(€€€‘¥ÍÁ±…äéÉ¥ì(€ô(€€¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÍÕµµ…Éåì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì(€ô(€€¹Í¥Ñ”µ¹½Ñ¥”µ•‘¥Ñ½Èµ…Ñ¥½¹Ì°(€€¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô)ô((¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ‰½áì(€µ…É¥¸èÄÑÁà€À€ÑÁàì(€Á…‘‘¥¹œèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰•…™”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è˜á™…™Œì)ô(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ‰½àùÍÑÉ½¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ¡•­Ì°(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ•µ…¥±Íì(€‘¥ÍÁ±…äé™±•àì(€™±•àµİÉ…ÀéİÉ…Àì(€…ÀèáÁàì)ô(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ•µ…¥±Íì(€µ…É¥¸µÑ½ÀèÄÁÁàì)ô(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ¡•­Ì±…‰•°°(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ•µ…¥±Ì±…‰•±ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèİÁàì(€µ…É¥¸èÀì(€Á…‘‘¥¹œèáÁà€ÄÁÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹éİ¡¥Ñ”ì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ¡•­Ì¥¹ÁÕĞ°(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ•µ…¥±Ì¥¹ÁÕÑì(€İ¥‘Ñ é…ÕÑ¼ì(€…•¹Ğµ½±½ÈèŒÈÔØÍ•ˆì)ô(¹Í¥Ñ”µ¹½Ñ¥”µÑ…É•Ğµ•µ…¥±Ì•µì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì)ô(¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½ÀÍµ…±±ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô((((¼¨€ôôôôô!½µ”‘…Í¡‰½…Éµ½­ÕÀÍÑå±”½Ù•ÉÉ¥‘”€ôôôôô€¨¼(¹¡½µ”µÕÁÉ…‘•í‰…­É½Õ¹è˜Ù˜á™Œí‰½É‘•ÈèÅÁàÍ½±¥€‘‘”Õ˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÀíÁ…‘‘¥¹œèÈÙÁàíµ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÄÈÁÁà¥ô(¹¡½µ”µÕÁÉ…‘”µÑ½Á‰…Éí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄáÁàíµ…É¥¸µ‰½ÑÑ½´èÈÁÁàíÁ…‘‘¥¹œµ‰½ÑÑ½´èÄáÁàí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”É”á˜Áô(¹¡½µ”µÕÁÉ…‘”µÑ½Á‰…È Éíµ…É¥¸èÀí½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÈÍÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀí±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÕÁáô¹¡½µ”µÕÁÉ…‘”µÑ½Á‰…ÈÁíµ…É¥¸èáÁà€À€Àí½±½ÈèŒØĞÜĞáˆí™½¹Ğµİ•¥¡ĞèàÀÁô¹¡½µ”µÕÁÉ…‘”µ‘…Ñ•í™½¹Ğµİ•¥¡ĞèÄÀÀÀí½±½ÈèŒÄÄÄàÈÜíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(¹¡½µ”µÕÁÉ…‘”µ­Á¥Íí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ±µ¥¹µ…à À°Å™È¤¤í…ÀèÄÙÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô¹¡½µ”µÕÁÉ…‘”µ­Á¥íÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÜÁÁà€Å™Èí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèÄÑÁàíµ¥¸µ¡•¥¡ĞèÄÌÑÁàíÁ…‘‘¥¹œèÄáÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàí‰…­É½Õ¹éİ¡¥Ñ”í‰½É‘•ÈèÅÁàÍ½±¥€‘‰”Ñ˜Àí‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤íÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹‰±Õ•í‰½É‘•Èµ½±½Èè‰™‘‰™•ô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹É••¹í‰½É‘•Èµ½±½Èè‰‰˜İÁô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹ÁÕÉÁ±•í‰½É‘•Èµ½±½Èè‘‘Ù™•ô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹É•‘í‰½É‘•Èµ½±½Èè™•…„í‰…­É½Õ¹è™™˜İ˜İô¹¡½µ”µÕÁÉ…‘”µ¥½¹íİ¥‘Ñ èÔáÁàí¡•¥¡ĞèÔáÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàí‘¥ÍÁ±…äéÉ¥íÁ±…”µ¥Ñ•µÌé•¹Ñ•Èí½±½Èè™™˜í™½¹ĞµÍ¥é”èÈáÁàí‰…­É½Õ¹èŒÈÔØÍ•‰ô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹É••¸€¹¡½µ”µÕÁÉ…‘”µ¥½¹í‰…­É½Õ¹èŒÄÁˆäàÅô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹ÁÕÉÁ±”€¹¡½µ”µÕÁÉ…‘”µ¥½¹í‰…­É½Õ¹èŒİŒÍ…•‘ô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹É•€¹¡½µ”µÕÁÉ…‘”µ¥½¹í‰…­É½Õ¹è”ÄÅĞáô¹¡½µ”µÕÁÉ…‘”µ­Á¤µÑ•áĞ•µí‘¥ÍÁ±…äé‰±½¬í™½¹ĞµÍÑå±”é¹½Éµ…°í½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô¹¡½µ”µÕÁÉ…‘”µ­Á¤µÑ•áĞ‰í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÄÁÁàí½±½ÈèŒÅÑ•àí™½¹ĞµÍ¥é”èÌÅÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹É••¸‰í½±½ÈèŒÀĞÜàÔİô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹ÁÕÉÁ±”‰í½±½ÈèŒÙÈáåô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹É•‰í½±½Èè”ÄÅĞáô¹¡½µ”µÕÁÉ…‘”µ­Á¤µÑ•áĞÍµ…±±í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèáÁàí½±½ÈèŒĞÜÔÔØäí™½¹Ğµİ•¥¡ĞèàÀÁô¹¡½µ”µÕÁÉ…‘”µ­Á¤¥íÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÉ¥¡ĞèÄáÁàí‰½ÑÑ½´èÄÑÁàí½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô¹¡½µ”µÕÁÉ…‘”µ­Á¤¹É•¥í½±½Èè”ÄÅĞáô(¹¡½µ”µÕÁÉ…‘”µÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤í…ÀèÄÙÁáô¹¡½µ”µÕÁÉ…‘”µÁ…¹•±í‰…­É½Õ¹éİ¡¥Ñ”í‰½É‘•ÈèÅÁàÍ½±¥€‘‰”Ñ˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàí‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔ¤íÁ…‘‘¥¹œèÄİÁàíµ¥¸µ¡•¥¡ĞèÄàÕÁáô¹¡½µ”µÕÁÉ…‘”µÁ…¹•°¹İ…É¹¥¹í‰…­É½Õ¹è™™™…™„í‰½É‘•Èµ½±½Èè™•……ô¹¡½µ”µÕÁÉ…‘”µÁ…¹•°µ¡•…‘í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸íµ…É¥¸µ‰½ÑÑ½´èÄÉÁáô¹¡½µ”µÕÁÉ…‘”µÁ…¹•°µ¡•… Ííµ…É¥¸èÀí½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄáÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô¹¡½µ”µÕÁÉ…‘”µÁ…¹•°µ¡•…‰ÕÑÑ½¹í‰½É‘•ÈèÀí‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğí½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹¡½µ”µÕÁÉ…‘”µ±¥ÍÑí‘¥ÍÁ±…äéÉ¥í…ÀèåÁáô¹¡½µ”µÕÁÉ…‘”µ¹½Ñ¥•í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèĞÑÁà€Å™È…ÕÑ¼í…ÀèáÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èíİ¥‘Ñ èÄÀÀ”íÁ…‘‘¥¹œèåÁà€Àí‰½É‘•ÈèÀí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜Üí‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹ĞíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹¡½µ”µÕÁÉ…‘”µ¹½Ñ¥”ÍÁ…¹í‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹èŒÈÔØÍ•ˆí½±½Èéİ¡¥Ñ”í™½¹ĞµÍ¥é”èÄÁÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀíÑ•áĞµ…±¥¸é•¹Ñ•ÈíÁ…‘‘¥¹œèÍÁà€ÙÁáô¹¡½µ”µÕÁÉ…‘”µ¹½Ñ¥”‰í™½¹ĞµÍ¥é”èÄÍÁàí½±½ÈèŒÄÄÄàÈİô¹¡½µ”µÕÁÉ…‘”µ¹½Ñ¥”•µí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÄÉÁàí½±½ÈèŒäÑ„Íˆáô¹¡½µ”µÕÁÉ…‘”µ¹½Ñ¥”ÁíÉ¥µ½±Õµ¸èÈ¼Ğíµ…É¥¸èÀí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Àí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Íô¹¡½µ”µÕÁÉ…‘”µÑ…Í­í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÈÑÁà€Å™È…ÕÑ¼í…ÀèåÁàí…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞíÁ…‘‘¥¹œèáÁà€Àí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜İô¹¡½µ”µÕÁÉ…‘”µÑ…Í¬ÍÁ…¹í½±½ÈèŒÈÔØÍ•ˆí™½¹Ğµİ•¥¡ĞèÄÀÀÁô¹¡½µ”µÕÁÉ…‘”µÑ…Í¬‰í™½¹ĞµÍ¥é”èÄÍÁàí½±½ÈèŒÄÄÄàÈİô¹¡½µ”µÕÁÉ…‘”µÑ…Í¬Áíµ…É¥¸èÑÁà€À€Àí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁáô¹¡½µ”µÕÁÉ…‘”µÑ…Í¬•µí™½¹ĞµÍÑå±”é¹½Éµ…°í‰…­É½Õ¹è••˜É™˜í½±½ÈèŒĞÌÌá„í‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàíÁ…‘‘¥¹œèÑÁà€áÁàí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô¹¡½µ”µÕÁÉ…‘”µ…±•ÉÑÍí‘¥ÍÁ±…äéÉ¥í…ÀèÄÉÁáô¹¡½µ”µÕÁÉ…‘”µ…±•ÉÑÌ‰ÕÑÑ½¹í‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí‰½É‘•ÈèÅÁàÍ½±¥€™•”É”Èí‰…­É½Õ¹éİ¡¥Ñ”í‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàíÁ…‘‘¥¹œèÄÉÁàíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹¡½µ”µÕÁÉ…‘”µ…±•ÉÑÌ‰í½±½ÈèŒÄÄÄàÈİô¹¡½µ”µÕÁÉ…‘”µ…±•ÉÑÌÍÁ…¹í‰…­É½Õ¹è”ÄÅĞàí½±½Èéİ¡¥Ñ”í‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàíÁ…‘‘¥¹œèİÁà€ÄÉÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÁô¹¡½µ”µÕÁÉ…‘”µÑ…‰±•íİ¥‘Ñ èÄÀÀ”í‰½É‘•Èµ½±±…ÁÍ”é½±±…ÁÍ”í™½¹ĞµÍ¥é”èÄÍÁáô¹¡½µ”µÕÁÉ…‘”µÑ…‰±”Ñ‘í‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜ÜíÁ…‘‘¥¹œèåÁà€ÕÁàí½±½ÈèŒÌÌĞÄÔÔí™½¹Ğµİ•¥¡ĞèàÀÀíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹¡½µ”µÕÁÉ…‘”µÑ…‰±”Ñé¹Ñ µ¡¥± È¥í½±½ÈèŒÁ˜ÄÜÉ…ô¹¡½µ”µÕÁÉ…‘”µÑ…‰±”Ñé±…ÍĞµ¡¥±‘íÑ•áĞµ…±¥¸éÉ¥¡Ğí½±½ÈèŒÄÄÄàÈÜí™½¹Ğµİ•¥¡ĞèÄÀÀÁô¹¡½µ”µÕÁÉ…‘”µ•µÁÑåíµ¥¸µ¡•¥¡ĞèÄÄÁÁàí‘¥ÍÁ±…äéÉ¥íÁ±…”µ¥Ñ•µÌé•¹Ñ•Èí½±½ÈèŒäÑ„Íˆàí™½¹Ğµİ•¥¡ĞèäÀÀí‰…­É½Õ¹è˜á™…™Œí‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁáô)µ•‘¥„¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì¹¡½µ”µÕÁÉ…‘”µ­Á¥ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¥ô¹¡½µ”µÕÁÉ…‘”µÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Éõõµ•‘¥„¡µ…àµİ¥‘Ñ èÜÀÁÁà¥ì¹¡½µ”µÕÁÉ…‘•íÁ…‘‘¥¹œèÄÉÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁáô¹¡½µ”µÕÁÉ…‘”µÑ½Á‰…Éí‘¥ÍÁ±…äé‰±½­ô¹¡½µ”µÕÁÉ…‘”µ‘…Ñ•íµ…É¥¸µÑ½ÀèÄÁÁáô¹¡½µ”µÕÁÉ…‘”µ­Á¥Ì°¹¡½µ”µÕÁÉ…‘”µÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹¡½µ”µÕÁÉ…‘”µ­Á¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔÙÁà€Å™Èíµ¥¸µ¡•¥¡ĞèÄÀÕÁáô¹¡½µ”µÕÁÉ…‘”µ¥½¹íİ¥‘Ñ èĞáÁàí¡•¥¡ĞèĞáÁàí™½¹ĞµÍ¥é”èÈÉÁáô¹¡½µ”µÕÁÉ…‘”µ­Á¤µÑ•áĞ‰í™½¹ĞµÍ¥é”èÈÕÁáô¹¡½µ”µÕÁÉ…‘”µÑ…‰±”Ñ‘í™½¹ĞµÍ¥é”èÄÉÁàíÁ…‘‘¥¹œèáÁà€ÍÁáô¹¡½µ”µÕÁÉ…‘”µÑ…‰±”Ñé¹Ñ µ¡¥± Ì¥íµ…àµİ¥‘Ñ èÄÄÁÁàí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Íõô((¼¨5½‘•É¸¡½µ”‘…Í¡‰½…É€´…ÑÕ…°I@¡½µ”½¹±ä€¨¼(¹µ½‘•É¸µ¡½µ”µÍ¡•±±í‰…­É½Õ¹è˜Ù˜á™Œí‰½É‘•ÈµÉ…‘¥ÕÌèÀíÁ…‘‘¥¹œèÈÉÁà€ÈÑÁà€ÌÁÁàíµ…É¥¸èÀ€À€ÈÉÁàí‰½àµÍ¡…‘½Üé¥¹Í•Ğ€À€ÅÁà€ÀÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸Ü¥ô(¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ½í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄáÁàíµ…É¥¸µ‰½ÑÑ½´èÈÉÁàíÁ…‘‘¥¹œèáÁà€ÉÁà€Áô¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼ Éíµ…É¥¸èÀ€À€ÙÁàí™½¹ĞµÍ¥é”èÈÑÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½±½ÈèŒÄÄÄàÈÜí±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÙÁáô¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼Áíµ…É¥¸èÀí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèÜÔÁô¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€á”É˜Àí‰…­É½Õ¹è™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàíÁ…‘‘¥¹œèÄÅÁà€ÄİÁàí½±½ÈèŒÌÌĞÄÔÔí™½¹Ğµİ•¥¡ĞèäÀÀíÕÉÍ½ÈéÁ½¥¹Ñ•Èí‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÄáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞ¥ô(¹µ½‘•É¸µ¡½µ”µ­Á¥Íí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤í…ÀèÄáÁàíµ…É¥¸µ‰½ÑÑ½´èÄáÁáô¹µ½‘•É¸µ¡½µ”µ­Á¥íµ¥¸µ¡•¥¡ĞèÄÔÁÁàí‰½É‘•ÈèÅÁàÍ½±¥€”Á”İ˜Èí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàí‰…­É½Õ¹è™™˜íÁ…‘‘¥¹œèÈÉÁàí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÜÉÁà€Å™ÈíÉ¥µÑ•µÁ±…Ñ”µÉ½İÌèÅ™È…ÕÑ¼í…ÀèáÁà€ÄáÁàíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Èí‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤íÑÉ…¹Í¥Ñ¥½¸éÑÉ…¹Í™½É´€¸ÄÕÌ•…Í”±‰½àµÍ¡…‘½Ü€¸ÄÕÌ•…Í•ô¹µ½‘•É¸µ¡½µ”µ­Á¤é¡½Ù•ÉíÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÉÁà¤í‰½àµÍ¡…‘½ÜèÀ€ÄÙÁà€ÌÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Ä¥ô¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹íİ¥‘Ñ èØÑÁàí¡•¥¡ĞèØÑÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄİÁàí‘¥ÍÁ±…äéÉ¥íÁ±…”µ¥Ñ•µÌé•¹Ñ•Èí™½¹ĞµÍ¥é”èÌÁÁàí½±½Èéİ¡¥Ñ”íÉ¥µÉ½ÜèÄ¼Íô¹µ½‘•É¸µ¡½µ”µ­Á¤•µí‘¥ÍÁ±…äé‰±½¬í™½¹ĞµÍÑå±”é¹½Éµ…°í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÕÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µ­Á¤‰í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèáÁàí™½¹ĞµÍ¥é”èÌÙÁàí±¥¹”µ¡•¥¡ĞèÄí™½¹Ğµİ•¥¡ĞèäÔÀí±•ÑÑ•ÈµÍÁ…¥¹œè´ÅÁáô¹µ½‘•É¸µ¡½µ”µ­Á¤Íµ…±±í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÄÁÁàí½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèàÀÁô¹µ½‘•É¸µ¡½µ”µ­Á¤ù¥íÉ¥µ½±Õµ¸èÈí™½¹ĞµÍÑå±”é¹½Éµ…°íÑ•áĞµ…±¥¸éÉ¥¡Ğí½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µ­Á¤¹‰±Õ”€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÁÕ‰™˜°ŒÈÔØÍ•ˆ¥ô¹µ½‘•É¸µ¡½µ”µ­Á¤¹‰±Õ”‰í½±½ÈèŒÄĞÔÕåô¹µ½‘•É¸µ¡½µ”µ­Á¤¹É••¸€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÄÅˆäàÄ°ŒÌÕŒäå„¥ô¹µ½‘•É¸µ¡½µ”µ­Á¤¹É••¸‰í½±½ÈèŒÀÔäØØåô¹µ½‘•É¸µ¡½µ”µ­Á¤¹ÁÕÉÁ±”€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒİŒÍ…•°ŒÕˆĞÍØ¥ô¹µ½‘•É¸µ¡½µ”µ­Á¤¹ÁÕÉÁ±”‰í½±½ÈèŒÙÈáåô¹µ½‘•É¸µ¡½µ”µ­Á¤¹É•‘í‰…­É½Õ¹è™™˜İ˜àí‰½É‘•Èµ½±½Èè˜á‘Ùô¹µ½‘•É¸µ¡½µ”µ­Á¤¹É•€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°”ÄÅĞà°˜ĞÍ˜Õ”¥ô¹µ½‘•É¸µ¡½µ”µ­Á¤¹É•‰í½±½Èè”ÄÅĞáô(¹µ½‘•É¸µ¡½µ”µÉ¥‘í‘¥ÍÁ±…äéÉ¥í…ÀèÄáÁáô¹µ½‘•É¸µ¡½µ”µÉ¥¹µ¥‘‘±•íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄ¸ÀÕ™È€Ä¸ÀÕ™È€¸Üá™È€¸äÕ™Èíµ…É¥¸µ‰½ÑÑ½´èÄáÁáô¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½µíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¥ô¹µ½‘•É¸µ¡½µ”µÁ…¹•±í‰…­É½Õ¹è™™˜í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàíÁ…‘‘¥¹œèÈÉÁàí‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔÔ¤íµ¥¸µİ¥‘Ñ èÁô¹µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…‘í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô¹µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•… Ííµ…É¥¸èÀí™½¹ĞµÍ¥é”èÈÁÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½±½ÈèŒÄÄÄàÈÜí±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÍÁáô¹µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…‰ÕÑÑ½¹í‰½É‘•ÈèÀí‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğí½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÀíÕÉÍ½ÈéÁ½¥¹Ñ•Èíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹µ½‘•É¸µ¡½µ”µ±¥ÍĞ°¹µ½‘•É¸µ¡½µ”µÍ¡•‘Õ±”µ±¥ÍĞ°¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµ±¥ÍÑí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÄÁÁáô¹µ½‘•É¸µ¡½µ”µ¹½Ñ¥”µÉ½İí‰½É‘•ÈèÀí‰…­É½Õ¹è™™˜íİ¥‘Ñ èÄÀÀ”í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼€Å™È…ÕÑ¼í…ÀèÄÉÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•ÈíÁ…‘‘¥¹œèáÁà€Àí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜ÜíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹µ½‘•É¸µ¡½µ”µ¹½Ñ¥”µÉ½ÜÍÁ…¹í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èí¡•¥¡ĞèÈÁÁàíÁ…‘‘¥¹œèÀ€İÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹èŒÄÈØÕ™˜í½±½Èéİ¡¥Ñ”í™½¹ĞµÍ¥é”èÄÁÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µ¹½Ñ¥”µÉ½Ü‰í™½¹ĞµÍ¥é”èÄÑÁàí½±½ÈèŒÄÄÄàÈÜí™½¹Ğµİ•¥¡ĞèàÔÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹µ½‘•É¸µ¡½µ”µ¹½Ñ¥”µÉ½Ü•µí™½¹ĞµÍÑå±”é¹½Éµ…°í½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèÜÔÀíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹µ½‘•É¸µ¡½µ”µÍ¡•‘Õ±”µÉ½İí‰½É‘•ÈèÀí‰…­É½Õ¹è™™˜íİ¥‘Ñ èÄÀÀ”í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÈÑÁà€Å™Èí…ÀèÄÉÁàí…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞíÁ…‘‘¥¹œèáÁà€ÀíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹µ½‘•É¸µ¡½µ”µÍ¡•‘Õ±”µÉ½ÜÍÁ…¹í½±½ÈèŒØĞÜĞáˆí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µÍ¡•‘Õ±”µÉ½Ü‰í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÕÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µÍ¡•‘Õ±”µÉ½ÜÁíµ…É¥¸èÑÁà€À€Àí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèÜÔÀí±¥¹”µ¡•¥¡ĞèÄ¸ĞÕô¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµ±¥ÍĞ‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€™™Åäí‰…­É½Õ¹è™™˜á˜äí‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàíÁ…‘‘¥¹œèÄÑÁà€ÄÙÁàí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸íÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµ±¥ÍĞ‰í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµ±¥ÍĞÍÁ…¹í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èíµ¥¸µİ¥‘Ñ èĞÑÁàí¡•¥¡ĞèÈÙÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹è”ÄÅĞàí½±½Èéİ¡¥Ñ”í™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µµ¥¹¤µ…±•¹‘…ÈµÁ…¹•±íÁ…‘‘¥¹œèÄáÁáô¹µ¥¹¤µ…±•¹‘…ÈµÑ¥Ñ±•í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèáÁàíµ…É¥¸è´ÉÁà€À€ÄÁÁàí½±½ÈèŒÌÌĞÄÔÕô¹µ¥¹¤µ…±•¹‘…ÈµÑ¥Ñ±”‰í™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½±½ÈèŒÄÄÄàÈİô¹µ¥¹¤µ…±•¹‘…ÈµÑ¥Ñ±”ÍÁ…¹í™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½±½ÈèŒÈÔØÍ•‰ô¹µ¥¹¤µ…±•¹‘…ÈµÑ¥Ñ±”‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€‘‰”İ™˜í‰…­É½Õ¹è˜á™‰™˜í½±½ÈèŒÈÔØÍ•ˆí‰½É‘•ÈµÉ…‘¥ÕÌèåÁàíÁ…‘‘¥¹œèÕÁà€áÁàí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèäÔÀíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹µ¥¹¤µ…±•¹‘…Èµİ••­í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü°Å™È¤í…ÀèÍÁàíµ…É¥¸µ‰½ÑÑ½´èÕÁáô¹µ¥¹¤µ…±•¹‘…Èµİ••¬ÍÁ…¹íÑ•áĞµ…±¥¸é•¹Ñ•Èí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÁÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ¥¹¤µ…±•¹‘…ÈµÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü°Å™È¤í…ÀèÍÁáô¹µ¥¹¤µ…±•¹‘…Èµ‘…åíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”í¡•¥¡ĞèÈİÁàí‰½É‘•ÈèÀí‰½É‘•ÈµÉ…‘¥ÕÌèİÁàí‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğí½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÔÀíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹µ¥¹¤µ…±•¹‘…Èµ‘…ä¹‰±…¹­íÕÉÍ½Èé‘•™…Õ±Ğí½±½Èè‰Õ”Åô¹µ¥¹¤µ…±•¹‘…Èµ‘…ä¹Ñ½‘…åí‰…­É½Õ¹èŒÈÔØÍ•ˆí½±½Èè™™˜í‰½àµÍ¡…‘½ÜèÀ€À€À€ÉÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸Äà¥ô¹µ¥¹¤µ…±•¹‘…Èµ‘…ä¹¡…Ìµİ½É¬é¹½Ğ ¹Ñ½‘…ä¥í‰…­É½Õ¹è••˜Ù™˜í½±½ÈèŒÅÑ•áô¹µ¥¹¤µ…±•¹‘…Èµ‘…ä¥íÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÉ¥¡ĞèÉÁàí‰½ÑÑ½´èÉÁàíµ¥¸µİ¥‘Ñ èÄÅÁàí¡•¥¡ĞèÄÅÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹èŒÄÁˆäàÄí½±½Èè™™˜í™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èáÁàí±¥¹”µ¡•¥¡ĞèÄÅÁàíÑ•áĞµ…±¥¸é•¹Ñ•Éô¹µ¥¹¤µ…±•¹‘…Èµ±••¹‘í‘¥ÍÁ±…äé™±•àí…ÀèÄÁÁàíµ…É¥¸µÑ½ÀèÄÁÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÁÁàí™½¹Ğµİ•¥¡ĞèàÔÁô¹µ¥¹¤µ…±•¹‘…Èµ±••¹ÍÁ…¹í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèÑÁáô¹µ¥¹¤µ…±•¹‘…Èµ±••¹¥íİ¥‘Ñ èİÁàí¡•¥¡ĞèİÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‘¥ÍÁ±…äé¥¹±¥¹”µ‰±½­ô¹Ñ½‘…äµ‘½Ñí‰…­É½Õ¹èŒÈÔØÍ•‰ô¹İ½É¬µ‘½Ñí‰…­É½Õ¹èŒÄÁˆäàÅô¹µ¥¹¤µ…±•¹‘…ÈµÑ½½±Ñ¥Áí‘¥ÍÁ±…äé¹½¹”íÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”í±•™ĞèÔÀ”í‰½ÑÑ½´èÌÅÁàíèµ¥¹‘•àèÔÀíİ¥‘Ñ èÈÈÁÁàíÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•` ´ÔÀ”¤í‰½É‘•ÈèÅÁàÍ½±¥€‘‰”İ™˜í‰…­É½Õ¹èŒÁ˜ÄÜÉ„í½±½Èè™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàíÁ…‘‘¥¹œèåÁà€ÄÁÁàí‰½àµÍ¡…‘½ÜèÀ€ÄÙÁà€ÌÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÈÔ¤íÑ•áĞµ…±¥¸é±•™Ñô¹µ¥¹¤µ…±•¹‘…ÈµÑ½½±Ñ¥Àé…™Ñ•Éí½¹Ñ•¹ĞèˆˆíÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”í±•™ĞèÔÀ”í‰½ÑÑ½´è´ÙÁàíÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•` ´ÔÀ”¤É½Ñ…Ñ” ĞÕ‘•œ¤íİ¥‘Ñ èÄÁÁàí¡•¥¡ĞèÄÁÁàí‰…­É½Õ¹èŒÁ˜ÄÜÉ…ô¹µ¥¹¤µ…±•¹‘…ÈµÑ½½±Ñ¥À•µí‘¥ÍÁ±…äé‰±½¬í™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèàÔÀí±¥¹”µ¡•¥¡ĞèÄ¸ÌÔíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Àí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Íô¹µ¥¹¤µ…±•¹‘…Èµ‘…ä¹¡…Ìµİ½É¬é¡½Ù•È€¹µ¥¹¤µ…±•¹‘…ÈµÑ½½±Ñ¥Áí‘¥ÍÁ±…äé‰±½­ô¹…±•¹‘…Èµ‘•Ñ…¥°µ‰…­‘É½ÁíÁ½Í¥Ñ¥½¸é™¥á•í¥¹Í•ĞèÀíèµ¥¹‘•àèäääääí‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Ğà¤í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•ÈíÁ…‘‘¥¹œèÄáÁáô¹…±•¹‘…Èµ‘•Ñ…¥°µµ½‘…±íİ¥‘Ñ éµ¥¸ ÔØÁÁà°äÑÙÜ¤íµ…àµ¡•¥¡ĞèàÉÙ í½Ù•É™±½Üé…ÕÑ¼í‰…­É½Õ¹è™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàí‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€àÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÌÈ¤í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Áô¹…±•¹‘…Èµ‘•Ñ…¥°µ¡•…‘í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸íÁ…‘‘¥¹œèÈÉÁà€ÈÑÁàí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜İô¹…±•¹‘…Èµ‘•Ñ…¥°µ¡•…ÍÁ…¹í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹…±•¹‘…Èµ‘•Ñ…¥°µ¡•… Ííµ…É¥¸èÑÁà€À€Àí½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÈÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹…±•¹‘…Èµ‘•Ñ…¥°µ¡•…‰ÕÑÑ½¹íİ¥‘Ñ èÌÙÁàí¡•¥¡ĞèÌÙÁàí‰½É‘•ÈèÀí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹è˜Å˜Õ˜äí½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÈÑÁàí±¥¹”µ¡•¥¡ĞèÄíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹…±•¹‘…Èµ‘•Ñ…¥°µ±¥ÍÑí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÄÉÁàíÁ…‘‘¥¹œèÄáÁà€ÈÑÁáô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•µí‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰…­É½Õ¹è˜á™‰™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàíÁ…‘‘¥¹œèÄÙÁáô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´µÑ½Áí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÁÁàíµ…É¥¸µ‰½ÑÑ½´èáÁáô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´µÑ½À‰í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÙÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹…±•¹‘…Èµ‘•Ñ…¥°µ‰…‘•í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èí¡•¥¡ĞèÈÙÁàíÁ…‘‘¥¹œèÀ€ÄÁÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹è‘‰•…™”í½±½ÈèŒÅÑ•àí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹…±•¹‘…Èµ‘•Ñ…¥°µ‰…‘”¹ÕÉ•¹Ñí‰…­É½Õ¹è™•”É”Èí½±½Èè‘ŒÈØÈÙô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´Áíµ…É¥¸èÀ€À€ÄÉÁàí½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèàÔÀí±¥¹”µ¡•¥¡ĞèÄ¸ĞÕô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´‘±í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèáÁàíµ…É¥¸èÁô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´‘°‘¥Ùí‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàí‰…­É½Õ¹è™™˜íÁ…‘‘¥¹œèåÁà€ÄÁÁáô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´‘Ñíµ…É¥¸èÀ€À€ÑÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´‘‘íµ…É¥¸èÀí½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèàÔÁô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´‘°‘¥Øé±…ÍĞµ¡¥±‘íÉ¥µ½±Õµ¸èÄ¼´Åô¹…±•¹‘…Èµ‘•Ñ…¥°µ…Ñ¥½¹Íí‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹í…ÀèÄÁÁàíÁ…‘‘¥¹œèÄáÁà€ÈÑÁàí‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€••˜É˜Üí‰…­É½Õ¹è˜á™…™ô¹…±•¹‘…Èµ‘•Ñ…¥°µ…Ñ¥½¹Ì‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äí‰…­É½Õ¹è™™˜í½±½ÈèŒÌÌĞÄÔÔí‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàíÁ…‘‘¥¹œèÄÁÁà€ÄÑÁàí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÀíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹…±•¹‘…Èµ‘•Ñ…¥°µ…Ñ¥½¹Ì‰ÕÑÑ½¸¹ÁÉ¥µ…Éåí‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆí‰…­É½Õ¹èŒÈÔØÍ•ˆí½±½Èè™™™ô¹‘•Í­Ñ½Àµ½¹±äµÑ…‰±•í‘¥ÍÁ±…äéÑ…‰±•ô¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…É‘Íí‘¥ÍÁ±…äé¹½¹•ô¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…É‘í‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆí‰…­É½Õ¹è™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàíÁ…‘‘¥¹œèÄÙÁàí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèØÑÁàµ¥¹µ…à À°Å™È¤…ÕÑ¼í…ÀèÄÑÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí‰½àµÍ¡…‘½ÜèÀ€ÉÁà€ÄÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔ¤íµ…É¥¸µ‰½ÑÑ½´èÄÉÁàíÑ•áĞµ…±¥¸é±•™Ñô¹µ½‰¥±”µ¡¥ÍÑ½Éäµ‘…Ñ”‰í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÈÑÁàí™½¹Ğµİ•¥¡ĞèäÔÀí±¥¹”µ¡•¥¡ĞèÅô¹µ½‰¥±”µ¡¥ÍÑ½Éäµµ…¥¸ÍÑÉ½¹í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄİÁàí™½¹Ğµİ•¥¡ĞèäÔÀí±¥¹”µ¡•¥¡ĞèÄ¸ÌÔíİ½Éµ‰É•…¬é­••Àµ…±±ô¹µ½‰¥±”µ¡¥ÍÑ½Éäµµ…¥¸ÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÑÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèÜÀÁô¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…µ½Õ¹Ñí½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄáÁàí™½¹Ğµİ•¥¡ĞèäÔÀíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µ±¥ÍÑí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÄÁÁáô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÉ½İí‰½É‘•ÈèÅÁàÍ½±¥€••˜É˜Üí‰…­É½Õ¹è™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàíÁ…‘‘¥¹œèÄÁÁàí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔÑÁà€Å™È…ÕÑ¼í…ÀèÄÉÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•ÈíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÑ¡Õµ‰íİ¥‘Ñ èÔÑÁàí¡•¥¡ĞèÔÑÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàí‰…­É½Õ¹µÍ¥é”é½Ù•Èí‰…­É½Õ¹µÁ½Í¥Ñ¥½¸é•¹Ñ•Èí‰…­É½Õ¹µ½±½Èè‘‰•…™”í‘¥ÍÁ±…äéÉ¥íÁ±…”µ¥Ñ•µÌé•¹Ñ•Èí½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½Ù•É™±½Üé¡¥‘‘•¹ô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÑ¡Õµˆ¹•µÁÑåí‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°‘‰•…™”°••˜É™˜¥ô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÉ½Ü‰í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÉ½ÜÁíµ…É¥¸èÑÁà€À€Àí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèÜÔÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÉ½Ü•µí™½¹ĞµÍÑå±”é¹½Éµ…°í½±½ÈèŒäÑ„Íˆàí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÔÀíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…ÈµÁ…¹•±íµ…É¥¸µ‰½ÑÑ½´èÄáÁáô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…ÈµÑ¥Ñ±•íµ…É¥¸è´ÑÁà€À€ÄÉÁàí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÀÁô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµİ••­í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü°Å™È¤í…ÀèáÁàíµ…É¥¸µ‰½ÑÑ½´èáÁáô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµİ••¬ÍÁ…¹íÑ•áĞµ…±¥¸é•¹Ñ•Èí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…ÈµÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü°Å™È¤í…ÀèáÁáô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµ‘…åíµ¥¸µ¡•¥¡ĞèàÉÁàí‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàí‰…­É½Õ¹è™™˜íÁ…‘‘¥¹œèåÁàíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Èí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÑÁáô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµ‘…ä¹‰±…¹­í‰…­É½Õ¹è˜á™…™Œí‰½É‘•ÈµÍÑå±”é‘…Í¡•íÕÉÍ½Èé‘•™…Õ±Ñô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµ‘…ä‰í™½¹ĞµÍ¥é”èÄÍÁàí½±½ÈèŒÄÄÄàÈÜí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµ‘…äÍµ…±±í‘¥ÍÁ±…äé‰±½¬íµ…àµİ¥‘Ñ èÄÀÀ”í½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Àí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹è••˜Ù™˜í½±½ÈèŒÅÑ•àíÁ…‘‘¥¹œèÍÁà€ÙÁàí™½¹ĞµÍ¥é”èÄÁÁàí™½¹Ğµİ•¥¡ĞèäÀÁô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµ‘…ä•µí™½¹ĞµÍÑå±”é¹½Éµ…°í½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµ‘…ä¹Ñ½‘…åí‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆí‰½àµÍ¡…‘½ÜèÀ€À€À€ÍÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÄÈ¥ô¹µ½‘•É¸µ¡½µ”µ…±•¹‘…Èµ‘…ä¹¡…Ìµİ½É­í‰…­É½Õ¹è™‰™‘™™ô¹µ½‘•É¸µ¡½µ”µÑ…‰±•íİ¥‘Ñ èÄÀÀ”í‰½É‘•Èµ½±±…ÁÍ”é½±±…ÁÍ”í™½¹ĞµÍ¥é”èÄÍÁáô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ¡íÁ…‘‘¥¹œèÀ€áÁà€ÄÁÁàí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”Õ”İ•ˆí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÀíÑ•áĞµ…±¥¸é±•™Ñô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ é±…ÍĞµ¡¥±‘íÑ•áĞµ…±¥¸éÉ¥¡Ñô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ‘íÁ…‘‘¥¹œèÄÅÁà€áÁàí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜Üí½±½ÈèŒÄÄÄàÈÜí™½¹Ğµİ•¥¡ĞèàÀÀíÙ•ÉÑ¥…°µ…±¥¸éµ¥‘‘±•ô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± Ä¥íİ¡¥Ñ”µÍÁ…”é¹½İÉ…Àí½±½ÈèŒÌÌĞÄÔÕô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± È¤°¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± Ì¥íµ…àµİ¥‘Ñ èÄàÁÁàí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé±…ÍĞµ¡¥±‘íÑ•áĞµ…±¥¸éÉ¥¡Ğíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Àí™½¹Ğµİ•¥¡ĞèäÔÁô¹µ½‘•É¸µ¡½µ”µ•µÁÑåí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàí‰…­É½Õ¹è˜á™…™Œí‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”ÄíÁ…‘‘¥¹œèÈáÁàíÑ•áĞµ…±¥¸é•¹Ñ•Èí½±½ÈèŒäÑ„Íˆàí™½¹Ğµİ•¥¡ĞèàÔÁô)µ•‘¥„¡µ…àµİ¥‘Ñ èÄÈÀÁÁà¥ì¹µ½‘•É¸µ¡½µ”µ­Á¥ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¥ô¹µ½‘•É¸µ¡½µ”µÉ¥¹µ¥‘‘±•íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Éô¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½µíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éõô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì¹µ½‘•É¸µ¡½µ”µ­Á¥Ì°¹µ½‘•É¸µ¡½µ”µÉ¥¹µ¥‘‘±”°¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½µíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹µ½‘•É¸µ¡½µ”µÍ¡•±±íÁ…‘‘¥¹œèÄÑÁà€ÄÁÁà€äÙÁàíµ…àµİ¥‘Ñ èÄÀÀ”í½Ù•É™±½Üµàé¡¥‘‘•¹ô¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ½í™±•àµ‘¥É•Ñ¥½¸é½±Õµ¹ô¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼ Éí™½¹ĞµÍ¥é”èÈÁÁáô¹µ½‘•É¸µ¡½µ”µ­Á¥ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èí…ÀèÄÉÁáô¹µ½‘•É¸µ¡½µ”µ­Á¥íµ¥¸µ¡•¥¡ĞèÄÈáÁàíÁ…‘‘¥¹œèÄáÁàíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔáÁàµ¥¹µ…à À°Å™È¥ô¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹íİ¥‘Ñ èÔÑÁàí¡•¥¡ĞèÔÑÁàí™½¹ĞµÍ¥é”èÈÑÁáô¹µ½‘•É¸µ¡½µ”µ­Á¤‰í™½¹ĞµÍ¥é”èÈáÁàí±¥¹”µ¡•¥¡ĞèÄ¸Äàíİ½Éµ‰É•…¬é­••Àµ…±±ô¹µ½‘•É¸µ¡½µ”µÁ…¹•±íÁ…‘‘¥¹œèÄÙÁàí½Ù•É™±½Üé¡¥‘‘•¹ô¹µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•… Íí™½¹ĞµÍ¥é”èÄåÁáô¹µ½‘•É¸µ¡½µ”µÑ…‰±•íİ¥‘Ñ èÄÀÀ”íÑ…‰±”µ±…å½ÕĞé™¥á•í™½¹ĞµÍ¥é”èÄÉÁáô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ °¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ‘íÁ…‘‘¥¹œèÄÁÁà€ÙÁàíİ¡¥Ñ”µÍÁ…”é¹½Éµ…°…¥µÁ½ÉÑ…¹Ğíİ½Éµ‰É•…¬é­••Àµ…±°í½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Íô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ é¹Ñ µ¡¥± È¤°¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± È¥í‘¥ÍÁ±…äé¹½¹•ô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ é¹Ñ µ¡¥± Ä¤°¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± Ä¥íİ¥‘Ñ èÔáÁàíÑ•áĞµ…±¥¸é•¹Ñ•Éô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ é¹Ñ µ¡¥± Ì¤°¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± Ì¥íİ¥‘Ñ é…ÕÑ¼íµ…àµİ¥‘Ñ é¹½¹”íÑ•áĞµ…±¥¸é±•™Ğíİ¡¥Ñ”µÍÁ…”é¹½Éµ…°…¥µÁ½ÉÑ…¹Ğí±¥¹”µ¡•¥¡ĞèÄ¸ÌÕô¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ é¹Ñ µ¡¥± Ğ¤°¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± Ğ¥í‘¥ÍÁ±…äéÑ…‰±”µ•±°íİ¥‘Ñ èÜáÁàíÑ•áĞµ…±¥¸éÉ¥¡Ğí™½¹ĞµÍ¥é”èÄÅÁàíİ¡¥Ñ”µÍÁ…”é¹½İÉ…À…¥µÁ½ÉÑ…¹Ñô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÉ½İíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèĞÙÁàµ¥¹µ…à À°Å™È¤…ÕÑ½ô¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÑ¡Õµ‰íİ¥‘Ñ èĞÙÁàí¡•¥¡ĞèĞÙÁáô¹µ¥¹¤µ…±•¹‘…ÈµÑ½½±Ñ¥Áí‘¥ÍÁ±…äé¹½¹”…¥µÁ½ÉÑ…¹Ñô¹…±•¹‘…Èµ‘•Ñ…¥°µµ½‘…±íİ¥‘Ñ èäÑÙİô¹…±•¹‘…Èµ‘•Ñ…¥°µ¥Ñ•´‘±íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹‘•Í­Ñ½Àµ½¹±äµÑ…‰±•í‘¥ÍÁ±…äé¹½¹•ô¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…É‘Íí‘¥ÍÁ±…äé‰±½­ô¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…É‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔáÁàµ¥¹µ…à À°Å™È¤íÁ…‘‘¥¹œèÄÑÁáô¹µ½‰¥±”µ¡¥ÍÑ½Éäµ‘…Ñ”‰í™½¹ĞµÍ¥é”èÈÁÁáô¹µ½‰¥±”µ¡¥ÍÑ½Éäµµ…¥¸ÍÑÉ½¹í™½¹ĞµÍ¥é”èÄÕÁáô¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…µ½Õ¹ÑíÉ¥µ½±Õµ¸èÈí©ÕÍÑ¥™äµÍ•±˜é•¹í™½¹ĞµÍ¥é”èÄÙÁàíµ…É¥¸µÑ½ÀèÑÁáõô(((¼¨µ½‰¥±”‘…Í¡‰½…É¡¥ÍÑ½Éä…É‘Ì€´™¥¹…°½Ù•ÉÉ¥‘”€¨¼)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì(€€¹µ½‘•É¸µ¡½µ”µÁ…¹•°€¹‘•Í­Ñ½Àµ½¹±äµÑ…‰±”°(€€¹µ½‘•É¸µ¡½µ”µÁ…¹•°Ñ…‰±”¹‘•Í­Ñ½Àµ½¹±äµÑ…‰±”°(€€¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½´€¹µ½‘•É¸µ¡½µ”µÑ…‰±•ì(€€€‘¥ÍÁ±…äé¹½¹”…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½´€¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…É‘Íì(€€€‘¥ÍÁ±…äé™±•à…¥µÁ½ÉÑ…¹Ğì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€€€…ÀèÄÁÁàì(€€€İ¥‘Ñ èÄÀÀ”ì(€ô((€€¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½´€¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…É‘ì(€€€İ¥‘Ñ èÄÀÀ”…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ”İ•ˆì(€€€‰…­É½Õ¹è™™˜ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€€€Á…‘‘¥¹œèÄÑÁà€ÄÑÁàì(€€€‘¥ÍÁ±…äéÉ¥…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔáÁàµ¥¹µ…à À°Å™È¤…ÕÑ¼ì(€€€…ÀèÄÁÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÄáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì(€€€µ…É¥¸èÀì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô((€€¹µ½‰¥±”µ¡¥ÍÑ½Éäµ‘…Ñ•ì(€€€…±¥¸µÍ•±˜é•¹Ñ•Èì(€ô((€€¹µ½‰¥±”µ¡¥ÍÑ½Éäµ‘…Ñ”‰ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€½±½ÈèŒÈÔØÍ•ˆì(€€€™½¹ĞµÍ¥é”èÄáÁàì(€€€±¥¹”µ¡•¥¡ĞèÄì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÍÁàì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€ô((€€¹µ½‰¥±”µ¡¥ÍÑ½Éäµµ…¥¹ì(€€€µ¥¸µİ¥‘Ñ èÀì(€ô((€€¹µ½‰¥±”µ¡¥ÍÑ½Éäµµ…¥¸ÍÑÉ½¹ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€½±½ÈèŒÁ˜ÄÜÉ„ì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÌÈì(€€€İ½Éµ‰É•…¬é­••Àµ…±°ì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°ì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€€€‘¥ÍÁ±…äèµİ•‰­¥Ğµ‰½àì(€€€€µİ•‰­¥Ğµ±¥¹”µ±…µÀèÈì(€€€€µİ•‰­¥Ğµ‰½àµ½É¥•¹ĞéÙ•ÉÑ¥…°ì(€ô((€€¹µ½‰¥±”µ¡¥ÍÑ½Éäµµ…¥¸ÍÁ…¹ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€µ…É¥¸µÑ½ÀèÑÁàì(€€€½±½ÈèŒØĞÜĞáˆì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€€€™½¹Ğµİ•¥¡ĞèÜÔÀì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Ìì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€€€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€ô((€€¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…µ½Õ¹Ñì(€€€©ÕÍÑ¥™äµÍ•±˜é•¹ì(€€€…±¥¸µÍ•±˜é•¹Ñ•Èì(€€€½±½ÈèŒÄÄÄàÈÜì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€€€Ñ•áĞµ…±¥¸éÉ¥¡Ğì(€ô)ô()µ•‘¥„¡µ…àµİ¥‘Ñ èÌäÁÁà¥ì(€€¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½´€¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…É‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔÉÁàµ¥¹µ…à À°Å™È¤ì(€ô((€€¹µ½‰¥±”µ¡¥ÍÑ½Éäµ…µ½Õ¹Ñì(€€€É¥µ½±Õµ¸èÈì(€€€©ÕÍÑ¥™äµÍ•±˜é•¹ì(€€€µ…É¥¸µÑ½ÀèÉÁàì(€ô)ô(((¼¨™¥•±µ½‰¥±”¡½µ”€¨¼(¹™¥•±µµ½‰¥±”µ¡½µ•íÁ…‘‘¥¹œèÄáÁà€ÄÑÁà€ÄÀÁÁàí‰…­É½Õ¹è˜Ñ˜İ™ˆíµ¥¸µ¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÜÁÁà¥ô(¹™¥•±µµ½‰¥±”µ¡•É½í‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàíÁ…‘‘¥¹œèÈÑÁà€ÈÁÁàí‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÁÕ‰™˜°ŒÌá‰‘˜à¤í½±½Èè™™˜í‰½àµÍ¡…‘½ÜèÀ€ÄáÁà€ÌáÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸Äà¤íµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô(¹™¥•±µµ½‰¥±”µ¡•É¼ÍÁ…¹í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí¡•¥¡ĞèÈÑÁàíÁ…‘‘¥¹œèÀ€ÄÁÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸Äà¤í™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(¹™¥•±µµ½‰¥±”µ¡•É¼ Éíµ…É¥¸èÄÉÁà€À€ÙÁàí™½¹ĞµÍ¥é”èÈÑÁàí±¥¹”µ¡•¥¡ĞèÄ¸Èí™½¹Ğµİ•¥¡ĞèäÔÀí±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÙÁáô(¹™¥•±µµ½‰¥±”µ¡•É¼Áíµ…É¥¸èÀí½Á…¥Ñäè¸äÈí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèÜÔÁô(¹™¥•±µµ½‰¥±”µÅÕ¥¬µÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèÄÉÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô(¹™¥•±µµ½‰¥±”µÅÕ¥¬µÉ¥‰ÕÑÑ½¹íµ¥¸µ¡•¥¡ĞèÄÄÉÁàí‰½É‘•ÈèÀí‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàí‰…­É½Õ¹è™™˜íÁ…‘‘¥¹œèÄáÁàíÑ•áĞµ…±¥¸é±•™Ğí‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÜ¤íÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹™¥•±µµ½‰¥±”µÅÕ¥¬µÉ¥‰í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄáÁàí™½¹Ğµİ•¥¡ĞèäÔÀí±¥¹”µ¡•¥¡ĞèÄ¸ÈÕô(¹™¥•±µµ½‰¥±”µÅÕ¥¬µÉ¥ÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèáÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèàÀÁô(¹™¥•±µµ½‰¥±”µ…É‘í‰…­É½Õ¹è™™˜í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàíÁ…‘‘¥¹œèÄáÁàíµ…É¥¸µ‰½ÑÑ½´èÄÑÁàí‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔÔ¥ô(¹™¥•±µµ½‰¥±”µ…Éµ¡•…‘í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÁÁàíµ…É¥¸µ‰½ÑÑ½´èÄÉÁáô(¹™¥•±µµ½‰¥±”µ…Éµ¡•… Ííµ…É¥¸èÀí½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄåÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(¹™¥•±µµ½‰¥±”µ…Éµ¡•…‰ÕÑÑ½¹í‰½É‘•ÈèÀí‰…­É½Õ¹è•™˜Ù™˜í½±½ÈèŒÈÔØÍ•ˆí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàíÁ…‘‘¥¹œèáÁà€ÄÅÁàí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(¹™¥•±µµ½‰¥±”µ±¥ÍÑí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÄÁÁáô(¹™¥•±µµ½‰¥±”µ±¥ÍĞ‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€••˜É˜Üí‰…­É½Õ¹è™‰™‘™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàíÁ…‘‘¥¹œèÄÑÁàíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹™¥•±µµ½‰¥±”µ±¥ÍĞ‰í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÕÁàí™½¹Ğµİ•¥¡ĞèäÔÀí±¥¹”µ¡•¥¡ĞèÄ¸Íô(¹™¥•±µµ½‰¥±”µ±¥ÍĞÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÕÁàí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèàÀÀí±¥¹”µ¡•¥¡ĞèÄ¸ÌÔí½Ù•É™±½Üé¡¥‘‘•¸í‘¥ÍÁ±…äèµİ•‰­¥Ğµ‰½àìµİ•‰­¥Ğµ±¥¹”µ±…µÀèÈìµİ•‰­¥Ğµ‰½àµ½É¥•¹ĞéÙ•ÉÑ¥…±ô(¹™¥•±µµ½‰¥±”µ±¥ÍĞ•µí‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèİÁàí½±½ÈèŒäÑ„Íˆàí™½¹ĞµÍ¥é”èÄÉÁàí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹Ğµİ•¥¡ĞèàÔÁô(¹™¥•±µµ½‰¥±”µ•µÁÑåí‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàíÁ…‘‘¥¹œèÈÉÁàíÑ•áĞµ…±¥¸é•¹Ñ•Èí½±½ÈèŒäÑ„Íˆàí™½¹Ğµİ•¥¡ĞèäÀÁô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµ…Ñ¥½¹Íí‘¥ÍÁ±…äé™±•àí…ÀèáÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí™±•àµİÉ…ÀéİÉ…Àí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹‘ô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É‘íÁ½Í¥Ñ¥½¸é™¥á•í±•™Ğé…±Œ ÔÀ”€¬€ÄÈÑÁà¤íÑ½ÀèÔÀ”íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” ´ÔÀ”°´ÔÀ”¤íèµ¥¹‘•àèäääääíİ¥‘Ñ éµ¥¸ ÄØàÁÁà±…±Œ ÄÀÁÙÜ€´€ÈàÁÁà¤¤íµ…àµ¡•¥¡ĞèäÁÙ í½Ù•É™±½Üé…ÕÑ¼í‰…­É½Õ¹è˜Õ˜İ™ˆ€…¥µÁ½ÉÑ…¹Ğí‰½É‘•ÈèÅÁàÍ½±¥€‘‰”Ñ•˜í‰½àµÍ¡…‘½ÜèÀ€À€À€ÄÀÁÙµ…àÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ĞÈ¤°À€ÌÁÁà€äÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Èà¥ô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…Éé‰•™½É•í½¹Ñ•¹Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ñô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•…‘í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•… Éíµ…É¥¸èÁô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•…‰ÕÑÑ½¹í‰½É‘•ÈèÀí‰…­É½Õ¹è˜Å˜Õ˜äí½±½ÈèŒÌÌĞÄÔÔí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàíÁ…‘‘¥¹œèåÁà€ÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÀíÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•…‘íµ…É¥¸èÀ€À€ÄáÁàíÁ…‘‘¥¹œèÄİÁà€ÄåÁàí‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàí‰…­É½Õ¹è™™™ô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•… Éí½±½ÈèŒÄÜÈÀÌÌí™½¹ĞµÍ¥é”èÈÑÁàí±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÙÁáô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•…‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€™”Á˜Ôí‰…­É½Õ¹è•™˜Ù™˜í½±½ÈèŒÅÑ•áô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…Éø¹É¥Ì°(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”°(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•°°(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éåí‰½É‘•Èµ½±½Èè‘”Õ•˜€…¥µÁ½ÉÑ…¹Ğí‰…­É½Õ¹è™™˜€…¥µÁ½ÉÑ…¹Ñô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ¡í‰…­É½Õ¹è•‘˜Í˜ä€…¥µÁ½ÉÑ…¹Ğí½±½ÈèŒÌÌĞÄÔÔ€…¥µÁ½ÉÑ…¹Ñô(¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹•¹ÑÉäµ…Ñ¥½¹Íí‰½É‘•ÈµÑ½Àµ½±½Èè‘”Õ•˜€…¥µÁ½ÉÑ…¹Ñô)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É‘í±•™ĞèÔÀ”íİ¥‘Ñ èäÙÙÜíµ…àµ¡•¥¡ĞèàÙÙ íÁ…‘‘¥¹œèÄÙÁáõô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì¹™¥•±µµ½‰¥±”µ¡½µ•íÁ…‘‘¥¹œèÄÑÁà€ÄÁÁà€äÙÁáô¹™¥•±µµ½‰¥±”µ¡•É¼ Éí™½¹ĞµÍ¥é”èÈÅÁáô¹™¥•±µµ½‰¥±”µÅÕ¥¬µÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹™¥•±µµ½‰¥±”µÅÕ¥¬µÉ¥‰ÕÑÑ½¹íµ¥¸µ¡•¥¡ĞèäÑÁáõô(((¼¨µ½‘•É¸™¥•±İ½É­•Èµ½‰¥±”¡½µ”€¨¼(¹™¥•±µ…ÁÀµ¡½µ•íµ¥¸µ¡•¥¡ĞèÄÀÁÙ í‰…­É½Õ¹è˜Õ˜á™ŒíÁ…‘‘¥¹œèÄáÁà€ÄÑÁà€ÄÄÁÁàí½±½ÈèŒÁ˜ÄÜÉ…ô(¹™¥•±µ…ÁÀµÑ½Á‰…Éí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô(¹™¥•±µ…ÁÀµÑ½Á‰…ÈÍÑÉ½¹í‘¥ÍÁ±…äé‰±½¬í™½¹ĞµÍ¥é”èÈÍÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀí±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁàí½±½ÈèŒÁ˜É„Õ™ô(¹™¥•±µ…ÁÀµÑ½Á‰…ÈÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÑÁàí½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(¹™¥•±µ…ÁÀµÑ½Á‰…È‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰…­É½Õ¹è™™˜í½±½ÈèŒÁ˜ÄÜÉ„í‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàíÁ…‘‘¥¹œèÄÁÁà€ÄÑÁàí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÀí‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¥ô(¹™¥•±µ…ÁÀµ¡•É½íÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”í½Ù•É™±½Üé¡¥‘‘•¸í‰½É‘•ÈµÉ…‘¥ÕÌèÈáÁàí‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÀÜÕ‰Œà°ŒÁ˜ÜÉ˜Ø€ÔÔ”°ŒÍˆàÉ˜Ø¤í½±½Èè™™˜íÁ…‘‘¥¹œèÈÙÁà€ÈÉÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁàí‰½àµÍ¡…‘½ÜèÀ€ÈÉÁà€ĞáÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈĞ¥ô(¹™¥•±µ…ÁÀµ¡•É¼é…™Ñ•Éí½¹Ñ•¹ĞèˆˆíÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÉ¥¡Ğè´ÔÁÁàí‰½ÑÑ½´è´ÔÕÁàíİ¥‘Ñ èÄàÕÁàí¡•¥¡ĞèÄàÕÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÄÌ¥ô(¹™¥•±µ…ÁÀµ¡•É¼Íµ…±±í‘¥ÍÁ±…äé‰±½¬í™½¹ĞµÍ¥é”èÄÕÁàí™½¹Ğµİ•¥¡ĞèàÔÀí½Á…¥Ñäè¸äÕô(¹™¥•±µ…ÁÀµ¡•É¼ ÉíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íèµ¥¹‘•àèÄíµ…É¥¸èÄÉÁà€À€áÁàí™½¹ĞµÍ¥é”èÈåÁàí±¥¹”µ¡•¥¡ĞèÄ¸ÄÔí™½¹Ğµİ•¥¡ĞèÄÀÀÀí±•ÑÑ•ÈµÍÁ…¥¹œè´ÅÁáô(¹™¥•±µ…ÁÀµ¡•É¼ÁíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íèµ¥¹‘•àèÄíµ…É¥¸èÀí™½¹ĞµÍ¥é”èÄÕÁàí™½¹Ğµİ•¥¡ĞèÜÔÀí½Á…¥Ñäè¸äĞí±¥¹”µ¡•¥¡ĞèÄ¸ĞÕô(¹™¥•±µ…ÁÀµ¡•É¼µÑ…ÍíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íèµ¥¹‘•àèÄí‘¥ÍÁ±…äé™±•àí…ÀèáÁàí™±•àµİÉ…ÀéİÉ…Àíµ…É¥¸µÑ½ÀèÄáÁáô(¹™¥•±µ…ÁÀµ¡•É¼µÑ…ÌÍÁ…¹í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí¡•¥¡ĞèÌÑÁàíÁ…‘‘¥¹œèÀ€ÄÉÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÄØ¤í™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÀÁô(¹™¥•±µ…ÁÀµ¹½Ñ¥•í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰…­É½Õ¹è™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàíÁ…‘‘¥¹œèÄáÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁàí‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁàí‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤íÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹™¥•±µ…ÁÀµ¹½Ñ¥”‰í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄİÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀíµ…É¥¸µ‰½ÑÑ½´èÄÁÁáô(¹™¥•±µ…ÁÀµ¹½Ñ¥”ÍÑÉ½¹í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÕÁàí™½¹Ğµİ•¥¡ĞèäÀÀí±¥¹”µ¡•¥¡ĞèÄ¸ÌÕô(¹™¥•±µ…ÁÀµ¹½Ñ¥”ÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÙÁàí½±½ÈèŒäÑ„Íˆàí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÀÁô(¹™¥•±µ…ÁÀµ¹½Ñ¥”•µí…±¥¸µÍ•±˜é•¹Ñ•Èí½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÔÀíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Íí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèÄÑÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁáô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰ÕÑÑ½¹íÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íµ¥¸µ¡•¥¡ĞèÄÜáÁàí‰½É‘•ÈèÅÁàÍ½±¥ÑÉ…¹ÍÁ…É•¹Ğí‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàíÁ…‘‘¥¹œèÄáÁàíÑ•áĞµ…±¥¸é±•™Ğí‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÌÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÜ¤í½Ù•É™±½Üé¡¥‘‘•¸íÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰ÕÑÑ½¸é…™Ñ•Éí½¹Ñ•¹ĞèˆˆíÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÉ¥¡Ğè´ÈÑÁàí‰½ÑÑ½´è´ÌÁÁàíİ¥‘Ñ èÄÀÑÁàí¡•¥¡ĞèÄÀÑÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÌÉÁàí‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸Ğà¤íÑÉ…¹Í™½É´éÉ½Ñ…Ñ” Äá‘•œ¥ô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì€¹‰±Õ•í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°•™˜Ù™˜°™™˜¤í‰½É‘•Èµ½±½Èè™”Í™™ô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì€¹É••¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°•™‘˜Ô°™™˜¤í‰½É‘•Èµ½±½ÈèŒİ˜Í‘•ô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì€¹½É…¹•í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°™™˜İ•°™™˜¤í‰½É‘•Èµ½±½Èè™•İ……ô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì€¹ÁÕÉÁ±•í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°˜Õ˜Í™˜°™™˜¤í‰½É‘•Èµ½±½Èè‘‘Ù™•ô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì¥í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èíİ¥‘Ñ èÔÙÁàí¡•¥¡ĞèÔÙÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàí‰…­É½Õ¹è™™˜í™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÈáÁàí‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Àà¤íµ…É¥¸µ‰½ÑÑ½´èÄáÁáô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰í‘¥ÍÁ±…äé‰±½¬í™½¹ĞµÍ¥é”èÈÅÁàí±¥¹”µ¡•¥¡ĞèÄ¸ÈÈí™½¹Ğµİ•¥¡ĞèÄÀÀÀí½±½ÈèŒÁ˜ÄÜÉ„í±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁáô(¹™¥•±µ…ÁÀµ…Ñ¥½¹ÌÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèåÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèÜÔÀí±¥¹”µ¡•¥¡ĞèÄ¸ĞÕô(¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì•µíÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÉ¥¡ĞèÄáÁàí‰½ÑÑ½´èÄáÁàíèµ¥¹‘•àèÄíİ¥‘Ñ èĞÉÁàí¡•¥¡ĞèĞÉÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹è™™˜í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èí½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÈÙÁàí™½¹Ğµİ•¥¡ĞèØÀÀí‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Ä¥ô(¹™¥•±µ…ÁÀµÍÕµµ…Éä°¹™¥•±µ…ÁÀµÁ…¹•±í‰…­É½Õ¹è™™˜í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàíÁ…‘‘¥¹œèÄáÁàíµ…É¥¸µ‰½ÑÑ½´èÄÙÁàí‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔÔ¥ô(¹™¥•±µ…ÁÀµÁ…¹•°µ¡•…‘í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÁÁàíµ…É¥¸µ‰½ÑÑ½´èÄÑÁáô(¹™¥•±µ…ÁÀµÁ…¹•°µ¡•… Ííµ…É¥¸èÀí½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄåÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀí±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÑÁáô(¹™¥•±µ…ÁÀµÁ…¹•°µ¡•…ÍÁ…¹í½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÔÁô(¹™¥•±µ…ÁÀµÁ…¹•°µ¡•…‰ÕÑÑ½¹í‰½É‘•ÈèÀí‰…­É½Õ¹è•™˜Ù™˜í½±½ÈèŒÈÔØÍ•ˆí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàíÁ…‘‘¥¹œèáÁà€ÄÅÁàí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ°Å™È¤í…ÀèáÁáô(¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‘¥Ùí‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàí‰…­É½Õ¹è˜á™…™ŒíÁ…‘‘¥¹œèÄÉÁà€áÁàíÑ•áĞµ…±¥¸é•¹Ñ•Éô(¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥¥í‘¥ÍÁ±…äé‰±½¬í™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÈÍÁàíµ…É¥¸µ‰½ÑÑ½´èÙÁáô(¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‰í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÈÑÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀí±¥¹”µ¡•¥¡ĞèÅô(¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥ÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÙÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèàÔÁô(¹™¥•±µ…ÁÀµÁ…¹•±Íí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèÄÑÁáô(¹™¥•±µ…ÁÀµ±¥ÍÑí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèåÁáô(¹™¥•±µ…ÁÀµ±¥ÍĞ‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€••˜É˜Üí‰…­É½Õ¹è™‰™‘™˜í‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàíÁ…‘‘¥¹œèÄÍÁàíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Éô(¹™¥•±µ…ÁÀµ±¥ÍĞ‰í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÄÄÄàÈÜí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÔÀí±¥¹”µ¡•¥¡ĞèÄ¸ÌÔí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(¹™¥•±µ…ÁÀµ±¥ÍĞÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÕÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèÜÔÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(¹™¥•±µ…ÁÀµ•µÁÑåí‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàíÁ…‘‘¥¹œèÈÉÁàíÑ•áĞµ…±¥¸é•¹Ñ•Èí½±½ÈèŒäÑ„Íˆàí™½¹Ğµİ•¥¡ĞèäÀÁô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì¹™¥•±µ…ÁÀµ¡½µ•íÁ…‘‘¥¹œèÄÑÁà€ÄÉÁà€ÄÀÙÁáô¹™¥•±µ…ÁÀµÑ½Á‰…ÈÍÑÉ½¹í™½¹ĞµÍ¥é”èÈÉÁáô¹™¥•±µ…ÁÀµ¡•É¼ Éí™½¹ĞµÍ¥é”èÈİÁáô¹™¥•±µ…ÁÀµ…Ñ¥½¹ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèÄÉÁáô¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰ÕÑÑ½¹íµ¥¸µ¡•¥¡ĞèÄØáÁàíÁ…‘‘¥¹œèÄÙÁáô¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰í™½¹ĞµÍ¥é”èÄåÁáô¹™¥•±µ…ÁÀµÁ…¹•±ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ°Å™È¤í…ÀèÙÁáô¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‘¥ÙíÁ…‘‘¥¹œèÄÁÁà€ÑÁáô¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‰í™½¹ĞµÍ¥é”èÈÅÁáô¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥ÍÁ…¹í™½¹ĞµÍ¥é”èÄÁÁáõô)µ•‘¥„¡µ…àµİ¥‘Ñ èÌÜÁÁà¥ì¹™¥•±µ…ÁÀµ…Ñ¥½¹ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È°Å™È¥õô(((¼¨™¥•±µ½‰¥±”U$±•…¹ÕÀ½Ù•ÉÉ¥‘”€¨¼)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì(€€¹™¥•±µ…ÁÀµ¡½µ•ì(€€€Á…‘‘¥¹œèÄÉÁà€ÄÁÁà€ÄÀÑÁàì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸ì(€ô((€€¹™¥•±µ…ÁÀµ¡•É½ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€€€Á…‘‘¥¹œèÈÉÁà€ÄáÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì(€ô((€€¹™¥•±µ…ÁÀµ¡•É¼ Éì(€€€™½¹ĞµÍ¥é”èÈÑÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÈì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÙÁàì(€ô((€€¹™¥•±µ…ÁÀµ¡•É¼Áì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔì(€ô((€€¹™¥•±µ…ÁÀµ¹½Ñ¥•ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì(€ô((€€¹™¥•±µ…ÁÀµ¹½Ñ¥”‰ì(€€€™½¹ĞµÍ¥é”èÄÙÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èáÁàì(€ô((€€¹™¥•±µ…ÁÀµ¹½Ñ¥”ÍÑÉ½¹ì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€€€…ÀèÄÉÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÄĞáÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€€€Á…‘‘¥¹œèÄÙÁà€ÄÑÁàì(€€€‘¥ÍÁ±…äé™±•àì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€€€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì¥ì(€€€İ¥‘Ñ èĞÑÁàì(€€€¡•¥¡ĞèĞÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàì(€€€™½¹ĞµÍ¥é”èÈÉÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì(€€€™±•àèÀ€À…ÕÑ¼ì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€™½¹ĞµÍ¥é”èÄİÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÈì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÌÕÁàì(€€€İ½Éµ‰É•…¬é­••Àµ…±°ì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°ì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹ÌÍÁ…¹ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ…É¥¸µÑ½ÀèİÁàì(€€€½±½ÈèŒØĞÜĞáˆì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Ìàì(€€€™½¹Ğµİ•¥¡ĞèÜÔÀì(€€€İ½Éµ‰É•…¬é­••Àµ…±°ì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€€€‘¥ÍÁ±…äèµİ•‰­¥Ğµ‰½àì(€€€€µİ•‰­¥Ğµ±¥¹”µ±…µÀèÈì(€€€€µİ•‰­¥Ğµ‰½àµ½É¥•¹ĞéÙ•ÉÑ¥…°ì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì•µì(€€€É¥¡ĞèÄÉÁàì(€€€‰½ÑÑ½´èÄÉÁàì(€€€İ¥‘Ñ èÌÑÁàì(€€€¡•¥¡ĞèÌÑÁàì(€€€™½¹ĞµÍ¥é”èÈÉÁàì(€ô((€€¹™¥•±µ…ÁÀµÍÕµµ…Éä°(€€¹™¥•±µ…ÁÀµÁ…¹•±ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì(€ô((€€¹™¥•±µ…ÁÀµÁ…¹•°µ¡•… Íì(€€€™½¹ĞµÍ¥é”èÄáÁàì(€ô((€€¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ°Å™È¤ì(€€€…ÀèÙÁàì(€ô((€€¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‘¥Ùì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€€€Á…‘‘¥¹œèÄÁÁà€ÑÁàì(€ô((€€¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥¥ì(€€€™½¹ĞµÍ¥é”èÈÅÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÕÁàì(€ô((€€¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥‰ì(€€€™½¹ĞµÍ¥é”èÈÅÁàì(€ô((€€¹™¥•±µ…ÁÀµÍÕµµ…ÉäµÉ¥ÍÁ…¹ì(€€€™½¹ĞµÍ¥é”èÄÁÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Èì(€ô((€€¹™¥•±µ…ÁÀµÁ…¹•±Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€€€…ÀèÄÉÁàì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø¹Á•Éµ¥ÍÍ¥½¸µ…İ…É”µµ½‰¥±”µ¹…Ùì(€€€Á…‘‘¥¹œèáÁà€áÁà€ÄÁÁàì(€€€…ÀèáÁàì(€ô((€€¹µ½‰¥±”µ‰½ÑÑ½´µ¹…Ø¹Á•Éµ¥ÍÍ¥½¸µ…İ…É”µµ½‰¥±”µ¹…Ø‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÔáÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€ô)ô()µ•‘¥„¡µ…àµİ¥‘Ñ èÌàÁÁà¥ì(€€¹™¥•±µ…ÁÀµ…Ñ¥½¹Íì(€€€…ÀèÄÁÁàì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÄĞÉÁàì(€€€Á…‘‘¥¹œèÄÑÁà€ÄÉÁàì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹Ì‰ì(€€€™½¹ĞµÍ¥é”èÄÙÁàì(€ô((€€¹™¥•±µ…ÁÀµ…Ñ¥½¹ÌÍÁ…¹ì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€ô)ô(((¹Í…Ù”µ•ÉÉ½Èµ‰½áì(€µ…É¥¸èÄÑÁà€Àì(€Á…‘‘¥¹œèÄÍÁà€ÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€™•…„ì(€‰…­É½Õ¹è™•˜É˜Èì(€½±½ÈèŒääÅˆÅˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÔÀì)ô(¹‘É…™Ğµ¡•±ÀµÑ•áÑì(€µ…É¥¸èÄÁÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÜÔÀì(€Ñ•áĞµ…±¥¸éÉ¥¡Ğì)ô)‰ÕÑÑ½¸é‘¥Í…‰±•‘ì(€½Á…¥Ñäè¸ÔÔì(€ÕÉÍ½Èé¹½Ğµ…±±½İ•ì)ô(((¹É½±”µµ½‰¥±”µÍ¡••Ñì(€Á½Í¥Ñ¥½¸é™¥á•ì(€±•™ĞèÀì(€É¥¡ĞèÀì(€‰½ÑÑ½´èÜáÁàì(€èµ¥¹‘•àèäääàì(€Á…‘‘¥¹œèÀ€ÄÉÁàì(€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹”ì)ô(¹É½±”µµ½‰¥±”µÍ¡••Ğµ…É‘ì(€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé…ÕÑ¼ì(€µ…àµİ¥‘Ñ èÜØÁÁàì(€µ…É¥¸èÀ…ÕÑ¼ì(€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸äà¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÈÉÁà€ÜÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÈÈ¤ì(€Á…‘‘¥¹œèÄÙÁàì)ô(¹É½±”µµ½‰¥±”µÍ¡••Ğµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÁÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì)ô(¹É½±”µµ½‰¥±”µÍ¡••Ğµ¡•…ÍÑÉ½¹ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÄáÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹É½±”µµ½‰¥±”µÍ¡••Ğµ¡•…‰ÕÑÑ½¹ì(€‰½É‘•ÈèÀì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒÌÌĞÄÔÔì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€Á…‘‘¥¹œèáÁà€ÄÉÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì)ô(¹É½±”µµ½‰¥±”µÍ¡••ĞµÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÁÁàì)ô(¹É½±”µµ½‰¥±”µÍ¡••ĞµÉ¥‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèÔÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€‰…­É½Õ¹è˜á™…™Œì(€½±½ÈèŒÄÄÄàÈÜì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€Á…‘‘¥¹œèÄÁÁà€ÄÉÁàì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì(€Ñ•áĞµ…±¥¸é±•™Ğì)ô(¹É½±”µµ½‰¥±”µÍ¡••ĞµÉ¥‰ÕÑÑ½¸¹É½±”µµ½‰¥±”µ±½½ÕÑì(€É¥µ½±Õµ¸èÄ¼´Äì(€‰…­É½Õ¹è™•”É”Èì(€‰½É‘•Èµ½±½Èè™•…„ì(€½±½ÈèˆäÅŒÅŒì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô(¹É½±”µ…İ…É”µ‰½ÑÑ½´µ¹…Ùì(€‰½àµÍ¡…‘½ÜèÀ€´ÄÁÁà€ÌÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Ä¤ì)ô(¹É½±”µ…İ…É”µ‰½ÑÑ½´µ¹…Ø‰ÕÑÑ½¹ì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì(€€¹É½±”µµ½‰¥±”µÍ¡••Ñì(€€€‰½ÑÑ½´èÜÑÁàì(€€€Á…‘‘¥¹œèÀ€áÁàì(€ô(€€¹É½±”µµ½‰¥±”µÍ¡••Ğµ…É‘ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€€€Á…‘‘¥¹œèÄÑÁàì(€ô(€€¹É½±”µµ½‰¥±”µÍ¡••ĞµÉ¥‘ì(€€€…ÀèáÁàì(€ô(€€¹É½±”µµ½‰¥±”µÍ¡••ĞµÉ¥‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÔÉÁàì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàì(€ô)ô(((¹ÕÁ±½…µÁÉ•Ù¥•ÜµÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥±°±µ¥¹µ…à äÉÁà°Å™È¤¤ì(€…ÀèÄÁÁàì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô(¹ÕÁ±½…µÁÉ•Ù¥•ÜµÑ¡Õµ‰ì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€…ÍÁ•ĞµÉ…Ñ¥¼èÄ¼Äì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰”Í•”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€Á…‘‘¥¹œèÀì(€‰…­É½Õ¹è™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô(¹ÕÁ±½…µÁÉ•Ù¥•ÜµÑ¡Õµˆ¥µì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÄÀÀ”ì(€½‰©•Ğµ™¥Ğé½Ù•Èì(€‘¥ÍÁ±…äé‰±½¬ì)ô(((¹ÕÁ±½…µ‰½ÑÑ½´µÍÕ‰µ¥Ñì(€µ…É¥¸µÑ½ÀèÄáÁàì)ô()µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì(€€¹ÕÁ±½…µÁÉ•Ù¥•ÜµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤ì(€€€…ÀèÄÉÁàì(€ô((€€¹ÕÁ±½…µÁÉ•Ù¥•ÜµÑ¡Õµ‰ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€€€µ¥¸µ¡•¥¡ĞèÄÌÉÁàì(€ô((€€¹ÕÁ±½…µ‰½ÑÑ½´µÍÕ‰µ¥Ñì(€€€µ¥¸µ¡•¥¡ĞèÔáÁàì(€€€™½¹ĞµÍ¥é”èÄáÁàì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô)ô(((¹Á¡½Ñ¼µÙ¥•İ•Èµ‰…­‘É½Áì(€Á½Í¥Ñ¥½¸é™¥á•ì(€¥¹Í•ĞèÀì(€èµ¥¹‘•àèÄÀÀÀÀÀì(€‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸àÈ¤ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€Á…‘‘¥¹œèÄáÁàì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµµ½‘…±ì(€İ¥‘Ñ éµ¥¸ äàÁÁà°äÙÙÜ¤ì(€µ…àµ¡•¥¡ĞèäÑÙ ì(€‰…­É½Õ¹èŒÁ˜ÄÜÉ„ì(€‰½É‘•ÈèÅÁàÍ½±¥É‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÄĞ¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€ÄÀÁÁàÉ‰„ À°À°À°¸ĞÔ¤ì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÉÁàì(€Á…‘‘¥¹œèÄÑÁà€ÄÙÁàì(€½±½Èè™™˜ì(€‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸äÈ¤ì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµ¡•…ÍÑÉ½¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€™½¹ĞµÍ¥é”èÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµ¡•…ÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÍÁàì(€½±½Èè‰Õ”Äì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèàÔÀì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµ¡•…‰ÕÑÑ½¹ì(€‰½É‘•ÈèÀì(€‰…­É½Õ¹è™™˜ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€Á…‘‘¥¹œèáÁà€ÄÍÁàì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµ‰½‘åì(€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì(€µ¥¸µ¡•¥¡ĞèÌØÁÁàì(€µ…àµ¡•¥¡ĞèÜÁÙ ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€‰…­É½Õ¹èŒÀÈÀØÄÜì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµ‰½‘ä¥µì(€µ…àµİ¥‘Ñ èÄÀÀ”ì(€µ…àµ¡•¥¡ĞèÜÁÙ ì(€½‰©•Ğµ™¥Ğé½¹Ñ…¥¸ì(€‘¥ÍÁ±…äé‰±½¬ì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµ¹…Ùì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€Ñ½ÀèÔÀ”ì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÔÀ”¤ì(€İ¥‘Ñ èĞáÁàì(€¡•¥¡ĞèØÑÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÄØ¤ì(€½±½Èè™™˜ì(€™½¹ĞµÍ¥é”èĞÉÁàì(€±¥¹”µ¡•¥¡ĞèÄì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹Á¡½Ñ¼µÙ¥•İ•Èµ¹…Ø¹ÁÉ•Ùí±•™ĞèÄÉÁáô(¹Á¡½Ñ¼µÙ¥•İ•Èµ¹…Ø¹¹•áÑíÉ¥¡ĞèÄÉÁáô(¹Á¡½Ñ¼µÙ¥•İ•ÈµÑ¡Õµ‰Íì(€‘¥ÍÁ±…äé™±•àì(€…ÀèáÁàì(€½Ù•É™±½Üµàé…ÕÑ¼ì(€Á…‘‘¥¹œèÄÉÁàì(€‰…­É½Õ¹èŒÄÄÄàÈÜì)ô(¹Á¡½Ñ¼µÙ¥•İ•ÈµÑ¡Õµ‰Ì‰ÕÑÑ½¹ì(€™±•àèÀ€À€ÔáÁàì(€İ¥‘Ñ èÔáÁàì(€¡•¥¡ĞèÔáÁàì(€‰½É‘•ÈèÉÁàÍ½±¥ÑÉ…¹ÍÁ…É•¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€Á…‘‘¥¹œèÀì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‰…­É½Õ¹èŒÅ˜ÈäÌÜì)ô(¹Á¡½Ñ¼µÙ¥•İ•ÈµÑ¡Õµ‰Ì‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€‰½É‘•Èµ½±½ÈèŒØÁ„Õ™„ì)ô(¹Á¡½Ñ¼µÙ¥•İ•ÈµÑ¡Õµ‰Ì¥µì(€İ¥‘Ñ èÄÀÀ”ì(€¡•¥¡ĞèÄÀÀ”ì(€½‰©•Ğµ™¥Ğé½Ù•Èì(€‘¥ÍÁ±…äé‰±½¬ì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì(€€¹Á¡½Ñ¼µÙ¥•İ•Èµ‰…­‘É½Áì(€€€Á…‘‘¥¹œèÀì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì(€ô(€€¹Á¡½Ñ¼µÙ¥•İ•Èµµ½‘…±ì(€€€İ¥‘Ñ èÄÀÁÙÜì(€€€µ…àµ¡•¥¡ĞèÄÀÁÙ ì(€€€¡•¥¡ĞèÄÀÁÙ ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÀì(€ô(€€¹Á¡½Ñ¼µÙ¥•İ•Èµ‰½‘åì(€€€™±•àèÄì(€€€µ¥¸µ¡•¥¡ĞèÀì(€€€µ…àµ¡•¥¡Ğé¹½¹”ì(€ô(€€¹Á¡½Ñ¼µÙ¥•İ•Èµ‰½‘ä¥µì(€€€µ…àµ¡•¥¡ĞèÄÀÀ”ì(€ô(€€¹Á¡½Ñ¼µÙ¥•İ•Èµ¹…Ùì(€€€İ¥‘Ñ èĞÉÁàì(€€€¡•¥¡ĞèÔáÁàì(€€€™½¹ĞµÍ¥é”èÌÙÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€ô)ô(((¹ÕÁ±½…µÁ‘˜µ±¥ÍÑì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÉÁàì)ô(¹ÕÁ±½…µÁ‘˜µ¡¥Áì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼€Å™È…ÕÑ¼ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÁÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€™•…„ì(€‰…­É½Õ¹è™™˜İ˜Üì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€Á…‘‘¥¹œèÄÅÁà€ÄÉÁàì(€Ñ•áĞµ…±¥¸é±•™Ğì)ô(¹ÕÁ±½…µÁ‘˜µ¡¥ÀÍÁ…¸°(¹É••¥ÁĞµÁ‘˜µÑ¡ÕµˆÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€‰…­É½Õ¹è•˜ĞĞĞĞì(€½±½Èè™™˜ì(€‰½É‘•ÈµÉ…‘¥ÕÌèåÁàì(€Á…‘‘¥¹œèÕÁà€İÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹ÕÁ±½…µÁ‘˜µ¡¥À‰ì(€µ¥¸µİ¥‘Ñ èÀì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô(¹ÕÁ±½…µÁ‘˜µ¡¥À•µì(€½±½Èè•˜ĞĞĞĞì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì)ô(¹É••¥ÁĞµÁ‘˜µÑ¡Õµ‰ì(€İ¥‘Ñ èÔáÁàì(€¡•¥¡ĞèÔáÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€™•…„ì(€‰…­É½Õ¹è™™˜İ˜Üì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€Á…‘‘¥¹œèÀì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì)ô(¹Á‘˜µÙ¥•İ•Èµµ½‘…±ì(€İ¥‘Ñ éµ¥¸ äàÁÁà°äÙÙÜ¤ì(€¡•¥¡Ğéµ¥¸ àØÁÁà°äÑÙ ¤ì(€‰…­É½Õ¹èŒÁ˜ÄÜÉ„ì(€‰½É‘•ÈèÅÁàÍ½±¥É‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÄĞ¤ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÑÁàì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€ÄÀÁÁàÉ‰„ À°À°À°¸ĞÔ¤ì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì)ô(¹Á‘˜µÙ¥•İ•Èµµ½‘…°¥™É…µ•ì(€™±•àèÄì(€İ¥‘Ñ èÄÀÀ”ì(€‰½É‘•ÈèÀì(€‰…­É½Õ¹è™™˜ì)ô(¹Á‘˜µÙ¥•İ•Èµ…Ñ¥½¹Íì(€Á…‘‘¥¹œèÄÁÁà€ÄÑÁàì(€‰…­É½Õ¹èŒÄÄÄàÈÜì(€Ñ•áĞµ…±¥¸éÉ¥¡Ğì)ô(¹Á‘˜µÙ¥•İ•Èµ…Ñ¥½¹Ì…ì(€½±½Èè‘‰•…™”ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì(€Ñ•áĞµ‘•½É…Ñ¥½¸é¹½¹”ì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì(€€¹Á‘˜µÙ¥•İ•Èµµ½‘…±ì(€€€İ¥‘Ñ èÄÀÁÙÜì(€€€¡•¥¡ĞèÄÀÁÙ ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÀì(€ô)ô(((¹…Ñ¥Ù¥Ñäµ±½œµÁ…”€¹µÕÑ•‘ì(€µ…É¥¸èÑÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÜÔÀì)ô(¹…Ñ¥Ù¥Ñäµ±½œµÁ…”Ñ…‰±”Ñ‘ì(€Ù•ÉÑ¥…°µ…±¥¸éµ¥‘‘±”ì)ô(¹…Ñ¥Ù¥Ñäµ±½œµÁ…”Ñ¹•¹Ñ•Éì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€½±½ÈèŒäÑ„Íˆàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€Á…‘‘¥¹œèÈáÁàì)ô(((¹ÑÉ…Í µÁ…”€¹µÕÑ•‘ì(€µ…É¥¸èÑÁà€À€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÜÔÀì)ô(¹ÑÉ…Í µÁ…”Ñ¹•¹Ñ•Éì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€½±½ÈèŒäÑ„Íˆàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€Á…‘‘¥¹œèÈáÁàì)ô(¹ÑÉ…Í µÁ…”‰ÕÑÑ½¸¹‘…¹•È°(¹µ½‰¥±”µ±¥ÍĞµ…Ñ¥½¹Ì‰ÕÑÑ½¸¹‘…¹•Éì(€‰…­É½Õ¹è™•”É”Èì(€½±½ÈèˆäÅŒÅŒì(€‰½É‘•Èµ½±½Èè™•…„ì)ô(((¹‰…­ÕÀµ…Ñ¥½¹Ì‰ÕÑÑ½¸é‘¥Í…‰±•‘ì(€½Á…¥Ñäè¸ÔÔì(€ÕÉÍ½Èé¹½Ğµ…±±½İ•ì)ô(((¼¨!½µ”‘…Í¡‰½…ÉÁÉ¼ÕÁÉ…‘”€´Í½Á•Ñ¼¡½µ”½¹±ä€¨¼(¹µ½‘•É¸µ¡½µ”µÍ¡•±°µÁÉ½ì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™‰™˜€À”°˜Í˜Ù™ˆ€ÄÀÀ”¤ì(€‰½É‘•ÈèÅÁàÍ½±¥€”İ••˜àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÉÁàì(€Á…‘‘¥¹œèÈÑÁàì)ô(¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ½ì(€Á…‘‘¥¹œèÉÁà€ÉÁà€áÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì)ô(¹µ½‘•É¸µ¡½µ”µ•å•‰É½İì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€µ…É¥¸µ‰½ÑÑ½´èáÁàì(€Á…‘‘¥¹œèÕÁà€ÄÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è•…˜É™˜ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œè¸İÁàì)ô(¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ¼ Éì(€™½¹ĞµÍ¥é”èÌÑÁàì(€±¥¹”µ¡•¥¡ĞèÄ¸Äì(€±•ÑÑ•ÈµÍÁ…¥¹œè´Ä¸ÉÁàì)ô(¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÁÁàì)ô(¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µ…Ñ¥½¹ÌÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€¡•¥¡ĞèĞÁÁàì(€Á…‘‘¥¹œèÀ€ÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰”İ˜Ôì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è™™˜ì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞ¤ì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ½ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ø±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÑÁàì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¥ì(€µ¥¸µ¡•¥¡ĞèÄÈÉÁàì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔÑÁà€Å™Èì(€…ÀèáÁà€ÄÍÁàì(€Á…‘‘¥¹œèÄáÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹ì(€İ¥‘Ñ èÔÁÁàì(€¡•¥¡ĞèÔÁÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàì(€™½¹ĞµÍ¥é”èÈÑÁàì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤•µì(€™½¹ĞµÍ¥é”èÄÍÁàì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤‰ì(€™½¹ĞµÍ¥é”èÈÑÁàì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁàì(€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°ì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤Íµ…±±ì(€™½¹ĞµÍ¥é”èÄÉÁàì(€µ…É¥¸µÑ½ÀèáÁàì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¤¹½É…¹”€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°˜äÜÌÄØ°™ˆäÈÍŒ¥ô(¹µ½‘•É¸µ¡½µ”µ­Á¤¹½É…¹”‰í½±½Èè•„ÔàÁô(¹µ½‘•É¸µ¡½µ”µ­Á¤¹…µ‰•Éí‰…­É½Õ¹è™™™…˜Àí‰½É‘•Èµ½±½Èè™‘”Øá…ô(¹µ½‘•É¸µ¡½µ”µ­Á¤¹…µ‰•È€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°˜Ôå”Áˆ°™‰‰˜ÈĞ¥ô(¹µ½‘•É¸µ¡½µ”µ­Á¤¹…µ‰•È‰í½±½ÈèäÜÜÀÙô(¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥Áì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ô±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÉÁàì(€µ…É¥¸è´ÑÁà€À€ÄáÁàì)ô(¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥À‰ÕÑÑ½¹ì(€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàì(€‰…­É½Õ¹è™™˜ì(€Á…‘‘¥¹œèÄÕÁà€ÄÙÁàì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÁÁàì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞÔ¤ì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥ÀÍÁ…¹ì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô(¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥À‰ì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÈÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹µ½‘•É¸µ¡½µ”µÉ¥¹±½Íì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô(¹µ½‘•É¸µ¡½µ”µ±½œµÁ…¹•±ì(€Á…‘‘¥¹œµ‰½ÑÑ½´èÄáÁàì)ô(¹µ½‘•É¸µ¡½µ”µÁ‘˜µµ¥¹¥ì(€µ…É¥¸µÑ½ÀèÄÉÁàì(€Á…‘‘¥¹œµÑ½ÀèÄÉÁàì(€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€•‘˜É˜Üì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèİÁàì)ô(¹µ½‘•É¸µ¡½µ”µÁ‘˜µµ¥¹¤ÍÑÉ½¹ì(€½±½ÈèŒÄÄÄàÈÜì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹µ½‘•É¸µ¡½µ”µÁ‘˜µµ¥¹¤‰ÕÑÑ½¹ì(€‰½É‘•ÈèÀì(€‰…­É½Õ¹è™™˜ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼€Å™Èì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèåÁàì(€Á…‘‘¥¹œèÕÁà€Àì(€Ñ•áĞµ…±¥¸é±•™Ğì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹µ½‘•É¸µ¡½µ”µÁ‘˜µµ¥¹¤ÍÁ…¹ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€¡•¥¡ĞèÈÉÁàì(€Á…‘‘¥¹œèÀ€İÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèİÁàì(€‰…­É½Õ¹è•˜ĞĞĞĞì(€½±½Èè™™˜ì(€™½¹ĞµÍ¥é”èÄÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹µ½‘•É¸µ¡½µ”µÁ‘˜µµ¥¹¤‰ì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé±…ÍĞµ¡¥±‘ì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÄĞÀÁÁà¥ì(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ½ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤ì(€ô(€€¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥Áì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤ì(€ô)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ½‘•É¸µ¡½µ”µÍ¡•±°µÁÉ½ì(€€€Á…‘‘¥¹œèÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô(€€¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ½ì(€€€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€ô(€€¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ¼ Éì(€€€™½¹ĞµÍ¥é”èÈáÁàì(€ô(€€¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µ…Ñ¥½¹Íì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€ô(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼°(€€¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥Áì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¥ì(€€€µ¥¸µ¡•¥¡ĞèÄÀÕÁàì(€ô)ô(((¼¨!½µ”‘…Í¡‰½…É™¥¹…°½ÁÑ¥µ¥é…Ñ¥½¸€´Í…™”ML½¹±ä€¨¼(¹µ½‘•É¸µ¡½µ”µÍ¡•±°µÁÉ½ì(€Á…‘‘¥¹œèÈÉÁà€ÈÑÁà€ÌÑÁàì(€‰…­É½Õ¹è(€€€É…‘¥…°µÉ…‘¥•¹Ğ¡¥É±”…Ğ€à”€À”°É‰„ ÌÜ°ää°ÈÌÔ°¸Àà¤°ÑÉ…¹ÍÁ…É•¹Ğ€Èà”¤°(€€€É…‘¥…°µÉ…‘¥•¹Ğ¡¥É±”…Ğ€äÈ”€à”°É‰„ ää°ÄÀÈ°ÈĞÄ°¸Àà¤°ÑÉ…¹ÍÁ…É•¹Ğ€ÈØ”¤°(€€€±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™‰™˜€À”°˜Í˜Ù™ˆ€ÄÀÀ”¤ì)ô(¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ½ì(€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì)ô(¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ¼ Éì(€µ…É¥¸µÑ½ÀèÉÁàì)ô(¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ¼Áì(€µ…àµİ¥‘Ñ èÜØÁÁàì(€±¥¹”µ¡•¥¡ĞèÄ¸ÔÔì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ½ì(€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¥ì(€µ¥¸µ¡•¥¡ĞèÄÄáÁàì(€¡•¥¡ĞèÄÀÀ”ì(€…±¥¸µ½¹Ñ•¹Ğé•¹Ñ•Èì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔÔ¤ì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤é¡½Ù•Éì(€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÅÁà¤ì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤‰ì(€™½¹ĞµÍ¥é”èÈÉÁàì(€±¥¹”µ¡•¥¡ĞèÄ¸Èì(€İ½Éµ‰É•…¬é­••Àµ…±°ì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤Íµ…±±ì(€µ¥¸µ¡•¥¡ĞèÄÙÁàì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì)ô(¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤ù¥ì(€…±¥¸µÍ•±˜é•¹ì)ô(¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥Áì(€…ÀèÄÁÁàì)ô(¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥À‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèĞáÁàì(€Á…‘‘¥¹œèÄÉÁà€ÄÑÁàì)ô(¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥ÀÍÁ…¹ì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥À‰ì(€™½¹ĞµÍ¥é”èÄáÁàì)ô(¹µ½‘•É¸µ¡½µ”µÉ¥¹µ¥‘‘±•ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄ¸Àá™È€Ä¸Àá™È€¸àÉ™È€¸äÙ™Èì(€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì)ô(¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½µì(€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì)ô(¹µ½‘•É¸µ¡½µ”µÁ…¹•±ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔÔ¤ì)ô(¹µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…‘ì(€µ¥¸µ¡•¥¡ĞèÈáÁàì)ô(¹µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•… Íì(€™½¹ĞµÍ¥é”èÄáÁàì)ô(¹µ½‘•É¸µ¡½µ”µÁ…¹•°µ¡•…‰ÕÑÑ½¹ì(€Á…‘‘¥¹œèÑÁà€ÉÁàì)ô(¹µ½‘•É¸µ¡½µ”µ•µÁÑåì(€µ¥¸µ¡•¥¡ĞèÜÁÁàì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€‰½É‘•ÈèÅÁà‘…Í¡•€‘‰”Ñ˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™‰™‘™˜ì(€½±½ÈèŒäÑ„Íˆàì(€™½¹Ğµİ•¥¡ĞèäÔÀì)ô(¹µ½‘•É¸µ¡½µ”µÑ…‰±•ì(€Ñ…‰±”µ±…å½ÕĞé™¥á•ì)ô(¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ¡ì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ‘ì(€¡•¥¡ĞèÌÑÁàì(€Ù•ÉÑ¥…°µ…±¥¸éµ¥‘‘±”ì)ô(¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± È¤°(¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± Ì¤°(¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñé¹Ñ µ¡¥± Ğ¥ì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹µ½‘•É¸µ¡½µ”µ±½œµÁ…¹•°€¹µ½‘•É¸µ¡½µ”µÑ…‰±”Ñ‘ì(€¡•¥¡ĞèÌÉÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô(¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÉ½İì(€µ¥¸µ¡•¥¡ĞèØÑÁàì)ô(¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÑ¡Õµ‰ì(€‰½àµÍ¡…‘½Üé¥¹Í•Ğ€À€À€À€ÅÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤ì)ô(¹µ½‘•É¸µ¡½µ”µÁ‘˜µµ¥¹¥ì(€‰½É‘•ÈµÑ½ÀµÍÑå±”é‘…Í¡•ì)ô(¹µ¥¹¤µ…±•¹‘…Èµ‘…åì(€¡•¥¡ĞèÈÙÁàì)ô(¹µ¥¹¤µ…±•¹‘…ÈµÑ½½±Ñ¥Áì(€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹”ì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÄÔÀÁÁà¥ì(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¥ì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔÁÁà€Å™Èì(€ô(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹ì(€€€İ¥‘Ñ èĞÙÁàì(€€€¡•¥¡ĞèĞÙÁàì(€ô(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤‰ì(€€€™½¹ĞµÍ¥é”èÈÁÁàì(€ô)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÄÈÀÁÁà¥ì(€€¹µ½‘•É¸µ¡½µ”µÉ¥¹µ¥‘‘±•ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èì(€ô(€€¹µ½‘•É¸µ¡½µ”µÉ¥¹‰½ÑÑ½µì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èì(€ô)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ½ì(€€€…ÀèÄÉÁàì(€ô(€€¹µ½‘•É¸µ¡½µ”µ¥¹ÑÉ¼µÁÉ¼Áì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€ô(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ½ì(€€€…ÀèÄÁÁàì(€ô(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÔÁÁà€Å™È…ÕÑ¼ì(€€€µ¥¸µ¡•¥¡ĞèàÉÁàì(€€€Á…‘‘¥¹œèÄÑÁàì(€ô(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤µ¥½¹ì(€€€É¥µÉ½Üé…ÕÑ¼ì(€ô(€€¹µ½‘•É¸µ¡½µ”µ­Á¥ÌµÁÉ¼€¹µ½‘•É¸µ¡½µ”µ­Á¤ù¥ì(€€€É¥µ½±Õµ¸é…ÕÑ¼ì(€€€…±¥¸µÍ•±˜é•¹Ñ•Èì(€ô(€€¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥À‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€ô)ô(((¼¨5½‰¥±”…±•¹‘…È½Á¡½Ñ¼±…å½ÕĞ™¥à€¨¼)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ½‘•É¸µ¡½µ”µÉ¥¹µ¥‘‘±•ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¹µ½‘•É¸µ¡½µ”µµ¥¹¤µ…±•¹‘…ÈµÁ…¹•±ì(€€€İ¥‘Ñ èÄÀÀ”ì(€ô((€€¹µ¥¹¤µ…±•¹‘…ÈµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü±µ¥¹µ…à À°Å™È¤¤ì(€€€…ÀèÕÁàì(€ô((€€¹µ¥¹¤µ…±•¹‘…Èµİ••­ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü±µ¥¹µ…à À°Å™È¤¤ì(€€€…ÀèÕÁàì(€ô((€€¹µ¥¹¤µ…±•¹‘…Èµ‘…åì(€€€µ¥¸µ¡•¥¡ĞèÌÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèÌÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”ì(€ô((€€¹µ¥¹¤µ…±•¹‘…Èµ‘…ä¹Ñ½‘…åì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€ô((€€¹µ¥¹¤µ…±•¹‘…Èµ‘…ä¥ì(€€€É¥¡ĞèÍÁàì(€€€‰½ÑÑ½´èÍÁàì(€ô((€€¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÉ½İì(€€€µ¥¸µ¡•¥¡ĞèÜÁÁàì(€ô((€€¹µ½‘•É¸µ¡½µ”µÁ¡½Ñ¼µÑ¡Õµ‰ì(€€€İ¥‘Ñ èÔÑÁàì(€€€¡•¥¡ĞèÔÑÁàì(€ô)ô(((¼¨U¹¥™¥•I@‘…Ñ”¥¹ÁÕĞ€¨¼(¹‘…Ñ”µ¥¹ÁÕĞµİÉ…Áì(€İ¥‘Ñ èÄÀÀ”ì)ô(¹‘…Ñ”µ¥¹ÁÕĞµİÉ…À€¹‘…Ñ”µÑ•áĞµ¥¹ÁÕÑì(€µ¥¸µİ¥‘Ñ èÀì)ô(¹‘…Ñ”µ¥¹ÁÕĞµİÉ…À€¹‘…Ñ”µÁ¥­•Èµ¥¹ÁÕÑì(€µ¥¸µİ¥‘Ñ èĞÑÁàì)ô(¹‘…Ñ”µ¥¹ÁÕĞµİÉ…À€¹‘…Ñ”µÁ¥­•Èµ‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èĞÑÁàì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‘…Ñ”µ¥¹ÁÕĞµİÉ…Áì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€ĞÙÁàì(€ô(€€¹‘…Ñ”µ¥¹ÁÕĞµİÉ…À€¹‘…Ñ”µÑ•áĞµ¥¹ÁÕÑì(€€€¡•¥¡ĞèĞÙÁàì(€ô(€€¹‘…Ñ”µ¥¹ÁÕĞµİÉ…À€¹‘…Ñ”µÁ¥­•Èµ¥¹ÁÕÑì(€€€İ¥‘Ñ èĞÙÁàì(€€€µ¥¸µİ¥‘Ñ èĞÙÁàì(€€€¡•¥¡ĞèĞÙÁàì(€ô(€€¹‘…Ñ”µ¥¹ÁÕĞµİÉ…À€¹‘…Ñ”µÁ¥­•Èµ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èĞÙÁàì(€€€µ¥¸µİ¥‘Ñ èĞÙÁàì(€€€¡•¥¡ĞèĞÙÁàì(€ô)ô(((¼¨5…¥¹Ñ•¹…¹”É•½µµ•¹‘•¥Ñ•µÌ€¨¼(¹µ…¥¹ĞµÍÕ•ÍĞµ‰½áì(€µ…É¥¸èÄÙÁà€À€ÄáÁàì(€Á…‘‘¥¹œèÄÙÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰•…™”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™‰™˜°™™™™™˜¤ì(€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞÔ¤ì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄÉÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÉÁàì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ¡•…ÍÑÉ½¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÄÙÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ¡•…ÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÑÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ¡¥ÁÍì(€‘¥ÍÁ±…äé™±•àì(€™±•àµİÉ…ÀéİÉ…Àì(€…ÀèáÁàì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ¡¥ÁÌ‰ÕÑÑ½¹ì(€‰½É‘•ÈèÅÁàÍ½±¥€‰™‘‰™”ì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÅÑ•àì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€Á…‘‘¥¹œèáÁà€ÄÅÁàì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèİÁàì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ¡¥ÁÌ‰ÕÑÑ½¸‰ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ¡¥ÁÌ‰ÕÑÑ½¸ÍÁ…¹ì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ¡¥ÁÌ¹µÕÑ•‰ÕÑÑ½¹ì(€‰½É‘•Èµ½±½Èè”É”á˜Àì(€‰…­É½Õ¹è˜á™…™Œì(€½±½ÈèŒÌÌĞÄÔÔì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµ•µÁÑåì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€µ¥¸µ¡•¥¡ĞèÔáÁàì(€Á…‘‘¥¹œèÄÉÁàì(€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™™˜ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÔÀì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ…¥¹ĞµÍÕ•ÍĞµ¡•…‘ì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€ô(€€¹µ…¥¹ĞµÍÕ•ÍĞµ¡•…‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€ô(€€¹µ…¥¹ĞµÍÕ•ÍĞµ¡¥ÁÌ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€ô)ô(((¹µ…¥¹ĞµÍÕ•ÍĞµ¡•…ÍÑÉ½¹œ•µì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€µ…É¥¸µ±•™ĞèáÁàì(€µ¥¸µİ¥‘Ñ èÌÁÁàì(€¡•¥¡ĞèÈÁÁàì(€Á…‘‘¥¹œèÀ€İÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è‘‰•…™”ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµÍÕ‰¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€µ…É¥¸èÑÁà€À€ÄÁÁàì(€½±½ÈèŒÌÌĞÄÔÔì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµÍÕ‰¡•…ÍÑÉ½¹ì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµÍÕ‰¡•…ÍÁ…¹ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµµ½É•ì(€µ…É¥¸µÑ½ÀèÄÁÁàì(€‘¥ÍÁ±…äé™±•àì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµµ½É”‰ÕÑÑ½¹ì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰•…™”ì(€‰…­É½Õ¹è™™˜ì(€½±½ÈèŒÈÔØÍ•ˆì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€Á…‘‘¥¹œèáÁà€ÄÙÁàì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹µ…¥¹ĞµÍÕ•ÍĞµµ½É”‰ÕÑÑ½¸é¡½Ù•Éì(€‰…­É½Õ¹è•™˜Ù™˜ì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ…¥¹ĞµÍÕ•ÍĞµµ½É”‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€ô)ô((((¹ÁÕÉ¡…Í”µÁ•É¥½µ‰ÕÑÑ½¹Íí‘¥ÍÁ±…äé™±•àí™±•àµİÉ…ÀéİÉ…Àí…ÀèáÁàíµ…É¥¸èÄÉÁà€À€ÄÁÁáô¹ÁÕÉ¡…Í”µÁ•É¥½µ‰ÕÑÑ½¹Ì‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äí‰…­É½Õ¹è™™˜í‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàíÁ…‘‘¥¹œèİÁà€ÄÅÁàí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÀÀí½±½ÈèŒÌÌĞÄÔÔíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹ÁÕÉ¡…Í”µÁ•É¥½µ‰ÕÑÑ½¹Ì‰ÕÑÑ½¸é¡½Ù•Éí‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆí½±½ÈèŒÈÔØÍ•ˆí‰…­É½Õ¹è˜á™‰™™ô(¹ÁÕÉ¡…Í”µÁ…”µÍÕµµ…Éåì(€µ…É¥¸èÄÉÁà€À€áÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô(¹ÁÕÉ¡…Í”µÁ…¥¹…Ñ¥½¹ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€…ÀèÙÁàì(€™±•àµİÉ…ÀéİÉ…Àì(€µ…É¥¸µÑ½ÀèÄÑÁàì)ô(¹ÁÕÉ¡…Í”µÁ…¥¹…Ñ¥½¸‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èÌÙÁàì(€¡•¥¡ĞèÌÑÁàì(€Á…‘‘¥¹œèÀ€ÄÁÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰Õ”Äì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€‰…­É½Õ¹è™™˜ì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹ÁÕÉ¡…Í”µÁ…¥¹…Ñ¥½¸‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆì(€½±½Èè™™˜ì)ô(¹ÁÕÉ¡…Í”µÁ…¥¹…Ñ¥½¸‰ÕÑÑ½¸é‘¥Í…‰±•‘ì(€½Á…¥Ñäè¸ĞÔì(€ÕÉÍ½Èé¹½Ğµ…±±½İ•ì)ô(¹ÁÕÉ¡…Í”µÁ…”µÉ½ÕÁì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÙÁàì)ô(¹ÁÕÉ¡…Í”µÁ…”µ•±±¥ÁÍ¥Íì(€½±½ÈèŒäÑ„Íˆàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô(((¼¨€ôôôôôAÕÉ¡…Í”1½½­ÕÀ½µÁ…ĞI½İÌ€ôôôôô€¨¼(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÁÕÉ¡…Í”µ™¥±Ñ•ÈµÉ¥‘ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ø±µ¥¹µ…à À°Å™È¤¤ì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±”Ñ…‰±•ì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸ÈÈ€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±”Ñ¡ì(€Á…‘‘¥¹œèÙÁà€áÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±”Ñ‘ì(€Á…‘‘¥¹œèÙÁà€áÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸ÈÈ€…¥µÁ½ÉÑ…¹Ğì(€Ù•ÉÑ¥…°µ…±¥¸éµ¥‘‘±”€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÁÕÉ¡…Í”µ¥Ñ•´µ‘•Ñ…¥°µ‰ÕÑÑ½¹ì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€±¥¹”µ¡•¥¡ĞèÄ¸ÈÈ€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü°(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹Ğµ™¥±”µ‰ÕÑÑ½¹ì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹¥½¹ì(€Á…‘‘¥¹œèÑÁà€ÙÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µ¡•¥¡ĞèÈáÁà€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹¥½¸ÍÙì(€İ¥‘Ñ èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹Ñ…àµ¥¹Ù½¥”µ¡•­ì(€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€…ÀèÙÁàì(€µ¥¸µİ¥‘Ñ èÜÙÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹Ñ…àµ¥¹Ù½¥”µ¡•¬¹¡•­•‘ì(€½±½ÈèŒÄÔàÀÍì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹Ñ…àµ¥¹Ù½¥”µ¡•¬¥¹ÁÕÑì(€İ¥‘Ñ èÄáÁàì(€¡•¥¡ĞèÄáÁàì(€µ…É¥¸èÀì(€…•¹Ğµ½±½ÈèŒÄÙ„ÌÑ„ì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹Ñ…àµ¥¹Ù½¥”µ¡•¬¥¹ÁÕĞé‘¥Í…‰±•‘ì(€ÕÉÍ½Èé¹½Ğµ…±±½İ•ì(€½Á…¥Ñäè¸Øì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹Ñ…àµ¥¹Ù½¥”µ¡•¬•µì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÁÕÉ¡…Í”µÁ…”µÍÕµµ…Éåì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€µ…É¥¸èáÁà€À€ÙÁà€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÁÕÉ¡…Í”µÁ…¥¹…Ñ¥½¹ì(€µ…É¥¸µÑ½ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÁÕÉ¡…Í”µÁ…¥¹…Ñ¥½¸‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èÌÉÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèÌÁÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèåÁà€…¥µÁ½ÉÑ…¹Ğì(€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…É‘Íì(€€€…ÀèåÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µÑ½ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…É‘ì(€€€Á…‘‘¥¹œèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ¡•…‘ì(€€€µ…É¥¸µ‰½ÑÑ½´èİÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ¡•…ÍÑÉ½¹ì(€€€™½¹ĞµÍ¥é”èÄÕÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÈ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ¡•…ÍÁ…¹ì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…ÉµÉ½İì(€€€Á…‘‘¥¹œèÕÁà€À€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÈ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…ÉµÉ½Üˆ°(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…ÉµÉ½Ü€¹ÁÕÉ¡…Í”µ¥Ñ•´µ‘•Ñ…¥°µ‰ÕÑÑ½¹ì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÈ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ…Ñ¥½¹Íì(€€€…ÀèÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸µÑ½ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹µ½‰¥±”µÁÕÉ¡…Í”µ…Éµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÌÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÁì(€…ÀèÑÁà€…¥µÁ½ÉÑ…¹Ğì(€™±•àµİÉ…Àé¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€İ¥‘Ñ èÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•Ü¥µì(€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€¡•¥¡ĞèÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€½‰©•Ğµ™¥Ğé½Ù•È€…¥µÁ½ÉÑ…¹Ğì)ô(¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹Á‘˜µÑ¡Õµ‰ì(€™½¹ĞµÍ¥é”èÄÁÁà€…¥µÁ½ÉÑ…¹Ğì)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÁì(€€€…ÀèÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹€…¥µÁ½ÉÑ…¹Ğì(€€€™±•àµİÉ…Àé¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹…ÑÑ…¡µ•¹ĞµÉ½ÕÀ€¹…ÑÑ…¡µ•¹ĞµÁÉ•Ù¥•İì(€€€İ¥‘Ñ èĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô(((¼¨¡½µ”‘…Í¡‰½…É…Ñ¥Ù¥Ñä€¬İ••¬…±•¹‘…È±…å½ÕĞ€¨¼(¹¡½µ”µ‘…Í¡‰½…ÉµÑ½ÀµÉ½İí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤€ÌàÁÁàí…ÀèÄáÁàíµ…É¥¸µ‰½ÑÑ½´èÄáÁàí…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ¡ô(¹¡½µ”µ‘…Í¡‰½…ÉµÑ½Àµ±•™Ñí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÄÑÁàíµ¥¸µİ¥‘Ñ èÁô(¹¡½µ”µ‘…Í¡‰½…ÉµÑ½ÀµÉ½Ü€¹µ½‘•É¸µ¡½µ”µ­Á¥Ííµ…É¥¸èÁô(¹¡½µ”µ‘…Í¡‰½…ÉµÑ½ÀµÉ½Ü€¹µ½‘•É¸µ¡½µ”µ…±•ÉĞµÍÑÉ¥Áíµ…É¥¸èÁô(¹¡½µ”µ¹½Ñ¥”µÁ…¹•°µÑ½Áíµ¥¸µ¡•¥¡ĞèÄÀÀ”í‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¹ô(¹¡½µ”µ¹½Ñ¥”µÁ…¹•°µÑ½À€¹µ½‘•É¸µ¡½µ”µ±¥ÍÑí™±•àèÅô(¹¡½µ”µ‘…Í¡‰½…Éµµ…¥¸µÉ½İí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Ä¸ÀÕ™È¤µ¥¹µ…à ĞÈÁÁà°¸äÕ™È¤í…ÀèÄáÁàíµ…É¥¸µ‰½ÑÑ½´èÄáÁàí…±¥¸µ¥Ñ•µÌéÍÑ…ÉÑô(¹¡½µ”µÁ…¹•°µ±¥¹¬µÉ½ÕÁí‘¥ÍÁ±…äé™±•àí…ÀèáÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí™±•àµİÉ…ÀéİÉ…Áô¹¡½µ”µÁ…¹•°µ±¥¹¬µÉ½ÕÀ‰ÕÑÑ½¹íİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(¹¡½µ”µÉ••¹Ğµ…Ñ¥Ù¥ÑäµÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèÄÑÁáô¹¡½µ”µÉ••¹Ğµ‰±½­í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàí‰…­É½Õ¹è™‰™‘™˜íÁ…‘‘¥¹œèÄÑÁàíµ¥¸µİ¥‘Ñ èÁô¹¡½µ”µÉ••¹Ğµ‰±½¬µÑ¥Ñ±•í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèåÁàíµ…É¥¸µ‰½ÑÑ½´èÄÁÁáô¹¡½µ”µÉ••¹Ğµ‰±½¬µÑ¥Ñ±”ÍÁ…¹íİ¥‘Ñ èÌÁÁàí¡•¥¡ĞèÌÁÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàí‰…­É½Õ¹è•…˜É™˜í‘¥ÍÁ±…äéÉ¥íÁ±…”µ¥Ñ•µÌé•¹Ñ•Éô¹¡½µ”µÉ••¹Ğµ‰±½¬µÑ¥Ñ±”‰í™½¹ĞµÍ¥é”èÄÕÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½±½ÈèŒÁ˜ÄÜÉ…ô¹¡½µ”µÉ••¹Ğµ±¥ÍÑí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÉÁáô¹¡½µ”µÉ••¹ĞµÉ½İíİ¥‘Ñ èÄÀÀ”í‰½É‘•ÈèÀí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€••˜É˜Üí‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèĞÑÁàµ¥¹µ…à À°Ä¸É™È¤µ¥¹µ…à À°¸á™È¤…ÕÑ¼í…ÀèáÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•ÈíÁ…‘‘¥¹œèİÁà€ÉÁàíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Éô¹¡½µ”µÉ••¹ĞµÉ½Üé¡½Ù•Éí‰…­É½Õ¹è˜á™…™ô¹¡½µ”µÉ••¹ĞµÉ½Ü•µí™½¹ĞµÍÑå±”é¹½Éµ…°í½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèàÔÁô¹¡½µ”µÉ••¹ĞµÉ½ÜÍÑÉ½¹í½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹¡½µ”µÉ••¹ĞµÉ½ÜÍÁ…¹í½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèàÀÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹¡½µ”µÉ••¹ĞµÉ½Ü‰í½±½ÈèŒÄĞÔÕäí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÀíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹¡½µ”µÉ••¹ĞµÑ½Ñ…±íµ…É¥¸µÑ½ÀèÄÁÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàí‰…­É½Õ¹è••˜Ù™˜íÁ…‘‘¥¹œèÄÁÁà€ÄÉÁàí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁáô¹¡½µ”µÉ••¹ĞµÑ½Ñ…°ÍÁ…¹í½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹¡½µ”µÉ••¹ĞµÑ½Ñ…°‰í½±½ÈèŒÄĞÔÕäí™½¹ĞµÍ¥é”èÄİÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹¡½µ”µÉ••¹ĞµÑ½Ñ…°¹É••¹í‰…­É½Õ¹è•™‘˜Õô¹¡½µ”µÉ••¹ĞµÑ½Ñ…°¹É••¸ÍÁ…¸°¹¡½µ”µÉ••¹ĞµÑ½Ñ…°¹É••¸‰í½±½ÈèŒÀÔäØØåô(¹¡½µ”µİ••¬µÉ…¹•íµ…É¥¸è´ÑÁà€À€ÄÁÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèàÔÁô¹¡½µ”µİ••¬µ…±•¹‘…ÈµÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü±µ¥¹µ…à À°Å™È¤¤í…ÀèÙÁáô¹¡½µ”µİ••¬µ‘…åíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íµ¥¸µ¡•¥¡ĞèÄÌÉÁàí‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàí‰…­É½Õ¹è™™˜íÁ…‘‘¥¹œèåÁàíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Èí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÙÁáô¹¡½µ”µİ••¬µ‘…äùÍÁ…¹í½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹¡½µ”µİ••¬µ‘…äù¥í…±¥¸µÍ•±˜é™±•àµÍÑ…ÉĞí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹èŒÈÔØÍ•ˆí½±½Èè™™˜í™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÄÁÁàí™½¹Ğµİ•¥¡ĞèäÔÀíÁ…‘‘¥¹œèÍÁà€áÁáô¹¡½µ”µİ••¬µ‘…ä‘¥Ùí‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸í…ÀèÑÁàíµ¥¸µİ¥‘Ñ èÁô¹¡½µ”µİ••¬µ‘…ä•µí™½¹ĞµÍÑå±”é¹½Éµ…°í½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèàÔÀí±¥¹”µ¡•¥¡ĞèÄ¸Èàíİ½Éµ‰É•…¬é­••Àµ…±°í‘¥ÍÁ±…äèµİ•‰­¥Ğµ‰½àìµİ•‰­¥Ğµ±¥¹”µ±…µÀèÈìµİ•‰­¥Ğµ‰½àµ½É¥•¹ĞéÙ•ÉÑ¥…°í½Ù•É™±½Üé¡¥‘‘•¹ô¹¡½µ”µİ••¬µ‘…äÍµ…±±í½±½ÈèŒäÑ„Íˆàí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèàÔÁô¹¡½µ”µİ••¬µ‘…äù‰íµ…É¥¸µÑ½Àé…ÕÑ¼í½±½Èè‘ŒÈØÈØí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹¡½µ”µİ••¬µ‘…ä¹Ñ½‘…åí‰½É‘•Èµ½±½ÈèŒÈÔØÍ•ˆí‰½àµÍ¡…‘½ÜèÀ€À€À€ÍÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÄÈ¤í‰…­É½Õ¹è™‰™‘™™ô¹¡½µ”µİ••¬µ‘…ä¹¡…Ìµİ½É­í‰…­É½Õ¹è™™™‘˜İô¹µ¥¹¤µ…±•¹‘…Èµ±••¹‘í‘¥ÍÁ±…äé™±•àí…ÀèÄÉÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èíµ…É¥¸µÑ½ÀèÄÉÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÔÁô¹µ¥¹¤µ…±•¹‘…Èµ±••¹ÍÁ…¹í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…ÀèÙÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Éô¹µ¥¹¤µ…±•¹‘…Èµ±••¹¥íİ¥‘Ñ èáÁàí¡•¥¡ĞèáÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‘¥ÍÁ±…äé¥¹±¥¹”µ‰±½­ô¹Ñ½‘…äµ‘½Ñí‰…­É½Õ¹èŒÈÔØÍ•‰ô¹İ½É¬µ‘½Ñí‰…­É½Õ¹è˜Ôå”Á‰ô(¹¡½µ”µÁ¡½Ñ¼µÍ¡½ÉÑÕĞµÉ½İí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°¸å™È¤µ¥¹µ…à ÌàÁÁà°Ä¸Å™È¤í…ÀèÄÙÁàíµ…É¥¸èÀ€À€ÄáÁàí…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ¡ô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µÁ…¹•°°¹¡½µ”µÍ¡½ÉÑÕĞµÁ…¹•±íµ¥¸µİ¥‘Ñ èÁô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ±µ¥¹µ…à À°Å™È¤¤í…ÀèÄÉÁáô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µ…É‘íÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íµ¥¸µİ¥‘Ñ èÀí‰½É‘•ÈèÅÁàÍ½±¥€‘‰”Ñ˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàí‰…­É½Õ¹è™™˜íÁ…‘‘¥¹œèÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Èí‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤í‘¥ÍÁ±…äé™±•àí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¹ô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µ…É¥µí‘¥ÍÁ±…äé‰±½¬íİ¥‘Ñ èÄÀÀ”í¡•¥¡ĞèäÉÁàí½‰©•Ğµ™¥Ğé½Ù•Èí‰…­É½Õ¹è˜Å˜Õ˜åô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µ…ÉÍÁ…¹íÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ”í±•™ĞèİÁàíÑ½ÀèİÁàíÁ…‘‘¥¹œèÍÁà€İÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Üà¤í½±½Èè™™˜í™½¹ĞµÍ¥é”èÄÁÁàí™½¹Ğµİ•¥¡ĞèäÔÁô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µ…É‰í‘¥ÍÁ±…äé‰±½¬íÁ…‘‘¥¹œèåÁà€åÁà€ÉÁàí½±½ÈèŒÁ˜ÄÜÉ„í™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µ…É•µí‘¥ÍÁ±…äé‰±½¬íÁ…‘‘¥¹œèÀ€åÁà€ÉÁàí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÅÁàí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹Ğµİ•¥¡ĞèàÔÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µ…ÉÍµ…±±í‘¥ÍÁ±…äé‰±½¬íÁ…‘‘¥¹œèÀ€åÁà€åÁàí½±½ÈèŒäÑ„Íˆàí™½¹ĞµÍ¥é”èÄÁÁàí™½¹Ğµİ•¥¡ĞèàÔÁô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½İí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ø±µ¥¹µ…à À°Å™È¤¤í…ÀèÄÉÁàíµ…É¥¸èÀ€À€ÄáÁáô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Üµ¥¹±¥¹•íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤í…ÀèÄÉÁàíµ…É¥¸èÁô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü‰ÕÑÑ½¹í‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàí‰…­É½Õ¹è™™˜íÁ…‘‘¥¹œèÄÍÁà€ÄÁÁàí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èí…ÀèáÁàíÕÉÍ½ÈéÁ½¥¹Ñ•Èí‰½àµÍ¡…‘½ÜèÀ€áÁà€ÄáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞÔ¥ô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Üµ¥¹±¥¹”‰ÕÑÑ½¹í©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞíµ¥¸µ¡•¥¡ĞèØáÁàíÁ…‘‘¥¹œèÄÙÁà€ÄÕÁáô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½ÜÍÁ…¹í™½¹ĞµÍ¥é”èÈÍÁáô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü‰í™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½±½ÈèŒÁ˜ÄÜÉ…ô¹¡½µ”µµ½¹Ñ µÍÑ…ĞµÉ¥‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ±µ¥¹µ…à À°Å™È¤¤í…ÀèÄÙÁáô¹¡½µ”µµ½¹Ñ µÍÑ…Ñí‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄİÁàí‰…­É½Õ¹è™™˜íÁ…‘‘¥¹œèÈÙÁà€ÈÉÁàíÑ•áĞµ…±¥¸é±•™ĞíÕÉÍ½ÈéÁ½¥¹Ñ•Èí‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÈáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀØ¤íµ¥¸µ¡•¥¡ĞèÄÌÉÁáô¹¡½µ”µµ½¹Ñ µÍÑ…ĞÍÁ…¹í‘¥ÍÁ±…äé‰±½¬í™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÀí½±½ÈèŒÌÌĞÄÔÕô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ‰í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÄÕÁàí™½¹ĞµÍ¥é”èÈåÁàí™½¹Ğµİ•¥¡ĞèäÔÀí±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁáô¹¡½µ”µµ½¹Ñ µÍÑ…ĞÍµ…±±í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µÑ½ÀèÄÅÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÔÁô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹‰±Õ•í‰…­É½Õ¹è˜Ù˜å™˜í‰½É‘•Èµ½±½Èè‰™‘‰™•ô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹‰±Õ”‰í½±½ÈèŒÄĞÔÕåô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹ÁÕÉÁ±•í‰…­É½Õ¹è™…˜İ™˜í‰½É‘•Èµ½±½Èè‘‘Ù™•ô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹ÁÕÉÁ±”‰í½±½ÈèŒÙÈáåô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹É••¹í‰…­É½Õ¹è˜Á™‘˜Ğí‰½É‘•Èµ½±½Èè‰‰˜İÁô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹É••¸‰í½±½ÈèŒÀÔäØØåô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹…µ‰•Éí‰…­É½Õ¹è™™™…˜Àí‰½É‘•Èµ½±½Èè™‘”Øá…ô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹…µ‰•È‰í½±½ÈèäÜÜÀÙõµ•‘¥„¡µ…àµİ¥‘Ñ èÄÈÀÁÁà¥ì¹¡½µ”µ‘…Í¡‰½…ÉµÑ½ÀµÉ½Ü°¹¡½µ”µ‘…Í¡‰½…Éµµ…¥¸µÉ½Ü°¹¡½µ”µÁ¡½Ñ¼µÍ¡½ÉÑÕĞµÉ½İíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹¡½µ”µİ••¬µ…±•¹‘…ÈµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü±µ¥¹µ…à ÄÈÁÁà°Å™È¤¤í½Ù•É™±½Üµàé…ÕÑ¼íÁ…‘‘¥¹œµ‰½ÑÑ½´èÑÁáô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½İíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì°Å™È¥ô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Üµ¥¹±¥¹•íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì°Å™È¥ô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ğ±µ¥¹µ…à À°Å™È¤¥ô¹¡½µ”µµ½¹Ñ µÍÑ…ĞµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È°Å™È¥õô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì¹¡½µ”µÉ••¹Ğµ…Ñ¥Ù¥ÑäµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹¡½µ”µÉ••¹ĞµÉ½İíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèĞÉÁàµ¥¹µ…à À°Å™È¤…ÕÑ½ô¹¡½µ”µÉ••¹ĞµÉ½ÜÍÁ…¹í‘¥ÍÁ±…äé¹½¹•ô¹¡½µ”µİ••¬µ…±•¹‘…ÈµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èí½Ù•É™±½ÜéÙ¥Í¥‰±•ô¹¡½µ”µİ••¬µ‘…åíµ¥¸µ¡•¥¡Ğé…ÕÑ½ô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¥ô¹¡½µ”µÉ••¹ĞµÁ¡½Ñ¼µ…É¥µí¡•¥¡ĞèÜÉÁáô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü°¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Üµ¥¹±¥¹•íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È°Å™È¤í…ÀèÄÁÁáô¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü‰ÕÑÑ½¸°¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Ü¹¡½µ”µÍ¡½ÉÑÕĞµÉ½Üµ¥¹±¥¹”‰ÕÑÑ½¹í©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞíµ¥¸µ¡•¥¡ĞèÔÑÁàíÁ…‘‘¥¹œèÄÉÁáô¹¡½µ”µµ½¹Ñ µÍÑ…ĞµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹¡½µ”µµ½¹Ñ µÍÑ…Ñíµ¥¸µ¡•¥¡ĞèÄÀÑÁáô¹¡½µ”µµ½¹Ñ µÍÑ…Ğ‰í™½¹ĞµÍ¥é”èÈÉÁáõô((¼¨€ôôôôô5½‰¥±”ÁÕÉ¡…Í”€¼µ…¥¹Ñ•¹…¹”¥Ñ•´•¹ÑÉä€ôôôôô€¨¼(¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ±¥ÍÑí‘¥ÍÁ±…äé¹½¹•ô()µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±•í‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ñô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ±¥ÍÑì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÑÁàì(€€€µ…É¥¸èÄÑÁà€À€ÄÙÁàì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É‘ì(€€€Á½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”ì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€Á…‘‘¥¹œèÄÕÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€‰™‘‰™”ì(€€€‰½É‘•Èµ±•™ĞèÑÁàÍ½±¥€ŒÈÔØÍ•ˆì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜á™‰™˜€À”°™™™™™˜€ÌÈ”¤ì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÑÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸Àà¤ì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É¹µ…¥¹Ñ•¹…¹•ì(€€€‰½É‘•Èµ½±½Èè‰‰˜İÀì(€€€‰½É‘•Èµ±•™Ğµ½±½ÈèŒÄÁˆäàÄì(€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°˜É™‘˜Ü€À”°™™™™™˜€ÌÈ”¤ì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÈÑÁàÉ‰„ ÄØ°ÄàÔ°ÄÈä°¸Àà¤ì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ¡•…‘ì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…ÀèÄÁÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èÄÅÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€‘‰•…™”ì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É¹µ…¥¹Ñ•¹…¹”€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ¡•…‘í‰½É‘•Èµ‰½ÑÑ½´µ½±½ÈèÅ™…”Õô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ¡•…ù‘¥Ùí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèáÁáô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ¡•…ÍÁ…¹í½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÀÁô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ¡•…‰ì(€€€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€€€İ¥‘Ñ èÈİÁàì(€€€¡•¥¡ĞèÈİÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€€€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€€€½±½Èè™™˜ì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É¹µ…¥¹Ñ•¹…¹”€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ¡•…‰í‰…­É½Õ¹èŒÄÁˆäàÅô(€€¹µ½‰¥±”µ•¹ÑÉäµ‘•±•Ñ•ì(€€€İ¥‘Ñ é…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÜÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÌáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèİÁà€ÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€™•…„€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹è™™˜Å˜È€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè‘ŒÈØÈØ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É€¹Í•…É µİÉ…Áíµ…É¥¸µ‰½ÑÑ½´èÄÉÁáô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É€¹™¥•±‘íµ…É¥¸µ‰½ÑÑ½´èÄÉÁà€…¥µÁ½ÉÑ…¹Ñô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É±…‰•±íµ…É¥¸µ‰½ÑÑ½´èÙÁà€…¥µÁ½ÉÑ…¹Ğí½±½ÈèŒÌÌĞÄÔÔ€…¥µÁ½ÉÑ…¹Ğí™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğí™½¹Ğµİ•¥¡ĞèäÀÀ€…¥µÁ½ÉÑ…¹Ñô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥¹±¥¹”µÉ½İì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤…ÕÑ¼ì(€€€…ÀèáÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥¹±¥¹”µÉ½Ü‰ÕÑÑ½¹ì(€€€İ¥‘Ñ é…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÜÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€¡•¥¡ĞèÔÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€‰™‘‰™”ì(€€€‰…­É½Õ¹è•™˜Ù™˜ì(€€€½±½ÈèŒÅÑ•àì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµÉ¥‘ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÀ€ÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É¥¹ÁÕĞ¹É¥¡ÑíÑ•áĞµ…±¥¸éÉ¥¡Ğ€…¥µÁ½ÉÑ…¹Ñô(€€¹µ½‰¥±”µ•¹ÑÉäµÑ½Ñ…±ì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…ÀèÄÉÁàì(€€€µ…É¥¸µÑ½ÀèÉÁàì(€€€Á…‘‘¥¹œèÄÍÁà€ÄÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàì(€€€‰…­É½Õ¹è•…˜É™˜ì(€€€½±½ÈèŒÅÑ•àì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É¹µ…¥¹Ñ•¹…¹”€¹µ½‰¥±”µ•¹ÑÉäµÑ½Ñ…±í‰…­É½Õ¹è•™‘˜Ôí½±½ÈèŒÀĞÜàÔİô(€€¹µ½‰¥±”µ•¹ÑÉäµÑ½Ñ…°ÍÁ…¹í™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÀÁô(€€¹µ½‰¥±”µ•¹ÑÉäµÑ½Ñ…°‰í™½¹ĞµÍ¥é”èÈÁÁàí™½¹Ğµİ•¥¡ĞèÄÀÀÀí±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÍÁáô(€€¹µ½‰¥±”µ•¹ÑÉäµÉ••¹Ñì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼µ¥¹µ…à À°Å™È¤ì(€€€…ÀèÑÁà€áÁàì(€€€µ…É¥¸è´ÉÁà€À€ÄÉÁàì(€€€Á…‘‘¥¹œèÄÅÁà€ÄÉÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€Å™…”Ôì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜Á™‘˜Ğì(€ô(€€¹µ½‰¥±”µ•¹ÑÉäµÉ••¹ĞÍÁ…¹íÉ¥µÉ½ÜèÄ¼Ìí½±½ÈèŒÀÔäØØäí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèäÔÀí…±¥¸µÍ•±˜é•¹Ñ•Éô(€€¹µ½‰¥±”µ•¹ÑÉäµÉ••¹Ğ‰í½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÀÀí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(€€¹µ½‰¥±”µ•¹ÑÉäµÉ••¹Ğ•µí½±½ÈèŒÀĞÜàÔÜí™½¹ĞµÍ¥é”èÄÉÁàí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹Ğµİ•¥¡ĞèäÀÁô)ô((¼¨€ôôôôô€ÈÀÈØ5½‘•É¸•Í­Ñ½ÀM¡•±°€¬AÕÉ¡…Í”¹ÑÉä€ôôôôô€¨¼)µ•‘¥„€¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€‰½‘åì(€€€‰…­É½Õ¹è˜Ñ˜İ™ˆì(€€€½±½ÈèŒÄÜÈÀÌÌì(€ô(€€¹…ÁÁì(€€€µ¥¸µ¡•¥¡ĞèÄÀÁÙ ì(€€€Á…‘‘¥¹œèàáÁà€ÈÙÁà€ĞÉÁà€ÈÜÑÁàì(€€€‰…­É½Õ¹è(€€€€€É…‘¥…°µÉ…‘¥•¹Ğ¡¥É±”…Ğ€àØ”€À”±É‰„ Ôä°ÄÌÀ°ÈĞØ°¸Àà¤±ÑÉ…¹ÍÁ…É•¹Ğ€ÈÜ”¤°(€€€€€€˜Ñ˜İ™ˆì(€€€ÑÉ…¹Í¥Ñ¥½¸éÁ…‘‘¥¹œµ±•™Ğ€¸ÉÌ•…Í”ì(€ô(€€¹¡•É½ì(€€€Á½Í¥Ñ¥½¸é™¥á•ì(€€€èµ¥¹‘•àèÄÈÀÀì(€€€Ñ½ÀèÀì(€€€É¥¡ĞèÀì(€€€±•™ĞèÈĞáÁàì(€€€¡•¥¡ĞèÜÁÁàì(€€€µ¥¸µ¡•¥¡ĞèÀì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€€€…ÀèÄÉÁàì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÀ€ÌÄÁÁà€À€ÈÙÁàì(€€€‰½É‘•ÈèÀì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”Ñ•…˜Èì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÀì(€€€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸äØ¤ì(€€€½±½ÈèŒÄÜÈÀÌÌì(€€€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄáÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞ¤ì(€€€‰…­‘É½Àµ™¥±Ñ•Èé‰±ÕÈ ÄÑÁà¤ì(€€€ÑÉ…¹Í¥Ñ¥½¸é±•™Ğ€¸ÉÌ•…Í”ì(€ô(€€¹¡•É¼µ‰É…¹µµ…É­ì(€€€İ¥‘Ñ èÌáÁàì(€€€¡•¥¡ĞèÌáÁàì(€€€™±•àèÀ€À€ÌáÁàì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁàì(€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄĞÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÑ˜ĞÙ”Ô¤ì(€€€½±½Èè™™˜ì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÉÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€İÁà€ÄáÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈĞ¤ì(€ô(€€¹¡•É¼µ‰É…¹µ½Áåíµ¥¸µİ¥‘Ñ èÀíÑ•áĞµ…±¥¸é±•™Ñô(€€¹¡•É¼€¹µ…¥¸µÑ¥Ñ±•ì(€€€µ…É¥¸èÀì(€€€½±½ÈèŒÄÔÈÈÌàì(€€€™½¹ĞµÍ¥é”èÈÁÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÄÔì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸ÙÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€€€Ñ•áĞµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹¡•É¼Áì(€€€µ…É¥¸èÍÁà€À€Àì(€€€½±½ÈèŒàĞäÁ„Ìì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€€€±¥¹”µ¡•¥¡ĞèÄì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè¸ÉÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€€€Ñ•áĞµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹µ•¹Õì(€€€Á½Í¥Ñ¥½¸é™¥á•ì(€€€èµ¥¹‘•àèÄÌÀÀì(€€€¥¹Í•ĞèÀ…ÕÑ¼€À€Àì(€€€İ¥‘Ñ èÈĞáÁàì(€€€‘¥ÍÁ±…äé™±•àì(€€€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì(€€€…ÀèÑÁàì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèàÉÁà€ÄÑÁà€ÈÉÁàì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸ì(€€€½Ù•É™±½Üµäé…ÕÑ¼ì(€€€‰½É‘•ÈèÀì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÀì(€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄàÁ‘•œ°ŒÄØÈĞÍ€À”°ŒÄÄÅŒÌÄ€Ôà”°ŒÁŒÄÔÈØ€ÄÀÀ”¤ì(€€€‰½àµÍ¡…‘½ÜèÄÁÁà€À€ÌÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÄØ¤ì(€€€ÑÉ…¹Í¥Ñ¥½¸éİ¥‘Ñ €¸ÉÌ•…Í”±Á…‘‘¥¹œ€¸ÉÌ•…Í”ì(€ô(€€¹µ•¹Ôèé‰•™½É•ì(€€€½¹Ñ•¹Ğé¹½¹”ì(€ô(€€¹µ•¹Ôø¹‘•Í­Ñ½ÀµÍ¥‘•‰…ÈµÑ½±•ì(€€€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€€€Ñ½ÀèÄÙÁàì(€€€±•™ĞèÄÑÁàì(€€€İ¥‘Ñ èĞÑÁàì(€€€µ¥¸µİ¥‘Ñ èĞÑÁàì(€€€¡•¥¡ĞèĞÑÁàì(€€€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥É‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÄÈ¤ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÀØ¤ì(€€€½±½Èè™™˜ì(€€€™½¹ĞµÍ¥é”èÈÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄì(€€€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì(€ô(€€¹µ•¹Ôø¹‘•Í­Ñ½ÀµÍ¥‘•‰…ÈµÑ½±”é¡½Ù•Éì(€€€‰½É‘•Èµ½±½ÈéÉ‰„ ÄĞÜ°ÄäÜ°ÈÔÌ°¸ÌÈ¤ì(€€€‰…­É½Õ¹éÉ‰„ ÌÜ°ää°ÈÌÔ°¸ĞÔ¤ì(€ô(€€¹µ•¹Ôù‰ÕÑÑ½¸°(€€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ¥¸µ¡•¥¡ĞèĞÙÁàì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€€€…ÀèÄÁÁàì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÄÁÁà€ÄÉÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥ÑÉ…¹ÍÁ…É•¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğì(€€€½±½ÈèŒÙÁ‘˜ì(€€€™½¹ĞµÍ¥é”èÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèàÔÀì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹µ•¹Ôù‰ÕÑÑ½¸ùÍÙœ°(€€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¸ùÍÙì(€€€İ¥‘Ñ èÄáÁàì(€€€¡•¥¡ĞèÄáÁàì(€€€™±•àèÀ€À€ÄáÁàì(€€€½±½ÈèŒå™ˆÁŒàì(€€€ÍÑÉ½­”µİ¥‘Ñ èÈì(€ô(€€¹µ•¹Ôù‰ÕÑÑ½¸¹…Ñ¥Ù”ùÍÙí½±½Èè™™™ô(€€¹µ•¹Ôù‰ÕÑÑ½¸é¡½Ù•È°(€€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¸é¡½Ù•Éì(€€€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÀÜ¤ì(€€€½±½Èè™™˜ì(€€€ÑÉ…¹Í™½É´é¹½¹”ì(€ô(€€¹µ•¹Ôù‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€€€‰½É‘•Èµ½±½ÈéÉ‰„ ÄĞÜ°ÄäÜ°ÈÔÌ°¸ÈØ¤ì(€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÍˆàÉ˜Ø¤ì(€€€½±½Èè™™˜ì(€€€‰½àµÍ¡…‘½ÜèÀ€áÁà€ÈÁÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈÔ¤ì(€ô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•‘íÁ…‘‘¥¹œµ±•™ĞèäáÁáô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹¡•É½í±•™ĞèÜÉÁáô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹µ•¹Õì(€€€İ¥‘Ñ èÜÉÁàì(€€€Á…‘‘¥¹œµÉ¥¡ĞèåÁàì(€€€Á…‘‘¥¹œµ±•™ĞèåÁàì(€ô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹µ•¹Ôø¹‘•Í­Ñ½ÀµÍ¥‘•‰…ÈµÑ½±•ì(€€€±•™ĞèÄÑÁàì(€ô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹µ•¹Ôù‰ÕÑÑ½¸é¹½Ğ ¹‘•Í­Ñ½ÀµÍ¥‘•‰…ÈµÑ½±”¤°(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¹ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€€€…ÀèÀì(€€€Á…‘‘¥¹œèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÀ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¸èé…™Ñ•Éí‘¥ÍÁ±…äé¹½¹•ô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹µ•¹ÔµÉ½ÕÀ€¹ÍÕ‰í‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ñô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É‘ì(€€€±•™Ğé…±Œ ÔÀ”€¬€ÌÙÁà¤ì(€€€İ¥‘Ñ éµ¥¸ ÄØàÁÁà±…±Œ ÄÀÁÙÜ€´€ÄÀÑÁà¤¤ì(€ô(€€¹µ•¹ÔµÉ½ÕÁíİ¥‘Ñ èÄÀÀ”íµ…É¥¸èÁô(€€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¹íÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”í½±½Èè”É”á˜ÀíÁ…‘‘¥¹œµÉ¥¡ĞèÌÑÁáô(€€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¸èé…™Ñ•Éì(€€€½¹Ñ•¹Ğè‹Šèˆì(€€€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€€€É¥¡ĞèÄÍÁàì(€€€Ñ½ÀèÔÀ”ì(€€€½±½ÈèŒÜÄàÀäØì(€€€™½¹ĞµÍ¥é”èÄåÁàì(€€€±¥¹”µ¡•¥¡ĞèÄì(€€€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÔÀ”¤É½Ñ…Ñ” Á‘•œ¤ì(€€€ÑÉ…¹Í¥Ñ¥½¸éÑÉ…¹Í™½É´€¸ÄáÌ•…Í”±½±½È€¸ÄáÌ•…Í”ì(€ô(€€¹µ•¹ÔµÉ½ÕÀ¹•áÁ…¹‘•ù‰ÕÑÑ½¸èé…™Ñ•Éì(€€€½±½Èè‰™‘‰™”ì(€€€ÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÔÀ”¤É½Ñ…Ñ” äÁ‘•œ¤ì(€ô(€€¹µ•¹ÔµÉ½ÕÀ¹•áÁ…¹‘•ù‰ÕÑÑ½¹ì(€€€‰½É‘•Èµ½±½ÈéÉ‰„ ÄĞÜ°ÄäÜ°ÈÔÌ°¸ÈÈ¤ì(€€€‰…­É½Õ¹éÉ‰„ ÌÜ°ää°ÈÌÔ°¸Üà¤ì(€€€½±½Èè™™˜ì(€ô(€€¹µ•¹ÔµÉ½ÕÀ¹•áÁ…¹‘•ù‰ÕÑÑ½¸ùÍÙí½±½Èè™™™ô(€€¹µ•¹Ô€¹µ•¹ÔµÉ½ÕÀé¹½Ğ ¹•áÁ…¹‘•¤é¡½Ù•È€ø€¹ÍÕˆ°(€€¹µ•¹Ô€¹µ•¹ÔµÉ½ÕÀé¹½Ğ ¹•áÁ…¹‘•¤é™½ÕÌµİ¥Ñ¡¥¸€ø€¹ÍÕ‰ì(€€€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€Ù¥Í¥‰¥±¥Ñäé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€€€½Á…¥ÑäèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ•¹Ô€¹µ•¹ÔµÉ½ÕÀ¹•áÁ…¹‘•€ø€¹ÍÕ‰ì(€€€Ù¥Í¥‰¥±¥ÑäéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€€€½Á…¥ÑäèÄ€…¥µÁ½ÉÑ…¹Ğì(€€€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÍÕ‰ì(€€€Á½Í¥Ñ¥½¸éÍÑ…Ñ¥Œì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÉÁàì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÍÁà€À€ÙÁà€ÄÍÁàì(€€€‰½É‘•ÈèÀì(€€€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹µ•¹ÔµÉ½ÕÀ¹•áÁ…¹‘•€¹ÍÕ‰í‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ñô(€€¹ÍÕˆ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ¥¸µ¡•¥¡ĞèÌÙÁàì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèİÁà€ÄÁÁàì(€€€‰½É‘•ÈèÀì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğì(€€€½±½ÈèŒäÑ„Íˆàì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÜÔÀì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹ÍÕˆ‰ÕÑÑ½¸é¡½Ù•Éì(€€€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÀÜ¤ì(€€€½±½Èè™™˜ì(€€€ÑÉ…¹Í™½É´é¹½¹”ì(€ô(€€¹ÍÕˆ‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€€€‰…­É½Õ¹éÉ‰„ ÌÜ°ää°ÈÌÔ°¸Èà¤ì(€€€½±½Èè‘‰•…™”ì(€ô(€€¹µ•¹Ô€¹ÍÕˆ‰ÕÑÑ½¸èé‰•™½É•ì(€€€½¹Ñ•¹Ğè‹Šˆˆì(€€€‘¥ÍÁ±…äé¥¹±¥¹”µ‰±½¬ì(€€€İ¥‘Ñ èÄÁÁàì(€€€µ…É¥¸µÉ¥¡ĞèÑÁàì(€€€½±½ÈèŒØĞÜĞáˆì(€€€™½¹ĞµÍ¥é”èÄÕÁàì(€€€±¥¹”µ¡•¥¡ĞèÄì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€ô(€€¹µ•¹Ô€¹ÍÕˆ‰ÕÑÑ½¸¹…Ñ¥Ù”èé‰•™½É•í½±½ÈèŒØÁ„Õ™…ô(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕ‰ì(€€€Á½Í¥Ñ¥½¸éÍÑ…Ñ¥Œ€…¥µÁ½ÉÑ…¹Ğì(€€€¥¹Í•Ğé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÍÁà€À€ÙÁà€ÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½Üé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ¹•áÁ…¹‘•€¹µ…¥¹ĞµÍÕ‰í‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ñô(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸°(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é™¥ÉÍĞµ¡¥±°(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é±…ÍĞµ¡¥±‘ì(€€€Á½Í¥Ñ¥½¸éÍÑ…Ñ¥Œ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÌÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèİÁà€ÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒäÑ„Íˆà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèÜÔÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½Üé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é¡½Ù•Éì(€€€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÀÜ¤€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€€€‰…­É½Õ¹éÉ‰„ ÌÜ°ää°ÈÌÔ°¸Èà¤€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè‘‰•…™”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸èé…™Ñ•Éí½¹Ñ•¹Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ñô(€€¹ÕÍ•Èµ‰½áì(€€€Á½Í¥Ñ¥½¸é™¥á•ì(€€€èµ¥¹‘•àèÄĞÀÀì(€€€Ñ½ÀèÀì(€€€É¥¡ĞèÈÑÁàì(€€€¡•¥¡ĞèÜÁÁàì(€€€İ¥‘Ñ é…ÕÑ¼ì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµ•¹ì(€€€…ÀèåÁàì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÀì(€€€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğì(€€€½±½ÈèŒĞÜÔÔØäì(€ô(€€¹ÕÍ•Èµ‰½àÍÁ…¹í½±½ÈèŒÔÈØÀÜÔí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèÜÔÁô(€€¹ÕÍ•Èµ‰½à‰ÕÑÑ½¹ì(€€€µ¥¸µ¡•¥¡ĞèÌÙÁàì(€€€Á…‘‘¥¹œèáÁà€ÄÉÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€‘‘”Õ•”ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèåÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€½±½ÈèŒĞÜÔÔØäì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹ÕÍ•Èµ‰½à‰ÕÑÑ½¸é¡½Ù•Éí‰…­É½Õ¹è••˜É˜ÜíÑÉ…¹Í™½É´é¹½¹•ô(€€¹…É‘ì(€€€µ…É¥¸µÑ½ÀèÄáÁàì(€€€Á…‘‘¥¹œèÈÑÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€€€‰…­É½Õ¹è™™˜ì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÌÉÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔÔ¤ì(€ô(€€¹…É Éì(€€€½±½ÈèŒÄÜÈÀÌÌì(€€€™½¹ĞµÍ¥é”èÈÍÁàì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€¥¹ÁÕĞ±Í•±•Ğ±Ñ•áÑ…É•…ì(€€€‰½É‘•Èµ½±½Èèİ”Á•„ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€€€‰…­É½Õ¹è™™˜ì(€ô(€¥¹ÁÕĞé¡½Ù•È±Í•±•Ğé¡½Ù•È±Ñ•áÑ…É•„é¡½Ù•Éí‰½É‘•Èµ½±½ÈèˆåŒİáô(€¥¹ÁÕĞé™½ÕÌ±Í•±•Ğé™½ÕÌ±Ñ•áÑ…É•„é™½ÕÍì(€€€‰½É‘•Èµ½±½ÈèŒÍˆàÉ˜Øì(€€€‰½àµÍ¡…‘½ÜèÀ€À€À€ÍÁàÉ‰„ Ôä°ÄÌÀ°ÈĞØ°¸ÄÈ¤ì(€ô(€‰ÕÑÑ½¹í‰½É‘•ÈµÉ…‘¥ÕÌèåÁàí™½¹Ğµİ•¥¡ĞèàÔÁô(€€¹Ñ…‰±”µİÉ…Áì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è™™˜ì(€ô(€Ñ¡ì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€‘™”İ˜Àì(€€€‰…­É½Õ¹è••˜Í˜àì(€€€½±½ÈèŒÌĞĞÈÔàì(€ô(€Ñ‘í‰½É‘•Èµ‰½ÑÑ½´µ½±½Èè”á•‘˜Íô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É‘í½Ù•É™±½ÜéÙ¥Í¥‰±•ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•…‘ì(€€€µ…É¥¸µ‰½ÑÑ½´èÈÁÁàì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èÄİÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€•‘˜Å˜Ôì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•… Éí™½¹ĞµÍ¥é”èÈÕÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éø¹É¥Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à ÄàÁÁà°¸àÕ™È¤µ¥¹µ…à ÈÌÁÁà°Ä¸ÈÕ™È¤µ¥¹µ…à ÈÌÁÁà°Ä¸ÈÕ™È¤ì(€€€…ÀèÄáÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÈÁÁàì(€€€Á…‘‘¥¹œèÄİÁà€ÄáÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Õ•‰˜Èì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éø¹É¥Ìù±…‰•±ì(€€€½±½ÈèŒĞÜÔÔØäì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€™½¹Ğµİ•¥¡ĞèäÀÀì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éø¹É¥Ì¥¹ÁÕÑí¡•¥¡ĞèĞÑÁàíµ…É¥¸µÑ½ÀèİÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±•ì(€€€µ…É¥¸µÑ½ÀèÀì(€€€‰½É‘•Èµ½±½Èè‘™”İ˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÈÔ¤ì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ…‰±•íµ¥¸µİ¥‘Ñ èÄÈàÁÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ¡ì(€€€Á…‘‘¥¹œèÄÉÁà€ÄÁÁàì(€€€‰…­É½Õ¹è•‘˜Í˜äì(€€€½±½ÈèŒÌÌĞÄÔÔì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ‘íÁ…‘‘¥¹œèåÁà€İÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”¥¹ÁÕÑí¡•¥¡ĞèĞÁÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ™½½Ñ•Éì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤€ÌĞÁÁàì(€€€…ÀèÄáÁàì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì(€€€µ…É¥¸µÑ½ÀèÈÁÁàì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕÁÁ½ÉÑì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€…ÀèÄÉÁàì(€€€…±¥¸µ½¹Ñ•¹ĞéÍÑ…ÉĞì(€ô(€€¹ÁÕÉ¡…Í”µ…‘µ¥Ñ•´µ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ éµ…àµ½¹Ñ•¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€€€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€…ÀèİÁàì(€€€Á…‘‘¥¹œèåÁà€ÄÑÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€‰™‘‰™”ì(€€€‰…­É½Õ¹è•™˜Ù™˜ì(€€€½±½ÈèŒÅÑ•àì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹ÁÕÉ¡…Í”µ…‘µ¥Ñ•´µ‰ÕÑÑ½¸é¡½Ù•Éí‰…­É½Õ¹è‘‰•…™”íÑÉ…¹Í™½É´é¹½¹•ô(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•±ì(€€€µ¥¸µ¡•¥¡ĞèÄÈÙÁàì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈèÅÁà‘…Í¡•€ŒÑ™‘ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•°ÍÑÉ½¹ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€½±½ÈèŒÌÌĞÄÔÔì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€ô(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•°Áì(€€€µ…É¥¸èÕÁà€À€ÄÉÁàì(€€€½±½ÈèŒàÜäÍ„Øì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€ô(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•°€¹ÕÁ±½…‘ì(€€€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€€€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€…ÀèİÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€Õ‘•”äì(€€€‰…­É½Õ¹è™™˜ì(€€€½±½ÈèŒÌÌĞÄÔÔì(€ô(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•°€¹É••¥ÁĞµÁÉ•Ù¥•İíµ…É¥¸µÑ½ÀèÄÁÁàí½±½ÈèŒàÜäÍ„Øí™½¹ĞµÍ¥é”èÄÉÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éåì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÄáÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€½±½ÈèŒĞÜÔÔØäì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…ÉäùÍÁ…¹ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì(€€€½±½ÈèŒÌÌĞÄÔÔì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éäù‘¥Ùì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…ÀèÄáÁàì(€€€µ…É¥¸èåÁà€Àì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éäù‘¥Ø‰í½±½ÈèŒÅ”ÈäÍˆí™½¹ĞµÍ¥é”èÄÍÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥ì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé™±•àµ•¹ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€µ…É¥¸èÄÕÁà€À€Àì(€€€Á…‘‘¥¹œµÑ½ÀèÄÕÁàì(€€€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€‘”Ñ•ì(€€€½±½ÈèŒÄÜÈÀÌÌì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œ•µì(€€€½±½ÈèŒÌÌĞÄÔÔì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œÍÑÉ½¹ì(€€€½±½ÈèŒÅÑ•àì(€€€™½¹ĞµÍ¥é”èÈÕÁàì(€€€±¥¹”µ¡•¥¡ĞèÄì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁàì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ…Ñ¥½¹Íì(€€€µ…É¥¸µÑ½ÀèÄáÁàì(€€€Á…‘‘¥¹œµÑ½ÀèÄáÁàì(€€€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€•‘˜Å˜Ôì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ…Ñ¥½¹Ì‰ÕÑÑ½¹íµ¥¸µ¡•¥¡ĞèĞÑÁàíÁ…‘‘¥¹œèÄÁÁà€ÄİÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ…Ñ¥½¹Ì€¹ÁÉ¥µ…Éåì(€€€‰½àµÍ¡…‘½ÜèÀ€İÁà€ÄÙÁàÉ‰„ ÈÈ°ÄØÌ°ÜĞ°¸Äà¤ì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹‘É…™Ğµ¡•±ÀµÑ•áÑí½±½ÈèŒàääÕ„Üí™½¹ĞµÍ¥é”èÄÅÁáô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹…ÁÁíÁ…‘‘¥¹œèÄÑÁà€ÄÑÁà€äÑÁàí‰…­É½Õ¹èŒÁ˜ÄÜÉ…ô(€€¹¡•É½ì(€€€Á½Í¥Ñ¥½¸éÍÑ…Ñ¥Œì(€€€µ¥¸µ¡•¥¡ĞèÀì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€€€…ÀèÄÅÁàì(€€€µ…É¥¸èÀ€À€ÄÑÁàì(€€€Á…‘‘¥¹œèÄÕÁà€ÄÙÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÈÔØÍ•ˆ°ŒÑ˜ĞÙ”Ô¤ì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÉÁà€ÈÙÁàÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈÔ¤ì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹¡•É¼µ‰É…¹µµ…É­ì(€€€İ¥‘Ñ èÌåÁàì(€€€¡•¥¡ĞèÌåÁàì(€€€™±•àèÀ€À€ÌåÁàì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁàì(€€€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÄÜ¤ì(€€€½±½Èè™™˜ì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€ô(€€¹¡•É¼µ‰É…¹µ½ÁåíÑ•áĞµ…±¥¸é±•™Ñô(€€¹¡•É¼€¹µ…¥¸µÑ¥Ñ±•íµ…É¥¸èÀí½±½Èè™™˜í™½¹ĞµÍ¥é”èÈÅÁàí±¥¹”µ¡•¥¡ĞèÄ¸ÄÈíÑ•áĞµ…±¥¸é±•™ĞíÑ•áĞµÍ¡…‘½Üé¹½¹•ô(€€¹¡•É¼Áíµ…É¥¸èÑÁà€À€Àí½±½Èè‘‰•…™”í™½¹ĞµÍ¥é”èÄÁÁàíÑ•áĞµ…±¥¸é±•™ĞíÑ•áĞµÍ¡…‘½Üé¹½¹•ô(€€¹µ•¹Õí‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ñô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ™½½Ñ•Éí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èí…ÀèÄÉÁàíµ…É¥¸µÑ½ÀèÄÑÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕÁÁ½ÉÑí‘¥ÍÁ±…äéÉ¥í…ÀèÄÁÁáô(€€¹ÁÕÉ¡…Í”µ…‘µ¥Ñ•´µ‰ÕÑÑ½¹íİ¥‘Ñ èÄÀÀ”íµ¥¸µ¡•¥¡ĞèĞÑÁáô(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•±ì(€€€Á…‘‘¥¹œèÄÑÁàì(€€€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•°ÍÑÉ½¹í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÍÁáô(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•°Áíµ…É¥¸èÕÁà€À€ÄÁÁàí½±½ÈèŒàÜäÍ„Øí™½¹ĞµÍ¥é”èÄÅÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éåì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÄÕÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€‘™”İ˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…ÉäùÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µ‰½ÑÑ½´èÄÁÁàí½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éäù‘¥Ùí‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁàíµ…É¥¸èİÁà€Àí™½¹ĞµÍ¥é”èÄÉÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥íµ…É¥¸µÑ½ÀèÄÅÁàíÁ…‘‘¥¹œµÑ½ÀèÄÅÁàí‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€‘”Ñ•‘ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œ•µí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹Ğµİ•¥¡ĞèäÔÁô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œÍÑÉ½¹í½±½ÈèŒÅÑ•àí™½¹ĞµÍ¥é”èÈÉÁáô)ô((¼¨€ôôôôô€ÈÀÈØU¹¥™¥•]½É­ÍÁ…”•¹Í¥Ñä€ôôôôô€¨¼)µ•‘¥„€¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…É‘ì(€€€İ¥‘Ñ éµ¥¸ ÄÀÀ”°ÄØĞÁÁà¤ì(€€€µ…É¥¸èÈÉÁà…ÕÑ¼€Àì(€€€Á…‘‘¥¹œèÈáÁà€ÌÁÁà€ÈÑÁàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•…°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éù È°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€€€µ…É¥¸èÀ€À€ÈÁÁàì(€€€Á…‘‘¥¹œèÀ€À€ÄáÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”á•‘˜Ìì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•… È°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éù È°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± Éì(€€€µ…É¥¸èÀì(€€€½±½ÈèŒÄÔÈÈÌàì(€€€™½¹ĞµÍ¥é”èÈÙÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Èì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸áÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•… Èèé…™Ñ•È°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éù Èèé…™Ñ•È°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± Èèé…™Ñ•Éì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€µ…É¥¸µÑ½ÀèİÁàì(€€€½±½ÈèŒİˆàÜääì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€™½¹Ğµİ•¥¡ĞèÜÀÀì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Ğì(€€€±•ÑÑ•ÈµÍÁ…¥¹œèÀì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ¡•… Èèé…™Ñ•Éí½¹Ñ•¹Ğè‹ªÖ³®ƒ²‚W®ÎÓ®–ğƒ²z®‚—¶VcªÎ€ƒ¶J#®ª§ªÎğƒ²Ê£®Ú¶23²vó²vƒ¶fW²vã¶Vpƒ®Jƒ²‚²z—¶Vc²ã²jP¸‰ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éù Èèé…™Ñ•Éí½¹Ñ•¹Ğè‹²æÓ®Npƒ²
³²j§®
Ó²^·ªÎğƒ²b²"c²šw²vƒ®NÇ®†w¶V§®.#®.¸‰ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± Èèé…™Ñ•Éí½¹Ñ•¹Ğè‹²‚W®æƒªâÃ®Îã²‚W®ÎÓ²f ƒ²
³²j¤ƒ¶J#®ª¤°ƒ²Ê£®Ú¶23²vó²vƒ¶Vpƒ®Ê#²^@ƒ®NÇ®†w¶V§®.#®.¸‰ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤ø¹É¥Ì°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹É¥Íì(€€€…ÀèÄáÁàì(€€€µ…É¥¸èÀ€À€ÈÁÁàì(€€€Á…‘‘¥¹œèÄáÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤ø¹É¥Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à ÈÈÁÁà°¸á™È¤µ¥¹µ…à ÈàÁÁà°Ä¸É™È¤µ¥¹µ…à ÈàÁÁà°Ä¸É™È¤ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹É¥Õì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹É¥Ôø¹™¥•±é¹Ñ µ¡¥± Ô¥íÉ¥µ½±Õµ¸èÈ¼Ñô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹É¥Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤ì(€€€…±¥¸µ¥Ñ•µÌéÍÑ…ÉĞì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹™¥•±°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹É¥Ôø¹™¥•±°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹É¥Ìø¹™¥•±‘ì(€€€µ…É¥¸èÀì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹™¥•±ù±…‰•°°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹É¥Ôø¹™¥•±ù±…‰•°°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹É¥Ìø¹™¥•±ù±…‰•±ì(€€€‘¥ÍÁ±…äé‰±½¬ì(€€€µ…É¥¸èÀ€À€áÁàì(€€€½±½ÈèŒÍ˜ÑØÄì(€€€™½¹ĞµÍ¥é”èÄÍÁàì(€€€™½¹Ğµİ•¥¡ĞèäÀÀì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éø¹É¥Ì¥¹ÁÕĞ°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹É¥Ô¥¹ÁÕĞ°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹É¥Ì¥¹ÁÕĞ°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹É¥ÌÑ•áÑ…É•…ì(€€€µ¥¸µ¡•¥¡ĞèĞÙÁàì(€€€µ…É¥¸µÑ½ÀèÀì(€€€™½¹ĞµÍ¥é”èÄÑÁàì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹É¥ÌÑ•áÑ…É•…íµ¥¸µ¡•¥¡ĞèäÑÁàíÉ•Í¥é”éÙ•ÉÑ¥…±ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±•ì(€€€µ…É¥¸µÑ½ÀèÀì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€½Ù•É™±½Üµàé…ÕÑ¼ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±•ì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¤€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ…‰±•ì(€€€µ¥¸µİ¥‘Ñ èÄĞÈÁÁàì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ °(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ¡ì(€€€¡•¥¡ĞèĞáÁàì(€€€Á…‘‘¥¹œèÄÉÁà€ÄÁÁàì(€€€™½¹ĞµÍ¥é”èÄÌ¸ÕÁàì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ‘ì(€€€µ¥¸µ¡•¥¡ĞèĞÙÁàì(€€€Á…‘‘¥¹œèåÁà€İÁàì(€€€Ù•ÉÑ¥…°µ…±¥¸éµ¥‘‘±”ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”¥¹ÁÕĞ°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”¥¹ÁÕÑí¡•¥¡ĞèĞÑÁàí™½¹ĞµÍ¥é”èÄÑÁáô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ™½½Ñ•È°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…É€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµ™½½Ñ•Éì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤µ¥¹µ…à ÌäÁÁà°¸å™È¤ì(€€€…ÀèÄáÁàì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ ì(€€€µ…É¥¸µÑ½ÀèÈÁÁàì(€ô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕÁÁ½ÉÑí‘¥ÍÁ±…äéÉ¥í…ÀèÄÉÁàí…±¥¸µ½¹Ñ•¹ĞéÍÑ…ÉĞíµ¥¸µİ¥‘Ñ èÁô(€€¹µ…¥¹Ñ•¹…¹”µ…‘µ¥Ñ•´µ‰ÕÑÑ½¹ì(€€€İ¥‘Ñ éµ…àµ½¹Ñ•¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€€€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€…ÀèİÁàì(€€€Á…‘‘¥¹œèåÁà€ÄÕÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€‰™‘‰™”ì(€€€‰…­É½Õ¹è•™˜Ù™˜ì(€€€½±½ÈèŒÅÑ•àì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹µ…¥¹Ñ•¹…¹”µÕÁ±½…µÁ…¹•°°(€€¹ÁÕÉ¡…Í”µÕÁ±½…µÁ…¹•±ì(€€€µ¥¸µ¡•¥¡ĞèÄÔÁÁàì(€€€Á…‘‘¥¹œèÄáÁàì(€€€‰½É‘•ÈèÅÁà‘…Í¡•€‰‘Œåàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è™…™™˜ì(€ô(€€¹µ…¥¹Ñ•¹…¹”µÕÁ±½…µÁ…¹•°ÍÑÉ½¹í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(€€¹µ…¥¹Ñ•¹…¹”µÕÁ±½…µÁ…¹•°Áíµ…É¥¸èÙÁà€À€ÄÍÁàí½±½ÈèŒàÜäÍ„Øí™½¹ĞµÍ¥é”èÄÉÁáô(€€¹µ…¥¹Ñ•¹…¹”µÕÁ±½…µÁ…¹•°€¹ÕÁ±½…‘í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèİÁàíµ¥¸µ¡•¥¡ĞèĞÉÁàí‰½É‘•ÈèÅÁàÍ½±¥€Õ‘•”äí‰…­É½Õ¹è™™˜í½±½ÈèŒÌÌĞÄÔÕô(€€¹µ…¥¹Ñ•¹…¹”µÕÁ±½…µÁ…¹•°€¹É••¥ÁĞµÁÉ•Ù¥•İíµ…É¥¸µÑ½ÀèÄÅÁàí½±½ÈèŒàÜäÍ„Øí™½¹ĞµÍ¥é”èÄÉÁáô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éä°(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éåì(€€€µ¥¸µ¡•¥¡ĞèÄÀÀ”ì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÈÁÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€‘™”Ù•˜ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…ÉäùÍÁ…¸°(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…ÉäùÍÁ…¹íµ…É¥¸µ‰½ÑÑ½´èÄáÁàí™½¹ĞµÍ¥é”èÄÑÁáô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éäù‘¥Ø°(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éäù‘¥Ùíµ…É¥¸èÄÅÁà€Àí™½¹ĞµÍ¥é”èÄÍÁáô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éäù‘¥Øˆ°(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éäù‘¥Ø‰í™½¹ĞµÍ¥é”èÄÑÁáô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œ°(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥íµ…É¥¸µÑ½ÀèÄáÁàíÁ…‘‘¥¹œµÑ½ÀèÄáÁáô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œ•´°(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œ•µí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œÍÑÉ½¹œ°(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œÍÑÉ½¹í½±½ÈèŒÅÑ•àí™½¹ĞµÍ¥é”èÈİÁàí±¥¹”µ¡•¥¡ĞèÅô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹‰•Ñİ••¹ì(€€€µ¥¸µ¡•¥¡ĞèÄÌáÁàì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼µ¥¹µ…à À°Å™È¤ì(€€€…ÀèÄáÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÄáÁàì(€€€‰½É‘•ÈèÅÁà‘…Í¡•€‰‘Œåàì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è™…™™˜ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹‰•Ñİ••¸€¹ÕÁ±½…‘ì(€€€µ¥¸µ¡•¥¡ĞèĞÑÁàì(€€€‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€€€…ÀèáÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€Õ‘•”äì(€€€‰…­É½Õ¹è™™˜ì(€€€½±½ÈèŒÌÌĞÄÔÔì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹‰•Ñİ••¸€¹É••¥ÁĞµÁÉ•Ù¥•İí½±½ÈèŒàÜäÍ„Øí™½¹ĞµÍ¥é”èÄÍÁàíÑ•áĞµ…±¥¸é±•™Ñô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ…Ñ¥½¹Ì°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹•¹ÑÉäµ…Ñ¥½¹Ì°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹•¹ÑÉäµ…Ñ¥½¹Íì(€€€µ¥¸µ¡•¥¡ĞèØÙÁàì(€€€µ…É¥¸µÑ½ÀèÈÁÁàì(€€€Á…‘‘¥¹œµÑ½ÀèÄáÁàì(€€€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”á•‘˜Ìì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Üø¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹‘É…™Ğµ¡•±ÀµÑ•áĞ°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÕÍ”ø¹…Éø¹‘É…™Ğµ¡•±ÀµÑ•áĞ°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}¹•Üø¹…Éø¹‘É…™Ğµ¡•±ÀµÑ•áÑì(€€€µ…É¥¸èåÁà€À€Àì(€€€½±½ÈèŒàÜäÍ„Øì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€€€Ñ•áĞµ…±¥¸éÉ¥¡Ğì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ±¥ÍĞø¹±½½­ÕÀµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}±¥ÍĞø¹±½½­ÕÀµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}±¥ÍĞø¹±½½­ÕÀµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÍÑ…ÑÕÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÍÑ…ÑÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}ÍÑ…ÑÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµİ…É•¡½ÕÍ•}É½ÕÁÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¥Ñ•µÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÁ•Éµ¥ÑÌø¹Á•Éµ¥ĞµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÉ••¥ÁÑ}Á¡½Ñ½Ìø¹É••¥ÁĞµÁ¡½Ñ¼µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìø¹É••¥ÁĞµÁ¡½Ñ¼µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½É}…½Õ¹ÑÌø¹Ù•¹‘½Èµ…½Õ¹ĞµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ‰Õ±­}ÑÉ…¹Í™•Èø¹‰Õ±¬µÑÉ…¹Í™•ÈµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÑÉ…Í¡}‰¥¸ø¹ÑÉ…Í µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…Ñ¥Ù¥Ñå}±½Ìø¹…Ñ¥Ù¥Ñäµ±½œµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•}¹•Üø¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìø¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µ±¥ÍÑì(€€€İ¥‘Ñ éµ¥¸ ÄÀÀ”°ÄØÀÁÁà¤ì(€€€µ…É¥¸µ±•™Ğé…ÕÑ¼ì(€€€µ…É¥¸µÉ¥¡Ğé…ÕÑ¼ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ±¥ÍĞø¹±½½­ÕÀµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}±¥ÍĞø¹±½½­ÕÀµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}±¥ÍĞø¹±½½­ÕÀµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÍÑ…ÑÕÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÍÑ…ÑÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}ÍÑ…ÑÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµİ…É•¡½ÕÍ•}É½ÕÁÌø¹…É°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¥Ñ•µÌø¹…É‘ì(€€€Á…‘‘¥¹œèÈÙÁà€ÈáÁàì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ±¥ÍĞø¹±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}±¥ÍĞø¹±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÍÑ…ÑÕÌø¹…Éø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÍÑ…ÑÌø¹…Éø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}ÍÑ…ÑÌø¹…Éø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€€€µ…É¥¸èÀ€À€ÄáÁàì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èÄÙÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”á•‘˜Ìì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ±¥ÍĞø¹±½½­ÕÀµÁ…”ø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}±¥ÍĞø¹±½½­ÕÀµÁ…”ø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÍÑ…ÑÕÌø¹…Éø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÍÑ…ÑÌø¹…Éø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}ÍÑ…ÑÌø¹…Éø¹É¥Õì(€€€…ÀèÄÉÁàì(€€€µ…É¥¸èÀ€À€ÄáÁàì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌø¹…Éø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¥Ñ•µÌø¹…Éø¹É¥Õì(€€€…ÀèÄÑÁàì(€€€µ…É¥¸èÄÙÁà€À€ÄáÁàì(€€€Á…‘‘¥¹œèÄİÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµİ…É•¡½ÕÍ•}É½ÕÁÌø¹…Éø¹Ñİ½í…ÀèÈÁÁáô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµİ…É•¡½ÕÍ•}É½ÕÁÌø¹…Éø¹Ñİ¼ù‘¥Ùì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€Á…‘‘¥¹œèÈÁÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌø¹…Éù È°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµİ…É•¡½ÕÍ•}É½ÕÁÌø¹…Éù È°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¥Ñ•µÌø¹…Éù Éì(€€€µ…É¥¸èÀ€À€ÄáÁàì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èÄÙÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”á•‘˜Ìì(€€€™½¹ĞµÍ¥é”èÈÕÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌø¹…Éø¹…Ñ¥½¹Ì°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¥Ñ•µÌø¹…Éø¹…Ñ¥½¹ÍíÁ…‘‘¥¹œµ‰½ÑÑ½´èÄáÁàí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€•‘˜Å˜Õô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌø¹…É€¹ÍÉ½±°µÑ…‰±”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµİ…É•¡½ÕÍ•}É½ÕÁÌø¹…É€¹ÍÉ½±°µÑ…‰±”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¥Ñ•µÌø¹…É€¹ÍÉ½±°µÑ…‰±”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ±¥ÍĞø¹±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}±¥ÍĞø¹±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}±¥ÍĞø¹±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±•í‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàí‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÈÔ¥ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µÍ•±•ÑíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íèµ¥¹‘•àèÔÁô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¹ì(€€€±•™ĞèÀì(€€€É¥¡Ğé…ÕÑ¼ì(€€€İ¥‘Ñ éµ¥¸ ÜØÁÁà±…±Œ ÄÀÁÙÜ€´€ÌÀÁÁà¤¤ì(€€€µ…àµ¡•¥¡ĞèÌäÁÁàì(€€€µ…É¥¸µÑ½ÀèİÁàì(€€€½Ù•É™±½Üµäé…ÕÑ¼ì(€€€‰½É‘•ÈèÅÁàÍ½±¥€ˆåŒá‘„ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€ÈÁÁà€ĞÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸È¤ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µ¡•…°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½İì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à ÄàÁÁà°Ä¸ĞÕ™È¤µ¥¹µ…à àÁÁà°¸İ™È¤µ¥¹µ…à ÄÌÁÁà°Å™È¤€ØÑÁàµ¥¹µ…à ÄÀÕÁà°¸á™È¤ì(€€€…ÀèÄÉÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µ¡•…‘ì(€€€Á½Í¥Ñ¥½¸éÍÑ¥­äì(€€€Ñ½ÀèÀì(€€€èµ¥¹‘•àèÈì(€€€Á…‘‘¥¹œèÄÁÁà€ÄÑÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€‘”Õ•˜ì(€€€‰…­É½Õ¹è•‘˜Í˜äì(€€€½±½ÈèŒÔÌØÄÜØì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸€¹‘É½Á‘½İ¸µ¥Ñ•µíÁ…‘‘¥¹œèÀí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€•‘˜Å˜Õô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸€¹‘É½Á‘½İ¸µ¥Ñ•´é±…ÍĞµ¡¥±‘í‰½É‘•Èµ‰½ÑÑ½´èÁô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½İíµ¥¸µ¡•¥¡ĞèÔÁÁàíÁ…‘‘¥¹œèåÁà€ÄÑÁàí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÉÁáô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½ÜÍÑÉ½¹í½Ù•É™±½Üé¡¥‘‘•¸í½±½ÈèŒÄÜÈÀÌÌí™½¹ĞµÍ¥é”èÄÑÁàíÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Íô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¹•Ü€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½Ü‰í½±½ÈèŒÅÑ•àíÑ•áĞµ…±¥¸éÉ¥¡Ñô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµ™½½Ñ•Éí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Èí…ÀèÄÉÁàíµ…É¥¸µÑ½ÀèÄÑÁáô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕÁÁ½ÉÑí‘¥ÍÁ±…äéÉ¥í…ÀèÄÁÁáô(€€¹µ…¥¹Ñ•¹…¹”µ…‘µ¥Ñ•´µ‰ÕÑÑ½¹íİ¥‘Ñ èÄÀÀ”íµ¥¸µ¡•¥¡ĞèĞÑÁáô(€€¹µ…¥¹Ñ•¹…¹”µÕÁ±½…µÁ…¹•±ì(€€€Á…‘‘¥¹œèÄÑÁàì(€€€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹µ…¥¹Ñ•¹…¹”µÕÁ±½…µÁ…¹•°ÍÑÉ½¹í‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÍÁáô(€€¹µ…¥¹Ñ•¹…¹”µÕÁ±½…µÁ…¹•°Áíµ…É¥¸èÕÁà€À€ÄÁÁàí½±½ÈèŒàÜäÍ„Øí™½¹ĞµÍ¥é”èÄÅÁáô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éåì(€€€µ…É¥¸èÀì(€€€Á…‘‘¥¹œèÄÕÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€‘™”İ˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…ÉäùÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µ‰½ÑÑ½´èÄÁÁàí½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éäù‘¥Ùí‘¥ÍÁ±…äé™±•àí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁàíµ…É¥¸èİÁà€Àí™½¹ĞµÍ¥é”èÄÉÁáô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥íµ…É¥¸µÑ½ÀèÄÅÁàíÁ…‘‘¥¹œµÑ½ÀèÄÅÁàí‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€‘”Ñ•‘ô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œ•µí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹Ğµİ•¥¡ĞèäÔÁô(€€¹µ…¥¹Ñ•¹…¹”µ•¹ÑÉäµÍÕµµ…Éä€¹‰¥œÍÑÉ½¹í½±½ÈèŒÅÑ•àí™½¹ĞµÍ¥é”èÈÉÁáô(€€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¹íµ…àµ¡•¥¡ĞèÌÀÁÁáô(€€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µ¡•…‘í‘¥ÍÁ±…äé¹½¹•ô(€€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½İí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼í…ÀèÑÁà€ÄÁÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Éô(€€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½ÜÍÑÉ½¹íÉ¥µ½±Õµ¸èÄ¼Èí½±½ÈèŒÄÜÈÀÌÍô(€€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½ÜÍÁ…¸é¹Ñ µ½˜µÑåÁ” Ä¤°(€€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½ÜÍÁ…¸é¹Ñ µ½˜µÑåÁ” È¥íÉ¥µ½±Õµ¸èÄ¼Èí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÅÁáô(€€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½ÜÍÁ…¸é¹Ñ µ½˜µÑåÁ” Ì¥í‘¥ÍÁ±…äé¹½¹•ô(€€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½Ü‰íÉ¥µ½±Õµ¸èÈ¼ÌíÉ¥µÉ½ÜèÄ¼Ğí½±½ÈèŒÅÑ•àíÑ•áĞµ…±¥¸éÉ¥¡Ñô)ô((¼¨€ôôôôôAÕÉ¡…Í”A½ÁÕÀ€¬5…¥¹Ñ•¹…¹”1½½­ÕÀ¥¹…°¥Ğ€ôôôôô€¨¼)µ•‘¥„€¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ…‰±”µ±…å½ÕĞé™¥á•€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹ÁÕÉ¡…Í”µ¥Ñ•´µ•‘¥Ñ½Éì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤µ¥¹µ…à À°Å™È¤…ÕÑ¼ì(€€€…ÀèÙÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹ÁÕÉ¡…Í”µ¥Ñ•´µ•‘¥Ñ½Èø©íµ¥¸µİ¥‘Ñ èÁô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµ…É€¹ÁÕÉ¡…Í”µ¥Ñ•´µ•‘¥Ñ½Èù‰ÕÑÑ½¹íİ¡¥Ñ”µÍÁ…”é¹½İÉ…ÀíÁ…‘‘¥¹œµ±•™ĞèÄÁÁàíÁ…‘‘¥¹œµÉ¥¡ĞèÄÁÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±•ì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ…‰±”µ±…å½ÕĞé™¥á•€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µÍ•±•ÑíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íèµ¥¹‘•àèÔÁô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¹ì(€€€±•™ĞèÀì(€€€É¥¡Ğé…ÕÑ¼ì(€€€İ¥‘Ñ éµ¥¸ ÜØÁÁà±…±Œ äÙÙÜ€´€ÄÈÁÁà¤¤ì(€€€µ…àµ¡•¥¡ĞèÌØÁÁàì(€€€µ…É¥¸µÑ½ÀèİÁàì(€€€½Ù•É™±½Üµäé…ÕÑ¼ì(€€€‰½É‘•ÈèÅÁàÍ½±¥€ˆåŒá‘„ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€ÈÁÁà€ĞÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸È¤ì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µ¡•…°(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½İì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à ÄàÁÁà°Ä¸ĞÕ™È¤µ¥¹µ…à àÁÁà°¸İ™È¤µ¥¹µ…à ÄÌÁÁà°Å™È¤€ØÑÁàµ¥¹µ…à ÄÀÕÁà°¸á™È¤ì(€€€…ÀèÄÉÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µ¡•…‘ì(€€€Á½Í¥Ñ¥½¸éÍÑ¥­äì(€€€Ñ½ÀèÀì(€€€èµ¥¹‘•àèÈì(€€€Á…‘‘¥¹œèÄÁÁà€ÄÑÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€‘”Õ•˜ì(€€€‰…­É½Õ¹è•‘˜Í˜äì(€€€½±½ÈèŒÔÌØÄÜØì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€ô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸€¹‘É½Á‘½İ¸µ¥Ñ•µíÁ…‘‘¥¹œèÀí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€•‘˜Å˜Õô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½İíµ¥¸µ¡•¥¡ĞèÔÁÁàíÁ…‘‘¥¹œèåÁà€ÄÑÁàí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÉÁáô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½ÜÍÑÉ½¹í½Ù•É™±½Üé¡¥‘‘•¸í½±½ÈèŒÄÜÈÀÌÌí™½¹ĞµÍ¥é”èÄÑÁàíÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Íô(€€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½Ü‰í½±½ÈèŒÅÑ•àíÑ•áĞµ…±¥¸éÉ¥¡Ñô((€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹ÍÉ½±°µÑ…‰±•ì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµäé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ…‰±”µ±…å½ÕĞé™¥á•€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ °(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ‘ì(€€€Á…‘‘¥¹œèåÁà€İÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é­••Àµ…±°€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜµİÉ…Àé…¹åİ¡•É”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± Ä¥íİ¥‘Ñ èÄÀ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± È¥íİ¥‘Ñ èÄÔ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± Ì¥íİ¥‘Ñ èä•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± Ğ¥íİ¥‘Ñ èÄØ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± Ô¥íİ¥‘Ñ èÄÈ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± Ø¥íİ¥‘Ñ èÜ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± Ü¥íİ¥‘Ñ èÜ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± à¥íİ¥‘Ñ èÜ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± ä¥íİ¥‘Ñ èÜ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñ é¹Ñ µ¡¥± ÄÀ¥íİ¥‘Ñ èÄÀ•ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñé¹Ñ µ¡¥± Ä¤°(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñé¹Ñ µ¡¥± Ø¤°(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñé¹Ñ µ¡¥± Ü¤°(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñé¹Ñ µ¡¥± à¥íİ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ñô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ‘•Ñ…¥°µÑ•áÑì(€€€‘¥ÍÁ±…äé‰±½¬€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ é¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”€¹µ…¥¹Ğµ±½½­ÕÀµÑ…‰±”Ñé±…ÍĞµ¡¥±€¹¥½¹ì(€€€µ¥¸µ¡•¥¡ĞèÈáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÕÁà€ÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô¥¹…°ÁÀµİ¥‘”!½É¥é½¹Ñ…°¥Ğ€¬U¹±¥ÁÁ•%Ñ•´M•…É €ôôôôô€¨¼)¡Ñµ°±‰½‘ä°É½½Ñì(€İ¥‘Ñ èÄÀÀ”ì(€µ…àµİ¥‘Ñ èÄÀÀ”ì(€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì)ô(¹…ÁÀ°(¹…ÁÀµ…¥¸°(¹…ÁÀÍ•Ñ¥½¸°(¹…ÁÀ€¹…É°(¹…ÁÀ€¹±½½­ÕÀµÁ…”°(¹…ÁÀ€¹É¥È°(¹…ÁÀ€¹É¥Ì°(¹…ÁÀ€¹É¥Ô°(¹…ÁÀ€¹Ñİ¼°(¹…ÁÀ€¹‰•Ñİ••¹ì(€µ¥¸µİ¥‘Ñ èÀì(€µ…àµİ¥‘Ñ èÄÀÀ”ì(€‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àì)ô(¹…ÁÀ€¹É¥Èø¨°(¹…ÁÀ€¹É¥Ìø¨°(¹…ÁÀ€¹É¥Ôø¨°(¹…ÁÀ€¹Ñİ¼ø¨°(¹…ÁÀ€¹‰•Ñİ••¸ø©íµ¥¸µİ¥‘Ñ èÁô(¹…ÁÀ¥¹ÁÕĞ°(¹…ÁÀÍ•±•Ğ°(¹…ÁÀÑ•áÑ…É•…íµ…àµİ¥‘Ñ èÄÀÀ”íµ¥¸µİ¥‘Ñ èÁô()µ•‘¥„€¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±•ì(€€€µ…àµİ¥‘Ñ èÄÀÀ”ì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµäé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ…‰±”°(€€¹…ÁÀ€¹Ñ…‰±”µİÉ…ÀÑ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ…‰±”µ±…å½ÕĞé™¥á•€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ °(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ‘ì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é­••Àµ…±°ì(€€€½Ù•É™±½ÜµİÉ…Àé…¹åİ¡•É”ì(€ô(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ¹É¥¡Ğ°(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ¹‰½±‘íİ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ñô(€€¹…ÁÀ€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±•ì(€€€½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹•¹ÑÉäµ‘•Í­Ñ½ÀµÑ…‰±”Ñ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ…‰±”µ±…å½ÕĞé™¥á•€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹µ…¥¹Ñ•¹…¹”µ¥Ñ•´µ•‘¥Ñ½Éì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤µ¥¹µ…à À°Å™È¤ì(€€€…ÀèÙÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€ô(€€¹…ÁÀ€¹µ…¥¹Ñ•¹…¹”µ¥Ñ•´µ•‘¥Ñ½Èø©íµ¥¸µİ¥‘Ñ èÁô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µÍ•±•ÑíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íèµ¥¹‘•àèØÁô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¹ì(€€€±•™ĞèÀì(€€€É¥¡Ğé…ÕÑ¼ì(€€€İ¥‘Ñ éµ¥¸ ÜØÁÁà±…±Œ ÄÀÁÙÜ€´€ÌÀÁÁà¤¤ì(€€€µ…àµİ¥‘Ñ é…±Œ ÄÀÁÙÜ€´€ÈàÁÁà¤ì(€€€µ…àµ¡•¥¡ĞèÌäÁÁàì(€€€µ…É¥¸µÑ½ÀèİÁàì(€€€½Ù•É™±½Üµäé…ÕÑ¼ì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸ì(€€€‰½É‘•ÈèÅÁàÍ½±¥€ˆåŒá‘„ì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€€€‰…­É½Õ¹è™™˜ì(€€€‰½àµÍ¡…‘½ÜèÀ€ÈÁÁà€ĞÙÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸È¤ì(€ô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µ¡•…°(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½İì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à ÄàÁÁà°Ä¸ĞÕ™È¤µ¥¹µ…à àÁÁà°¸İ™È¤µ¥¹µ…à ÄÌÁÁà°Å™È¤€ØÑÁàµ¥¹µ…à ÄÀÕÁà°¸á™È¤ì(€€€…ÀèÄÉÁàì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€ô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µ¡•…‘ì(€€€Á½Í¥Ñ¥½¸éÍÑ¥­äì(€€€Ñ½ÀèÀì(€€€èµ¥¹‘•àèÈì(€€€Á…‘‘¥¹œèÄÁÁà€ÄÑÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€‘”Õ•˜ì(€€€‰…­É½Õ¹è•‘˜Í˜äì(€€€½±½ÈèŒÔÌØÄÜØì(€€€™½¹ĞµÍ¥é”èÄÅÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€ô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸€¹‘É½Á‘½İ¸µ¥Ñ•µíÁ…‘‘¥¹œèÀí‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€•‘˜Å˜Õô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½İíµ¥¸µ¡•¥¡ĞèÔÁÁàíÁ…‘‘¥¹œèåÁà€ÄÑÁàí½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÉÁáô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½ÜÍÑÉ½¹í½Ù•É™±½Üé¡¥‘‘•¸í½±½ÈèŒÄÜÈÀÌÌí™½¹ĞµÍ¥é”èÄÑÁàíÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¸µÉ½Ü‰í½±½ÈèŒÅÑ•àíÑ•áĞµ…±¥¸éÉ¥¡Ğíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(€€¹¡½µ”µİ••¬µ…±•¹‘…ÈµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹Á¡½Ñ¼µÙ¥•İ•ÈµÑ¡Õµ‰Íì(€€€™±•àµİÉ…ÀéİÉ…Àì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„€¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹…ÁÀ°(€€¹…ÁÀ€¹±½½­ÕÀµÁ…”°(€€¹…ÁÀ€¹Ñ…‰±”µİÉ…À°(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹…Éé¹½Ğ ¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É¥í½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ñô(€€¹…ÁÀ€¹ÁÕÉ¡…Í”µ•¹ÑÉäµÁ½ÁÕÀµ…É‘í½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğí½Ù•É™±½Üµäé…ÕÑ¼€…¥µÁ½ÉÑ…¹Ñô(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ…‰±”°(€€¹…ÁÀ€¹Ñ…‰±”µİÉ…ÀÑ…‰±”°(€€¹…ÁÀÑ…‰±•ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…àµİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ…‰±”µ±…å½ÕĞé™¥á•€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ °(€€¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ°(€€¹…ÁÀ€¹Ñ…‰±”µİÉ…ÀÑ °(€€¹…ÁÀ€¹Ñ…‰±”µİÉ…ÀÑ‘ì(€€€Á…‘‘¥¹œèİÁà€ÕÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é­••Àµ…±°€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½ÜµİÉ…Àé…¹åİ¡•É”€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹µ½‰¥±”µ•¹ÑÉäµ¥Ñ•´µ…É°(€€¹…ÁÀ€¹Í•…É µİÉ…Áí½Ù•É™±½ÜéÙ¥Í¥‰±”€…¥µÁ½ÉÑ…¹Ñô(€€¹…ÁÀ€¹¥Ñ•´µÍ•…É µ‘É½Á‘½İ¹ì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ…àµİ¥‘Ñ é…±Œ ÄÀÁÙÜ€´€ĞÁÁà¤ì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸ì(€ô(€€¹…ÁÀ€¹µ•¹Õì(€€€µ…àµİ¥‘Ñ èÄÀÀ”ì(€€€™±•àµİÉ…ÀéİÉ…À€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹¡½µ”µİ••¬µ…±•¹‘…ÈµÉ¥‘ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ü±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹Á¡½Ñ¼µÙ¥•İ•ÈµÑ¡Õµ‰Íì(€€€™±•àµİÉ…ÀéİÉ…Àì(€€€½Ù•É™±½Üµàé¡¥‘‘•¸€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô…Í¡‰½…É%¹Í¥¡Ğ…É‘Ì€ôôôôô€¨¼(¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹¡½µ”µ¥¹Í¥¡ĞµÍÑ…Ñì(€µ¥¸µ¡•¥¡ĞèÄÌÉÁàì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤€ÄÌÉÁàì(€…ÀèÄáÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€Á…‘‘¥¹œèÈÉÁà€ÄáÁàì(€Ñ•áĞµ…±¥¸é±•™Ğì)ô(¹¡½µ”µ¥¹Í¥¡Ğµ½Áåíµ¥¸µİ¥‘Ñ èÀí‘¥ÍÁ±…äé‰±½¬íÑ•áĞµ…±¥¸é±•™Ñô(¹¡½µ”µ¥¹Í¥¡Ğµ½Áä•µí‘¥ÍÁ±…äé‰±½¬í½±½ÈèŒĞÜÔÔØäí™½¹ĞµÍ¥é”èÄÍÁàí™½¹ĞµÍÑå±”é¹½Éµ…°í™½¹Ğµİ•¥¡ĞèäÔÁô(¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹¡½µ”µ¥¹Í¥¡ĞµÍÑ…Ğ€¹¡½µ”µ¥¹Í¥¡Ğµ½Áä‰ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÄÁÁàì(€™½¹ĞµÍ¥é”èÈİÁàì(€±¥¹”µ¡•¥¡ĞèÄì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁàì)ô(¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹¡½µ”µ¥¹Í¥¡ĞµÍÑ…Ğ€¹¡½µ”µ¥¹Í¥¡Ğµ½ÁäÍµ…±±ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µÑ½ÀèÄÁÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèàÔÀì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹¡½µ”µ¥¹Í¥¡Ğµ½Áäˆ¹ÕÁí½±½Èè‘ŒÈØÈØ…¥µÁ½ÉÑ…¹Ñô(¹¡½µ”µ¥¹Í¥¡Ğµ½Áäˆ¹‘½İ¹í½±½ÈèŒÈÔØÍ•ˆ…¥µÁ½ÉÑ…¹Ñô(¹¡½µ”µ¥¹Í¥¡Ğµ½Áäˆ¹¹•ÕÑÉ…±í½±½ÈèŒØĞÜĞáˆ…¥µÁ½ÉÑ…¹Ñô(¹¡½µ”µ¥¹Í¥¡ĞµÍÁ…É­±¥¹•íİ¥‘Ñ èÄÌÉÁàí¡•¥¡ĞèÔÉÁàí½Ù•É™±½ÜéÙ¥Í¥‰±”í©ÕÍÑ¥™äµÍ•±˜é•¹‘ô(¹¡½µ”µ½µÁ±•Ñ¥½¸µÉ¥¹ì(€İ¥‘Ñ èØÑÁàì(€¡•¥¡ĞèØÑÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµÍ•±˜é•¹ì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰½àµÍ¡…‘½Üé¥¹Í•Ğ€À€À€À€ÅÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞ¤ì)ô(¹¡½µ”µ½µÁ±•Ñ¥½¸µÉ¥¹œ¥ì(€İ¥‘Ñ èĞÙÁàì(€¡•¥¡ĞèĞÙÁàì(€‘¥ÍÁ±…äé‰±½¬ì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è™™™…˜Àì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÄÔÀÁÁà¥ì(€€¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹¡½µ”µ¥¹Í¥¡ĞµÍÑ…ÑíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤€ÄÀÁÁàí…ÀèÄÁÁàíÁ…‘‘¥¹œèÈÁÁà€ÄÙÁáô(€€¹¡½µ”µ¥¹Í¥¡ĞµÍÁ…É­±¥¹•íİ¥‘Ñ èÄÀÁÁáô(€€¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹¡½µ”µ¥¹Í¥¡ĞµÍÑ…Ğ€¹¡½µ”µ¥¹Í¥¡Ğµ½Áä‰í™½¹ĞµÍ¥é”èÈÑÁáô)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜØÁÁà¥ì(€€¹¡½µ”µµ½¹Ñ µÍÑ…ĞµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…¥µÁ½ÉÑ…¹Ñô(€€¹¡½µ”µµ½¹Ñ µÍÑ…Ğ¹¡½µ”µ¥¹Í¥¡ĞµÍÑ…ÑíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤€ÄÄÉÁáô(€€¹¡½µ”µ¥¹Í¥¡ĞµÍÁ…É­±¥¹•íİ¥‘Ñ èÄÄÉÁáô)ô((¼¨€ôôôôô5½‰¥±”	É…¹•¹Ñ•È€¬½µÁ…ĞAÕÉ¡…Í”Ñ¥½¹Ì€ôôôôô€¨¼)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹…ÁÀø¹¡•É½ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀø¹¡•É¼€¹¡•É¼µ‰É…¹µ½Áåì(€€€™±•àèÀ€Ä…ÕÑ¼ì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀø¹¡•É¼€¹µ…¥¸µÑ¥Ñ±”°(€€¹…ÁÀø¹¡•É¼Áì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¹ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸ù Éì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÁÕÉ¡…Í”µ±½½­ÕÀµ…Ñ¥½¹Íì(€€€İ¥‘Ñ èÄÀÀ”ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹ÁÕÉ¡…Í”µ±½½­ÕÀµÁ…”€¹ÁÕÉ¡…Í”µ±½½­ÕÀµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèåÁà€áÁà€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸È€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô5½‰¥±”½µÁ…ĞÑ¥½¸MåÍÑ•´%90€ôôôôô€¨¼)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¼¨ƒ²z®‚—
ß®NÇ®†tƒ¶fS®¦Ó²v`ƒ²‚²z”¿²Ò#ªâÃ¶fP¿²^®†s®Npƒ®Ê¶*ğ€¨¼(€€¹…ÁÀ€¹…Ñ¥½¹Ì°(€€¹…ÁÀ€¹É¥¡Ğµ…Ñ¥½¹Ì°(€€¹…ÁÀ€¹•¹ÑÉäµ…Ñ¥½¹Ì°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…€¹…Ñ¥½¹Ì°(€€¹‰…­ÕÀµ…Ñ¥½¹Íì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹…Ñ¥½¹Ìù‰ÕÑÑ½¸°(€€¹…ÁÀ€¹…Ñ¥½¹Ìù±…‰•°°(€€¹…ÁÀ€¹É¥¡Ğµ…Ñ¥½¹Ìù‰ÕÑÑ½¸°(€€¹…ÁÀ€¹É¥¡Ğµ…Ñ¥½¹Ìù±…‰•°°(€€¹…ÁÀ€¹•¹ÑÉäµ…Ñ¥½¹Ìù‰ÕÑÑ½¸°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…€¹…Ñ¥½¹Ìù‰ÕÑÑ½¸°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…€¹…Ñ¥½¹Ìù±…‰•°°(€€¹‰…­ÕÀµ…Ñ¥½¹Ìù‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèáÁà€İÁà€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸È€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€€€İ½Éµ‰É•…¬é­••Àµ…±°€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¼¨ƒ²æÓ®Ns²†Ã¶j0èƒ²‚s®ª¤€Ç²’€¬ƒ²^G² ½A€Ë²æà€¨¼(€€¹…Éµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…Éµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù Éì(€€€É¥µ½±Õµ¸èÄ€¼€´Ä€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€À€ÙÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµÍ•±˜é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…Éµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèáÁà€İÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¼¨ƒ²‚W®æ²†Ã¶j0èƒ²‚s®ª¤€Ç²’€¬ƒ²^G² ¿²‚W®æ®NÇ®†t€Ë²æà€¨¼(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù Éì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµÍ•±˜é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù‘¥Ùì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù‘¥Øù‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèáÁà€İÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¼¨ƒ®.“²jÓ®†s®Npƒ®Ê¶*ó²vĞƒ¶Vc®
c®şC²vàƒ²†Ã¶j3
ß¶×ªÎƒ¶fS®¦Ğ€¨¼(€€¹…Éø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù‰ÕÑÑ½¸é½¹±äµ½˜µÑåÁ”°(€€¹±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù‰ÕÑÑ½¸é½¹±äµ½˜µÑåÁ”°(€€¹Í¡•‘Õ±”µ±¥ÍĞµ¡•…ù‰ÕÑÑ½¸é½¹±äµ½˜µÑåÁ•ì(€€€İ¥‘Ñ éµ¥¸ ÄàÁÁà°ÄÀÀ”¤€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµÍ•±˜é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µÍ•±˜é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèáÁà€ÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¼¨ƒªÆÃ®zc²Êc
ß¶J#®ª§²v`ƒ®.£®>ƒ²^G² ƒ²^®†s®Npƒ®Ê¶*ğ€¨¼(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌø¹…Éø¹‰•Ñİ••¸°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¥Ñ•µÌø¹…Éø¹‰•Ñİ••¹ì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌø¹…Éø¹‰•Ñİ••¸ø¹ÕÁ±½…°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ¥Ñ•µÌø¹…Éø¹‰•Ñİ••¸ø¹ÕÁ±½…‘ì(€€€İ¥‘Ñ éµ¥¸ ÈÈÁÁà°ÄÀÀ”¤€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèĞÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèáÁà€ÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÍÁà€…¥µÁ½ÉÑ…¹Ğì(€ô((€€¼¨ƒ²‚W®æ²vó²‚Tƒ²†Ã¶j0ƒ¶^“®6P€¨¼(€€¹Í¡•‘Õ±”µ±¥ÍĞµ¡•…‘ì(€€€©ÕÍÑ¥™äµ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹Í¡•‘Õ±”µ±¥ÍĞµ¡•…ù‘¥Ø°(€€¹Í¡•‘Õ±”µ±¥ÍĞµ¡•… È°(€€¹Í¡•‘Õ±”µ±¥ÍĞµ¡•…Áì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô)ô()µ•‘¥„¡µ…àµİ¥‘Ñ èÌàÁÁà¥ì(€€¹…ÁÀ€¹…Ñ¥½¹Ìù‰ÕÑÑ½¸°(€€¹…ÁÀ€¹…Ñ¥½¹Ìù±…‰•°°(€€¹…Éµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù‰ÕÑÑ½¸°(€€¹µ…¥¹Ğµ±½½­ÕÀµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±ù‘¥Øù‰ÕÑÑ½¹ì(€€€™½¹ĞµÍ¥é”èÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèİÁà€ÕÁà€…¥µÁ½ÉÑ…¹Ğì(€ô)ô((¼¨€ôôôôô	…­ÕÀ€¼A•Éµ¥ÍÍ¥½¸±•…¸1…å½ÕĞ€ôôôôô€¨¼(¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÁ…•ì(€‘¥ÍÁ±…äéÉ¥ì(€…ÀèÄáÁàì(€Á…‘‘¥¹œèÈÑÁàì(€‰…­É½Õ¹è˜Ñ˜İ™ˆì(€‰½É‘•ÈèÅÁàÍ½±¥€”Ñ•…˜Èì(€‰½àµÍ¡…‘½Üé¹½¹”ì)ô(¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É½ì(€µ…É¥¸èÀì(€Á…‘‘¥¹œèÈÑÁà€ÈÙÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰”Ù˜Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°™™™™™˜€À”°˜É˜İ™˜€ÄÀÀ”¤ì)ô(¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É¼ÍÁ…¹ì(€Á…‘‘¥¹œèÕÁà€ÄÁÁàì(€‰…­É½Õ¹è”á˜Å™˜ì(€½±½ÈèŒÅÑ•àì(€±•ÑÑ•ÈµÍÁ…¥¹œè¸ÉÁàì)ô(¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É¼ Éì(€µ…É¥¸èåÁà€À€ÕÁàì(€™½¹ĞµÍ¥é”èÈáÁàì(€±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁàì)ô(¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É¼Áì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèÜÔÀì)ô(¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥‘ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ø±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÁÁàì)ô(¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥ù‘¥Ùì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€µ¥¸µİ¥‘Ñ èÀì(€Á…‘‘¥¹œèÄÑÁà€ÄÕÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàì(€‰…­É½Õ¹è™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÌÔ¤ì)ô(¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥ÍÁ…¹ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô(¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥‰ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÈÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹…‘µ¥¸µµ…¹…•µ•¹ĞµÍ•Ñ¥½¹ì(€µ¥¸µİ¥‘Ñ èÀì)ô(¹…‘µ¥¸µÍ•Ñ¥½¸µ¡•…°(¹Á•Éµ¥ÍÍ¥½¸µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€…ÀèÄÉÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô(¹…‘µ¥¸µÍ•Ñ¥½¸µ¡•…ùÍÁ…¸°(¹…‘µ¥¸µÍ•Ñ¥½¸µ¹Õµ‰•Éì(€‘¥ÍÁ±…äé¥¹±¥¹”µÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€™±•àèÀ€À€ÌÑÁàì(€İ¥‘Ñ èÌÑÁàì(€¡•¥¡ĞèÌÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁàì(€‰…­É½Õ¹èŒÅÑ•àì(€½±½Èè™™˜ì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹…‘µ¥¸µÍ•Ñ¥½¸µ¡•… Ì°(¹Á•Éµ¥ÍÍ¥½¸µ¡•… Íì(€µ…É¥¸èÀ€À€ÍÁàì(€½±½ÈèŒÁ˜ÄÜÉ„ì(€™½¹ĞµÍ¥é”èÄåÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹…‘µ¥¸µÍ•Ñ¥½¸µ¡•…À°(¹Á•Éµ¥ÍÍ¥½¸µ¡•…Áì(€µ…É¥¸èÀì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÜÔÀì)ô(¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÉ¥‘ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Ä¸İ™È¤µ¥¹µ…à ÌÀÁÁà°¸á™È¤ì(€…ÀèÄÑÁàì(€µ…É¥¸èÀì)ô(¹‰…­ÕÀµ…É°(¹Á•Éµ¥ÍÍ¥½¸µ…É‘ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€Á…‘‘¥¹œèÈÁÁàì(€‰½àµÍ¡…‘½ÜèÀ€ÙÁà€ÈÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞÔ¤ì)ô(¹‰…­ÕÀµµ…¥¸µ…É°(¹É•ÍÑ½É”µ…É‘ì(€µ¥¸µ¡•¥¡ĞèÄÀÀ”ì)ô(¹‰…­ÕÀµ…Éµ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÉÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì)ô(¹‰…­ÕÀµ…Éµ¡•… Íì(€µ…É¥¸èÑÁà€À€Àì(€™½¹ĞµÍ¥é”èÄåÁàì)ô(¹‰…­ÕÀµ…Éµ¡•…ù•µì(€Á…‘‘¥¹œèÙÁà€åÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹ĞµÍÑå±”é¹½Éµ…°ì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹‰…­ÕÀµ…Éµ­¥­•Éì(€½±½ÈèŒÈÔØÍ•ˆì(€™½¹ĞµÍ¥é”èÄÁÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€±•ÑÑ•ÈµÍÁ…¥¹œèÅÁàì)ô(¹‰…­ÕÀµ…Éµ­¥­•È¹‘…¹•Éí½±½Èè‘ŒÈØÈÙô(¹‰…­ÕÀµ…ÉùÁì(€™½¹ĞµÍ¥é”èÄÍÁàì(€±¥¹”µ¡•¥¡ĞèÄ¸ÔÔì)ô(¹‰…­ÕÀµÉ•½µµ•¹‘•µ‰½áì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤…ÕÑ¼ì(€…ÀèÕÁà€ÄÑÁàì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€µ…É¥¸µÑ½ÀèÄÙÁàì(€Á…‘‘¥¹œèÄÙÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰™‘‰™”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì)ô(¹‰…­ÕÀµÉ•½µµ•¹‘•µ‰½àÍÑÉ½¹ì(€½±½ÈèŒÅ”Í„á„ì(€™½¹ĞµÍ¥é”èÄÑÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹‰…­ÕÀµÉ•½µµ•¹‘•µ‰½àÍÁ…¹ì(€É¥µ½±Õµ¸èÄì(€½±½ÈèŒÔĞÜÀåˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÜÔÀì)ô(¹‰…­ÕÀµÉ•½µµ•¹‘•µ‰½à‰ÕÑÑ½¹ì(€É¥µ½±Õµ¸èÈì(€É¥µÉ½ÜèÄ€¼€Ìì(€µ¥¸µİ¥‘Ñ èÄàÁÁàì)ô(¹‰…­ÕÀµÍ•½¹‘…Éäµ…Ñ¥½¹Íì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèáÁàì(€µ…É¥¸µÑ½ÀèÄÁÁàì)ô(¹‰…­ÕÀµÍ•½¹‘…Éäµ…Ñ¥½¹Ì‰ÕÑÑ½¹ì(€İ¥‘Ñ èÄÀÀ”ì(€µ¥¸µ¡•¥¡ĞèĞÁÁàì(€Á…‘‘¥¹œèİÁà€åÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€å”É•Œì(€‰…­É½Õ¹è™™˜ì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô(¹É•ÍÑ½É”µ…É‘ì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì)ô(¹É•ÍÑ½É”µ™¥±”µÁ¥­•Éì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤…ÕÑ¼ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÁÁàì(€µ¥¸µ¡•¥¡ĞèĞáÁàì(€µ…É¥¸µÑ½Àé…ÕÑ¼ì(€Á…‘‘¥¹œèáÁà€åÁà€áÁà€ÄÍÁàì(€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€‰…­É½Õ¹è™™˜ì(€ÕÉÍ½ÈéÁ½¥¹Ñ•Èì)ô(¹É•ÍÑ½É”µ™¥±”µÁ¥­•È¹Í•±•Ñ•‘ì(€‰½É‘•ÈµÍÑå±”éÍ½±¥ì(€‰½É‘•Èµ½±½ÈèŒäÍŒÕ™ì(€‰…­É½Õ¹è˜á™‰™˜ì)ô(¹É•ÍÑ½É”µ™¥±”µÁ¥­•È¥¹ÁÕÑí‘¥ÍÁ±…äé¹½¹•ô(¹É•ÍÑ½É”µ™¥±”µÁ¥­•ÈÍÁ…¹ì(€µ¥¸µİ¥‘Ñ èÀì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèàÔÀì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹É•ÍÑ½É”µ™¥±”µÁ¥­•È‰ì(€Á…‘‘¥¹œèİÁà€åÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèåÁàì(€‰…­É½Õ¹è”É”á˜Àì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì)ô(¹É•ÍÑ½É”µÍÕ‰µ¥Ñì(€İ¥‘Ñ èÄÀÀ”ì(€µ…É¥¸µÑ½ÀèåÁàì)ô(¹‰…­ÕÀµ…É‰ÕÑÑ½¸é‘¥Í…‰±•°(¹Á•Éµ¥ÍÍ¥½¸µ…É‰ÕÑÑ½¸é‘¥Í…‰±•‘ì(€½Á…¥Ñäè¸Ôì(€ÕÉÍ½Èé¹½Ğµ…±±½İ•ì)ô(¹ÍÑ½É…”µ±•…¹ÕÀµ…É‘ì(€µ…É¥¸µÑ½ÀèÀì(€Á…‘‘¥¹œèÄáÁà€ÈÁÁàì)ô(¹ÍÑ½É…”µ±•…¹ÕÀµ…É€¹‰…­ÕÀµ…Éµ¡•…‘ì(€µ…É¥¸µ‰½ÑÑ½´èİÁàì)ô(¹ÍÑ½É…”µ±•…¹ÕÀµÍÑ…ÑÍì(€µ…É¥¸èÄÉÁà€Àì)ô(¹ÍÑ½É…”µ±•…¹ÕÀµÍÑ…ÑÌ‘¥Ùì(€Á…‘‘¥¹œèÄÉÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€•‘˜Å˜Ôì)ô(¹Á•Éµ¥ÍÍ¥½¸µ…É¹…‘µ¥¸µµ…¹…•µ•¹ĞµÍ•Ñ¥½¹ì(€Á…‘‘¥¹œèÈÑÁàì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÙÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÙÁàì(€Ñ•áĞµ…±¥¸é±•™Ğì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¡•…ù‘¥Ùíµ¥¸µİ¥‘Ñ èÀí™±•àèÅô(¹Á•Éµ¥ÍÍ¥½¸µ¡•… Ì°(¹Á•Éµ¥ÍÍ¥½¸µ¡•…Áì(€Ñ•áĞµ…±¥¸é±•™Ğì)ô(¹Á•Éµ¥ÍÍ¥½¸µÕÍ•Èµ½Õ¹Ñì(€µ…É¥¸µ±•™Ğé…ÕÑ¼ì(€Á…‘‘¥¹œèİÁà€ÄÅÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½±”µÕ¥‘•ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèáÁàì(€µ…É¥¸µ‰½ÑÑ½´èÄÑÁàì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½±”µÕ¥‘”ù‘¥Ùì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€…ÀèÄÁÁàì(€µ¥¸µİ¥‘Ñ èÀì(€Á…‘‘¥¹œèÄÉÁà€ÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ•…˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è˜á™…™Œì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½±”µÕ¥‘”‰ì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½±”µÕ¥‘”ÍÁ…¹ì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì)ô(¹Á•Éµ¥ÍÍ¥½¸µ™½Éµì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Ä¸Ñ™È¤µ¥¹µ…à ÄàÁÁà°¸İ™È¤…ÕÑ¼ì(€…ÀèÄÁÁàì(€…±¥¸µ¥Ñ•µÌé•¹ì(€Á…‘‘¥¹œèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è™™˜ì)ô(¹Á•Éµ¥ÍÍ¥½¸µ™½É´€¹™¥•±‘íµ…É¥¸èÁô(¹Á•Éµ¥ÍÍ¥½¸µÍ…Ù”µ‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èÄÄÁÁàì(€¡•¥¡ĞèĞÑÁàì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¥µ¡•±Áì(€µ…É¥¸èáÁà€ÍÁà€Àì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÅÁàì(€™½¹Ğµİ•¥¡ĞèÜÔÀì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¥µ¡•±À‰í½±½ÈèŒÌÌĞÄÔÕô(¹Á•Éµ¥ÍÍ¥½¸µ¡•­Íì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèÄÉÁàì(€µ…É¥¸èÄÑÁà€À€Àì(€Á…‘‘¥¹œèÀì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÀì(€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğì)ô(¹Á•Éµ¥ÍÍ¥½¸µ‘•™…Õ±Ğµ…•ÍÍì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèåÁàì(€É¥µ½±Õµ¸èÄ€¼€´Äì(€Á…‘‘¥¹œèÄÁÁà€ÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰•…™”ì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàì(€‰…­É½Õ¹è•…˜É™˜ì)ô(¹Á•Éµ¥ÍÍ¥½¸µ‘•™…Õ±Ğµ…•ÍÌ‰ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì)ô(¹Á•Éµ¥ÍÍ¥½¸µ‘•™…Õ±Ğµ…•ÍÌÍÁ…¹ì(€½±½ÈèŒĞÜØÔá˜ì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèàÔÀì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÁì(€µ¥¸µİ¥‘Ñ èÀì(€Á…‘‘¥¹œèÄÑÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€‰…­É½Õ¹è˜á™…™Œì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀùÍÑÉ½¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€µ…É¥¸µ‰½ÑÑ½´èÄÁÁàì(€Á…‘‘¥¹œèÀ€ÉÁàì(€½±½ÈèŒÌÌĞÄÔÔì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèÄÀÀÀì(€Ñ•áĞµ…±¥¸é±•™Ğì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀù‘¥Ùì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤ì(€…ÀèáÁàì(€İ¥‘Ñ èÄÀÀ”ì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀ±…‰•±ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€…ÀèáÁàì(€µ¥¸µİ¥‘Ñ èÀì(€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€µ…É¥¸èÀì(€Á…‘‘¥¹œèåÁà€ÄÅÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€”Õ•…˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€‰…­É½Õ¹è™™˜ì(€Ñ•áĞµ…±¥¸é±•™Ğì(€½Ù•É™±½Üé¡¥‘‘•¸ì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀ¥¹ÁÕÑmÑåÁ”ô‰¡•­‰½à‰uì(€™±•àèÀ€À€ÄİÁàì(€İ¥‘Ñ èÄİÁàì(€¡•¥¡ĞèÄİÁàì(€µ…É¥¸èÀì(€Á…‘‘¥¹œèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÑÁàì(€…•¹Ğµ½±½ÈèŒÈÔØÍ•ˆì)ô(¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀ±…‰•°ÍÁ…¹ì(€‘¥ÍÁ±…äé‰±½¬ì(€™±•àèÄ€Ä…ÕÑ¼ì(€µ¥¸µİ¥‘Ñ èÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì(€İ¡¥Ñ”µÍÁ…”é¹½Éµ…°ì(€İ½Éµ‰É•…¬é­••Àµ…±°ì(€½Ù•É™±½ÜµİÉ…Àé‰É•…¬µİ½Éì)ô(¹Á•Éµ¥ÍÍ¥½¸µ±¥ÍÑì(€µ…É¥¸µÑ½ÀèÄÑÁàì(€Á…‘‘¥¹œµÑ½ÀèÄÑÁàì(€‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”á•‘˜Ìì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½İì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à ÈÀÁÁà°Å™È¤µ¥¹µ…à ÄĞÁÁà±…ÕÑ¼¤…ÕÑ¼ì(€…ÀèÄÙÁàì(€Á…‘‘¥¹œèÄÍÁà€ÄÑÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€‰…­É½Õ¹è˜á™…™Œì(€Ñ•áĞµ…±¥¸é±•™Ğì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÁ•ÉÍ½¹ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€…ÀèÄÉÁàì(€µ¥¸µİ¥‘Ñ èÀì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÁ•ÉÍ½¸‰ì(€µ¥¸µİ¥‘Ñ èÀì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€Ñ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÁ•ÉÍ½¸ÍÁ…¹ì(€™±•àèÀ€À…ÕÑ¼ì(€Á…‘‘¥¹œèÑÁà€áÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàì(€‰…­É½Õ¹è”É”á˜Àì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÍÑ…ÑÕÍì(€Ñ•áĞµ…±¥¸éÉ¥¡Ğì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½Üµ…Ñ¥½¹Íì(€‘¥ÍÁ±…äé™±•àì(€…ÀèİÁàì)ô(¹Á•Éµ¥ÍÍ¥½¸µÉ½Üµ…Ñ¥½¹Ìù‰ÕÑÑ½¹ì(€µ¥¸µ¡•¥¡ĞèÌÑÁàì(€Á…‘‘¥¹œèÀ€ÄÉÁàì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€™½¹ĞµÍ¥é”èÄÉÁàì)ô(¹Á•Éµ¥ÍÍ¥½¸µ•µÁÑåì(€Á…‘‘¥¹œèÈÑÁàì(€‰½É‘•ÈèÅÁà‘…Í¡•€‰Õ”Äì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€½±½ÈèŒØĞÜĞáˆì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÔÀì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èÄÄÀÁÁà¥ì(€€¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¥ô(€€¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô(€€¹‰…­ÕÀµÍ•½¹‘…Éäµ…Ñ¥½¹ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì±µ¥¹µ…à À°Å™È¤¥ô)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÁ…•í…ÀèÄÑÁàíÁ…‘‘¥¹œèÄÉÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁáô(€€¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É½íÁ…‘‘¥¹œèÄåÁà€ÄİÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁáô(€€¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µ¡•É¼ Éí™½¹ĞµÍ¥é”èÈÑÁáô(€€¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤í…ÀèáÁáô(€€¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥ù‘¥ÙíÁ…‘‘¥¹œèÄÉÁáô(€€¹…‘µ¥¸µÍ•Ñ¥½¸µ¡•…°¹Á•Éµ¥ÍÍ¥½¸µ¡•…‘í…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉÑô(€€¹‰…­ÕÀµ…É°¹Á•Éµ¥ÍÍ¥½¸µ…É¹…‘µ¥¸µµ…¹…•µ•¹ĞµÍ•Ñ¥½¹íÁ…‘‘¥¹œèÄÕÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁáô(€€¹‰…­ÕÀµÉ•½µµ•¹‘•µ‰½áíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™ÈíÁ…‘‘¥¹œèÄÑÁáô(€€¹‰…­ÕÀµÉ•½µµ•¹‘•µ‰½àÍÁ…¸°¹‰…­ÕÀµÉ•½µµ•¹‘•µ‰½à‰ÕÑÑ½¹íÉ¥µ½±Õµ¸èÄíÉ¥µÉ½Üé…ÕÑ½ô(€€¹‰…­ÕÀµÉ•½µµ•¹‘•µ‰½à‰ÕÑÑ½¹íİ¥‘Ñ èÄÀÀ”íµ¥¸µİ¥‘Ñ èÀíµ…É¥¸µÑ½ÀèÕÁáô(€€¹‰…­ÕÀµÍ•½¹‘…Éäµ…Ñ¥½¹ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ñô(€€¹‰…­ÕÀµÍ•½¹‘…Éäµ…Ñ¥½¹Ìù‰ÕÑÑ½¹íİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ñô(€€¹ÍÑ½É…”µ±•…¹ÕÀµ…É‘íÁ…‘‘¥¹œèÄÕÁáô(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•…‘í‘¥ÍÁ±…äé™±•àí…ÀèÄÁÁáô(€€¹Á•Éµ¥ÍÍ¥½¸µÕÍ•Èµ½Õ¹Ñíµ…É¥¸èÀ€À€À…ÕÑ¼íİ¥‘Ñ éµ…àµ½¹Ñ•¹Ñô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½±”µÕ¥‘•íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô(€€¹Á•Éµ¥ÍÍ¥½¸µ™½ÉµíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹ĞíÁ…‘‘¥¹œèÄÉÁáô(€€¹Á•Éµ¥ÍÍ¥½¸µÍ…Ù”µ‰ÕÑÑ½¹íİ¥‘Ñ èÄÀÀ”íµ¥¸µİ¥‘Ñ èÁô(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•­ÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÁíÁ…‘‘¥¹œèÄÉÁáô(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀùÍÑÉ½¹íÁ…‘‘¥¹œèÀ€ÉÁáô(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀù‘¥Ùí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤íİ¥‘Ñ èÄÀÀ•ô(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀ±…‰•±íµ¥¸µİ¥‘Ñ èÁô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½İíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼€…¥µÁ½ÉÑ…¹Ğí…ÀèåÁà€ÄÉÁáô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÁ•ÉÍ½¹íÉ¥µ½±Õµ¸èÄ€¼€´Åô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÍÑ…ÑÕÍíÉ¥µ½±Õµ¸èÄíÑ•áĞµ…±¥¸é±•™Ñô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½Üµ…Ñ¥½¹ÍíÉ¥µ½±Õµ¸èÈíÉ¥µÉ½ÜèÉô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½Üµ…Ñ¥½¹Ìù‰ÕÑÑ½¹íİ¥‘Ñ é…ÕÑ¼€…¥µÁ½ÉÑ…¹Ñô(€€¹ÍÑ½É…”µ±•…¹ÕÀµ±¥ÍĞ‘¥ÙíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÜÁÁàµ¥¹µ…à À°Å™È¤€ÔÉÁà€ĞÙÁáô)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èĞÈÁÁà¥ì(€€¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥‘íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Éô(€€¹‰…­ÕÀµ½Ù•ÉÙ¥•ÜµÉ¥ù‘¥Ùí‘¥ÍÁ±…äéÉ¥í…ÀèÍÁáô(€€¹‰…­ÕÀµ…Éµ¡•…‘í‘¥ÍÁ±…äéÉ¥‘ô(€€¹‰…­ÕÀµ…Éµ¡•…ù•µíİ¥‘Ñ éµ…àµ½¹Ñ•¹Ñô(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•¬µÉ½ÕÀù‘¥ÙíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô(€€¹Á•Éµ¥ÍÍ¥½¸µ¡•…‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô(€€¹Á•Éµ¥ÍÍ¥½¸µÕÍ•Èµ½Õ¹Ñíµ…É¥¸èÁô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½İíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ñô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½ÜµÍÑ…ÑÕÌ°¹Á•Éµ¥ÍÍ¥½¸µÉ½Üµ…Ñ¥½¹ÍíÉ¥µ½±Õµ¸èÄíÉ¥µÉ½Üé…ÕÑ½ô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½Üµ…Ñ¥½¹Íí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Éô(€€¹Á•Éµ¥ÍÍ¥½¸µÉ½Üµ…Ñ¥½¹Ìù‰ÕÑÑ½¹íİ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ñô)ô((¼¨€ôôôôôÕ±°5•¹ÔY¥ÍÕ…°½¹Í¥ÍÑ•¹äÕ‘¥Ğ€ôôôôô€¨¼(¹Ù•¹‘½Èµ…‘‘É•ÍÌµ¥¹ÁÕÑì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤…ÕÑ¼ì(€…ÀèáÁàì(€µ¥¸µİ¥‘Ñ èÀì)ô)µ•‘¥„¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌ€¹Ù•¹‘½ÈµÉ•¥ÍÑ•ÈµÉ¥ø¹™¥•±é¹Ñ µ¡¥± Ø¥íÉ¥µ½±Õµ¸èÄ€¼ÍÁ…¸€Íô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½ÉÌ€¹Ù•¹‘½ÈµÉ•¥ÍÑ•ÈµÉ¥ø¹™¥•±é¹Ñ µ¡¥± Ü¥íÉ¥µ½±Õµ¸èĞ€¼ÍÁ…¸€Éô)ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµ¥¹ÁÕĞù‰ÕÑÑ½¹ì(€µ¥¸µİ¥‘Ñ èàáÁàì(€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€Á…‘‘¥¹œèáÁà€ÄÍÁàì(€‰½É‘•ÈèÅÁàÍ½±¥€‰™‘‰™”ì(€‰…­É½Õ¹è•™˜Ù™˜ì(€½±½ÈèŒÅÑ•àì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì(€İ¡¥Ñ”µÍÁ…”é¹½İÉ…Àì)ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ‰…­‘É½Áì(€Á½Í¥Ñ¥½¸é™¥á•ì(€¥¹Í•ĞèÀì(€èµ¥¹‘•àèÄÀÀÀÀÀÄì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€Á…‘‘¥¹œèÈÁÁàì(€‰…­É½Õ¹éÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Ôà¤ì(€‰…­‘É½Àµ™¥±Ñ•Èé‰±ÕÈ ÑÁà¤ì)ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…±ì(€İ¥‘Ñ éµ¥¸ ÔĞÁÁà±…±Œ ÄÀÁÙÜ€´€ÌÉÁà¤¤ì(€¡•¥¡Ğéµ¥¸ ÜÈÁÁà±…±Œ ÄÀÁÙ €´€ĞÁÁà¤¤ì(€‘¥ÍÁ±…äéÉ¥ì(€É¥µÑ•µÁ±…Ñ”µÉ½İÌé…ÕÑ¼µ¥¹µ…à À°Å™È¤ì(€½Ù•É™±½Üé¡¥‘‘•¸ì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰”Ñ˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàì(€‰…­É½Õ¹è™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÌÁÁà€äÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÌÈ¤ì)ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ¡•…‘ì(€‘¥ÍÁ±…äé™±•àì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€…ÀèÄÙÁàì(€Á…‘‘¥¹œèÄİÁà€ÄáÁàì(€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”É”á˜Àì(€‰…­É½Õ¹è™™˜ì)ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ¡•…ù‘¥Ùí‘¥ÍÁ±…äéÉ¥í…ÀèÍÁàíµ¥¸µİ¥‘Ñ èÁô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ¡•…ÍÑÉ½¹í½±½ÈèŒÄÜÈÀÌÌí™½¹ĞµÍ¥é”èÄİÁàí™½¹Ğµİ•¥¡ĞèäÔÁô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ¡•…ÍÁ…¹í½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèÜÔÁô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ¡•…ù‰ÕÑÑ½¹ì(€™±•àèÀ€À€ÌáÁàì(€İ¥‘Ñ èÌáÁàì(€¡•¥¡ĞèÌáÁàì(€‘¥ÍÁ±…äéÉ¥ì(€Á±…”µ¥Ñ•µÌé•¹Ñ•Èì(€Á…‘‘¥¹œèÀì(€‰½É‘•ÈèÅÁàÍ½±¥€‘‰”Ñ˜Àì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁàì(€‰…­É½Õ¹è˜á™…™Œì(€½±½ÈèŒĞÜÔÔØäì)ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ‰½‘åíÁ½Í¥Ñ¥½¸éÉ•±…Ñ¥Ù”íµ¥¸µ¡•¥¡ĞèÀí‰…­É½Õ¹è˜á™…™ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµ•µ‰•‘íİ¥‘Ñ èÄÀÀ”í¡•¥¡ĞèÄÀÀ”í‘¥ÍÁ±…äé¹½¹”í‰…­É½Õ¹è™™™ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµ•µ‰•¹É•…‘åí‘¥ÍÁ±…äé‰±½­ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µÍÑ…ÑÕÍì(€Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”ì(€¥¹Í•ĞèÀì(€èµ¥¹‘•àèÄì(€‘¥ÍÁ±…äé™±•àì(€™±•àµ‘¥É•Ñ¥½¸é½±Õµ¸ì(€…±¥¸µ¥Ñ•µÌé•¹Ñ•Èì(€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€…ÀèÄÁÁàì(€Á…‘‘¥¹œèÈÑÁàì(€½±½ÈèŒØĞÜĞáˆì(€™½¹ĞµÍ¥é”èÄÍÁàì(€™½¹Ğµİ•¥¡ĞèàÀÀì(€Ñ•áĞµ…±¥¸é•¹Ñ•Èì)ô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µÍÑ…ÑÕÌ¹•ÉÉ½Éí½±½ÈèˆäÅŒÅô(¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µÍÑ…ÑÕÌ¹•ÉÉ½Èù‰ÕÑÑ½¹ì(€µ…É¥¸µÑ½ÀèÑÁàì(€Á…‘‘¥¹œèåÁà€ÄÑÁàì(€‰½É‘•ÈèÀì(€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€‰…­É½Õ¹èŒÈÔØÍ•ˆì(€½±½Èè™™˜ì(€™½¹Ğµİ•¥¡ĞèäÀÀì)ô)µ•‘¥„¡µ…àµİ¥‘Ñ èØÀÁÁà¥ì(€€¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ‰…­‘É½ÁíÁ…‘‘¥¹œèÄÁÁáô(€€¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…±íİ¥‘Ñ èÄÀÀ”í¡•¥¡Ğé…±Œ ÄÀÁÙ €´€ÈÁÁà¤í‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁáô(€€¹Ù•¹‘½Èµ…‘‘É•ÍÌµµ½‘…°µ¡•…‘íÁ…‘‘¥¹œèÄÑÁáô)ô(¹…ÁÀ¥¹ÁÕÑmÑåÁ”ô‰¡•­‰½à‰uì(€™±•àèÀ€À€ÄİÁàì(€İ¥‘Ñ èÄİÁà€…¥µÁ½ÉÑ…¹Ğì(€µ¥¸µİ¥‘Ñ èÄİÁàì(€µ…àµİ¥‘Ñ èÄİÁàì(€¡•¥¡ĞèÄİÁàì(€µ…É¥¸èÀì(€Á…‘‘¥¹œèÀ€…¥µÁ½ÉÑ…¹Ğì(€‰½É‘•ÈµÉ…‘¥ÕÌèÑÁàì(€…•¹Ğµ½±½ÈèŒÈÔØÍ•ˆì)ô(¹…ÁÀ‰ÕÑÑ½¸°(¹…ÁÀ€¹ÕÁ±½…‘ì(€µ…àµİ¥‘Ñ èÄÀÀ”ì(€µ¥¸µİ¥‘Ñ èÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÈÔì(€İ½Éµ‰É•…¬é­••Àµ…±°ì)ô(¹…ÁÀ€¹™¥•±°(¹…ÁÀ€¹™¥•±ø©ì(€µ¥¸µİ¥‘Ñ èÀì)ô(¹…ÁÀ€¹™¥•±ù±…‰•±ì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÀÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì(€Ñ•áĞµ…±¥¸é±•™Ğì(€İ½Éµ‰É•…¬é­••Àµ…±°ì)ô(¹…ÁÀ¥¹ÁÕĞ°(¹…ÁÀÍ•±•Ğ°(¹…ÁÀÑ•áÑ…É•…ì(€µ¥¸µ¡•¥¡ĞèĞÉÁàì(€‰½É‘•Èµ½±½Èèİ”Á•„ì)ô(¹…ÁÀÑ•áÑ…É•…í±¥¹”µ¡•¥¡ĞèÄ¸Õô(¹…ÁÀ€¹•µÁÑä°(¹…ÁÀ€¹•¹Ñ•Éì(€İ½Éµ‰É•…¬é­••Àµ…±°ì(€½Ù•É™±½ÜµİÉ…Àé…¹åİ¡•É”ì)ô(¹…ÁÀ€¹ÍÉ½±°µÑ…‰±•ì(€‰½É‘•Èµ½±½Èè”É”á˜Àì(€‰…­É½Õ¹è™™˜ì(€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÈÔ¤ì)ô(¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ¡ì(€‰…­É½Õ¹è˜Å˜Õ˜äì(€½±½ÈèŒĞÜÔÔØäì(€™½¹ĞµÍ¥é”èÄÉÁàì(€™½¹Ğµİ•¥¡ĞèäÔÀì(€±¥¹”µ¡•¥¡ĞèÄ¸ÌÔì)ô(¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ‘ì(€½±½ÈèŒÌÌĞÄÔÔì(€±¥¹”µ¡•¥¡ĞèÄ¸ĞÔì)ô(¹…ÁÀ€¹ÍÉ½±°µÑ…‰±”Ñ‰½‘äÑÈé¡½Ù•ÈÑ‘í‰…­É½Õ¹è˜á™‰™™ô()µ•‘¥„¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÁ•Éµ¥ÑÌø¹Á•Éµ¥ĞµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÉ••¥ÁÑ}Á¡½Ñ½Ìø¹É••¥ÁĞµÁ¡½Ñ¼µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ•¹…¹•}Á¡½Ñ½Ìø¹É••¥ÁĞµÁ¡½Ñ¼µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½É}…½Õ¹ÑÌø¹Ù•¹‘½Èµ…½Õ¹ĞµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ‰Õ±­}ÑÉ…¹Í™•Èø¹‰Õ±¬µÑÉ…¹Í™•ÈµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÑÉ…Í¡}‰¥¸ø¹ÑÉ…Í µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…Ñ¥Ù¥Ñå}±½Ìø¹…Ñ¥Ù¥Ñäµ±½œµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•}¹•Üø¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ•¹…¹•}Í¡•‘Õ±•Ìø¹µ…¥¹Ñ•¹…¹”µÍ¡•‘Õ±”µÁÉ¼µ±¥ÍĞ°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÍ¥Ñ•}¹½Ñ¥•Ìø¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÕÁ‘…Ñ•}¡¥ÍÑ½Éäø¹¹½Ñ¥”µÁÉ¼µİÉ…À°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÕÁ‘…Ñ•}¹½Ñ¥•Ìø¹¹½Ñ¥”µÁÉ¼µİÉ…À°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ‰…­ÕÁ}Á•Éµ¥ÍÍ¥½¹Ìø¹‰…­ÕÀµÁ•Éµ¥ÍÍ¥½¸µÁ…•ì(€€€İ¥‘Ñ éµ¥¸ ÄÀÀ”°ÄØÀÁÁà¤ì(€€€µ…É¥¸èÈÉÁà…ÕÑ¼€Àì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÁ•Éµ¥ÑÌø¹Á•Éµ¥ĞµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½É}…½Õ¹ÑÌø¹Ù•¹‘½Èµ…½Õ¹ĞµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ‰Õ±­}ÑÉ…¹Í™•Èø¹‰Õ±¬µÑÉ…¹Í™•ÈµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÑÉ…Í¡}‰¥¸ø¹ÑÉ…Í µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…Ñ¥Ù¥Ñå}±½Ìø¹…Ñ¥Ù¥Ñäµ±½œµÁ…•ì(€€€Á…‘‘¥¹œèÈÙÁà€ÈáÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàì(€€€‰…­É½Õ¹è™™˜ì(€€€‰½àµÍ¡…‘½ÜèÀ€ÄÁÁà€ÌÁÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÔÔ¤ì(€ô(€€¹ÑÉ…Í µÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•…‘ì(€€€‘¥ÍÁ±…äé™±•àì(€€€…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸ì(€€€…ÀèÄáÁàì(€€€µ…É¥¸èÀ€À€ÄáÁàì(€€€Á…‘‘¥¹œèÀ€À€ÄÙÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”á•‘˜Ìì(€ô(€€¹ÑÉ…Í µÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± È°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± È°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•… È°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•… Éì(€€€µ…É¥¸èÀ€À€ÕÁàì(€€€½±½ÈèŒÄÔÈÈÌàì(€€€™½¹ĞµÍ¥é”èÈÕÁàì(€€€™½¹Ğµİ•¥¡ĞèäÔÀì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Èì(€€€±•ÑÑ•ÈµÍÁ…¥¹œè´¸İÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹ÑÉ…Í µÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±À°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±À°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…À°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•…Áì(€€€µ…É¥¸èÀì(€€€½±½ÈèŒİˆàÜääì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Ôì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹ÑÉ…Í µÁ…”ø¹É¥Ì°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹É¥Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à ÄàÁÁà°¸Ìá™È¤µ¥¹µ…à ÈàÁÁà°Å™È¤ì(€€€…ÀèÄÑÁàì(€€€µ…É¥¸µ‰½ÑÑ½´èÄáÁàì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹ÑÉ…Í µÁ…”ø¹É¥Ì€¹™¥•±°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹É¥Ì€¹™¥•±‘íµ…É¥¸èÁô(€€¹Á•Éµ¥ĞµÁ…”ø¹É¥Ô°(€€¹Á•Éµ¥ĞµÁ…”ø¹É¥Íì(€€€‘¥ÍÁ±…äéÉ¥ì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à ÄäÁÁà°Å™È¤¤ì(€€€…ÀèÄÑÁàì(€€€µ…É¥¸èÀ€À€ÄÑÁàì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹Á•Éµ¥ĞµÁ…”ø¹É¥Ô€¹™¥•±°(€€¹Á•Éµ¥ĞµÁ…”ø¹É¥Ì€¹™¥•±‘íµ…É¥¸èÁô(€€¹Á•Éµ¥ĞµÁ…”ø¹™¥•±‘ì(€€€µ…É¥¸èÀ€À€ÄÑÁàì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹Á•Éµ¥ĞµÁ…”ø¹…Ñ¥½¹Ì¹É¥¡Ğµ…Ñ¥½¹Íì(€€€µ…É¥¸èÀ€À€ÈÁÁàì(€€€Á…‘‘¥¹œµ‰½ÑÑ½´èÄáÁàì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”á•‘˜Ìì(€ô(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ™¥±Ñ•Éì(€€€…±¥¸µ¥Ñ•µÌé•¹ì(€€€…ÀèÄÑÁàì(€€€Á…‘‘¥¹œèÄÙÁàì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ™¥±Ñ•È€¹™¥•±‘íµ…É¥¸èÁô(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ…É°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ…É‘ì(€€€‰½É‘•Èµ½±½Èè”É”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÑÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀÌÔ¤ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÍÑ…ÑÕÌø¹…Éø¹ÍÑ…ÑÕÌµ…É‘Ì°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÍÑ…ÑÌø¹…Éø¹ÍÑ…ÑÕÌµ…É‘Ì°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}ÍÑ…ÑÌø¹…Éø¹ÍÑ…ÑÕÌµ…É‘Íì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à ÄÜÁÁà°Å™È¤¤ì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ±¥ÍĞø¹±½½­ÕÀµÁ…”ø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}±¥ÍĞø¹±½½­ÕÀµÁ…”ø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÍÑ…ÑÕÌø¹…Éø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…É‘}ÍÑ…ÑÌø¹…Éø¹É¥Ô°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµµ…¥¹Ñ}ÍÑ…ÑÌø¹…Éø¹É¥Õì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ¡…ÕÑ¼µ™¥Ğ±µ¥¹µ…à ÄÜÕÁà°Å™È¤¤ì(€ô)ô()µ•‘¥„¡µ…àµİ¥‘Ñ èäÀÁÁà¥ì(€€¹Ù•¹‘½Èµ…‘‘É•ÍÌµ¥¹ÁÕÑíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô(€€¹Ù•¹‘½Èµ…‘‘É•ÍÌµ¥¹ÁÕĞù‰ÕÑÑ½¹íİ¥‘Ñ èÄÀÀ•ô(€€¹…ÁÀ¥¹ÁÕÑmÑåÁ”ô‰¡•­‰½à‰uì(€€€™±•àµ‰…Í¥ÌèÄáÁàì(€€€İ¥‘Ñ èÄáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÄáÁàì(€€€µ…àµİ¥‘Ñ èÄáÁàì(€€€¡•¥¡ĞèÄáÁàì(€ô(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÁ•Éµ¥ÑÌø¹Á•Éµ¥ĞµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÙ•¹‘½É}…½Õ¹ÑÌø¹Ù•¹‘½Èµ…½Õ¹ĞµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ‰Õ±­}ÑÉ…¹Í™•Èø¹‰Õ±¬µÑÉ…¹Í™•ÈµÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµÑÉ…Í¡}‰¥¸ø¹ÑÉ…Í µÁ…”°(€€¹…ÁÀ¹…ÁÀµÑ…ˆµ…Ñ¥Ù¥Ñå}±½Ìø¹…Ñ¥Ù¥Ñäµ±½œµÁ…•ì(€€€Á…‘‘¥¹œèÄÕÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”É”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½Üé¹½¹”ì(€ô(€€¹Á•Éµ¥Ğµ¡•…°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•…°(€€¹ÑÉ…Í µÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±‘ì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ €…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€À€ÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÀ€À€ÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥€”á•‘˜Ìì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹Á•Éµ¥Ğµ¡•… È°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•… È°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•… È°(€€¹ÑÉ…Í µÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± È°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥± Éì(€€€µ…É¥¸èÀ€À€ÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÈÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹Á•Éµ¥Ğµ¡•…À°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…À°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•…À°(€€¹ÑÉ…Í µÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±À°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹‰•Ñİ••¸é™¥ÉÍĞµ¡¥±Áì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÉÁàì(€€€±¥¹”µ¡•¥¡ĞèÄ¸Ôì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹Á•Éµ¥Ğµ¡•…€¹…Ñ¥½¹Ì°(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ¡•…€¹…Ñ¥½¹Ì°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ¡•…€¹…Ñ¥½¹Íì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹Á•Éµ¥ĞµÁ…”ø¹É¥Ô°(€€¹Á•Éµ¥ĞµÁ…”ø¹É¥Ì°(€€¹ÑÉ…Í µÁ…”ø¹É¥Ì°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹É¥Ì°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ™¥±Ñ•Éì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€À€ÄÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÄÉÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÅÁàÍ½±¥€”Å”á˜Àì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÍÁàì(€€€‰…­É½Õ¹è˜á™…™Œì(€ô(€€¹Á•Éµ¥ĞµÁ…”ø¹É¥Ô€¹™¥•±°(€€¹Á•Éµ¥ĞµÁ…”ø¹É¥Ì€¹™¥•±°(€€¹ÑÉ…Í µÁ…”ø¹É¥Ì€¹™¥•±°(€€¹…Ñ¥Ù¥Ñäµ±½œµÁ…”ø¹É¥Ì€¹™¥•±°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ™¥±Ñ•È€¹™¥•±‘íµ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ñô(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ…É°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ…É°(€€¹Á•Éµ¥Ğµ…É°(€€¹µ½‰¥±”µ±¥ÍĞµ…É‘ì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàì(€€€½Ù•É™±½Üé¡¥‘‘•¸ì(€ô(€€¹Ù•¹‘½Èµ…½Õ¹Ğµ…É€¨°(€€¹‰Õ±¬µÑÉ…¹Í™•Èµ…É€¨°(€€¹Á•Éµ¥Ğµ…É€¨°(€€¹µ½‰¥±”µ±¥ÍĞµ…É€©ì(€€€µ…àµİ¥‘Ñ èÄÀÀ”ì(€€€İ½Éµ‰É•…¬é­••Àµ…±°ì(€€€½Ù•É™±½ÜµİÉ…Àé…¹åİ¡•É”ì(€ô(€€¹µ½‰¥±”µ±¥ÍĞµ…Ñ¥½¹Ì°(€€¹Á•Éµ¥Ğµ…Éµ…Ñ¥½¹Ì°(€€¹Í¡•‘Õ±”µÉ½Üµ…Ñ¥½¹Íì(€€€‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ È±µ¥¹µ…à À°Å™È¤¤€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèáÁà€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹µ½‰¥±”µ±¥ÍĞµ…Ñ¥½¹Ìù‰ÕÑÑ½¸°(€€¹Á•Éµ¥Ğµ…Éµ…Ñ¥½¹Ìù‰ÕÑÑ½¸°(€€¹Í¡•‘Õ±”µÉ½Üµ…Ñ¥½¹Ìù‰ÕÑÑ½¹ì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½À°(€€¹É••¥ÁĞµ±•…¸µ…ÉµÑ½À°(€€¹‰Õ±¬µ…Éµµ…¥¹ì(€€€µ¥¸µİ¥‘Ñ èÀì(€€€…ÀèÄÁÁàì(€ô(€€¹Í¥Ñ”µ¹½Ñ¥”µµ½‘•É¸µ…ÉµÑ½Àø¨°(€€¹É••¥ÁĞµ±•…¸µ…ÉµÑ½Àø¨°(€€¹‰Õ±¬µ…Éµµ…¥¸ø©íµ¥¸µİ¥‘Ñ èÁô)ô((¼¨€ôôôôô•Í­Ñ½ÀM¥‘•‰…È±¥¹µ•¹Ğ¥à€ôôôôô€¨¼)µ•‘¥„¡µ¥¸µİ¥‘Ñ èäÀÅÁà¥ì(€€¹…ÁÀ€¹µ•¹Ôù‰ÕÑÑ½¸é¹½Ğ ¹‘•Í­Ñ½ÀµÍ¥‘•‰…ÈµÑ½±”¤°(€€¹…ÁÀ€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¹ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞì(€€€Á…‘‘¥¹œµÉ¥¡ĞèÌÑÁàì(€€€Á…‘‘¥¹œµ±•™ĞèÄÍÁàì(€€€Ñ•áĞµ…±¥¸é±•™Ğì(€ô(€€¹…ÁÀ€¹µ•¹ÔµÉ½ÕÀø¹ÍÕˆ°(€€¹…ÁÀ€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀø¹µ…¥¹ĞµÍÕ‰ì(€€€Á½Í¥Ñ¥½¸éÍÑ…Ñ¥Œ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€É¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€…¥µÁ½ÉÑ…¹Ğì(€€€…ÀèÍÁà€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÍÁà€À€İÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèÀ€À€À€ÌÅÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½Üé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹µ•¹Ô€¹ÍÕˆ‰ÕÑÑ½¸°(€€¹…ÁÀ€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸°(€€¹…ÁÀ€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é™¥ÉÍĞµ¡¥±°(€€¹…ÁÀ€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é±…ÍĞµ¡¥±‘ì(€€€Á½Í¥Ñ¥½¸éÍÑ…Ñ¥Œ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¥‘Ñ èÄÀÀ”€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µİ¥‘Ñ èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€µ¥¸µ¡•¥¡ĞèÌÑÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğì(€€€…±¥¸µ¥Ñ•µÌé•¹Ñ•È€…¥µÁ½ÉÑ…¹Ğì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé™±•àµÍÑ…ÉĞ€…¥µÁ½ÉÑ…¹Ğì(€€€µ…É¥¸èÀ€…¥µÁ½ÉÑ…¹Ğì(€€€Á…‘‘¥¹œèİÁà€ÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈèÀ€…¥µÁ½ÉÑ…¹Ğì(€€€‰½É‘•ÈµÉ…‘¥ÕÌèáÁà€…¥µÁ½ÉÑ…¹Ğì(€€€‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğ€…¥µÁ½ÉÑ…¹Ğì(€€€½±½ÈèŒå•…‰ŒÀ€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹ĞµÍ¥é”èÄÈ¸ÕÁà€…¥µÁ½ÉÑ…¹Ğì(€€€™½¹Ğµİ•¥¡ĞèàÀÀ€…¥µÁ½ÉÑ…¹Ğì(€€€±¥¹”µ¡•¥¡ĞèÄ¸ÈÔ€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é±•™Ğ€…¥µÁ½ÉÑ…¹Ğì(€€€İ¡¥Ñ”µÍÁ…”é¹½İÉ…À€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½Üé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹µ•¹Ô€¹ÍÕˆ‰ÕÑÑ½¸èé‰•™½É”°(€€¹…ÁÀ€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸èé‰•™½É•ì(€€€½¹Ñ•¹Ğé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€€€‘¥ÍÁ±…äé¹½¹”€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹µ•¹Ô€¹ÍÕˆ‰ÕÑÑ½¸é¡½Ù•È°(€€¹…ÁÀ€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸é¡½Ù•Éì(€€€‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÀÜ¤€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè™™˜€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ€¹µ•¹Ô€¹ÍÕˆ‰ÕÑÑ½¸¹…Ñ¥Ù”°(€€¹…ÁÀ€¹µ•¹Ô€¹µ…¥¹Ğµµ•¹ÔµÉ½ÕÀ€¹µ…¥¹ĞµÍÕˆ‰ÕÑÑ½¸¹…Ñ¥Ù•ì(€€€‰…­É½Õ¹éÉ‰„ ÌÜ°ää°ÈÌÔ°¸ÈØ¤€…¥µÁ½ÉÑ…¹Ğì(€€€½±½Èè•…˜É™˜€…¥µÁ½ÉÑ…¹Ğì(€€€‰½àµÍ¡…‘½Üé¥¹Í•Ğ€ÍÁà€À€À€ŒØÁ„Õ™„€…¥µÁ½ÉÑ…¹Ğì(€ô(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹µ•¹Ôù‰ÕÑÑ½¸é¹½Ğ ¹‘•Í­Ñ½ÀµÍ¥‘•‰…ÈµÑ½±”¤°(€€¹…ÁÀ¹Í¥‘•‰…Èµ½±±…ÁÍ•€¹µ•¹ÔµÉ½ÕÀù‰ÕÑÑ½¹ì(€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ğé•¹Ñ•Èì(€€€Á…‘‘¥¹œèÄÁÁà€…¥µÁ½ÉÑ…¹Ğì(€€€Ñ•áĞµ…±¥¸é•¹Ñ•Èì(€ô)ô((¼¨€ôôôôô	¥9½Ñ¥•ÌèA¡…Í”€Ä€ôôôôô€¨¼(¹‰¥µ¹½Ñ¥”µÁ…•í‘¥ÍÁ±…äéÉ¥í…ÀèÄáÁáô(¹‰¥µ¹½Ñ¥”µ¡•…‘í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÈÁÁàíÁ…‘‘¥¹œèÈÑÁà€ÈÙÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÈÁÁàí‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°ŒÄÀÈÌÍ˜°ŒÅÑ˜äÄ¤í½±½Èè™™˜í‰½àµÍ¡…‘½ÜèÀ€ÄÑÁà€ÌÁÁàÉ‰„ ÄÔ°ÌÔ°ØÌ°¸ÄØ¥ô(¹‰¥µ¹½Ñ¥”µ¡•…ù‘¥Øé™¥ÉÍĞµ¡¥±ùÍÁ…¹í‘¥ÍÁ±…äé‰±½¬íµ…É¥¸µ‰½ÑÑ½´èÙÁàí½±½ÈèŒäÍŒÕ™í™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÀÀí±•ÑÑ•ÈµÍÁ…¥¹œè¸ÄÉ•µô(¹‰¥µ¹½Ñ¥”µ¡•… Éíµ…É¥¸èÀ€À€İÁàí™½¹ĞµÍ¥é”èÈİÁáô(¹‰¥µ¹½Ñ¥”µ¡•…Áíµ…É¥¸èÀí½±½Èè‘‰•…™”í™½¹ĞµÍ¥é”èÄÑÁáô(¹‰¥µ¹½Ñ¥”µÍÑ…•í‘¥ÍÁ±…äéÉ¥í©ÕÍÑ¥™äµ¥Ñ•µÌé•¹Ñ•Èí…ÀèÑÁàíµ¥¸µİ¥‘Ñ èÄÔÁÁàíÁ…‘‘¥¹œèÄÑÁà€ÄáÁàí‰½É‘•ÈèÅÁàÍ½±¥É‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÈĞ¤í‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàí‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸Ä¥ô(¹‰¥µ¹½Ñ¥”µÍÑ…”‰í™½¹ĞµÍ¥é”èÄÙÁáô¹‰¥µ¹½Ñ¥”µÍÑ…”ÍÁ…¹í½±½Èè‘‰•…™”í™½¹ĞµÍ¥é”èÄÉÁáô(¹‰¥µ­•åİ½ÉµÁ…¹•±í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèÄÑÁàíÁ…‘‘¥¹œèÄåÁà€ÈÅÁàí‰½É‘•ÈèÅÁàÍ½±¥€‘”Õ˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄİÁàí‰…­É½Õ¹è™™™ô(¹‰¥µ­•åİ½ÉµÉ½ÕÁí‘¥ÍÁ±…äéÉ¥í…ÀèÄÁÁáô¹‰¥µ­•åİ½ÉµÉ½ÕÀÍÑÉ½¹í½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÍÁáô(¹‰¥µ­•åİ½ÉµÉ½ÕÀù‘¥Ùí‘¥ÍÁ±…äé™±•àí™±•àµİÉ…ÀéİÉ…Àí…ÀèİÁáô(¹‰¥µ­•åİ½ÉµÉ½ÕÀÍÁ…¹íÁ…‘‘¥¹œèİÁà€ÄÅÁàí‰½É‘•ÈµÉ…‘¥ÕÌèääåÁàí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÀÁô(¹‰¥µ­•åİ½ÉµÉ½ÕÀÍÁ…¸¹¥¹±Õ‘•í‰…­É½Õ¹è”á˜É™˜í½±½ÈèŒÅÑ•áô¹‰¥µ­•åİ½ÉµÉ½ÕÀÍÁ…¸¹•á±Õ‘•í‰…­É½Õ¹è™™˜Á˜Àí½±½ÈèŒÈĞÄĞÅô(¹‰¥µ­•åİ½Éµ¡¥ÁÍíµ¥¸µ¡•¥¡ĞèÌÍÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Éô¹‰¥µ­•åİ½Éµ¡¥ÁÌ•µí½±½ÈèŒäÑ„Íˆàí™½¹ĞµÍ¥é”èÄÉÁàí™½¹ĞµÍÑå±”é¹½Éµ…±ô(¹‰¥µ­•åİ½Éµ¡¥ÁÌÍÁ…¹í‘¥ÍÁ±…äé¥¹±¥¹”µ™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèİÁáô(¹‰¥µ­•åİ½Éµ¡¥ÁÌÍÁ…¸‰ÕÑÑ½¹í‘¥ÍÁ±…äéÉ¥íÁ±…”µ¥Ñ•µÌé•¹Ñ•Èíİ¥‘Ñ èÄáÁàí¡•¥¡ĞèÄáÁàíµ¥¸µİ¥‘Ñ èÄáÁàíÁ…‘‘¥¹œèÀí‰½É‘•ÈèÀí‰½É‘•ÈµÉ…‘¥ÕÌèÔÀ”í‰…­É½Õ¹éÉ‰„ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸ÜÈ¤í½±½ÈéÕÉÉ•¹Ñ½±½Èí™½¹ĞµÍ¥é”èÄÙÁàí±¥¹”µ¡•¥¡ĞèÅô(¹‰¥µ­•åİ½Éµ…‘‘í‘¥ÍÁ±…äéÉ¥€…¥µÁ½ÉÑ…¹ĞíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à À°Å™È¤…ÕÑ¼í…ÀèİÁà€…¥µÁ½ÉÑ…¹Ñô(¹‰¥µ­•åİ½Éµ…‘¥¹ÁÕÑíİ¥‘Ñ èÄÀÀ”íµ¥¸µİ¥‘Ñ èÁô¹‰¥µ­•åİ½Éµ…‘‰ÕÑÑ½¹íµ¥¸µİ¥‘Ñ èØÁÁàí™½¹Ğµİ•¥¡ĞèàÀÁô(¹‰¥µ­•åİ½Éµ…Ñ¥½¹ÍíÉ¥µ½±Õµ¸èÄ¼´Äí‘¥ÍÁ±…äé™±•à€…¥µÁ½ÉÑ…¹Ğí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÉÁàíÁ…‘‘¥¹œµÑ½ÀèÄÕÁàí‰½É‘•ÈµÑ½ÀèÅÁàÍ½±¥€”İ•‘˜Ñô(¹‰¥µ­•åİ½Éµ…Ñ¥½¹ÌÍÁ…¹íÁ…‘‘¥¹œèÀí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèØÀÁô¹‰¥µ­•åİ½Éµ…Ñ¥½¹Ì‰ÕÑÑ½¹íİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(¹‰¥µÉ…¹”µÁ…¹•±í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È€Å™Èí…ÀèÄÑÁàíÁ…‘‘¥¹œèÄáÁà€ÈÁÁàí‰½É‘•ÈèÅÁàÍ½±¥€‘”Õ˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄİÁàí‰…­É½Õ¹è™™™ô(¹‰¥µÉ…¹”µÉ½ÕÁí‘¥ÍÁ±…äéÉ¥í…±¥¸µ½¹Ñ•¹ĞéÍÑ…ÉĞí…ÀèÄÁÁàíµ¥¸µİ¥‘Ñ èÁô¹‰¥µÉ…¹”µÉ½ÕÀùÍÑÉ½¹í½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÍÁáô¹‰¥µÉ…¹”µÉ½ÕÀùÍµ…±±í½±½ÈèŒÜÄàÀäØí™½¹ĞµÍ¥é”èÄÅÁàí±¥¹”µ¡•¥¡ĞèÄ¸ĞÕô(¹‰¥µÉ•¥½¸µ‰ÕÑÑ½¹Ì°¹‰¥µ‘…Ñ”µÅÕ¥­í‘¥ÍÁ±…äé™±•àí™±•àµİÉ…ÀéİÉ…Àí…ÀèİÁáô¹‰¥µÉ•¥½¸µ‰ÕÑÑ½¹Ì‰ÕÑÑ½¸°¹‰¥µ‘…Ñ”µÅÕ¥¬‰ÕÑÑ½¹íÁ…‘‘¥¹œèáÁà€ÄÅÁàí‰½É‘•ÈèÅÁàÍ½±¥€á”Å•Œí‰½É‘•ÈµÉ…‘¥ÕÌèåÁàí‰…­É½Õ¹è˜á™…™Œí½±½ÈèŒÔÈØÄÜØí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÀÁô(¹‰¥µÉ•¥½¸µ‰ÕÑÑ½¹Ì‰ÕÑÑ½¸¹…Ñ¥Ù•í‰½É‘•Èµ½±½ÈèŒİ‘ˆÉ™˜í‰…­É½Õ¹è”á˜É™˜í½±½ÈèŒÅÑ•àí‰½àµÍ¡…‘½ÜèÀ€À€À€ÉÁàÉ‰„ Ôä°ÄÌÀ°ÈĞØ°¸Àà¥ô(¹‰¥µ‘…Ñ”µ¥¹ÁÕÑÍí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìéµ¥¹µ…à ÄÈÕÁà°Å™È¤…ÕÑ¼µ¥¹µ…à ÄÈÕÁà°Å™È¤í…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèáÁáô¹‰¥µ‘…Ñ”µ¥¹ÁÕÑÌ¥¹ÁÕÑíİ¥‘Ñ èÄÀÀ”íµ¥¸µİ¥‘Ñ èÁô¹‰¥µ‘…Ñ”µ¥¹ÁÕÑÌÍÁ…¹í½±½ÈèŒÜÄàÀäØí™½¹Ğµİ•¥¡ĞèàÀÁô(¹‰¥µ™¥±Ñ•Èµ‰…Éí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹Ìé…ÕÑ¼µ¥¹µ…à ÈÈÁÁà°Å™È¤…ÕÑ¼í…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèÄÉÁàíÁ…‘‘¥¹œèÄÕÁàí‰½É‘•ÈèÅÁàÍ½±¥€‘”Õ˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÙÁàí‰…­É½Õ¹è™™™ô(¹‰¥µÍ½ÕÉ”µÑ…‰Íí‘¥ÍÁ±…äé™±•àí…ÀèÕÁàíÁ…‘‘¥¹œèÑÁàí‰½É‘•ÈµÉ…‘¥ÕÌèÄÅÁàí‰…­É½Õ¹è••˜É˜İô(¹‰¥µÍ½ÕÉ”µÑ…‰Ì‰ÕÑÑ½¹í‰½É‘•ÈèÀí‰…­É½Õ¹éÑÉ…¹ÍÁ…É•¹Ğí½±½ÈèŒØĞÜĞáˆí™½¹Ğµİ•¥¡ĞèàÀÁô(¹‰¥µÍ½ÕÉ”µÑ…‰Ì‰ÕÑÑ½¸¹…Ñ¥Ù•í‰…­É½Õ¹è™™˜í½±½ÈèŒÅÑ•àí‰½àµÍ¡…‘½ÜèÀ€ÉÁà€İÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸Ä¥ô(¹‰¥µ™¥±Ñ•Èµ‰…È¥¹ÁÕÑíİ¥‘Ñ èÄÀÀ”íµ¥¸µİ¥‘Ñ èÁô(¹‰¥µÉ•ÍÕ±ĞµÍÕµµ…Éåí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¸í…ÀèÄÑÁàíÁ…‘‘¥¹œèÄÍÁà€ÄáÁàí‰½É‘•ÈèÅÁàÍ½±¥€‘”Õ˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÑÁàí‰…­É½Õ¹è™™™ô(¹‰¥µÉ•ÍÕ±ĞµÍÕµµ…Éäù‘¥Ùí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé‰…Í•±¥¹”í…ÀèİÁáô¹‰¥µÉ•ÍÕ±ĞµÍÕµµ…ÉäÍÑÉ½¹í½±½ÈèŒÅÑ•àí™½¹ĞµÍ¥é”èÈÉÁáô¹‰¥µÉ•ÍÕ±ĞµÍÕµµ…ÉäÍÁ…¸°¹‰¥µÉ•ÍÕ±ĞµÍÕµµ…ÉäÁíµ…É¥¸èÀí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèÜÀÁô(¹‰¥µ…Á¤µ•ÉÉ½ÉíÁ…‘‘¥¹œèÄÉÁà€ÄÕÁàí‰½É‘•ÈèÅÁàÍ½±¥€™•…„í‰½É‘•ÈµÉ…‘¥ÕÌèÄÉÁàí‰…­É½Õ¹è™™˜Å˜Èí½±½ÈèˆĞÈÌÄàí™½¹ĞµÍ¥é”èÄÍÁàí™½¹Ğµİ•¥¡ĞèÜÀÀí±¥¹”µ¡•¥¡ĞèÄ¸Õô(¹‰¥µ±¥ÍĞµ¡•…‘í‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄÄÁÁàµ¥¹µ…à ÈØÁÁà°Å™È¤€ÄÔÁÁà€ÄĞÁÁàí…ÀèÄÑÁàíÁ…‘‘¥¹œèÀ€ÈÁÁàí½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèäÀÁô(¹‰¥µ¹½Ñ¥”µ±¥ÍÑí‘¥ÍÁ±…äéÉ¥í…ÀèåÁáô(¹‰¥µ¹½Ñ¥”µÉ½İí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÄÄÁÁàµ¥¹µ…à ÈØÁÁà°Å™È¤€ÄÔÁÁà€ÄĞÁÁàí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí…ÀèÄÑÁàíÁ…‘‘¥¹œèÄİÁà€ÈÁÁàí‰½É‘•ÈèÅÁàÍ½±¥€‘”Õ˜Àí‰½É‘•ÈµÉ…‘¥ÕÌèÄÕÁàí‰…­É½Õ¹è™™˜í‰½àµÍ¡…‘½ÜèÀ€ÑÁà€ÄÍÁàÉ‰„ ÄÔ°ÈÌ°ĞÈ°¸ÀĞ¥ô(¹‰¥µ¹½Ñ¥”µÍ½ÕÉ•í‘¥ÍÁ±…äéÉ¥í©ÕÍÑ¥™äµ¥Ñ•µÌéÍÑ…ÉĞí…ÀèÕÁáô¹‰¥µ¹½Ñ¥”µÍ½ÕÉ”‰íÁ…‘‘¥¹œèÕÁà€áÁàí‰½É‘•ÈµÉ…‘¥ÕÌèİÁàí‰…­É½Õ¹è”á˜É™˜í½±½ÈèŒÅÑ•àí™½¹ĞµÍ¥é”èÄÅÁáô¹‰¥µ¹½Ñ¥”µÍ½ÕÉ”ÍÁ…¹í½±½ÈèŒØĞÜĞáˆí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèàÀÁô(¹‰¥µ¹½Ñ¥”µµ…¥¹í‘¥ÍÁ±…äéÉ¥í…ÀèÙÁàíµ¥¸µİ¥‘Ñ èÁô¹‰¥µ¹½Ñ¥”µµ…¥¸…í½Ù•É™±½Üé¡¥‘‘•¸í½±½ÈèŒÄÜÈÀÌÌí™½¹ĞµÍ¥é”èÄÑÁàí™½¹Ğµİ•¥¡ĞèäÀÀí±¥¹”µ¡•¥¡ĞèÄ¸ĞÔíÑ•áĞµ‘•½É…Ñ¥½¸é¹½¹”íÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô¹‰¥µ¹½Ñ¥”µµ…¥¸„é¡½Ù•Éí½±½ÈèŒÅÑ•àíÑ•áĞµ‘•½É…Ñ¥½¸éÕ¹‘•É±¥¹•ô¹‰¥µ¹½Ñ¥”µµ…¥¸ÍÁ…¹í½Ù•É™±½Üé¡¥‘‘•¸í½±½ÈèŒÜÄàÀäØí™½¹ĞµÍ¥é”èÄÅÁàíÑ•áĞµ½Ù•É™±½Üé•±±¥ÁÍ¥Ìíİ¡¥Ñ”µÍÁ…”é¹½İÉ…Áô(¹‰¥µ¹½Ñ¥”µ…µ½Õ¹Ñí½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÍÁàíÑ•áĞµ…±¥¸éÉ¥¡Ñô¹‰¥µ¹½Ñ¥”µ‘•…‘±¥¹•í‘¥ÍÁ±…äéÉ¥í©ÕÍÑ¥™äµ¥Ñ•µÌé•¹í…ÀèÙÁáô¹‰¥µ¹½Ñ¥”µ‘•…‘±¥¹”ÍÁ…¹í½±½ÈèŒÌÌĞÄÔÔí™½¹ĞµÍ¥é”èÄÉÁàí™½¹Ğµİ•¥¡ĞèàÀÁô¹‰¥µ¹½Ñ¥”µ‘•…‘±¥¹”…í½±½ÈèŒÈÔØÍ•ˆí™½¹ĞµÍ¥é”èÄÅÁàí™½¹Ğµİ•¥¡ĞèäÀÀíÑ•áĞµ‘•½É…Ñ¥½¸é¹½¹•ô(¹‰¥µ•µÁÑäµÍÑ…Ñ•í‘¥ÍÁ±…äéÉ¥í©ÕÍÑ¥™äµ¥Ñ•µÌé•¹Ñ•Èí…ÀèáÁàíµ¥¸µ¡•¥¡ĞèÈÜÁÁàíÁ…‘‘¥¹œèĞÉÁà€ÈÑÁàí‰½É‘•ÈèÅÁà‘…Í¡•€‰‘Œåàí‰½É‘•ÈµÉ…‘¥ÕÌèÄáÁàí‰…­É½Õ¹è˜á™…™ŒíÑ•áĞµ…±¥¸é•¹Ñ•Èí½±½ÈèŒØĞÜĞá‰ô(¹‰¥µ•µÁÑäµÍÑ…Ñ”ÍÙí½±½ÈèŒäÑ„Íˆáô¹‰¥µ•µÁÑäµÍÑ…Ñ”ÍÑÉ½¹í½±½ÈèŒÈÜÌØÑ„í™½¹ĞµÍ¥é”èÄİÁáô¹‰¥µ•µÁÑäµÍÑ…Ñ”Áíµ…àµİ¥‘Ñ èÔàÁÁàíµ…É¥¸èÀí±¥¹”µ¡•¥¡ĞèÄ¸Ùô¹‰¥µ•µÁÑäµÍÑ…Ñ”Íµ…±±í½±½ÈèŒàÀäÁ„Õô)µ•‘¥„¡µ…àµİ¥‘Ñ èÜÀÁÁà¥ì(€€¹‰¥µ¹½Ñ¥”µ¡•…‘í…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞíÁ…‘‘¥¹œèÈÁÁàí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¹ô¹‰¥µ¹½Ñ¥”µÍÑ…•íİ¥‘Ñ èÄÀÀ”í‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½áô(€€¹‰¥µ­•åİ½ÉµÁ…¹•°°¹‰¥µÉ…¹”µÁ…¹•±íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹‰¥µ­•åİ½Éµ…Ñ¥½¹ÍíÉ¥µ½±Õµ¸é…ÕÑ¼í…±¥¸µ¥Ñ•µÌéÍÑÉ•Ñ í™±•àµ‘¥É•Ñ¥½¸é½±Õµ¹ô¹‰¥µ­•åİ½Éµ…Ñ¥½¹Ì‰ÕÑÑ½¹íİ¥‘Ñ èÄÀÀ•ô¹‰¥µ‘…Ñ”µ¥¹ÁÕÑÍíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™È…ÕÑ¼€Å™Éô¹‰¥µ™¥±Ñ•Èµ‰…ÉíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™Éô¹‰¥µÍ½ÕÉ”µÑ…‰Íí‘¥ÍÁ±…äéÉ¥íÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌéÉ•Á•…Ğ Ì°Å™È¥ô(€€¹‰¥µÉ•ÍÕ±ĞµÍÕµµ…Éåí…±¥¸µ¥Ñ•µÌé™±•àµÍÑ…ÉĞí™±•àµ‘¥É•Ñ¥½¸é½±Õµ¹ô¹‰¥µ±¥ÍĞµ¡•…‘í‘¥ÍÁ±…äé¹½¹•ô¹‰¥µ¹½Ñ¥”µÉ½İíÉ¥µÑ•µÁ±…Ñ”µ½±Õµ¹ÌèÅ™ÈíÁ…‘‘¥¹œèÄÕÁáô¹‰¥µ¹½Ñ¥”µÍ½ÕÉ•í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Éô¹‰¥µ¹½Ñ¥”µµ…¥¸„°¹‰¥µ¹½Ñ¥”µµ…¥¸ÍÁ…¹í½Ù•É™±½ÜéÙ¥Í¥‰±”íİ¡¥Ñ”µÍÁ…”é¹½Éµ…±ô¹‰¥µ¹½Ñ¥”µ…µ½Õ¹ÑíÑ•áĞµ…±¥¸é±•™Ñô¹‰¥µ¹½Ñ¥”µ‘•…‘±¥¹•í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èí©ÕÍÑ¥™äµ½¹Ñ•¹ĞéÍÁ…”µ‰•Ñİ••¹ô¹‰¥µ•µÁÑäµÍÑ…Ñ•íµ¥¸µ¡•¥¡ĞèÈÌÁÁàíÁ…‘‘¥¹œèÌÑÁà€ÄáÁáô)ô()€ì