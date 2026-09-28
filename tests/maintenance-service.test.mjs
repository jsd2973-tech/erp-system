import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const maintenanceDirectory = new URL("../src/features/maintenance/", import.meta.url);
const purchaseDirectory = new URL("../src/features/purchase/", import.meta.url);
const dependencyPath = new URL(".maintenance-service-purchase-model-" + process.pid + ".mjs", maintenanceDirectory);
const linkServicePath = new URL(".maintenance-purchase-link-service-" + process.pid + ".mjs", maintenanceDirectory);
const maintenanceServicePath = new URL(".maintenance-service-" + process.pid + ".mjs", maintenanceDirectory);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

const purchaseModel = await readFile(new URL("purchaseModel.ts", purchaseDirectory), "utf8");
await writeFile(dependencyPath, transpile(purchaseModel));
const linkServiceSource = (await readFile(new URL("maintenancePurchaseLinkService.ts", maintenanceDirectory), "utf8"))
  .replace('from "../purchase/purchaseModel"', 'from "./' + dependencyPath.pathname.split("/").at(-1) + '"');
await writeFile(linkServicePath, transpile(linkServiceSource));
await writeFile(maintenanceServicePath, transpile(await readFile(new URL("maintenanceService.ts", maintenanceDirectory), "utf8")));
const { createMaintenancePurchaseLinkService, getMaintenancePurchaseLinkChanges } = await import(pathToFileURL(linkServicePath.pathname).href);
const { createMaintenanceService } = await import(pathToFileURL(maintenanceServicePath.pathname).href);

const link = (id, patch = {}) => ({
  id, maintenance_id: "maint-1", maintenance_row_id: "maint-row-1",
  purchase_id: "purchase-1", purchase_row_id: "purchase-row-1",
  item_name: "베어링", spec: "6204", used_qty: 2, unit_price_snapshot: 100,
  purchase_date_snapshot: "2026-09-20", vendor_snapshot: "거래처",
  maintenance_date_snapshot: "2026-09-28", maintenance_equipment_snapshot: "창고",
  maintenance_title_snapshot: "정비", ...patch,
});

const createLinkSupabaseMock = ({ failFirstSelectedInsert = false } = {}) => {
  const calls = [];
  let selectedInsertCount = 0;
  const client = {
    from(table) {
      const call = { table };
      calls.push(call);
      return {
        delete() {
          call.delete = true;
          return { eq(column, value) { call.eq = [column, value]; return Promise.resolve({ error: null }); } };
        },
        insert(rows) {
          call.insert = rows;
          return {
            select(columns) {
              call.select = columns;
              selectedInsertCount += 1;
              return Promise.resolve(failFirstSelectedInsert && selectedInsertCount === 1
                ? { data: null, error: { message: "insert failed" } }
                : { data: rows, error: null });
            },
            then(resolve, reject) {
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            },
          };
        },
        select(columns) { call.select = columns; return this; },
        eq(column, value) { call.eq = [column, value]; return Promise.resolve({ data: [link("old-link")], error: null }); },
      };
    },
  };
  return { client, calls };
};

test("정비 연결 service는 기존과 신규 link를 구분해 기록하고 기존 수량을 복구한다", async () => {
  const previous = [link("old-link")];
  const next = [link("", { used_qty: 1 })];
  const { client, calls } = createLinkSupabaseMock();
  const service = createMaintenancePurchaseLinkService(client);

  const result = await service.replaceForMaintenance("maint-1", next, previous);
  assert.equal(result.error, null);
  assert.equal(result.changed, true);
  assert.equal(result.added[0].used_qty, 1);
  assert.equal(result.removed[0].id, "old-link");
  assert.deepEqual(calls[0], {
    table: "maintenance_purchase_links", delete: true, eq: ["maintenance_id", "maint-1"],
  });
  assert.equal(calls[1].insert[0].maintenance_id, "maint-1");
  assert.equal(calls[1].insert[0].used_qty, 1);

  await service.restoreMaintenanceLinks("maint-1", previous);
  assert.equal(calls[2].insert[0].id, "old-link");
  assert.equal(calls[2].insert[0].used_qty, 2);
  assert.equal(calls[2].insert[0].maintenance_id, "maint-1");
  assert.deepEqual(getMaintenancePurchaseLinkChanges(previous, previous).added, []);
});

