import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const sourcePath = new URL("../src/features/maintenance/maintenanceModel.ts", import.meta.url);
const modulePath = new URL("../src/features/maintenance/.maintenanceModel-" + process.pid + ".mjs", import.meta.url);
const source = await readFile(sourcePath, "utf8");
await writeFile(modulePath, ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText);
const {
  buildMaintenanceEditData,
  calculateLinkedMaintenanceItem,
  calculateMaintenanceTotals,
  buildMaintenanceSuggestedItems,
  buildMaintenanceTemplateData,
  buildMaintenanceNumberMap,
  createMaintenanceItemFromSuggestion,
  createEmptyMaintItem,
  filterMaintenanceTemplateRecords,
  filterAndSortMaintenances,
  sumMaintenanceRowTotals,
  updateMaintenanceItem,
  validateMaintenancePurchaseLinkQuantity,
} = await import(pathToFileURL(modulePath.pathname).href);

test("정비 품목 계산은 row ID를 유지하고 공급가·VAT·합계를 기존 규칙대로 갱신한다", () => {
  const original = { ...createEmptyMaintItem("maint-row-1"), item: "베어링", qty: "2", price: "100" };
  const updated = updateMaintenanceItem([original], 0, "price", "250");
  assert.equal(updated[0].id, "maint-row-1");
  assert.deepEqual([updated[0].supply, updated[0].vat, updated[0].total], [500, 50, 550]);
  assert.deepEqual(calculateLinkedMaintenanceItem(updated[0], 300), {
    ...updated[0], price: 300, supply: 600, vat: 60, total: 660,
  });
});

test("정비 header 합계는 품목과 양수 수량이 있는 행만 포함한다", () => {
  const items = [
    { ...createEmptyMaintItem("a"), item: "베어링", qty: 2, supply: 500, vat: 50, total: 550 },
    { ...createEmptyMaintItem("b"), item: "", qty: 4, supply: 900, vat: 90, total: 990 },
    { ...createEmptyMaintItem("c"), item: "벨트", qty: 0, supply: 120, vat: 12, total: 132 },
  ];
  assert.deepEqual(calculateMaintenanceTotals(items), {
    validItems: [items[0]], supplyTotal: 500, vatTotal: 50, total: 550,
  });
  assert.equal(sumMaintenanceRowTotals(items), 1672);
});

test("구매 연결 수량 validation은 row와 구매 잔여량 한도를 모두 지킨다", () => {
  const base = { usedQty: 2, maintenanceQty: 3, remainingQty: 2, linkedQtyForMaintenanceRow: 1 };
  assert.deepEqual(validateMaintenancePurchaseLinkQuantity(base), { valid: true });
  assert.deepEqual(validateMaintenancePurchaseLinkQuantity({ ...base, usedQty: 0 }), {
    valid: false, reason: "non-positive-quantity",
  });
  assert.deepEqual(validateMaintenancePurchaseLinkQuantity({ ...base, usedQty: 3 }), {
    valid: false, reason: "purchase-remaining-exceeded", remainingQty: 2,
  });
  assert.deepEqual(validateMaintenancePurchaseLinkQuantity({ ...base, linkedQtyForMaintenanceRow: 2 }), {
    valid: false, reason: "maintenance-row-quantity-exceeded", linkedQty: 2, maintenanceQty: 3,
  });
});

test("정비 조회 필터와 정렬은 기존 날짜·창고·검색어 규칙을 유지한다", () => {
  const maints = [
    { id: "b", date: "2026-09-27", warehouse: "동부", title: "수리", detail: "베어링", manager: "김" },
    { id: "a", date: "2026-09-27", warehouse: "동부", title: "점검", detail: "벨트", manager: "이" },
    { id: "c", date: "2026-09-26", warehouse: "서부", title: "수리", detail: "모터", manager: "박" },
  ];
  assert.deepEqual(filterAndSortMaintenances(maints, {
    from: "2026-09-27", to: "2026-09-27", warehouse: "동부", keyword: "수리",
  }).map((m) => m.id), ["b"]);
  assert.deepEqual(filterAndSortMaintenances(maints, {
    from: "", to: "", warehouse: "", keyword: "",
  }).map((m) => m.id), ["b", "a", "c"]);
});

