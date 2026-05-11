import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import { createClient } from "@supabase/supabase-js";
import { Save, RotateCcw, Plus, Trash2, Pencil, Upload } from "lucide-react";

type Vendor = { id: string; code: string; name: string; owner?: string; phone?: string; mobile?: string };
type Group = { id: string; code: string; name: string };
type Warehouse = { id: string; code: string; group: string; name: string };
type Item = { id: string; code: string; name: string; spec?: string; unit?: string; price?: number };
type PurchaseRow = { id: string; item: string; spec: string; qty: string | number; price: string | number; supply: number; vat: number; total: number };
type Purchase = { id: string; date: string; vendor: string; warehouse: string; rows: PurchaseRow[]; supplyTotal: number; vatTotal: number; total: number; itemSummary: string };
type MaintItem = { id: string; item: string; spec: string; qty: string | number; price: string | number; supply: number; vat: number; total: number };
type Maint = { id: string; date: string; warehouse: string; manager: string; title: string; detail: string; cost: number | string;
  image_url?: string;
  image_urls?: string[]; items?: MaintItem[]; supplyTotal?: number; vatTotal?: number; total?: number };
type CardUse = { id: string; date: string; user_name: string; place: string; amount: number | string; memo?: string;
  image_url?: string;
  image_urls?: string[]; created_at?: string };


