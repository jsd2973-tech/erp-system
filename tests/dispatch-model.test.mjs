import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/features/dispatch/dispatchModel.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  .replace('import { formatVolume, normalizeCompanyName } from "./dispatchUtils";', 'const formatVolume = value => `${Number(value || 0).toLocaleString("ko-KR")}루베`; const normalizeCompanyName = value => String(value || "").trim().replace(/\\s+/g, " ");');
const model = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const driver = (id = 'd1', patch = {}) => ({
  id, name: '기사', phone: '', company_name: '태명', assigned_vehicle_id: 'v1', auth_user_id: null, active: true, memo: '', ...patch,
});
const order = (patch = {}) => ({
  id: 'o1', vendor_name: '거래처', item_name: '모래', loading_location: '상차지', unloading_location: '하차지', status: '대기',
  total_volume: 25, estimated_trip_count: 2, vehicle_ids: ['v1'], assignments: [{ vehicle_id: 'v1', driver_id: 'd1' }], ...patch,
});
const trip = (id, patch = {}) => ({
  id, dispatch_order_id: 'o1', vehicle_id: 'v1', driver_id: 'd1', trip_no: 1, actual_volume: 12, status: '완료',
  loading_completed_at: '2026-09-28T01:00:00Z', unloading_completed_at: '2026-09-28T02:00:00Z', created_at: '2026-09-28T00:00:00Z', ...patch,
});

test('company filtering retains active choices and current inactive choice only', () => {
  const vehicles = [
    { id: 'v1', company_name: '태명', active: true },
    { id: 'v2', company_name: ' 태명 ', active: false },
    { id: 'v3', company_name: '다른 회사', active: true },
  ];
  assert.deepEqual(model.filterDispatchVehiclesForCompany(vehicles, '태명', 'v2').map((row) => row.id), ['v1', 'v2']);
  assert.deepEqual(model.filterDispatchVehiclesForCompany(vehicles, '태명', '').map((row) => row.id), ['v1']);
});

test('status calculations preserve completed volume and ignore canceled trips in progress indexes', () => {
  const trips = [trip('done'), trip('cancel', { status: '취소', actual_volume: 50 })];
  const rows = model.buildDriverStatusRows([driver()], [order()], trips);
  assert.equal(rows[0].completedVolume, 12);
  assert.equal(rows[0].progress.completedCount, 1);
  assert.equal(rows[0].progress.completedVolume, 12);
  assert.equal(rows[0].progress.remainingTrips, 1);
  assert.equal(rows[0].progress.remainingVolume, 13);
  const indexes = model.indexDispatchTrips(trips);
  assert.deepEqual(indexes.byDriver.get('d1').map((row) => row.id), ['done']);
});

test('correction type follows the current trip transition state', () => {
  assert.equal(model.correctionTypeForTrip(trip('done')), 'unloading_cancel');
  assert.equal(model.correctionTypeForTrip(trip('loading', { status: '진행중', unloading_completed_at: null })), 'loading_cancel');
  assert.equal(model.correctionTypeForTrip(trip('start', { status: '상차대기', loading_completed_at: null, unloading_completed_at: null })), 'start_cancel');
  assert.equal(model.correctionTypeForTrip(trip('cancelled', { status: '취소' })), null);
});

test('overview totals use completed unloading time in Asia/Seoul and keep actual volume', () => {
  const orders = [order({ dispatch_date: '2026-09-28' }), order({ id: 'o2', dispatch_date: '2026-09-27', status: '완료' })];
  const trips = [
    trip('today', { unloading_completed_at: '2026-09-27T15:00:00Z', actual_volume: 17.25 }),
    trip('yesterday', { unloading_completed_at: '2026-09-27T14:59:59Z', actual_volume: 5 }),
    trip('pending', { status: '진행중', unloading_completed_at: '2026-09-27T15:00:00Z', actual_volume: 100 }),
  ];
  assert.deepEqual(model.summarizeDispatchOverview(orders, trips, '2026-09-28'), {
    today: 1, active: 0, done: 1, actualVolumeToday: 17.25, actualVolumeYesterday: 5, actualVolumeDiff: 12.25,
  });
});