test("관리번호는 날짜별 오름차순 ID 순번을 유지한다", () => {
  const map = buildMaintenanceNumberMap([
    { id: "b", date: "2026-09-27" },
    { id: "a", date: "2026-09-27" },
    { id: "c", date: "2026-09-26" },
  ]);
  assert.equal(map.get("a"), "2026-09-27-01");
  assert.equal(map.get("b"), "2026-09-27-02");
  assert.equal(map.get("c"), "2026-09-26-01");
});

test("창고별 정비 추천은 편집 중인 정비를 제외하고 빈도·최신 내역 규칙을 유지한다", () => {
  const suggestions = buildMaintenanceSuggestedItems([
    { id: "old", date: "2026-09-01", warehouse: "Site A", items: [{ item: "필터", spec: "구형", qty: 1, price: 100 }] },
    { id: "mid", date: "2026-09-15", warehouse: " site a ", items: [
      { item: "필터", spec: "신형", qty: 2, price: 200 },
      { item: "그리스", spec: "통", qty: 1, price: 50 },
    ] },
    { id: "editing", date: "2026-09-20", warehouse: "Site A", items: [{ item: "필터", spec: "편집중", qty: 9, price: 900 }] },
    { id: "other", date: "2026-09-30", warehouse: "Site B", items: [{ item: "필터", spec: "타창고", qty: 3, price: 300 }] },
  ], "sitea", "editing");
  assert.deepEqual(suggestions, [
    { item: "필터", spec: "신형", qty: 2, price: 200, count: 2, lastDate: "2026-09-15" },
    { item: "그리스", spec: "통", qty: 1, price: 50, count: 1, lastDate: "2026-09-15" },
  ]);
});

test("이전 정비 템플릿은 검색하고 현재 편집 건을 빼고 날짜 내림차순으로 보여준다", () => {
  const records = [
    { id: "older", date: "2026-09-10", warehouse: "동부", title: "필터 교체", items: [{ item: "필터", spec: "A" }] },
    { id: "newer", date: "2026-09-20", warehouse: "서부", title: "펌프 수리", items: [{ item: "펌프", spec: "B" }] },
    { id: "editing", date: "2026-09-25", warehouse: "동부", title: "필터 직접 수정", items: [] },
  ];
  assert.deepEqual(filterMaintenanceTemplateRecords(records, " 필터 ", "editing").map((record) => record.id), ["older"]);
  assert.deepEqual(filterMaintenanceTemplateRecords(records, "", "editing").map((record) => record.id), ["newer", "older"]);
});

test("정비 수정 데이터는 기존 row ID와 첨부 fallback을 유지한다", () => {
  let nextId = 0;
  const editData = buildMaintenanceEditData({
    id: "maintenance-1", date: "2026-09-28", warehouse: "동부", manager: "김", title: "점검", detail: "내용", cost: 330,
    image_url: "receipt.jpg",
    items: [
      { ...createEmptyMaintItem("stable-row"), item: "필터", qty: 2, price: 150, supply: 300, vat: 30, total: 330 },
      { ...createEmptyMaintItem(""), item: "볼트", qty: 1, price: 0, supply: 0, vat: 0, total: 0 },
    ],
  }, () => `generated-${++nextId}`);
  assert.equal(editData.form.image_urls[0], "receipt.jpg");
  assert.equal(editData.items[0].id, "stable-row");
  assert.notEqual(editData.items[1].id, "");
  assert.equal(editData.items[0].total, 330);
});

test("정비 추천 품목과 이전 작업 품목은 기존 가격·수량 계산 및 새 stable ID를 유지한다", () => {
  const suggested = createMaintenanceItemFromSuggestion(
    { item: " 필터 ", qty: 0 }, { name: "필터", spec: "A", price: 125 }, () => "suggested-row",
  );
  assert.deepEqual(suggested, {
    id: "suggested-row", item: "필터", spec: "A", qty: 1, price: 125,
    supply: 125, vat: 13, total: 138,
  });

  const template = buildMaintenanceTemplateData({
    id: "old", date: "2026-09-01", warehouse: "동부", manager: "김", title: "작업", detail: "",
    cost: 0, items: [{ ...createEmptyMaintItem("old-row"), item: "필터", qty: "2", price: "100", supply: 0, vat: 0, total: 0 }],
  }, () => "template-row");
  assert.deepEqual(template.items.map((row) => [row.id, row.qty, row.supply, row.vat, row.total]), [
    ["template-row", "2", 200, 20, 220],
  ]);
  assert.equal(template.total, 220);
});

test.after(async () => {
  await unlink(modulePath).catch(() => undefined);
});
