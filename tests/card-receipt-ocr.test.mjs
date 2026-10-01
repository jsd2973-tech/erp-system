import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const cardDirectory = new URL("../src/features/card/", import.meta.url);
const parserPath = new URL(`.receiptOcr-card-${process.pid}.mjs`, cardDirectory);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

await writeFile(parserPath, transpile(await readFile(new URL("receiptOcr.ts", cardDirectory), "utf8")));
const { parseReceiptOcr } = await import(pathToFileURL(parserPath.pathname).href);

test("카드 OCR은 Cashnote Pay 헤더보다 실제 운송업체명을 우선하고 총액/날짜를 인식한다", () => {
  const result = parseReceiptOcr({
    text: [
      "Cashnote Pay",
      "KB국민카드 승인(고객/가맹점)",
      "대신정기화물택배 세",
      "세종특별자치시 금남면 용포로 36",
      "이정희 (044 8641366)",
      "판매금액 63,637원",
      "부가가치세 6,363원",
      "합 계 70,000원",
      "거래일시:26-09-29 18:58:40",
    ].join("\n"),
  });

  assert.equal(result.date, "2026-09-29");
  assert.equal(result.merchant, "대신정기화물택배 세");
  assert.equal(result.totalAmount, 70000);
});

test("카드 OCR은 점을 천 단위 구분자로 읽은 원화 합계도 보정한다", () => {
  const result = parseReceiptOcr({
    text: "합 계\n70.000원\n거래일시:26-09-29 18:58:40\n대신정기화물택배",
  });
  assert.equal(result.totalAmount, 70000);
});

test.after(async () => {
  await unlink(parserPath).catch(() => undefined);
});
