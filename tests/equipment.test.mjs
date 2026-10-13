import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import XLSX from "xlsx-js-style";

const generated = [];
async function compile(name, dependencies = {}) {
  const path = new URL(`../src/features/maintenance/.${name}-${process.pid}.mjs`, import.meta.url);
  let code = ts.transpileModule(await readFile(new URL(`../src/features/maintenance/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText.replace('import * as XLSX from "xlsx-js-style";', 'import XLSX from "xlsx-js-style";');
  for (const [from, to] of Object.entries(dependencies)) code = code.replaceAll(`"./${from}"`, JSON.stringify(to.href));
  await writeFile(path, code); generated.push(path);
  return { module: await import(path.href), path };
}
const { module: model, path: modelPath } = await compile("equipmentModel");
const { module: service } = await compile("equipmentService");
const { module: workbook } = await compile("equipmentWorkbook", { equipmentModel: modelPath });
const { module: maintenance } = await compile("maintenanceModel");
const item = (extra = {}) => model.normalizeEquipmentItem({ id: "part-a", category: "테스트 설비", name: "모터", cycle_method: "average", cycle_intervals: 2, warehouse_id: "warehouse-a", ...extra });
const imported = (id, date, extra = {}) => model.normalizeEquipmentHistory({ id, equipment_item_id: "part-a", work_date: date, cycle_included: true, ...extra });
const maint = (extra = {}) => ({ id: "maint-a", date: "2026-10-10", warehouse: "테스트 / 창고", title: "모터 교체", items: [], total: 1100, equipment_item_id: "part-a", equipment_work_type: "replacement", equipment_cycle_included: true, ...extra });

test("설비 현황은 stable ID로 연결하고 정비 수정·삭제·복구를 원본에서 계산한다", () => {
  const items = [item()], legacy = [imported("legacy-a", "2026-01-01")], original = maint();
  assert.equal(model.buildEquipmentOverview(items, legacy, [original])[0].history[0].source_id, "maint-a");
  const changed = maint({ date: "2026-09-09", title: "모터 수리 변경", equipment_vendor: "수정업체" });
  assert.equal(model.buildEquipmentOverview(items, legacy, [changed])[0].history[0].date, "2026-09-09");
  assert.equal(model.buildEquipmentOverview(items, legacy, [changed])[0].history[0].vendor, "수정업체");
  assert.equal(model.buildEquipmentOverview(items, legacy, [])[0].history.length, 1);
  assert.equal(model.buildEquipmentOverview(items, legacy, [changed])[0].history.length, 2);
  assert.equal(model.buildEquipmentOverview(items, legacy, [maint({ equipment_item_id: null })])[0].history.length, 1);
  assert.equal(model.buildEquipmentOverview([item({ name: "변경된 명칭" })], legacy, [changed])[0].history.length, 2);
});

test("교체주기는 점검·제외 작업·같은 날 중복을 제외하고 설정한 간격만 계산한다", () => {
  const history = [imported("a", "2026-01-01"), imported("b", "2026-01-11"), imported("c", "2026-01-31"), imported("duplicate", "2026-01-31"), imported("excluded", "2026-02-01", { cycle_included: false })];
  const row = model.buildEquipmentOverview([item()], history, [maint({ date: "2026-03-01", equipment_work_type: "inspection" })])[0];
  assert.equal(row.average_days, 15);
  assert.equal(row.expected_date, "2026-02-15");
  assert.equal(row.history[0].cycle_included, false);
  assert.equal(model.buildEquipmentOverview([item({ expected_override: "2027-01-01" })], history, [])[0].expected_date, "2027-01-01");
  assert.equal(model.buildEquipmentOverview([item({ cycle_method: "fixed", fixed_cycle_days: 20 })], history, [])[0].expected_date, "2026-02-20");
});

test("혼합 원본 날짜는 표시 그대로 보존하고 주기에 사용하지 않는다", () => {
  const raw = "2025-06-22,23\n라인 개선공사";
  const row = model.buildEquipmentOverview([item()], [imported("raw", null, { date_text: raw, cycle_included: false }), imported("invalid", null, { date_text: "204-11-09", cycle_included: false })], [])[0];
  assert.equal(row.history[0].date, raw);
  assert.equal(row.history[0].calendar_date, null);
  assert.equal(row.history[1].date, "204-11-09");
  assert.equal(row.expected_date, null);
  assert.equal(model.validEquipmentDate("2026-02-30"), false);
  assert.equal(model.validEquipmentDate("2024-02-29"), true);
});

test("연결 필드 초기화와 정비 수정은 기존 금액·이미지·설비 연결을 유지한다", () => {
  const original = maint({ image_urls: ["image-a"], equipment_vendor: "현장", equipment_cycle_included: true });
  const edit = maintenance.buildMaintenanceEditData(original, () => "row-a");
  assert.equal(edit.form.equipment_item_id, "part-a");
  assert.equal(edit.form.equipment_vendor, "현장");
  assert.deepEqual(edit.form.image_urls, ["image-a"]);
  assert.equal(model.maintenanceEquipmentFields({ ...edit.form, equipment_work_type: "inspection" }).equipment_cycle_included, false);
  assert.deepEqual(model.maintenanceEquipmentFields({ ...edit.form, equipment_item_id: "" }), { equipment_item_id: null, equipment_work_type: null, equipment_vendor: "", equipment_cycle_included: false });
  assert.equal(model.validateMaintenanceEquipment({ equipment_item_id: "part-a", warehouse: "테스트 / 창고" }, [item()], [{ id: "warehouse-a", name: "창고", group: "테스트" }]), "");
  assert.match(model.validateMaintenanceEquipment({ equipment_item_id: "part-a", warehouse: "다른 창고" }, [item()], [{ id: "warehouse-a", name: "창고", group: "테스트" }]), /연결 항목/);
});

test("누적 작업이력은 1000건을 넘겨도 모델과 엑셀에 모두 포함한다", () => {
  const records = Array.from({ length: 1205 }, (_, n) => imported(`history-${n}`, "2026-01-01", { cost: n ? null : 0 }));
  const rows = model.buildEquipmentOverview([item()], records, []);
  assert.equal(rows[0].history.length, 1205);
  const book = workbook.buildEquipmentWorkbook(rows, model.normalizeEquipmentSettings(null), "2026-10-14");
  assert.deepEqual(book.SheetNames, ["크라샤", "전체 작업이력"]);
  assert.equal(XLSX.utils.decode_range(book.Sheets["전체 작업이력"]["!ref"]).e.r, 1205);
  assert.equal(book.Sheets["크라샤"]["!ref"], "A1:N9");
  assert.equal(book.Sheets["크라샤"].G8.t, "n");
  assert.equal(book.Sheets["크라샤"].G8.z, "yyyy-mm-dd");
});

test("엑셀은 최신 5회 총괄표·전체 이력·공통 비고 병합·날짜·금액 형식을 보존한다", () => {
  const items = [item({ shared_note_key: "shared-a", notes: "공통 비고" }), item({ id: "part-b", name: "벨트", shared_note_key: "shared-a", notes: "공통 비고", sort_order: 2 })];
  const history = Array.from({ length: 7 }, (_, n) => imported(`a-${n}`, `2026-01-${String(n + 1).padStart(2, "0")}`, { cost: n === 6 ? 0 : null }));
  const rows = model.buildEquipmentOverview(items, history, [maint({ equipment_vendor: "업체" })]);
  const book = workbook.buildEquipmentWorkbook(rows, model.normalizeEquipmentSettings({ title: "설비현황", common_note: "공통 메모" }), "2026-10-14");
  const summary = book.Sheets["크라샤"], all = book.Sheets["전체 작업이력"];
  assert.equal(summary.G9.v, "업체 · 교체");
  assert.equal(summary.L8.t, "n");
  assert.equal(summary.N8.z, '0.0"일"');
  assert.ok(summary["!merges"].some(m => m.s.r === 7 && m.s.c === 12 && m.e.r === 10));
  assert.equal(all.H2.v, 1100);
  assert.equal(all.H3.v, 0);
  assert.equal(all.H4.v, "");
  const restored = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellStyles: true });
  assert.equal(XLSX.utils.sheet_to_json(restored.Sheets["전체 작업이력"], { header: 1 }).length, 9);
  assert.ok(!JSON.stringify(XLSX.utils.sheet_to_json(all)).includes("maint-a"));
});

test("원본 문자열 날짜는 다운로드를 다시 읽어도 변하지 않는다", () => {
  const raw = "2025-04-11 /\n2025-04-18(상단)";
  const rows = model.buildEquipmentOverview([item()], [imported("raw", null, { date_text: raw, cycle_included: false })], []);
  const book = workbook.buildEquipmentWorkbook(rows, model.normalizeEquipmentSettings(null), "2026-10-14");
  assert.equal(book.Sheets["크라샤"].G8.v, raw);
  assert.equal(book.Sheets["전체 작업이력"].C2.v, raw);
});

function clientForPages(pageResults) {
  const calls = [];
  return { calls, client: { from(table) {
    const query = { select() { return query; }, not(...args) { calls.push(["not", ...args]); return query; }, order(column) { calls.push(["order", column]); return query; },
      async range(from, to) { calls.push([table, from, to]); return pageResults.shift(); } };
    return query;
  } } };
}
test("서비스는 모든 페이지를 가져오고 연결된 정비만 stable 정렬로 읽는다", async () => {
  const { client, calls } = clientForPages([{ data: Array(1000).fill({ id: "a" }), error: null }, { data: [{ id: "b" }], error: null }]);
  const result = await service.createEquipmentService(client).fetchLinkedMaintenances();
  assert.equal(result.data.length, 1001);
  assert.ok(calls.some(c => c[0] === "not" && c[1] === "equipment_item_id"));
  assert.deepEqual(calls.filter(c => c[0] === "maints"), [["maints", 0, 999], ["maints", 1000, 1999]]);
});
test("두 번째 이력 페이지가 실패하면 불완전한 결과를 내보내지 않는다", async () => {
  const { client } = clientForPages([{ data: Array(1000).fill({}), error: null }, { data: null, error: { message: "조회 실패" } }]);
  const result = await service.createEquipmentService(client).fetchImportedHistory();
  assert.equal(result.data, null);
  assert.equal(result.error.message, "조회 실패");
});
test.after(async () => { await Promise.all(generated.map(path => unlink(path).catch(() => undefined))); });
