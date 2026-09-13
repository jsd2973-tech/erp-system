import type { DispatchOrder, DispatchTrip } from './dispatchTypes';
export type ResultOrder = Pick<DispatchOrder, 'id' | 'vendor_id' | 'vendor_name' | 'item_id' | 'item_name'>;
export type ResultTrip = Pick<DispatchTrip, 'id' | 'dispatch_order_id' | 'vehicle_id' | 'trip_no' | 'status' | 'actual_volume' | 'unloading_completed_at'>;
export const koreaDay = (stamp: string) => {
  const date = new Date(stamp);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10) : '';
};
export function periodBounds(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw Error('조회 시작일과 종료일을 확인하세요.');
  const start = new Date(`${from}T00:00:00+09:00`), end = new Date(`${to}T00:00:00+09:00`);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || koreaDay(start.toISOString()) !== from || koreaDay(end.toISOString()) !== to) throw Error('올바른 날짜를 선택하세요.');
  return { start: start.toISOString(), end: new Date(+end + 86400000).toISOString() };
}
export type ResultRow = { trip: ResultTrip; vendorKey: string; vendor: string; itemKey: string; item: string; volume: number };
export const sumVolume = (rows: ResultRow[]) => Math.round(rows.reduce((sum, row) => sum + row.volume, 0) * 1000000) / 1000000;
export const vehicleCount = (rows: ResultRow[]) => new Set(rows.map(row => row.trip.vehicle_id).filter(Boolean)).size;
export function summarizeResults(trips: ResultTrip[], orders: ResultOrder[], from: string, to: string) {
  periodBounds(from, to);
  const lookup = new Map(orders.map(order => [order.id, order]));
  const seen = new Set<string>();
  const rows: ResultRow[] = [];
  let invalid = 0, unlinked = 0;
  for (const trip of trips) {
    if (seen.has(trip.id)) continue;
    seen.add(trip.id);
    if (trip.status !== '완료') continue;
    const day = trip.unloading_completed_at ? koreaDay(trip.unloading_completed_at) : '';
    if (!day) { invalid++; continue; }
    if (day < from || day > to) continue;
    if (trip.actual_volume == null || !Number.isFinite(Number(trip.actual_volume)) || Number(trip.actual_volume) < 0) { invalid++; continue; }
    const order = lookup.get(trip.dispatch_order_id);
    if (!order) unlinked++;
    const vendor = order?.vendor_name.trim() || '거래처 확인 필요', item = order?.item_name.trim() || '품목 확인 필요';
    rows.push({ trip, volume: Number(trip.actual_volume), vendor, item,
      vendorKey: order ? (order.vendor_id ? `id:${order.vendor_id}` : `name:${vendor}`) : 'unknown',
      itemKey: order ? (order.item_id ? `id:${order.item_id}` : `name:${item}`) : 'unknown' });
  }
  return { rows, invalid, unlinked, volume: sumVolume(rows), vehicles: vehicleCount(rows), vendors: new Set(rows.filter(row => row.vendorKey !== 'unknown').map(row => row.vendorKey)).size };
}
export function groupResults(rows: ResultRow[], by: 'item' | 'vendor') {
  const groups = new Map<string, { key: string; name: string; rows: ResultRow[] }>();
  rows.forEach(row => { const key = by === 'item' ? row.itemKey : row.vendorKey; const group = groups.get(key) || { key, name: row[by], rows: [] }; group.rows.push(row); groups.set(key, group); });
  return [...groups.values()].sort((a, b) => sumVolume(b.rows) - sumVolume(a.rows) || a.name.localeCompare(b.name, 'ko'));
}
