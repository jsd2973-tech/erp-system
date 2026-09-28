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
  calculateLinkedMaintenanceItem,
  calculateMaintenanceTotals,
  createEmptyMaintItem,
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

test.after(async () => {
  await unlink(modulePath).catch(() => undefined);
});