const supabase = createClient(
  "https://jqdvxmatbmmeubtoogvl.supabase.co",
  "sb_publishable_83Pb_nHMoZCduendoRwE5w_uJqiuvH7"
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

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const headers = Object.keys(rows[0] || {});
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / Math.max(headers.length, 1);
  let y = 16;

  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 9;

  doc.setFontSize(8);
  doc.text(`출력일: ${todayText()}`, margin, y);
  y += 8;

  doc.setFontSize(7);
  headers.forEach((h, i) => {
    doc.text(String(h).slice(0, 18), margin + i * colWidth, y);
  });
  y += 6;

  rows.forEach((row) => {
    if (y > 190) {
      doc.addPage();
      y = 14;
    }

    headers.forEach((h, i) => {
      const value = row[h] == null ? "" : String(row[h]);
      doc.text(value.slice(0, 22), margin + i * colWidth, y);
    });

    y += 6;
  });

  doc.save(`${fileName}.pdf`);
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



const UPDATE_NOTICE_VERSION = "2026-05-11-erp-update-02";
const UPDATE_NOTICE_HIDE_KEY = "erp_update_notice_hide_until";

const updateNoticeItems = [
  { date: "2026-05-11", text: "업데이트 안내 팝업 및 오늘 열지 않음 기능 추가" },
  { date: "2026-05-11", text: "생산라인 구성도에서 크라샤 세부창고 정비이력 바로가기 추가" },
  { date: "2026-05-11", text: "구매/카드/정비 PDF 출력 기능 추가" },
  { date: "2026-05-11", text: "정비 사진/PDF 여러 장 업로드 기능 추가" },
  { date: "2026-05-11", text: "정비조회 첨부보기 및 모바일 카드형 조회 개선" },
  { date: "2026-05-10", text: "모바일 하단 메뉴 및 화면 최적화" },
  { date: "2026-05-10", text: "카드사용 수정 및 영수증 첨부 기능 개선" },
];

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getYesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const getRecentUpdateItems = () => {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();

  return updateNoticeItems.filter((item) => item.date === today || item.date === yesterday);
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
  const [showUpdateNotice, setShowUpdateNotice] = useState(() => {
    const hiddenUntil = localStorage.getItem(UPDATE_NOTICE_HIDE_KEY);
    return hiddenUntil !== `${UPDATE_NOTICE_VERSION}:${getTodayKey()}` && getRecentUpdateItems().length > 0;
  });
  const [hideUpdateToday, setHideUpdateToday] = useState(false);
  const recentUpdateItems = getRecentUpdateItems();
  const [mobileSheet, setMobileSheet] = useState<"" | "buy" | "card" | "maint" | "more">("");
  const [purchaseHeader, setPurchaseHeader] = useState({ date: "", vendor: "", warehouse: "" });
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session]);

  const vendorOptions = useMemo(
    () =>
      vendors
        .map((v) => ({ label: `${v.code} / ${v.name}`, value: v.name, code: v.code, name: v.name }))
        .filter((v) => v.name),
    [vendors]
  );
  const warehouseNames = useMemo(() => [...groups.map((g) => g.name), ...warehouses.map((w) => `${w.group} / ${w.name}`)], [groups, warehouses]);
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
    setPurchaseHeader({ date: "", vendor: "", warehouse: "" });
    setRows([emptyRow()]);
    setEditingPurchaseId("");
  };

  const savePurchase = async () => {
    const validRows = rows.filter((r) => r.item && Number(r.qty) > 0);
    if (!purchaseHeader.vendor || !purchaseHeader.warehouse || !validRows.length) return alert("거래처, 창고, 품목/수량을 확인하세요.");
    const payload: Purchase = {
      id: editingPurchaseId || uid(),
      ...purchaseHeader,
      rows: validRows,
      supplyTotal: purchaseSupplyTotal,
      vatTotal: purchaseVatTotal,
      total: purchaseTotal,
      itemSummary: validRows[0].item,
    };
    const { error } = await supabase.from("purchases").upsert(fromPurchase(payload));
    if (error) return alert(`구매 저장 실패: ${error.message}`);
    setPurchases((prev) => (editingPurchaseId ? prev.map((p) => (p.id === editingPurchaseId ? payload : p)) : [payload, ...prev]));
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


  const resetCardForm = () => {
    setCardForm({ date: "", user_name: "", place: "", amount: "", memo: "", image_url: "", image_urls: [] });
    setEditingCardUseId("");
  };

  const saveCardUse = async () => {
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
    if (!isAdmin) return alert("관리자만 삭제할 수 있습니다.");
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
    setPurchaseHeader({ date: p.date || "", vendor: p.vendor || "", warehouse: p.warehouse || "" });
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
    if (!isAdmin) return alert("관리자만 거래처를 등록/수정할 수 있습니다.");
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
    if (!isAdmin) return alert("관리자만 창고를 등록/수정할 수 있습니다.");
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
    if (!isAdmin) return alert("관리자만 창고를 등록/수정할 수 있습니다.");
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
    if (!isAdmin) return alert("관리자만 삭제할 수 있습니다.");
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
    if (!isAdmin) return alert("관리자만 삭제할 수 있습니다.");
    const newWarehouses = reseq(warehouses.filter((w) => w.id !== id));
    const { error } = await supabase.from("warehouses").delete().eq("id", id);
    if (error) return alert(`창고 삭제 실패: ${error.message}`);
    if (newWarehouses.length) await supabase.from("warehouses").upsert(newWarehouses);
    setWarehouses(newWarehouses);
    setWarehouseForm({ group: "", code: nextCode(newWarehouses), name: "" });
  };

  const saveItem = async () => {
    if (!isAdmin) return alert("관리자만 품목을 등록/수정할 수 있습니다.");
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
    resetMaintForm();
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
    if (!isAdmin) return alert("관리자만 삭제할 수 있습니다.");
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) return alert(`구매 삭제 실패: ${error.message}`);
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  };

  const deleteVendor = async (id: string) => {
    if (!isAdmin) return alert("관리자만 삭제할 수 있습니다.");
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
    if (!isAdmin) return alert("관리자만 삭제할 수 있습니다.");
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
    if (!isAdmin) return alert("관리자만 삭제할 수 있습니다.");
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
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);

    const nextPrefs = {
      ...authPrefs,
      autoLogin: false,
      email: authPrefs.saveEmail ? authPrefs.email : "",
    };

    setAuthPrefs(nextPrefs);
    writeAuthPrefs(nextPrefs);
  };

  const closeUpdateNotice = () => {
    if (hideUpdateToday) {
      localStorage.setItem(UPDATE_NOTICE_HIDE_KEY, `${UPDATE_NOTICE_VERSION}:${getTodayKey()}`);
    }
    setShowUpdateNotice(false);
  };

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


        {showUpdateNotice && (
          <div className="update-popup-backdrop">
            <div className="update-popup">
              <div className="update-popup-head">
                <div>
                  <span>UPDATE</span>
                  <h2>ERP 업데이트 안내</h2>
                </div>
                <button onClick={closeUpdateNotice}>×</button>
              </div>

              <ul>
                {recentUpdateItems.map((item) => (
                  <li key={`${item.date}-${item.text}`}>
                    <strong>{item.date}</strong>
                    <span>{item.text}</span>
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

        <nav className="menu">
          <button className={menuTab === "home" ? "active" : ""} onClick={() => setMenuTab("home")}>홈</button>
          <button className={menuTab === "layout" ? "active" : ""} onClick={() => setMenuTab("layout")}>생산라인</button>
          <div className="menu-group"><button>구매</button><div className="sub"><button onMouseDown={() => setMenuTab("new")}>구매입력</button><button onMouseDown={() => setMenuTab("list")}>구매조회</button><button onMouseDown={() => setMenuTab("status")}>구매현황</button></div></div>
          <div className="menu-group"><button>카드</button><div className="sub"><button onMouseDown={() => setMenuTab("card_use")}>카드사용</button><button onMouseDown={() => setMenuTab("card_stats")}>카드사용 통계</button></div></div>
          <div className="menu-group"><button>기초등록</button><div className="sub"><button onMouseDown={() => setMenuTab("vendors")}>거래처등록</button><button onMouseDown={() => setMenuTab("warehouse_groups")}>창고등록</button><button onMouseDown={() => setMenuTab("items")}>품목등록</button></div></div>
          <div className="menu-group"><button>정비</button><div className="sub"><button onMouseDown={() => setMenuTab("maint_new")}>정비등록</button><button onMouseDown={() => setMenuTab("maint_list")}>정비조회</button><button onMouseDown={() => setMenuTab("maint_stats")}>정비통계</button></div></div>
          <div className="user-box"><span>{userEmail}{isAdmin ? " · 관리자" : " · 직원"}</span><button onClick={logout}>로그아웃</button></div>
        </nav>

        {menuTab === "home" && <HomeDashboard purchases={purchases} maints={maints} cardUses={cardUses} />}

        {menuTab === "layout" && <Home setMenuTab={setMenuTab} setMaintSearch={setMaintSearch} warehouses={warehouses} isAdmin={isAdmin} />}

        {menuTab === "new" && (
          <section className="card">
            <h2>{editingPurchaseId ? "구매수정" : "구매입력"}</h2>
            <div className="grid3">
              <Field label="일자">
                <div className="date-combo">
                  <input
                    type="text"
                    placeholder="240107 또는 20240107"
                    value={purchaseHeader.date}
                    onChange={(e) => setPurchaseHeader({ ...purchaseHeader, date: formatInputDate(e.target.value) })}
                  />
                  <input
                    type="date"
                    value={purchaseHeader.date}
                    onChange={(e) => setPurchaseHeader({ ...purchaseHeader, date: e.target.value })}
                  />
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

        {menuTab === "list" && <PurchaseList purchases={filteredPurchases} search={purchaseSearch} setSearch={setPurchaseSearch} editPurchase={editPurchase} deletePurchase={deletePurchase} isAdmin={isAdmin} />}

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
                <input value={cardForm.user_name} onChange={(e) => setCardForm({ ...cardForm, user_name: e.target.value })} placeholder="사용자/담당자" />
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

            <div className="between" style={{marginTop:24}}>
              <h3>카드사용 조회</h3>
              <button onClick={() => downloadExcel(`카드사용_${todayText()}`, withTotalRow(
  filteredCardUses.map((c) => ({ 사용일자: c.date, 담당자: c.user_name, 사용처: c.place, 금액: c.amount, 메모: c.memo || "", 영수증: c.image_url || "" })),
  { 사용일자: "총합계", 금액: filteredCardUses.reduce((sum, c) => sum + Number(c.amount || 0), 0) }
))}>엑셀 다운로드</button><button onClick={() => downloadPdf(`정비조회_${todayText()}`, "정비조회", maints.map((m: Maint) => ({ 일자: m.date, 창고: m.warehouse, 제목: m.title, 내용: m.detail, 합계: m.total || m.cost || 0 })))}>PDF 출력</button><button onClick={() => downloadPdf(`카드사용_${todayText()}`, "카드사용", withTotalRow(filteredCardUses.map((c) => ({ 사용일자: c.date, 담당자: c.user_name, 사용처: c.place, 금액: c.amount, 메모: c.memo || "" })), { 사용일자: "총합계", 금액: filteredCardUses.reduce((sum, c) => sum + Number(c.amount || 0), 0) }))}>PDF 출력</button>
            </div>
            <div className="grid5">
              <Field label="시작일"><input type="date" value={cardSearch.from} onChange={(e) => setCardSearch({ ...cardSearch, from: e.target.value })} /></Field>
              <Field label="종료일"><input type="date" value={cardSearch.to} onChange={(e) => setCardSearch({ ...cardSearch, to: e.target.value })} /></Field>
              <Field label="담당자"><input value={cardSearch.user_name} onChange={(e) => setCardSearch({ ...cardSearch, user_name: e.target.value })} placeholder="담당자 검색" /></Field>
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
                    <div className="mobile-list-top">
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
          <section className="card"><h2>거래처등록</h2><div className="between"><span>{vendorImportMessage || `현재 ${vendors.length}개 거래처 등록됨`}</span><label className="upload"><Upload size={16} /> 거래처 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && importVendors(e.target.files[0])} /></label></div><div className="grid5"><Field label="거래처코드"><input value={vendorForm.code} onChange={(e) => setVendorForm({ ...vendorForm, code: e.target.value })} /></Field><Field label="상호"><input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} /></Field><Field label="대표자"><input value={vendorForm.owner} onChange={(e) => setVendorForm({ ...vendorForm, owner: e.target.value })} /></Field><Field label="전화번호"><input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} /></Field><Field label="모바일"><input value={vendorForm.mobile} onChange={(e) => setVendorForm({ ...vendorForm, mobile: e.target.value })} /></Field></div><div className="actions right-actions">{isAdmin && <button onClick={clearVendors}>전체삭제</button>}{isAdmin && <button className="primary" onClick={saveVendor}>{editingVendorId ? "거래처 수정저장" : "거래처 저장"}</button>}</div><SimpleVendorTable vendors={vendors} deleteVendor={deleteVendor} editVendor={editVendor} isAdmin={isAdmin} /></section>
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
              <Field label="담당자">
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

        {menuTab === "maint_list" && <MaintList maints={filteredMaints} search={{ ...maintSearch, warehouseNames }} setSearch={setMaintSearch} editMaint={editMaint} deleteMaint={deleteMaint} setMenuTab={setMenuTab} isAdmin={isAdmin} />}

        {menuTab === "maint_stats" && <MaintenanceStats maints={maints} />}

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
        <div className="mobile-more-sheet" style={{ display: mobileSheet ? "grid" : "none" }}>
          {mobileSheet === "buy" && (
            <>
              <button onClick={() => { setMenuTab("new"); setMobileSheet(""); }}>구매입력</button>
              <button onClick={() => { setMenuTab("list"); setMobileSheet(""); }}>구매조회</button>
              <button onClick={() => { setMenuTab("status"); setMobileSheet(""); }}>구매현황</button>
            </>
          )}

          {mobileSheet === "card" && (
            <>
              <button onClick={() => { setMenuTab("card_use"); setMobileSheet(""); }}>카드사용</button>
              <button onClick={() => { setMenuTab("card_stats"); setMobileSheet(""); }}>카드통계</button>
            </>
          )}

          {mobileSheet === "maint" && (
            <>
              <button onClick={() => { setMenuTab("maint_new"); setMobileSheet(""); }}>정비등록</button>
              <button onClick={() => { setMenuTab("maint_list"); setMobileSheet(""); }}>정비조회</button>
              <button onClick={() => { setMenuTab("maint_stats"); setMobileSheet(""); }}>정비통계</button>
            </>
          )}

          {mobileSheet === "more" && (
            <>
              <button onClick={() => { setMenuTab("layout"); setMobileSheet(""); }}>생산라인</button>
              <button onClick={() => { setMenuTab("vendors"); setMobileSheet(""); }}>거래처등록</button>
              <button onClick={() => { setMenuTab("warehouse_groups"); setMobileSheet(""); }}>창고등록</button>
              <button onClick={() => { setMenuTab("items"); setMobileSheet(""); }}>품목등록</button>
            </>
          )}
        </div>

        <div className="mobile-bottom-nav">
          <button className={menuTab === "home" ? "active" : ""} onClick={() => { setMenuTab("home"); setMobileSheet(""); }}>홈</button>
          <button className={mobileSheet === "buy" || ["new", "list", "status"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "buy" ? "" : "buy")}>구매</button>
          <button className={mobileSheet === "card" || ["card_use", "card_stats"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "card" ? "" : "card")}>카드</button>
          <button className={mobileSheet === "maint" || ["maint_new", "maint_list", "maint_stats"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "maint" ? "" : "maint")}>정비</button>
          <button className={mobileSheet === "more" || ["layout", "vendors", "warehouse_groups", "items"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet((v) => v === "more" ? "" : "more")}>더보기</button>
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

function PurchaseList({ purchases, search, setSearch, editPurchase, deletePurchase, isAdmin }: any) {
  return <section className="card"><div className="between"><h2>구매조회</h2><button onClick={() => downloadExcel(`구매조회_${todayText()}`, withTotalRow(
  purchases.map((p: Purchase) => ({ 일자: p.date, 거래처: p.vendor, 창고: p.warehouse, 대표품목: p.itemSummary, 공급가액: p.supplyTotal, 부가세액: p.vatTotal, 합계: p.total })),
  { 일자: "총합계", 공급가액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.supplyTotal || 0), 0), 부가세액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.vatTotal || 0), 0), 합계: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.total || 0), 0) }
))}>엑셀 다운로드</button><button onClick={() => downloadPdf(`구매조회_${todayText()}`, "구매조회", withTotalRow(purchases.map((p: Purchase) => ({ 일자: p.date, 거래처: p.vendor, 창고: p.warehouse, 대표품목: p.itemSummary, 공급가액: p.supplyTotal, 부가세액: p.vatTotal, 합계: p.total })), { 일자: "총합계", 공급가액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.supplyTotal || 0), 0), 부가세액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.vatTotal || 0), 0), 합계: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.total || 0), 0) }))}>PDF 출력</button></div><div className="grid5"><input placeholder="시작일 240107 또는 20240107" value={search.from} onChange={(e) => setSearch({ ...search, from: formatInputDate(e.target.value) })} /><input placeholder="종료일 240107 또는 20240107" value={search.to} onChange={(e) => setSearch({ ...search, to: formatInputDate(e.target.value) })} /><input placeholder="거래처 검색" value={search.vendor} onChange={(e) => setSearch({ ...search, vendor: e.target.value })} /><input placeholder="창고 검색" value={search.warehouse} onChange={(e) => setSearch({ ...search, warehouse: e.target.value })} /><input placeholder="품목 검색" value={search.item} onChange={(e) => setSearch({ ...search, item: e.target.value })} /></div><ScrollTable><table><thead><tr><th>관리번호</th><th>거래처</th><th>창고</th><th>품목</th><th>합계</th><th>관리</th></tr></thead><tbody>{!purchases.length ? <tr><td colSpan={6} className="empty">저장된 구매내역 없음</td></tr> : purchases.map((p: Purchase, index: number) => {
  const sameDateBeforeCount = purchases.slice(0, index).filter((x: Purchase) => x.date === p.date).length;
  const seq = sameDateBeforeCount + 1;
  return <tr key={p.id}><td>{`${p.date || ""}-${String(seq).padStart(2, "0")}`}</td><td>{p.vendor}</td><td>{p.warehouse}</td><td>{p.itemSummary}</td><td>{money(p.total)}</td><td>{isAdmin ? <><button className="icon" onClick={() => editPurchase(p)}><Pencil size={16} /></button><button className="icon" onClick={() => deletePurchase(p.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>})}</tbody></table></ScrollTable></section>;
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
          <tbody>{!filtered.length ? <tr><td colSpan={8} className="empty">조회된 구매내역 없음</td></tr> : filtered.map((p) => <tr key={p.id}><td>{p.date}</td><td>{p.vendor}</td><td>{p.warehouse}</td><td>{p.itemSummary}</td><td className="right">{money((p.rows || []).reduce((sum, r) => sum + Number(r.qty || 0), 0))}</td><td className="right">{money(p.supplyTotal)}</td><td className="right">{money(p.vatTotal)}</td><td className="right bold">{money(p.total)}</td></tr>)}</tbody>
        </table>
      </ScrollTable>
    </section>
  );
}

function MaintList({ maints, search, setSearch, editMaint, deleteMaint, setMenuTab, isAdmin }: any) {
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
    <section className="card">
      <div className="between" style={{marginBottom:16}}>
        <h2 style={{margin:0}}>정비조회</h2>
        <div style={{display:"flex", gap:8}}>
          <button onClick={() => downloadExcel(`정비조회_${todayText()}`, withTotalRow(
            maints.map((m: Maint) => {
              const supply = Number(m.supplyTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.supply || 0), 0));
              const vat = Number(m.vatTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.vat || 0), 0));
              const total = Number(m.total || m.cost || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0));
              return { 관리번호: maintNoMap.get(m.id) || "", 일자: m.date, 창고: m.warehouse, 제목: m.title, 내용: m.detail, 담당자: m.manager, 공급가액: supply, 부가세: vat, 합계: total };
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
        <Field label="제목/내용/담당자">
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
              <tr><td colSpan={9} className="empty">저장된 정비내역 없음</td></tr>
            ) : (
              maints.map((m: Maint) => {
                const supply = Number(m.supplyTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.supply || 0), 0));
                const vat = Number(m.vatTotal || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.vat || 0), 0));
                const total = Number(m.total || m.cost || (m.items || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0));
                return (
                  <tr key={m.id}>
                    <td>{maintNoMap.get(m.id) || "-"}</td>
                    <td>{m.warehouse}</td>
                    <td><button className="link-btn" onClick={() => setSelected(m)}>{m.title}</button></td>
                    <td><span className="maint-detail-text">{m.detail || "-"}</span></td>
                    <td className="right">{money(supply)}</td>
                    <td className="right">{money(vat)}</td>
                    <td className="right bold">{money(total)}</td>
                    <td>
                      {m.image_url ? (
                        <a
                          href={m.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="file-view-btn"
                        >
                          첨부보기
                        </a>
                      ) : "-"}
                    </td>
                    <td>
                      {isAdmin ? <>
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
            <p><b>관리번호:</b> {maintNoMap.get(selected.id) || "-"} / <b>일자:</b> {selected.date} / <b>창고:</b> {selected.warehouse} / <b>담당자:</b> {selected.manager || "-"}</p>
            <p><b>내용:</b> {selected.detail || "-"}</p>
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
          </button>
        ))}
      </div>
    </section>
  );
}

