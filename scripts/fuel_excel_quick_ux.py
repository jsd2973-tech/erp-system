from pathlib import Path

p = Path('src/features/fuel/FuelManagement.tsx')
s = p.read_text()

def rep(old, new, label, count=1):
    global s
    if old not in s:
        raise SystemExit(f'{label} anchor not found')
    s = s.replace(old, new, count)

rep('  const [manual, setManual] = useState(emptyManual);\n  const [saving, setSaving] = useState(false);','  const [manual, setManual] = useState(emptyManual);\n  const [quickVehicle, setQuickVehicle] = useState("");\n  const [quickVehicleBackup, setQuickVehicleBackup] = useState<Pick<ReturnType<typeof emptyManual>, "vehicle_number" | "site_name" | "product_name" | "unit_price" | "station_name"> | null>(null);\n  const [saving, setSaving] = useState(false);','quick state')

old='''  const applyVehicleProfile = (vehicle: string) => {
    const profile = vehicleProfiles.find(([name]) => name === vehicle)?.[1];
    setManual((current) => ({ ...current, vehicle_number: vehicle, site_name: profile?.site_name || current.site_name, product_name: profile?.product_name || current.product_name, unit_price: profile?.unit_price ? String(profile.unit_price) : current.unit_price, station_name: profile?.station_name || current.station_name }));
  };
'''
new='''  const applyVehicleProfile = (vehicle: string) => {
    const profile = vehicleProfiles.find(([name]) => name === vehicle)?.[1];
    setManual((current) => ({ ...current, vehicle_number: vehicle, site_name: profile?.site_name || current.site_name, product_name: profile?.product_name || current.product_name, unit_price: profile?.unit_price ? String(profile.unit_price) : current.unit_price, station_name: profile?.station_name || current.station_name }));
  };

  const selectQuickVehicle = (vehicle: string) => {
    setManual((current) => {
      setQuickVehicleBackup({ vehicle_number: current.vehicle_number, site_name: current.site_name, product_name: current.product_name, unit_price: current.unit_price, station_name: current.station_name });
      const profile = vehicleProfiles.find(([name]) => name === vehicle)?.[1];
      return { ...current, vehicle_number: vehicle, site_name: profile?.site_name || current.site_name, product_name: profile?.product_name || current.product_name, unit_price: profile?.unit_price ? String(profile.unit_price) : current.unit_price, station_name: profile?.station_name || current.station_name };
    });
    setQuickVehicle(vehicle);
  };

  const cancelQuickVehicle = () => {
    if (quickVehicleBackup) setManual((current) => ({ ...current, ...quickVehicleBackup }));
    setQuickVehicle("");
    setQuickVehicleBackup(null);
  };
'''
rep(old,new,'quick helpers')

