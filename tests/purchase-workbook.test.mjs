import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import XLSX from "xlsx-js-style";

const sourcePath = new URL("../src/features/purchase/bulkTransferWorkbook.ts", import.meta.url);
const modulePath = new URL(`../src/features/purchase/.bulkTransferWorkbook-${process.pid}.mjs`, import.meta.url);
const source = await readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
  .replace('import * as XLSX from "xlsx-js-style";', 'import XLSX from "xlsx-js-style";')
  .replace(
    'import { cleanAccountNumber } from "./purchaseModel";',
    'const cleanAccountNumber = (value) => String(value || "").replace(/[^0-9]/g, "");',
  );
await writeFile(modulePath, compiled);
const { buildBulkTransferWorkbook, getBulkTransferFileName } = await import(pathToFileURL(modulePath.pathname).href);

test("대량이체 workbook의 인터넷뱅킹 형식과 셀 서식을 유지한다", () => {
  const workbook = buildBulkTransferWorkbook([{
    id: "E2E 테스트 거래처",
    vendor: "E2E 테스트 거래처",
    amount: 220000,
    purchaseIds: ["purchase-1"],
    bank_code: "088",
    bank_name: "신한",
    account_name: "계좌명",
    customer_display_name: "E2E 표시명",
    account_number: "123-456-789012",
    memo: "베어링/E2E 테스트 거래처04",
    matched: true,
  }], "2026-04", "2026-04-23");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true });
  const roundTripped = XLSX.read(buffer, { type: "buffer", cellStyles: true });
  assert.deepEqual(roundTripped.SheetNames, ["대량이체 미입금분"]);

  const sheet = roundTripped.Sheets["대량이체 미입금분"];
  const generatedSheet = workbook.Sheets["대량이체 미입금분"];
  assert.equal(sheet["!ref"], "A1:I2");
  assert.deepEqual(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }), [
    ["*입금은행", "*입금계좌", "*입금액", "고객관리성명", "입금통장표시내용", "출금통장표시내용", "입금인코드", "비고", "업체사용key"],
    ["088", "123456789012", 220000, "E2E 표시명", "(주)태명산업개발", "베어링/E2E 테스트 거래처04", "", "", ""],
  ]);
  assert.deepEqual(sheet["!cols"].map((column) => column.wch), [12, 24, 15, 30, 24, 34, 14, 16, 24]);
  assert.deepEqual(sheet["!rows"].map((row) => row.hpt), [22, 22]);
  assert.deepEqual(sheet["!autofilter"], { ref: "A1:I2" });
  assert.equal(sheet.A2.t, "s");
  assert.equal(sheet.B2.t, "s");
  assert.equal(sheet.B2.z, "@");
  assert.equal(sheet.C2.t, "n");
  assert.equal(sheet.C2.z, "#,##0");
  assert.equal(generatedSheet.A1.s.fill.fgColor.rgb, "FFB8CCE4");
  assert.equal(generatedSheet.A2.s.fill.fgColor.rgb, "FFD9D9D9");
  assert.equal(getBulkTransferFileName("2026-04", "2026-04-23"), "2026-04_대량이체.xlsx");
});

test.after(async () => {
  await unlink(modulePath).catch(() => undefined);
});
