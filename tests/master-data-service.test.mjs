import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const featureDirectory = new URL("../src/features/master-data/", import.meta.url);
const modulePath = new URL(`.masterDataService-${process.pid}.mjs`, featureDirectory);
const source = await readFile(new URL("masterDataService.ts", featureDirectory), "utf8");
await writeFile(modulePath, ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText);
const { createMasterDataService } = await import(pathToFileURL(modulePath.pathname).href);

const makeClient = ({ results = {} } = {}) => {
  const calls = [];
  const counts = new Map();
  const client = {
    from(table) {
      const call = { table };
      calls.push(call);
      const tableCallCount = counts.get(table) || 0;
      counts.set(table, tableCallCount + 1);
      const result = results[table]?.[tableCallCount] || {};
      const query = {
        select(columns) { call.select = columns; return this; },
        order(column, options) { call.order = { column, ...options }; return this; },
        range(from, to) { call.range = [from, to]; return this; },
        upsert(rows, options) { call.upsert = rows; call.options = options; return this; },
        insert(rows) { call.insert = rows; return this; },
        update(fields) { call.update = fields; return this; },
        delete() { call.delete = true; return this; },
        eq(column, value) { call.eq = [column, value]; return this; },
        neq(column, value) { call.neq = [column, value]; return this; },
        in(column, values) { call.in = [column, values]; return this; },
        then(resolve, reject) {
          return Promise.resolve({ data: result.data ?? [], error: result.error ?? null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, calls };
};

test("master data fetch keeps all four table names, code ordering and 1000 row pages", async () => {
  const { client, calls } = makeClient();
  const result = await createMasterDataService(client).fetchMasterData();
  assert.deepEqual(Object.keys(result), ["vendors", "groups", "warehouses", "items"]);
  assert.deepEqual(calls.map(({ table, select, order, range }) => ({ table, select, order, range })), [
    { table: "vendors", select: "*", order: { column: "code", ascending: true }, range: [0, 999] },
    { table: "warehouse_groups", select: "*", order: { column: "code", ascending: true }, range: [0, 999] },
    { table: "warehouses", select: "*", order: { column: "code", ascending: true }, range: [0, 999] },
    { table: "items", select: "*", order: { column: "code", ascending: true }, range: [0, 999] },
  ]);
});

test("imported item upserts keep 500 row batches", async () => {
  const { client, calls } = makeClient();
  const rows = Array.from({ length: 501 }, (_, index) => ({ id: `item-${index}` }));
  assert.equal(await createMasterDataService(client).upsertImportedItems(rows), null);
  assert.deepEqual(calls.map((call) => call.upsert.length), [500, 1]);
});

test("vendor and item delete queries keep trash-compatible record and clear predicates", async () => {
  const { client, calls } = makeClient();
  const service = createMasterDataService(client);
  await service.deleteVendor("vendor-1");
  await service.deleteAllVendors();
  await service.deleteItem("item-1");
  await service.deleteAllItems();
  assert.deepEqual(calls.map(({ table, delete: deleted, eq, neq }) => ({ table, delete: deleted, eq, neq })), [
    { table: "vendors", delete: true, eq: ["id", "vendor-1"], neq: undefined },
    { table: "vendors", delete: true, eq: undefined, neq: ["id", ""] },
    { table: "items", delete: true, eq: ["id", "item-1"], neq: undefined },
    { table: "items", delete: true, eq: undefined, neq: ["id", ""] },
  ]);
});

test("failed warehouse group rename restores changed warehouses and prior group", async () => {
  const { client, calls } = makeClient({
    results: { warehouses: [{ data: [{ id: "w1" }] }] },
  });
  const service = createMasterDataService(client);
  const result = await service.saveWarehouseGroup(
    { id: "g1", code: "0001", name: "새 분류" },
    { id: "g1", code: "0001", name: "기존 분류" },
    [
      { id: "w1", code: "0001", group: "기존 분류", name: "창고1" },
      { id: "w2", code: "0002", group: "기존 분류", name: "창고2" },
    ],
  );
  assert.deepEqual(result, {
    stage: "warehouse-rename",
    error: { message: "일부 세부창고가 변경되지 않았습니다." },
    rollbackError: null,
  });
  assert.deepEqual(calls[1].update, { group: "새 분류" });
  assert.deepEqual(calls[1].in, ["id", ["w1", "w2"]]);
  assert.equal(calls[1].select, "id, group");
  assert.deepEqual(calls[2].update, { group: "기존 분류" });
  assert.deepEqual(calls[2].in, ["id", ["w1"]]);
  assert.deepEqual(calls[3].upsert, { id: "g1", code: "0001", name: "기존 분류" });
});

test.after(async () => {
  await unlink(modulePath).catch(() => undefined);
});