function HomeDashboard({ purchases, maints, cardUses }: { purchases: Purchase[]; maints: Maint[]; cardUses: CardUse[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthKey = today.slice(0, 7);

  const todayPurchaseTotal = purchases.filter((p) => p.date === today).reduce((sum, p) => sum + Number(p.total || 0), 0);
  const monthPurchaseTotal = purchases.filter((p) => (p.date || "").startsWith(monthKey)).reduce((sum, p) => sum + Number(p.total || 0), 0);
  const monthCardTotal = cardUses.filter((c) => (c.date || "").startsWith(monthKey)).reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const monthMaintTotal = maints.filter((m) => (m.date || "").startsWith(monthKey)).reduce((sum, m) => sum + Number(m.total || m.cost || 0), 0);

  const recentMaints = [...maints].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,5);
  const recentCards = [...cardUses].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,5);

  const vendorMap = new Map<string, number>();
  purchases.forEach((p)=>vendorMap.set(p.vendor || "-", (vendorMap.get(p.vendor || "-") || 0) + Number(p.total || 0)));
  const topVendors = Array.from(vendorMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const itemMap = new Map<string, number>();
  purchases.forEach((p)=> (p.rows || []).forEach((r)=> itemMap.set(r.item || "-", (itemMap.get(r.item || "-") || 0) + Number(r.qty || 0))));
  const topItems = Array.from(itemMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);


  return (
    <section className="dashboard-wrap">
      <div className="dashboard-grid">
        <div className="dashboard-card"><span>오늘 구매금액</span><b>{money(todayPurchaseTotal)}원</b></div>
        <div className="dashboard-card"><span>이번달 구매금액</span><b>{money(monthPurchaseTotal)}원</b></div>
        <div className="dashboard-card"><span>이번달 카드사용</span><b>{money(monthCardTotal)}원</b></div>
        <div className="dashboard-card"><span>이번달 정비금액</span><b>{money(monthMaintTotal)}원</b></div>
      </div>

      <div className="dashboard-two">
        <div className="dashboard-panel">
          <h3>최근 정비내역</h3>
          <table className="dashboard-table">
            <thead><tr><th>일자</th><th>제목</th><th>창고</th></tr></thead>
            <tbody>{recentMaints.map((m)=><tr key={m.id}><td>{m.date}</td><td>{m.title}</td><td>{m.warehouse}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="dashboard-panel">
          <h3>최근 카드사용</h3>
          <table className="dashboard-table">
            <thead><tr><th>일자</th><th>사용처</th><th>금액</th></tr></thead>
            <tbody>{recentCards.map((c)=><tr key={c.id}><td>{c.date}</td><td>{c.place}</td><td className="right">{money(c.amount)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-two">
        <div className="dashboard-panel">
          <h3>거래처 TOP5</h3>
          <table className="dashboard-table">
            <thead><tr><th>거래처</th><th>금액</th></tr></thead>
            <tbody>{topVendors.map(([n,a])=><tr key={n}><td>{n}</td><td className="right">{money(a)}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="dashboard-panel">
          <h3>품목 TOP5</h3>
          <table className="dashboard-table">
            <thead><tr><th>품목</th><th>수량</th></tr></thead>
            <tbody>{topItems.map(([n,q])=><tr key={n}><td>{n}</td><td className="right">{money(q)}</td></tr>)}</tbody>
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
          <thead><tr><th>순위</th><th>담당자</th><th>건수</th><th>합계</th></tr></thead>
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
  filtered.map((m) => ({ 일자: m.date, 창고: m.warehouse, 제목: m.title, 내용: m.detail, 담당자: m.manager, 공급가액: getSupply(m), 부가세: getVat(m), 합계: getTotal(m) })),
  { 일자: "총합계", 공급가액: filtered.reduce((sum, m) => sum + getSupply(m), 0), 부가세: filtered.reduce((sum, m) => sum + getVat(m), 0), 합계: filtered.reduce((sum, m) => sum + getTotal(m), 0) }
))}>엑셀 다운로드</button></div>

      <div className="grid5">
        <Field label="시작일"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="종료일"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="창고"><input placeholder="창고 일부 검색" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} /></Field>
        <Field label="제목/내용/담당자"><input placeholder="검색어 입력" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></Field>
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

const css = `
*{box-sizing:border-box}
html,body,#root{width:100%;min-height:100%;margin:0;padding:0}
body{font-family:Arial,'Malgun Gothic',sans-serif;background:#0f172a;color:#0f172a;overflow-x:hidden}
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
  border:2px solid rgba(245,158,11,.72);
  background:rgba(245,158,11,.17);
  color:#111827;
  border-radius:10px;
  cursor:pointer;
  padding:0;
  transition:.15s ease;
  touch-action:none;
  user-select:none;
}

.layout-hotspot span{
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
  background:rgba(245,158,11,.28);
  box-shadow:0 0 0 4px rgba(245,158,11,.12);
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

`;