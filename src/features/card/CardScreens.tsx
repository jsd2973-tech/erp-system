import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { CardSearch, CardUse } from "./cardTypes";
import type { CardModuleUi } from "./cardUiTypes";

export type CardListModel = {
  filteredCardUses: CardUse[];
  search: CardSearch;
  setSearch: Dispatch<SetStateAction<CardSearch>>;
  isAdmin: boolean;
  onEdit: (cardUse: CardUse) => void;
  onDelete: (id: string) => void | Promise<void>;
};

export function CardList({ model, ui }: { model: CardListModel; ui: CardModuleUi }) {
  const { Field, DateInput, AttachmentGroup, ScrollTable, money, downloadExcel, downloadPdf, todayText, withTotalRow } = ui;
  const { filteredCardUses, search, setSearch, isAdmin, onEdit, onDelete } = model;

  return (
    <section className="card lookup-page card-lookup-page">
      <div className="between">
        <h2>카드조회</h2>
        <button onClick={() => downloadExcel(`카드사용_${todayText()}`, withTotalRow(
          filteredCardUses.map((cardUse) => ({ 사용일자: cardUse.date, 담당자: cardUse.user_name, 사용처: cardUse.place, 금액: cardUse.amount, 메모: cardUse.memo || "", 영수증: cardUse.image_url || "" })),
          { 사용일자: "총합계", 금액: filteredCardUses.reduce((sum, cardUse) => sum + Number(cardUse.amount || 0), 0) },
        ))}>엑셀 다운로드</button>
        <button onClick={() => downloadPdf(`카드사용_${todayText()}`, "카드사용", withTotalRow(
          filteredCardUses.map((cardUse) => ({ 사용일자: cardUse.date, 작업자: cardUse.user_name, 사용처: cardUse.place, 금액: cardUse.amount, 메모: cardUse.memo || "" })),
          { 사용일자: "총합계", 금액: filteredCardUses.reduce((sum, cardUse) => sum + Number(cardUse.amount || 0), 0) },
        ))}>PDF 출력</button>
      </div>
      <div className="grid5">
        <Field label="시작일"><DateInput value={search.from} onChange={(value) => setSearch({ ...search, from: value })} /></Field>
        <Field label="종료일"><DateInput value={search.to} onChange={(value) => setSearch({ ...search, to: value })} /></Field>
        <Field label="담당자"><input value={search.user_name} onChange={(event) => setSearch({ ...search, user_name: event.target.value })} placeholder="작업자 검색" /></Field>
        <Field label="사용처"><input value={search.place} onChange={(event) => setSearch({ ...search, place: event.target.value })} placeholder="사용처 검색" /></Field>
        <Field label="초기화"><button onClick={() => setSearch({ from: "", to: "", user_name: "", place: "" })}>검색 초기화</button></Field>
      </div>

      <div className="status-cards">
        <div><span>카드사용 건수</span><b>{filteredCardUses.length}건</b></div>
        <div><span>카드사용 합계</span><b>{money(filteredCardUses.reduce((sum, cardUse) => sum + Number(cardUse.amount || 0), 0))}원</b></div>
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
              filteredCardUses.map((cardUse) => {
                return (
                  <tr key={cardUse.id}>
                    <td>{cardUse.managementNo || "-"}</td>
                    <td>{cardUse.user_name || "-"}</td>
                    <td>{cardUse.place}</td>
                    <td className="right bold">{money(cardUse.amount)}</td>
                    <td>{cardUse.memo || "-"}</td>
                    <td><AttachmentGroup urls={cardUse.image_urls || (cardUse.image_url ? [cardUse.image_url] : [])} /></td>
                    <td>{isAdmin ? <><button className="icon" onClick={() => onEdit(cardUse)}><Pencil size={16} /></button><button className="icon" onClick={() => onDelete(cardUse.id)}><Trash2 size={16} /></button></> : "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollTable>
      <div className="mobile-card-list mobile-card-list-carduses">
        {filteredCardUses.map((cardUse) => {
          return (
            <div className="mobile-list-card" key={cardUse.id}>
              <div className="mobile-list-top mobile-maint-card-top">
                <b>{cardUse.managementNo || "-"}</b>
                <span>{money(cardUse.amount)}원</span>
              </div>
              <div className="mobile-list-body">
                <div><label>사용처</label><p>{cardUse.place}</p></div>
                <div><label>담당자</label><p>{cardUse.user_name || "-"}</p></div>
                <div><label>메모</label><p>{cardUse.memo || "-"}</p></div>
              </div>
              <div className="mobile-list-attachment">
                <AttachmentGroup urls={cardUse.image_urls || (cardUse.image_url ? [cardUse.image_url] : [])} />
              </div>
              <div className="mobile-card-actions">
                {isAdmin ? <><button onClick={() => onEdit(cardUse)}>수정</button><button onClick={() => onDelete(cardUse.id)}>삭제</button></> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CardUseStats({ cardUses, ui }: { cardUses: CardUse[]; ui: CardModuleUi }) {
  const { Field, DateInput, AttachmentGroup, ScrollTable, money, downloadExcel, todayText, withTotalRow } = ui;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userName, setUserName] = useState("");
  const [place, setPlace] = useState("");

  const filtered = useMemo(() => {
    return cardUses.filter((cardUse) => {
      const date = cardUse.date || "";
      const okFrom = !from || date >= from;
      const okTo = !to || date <= to;
      const okUser = !userName || (cardUse.user_name || "").includes(userName);
      const okPlace = !place || (cardUse.place || "").includes(place);
      return okFrom && okTo && okUser && okPlace;
    });
  }, [cardUses, from, to, userName, place]);

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, cardUse) => sum + Number(cardUse.amount || 0), 0);
    const byUser = new Map<string, number>();
    const byPlace = new Map<string, number>();

    filtered.forEach((cardUse) => {
      const user = cardUse.user_name || "미지정";
      const usedPlace = cardUse.place || "미지정";
      byUser.set(user, (byUser.get(user) || 0) + Number(cardUse.amount || 0));
      byPlace.set(usedPlace, (byPlace.get(usedPlace) || 0) + Number(cardUse.amount || 0));
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
    filtered.forEach((cardUse) => {
      const month = (cardUse.date || "미지정").slice(0, 7) || "미지정";
      const current = map.get(month) || { month, count: 0, total: 0 };
      current.count += 1;
      current.total += Number(cardUse.amount || 0);
      map.set(month, current);
    });
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [filtered]);

  const byUser = useMemo(() => {
    const map = new Map<string, { user_name: string; count: number; total: number }>();
    filtered.forEach((cardUse) => {
      const name = cardUse.user_name || "미지정";
      const current = map.get(name) || { user_name: name, count: 0, total: 0 };
      current.count += 1;
      current.total += Number(cardUse.amount || 0);
      map.set(name, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const byPlace = useMemo(() => {
    const map = new Map<string, { place: string; count: number; total: number }>();
    filtered.forEach((cardUse) => {
      const name = cardUse.place || "미지정";
      const current = map.get(name) || { place: name, count: 0, total: 0 };
      current.count += 1;
      current.total += Number(cardUse.amount || 0);
      map.set(name, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 30);
  }, [filtered]);

  const recent = useMemo(() => [...filtered]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 20), [filtered]);

  return (
    <section className="card">
      <div className="between"><h2>카드통계</h2><button onClick={() => downloadExcel(`카드통계_${todayText()}`, withTotalRow(
        filtered.map((cardUse) => ({ 사용일자: cardUse.date, 담당자: cardUse.user_name, 사용처: cardUse.place, 금액: cardUse.amount, 메모: cardUse.memo || "", 영수증: cardUse.image_url || "" })),
        { 사용일자: "총합계", 금액: filtered.reduce((sum, cardUse) => sum + Number(cardUse.amount || 0), 0) },
      ))}>엑셀 다운로드</button></div>

      <div className="grid5">
        <Field label="시작일"><DateInput value={from} onChange={setFrom} /></Field>
        <Field label="종료일"><DateInput value={to} onChange={setTo} /></Field>
        <Field label="담당자"><input placeholder="담당자 검색" value={userName} onChange={(event) => setUserName(event.target.value)} /></Field>
        <Field label="사용처"><input placeholder="사용처 검색" value={place} onChange={(event) => setPlace(event.target.value)} /></Field>
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
      <ScrollTable><table className="erp-stats-monthly">
        <thead><tr><th>월</th><th>건수</th><th>합계</th></tr></thead>
        <tbody>{!byMonth.length ? <tr><td colSpan={3} className="empty">조회된 월별 카드사용 없음</td></tr> : byMonth.map((month) => (
          <tr key={month.month}><td>{month.month}</td><td>{month.count}</td><td className="right bold">{money(month.total)}</td></tr>
        ))}</tbody>
      </table></ScrollTable>

      <h3>담당자별 카드사용</h3>
      <ScrollTable><table className="erp-stats-ranking">
        <thead><tr><th>순위</th><th>작업자</th><th>건수</th><th>합계</th></tr></thead>
        <tbody>{!byUser.length ? <tr><td colSpan={4} className="empty">조회된 담당자별 카드사용 없음</td></tr> : byUser.map((user, index) => (
          <tr key={user.user_name}><td>{index + 1}</td><td>{user.user_name}</td><td>{user.count}</td><td className="right bold">{money(user.total)}</td></tr>
        ))}</tbody>
      </table></ScrollTable>

      <h3>사용처별 카드사용 TOP 30</h3>
      <ScrollTable><table className="erp-stats-ranking">
        <thead><tr><th>순위</th><th>사용처</th><th>건수</th><th>합계</th></tr></thead>
        <tbody>{!byPlace.length ? <tr><td colSpan={4} className="empty">조회된 사용처별 카드사용 없음</td></tr> : byPlace.map((usedPlace, index) => (
          <tr key={usedPlace.place}><td>{index + 1}</td><td>{usedPlace.place}</td><td>{usedPlace.count}</td><td className="right bold">{money(usedPlace.total)}</td></tr>
        ))}</tbody>
      </table></ScrollTable>

      <h3>최근 카드사용 내역</h3>
      <ScrollTable><table className="erp-card-recent">
        <thead><tr><th>일자</th><th>담당자</th><th>사용처</th><th>금액</th><th>영수증</th></tr></thead>
        <tbody>{!recent.length ? <tr><td colSpan={5} className="empty">최근 카드사용 없음</td></tr> : recent.map((cardUse) => (
          <tr key={cardUse.id}>
            <td>{cardUse.date || "-"}</td>
            <td>{cardUse.user_name || "-"}</td>
            <td>{cardUse.place || "-"}</td>
            <td className="right bold">{money(cardUse.amount)}</td>
            <td><AttachmentGroup urls={cardUse.image_urls || (cardUse.image_url ? [cardUse.image_url] : [])} /></td>
          </tr>
        ))}</tbody>
      </table></ScrollTable>
    </section>
  );
}
