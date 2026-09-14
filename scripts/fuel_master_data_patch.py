from pathlib import Path

p=Path('src/features/fuel/FuelManagement.tsx')
s=p.read_text()

def rep(old,new,label,count=1):
    global s
    if old not in s:
        raise SystemExit(f'{label} anchor not found')
    s=s.replace(old,new,count)

rep('type SummaryRow = { name: string; count: number; quantity: number; total: number };\ntype ViewMode = "records" | "vehicle" | "site" | "station";','type SummaryRow = { name: string; count: number; quantity: number; total: number };\ntype FuelMasterCategory = "vehicle" | "station" | "product" | "site";\ntype FuelMasterOption = { id: string; category: FuelMasterCategory; name: string; is_active: boolean; updated_at?: string };\ntype ViewMode = "records" | "vehicle" | "site" | "station" | "basics";','types')

rep('  const [referenceRecords, setReferenceRecords] = useState<FuelRecord[]>([]);','  const [referenceRecords, setReferenceRecords] = useState<FuelRecord[]>([]);\n  const [masterOptions, setMasterOptions] = useState<FuelMasterOption[]>([]);\n  const [masterInputs, setMasterInputs] = useState<Record<FuelMasterCategory, string>>({ vehicle: "", station: "", product: "", site: "" });\n  const [masterDrafts, setMasterDrafts] = useState<Record<string, string>>({});\n  const [masterSaving, setMasterSaving] = useState("");','master state')

anchor='''  useEffect(() => { void load(); }, [month]);
  useEffect(() => {
    const loadReferences = async () => {
'''
new='''  useEffect(() => { void load(); }, [month]);
  const loadMasters = async () => {
    const { data, error: masterError } = await supabase.from("fuel_master_options").select("id,category,name,is_active,updated_at").order("category").order("name");
    if (masterError) {
      setError(`유류 기초등록을 불러오지 못했습니다. (${masterError.message})`);
      return;
    }
    const rows=(data || []).map((row)=>({ id:String(row.id), category:String(row.category) as FuelMasterCategory, name:String(row.name || ""), is_active:Boolean(row.is_active), updated_at:row.updated_at ? String(row.updated_at) : undefined }));
    setMasterOptions(rows);
    setMasterDrafts(Object.fromEntries(rows.map((row)=>[row.id,row.name])));
  };
  useEffect(() => { void loadMasters(); }, []);
  useEffect(() => {
    const loadReferences = async () => {
'''
rep(anchor,new,'load masters')

old='''  const vehicleProfiles = useMemo(() => {
    const map = new Map<string, FuelRecord>();
    referenceRecords.forEach((record) => {
      const key = String(record.vehicle_number || "").trim();
      if (key && !map.has(key)) map.set(key, record);
    });
    return [...map.entries()].sort((a, b) => natural(a[0], b[0]));
  }, [referenceRecords]);
  const vehicleOptions = useMemo(() => vehicleProfiles.map(([vehicle]) => vehicle), [vehicleProfiles]);
  const allSites = useMemo(() => [...new Set(referenceRecords.map((record) => String(record.site_name || "")).filter(Boolean))].sort(natural), [referenceRecords]);
  const allProducts = useMemo(() => [...new Set(referenceRecords.map((record) => String(record.product_name || "")).filter(Boolean))].sort(natural), [referenceRecords]);
  const allStations = useMemo(() => [...new Set(["남세종농협주유소", "믿음주유소", ...referenceRecords.map((record) => String(record.station_name || "")).filter(Boolean)])].sort(natural), [referenceRecords]);
'''
new='''  const vehicleProfiles = useMemo(() => {
    const map = new Map<string, FuelRecord>();
    referenceRecords.forEach((record) => {
      const key = String(record.vehicle_number || "").trim();
      if (key && !map.has(key)) map.set(key, record);
    });
    return [...map.entries()].sort((a, b) => natural(a[0], b[0]));
  }, [referenceRecords]);
  const managedOptions = (category: FuelMasterCategory, fallback: string[]) => {
    const rows=masterOptions.filter((row)=>row.category===category);
    const inactive=new Set(rows.filter((row)=>!row.is_active).map((row)=>row.name));
    return [...new Set([...rows.filter((row)=>row.is_active).map((row)=>row.name), ...fallback.filter((name)=>!inactive.has(name))])].filter(Boolean).sort(natural);
  };
  const vehicleOptions = useMemo(() => managedOptions("vehicle", vehicleProfiles.map(([vehicle])=>vehicle)), [masterOptions, vehicleProfiles]);
  const allSites = useMemo(() => managedOptions("site", referenceRecords.map((record)=>String(record.site_name || ""))), [masterOptions, referenceRecords]);
  const allProducts = useMemo(() => managedOptions("product", referenceRecords.map((record)=>String(record.product_name || ""))), [masterOptions, referenceRecords]);
  const allStations = useMemo(() => managedOptions("station", ["남세종농협주유소", "믿음주유소", ...referenceRecords.map((record)=>String(record.station_name || ""))]), [masterOptions, referenceRecords]);
'''
rep(old,new,'managed options')

