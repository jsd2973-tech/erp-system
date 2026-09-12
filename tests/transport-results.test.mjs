import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync(new URL('../src/features/dispatch/transportResults.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { koreaDay, periodBounds, summarizeResults, groupResults, sumVolume } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const orders = [{ id: 'o1', vendor_id: 'v1', vendor_name: '거래처', item_id: 'i1', item_name: '모래' }, { id: 'o2', vendor_id: 'v2', vendor_name: '거래처', item_id: 'i2', item_name: '자갈' }];
const trip = (id, patch = {}) => ({ id, dispatch_order_id: 'o1', vehicle_id: 'truck1', trip_no: 1, status: '완료', actual_volume: 17, unloading_completed_at: '2026-09-11T15:00:00Z', ...patch });
test('Korean midnight and inclusive final day', () => {
 assert.equal(koreaDay('2026-09-11T14:59:59Z'), '2026-09-11');
 assert.equal(koreaDay('2026-09-11T15:00:00Z'), '2026-09-12');
 assert.deepEqual(periodBounds('2026-09-12', '2026-09-12'), { start: '2026-09-11T15:00:00.000Z', end: '2026-09-12T15:00:00.000Z' });
 assert.throws(() => periodBounds('2026-09-13', '2026-09-12'));
 assert.throws(() => periodBounds('2026-02-30', '2026-03-01'));
});
test('unique vehicles, duplicate trips and both grouping totals', () => {
 const data = [trip('a'), trip('b'), trip('b'), trip('c', { dispatch_order_id: 'o2', vehicle_id: 'truck2', actual_volume: 0.2 }), trip('d', { dispatch_order_id: 'o2', actual_volume: 0.1 })];
 const result = summarizeResults(data, orders, '2026-09-12', '2026-09-12');
 assert.equal(result.rows.length, 4); assert.equal(result.vehicles, 2); assert.equal(result.vendors, 2); assert.equal(result.volume, 34.3);
 for (const by of ['item','vendor']) assert.equal(Math.round(groupResults(result.rows, by).reduce((sum, group) => sum + sumVolume(group.rows), 0) * 10) / 10, result.volume);
});
test('exclude pending, out-of-period and invalid records; preserve unlinked completed work', () => {
 const result = summarizeResults([trip('a', { status: '진행중' }), trip('b', { actual_volume: -1 }), trip('c', { unloading_completed_at: 'invalid' }), trip('d', { unloading_completed_at: '2026-09-12T15:00:00Z' }), trip('e', { dispatch_order_id: 'missing' }), trip('f', { actual_volume: 0 })], orders, '2026-09-12', '2026-09-12');
 assert.equal(result.rows.length, 2); assert.equal(result.invalid, 2); assert.equal(result.unlinked, 1); assert.equal(result.volume, 17);
 assert.equal(groupResults(result.rows,'vendor').find(group => group.key === 'unknown').name, '거래처 확인 필요');
});
test('empty period returns zero totals', () => {
 const result = summarizeResults([], [], '2026-09-12', '2026-09-12');
 assert.equal(result.volume, 0); assert.equal(result.vehicles, 0); assert.equal(result.vendors, 0); assert.deepEqual(result.rows, []);
});