start=s.index('  const exportGeneralExcel = () => {')
end=s.index('\n  const onFile = async',start)
exports=r'''  const applyModernSheetStyle = (ws: XLSX.WorkSheet, headerRow: number, lastRow: number, lastCol: number, totalRow?: number) => {
    const thin = { style: "thin", color: { rgb: "D7E0EA" } } as const;
    for (let row = headerRow; row <= lastRow; row += 1) {
      for (let col = 0; col <= lastCol; col += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = ws[cellRef];
        if (!cell) continue;
        const isHeader = row === headerRow;
        const isTotal = totalRow === row;
        const isAlt = !isHeader && !isTotal && (row - headerRow) % 2 === 0;
        cell.s = {
          font: { name: "맑은 고딕", sz: 10, bold: isHeader || isTotal, color: { rgb: isHeader ? "FFFFFF" : isTotal ? "12324A" : "263746" } },
          fill: { patternType: "solid", fgColor: { rgb: isHeader ? "1F4E78" : isTotal ? "DDEBF7" : isAlt ? "F6F9FC" : "FFFFFF" } },
          alignment: { vertical: "center", horizontal: isHeader ? "center" : col >= 4 ? "right" : "left", wrapText: true },
          border: { top: thin, bottom: thin, left: thin, right: thin },
        };
      }
    }
    ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({ r: lastRow, c: lastCol })}` };
    ws["!rows"] = Array.from({ length: lastRow + 1 }, (_, index) => ({ hpt: index === headerRow ? 24 : 20 }));
  };

  const exportGeneralExcel = () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const header=["일자","현장","유종","차량/장비번호","횟수","수량(L)","단가(원/L)","공급가액","부가세","합계금액","주유처","메모"];
    const ordered=[...filtered].sort((a,b)=>b.fuel_date.localeCompare(a.fuel_date)||natural(a.vehicle_number,b.vehicle_number));
    const body=ordered.map((record)=>[record.fuel_date,record.site_name,record.product_name,record.vehicle_number,record.usage_count,record.quantity,record.unit_price,record.supply_amount,record.vat_amount,record.total_amount,record.station_name,record.memo||""]);
    const sums=ordered.reduce((acc,record)=>({count:acc.count+record.usage_count,qty:acc.qty+record.quantity,supply:acc.supply+record.supply_amount,vat:acc.vat+record.vat_amount,total:acc.total+record.total_amount}),{count:0,qty:0,supply:0,vat:0,total:0});
    const aoa=[[`${month.replace("-","년 ")}월 유류관리 내역`],["조회기간",`${month}-01 ~ ${monthBounds(month).to}`],["총 주유비",sums.total,"원","총 수량",sums.qty,"L","총 주유횟수",sums.count,"회"],[],header,...body,["합계","","","",sums.count,sums.qty,"",sums.supply,sums.vat,sums.total,"",""]];
    const ws=XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:11}}];
    ws["!cols"]=[12,15,12,18,8,12,14,14,12,15,21,24].map((wch)=>({wch}));
    if(ws["A1"]) ws["A1"].s={font:{name:"맑은 고딕",sz:18,bold:true,color:{rgb:"FFFFFF"}},fill:{patternType:"solid",fgColor:{rgb:"12324A"}},alignment:{horizontal:"left",vertical:"center"}};
    ["A2","A3","D3","G3"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"52677A"}},alignment:{vertical:"center"}}; });
    ["B2","B3","E3","H3"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"12324A"}},alignment:{vertical:"center"}}; });
    const lastRow=aoa.length-1; applyModernSheetStyle(ws,4,lastRow,11,lastRow);
    for(let r=5;r<=lastRow;r+=1){ [5,6,7,8,9].forEach((c)=>{ const cell=ws[XLSX.utils.encode_cell({r,c})]; if(cell) cell.z="#,##0"; }); }
    (ws["!rows"] ||= [])[0]={hpt:32};
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"유류내역"); XLSX.writeFile(wb,`유류내역_${month}.xlsx`);
  };

  const exportStatementExcel = () => {
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
      const aoa=[[`${month.replace("-","년 ")}월 유류 거래명세서`],["주유처",station],["조회기간",`${month}-01 ~ ${monthBounds(month).to}`],["총 합계",sums.total,"원","총 수량",sums.qty,"L","주유횟수",sums.count,"회"],[],header,...body,["합계","","","",sums.count,sums.qty,"","",sums.supply,sums.vat,sums.total]];
      const ws=XLSX.utils.aoa_to_sheet(aoa);
      ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:10}}];
      ws["!cols"]=[16,17,18,13,9,11,14,15,14,12,15].map((wch)=>({wch}));
      if(ws["A1"]) ws["A1"].s={font:{name:"맑은 고딕",sz:18,bold:true,color:{rgb:"FFFFFF"}},fill:{patternType:"solid",fgColor:{rgb:"12324A"}},alignment:{horizontal:"left",vertical:"center"}};
      ["A2","A3","A4","D4","G4"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"52677A"}},alignment:{vertical:"center"}}; });
      ["B2","B3","B4","E4","H4"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"12324A"}},alignment:{vertical:"center"}}; });
      const lastRow=aoa.length-1; applyModernSheetStyle(ws,5,lastRow,10,lastRow);
      for(let r=6;r<=lastRow;r+=1){ [4,5,6,7,8,9,10].forEach((c)=>{ const cell=ws[XLSX.utils.encode_cell({r,c})]; if(cell) cell.z="#,##0"; }); }
      (ws["!rows"] ||= [])[0]={hpt:32};
      const safeName=(station.replace(/[\\/?*\\[\\]:]/g," ").trim() || `주유소${index+1}`).slice(0,31);
      XLSX.utils.book_append_sheet(wb,ws,safeName);
    });
    XLSX.writeFile(wb,`유류거래명세서_주유소별_${month}.xlsx`);
  };
'''
s=s[:start]+exports+s[end:]

rep('    setManual(emptyManual());\n    setManualOpen(false);','    setManual(emptyManual());\n    setQuickVehicle("");\n    setQuickVehicleBackup(null);\n    setManualOpen(false);','after save')

