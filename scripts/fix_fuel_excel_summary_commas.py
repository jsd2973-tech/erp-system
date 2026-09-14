from pathlib import Path
p=Path('src/features/fuel/FuelManagement.tsx')
s=p.read_text()
old='''    ["B2","B3","E3","H3"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"12324A"}},alignment:{vertical:"center"}}; });
    const lastRow=aoa.length-1; applyModernSheetStyle(ws,4,lastRow,11,lastRow);'''
new='''    ["B2","B3","E3","H3"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"12324A"}},alignment:{vertical:"center"}}; });
    ["B3","E3","H3"].forEach((ref)=>{ if(ws[ref]) ws[ref].z="#,##0"; });
    const lastRow=aoa.length-1; applyModernSheetStyle(ws,4,lastRow,11,lastRow);'''
if old not in s: raise SystemExit('general summary anchor not found')
s=s.replace(old,new,1)
old='''      ["A2","A3","A4","D4","G4"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"52677A"}},alignment:{vertical:"center"}}; }); ["B2","B3","B4","E4","H4"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"12324A"}},alignment:{vertical:"center"}}; });
      const lastRow=aoa.length-1; applyModernSheetStyle(ws,5,lastRow,10,lastRow);'''
new='''      ["A2","A3","A4","D4","G4"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"52677A"}},alignment:{vertical:"center"}}; }); ["B2","B3","B4","E4","H4"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"12324A"}},alignment:{vertical:"center"}}; });
      ["B4","E4","H4"].forEach((ref)=>{ if(ws[ref]) ws[ref].z="#,##0"; });
      const lastRow=aoa.length-1; applyModernSheetStyle(ws,5,lastRow,10,lastRow);'''
if old not in s: raise SystemExit('statement summary anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