test("정비 연결 새 저장이 실패하면 지운 기존 link를 다시 insert한다", async () => {
  const previous = [link("old-link")];
  const { client, calls } = createLinkSupabaseMock({ failFirstSelectedInsert: true });
  const result = await createMaintenancePurchaseLinkService(client)
    .replaceForMaintenance("maint-1", [link("", { used_qty: 3 })], previous);

  assert.equal(result.stage, "insert");
  assert.equal(result.error.message, "insert failed");
  assert.equal(calls.length, 3);
  assert.equal(calls[2].insert[0].id, "old-link");
  assert.equal(calls[2].insert[0].used_qty, 2);
});

test("정비 조회·저장·삭제와 첨부 업로드 query를 기존 순서대로 사용한다", async () => {
  const calls = [];
  let fetchPage = 0;
  const client = {
    from(table) {
      const call = { table };
      calls.push(call);
      return {
        select(columns) { call.select = columns; return this; },
        order(column, options) { call.order = { column, ...options }; return this; },
        range(from, to) {
          call.range = [from, to];
          fetchPage += 1;
          return Promise.resolve({ data: fetchPage === 1 ? Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })) : [{ id: "last" }], error: null });
        },
        upsert(row) { call.upsert = row; return Promise.resolve({ error: null }); },
        delete() {
          call.delete = true;
          return { eq(column, value) { call.eq = [column, value]; return Promise.resolve({ error: null }); } };
        },
      };
    },
    storage: {
      from(bucket) {
        return {
          upload(name, file, options) {
            calls.push({ table: "storage", bucket, name, file, options });
            return Promise.resolve({ error: name.endsWith(".wav") ? { message: "storage unavailable" } : null });
          },
          getPublicUrl(name) {
            return { data: { publicUrl: "https://storage.example/receipts/" + name } };
          },
        };
      },
    },
  };
  const service = createMaintenanceService(client);
  const fetched = await service.fetchMaintenances();
  assert.equal(fetched.data.length, 1001);
  assert.deepEqual(calls.slice(0, 2).map(({ order, range }) => ({ order, range })), [
    { order: { column: "date", ascending: false }, range: [0, 999] },
    { order: { column: "date", ascending: false }, range: [1000, 1999] },
  ]);

  await service.saveMaintenance({ id: "maint-1" });
  await service.deleteMaintenance("maint-1");
  assert.deepEqual(calls[2].upsert, { id: "maint-1" });
  assert.deepEqual(calls[3], { table: "maints", delete: true, eq: ["id", "maint-1"] });

  const image = new File(["image"], "receipt.png", { type: "image/png" });
  const audio = new File(["audio"], "note.wav", { type: "audio/wav" });
  const alerts = [];
  const urls = await service.uploadAttachments([image, audio], {
    validateFiles: (files) => Array.from(files),
    compressImage: async (file) => new File([file], "compressed.jpg", { type: "image/jpeg" }),
    getFileExtension: (file) => file.name.split(".").pop() || "bin",
  }, (fileName, message) => alerts.push(fileName + ": " + message));

  assert.equal(urls.length, 1);
  assert.match(urls[0], /\.jpg$/);
  assert.deepEqual(alerts, ["note.wav: storage unavailable"]);
  assert.deepEqual(calls.filter((call) => call.table === "storage").map((call) => call.options.contentType), ["image/jpeg", "audio/wav"]);
  assert.match(calls.find((call) => call.table === "storage" && call.options.contentType === "image/jpeg").name, /^maint-.*\.jpg$/);
});

test.after(async () => {
  await Promise.all([
    unlink(dependencyPath).catch(() => undefined),
    unlink(linkServicePath).catch(() => undefined),
    unlink(maintenanceServicePath).catch(() => undefined),
  ]);
});