rep('<label className="fuel-vehicle-entry"><span>차량/장비번호 *</span><input list="fuel-vehicle-options" value={manual.vehicle_number} onChange={(event) => { const value=event.target.value; setManual({ ...manual, vehicle_number:value }); if (vehicleOptions.includes(value)) applyVehicleProfile(value); }} onBlur={() => { if (vehicleOptions.includes(manual.vehicle_number)) applyVehicleProfile(manual.vehicle_number); }} placeholder="번호 입력 또는 선택" /><datalist id="fuel-vehicle-options">{vehicleOptions.map((name) => <option key={name} value={name} />)}</datalist></label>','<label className="fuel-vehicle-entry"><span>차량/장비번호 *</span><input list="fuel-vehicle-options" value={manual.vehicle_number} onChange={(event) => { const value=event.target.value; if (quickVehicle) { setQuickVehicle(""); setQuickVehicleBackup(null); } setManual({ ...manual, vehicle_number:value }); if (vehicleOptions.includes(value)) applyVehicleProfile(value); }} onBlur={() => { if (vehicleOptions.includes(manual.vehicle_number)) applyVehicleProfile(manual.vehicle_number); }} placeholder="번호 입력 또는 선택" /><datalist id="fuel-vehicle-options">{vehicleOptions.map((name) => <option key={name} value={name} />)}</datalist></label>','vehicle input')

old='''      {vehicleOptions.length > 0 && <div className="fuel-quick-vehicles"><span>차량·장비 빠른 선택</span><div>{vehicleOptions.filter((name) => !manual.vehicle_number.trim() || name.toLowerCase().includes(manual.vehicle_number.trim().toLowerCase())).slice(0,18).map((name)=><button type="button" key={name} onClick={() => applyVehicleProfile(name)}>{name}</button>)}</div><small>기존 명세서 기준으로 번호를 누르면 최근 현장·유종·단가·주유처를 자동 입력합니다.</small></div>}
      <div className="fuel-manual-total"><span>예상 합계</span><strong>{manual.quantity && manual.unit_price ? `${money(Math.round(asNumber(manual.quantity) * asNumber(manual.unit_price) * 1.1))}원` : "-"}</strong></div>
      <div className="fuel-form-actions"><button type="button" onClick={() => { setManual(emptyManual()); setManualOpen(false); }}>취소</button><button type="button" className="fuel-primary" disabled={saving} onClick={() => void saveManual()}>{saving ? "저장 중..." : "저장"}</button></div>
'''
new='''      {vehicleOptions.length > 0 && !quickVehicle && <div className="fuel-quick-vehicles"><span>차량·장비 빠른 선택</span><div>{vehicleOptions.filter((name) => !manual.vehicle_number.trim() || name.toLowerCase().includes(manual.vehicle_number.trim().toLowerCase())).slice(0,18).map((name)=><button type="button" key={name} onClick={() => selectQuickVehicle(name)}>{name}</button>)}</div><small>기존 명세서 기준으로 번호를 누르면 최근 현장·유종·단가·주유처를 자동 입력합니다.</small></div>}
      {quickVehicle && <div className="fuel-quick-selected"><div><span>빠른 선택 적용</span><strong>{quickVehicle}</strong><small>최근 현장·유종·단가·주유처가 입력되었습니다.</small></div><button type="button" onClick={cancelQuickVehicle}>선택 취소</button></div>}
      <div className="fuel-manual-total"><span>예상 합계</span><strong>{manual.quantity && manual.unit_price ? `${money(Math.round(asNumber(manual.quantity) * asNumber(manual.unit_price) * 1.1))}원` : "-"}</strong></div>
      <div className="fuel-form-actions"><button type="button" onClick={() => { setManual(emptyManual()); setQuickVehicle(""); setQuickVehicleBackup(null); setManualOpen(false); }}>입력 닫기</button><button type="button" className="fuel-primary" disabled={saving} onClick={() => void saveManual()}>{saving ? "저장 중..." : "저장"}</button></div>
'''
rep(old,new,'quick render')
p.write_text(s)

css=Path('src/features/fuel/fuelManagement.css')
css.write_text(css.read_text()+'''\n.fuel-quick-selected{margin:12px 0 4px;padding:12px 14px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;display:flex;align-items:center;justify-content:space-between;gap:12px}.fuel-quick-selected>div{display:grid;gap:2px}.fuel-quick-selected span{font-size:12px;font-weight:700;color:#2563eb}.fuel-quick-selected strong{font-size:16px;color:#0f172a}.fuel-quick-selected small{color:#64748b}.fuel-quick-selected button{border:1px solid #93c5fd;background:#fff;color:#1d4ed8;border-radius:9px;padding:7px 10px;font-weight:700;cursor:pointer;white-space:nowrap}@media(max-width:560px){.fuel-quick-selected{align-items:flex-start}.fuel-quick-selected button{padding:7px 9px}}\n''')
