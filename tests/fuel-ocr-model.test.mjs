import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const cardDirectory = new URL("../src/features/card/", import.meta.url);
const fuelDirectory = new URL("../src/features/fuel/", import.meta.url);
const cardParserPath = new URL(`.receiptOcr-fuel-${process.pid}.mjs`, cardDirectory);
const receiptOcrPath = new URL(`.fuelReceiptOcr-${process.pid}.mjs`, fuelDirectory);
const fuelOcrPath = new URL(`.fuelOcr-${process.pid}.mjs`, fuelDirectory);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

await writeFile(cardParserPath, transpile(await readFile(new URL("receiptOcr.ts", cardDirectory), "utf8")));
const receiptOcrSource = (await readFile(new URL("fuelReceiptOcr.ts", fuelDirectory), "utf8"))
  .replace('from "../card/receiptOcr.js"', `from "../card/${cardParserPath.pathname.split("/").at(-1)}"`);
await writeFile(receiptOcrPath, transpile(receiptOcrSource));
const fuelOcrSource = (await readFile(new URL("fuelOcr.ts", fuelDirectory), "utf8"))
  .replace('from "./fuelReceiptOcr"', `from "./${receiptOcrPath.pathname.split("/").at(-1)}"`);
await writeFile(fuelOcrPath, transpile(fuelOcrSource));
const { applyFuelReceiptOcrResult, createFuelOcrTouchedFields, requestFuelReceiptOcr } =
  await import(pathToFileURL(fuelOcrPath.pathname).href);

const manual = (patch = {}) => ({
  product_name: "경유",
  unit_price: "1800",
  fuel_date: "2026-09-01",
  station_name: "기존 주유처",
  quantity: "100",
  supply_amount: "180000",
  vat_amount: "18000",
  total_amount: "198000",
  ...patch,
});

test("fuel OCR merge는 여덟 필드를 적용하고 현장·차량 선택값을 건드리지 않는다", () => {
  const result = applyFuelReceiptOcrResult({
    fuelDate: "2026-09-20", stationName: "남세종주유소", productName: "경유", quantity: 180,
    unitPrice: 1800, supplyAmount: 324000, vatAmount: 32400, totalAmount: 356400,
  }, manual(), createFuelOcrTouchedFields(), [{ product_name: "경유", unit_price: 1800 }]);
  assert.deepEqual(result.patch, {
    fuel_date: "2026-09-20", station_name: "남세종주유소", product_name: "경유", quantity: "180",
    unit_price: "1800", supply_amount: "324000", vat_amount: "32400", total_amount: "356400",
  });
  assert.equal(result.state, "success");
  assert.deepEqual(result.detectedLabels, ["주유일자", "주유처", "유종", "주유량", "단가", "공급가액", "부가세", "합계금액"]);
});

test("fuel OCR merge keeps user-touched values and correction can recover 180L from a 170L read", () => {
  const touched = createFuelOcrTouchedFields();
  touched.quantity = true;
  touched.station_name = true;
  const result = applyFuelReceiptOcrResult({
    stationName: "OCR 주유소", quantity: 170, unitPrice: 1800,
    supplyAmount: 324000, vatAmount: 32400, totalAmount: 356400,
  }, manual({ quantity: "175", station_name: "직접 주유처" }), touched, [{ product_name: "경유", unit_price: 1800 }]);
  assert.equal(result.patch.quantity, undefined);
  assert.equal(result.patch.station_name, undefined);
  assert.equal(result.patch.unit_price, "1800");
  assert.match(result.message, /기존 입력값을 유지했습니다/);

  const corrected = applyFuelReceiptOcrResult({
    quantity: 170, unitPrice: 0, supplyAmount: 324000,
  }, manual({ unit_price: "0" }), createFuelOcrTouchedFields(), [{ product_name: "경유", unit_price: 1800 }]);
  assert.equal(corrected.patch.quantity, "180");
  assert.equal(corrected.patch.unit_price, "1800");
});

test("fuel OCR 요청은 기존 fuel mode API 경로와 bearer 인증을 유지하고 오류 응답을 전달한다", async () => {
  let request;
  const response = await requestFuelReceiptOcr("test-token", "data:image/jpeg;base64,abc", async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ fuelDate: "2026-09-20" }) };
  });
  assert.equal(response.fuelDate, "2026-09-20");
  assert.equal(request.url, "/api/receipt-ocr");
  assert.equal(request.options.headers.authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(request.options.body), { dataUrl: "data:image/jpeg;base64,abc", mode: "fuel" });

  await assert.rejects(
    requestFuelReceiptOcr("test-token", "data", async () => ({ ok: false, json: async () => ({ error: "OCR unavailable" }) })),
    /OCR unavailable/,
  );
});

test.after(async () => {
  await Promise.all([cardParserPath, receiptOcrPath, fuelOcrPath].map((path) => unlink(path).catch(() => undefined)));
});