anchor='''  const cancelQuickVehicle = () => {
    if (quickVehicleBackup) setManual((current) => ({ ...current, ...quickVehicleBackup }));
    setQuickVehicle("");
    setQuickVehicleBackup(null);
  };

'''
new='''  const cancelQuickVehicle = () => {
    if (quickVehicleBackup) setManual((current) => ({ ...current, ...quickVehicleBackup }));
    setQuickVehicle("");
    setQuickVehicleBackup(null);
  };

  const addMasterOption = async (category: FuelMasterCategory) => {
    const name=masterInputs[category].trim();
    if (!name) return;
    setMasterSaving(`add-${category}`); setError("");
    const { error: addError }=await supabase.from("fuel_master_options").insert({ category, name, is_active:true });
    setMasterSaving("");
    if (addError) { setError(addError.code === "23505" ? "이미 등록된 항목입니다." : `기초항목을 추가하지 못했습니다. (${addError.message})`); return; }
    setMasterInputs((current)=>({ ...current, [category]:"" }));
    await loadMasters();
  };
  const saveMasterOption = async (row: FuelMasterOption) => {
    const name=(masterDrafts[row.id] ?? row.name).trim();
    if (!name) return;
    setMasterSaving(row.id); setError("");
    const { error: saveError }=await supabase.from("fuel_master_options").update({ name, updated_at:new Date().toISOString() }).eq("id",row.id);
    setMasterSaving("");
    if (saveError) { setError(saveError.code === "23505" ? "같은 분류에 이미 등록된 이름입니다." : `기초항목을 수정하지 못했습니다. (${saveError.message})`); return; }
    await loadMasters();
  };
  const toggleMasterOption = async (row: FuelMasterOption) => {
    setMasterSaving(row.id); setError("");
    const { error: toggleError }=await supabase.from("fuel_master_options").update({ is_active:!row.is_active, updated_at:new Date().toISOString() }).eq("id",row.id);
    setMasterSaving("");
    if (toggleError) { setError(`사용 상태를 바꾸지 못했습니다. (${toggleError.message})`); return; }
    await loadMasters();
  };
  const masterGroups: Array<{ category:FuelMasterCategory; title:string; placeholder:string }> = [
    { category:"vehicle", title:"차량·장비번호", placeholder:"예: 세종03가1166 / WA500-8" },
    { category:"station", title:"주유처", placeholder:"예: 믿음주유소" },
    { category:"product", title:"유종", placeholder:"예: 경유 / 요소수" },
    { category:"site", title:"현장", placeholder:"예: 공장 / 국회" },
  ];

'''
rep(anchor,new,'master handlers')

rep('''      <button type="button" aria-pressed={view === "station"} onClick={() => { setView("station"); setDetailTarget(null); }}>주유소별</button>
    </nav>

    {loading ? <div className="fuel-empty">유류내역을 불러오는 중...</div> : view === "records" ? <>''','''      <button type="button" aria-pressed={view === "station"} onClick={() => { setView("station"); setDetailTarget(null); }}>주유소별</button>
      <button type="button" aria-pressed={view === "basics"} onClick={() => { setView("basics"); setDetailTarget(null); }}>기초등록</button>
    </nav>

    {view === "basics" ? <section className="fuel-master-grid">
      {masterGroups.map((group)=><article className="fuel-master-card" key={group.category}>
        <header><div><h3>{group.title}</h3><span>{masterOptions.filter((row)=>row.category===group.category && row.is_active).length}개 사용중</span></div></header>
        <div className="fuel-master-add"><input value={masterInputs[group.category]} onChange={(event)=>setMasterInputs((current)=>({ ...current, [group.category]:event.target.value }))} onKeyDown={(event)=>{ if(event.key==="Enter") void addMasterOption(group.category); }} placeholder={group.placeholder}/><button type="button" disabled={masterSaving===`add-${group.category}`} onClick={()=>void addMasterOption(group.category)}>추가</button></div>
        <div className="fuel-master-list">{masterOptions.filter((row)=>row.category===group.category).sort((a,b)=>Number(b.is_active)-Number(a.is_active)||natural(a.name,b.name)).map((row)=><div className={row.is_active ? "" : "is-inactive"} key={row.id}><input value={masterDrafts[row.id] ?? row.name} onChange={(event)=>setMasterDrafts((current)=>({ ...current, [row.id]:event.target.value }))}/><button type="button" disabled={masterSaving===row.id || (masterDrafts[row.id] ?? row.name).trim()===row.name} onClick={()=>void saveMasterOption(row)}>저장</button><button type="button" className="fuel-master-toggle" disabled={masterSaving===row.id} onClick={()=>void toggleMasterOption(row)}>{row.is_active ? "미사용" : "사용"}</button></div>)}</div>
      </article>)}
    </section> : loading ? <div className="fuel-empty">유류내역을 불러오는 중...</div> : view === "records" ? <>''','master tab')

p.write_text(s)

css=Path('src/features/fuel/fuelManagement.css')
cs=css.read_text()
cs += '''\n.fuel-master-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.fuel-master-card{background:#fff;border:1px solid #dde5ee;border-radius:15px;padding:14px;min-width:0}.fuel-master-card header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.fuel-master-card h3{margin:0;font-size:16px}.fuel-master-card header span{font-size:11px;color:#64748b}.fuel-master-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-bottom:10px}.fuel-master-add input,.fuel-master-list input{width:100%;box-sizing:border-box;border:1px solid #d8e0e8;border-radius:9px;padding:8px 9px;font:inherit}.fuel-master-add button,.fuel-master-list button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:7px 10px;font-weight:700;cursor:pointer;white-space:nowrap}.fuel-master-add button{background:#0f766e;color:#fff;border-color:#0f766e}.fuel-master-list{display:grid;gap:6px;max-height:330px;overflow:auto}.fuel-master-list>div{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center}.fuel-master-list>div.is-inactive{opacity:.55}.fuel-master-toggle{min-width:60px}.fuel-master-list button:disabled,.fuel-master-add button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:760px){.fuel-master-grid{grid-template-columns:1fr}.fuel-tabs{overflow:auto}.fuel-tabs button{min-width:max-content}.fuel-master-list>div{grid-template-columns:minmax(0,1fr) auto auto}}\n'''
css.write_text(cs)
