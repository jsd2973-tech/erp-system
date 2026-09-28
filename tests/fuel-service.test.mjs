import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const featureDirectory = new URL("../src/features/fuel/", import.meta.url);
const modelPath = new URL(`.fuelModel-service-${process.pid}.mjs`, featureDirectory);
const servicePath = new URL(`.fuelService-${process.pid}.mjs`, featureDirectory);
const receiptServicePath = new URL(`.fuelReceiptService-${process.pid}.mjs`, featureDirectory);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

await writeFile(modelPath, transpile(await readFile(new URL("fuelModel.ts", featureDirectory), "utf8")));
const serviceSource = (await readFile(new URL("fuelService.ts", featureDirectory), "utf8"))
  .replace('from "./fuelModel"', `from "./${modelPath.pathname.split("/").at(-1)}"`);
await writeFile(servicePath, transpile(serviceSource));
await writeFile(receiptServicePath, transpile(await readFile(new URL("fuelReceiptService.ts", featureDirectory), "utf8")));
const { getFuelRecords, getFuelMasterOptions, importFuelRows, insertFuelRecord, updateFuelRecord, deleteFuelRecord } =
  await import(pathToFileURL(servicePath.pathname).href);
const { uploadFuelRecordReceipt, getFuelReceiptSignedUrl, clearFuelRecordReceipt, uploadFuelReceiptForNewRecord } =
  await import(pathToFileURL(receiptServicePath.pathname).href);

const createSupabaseMock = ({ data = [], updateError = null, uploadError = null } = {}) => {
  const calls = [];
  const client = {
    from(table) {
      const call = { table };
      calls.push(call);
      const query = {
        select(columns) { call.select = columns; return this; },
        gte(column, value) { (call.gte ||= []).push([column, value]); return this; },
        lte(column, value) { (call.lte ||= []).push([column, value]); return this; },
        order(column, options) { (call.orders ||= []).push({ column, ...options }); return this; },
        limit(value) { call.limit = value; return this; },
        upsert(rows, options) { call.upsert = rows; call.upsertOptions = options; return Promise.resolve({ error: null }); },
        insert(payload) { call.insert = payload; return Promise.resolve({ error: null }); },
        update(payload) {
          call.update = payload;
          return { eq(column, value) { call.eq = [column, value]; return Promise.resolve({ error: updateError }); } };
        },
        delete() {
          call.delete = true;
          return { eq(column, value) { call.eq = [column, value]; return Promise.resolve({ error: null }); } };
        },
        then(resolve, reject) { return Promise.resolve({ data, error: null }).then(resolve, reject); },
      };
      return query;
    },
    storage: {
      from(bucket) {
        return {
          upload(path, file, options) {
            calls.push({ kind: "upload", bucket, path, file, options });
            return Promise.resolve({ error: uploadError });
          },
          remove(paths) {
            calls.push({ kind: "remove", bucket, paths });
            return Promise.resolve({ error: null });
          },
          createSignedUrl(path, expiresIn) {
            calls.push({ kind: "signed-url", bucket, path, expiresIn });
            return Promise.resolve({ data: { signedUrl: "https://storage.example/signed" }, error: null });
          },
        };
      },
    },
  };
  return { client, calls };
};

test("유류 조회 service는 월 필터·정렬·정규화를 유지한다", async () => {
  const row = {
    id: "fuel-1", fuel_date: "2026-09-20", vehicle_number: "차량1", quantity: "12.5",
    total_amount: "24750", usage_count: 1, line_amount: "22500", unit_price: "1800",
    supply_amount: "22500", vat_amount: "2250", site_name: "공장", product_name: "경유", station_name: "주유소",
  };
  const { client, calls } = createSupabaseMock({ data: [row] });
  const result = await getFuelRecords(client, "2026-09");
  assert.deepEqual(calls[0], {
    table: "fuel_records", select: "*",
    gte: [["fuel_date", "2026-09-01"]], lte: [["fuel_date", "2026-09-30"]],
    orders: [{ column: "fuel_date", ascending: false }, { column: "vehicle_number", ascending: true }],
  });
  assert.equal(result.data[0].quantity, 12.5);
  assert.equal(result.data[0].total_amount, 24750);
});

