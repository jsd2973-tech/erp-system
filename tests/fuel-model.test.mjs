import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const featureDirectory = new URL("../src/features/fuel/", import.meta.url);
const sourcePath = new URL("fuelModel.ts", featureDirectory);
const modulePath = new URL(`.fuelModel-${process.pid}.mjs`, featureDirectory);
const source = await readFile(sourcePath, "utf8");
await writeFile(modulePath, ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText);
const {
  calculateFuelAmounts,
  filterFuelRecords,
  getManagedFuelOptions,
  inferFuelSite,
  resolveFuelImportSite,
  summarizeFuelRecords,
} = await import(pathToFileURL(modulePath.pathname).href);

const record = (id, fuel_date, vehicle_number, site_name, product_name, quantity, total_amount, usage_count = 1) => ({
  id, fuel_date, vehicle_number, site_name, product_name, quantity, total_amount, usage_count,
  line_amount: 0, unit_price: 0, supply_amount: 0, vat_amount: 0, station_name: "주유소",
});

test("유류 공급가·부가세·합계는 기존 반올림 공식을 사용한다", () => {
  assert.deepEqual(calculateFuelAmounts(1.5, 1789), { supply: 2684, vat: 268, total: 2952 });
  assert.deepEqual(calculateFuelAmounts(270, 1820), { supply: 491400, vat: 49140, total: 540540 });
});

test("차량 suffix 현장 추론은 알려진 번호만 공장·국회로 매핑한다", () => {
  assert.equal(inferFuelSite("세종03가1166"), "공장");
  assert.equal(inferFuelSite("장비 8408"), "국회");
  assert.equal(inferFuelSite("세종03가9999"), "");
});

test("명세서 현장값 우선, 현장 열이 없을 때만 suffix 추론하고 미매핑은 미지정한다", () => {
  assert.deepEqual(resolveFuelImportSite("원본현장", true, "세종03가1166"), {
    siteName: "원본현장", fingerprintSite: "원본현장", autoSite: "", memo: "",
  });
  assert.deepEqual(resolveFuelImportSite("미지정", false, "세종03가1166"), {
    siteName: "공장", fingerprintSite: "미지정", autoSite: "공장",
    memo: "원본 명세서에 현장명 없음 · 차량번호로 현장 자동지정",
  });
  assert.deepEqual(resolveFuelImportSite("미지정", false, "차량9999"), {
    siteName: "미지정", fingerprintSite: "미지정", autoSite: "",
    memo: "원본 명세서에 현장명 없음",
  });
});

test("유류 필터·정렬·요약은 기존 날짜, 수량, 금액 규칙을 유지한다", () => {
  const records = [
    record("older", "2026-09-27", "차량10", "공장", "경유", 20, 20000, 2),
    record("newer", "2026-09-28", "차량2", "국회", "요소수", 5, 8000),
    record("same-day", "2026-09-28", "차량10", "공장", "경유", 10, 12000),
  ];
  assert.deepEqual(filterFuelRecords(records, { site: "공장", product: "", vehicleSearch: "차량" }).map(({ id }) => id), ["same-day", "older"]);
  assert.deepEqual(summarizeFuelRecords(records, "site_name"), [
    { name: "공장", count: 3, quantity: 30, total: 32000 },
    { name: "국회", count: 1, quantity: 5, total: 8000 },
  ]);
});

test("비활성 기초 옵션은 이력 후보에서 숨기고 활성·미등록 후보는 유지한다", () => {
  const options = [
    { id: "active", category: "vehicle", name: "차량A", is_active: true },
    { id: "inactive", category: "vehicle", name: "차량B", is_active: false },
  ];
  assert.deepEqual(getManagedFuelOptions("vehicle", options, ["차량A", "차량B", "차량C"]), ["차량A", "차량C"]);
});

test.after(async () => {
  await unlink(modulePath).catch(() => undefined);
});
