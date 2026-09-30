import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { PurchaseEntryUi } from "../purchase/PurchaseEntry";
import type { MaintenancePurchaseLink, Purchase } from "../purchase/purchaseTypes";
import { getMaintenanceCost } from "./maintenanceModel";
import type { Maint, MaintenanceSearch } from "./maintenanceTypes";
import { MaintenanceDetail } from "./MaintenanceDetail";

type MaintenanceExportRow = Record<string, unknown>;
export type MaintenanceScreensUi = Pick<
  PurchaseEntryUi,
  "Field" | "DateInput" | "SearchSelect" | "AttachmentGroup" | "ScrollTable" | "money"
> & {
  downloadExcel: (fileName: string, rows: MaintenanceExportRow[]) => void;
  todayText: () => string;
  withTotalRow: (rows: MaintenanceExportRow[], totalRow: MaintenanceExportRow) => MaintenanceExportRow[];
};

export type MaintenanceListModel = {
  maints: Maint[];
  purchases: Purchase[];
  maintenancePurchaseLinks: MaintenancePurchaseLink[];
  search: MaintenanceSearch & { warehouseNames: string[] };
  setSearch: Dispatch<SetStateAction<MaintenanceSearch>>;
  editMaint: (record: Maint) => void;
  deleteMaint: (id: string) => void | Promise<void>;
  setMenuTab: (tab: string) => void;
  isAdmin: boolean;
  onLinkPhoto: (record: Maint) => void;
};

export function MaintenanceList({ model, ui }: { model: MaintenanceListModel; ui: MaintenanceScreensUi }) {
  const {
    maints, purchases, maintenancePurchaseLinks, search, setSearch,
    editMaint, deleteMaint, setMenuTab, isAdmin, onLinkPhoto,
  } = model;
  const { Field, DateInput, SearchSelect, AttachmentGroup, ScrollTable, money, downloadExcel, todayText, withTotalRow } = ui;
  const [selected, setSelected] = useState<Maint | null>(null);

  return (
    <section className="card lookup-page maint-lookup-page">
      <div className="between" style={{marginBottom:16}}>
        <h2 style={{margin:0}}>정비조회</h2>
        <div style={{display:"flex", gap:8}}>
          <button onClick={() => downloadExcel(`정비조회_${todayText()}`, withTotalRow(
            maints.map((m: Maint) => {
              const supply = getMaintenanceCost(m, "supplyTotal");
              const vat = getMaintenanceCost(m, "vatTotal");
              const total = getMaintenanceCost(m, "total");
              return { 관리번호: m.managementNo || "", 일자: m.date, 창고: m.warehouse, 제목: m.title, 내용: m.detail, 작업자: m.manager, 공급가액: supply, 부가세: vat, 합계: total };
            }),
            {
              관리번호: "총합계",
              공급가액: maints.reduce((sum, m) => sum + getMaintenanceCost(m, "supplyTotal"), 0),
              부가세: maints.reduce((sum, m) => sum + getMaintenanceCost(m, "vatTotal"), 0),
              합계: maints.reduce((sum, m) => sum + getMaintenanceCost(m, "total"), 0)
            }
          ))}>엑셀 다운로드</button>
          <button className="primary" onClick={() => setMenuTab("maint_new")}>
            <Plus size={16} /> 정비등록
          </button>
        </div>
      </div>

      <div className="maint-filter">
        <Field label="시작일">
          <DateInput value={search.from || ""} onChange={(value) => setSearch({ ...search, from: value })} />
        </Field>
        <Field label="종료일">
          <DateInput value={search.to || ""} onChange={(value) => setSearch({ ...search, to: value })} />
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
        <table className="maint-lookup-table">
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
              <th>구매연결</th>
              <th>첨부</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {!maints.length ? (
              <tr><td colSpan={11} className="empty">저장된 정비내역 없음</td></tr>
            ) : (
              maints.map((m: Maint) => {
                const supply = getMaintenanceCost(m, "supplyTotal");
                const vat = getMaintenanceCost(m, "vatTotal");
                const total = getMaintenanceCost(m, "total");
                const links = maintenancePurchaseLinks.filter((link: MaintenancePurchaseLink) => link.maintenance_id === m.id);
                return (
                  <tr key={m.id}>
                    <td>{m.managementNo || "-"}</td>
                    <td>{m.warehouse}</td>
                    <td>{m.manager || "-"}</td>
                    <td><button className="link-btn" onClick={() => setSelected(m)}>{m.title}</button></td>
                    <td><span className="maint-detail-text">{m.detail || "-"}</span></td>
                    <td className="right">{money(supply)}</td>
                    <td className="right">{money(vat)}</td>
                    <td className="right bold">{money(total)}</td>
                    <td>{links.length ? <span className="maintenance-link-badge">연결됨</span> : "-"}</td>
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
        {maints.map((m: Maint) => {
          const supply = getMaintenanceCost(m, "supplyTotal");
          const vat = getMaintenanceCost(m, "vatTotal");
          const total = getMaintenanceCost(m, "total");
          const links = maintenancePurchaseLinks.filter((link: MaintenancePurchaseLink) => link.maintenance_id === m.id);
          return (
            <div className="mobile-list-card" key={m.id}>
              <div className="mobile-list-top">
                <b>{m.managementNo || "-"}</b>
                <span>{money(total)}원</span>
              </div>

              <div className="mobile-list-body">
                <div><label>창고</label><p>{m.warehouse}</p></div>
                <div><label>작업자</label><p>{m.manager || "-"}</p></div>
                <div><label>제목</label><p>{m.title}</p></div>
                <div><label>내용</label><p>{m.detail || "-"}</p></div>
                <div><label>공급가액 / 부가세</label><p>{money(supply)}원 / {money(vat)}원</p></div>
                <div><label>구매연결</label><p>{links.length ? "연결됨" : "없음"}</p></div>
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
        <MaintenanceDetail
          record={selected}
          maintenanceNumber={selected.managementNo || "-"}
          purchases={purchases}
          links={maintenancePurchaseLinks}
          canEdit={isAdmin}
          onClose={() => setSelected(null)}
          onEdit={(record) => {
            setSelected(null);
            editMaint(record);
          }}
          ui={{ AttachmentGroup, ScrollTable, money }}
        />
      )}
    </section>
  );
}







export function MaintenanceStats({ maints, ui }: { maints: Maint[]; ui: MaintenanceScreensUi }) {
  const { Field, DateInput, ScrollTable, money, downloadExcel, todayText, withTotalRow } = ui;
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

  const getSupply = (m: Maint) => getMaintenanceCost(m, "supplyTotal");
  const getVat = (m: Maint) => getMaintenanceCost(m, "vatTotal");
  const getTotal = (m: Maint) => getMaintenanceCost(m, "total");

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
      (m.items || []).forEach((r) => {
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
        <Field label="시작일"><DateInput value={from} onChange={setFrom} /></Field>
        <Field label="종료일"><DateInput value={to} onChange={setTo} /></Field>
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
        <table className="erp-maint-warehouses">
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
        <table className="erp-stats-monthly">
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
        <table className="erp-maint-items">
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
        <table className="erp-maint-recent">
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
