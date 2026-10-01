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


test("카드 OCR은 합계가 깨져도 판매금액과 부가세 합으로 총액을 복원한다", () => {
  const result = parseReceiptOcr({
    text: [
      "CCashnote Pay (포상금 10만원 지급) 매출전표 사본을 첨부하여",
      "대신정기화물택배 세",
      "판매금액 63,637원",
      "부가가치세 6,363원",
      "합 계 5585",
      "거래일시:26-09-29 18:58:40",
    ].join("\n"),
  });

  assert.equal(result.merchant, "대신정기화물택배 세");
  assert.equal(result.totalAmount, 70000);
});


test("합계 라벨 다음 카드번호 일부를 금액으로 오인하지 않는다", () => {
  const result = parseReceiptOcr({
    text: [
      "대신정기화물택배 세",
      "판매금액",
      "부가가치세",
      "합 계",
      "5585-26****-9801(C)",
      "63,637원",
      "6,363원",
      "70,000원",
      "거래일시:26-09-29 18:58:40",
    ].join("\n"),
  });

  assert.equal(result.merchant, "대신정기화물택배 세");
  assert.equal(result.totalAmount, 70000);
});

test.after(async () => {
  await unlink(parserPath).catch(() => undefined);
});
