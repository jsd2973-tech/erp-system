import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as XLSX from "xlsx";

const featureDirectory = new URL("../src/features/master-data/", import.meta.url);
const modelModulePath = new URL(`.masterDataModel-import-${process.pid}.mjs`, featureDirectory);
const importModulePath = new URL(`.masterDataImport-${process.pid}.mjs`, featureDirectory);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

await writeFile(modelModulePath, transpile(await readFile(new URL("masterDataModel.ts", featureDirectory), "utf8")));
const importSource = (await readFile(new URL("masterDataImport.ts", featureDirectory), "utf8"))
  .replace('from "./masterDataModel"', `from "./.masterDataModel-import-${process.pid}.mjs"`);
await writeFile(importModulePath, transpile(importSource));
const importModel = await import(pathToFileURL(importModulePath.pathname).href);

test("Ecount matrix parser detects headers on every sheet and skips export timestamp metadata", () => {
  const rows = importModel.parseEcountVendorSheets([
    { name: "설명", rows: [["거래처 목록"]] },
    { name: "거래처", rows: [
      ["작성일", "2026.09.29"],
      ["거래처코드", "거래처명", "대표자명", "전화", "모바일", "주소1", "Email", "Fax"],
      ["V001", "태명산업", "홍길동", "02-0000", "010-0000", "세종", "a@example.test", "044-0000"],
      ["2026.09.29", "", "", "", "", "", "", ""],
    ] },
  ]);
  assert.deepEqual(rows, [{
    sourceSheet: "거래처", sourceRow: 3, code: "V001", name: "태명산업", owner: "홍길동",
    phone: "02-0000", mobile: "010-0000", address: "세종",
  }]);
  assert.equal(importModel.parseEcountVendorSheets([{ name: "일반", rows: [["코드", "상호"]] }]), null);
  assert.deepEqual(importModel.parseEcountVendorSheets([{ name: "빈 Ecount", rows: [["거래처코드", "거래처명"]] }]), []);
});

test("general vendor imports preserve field mapping, generated codes and id-by-code-or-name merge", () => {
  const existing = [
    { id: "old-1", code: "V001", name: "기존 거래처", owner: "기존 대표" },
  ];
  let id = 0;
  const imported = importModel.mapVendorImportRows([
    { 거래처명: "새 거래처", 대표자명: "대표", 전화번호: "02-1", 모바일: "010-1", 주소: "주소", 상세주소: "101호" },
    { 코드: "EXT-2", 상호: "기존 거래처", 대표자: "새 대표" },
    { 거래처명: "" },
  ], existing, () => `new-${++id}`);
  assert.equal(imported.length, 2);
  assert.equal(imported[0].code, "V002");
  assert.equal(imported[0].address_detail, "101호");
  assert.deepEqual(importModel.mergeVendorImportRows(existing, imported), [
    { ...existing[0], ...imported[1], id: "old-1" },
    imported[0],
  ]);
});

test("item imports preserve column mapping, generated code sequence and merge-by-code behavior", () => {
  const existing = [{ id: "item-old", code: "0008", name: "기존", spec: "A", unit: "ea", price: 10 }];
  let id = 0;
  const imported = importModel.mapItemImportRows([
    { 품명: "신규 1", 규격: "B", 단위: "kg", 입고단가: "250" },
    { 품목코드: "0008", 품목명: "기존 수정", 규격정보: "C", 단위: "ea", 단가: 30 },
  ], existing, () => `new-${++id}`);
  assert.deepEqual(imported.map((item) => item.code), ["0009", "0008"]);
  assert.equal(imported[0].price, 250);
  assert.deepEqual(importModel.mergeItemImportRows(existing, imported), [
    { ...existing[0], ...imported[1], id: existing[0].id },
    imported[0],
  ]);
});

test("xlsx reader keeps the first-sheet, defval empty-cell import shape", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["품목명", "단위"], ["베어링", ""]]), "첫번째");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["품목명"], ["두번째"]]), "두번째");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const arrayBuffer = bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const file = { arrayBuffer: async () => arrayBuffer };
  assert.deepEqual(await importModel.readMasterDataRows(file), [{ 품목명: "베어링", 단위: "" }]);
});

test.after(async () => {
  await Promise.all([unlink(modelModulePath).catch(() => undefined), unlink(importModulePath).catch(() => undefined)]);
});