test("유류 기초·가져오기·직접 저장·수정·삭제 쿼리를 기존 payload로 위임한다", async () => {
  const { client, calls } = createSupabaseMock({ data: [{ id: "site-1", category: "site", name: "공장", is_active: true }] });
  const options = await getFuelMasterOptions(client);
  assert.deepEqual(options.data, [{ id: "site-1", category: "site", name: "공장", is_active: true, updated_at: undefined }]);

  const rows = [{ fuel_date: "2026-09-20", source_fingerprint: "fuel-abcd" }];
  await importFuelRows(client, rows);
  await insertFuelRecord(client, { vehicle_number: "차량1", quantity: 1 });
  await updateFuelRecord(client, "fuel-1", { fuel_date: "2026-09-20", site_name: "공장", product_name: "경유", vehicle_number: "차량1", station_name: "주유소", memo: "", updated_at: "2026-09-28T00:00:00.000Z" });
  await deleteFuelRecord(client, "fuel-1");
  assert.deepEqual(calls[1].upsert, rows);
  assert.deepEqual(calls[1].upsertOptions, { onConflict: "source_fingerprint", ignoreDuplicates: true });
  assert.deepEqual(calls[2].insert, { vehicle_number: "차량1", quantity: 1 });
  assert.deepEqual(calls[3].update, { fuel_date: "2026-09-20", site_name: "공장", product_name: "경유", vehicle_number: "차량1", station_name: "주유소", memo: "", updated_at: "2026-09-28T00:00:00.000Z" });
  assert.deepEqual(calls[4], { table: "fuel_records", delete: true, eq: ["id", "fuel-1"] });
});

test("영수증 교체는 새 저장 성공 후 기존 파일을 정리하고 실패 시 새 파일을 되돌린다", async () => {
  const file = new File(["receipt"], "receipt.jpg", { type: "image/jpeg" });
  const { client, calls } = createSupabaseMock();
  const result = await uploadFuelRecordReceipt(client, { id: "fuel-1", receipt_path: "fuel/fuel-1/old.jpg" }, file);
  assert.equal(result.error, null);
  assert.equal(calls[0].kind, "upload");
  assert.match(calls[0].path, /^fuel\/fuel-1\/\d+-[\w-]+\.jpg$/);
  assert.deepEqual(calls[1].update, result.patch);
  assert.deepEqual(calls[2], { kind: "remove", bucket: "fuel-receipts", paths: ["fuel/fuel-1/old.jpg"] });

  const failing = createSupabaseMock({ updateError: { message: "db unavailable" } });
  const failedResult = await uploadFuelRecordReceipt(failing.client, { id: "fuel-1", receipt_path: null }, file);
  assert.match(failedResult.error, /db unavailable/);
  assert.equal(failing.calls[2].kind, "remove");
  assert.equal(failing.calls.length, 3);
});

test("영수증 미리보기 TTL과 삭제 순서를 유지하고 신규 정비 첨부 저장 실패는 파일을 정리한다", async () => {
  const file = new File(["receipt"], "receipt.pdf", { type: "application/pdf" });
  const { client, calls } = createSupabaseMock();
  await getFuelReceiptSignedUrl(client, "fuel/fuel-1/receipt.pdf");
  await clearFuelRecordReceipt(client, "fuel-1", "fuel/fuel-1/receipt.pdf");
  assert.deepEqual(calls[0], { kind: "signed-url", bucket: "fuel-receipts", path: "fuel/fuel-1/receipt.pdf", expiresIn: 300 });
  assert.deepEqual(calls[1].update, { receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null, updated_at: calls[1].update.updated_at });
  assert.equal(calls[2].kind, "remove");

  const failing = createSupabaseMock({ updateError: { message: "db unavailable" } });
  const message = await uploadFuelReceiptForNewRecord(failing.client, "fuel-2", file);
  assert.match(message, /db unavailable/);
  assert.equal(failing.calls[0].options.contentType, "application/pdf");
  assert.equal(failing.calls[2].kind, "remove");
});

test.after(async () => {
  await Promise.all([modelPath, servicePath, receiptServicePath].map((path) => unlink(path).catch(() => undefined)));
});
