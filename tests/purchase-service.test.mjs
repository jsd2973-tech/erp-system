import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const modelSourcePath = new URL("../src/features/purchase/purchaseModel.ts", import.meta.url);
const serviceSourcePath = new URL("../src/features/purchase/purchaseService.ts", import.meta.url);
const modelModulePath = new URL(`../src/features/purchase/.purchaseModel-${process.pid}.mjs`, import.meta.url);
const serviceModulePath = new URL(`../src/features/purchase/.purchaseService-${process.pid}.mjs`, import.meta.url);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

await writeFile(modelModulePath, transpile(await readFile(modelSourcePath, "utf8")));
const serviceSource = (await readFile(serviceSourcePath, "utf8"))
  .replace('from "./purchaseModel"', `from "./.purchaseModel-${process.pid}.mjs"`);
await writeFile(serviceModulePath, transpile(serviceSource));
const { createPurchaseService } = await import(pathToFileURL(serviceModulePath.pathname).href);

const makePurchase = (id, patch = {}) => ({
  id,
  date: "2026-09-28",
  vendor: "E2E 거래처",
  warehouse: "E2E 창고",
  rows: [{ id: `row-${id}`, item: "E2E 품목", spec: "규격", qty: 4, price: 910000, supply: 3640000, vat: 364000, total: 4004000 }],
  supplyTotal: 3640000,
  vatTotal: 364000,
  total: 4004000,
  itemSummary: "E2E 품목",
  paymentStatus: "unpaid",
  ...patch,
});

const createSupabaseMock = () => {
  const calls = [];
  const client = {
    from(table) {
      const call = { table };
      calls.push(call);
      const query = {
        select(columns) { call.select = columns; return this; },
        order(column, options) { call.order = { column, ...options }; return this; },
        range(from, to) {
          call.range = [from, to];
          const data = table === "purchases" && from === 0
            ? Array.from({ length: 1000 }, (_, index) => ({ id: `purchase-${index}` }))
            : table === "purchases" && from === 1000
              ? [{ id: "purchase-last" }]
              : [];
          return Promise.resolve({ data, error: null });
        },
        upsert(rows) { call.upsert = rows; return Promise.resolve({ error: null }); },
        update(fields) {
          call.update = fields;
          return {
            eq(column, value) { call.eq = [column, value]; return Promise.resolve({ error: null }); },
            in(column, values) { call.in = [column, values]; return Promise.resolve({ error: null }); },
          };
        },
        delete() {
          call.delete = true;
          return { eq(column, value) { call.eq = [column, value]; return Promise.resolve({ error: null }); } };
        },
        eq(column, value) { call.eq = [column, value]; return this; },
        returns() { return Promise.resolve({ data: [], error: null }); },
      };
      return query;
    },
  };
  return { client, calls };
};

test("구매와 연결 조회의 페이지 크기·정렬 순서를 유지한다", async () => {
  const { client, calls } = createSupabaseMock();
  const service = createPurchaseService(client);

  const purchases = await service.fetchPurchases(false);
  assert.equal(purchases.data.length, 1001);
  assert.deepEqual(calls.slice(0, 2).map((call) => call.range), [[0, 999], [1000, 1999]]);
  assert.deepEqual(calls[0].order, { column: "date", ascending: false });

  await service.fetchPurchases(true);
  assert.deepEqual(calls[2].order, { column: "date", ascending: true });

  await service.fetchMaintenancePurchaseLinks();
  assert.deepEqual(calls[4], {
    table: "maintenance_purchase_links",
    select: "*",
    order: { column: "created_at", ascending: false },
    range: [0, 999],
  });
});

test("구매 CRUD, 지급, 첨부 쿼리의 payload와 청크 처리를 유지한다", async () => {
  const { client, calls } = createSupabaseMock();
  const service = createPurchaseService(client);
  const purchase = makePurchase("purchase-1");

  await service.savePurchaseRecord(purchase);
  assert.deepEqual(calls.at(-1).upsert, {
    id: "purchase-1",
    date: "2026-09-28",
    vendor: "E2E 거래처",
    warehouse: "E2E 창고",
    rows: purchase.rows,
    supplytotal: 3640000,
    vattotal: 364000,
    total: 4004000,
    itemsummary: "E2E 품목",
    tax_invoice_received: false,
    payment_status: "unpaid",
    paid_date: null,
    image_url: "",
    image_urls: [],
  });

  await service.updatePurchasePayment(purchase.id, "paid", "2026-09-28");
  assert.deepEqual(calls.at(-1).update, { payment_status: "paid", paid_date: "2026-09-28" });
  assert.deepEqual(calls.at(-1).eq, ["id", purchase.id]);
  await service.updatePurchasesPayment([purchase.id, "purchase-2"], "2026-09-28");
  assert.deepEqual(calls.at(-1).in, ["id", [purchase.id, "purchase-2"]]);
  await service.updatePurchaseTaxInvoice(purchase.id, true);
  assert.deepEqual(calls.at(-1).update, { tax_invoice_received: true });
  await service.updatePurchaseImages(purchase.id, ["https://example.test/receipt.png"]);
  assert.deepEqual(calls.at(-1).update, {
    image_urls: ["https://example.test/receipt.png"],
    image_url: "https://example.test/receipt.png",
  });
  await service.fetchPurchaseLinkReferences(purchase.id);
  assert.deepEqual(calls.at(-1).select, "id, maintenance_id, maintenance_row_id, used_qty");
  assert.deepEqual(calls.at(-1).eq, ["purchase_id", purchase.id]);
  await service.deletePurchaseRecord(purchase.id);
  assert.equal(calls.at(-1).delete, true);
  assert.deepEqual(calls.at(-1).eq, ["id", purchase.id]);

  const batch = Array.from({ length: 501 }, (_, index) => makePurchase(`batch-${index}`));
  assert.equal(await service.upsertPurchasesInChunks(batch), null);
  const upsertCalls = calls.filter((call) => call.table === "purchases" && call.upsert);
  assert.deepEqual(upsertCalls.slice(-2).map((call) => call.upsert.length), [500, 1]);
});

test.after(async () => {
  await Promise.all([unlink(modelModulePath), unlink(serviceModulePath)].map((result) => result.catch(() => undefined)));
});
