from pathlib import Path
p=Path('src/features/fuel/FuelManagement.tsx')
s=p.read_text()
def rep(old,new,label,count=1):
    global s
    if old not in s: raise SystemExit(f'{label} anchor not found')
    s=s.replace(old,new,count)
rep('type ViewMode = "records" | "vehicle" | "site";','type ViewMode = "records" | "vehicle" | "site" | "station";','view type')
rep('  const [detailTarget, setDetailTarget] = useState<{ type: "vehicle" | "site"; name: string } | null>(null);','  const [detailTarget, setDetailTarget] = useState<{ type: "vehicle" | "site" | "station"; name: string } | null>(null);','detail type')
rep('  const summarize = (key: "vehicle_number" | "site_name") => {','  const summarize = (key: "vehicle_number" | "site_name" | "station_name") => {','summarize type')
rep('  const vehicleSummary = useMemo(() => summarize("vehicle_number"), [filtered]);\n  const siteSummary = useMemo(() => summarize("site_name"), [filtered]);','  const vehicleSummary = useMemo(() => summarize("vehicle_number"), [filtered]);\n  const siteSummary = useMemo(() => summarize("site_name"), [filtered]);\n  const stationSummary = useMemo(() => summarize("station_name"), [filtered]);','station summary')
rep('    return filtered.filter((record) => detailTarget.type === "vehicle" ? record.vehicle_number === detailTarget.name : record.site_name === detailTarget.name)','    return filtered.filter((record) => detailTarget.type === "vehicle" ? record.vehicle_number === detailTarget.name : detailTarget.type === "site" ? record.site_name === detailTarget.name : record.station_name === detailTarget.name)','detail filter')
rep('  const allProducts = useMemo(() => [...new Set(referenceRecords.map((record) => String(record.product_name || "")).filter(Boolean))].sort(natural), [referenceRecords]);','  const allProducts = useMemo(() => [...new Set(referenceRecords.map((record) => String(record.product_name || "")).filter(Boolean))].sort(natural), [referenceRecords]);\n  const allStations = useMemo(() => [...new Set(["남세종농협주유소", "믿음주유소", ...referenceRecords.map((record) => String(record.station_name || "")).filter(Boolean)])].sort(natural), [referenceRecords]);','station options')
old='''  const exportStatementExcel = () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const ordered=[...filtered].sort((a,b)=>natural(a.site_name,b.site_name)||natural(a.product_name,b.product_name)||natural(a.vehicle_number,b.vehicle_number)||a.fuel_date.localeCompare(b.fuel_date));
    const header=["현장명","제품명/규격","차량번호","일자","횟수","수량","단가(원/대)","단가(원/단위)","공급가액","부가세","합계금액"];
    const body=ordered.map((record)=>[record.site_name,record.product_name,record.vehicle_number,record.fuel_date,record.usage_count,record.quantity,record.line_amount,record.unit_price,record.supply_amount,record.vat_amount,record.total_amount]);
    const sums=ordered.reduce((acc,record)=>({count:acc.count+record.usage_count,qty:acc.qty+record.quantity,supply:acc.supply+record.supply_amount,vat:acc.vat+record.vat_amount,total:acc.total+record.total_amount}),{count:0,qty:0,supply:0,vat:0,total:0});
    const aoa=[[`${month.replace("-","년 ")}월 유류 거래명세서`],["주유처",ordered[0]?.station_name||""],["조회기간",`${month}-01 ~ ${monthBounds(month).to}`],[],header,...body,["합계","","","",sums.count,sums.qty,"","",sums.supply,sums.vat,sums.total]];
    const ws=XLSX.utils.aoa_to_sheet(aoa); ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:10}}]; ws["!cols"]=[16,16,18,13,9,11,14,15,14,12,14].map((wch)=>({wch}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"거래명세서"); XLSX.writeFile(wb,`유류거래명세서_${month}.xlsx`);
  };'''
