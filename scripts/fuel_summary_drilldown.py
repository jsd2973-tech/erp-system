from pathlib import Path
p=Path('src/features/fuel/FuelManagement.tsx')
s=p.read_text()
def rep(old,new,label,count=1):
    global s
    if old not in s: raise SystemExit(f'{label} anchor not found')
    s=s.replace(old,new,count)
rep('  const [view, setView] = useState<ViewMode>("records");\n', '  const [view, setView] = useState<ViewMode>("records");\n  const [detailTarget, setDetailTarget] = useState<{ type: "vehicle" | "site"; name: string } | null>(null);\n', 'detail state')
rep('  const vehicleSummary = useMemo(() => summarize("vehicle_number"), [filtered]);\n  const siteSummary = useMemo(() => summarize("site_name"), [filtered]);\n', '''  const vehicleSummary = useMemo(() => summarize("vehicle_number"), [filtered]);
  const siteSummary = useMemo(() => summarize("site_name"), [filtered]);
  const detailRows = useMemo(() => {
    if (!detailTarget) return [];
    return filtered.filter((record) => detailTarget.type === "vehicle" ? record.vehicle_number === detailTarget.name : record.site_name === detailTarget.name)
      .sort((a, b) => b.fuel_date.localeCompare(a.fuel_date) || natural(a.vehicle_number, b.vehicle_number) || a.product_name.localeCompare(b.product_name, "ko-KR"));
  }, [detailTarget, filtered]);
  const detailTotals = useMemo(() => ({
    count: detailRows.reduce((sum, row) => sum + Math.max(row.usage_count || 1, 1), 0),
    quantity: detailRows.reduce((sum, row) => sum + row.quantity, 0),
    total: detailRows.reduce((sum, row) => sum + row.total_amount, 0),
  }), [detailRows]);
''', 'detail memos')
rep('<button type="button" aria-pressed={view === "records"} onClick={() => setView("records")}>주유내역</button>\n      <button type="button" aria-pressed={view === "vehicle"} onClick={() => setView("vehicle")}>차량·장비별</button>\n      <button type="button" aria-pressed={view === "site"} onClick={() => setView("site")}>현장별</button>', '<button type="button" aria-pressed={view === "records"} onClick={() => { setView("records"); setDetailTarget(null); }}>주유내역</button>\n      <button type="button" aria-pressed={view === "vehicle"} onClick={() => { setView("vehicle"); setDetailTarget(null); }}>차량·장비별</button>\n      <button type="button" aria-pressed={view === "site"} onClick={() => { setView("site"); setDetailTarget(null); }}>현장별</button>', 'tab reset')
old='''    </> : <div className="fuel-summary-list">
      {(view === "vehicle" ? vehicleSummary : siteSummary).length ? (view === "vehicle" ? vehicleSummary : siteSummary).map((row, index) => <article key={row.name}>
        <span className="fuel-rank">{index + 1}</span><div><strong>{row.name}</strong><small>{number(row.quantity)} L · {row.count}회</small></div><b>{money(row.total)}원</b>
      </article>) : <div className="fuel-empty">집계할 내역이 없습니다.</div>}
    </div>}
'''
new='''    </> : <>
      <div className="fuel-summary-list">
        {(view === "vehicle" ? vehicleSummary : siteSummary).length ? (view === "vehicle" ? vehicleSummary : siteSummary).map((row, index) => <article key={row.name} className="fuel-summary-clickable" role="button" tabIndex={0} onClick={() => setDetailTarget({ type: view === "vehicle" ? "vehicle" : "site", name: row.name })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setDetailTarget({ type: view === "vehicle" ? "vehicle" : "site", name: row.name }); }}>
          <span className="fuel-rank">{index + 1}</span><div><strong>{row.name}</strong><small>{number(row.quantity)} L · {row.count}회</small></div><b>{money(row.total)}원</b>
        </article>) : <div className="fuel-empty">집계할 내역이 없습니다.</div>}
      </div>
      {detailTarget && <section className="fuel-drilldown">
        <header><div><span>{detailTarget.type === "vehicle" ? "차량·장비 상세" : "현장 상세"}</span><h3>{detailTarget.name}</h3></div><button type="button" onClick={() => setDetailTarget(null)}>닫기</button></header>
        <div className="fuel-drilldown-kpis"><span>주유 <b>{detailTotals.count}회</b></span><span>수량 <b>{number(detailTotals.quantity)} L</b></span><span>합계 <b>{money(detailTotals.total)}원</b></span></div>
        <div className="fuel-table-wrap"><table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>합계금액</th><th>주유처</th></tr></thead><tbody>{detailRows.map((record) => <tr key={record.id}><td>{record.fuel_date}</td><td>{record.site_name}</td><td>{record.product_name}</td><td className="fuel-strong">{record.vehicle_number}</td><td>{record.usage_count}회</td><td className="fuel-number">{number(record.quantity)} L</td><td className="fuel-number">{money(record.unit_price)}</td><td className="fuel-number fuel-total">{money(record.total_amount)}</td><td>{record.station_name}</td></tr>)}</tbody></table></div>
        <div className="fuel-mobile-list">{detailRows.map((record) => <article key={record.id}><header><div><strong>{record.vehicle_number}</strong><span>{record.site_name} · {record.product_name}</span></div><b>{record.fuel_date}</b></header><div><span>수량 <strong>{number(record.quantity)} L</strong></span><span>단가 <strong>{money(record.unit_price)}원</strong></span><span>횟수 <strong>{record.usage_count}회</strong></span><span>합계 <strong>{money(record.total_amount)}원</strong></span></div><footer><span>{record.station_name}</span></footer></article>)}</div>
      </section>}
    </>}
'''
rep(old,new,'summary render')
p.write_text(s)
css=Path('src/features/fuel/fuelManagement.css')
css.write_text(css.read_text()+'''\n.fuel-summary-clickable{cursor:pointer;transition:.15s ease}.fuel-summary-clickable:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(15,23,42,.08);border-color:#bfdbfe}.fuel-drilldown{margin-top:16px;padding:16px;border:1px solid #dbe5f1;border-radius:14px;background:#fff}.fuel-drilldown>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.fuel-drilldown>header span{font-size:12px;color:#64748b}.fuel-drilldown>header h3{margin:2px 0 0}.fuel-drilldown>header button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:7px 11px;cursor:pointer}.fuel-drilldown-kpis{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.fuel-drilldown-kpis span{padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}.fuel-drilldown-kpis b{margin-left:5px}@media(max-width:720px){.fuel-drilldown{padding:12px}.fuel-drilldown .fuel-table-wrap{display:none}}\n''')