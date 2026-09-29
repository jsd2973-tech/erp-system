import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const featureDirectory = new URL("../src/features/master-data/", import.meta.url);
const modelModulePath = new URL(`.masterDataModel-${process.pid}.mjs`, featureDirectory);
const exportModulePath = new URL(`.vendorExport-${process.pid}.mjs`, featureDirectory);
const modelSource = await readFile(new URL("masterDataModel.ts", featureDirectory), "utf8");
const exportSource = await readFile(new URL("vendorExport.ts", featureDirectory), "utf8");
await writeFile(modelModulePath, ts.transpileModule(modelSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText);
await writeFile(exportModulePath, ts.transpileModule(exportSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText);
const model = await import(pathToFileURL(modelModulePath.pathname).href);
const vendorExport = await import(pathToFileURL(exportModulePath.pathname).href);

test("master code generators preserve existing prefixes and numeric widths", () => {
  assert.equal(model.nextVendorCode([{ code: "V001" }, { code: "V009" }, { code: "custom" }]), "V010");
  assert.equal(model.nextWarehouseCode([{ code: "0007" }, { code: "X12" }]), "0008");
  assert.equal(model.nextItemCode([]), "0001");
});

test("item search matches code, name, specification and unit without changing order", () => {
  const items = [
    { id: "a", code: "0001", name: "베어링", spec: "6204", unit: "ea", price: 100 },
    { id: "b", code: "0002", name: "유압호스", spec: "A형", unit: "m", price: 200 },
  ];
  assert.deepEqual(model.filterMasterItems(items, "  6204 ").map(({ id }) => id), ["a"]);
  assert.deepEqual(model.filterMasterItems(items, "M").map(({ id }) => id), ["b"]);
  assert.deepEqual(model.filterMasterItems(items, "").map(({ id }) => id), ["a", "b"]);
});

test("Ecount duplicate grouping keeps exact names and source order", () => {
  const rows = [
    { sourceSheet: "거래처", sourceRow: 2, code: "1", name: "같은 상호", owner: "갑", phone: "", mobile: "", address: "" },
    { sourceSheet: "거래처", sourceRow: 3, code: "2", name: "다른 상호", owner: "을", phone: "", mobile: "", address: "" },
    { sourceSheet: "복사", sourceRow: 4, code: "3", name: "같은 상호", owner: "병", phone: "", mobile: "", address: "" },
  ];
  assert.deepEqual(model.groupEcountVendorRowsByName(rows), [["같은 상호", [rows[0], rows[2]]]]);
  assert.equal(model.getEcountVendorRowKey(rows[2]), "복사:4");
});

test("vendor export preserves the current filename and ordered column contract", () => {
  assert.equal(vendorExport.vendorExportFileName("2026-09-29"), "거래처목록_2026-09-29");
  assert.deepEqual(vendorExport.buildVendorExportRows([{
    id: "v1", code: "V001", name: "거래처", owner: "대표", phone: "02", mobile: "010", address: "도로명", address_detail: "101호",
  }]), [{
    거래처코드: "V001", 상호: "거래처", 대표자: "대표", 전화번호: "02", 모바일: "010", 기본주소: "도로명", 상세주소: "101호",
  }]);
});

test.after(async () => {
  await Promise.all([unlink(modelModulePath).catch(() => undefined), unlink(exportModulePath).catch(() => undefined)]);
});
