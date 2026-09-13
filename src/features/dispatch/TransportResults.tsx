import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DispatchVehicle } from './dispatchTypes';
import { dispatchToday } from './dispatchUtils';
import { groupResults, periodBounds, sumVolume, summarizeResults, vehicleCount, type ResultOrder, type ResultTrip } from './transportResults';
import './transportResults.css';
const number = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
const time = (stamp: string | null) => stamp ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(stamp)) : '-';
export default function TransportResults({ supabase, vehicles }: { supabase: SupabaseClient; vehicles: DispatchVehicle[] }) {
  const [from, setFrom] = useState(dispatchToday), [to, setTo] = useState(dispatchToday);
  const [period, setPeriod] = useState(() => ({ from: dispatchToday(), to: dispatchToday(), refresh: 0 }));
  const [by, setBy] = useState<'item' | 'vendor'>('item');
  const [data, setData] = useState<{ trips: ResultTrip[]; orders: ResultOrder[] } | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true); setError(''); setData(null);
      try {
        const bounds = periodBounds(period.from, period.to);
        const trips: ResultTrip[] = [], orders: ResultOrder[] = [];
        let cursor = '';
        while (true) {
          let query = supabase.from('dispatch_trips').select('id,dispatch_order_id,vehicle_id,trip_no,status,actual_volume,unloading_completed_at').eq('status', '완료').gte('unloading_completed_at', bounds.start).lt('unloading_completed_at', bounds.end).order('id').limit(500).abortSignal(controller.signal);
          if (cursor) query = query.gt('id', cursor);
          const result = await query;
          if (result.error) throw result.error;
          const page = (result.data || []) as ResultTrip[];
          if (!page.length) break;
          trips.push(...page); cursor = page[page.length - 1].id;
        }
        const ids = [...new Set(trips.map(trip => trip.dispatch_order_id))];
        for (let i = 0; i < ids.length; i += 100) {
          cursor = '';
          while (true) {
            let query = supabase.from('dispatch_orders').select('id,vendor_id,vendor_name,item_id,item_name').in('id', ids.slice(i, i + 100)).order('id').limit(100).abortSignal(controller.signal);
            if (cursor) query = query.gt('id', cursor);
            const result = await query;
            if (result.error) throw result.error;
            const page = (result.data || []) as ResultOrder[];
            if (!page.length) break;
            orders.push(...page); cursor = page[page.length - 1].id;
          }
        }
        if (!controller.signal.aborted) setData({ trips, orders });
      } catch (cause) {
        if (!controller.signal.aborted) setError(`실적을 불러오지 못했습니다. ${cause instanceof Error ? cause.message : '잠시 후 다시 조회해 주세요.'}`);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load(); return () => controller.abort();
  }, [supabase, period]);
  const result = useMemo(() => data ? summarizeResults(data.trips, data.orders, period.from, period.to) : null, [data, period]);
  const groups = useMemo(() => groupResults(result?.rows || [], by), [result, by]);
  const vehicleNames = new Map(vehicles.map(vehicle => [vehicle.id, vehicle.vehicle_number]));
  const apply = () => { try { periodBounds(from, to); setPeriod(value => ({ from, to, refresh: value.refresh + 1 })); } catch (cause) { setError((cause as Error).message); } };
  return <section className="transport-results" aria-label="운송실적">
    <header><div><span className="transport-eyebrow">TRANSPORT REPORT</span><h2>운송실적</h2><p>하차 완료일 기준 · 실제 운송량</p></div></header>
    <div className="transport-filters"><label>시작일<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>종료일<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><button onClick={apply} type="button">조회</button><button type="button" onClick={() => { const today = dispatchToday(); setFrom(today); setTo(today); setPeriod(value => ({ from: today, to: today, refresh: value.refresh + 1 })); }}>오늘</button></div>
    {error && <p role="alert" className="transport-warning">{error}</p>}
    {loading ? <p role="status">실적을 집계하고 있습니다…</p> : result && <>
      <p className="transport-period">{period.from} ~ {period.to} · 한국시간{(from !== period.from || to !== period.to) && ' · 변경한 날짜는 조회 버튼을 눌러 적용하세요.'}</p>
      <div className="transport-kpis">{[['실제 운송량', number(result.volume), '루베'], ['완료 운행', number(result.rows.length), '회'], ['투입 차량', number(result.vehicles), '대'], ['운송 거래처', number(result.vendors), '곳']].map(([label, value, unit]) => <article key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong></article>)}</div>
      <p className="transport-help">같은 차량이 여러 번 운행해도 투입 차량은 1대로 계산합니다. 휴지통 배차의 완료 기록도 포함합니다.</p>
      {(result.invalid > 0 || result.unlinked > 0) && <p className="transport-warning">{result.invalid > 0 && `물량 확인이 필요한 ${result.invalid}건은 집계에서 제외했습니다. `}{result.unlinked > 0 && `배차 연결을 확인할 ${result.unlinked}건은 ‘확인 필요’로 표시합니다.`}</p>}
      <nav className="transport-tabs" aria-label="실적 분류"><button type="button" aria-pressed={by === 'item'} onClick={() => setBy('item')}>품목별</button><button type="button" aria-pressed={by === 'vendor'} onClick={() => setBy('vendor')}>거래처별</button></nav>
      {!groups.length ? <div className="transport-empty">선택한 기간에 완료된 운송 실적이 없습니다.</div> : <div className="transport-groups">
        <div className="transport-columns"><span>{by === 'item' ? '품목' : '거래처'}</span><span>투입 차량</span><span>운행 횟수</span><span>운송량</span></div>
        {groups.map(group => <details key={`${by}:${group.key}`} className="transport-group"><summary><strong>{group.name}</strong><span><em>차량</em>{vehicleCount(group.rows)}대</span><span><em>운행</em>{group.rows.length}회</span><b><em>운송량</em>{number(sumVolume(group.rows))} 루베</b></summary>
          <div className="transport-breakdown"><h3>{by === 'vendor' ? '품목별 상세' : '거래처별 상세'}</h3>{groupResults(group.rows, by === 'vendor' ? 'item' : 'vendor').map(sub => <div key={sub.key}><strong>{sub.name}</strong><span>{sub.rows.length}회 · {number(sumVolume(sub.rows))} 루베</span></div>)}
          <h3>차량별 운행기록</h3>{[...new Set(group.rows.map(row => row.trip.vehicle_id))].map(id => { const rows = group.rows.filter(row => row.trip.vehicle_id === id); return <details key={id}><summary>{vehicleNames.get(id) || '차량 확인 필요'} · {rows.length}회 · {number(sumVolume(rows))} 루베</summary><ul>{rows.map(row => <li key={row.trip.id}><span>{time(row.trip.unloading_completed_at)} · {row.trip.trip_no}회차<br />{row.vendor} · {row.item}</span><b>{number(row.volume)} 루베</b></li>)}</ul></details>; })}</div>
        </details>)}
      </div>}
    </>}
  </section>;
}
