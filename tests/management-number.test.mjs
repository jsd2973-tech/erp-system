import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const targets = [
  ["purchase", "../src/features/purchase/purchaseModel.ts"],
  ["card", "../src/features/card/cardModel.ts"],
  ["maintenance", "../src/features/maintenance/maintenanceModel.ts"],
];

const modulePaths = [];

const loadTsModule = async (name, relativePath) => {
  const sourcePath = new URL(relativePath, import.meta.url);
  const modulePath = new URL(`../src/features/.${name}-management-number-${process.pid}.mjs`, import.meta.url);
  modulePaths.push(modulePath);
  const source = await readFile(sourcePath, "utf8");
  await writeFile(modulePath, ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText);
  return import(pathToFileURL(modulePath.pathname).href);
};

const purchaseModel = await loadTsModule(...targets[0]);
const cardModel = await loadTsModule(...targets[1]);
const maintenanceModel = await loadTsModule(...targets[2]);

test("구매 관리번호는 필터 결과가 달라져도 전체 원본 기준 번호를 유지한다", () => {
  const rows = [
    { id: "c", date: "2026-10-01", vendor: "C", warehouse: "W", rows: [], supplyTotal: 0, vatTotal: 0, total: 0, itemSummary: "" },
    { id: "a", date: "2026-10-01", vendor: "A", warehouse: "W", rows: [], supplyTotal: 0, vatTotal: 0, total: 0, itemSummary: "" },
    { id: "b", date: "2026-10-01", vendor: "B", warehouse: "W", rows: [], supplyTotal: 0, vatTotal: 0, total: 0, itemSummary: "" },
  ];
  const all = purchaseModel.filterPurchases(rows, purchaseModel.createEmptyPurchaseSearch());
  const filtered = purchaseModel.filterPurchases(rows, { ...purchaseModel.createEmptyPurchaseSearch(), vendor: "B" });
  assert.equal(all.find((row) => row.id === "b").managementNo, "2026-10-01-02");
  assert.equal(filtered[0].managementNo, "2026-10-01-02");
});

test("구매 전체 초기화는 지급상태·수취상태까지 해제한다", () => {
  assert.deepEqual(purchaseModel.createEmptyPurchaseSearch(), {
    from: "", to: "", vendor: "", warehouse: "", item: "", taxInvoice: "", paymentStatus: "", receiptStatus: "",
  });
});

test("카드 관리번호는 담당자 필터와 무관하게 전체 원본 기준으로 유지한다", () => {
  const rows = [
    { id: "c", date: "2026-10-01", user_name: "박", place: "C", amount: 1 },
    { id: "a", date: "2026-10-01", user_name: "김", place: "A", amount: 1 },
    { id: "b", date: "2026-10-01", user_name: "이", place: "B", amount: 1 },
  ];
  const map = cardModel.buildCardNumberMap(rows);
  assert.equal(map.get("b"), "2026-10-01-02");
  assert.equal(map.get("b"), cardModel.buildCardNumberMap(rows.filter((row) => row.id !== "a").concat(rows.find((row) => row.id === "a"))).get("b"));
});

test("정비 관리번호는 검색 후에도 전체 원본 기준 번호를 유지한다", () => {
  const rows = [
    { id: "c", date: "2026-10-01", warehouse: "서부", manager: "박", title: "C", detail: "" },
    { id: "a", date: "2026-10-01", warehouse: "동부", manager: "김", title: "A", detail: "" },
    { id: "b", date: "2026-10-01", warehouse: "동부", manager: "이", title: "B", detail: "" },
  ];
  const filtered = maintenanceModel.filterAndSortMaintenances(rows, {
    from: "", to: "", warehouse: "동부", keyword: "B",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "b");
  assert.equal(filtered[0].managementNo, "2026-10-01-02");
});

test.after(async () => {
  await Promise.all(modulePaths.map((modulePath) => unlink(modulePath).catch(() => undefined)));
});
