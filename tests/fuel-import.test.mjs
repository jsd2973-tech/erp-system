import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import XLSX from "xlsx-js-style";

const featureDirectory = new URL("../src/features/fuel/", import.meta.url);
const modelPath = new URL(`.fuelModel-import-${process.pid}.mjs`, featureDirectory);
const importPath = new URL(`.fuelImport-${process.pid}.mjs`, featureDirectory);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

const [modelSource, importSource] = await Promise.all([
  readFile(new URL("fuelModel.ts", featureDirectory), "utf8"),
  readFile(new URL("fuelImport.ts", featureDirectory), "utf8"),
]);
await writeFile(modelPath, transpile(modelSource));
const linkedImportSource = importSource
  .replace('from "./fuelModel"', `from "./${modelPath.pathname.split("/").at(-1)}"`)
  .replace('import * as XLSX from "xlsx-js-style";', 'import XLSX from "xlsx-js-style";');
await writeFile(importPath, transpile(linkedImportSource));
const { parseFuelFile } = await import(pathToFileURL(importPath.pathname).href);

const makeFile = (rows, name = "2026년 9월 거래명세서.xlsx") => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "내역");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return {
    name,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    text: async () => "",
  };
};

test("현장 열이 없는 명세서는 번호 suffix 현장 매핑과 미지정 fallback을 보존한다", async () => {
  const file = makeFile([
    ["제품명", "차량번호", "일자", "횟수", "수량", "단가(원/단위)", "공급가액", "부가세", "합계금액"],
    ["경유", "세종03가1166", "2026-09-20", 1, 10, 1800, 18000, 1800, 19800],
    ["경유", "차량9999", "2026-09-21", 1, 5, 1700, 8500, 850, 9350],
  ]);
  const rows = await parseFuelFile(file, "2026-09");
  assert.deepEqual(rows.map(({ site_name, memo }) => [site_name, memo]), [
    ["공장", "원본 명세서에 현장명 없음 · 차량번호로 현장 자동지정"],
    ["미지정", "원본 명세서에 현장명 없음"],
  ]);
  assert.ok(rows.every((row) => row.source_fingerprint?.startsWith("fuel-")));
});

test("명세서의 source site는 차량 suffix와 달라도 원본을 유지한다", async () => {
  const file = makeFile([
    ["현장명", "제품명", "차량번호", "일자", "횟수", "수량", "단가(원/단위)", "공급가액", "부가세", "합계금액"],
    ["원본현장", "경유", "세종03가1166", "2026-09-20", 1, 10, 1800, 18000, 1800, 19800],
  ]);
  const [row] = await parseFuelFile(file, "2026-09");
  assert.equal(row.site_name, "원본현장");
  assert.equal(row.memo, "");
});

test.after(async () => {
  await Promise.all([
    unlink(modelPath).catch(() => undefined),
    unlink(importPath).catch(() => undefined),
  ]);
});
