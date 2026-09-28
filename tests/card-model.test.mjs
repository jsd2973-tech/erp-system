import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const sourcePath = new URL("../src/features/card/cardModel.ts", import.meta.url);
const modulePath = new URL(`../src/features/card/.cardModel-${process.pid}.mjs`, import.meta.url);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

const source = (await readFile(sourcePath, "utf8"))
  .replace('from "./receiptOcr"', "from './receiptOcr.mjs'")
  .replace('from "./cardTypes"', "from './cardTypes.mjs'");
await writeFile(modulePath, transpile(source));
const { createEmptyCardForm, getCardOcrFeedback, mergeCardOcrForm, normalizeCardUse } = await import(pathToFileURL(modulePath.pathname).href);

test("카드 OCR은 비어 있는 날짜·상호·금액만 채우고 담당자와 메모를 유지한다", () => {
  const today = "2026-09-28";
  const current = { ...createEmptyCardForm(today), user_name: "직접 담당", memo: "직접 메모" };
  const result = { date: "2026-09-25", merchant: "OCR 상호", totalAmount: 128500 };

  assert.deepEqual(mergeCardOcrForm(current, result, { date: false, place: false, amount: false }, today), {
    ...current,
    date: result.date,
    place: result.merchant,
    amount: "128500",
  });
  assert.deepEqual(getCardOcrFeedback(result, current, { date: false, place: false, amount: false }, today), {
    state: "success",
    message: "영수증에서 날짜·상호명·총합계를 자동 입력했습니다. 확인 후 저장해 주세요.",
  });
});

test("카드 OCR은 사용자가 입력했거나 편집 중인 필드를 덮어쓰지 않는다", () => {
  const today = "2026-09-28";
  const current = {
    ...createEmptyCardForm("2026-09-20"),
    user_name: "직접 담당",
    place: "직접 상호",
    amount: "7000",
    memo: "직접 메모",
  };
  const result = { date: "2026-09-25", merchant: "OCR 상호", totalAmount: 128500 };
  const touched = { date: true, place: true, amount: true };

  assert.deepEqual(mergeCardOcrForm(current, result, touched, today), current);
  assert.deepEqual(getCardOcrFeedback(result, current, touched, today), {
    state: "success",
    message: "영수증 분석 완료. 기존에 입력한 날짜·상호명·금액은 유지했습니다. 확인 후 저장해 주세요.",
  });
});

test("카드 OCR은 날짜가 기본 오늘인 경우에만 미입력 날짜로 간주한다", () => {
  const today = "2026-09-28";
  const form = createEmptyCardForm(today);
  const result = { date: "2026-09-25", merchant: "상호", totalAmount: 1200 };
  const merged = mergeCardOcrForm(form, result, { date: false, place: false, amount: false }, today);

  assert.equal(merged.date, result.date);
});

test("카드 행의 금액은 조회 데이터 정규화 시 숫자로 변환한다", () => {
  assert.deepEqual(normalizeCardUse({ id: "card-1", date: "2026-09-28", amount: "128500" }), {
    id: "card-1",
    date: "2026-09-28",
    amount: 128500,
  });
});

test.after(async () => {
  await unlink(modulePath).catch(() => {});
});