new='''  const exportStatementExcel = () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const wb = XLSX.utils.book_new();
    const stationGroups = new Map<string, FuelRecord[]>();
    filtered.forEach((record) => {
      const station = record.station_name || "미지정 주유소";
      stationGroups.set(station, [...(stationGroups.get(station) || []), record]);
    });
    [...stationGroups.entries()].sort(([a], [b]) => natural(a, b)).forEach(([station, rows], index) => {
      const ordered=[...rows].sort((a,b)=>natural(a.site_name,b.site_name)||natural(a.product_name,b.product_name)||natural(a.vehicle_number,b.vehicle_number)||a.fuel_date.localeCompare(b.fuel_date));
      const header=["현장명","제품명/규격","차량번호","일자","횟수","수량","단가(원/대)","단가(원/단위)","공급가액","부가세","합계금액"];
      const body=ordered.map((record)=>[record.site_name,record.product_name,record.vehicle_number,record.fuel_date,record.usage_count,record.quantity,record.line_amount,record.unit_price,record.supply_amount,record.vat_amount,record.total_amount]);
      const sums=ordered.reduce((acc,record)=>({count:acc.count+record.usage_count,qty:acc.qty+record.quantity,supply:acc.supply+record.supply_amount,vat:acc.vat+record.vat_amount,total:acc.total+record.total_amount}),{count:0,qty:0,supply:0,vat:0,total:0});
      const aoa=[[`${month.replace("-","년 ")}월 유류 거래명세서`],["주유처",station],["조회기간",`${month}-01 ~ ${monthBounds(month).to}`],[],header,...body,["합계","","","",sums.count,sums.qty,"","",sums.supply,sums.vat,sums.total]];
      const ws=XLSX.utils.aoa_to_sheet(aoa); ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:10}}]; ws["!cols"]=[16,16,18,13,9,11,14,15,14,12,14].map((wch)=>({wch}));
      const safeName=(station.replace(/[\\/?*\\[\\]:]/g," ").trim() || `주유소${index+1}`).slice(0,31);
      XLSX.utils.book_append_sheet(wb,ws,safeName);
    });
    XLSX.writeFile(wb,`유류거래명세서_주유소별_${month}.xlsx`);
  };'''
rep(old,new,'statement export')
rep('<label><span>주유처</span><input value={manual.station_name} onChange={(event) => setManual({ ...manual, station_name: event.target.value })} /></label>','<label><span>주유처</span><input list="fuel-station-options" value={manual.station_name} onChange={(event) => setManual({ ...manual, station_name: event.target.value })} /><datalist id="fuel-station-options">{allStations.map((name) => <option key={name} value={name} />)}</datalist></label>','station input')
rep('      <button type="button" aria-pressed={view === "site"} onClick={() => { setView("site"); setDetailTarget(null); }}>현장별</button>','      <button type="button" aria-pressed={view === "site"} onClick={() => { setView("site"); setDetailTarget(null); }}>현장별</button>\n      <button type="button" aria-pressed={view === "station"} onClick={() => { setView("station"); setDetailTarget(null); }}>주유소별</button>','station tab')
rep('''        {(view === "vehicle" ? vehicleSummary : siteSummary).length ? (view === "vehicle" ? vehicleSummary : siteSummary).map((row, index) => <article key={row.name} className="fuel-summary-clickable" role="button" tabIndex={0} onClick={() => setDetailTarget({ type: view === "vehicle" ? "vehicle" : "site", name: row.name })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setDetailTarget({ type: view === "vehicle" ? "vehicle" : "site", name: row.name }); }}>
''','''        {(view === "vehicle" ? vehicleSummary : view === "site" ? siteSummary : stationSummary).length ? (view === "vehicle" ? vehicleSummary : view === "site" ? siteSummary : stationSummary).map((row, index) => <article key={row.name} className="fuel-summary-clickable" role="button" tabIndex={0} onClick={() => setDetailTarget({ type: view === "vehicle" ? "vehicle" : view === "site" ? "site" : "station", name: row.name })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setDetailTarget({ type: view === "vehicle" ? "vehicle" : view === "site" ? "site" : "station", name: row.name }); }}>
''','summary source')
rep('<header><div><span>{detailTarget.type === "vehicle" ? "차량·장비 상세" : "현장 상세"}</span><h3>{detailTarget.name}</h3></div><button type="button" onClick={() => setDetailTarget(null)}>닫기</button></header>','<header><div><span>{detailTarget.type === "vehicle" ? "차량·장비 상세" : detailTarget.type === "site" ? "현장 상세" : "주유소 상세"}</span><h3>{detailTarget.name}</h3></div><button type="button" onClick={() => setDetailTarget(null)}>닫기</button></header>','detail label')
p.write_text(s)
