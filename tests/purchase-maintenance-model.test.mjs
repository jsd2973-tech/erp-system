import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const featureDirectory = new URL("../src/features/purchase/", import.meta.url);
const modelModuleUrl = new URL(`.purchaseModel-${process.pid}.mjs`, featureDirectory);
const historyModuleUrl = new URL(`.purchasePriceHistory-${process.pid}.mjs`, featureDirectory);
const candidateModuleUrl = new URL(`.purchaseMaintenanceModel-${process.pid}.mjs`, featureDirectory);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

const [modelSource, historySource, candidateSource] = await Promise.all([
  readFile(new URL("purchaseModel.ts", featureDirectory), "utf8"),
  readFile(new URL("purchasePriceHistory.ts", featureDirectory), "utf8"),
  readFile(new URL("purchaseMaintenanceModel.ts", featureDirectory), "utf8"),
]);
await Promise.all([
  writeFile(modelModuleUrl, transpile(modelSource)),
  writeFile(historyModuleUrl, transpile(historySource)),
]);
const linkedCandidateSource = candidateSource
  .replace('from "./purchaseModel"', `from "./${modelModuleUrl.pathname.split("/").at(-1)}"`)
  .replace('from "./purchasePriceHistory"', `from "./${historyModuleUrl.pathname.split("/").at(-1)}"`);
await writeFile(candidateModuleUrl, transpile(linkedCandidateSource));
const {
  buildPurchaseMaintenanceCopyCandidates,
  buildPurchaseMaintenanceCopyRows,
  buildPurchaseMaintenanceLinkCandidates,
} = await import(pathToFileURL(candidateModuleUrl.pathname).href);

const purchase = (id, date, rows, warehouse = "E2E 창고") => ({
  id,
  date,
  vendor: `거래처 ${id}`,
  warehouse,
  rows,
  supplyTotal: 0,
  vatTotal: 0,
  total: 0,
  itemSummary: "",
});

const row = (id, item, spec, qty) => ({ id, item, spec, qty, price: 100, supply: 0, vat: 0, total: 0 });

const link = (purchaseId, purchaseRowId, usedQty, maintenanceId = "maint-old") => ({
  id: `link-${purchaseId}-${purchaseRowId}`,
  maintenance_id: maintenanceId,
  maintenance_row_id: "maint-row",
  purchase_id: purchaseId,
  purchase_row_id: purchaseRowId,
  item_name: "베어링",
  spec: "",
  used_qty: usedQty,
  unit_price_snapshot: 100,
  purchase_date_snapshot: "2026-09-27",
  vendor_snapshot: "거래처",
  maintenance_date_snapshot: "2026-09-28",
  maintenance_equipment_snapshot: "E2E 창고",
  maintenance_title_snapshot: "정비",
});

test("구매 연결 후보는 stable row ID와 사용·잔여 수량을 유지하고 동일 규격을 우선한다", () => {
  const purchases = [
    purchase("older", "2026-09-20", [row("row-exact", "베어링", "6204", 4)]),
    purchase("newer", "2026-09-27", [row("row-other-spec", "베어링", "6205", 5)]),
    purchase("used-up", "2026-09-28", [row("row-used-up", "베어링", "6204", 2)]),
    purchase("different", "2026-09-28", [row("row-other-item", "벨트", "6204", 8)]),
  ];
  const candidates = buildPurchaseMaintenanceLinkCandidates({
    open: true,
    targetRow: { id: "maint-row", item: "베어링", spec: "6204", qty: 3 },
    searchText: "",
    editingLinkId: "",
    purchases,
    maintenancePurchaseLinks: [
      link("older", "row-exact", 2),
      link("used-up", "row-used-up", 2),
    ],
    draftLinks: [],
    editingMaintenanceId: "",
  });

  assert.deepEqual(candidates.map(({ purchase, row: purchaseRow }) => [purchase.id, purchaseRow.id]), [
    ["older", "row-exact"],
    ["newer", "row-other-spec"],
  ]);
  assert.equal(candidates[0].rowKey, "older\u001frow-exact");
  assert.equal(candidates[0].usedQty, 2);
  assert.equal(candidates[0].remainingQty, 2);
  assert.equal(candidates[1].remainingQty, 5);
});

test("구매내역에서 정비품목 추가 후보는 같은 창고와 잔여량 기준을 유지한다", () => {
  const purchases = [
    purchase("older", "2026-09-20", [row("row-used", "베어링", "6204", 4), row("row-draft", "벨트", "1050", 3)]),
    purchase("newer", "2026-09-27", [row("row-new", "베어링", "6205", 2)]),
    purchase("other-warehouse", "2026-09-28", [row("row-other", "베어링", "6204", 7)], "다른 창고"),
  ];
  const candidates = buildPurchaseMaintenanceCopyCandidates({
    open: true,
    warehouse: "E2E 창고",
    searchText: "",
    purchases,
    maintenancePurchaseLinks: [link("older", "row-used", 1)],
    draftLinks: [link("older", "row-draft", 1, "")],
    editingMaintenanceId: "",
  });

  assert.deepEqual(candidates.map(({ purchase: candidatePurchase, row: purchaseRow }) => [candidatePurchase.id, purchaseRow.id]), [
    ["newer", "row-new"],
    ["older", "row-used"],
  ]);
  assert.equal(candidates[1].usedQty, 1);
  assert.equal(candidates[1].remainingQty, 3);

  const copied = buildPurchaseMaintenanceCopyRows({
    candidates,
    maintenanceId: "maint-current",
    maintenanceDate: "2026-09-28",
    warehouse: "E2E 창고",
    title: "정기 점검",
    createId: (() => {
      let nextId = 0;
      return () => `maintenance-row-${++nextId}`;
    })(),
  });
  assert.deepEqual(copied.rows.map(({ id, item, qty, price, supply, vat, total }) => ({ id, item, qty, price, supply, vat, total })), [
    { id: "maintenance-row-1", item: "베어링", qty: 2, price: 100, supply: 200, vat: 20, total: 220 },
    { id: "maintenance-row-2", item: "베어링", qty: 3, price: 100, supply: 300, vat: 30, total: 330 },
  ]);
  assert.deepEqual(copied.links.map(({ maintenance_id, maintenance_row_id, purchase_id, purchase_row_id, used_qty, unit_price_snapshot }) => ({
    maintenance_id, maintenance_row_id, purchase_id, purchase_row_id, used_qty, unit_price_snapshot,
  })), [
    { maintenance_id: "maint-current", maintenance_row_id: "maintenance-row-1", purchase_id: "newer", purchase_row_id: "row-new", used_qty: 2, unit_price_snapshot: 100 },
    { maintenance_id: "maint-current", maintenance_row_id: "maintenance-row-2", purchase_id: "older", purchase_row_id: "row-used", used_qty: 3, unit_price_snapshot: 100 },
  ]);
});

test.after(async () => {
  await Promise.all([
    unlink(modelModuleUrl).catch(() => undefined),
    unlink(historyModuleUrl).catch(() => undefined),
    unlink(candidateModuleUrl).catch(() => undefined),
  ]);
});
