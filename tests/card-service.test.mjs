import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const sourcePath = new URL("../src/features/card/cardService.ts", import.meta.url);
const modulePath = new URL(`../src/features/card/.cardService-${process.pid}.mjs`, import.meta.url);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

const source = (await readFile(sourcePath, "utf8"))
  .replace('from "./cardTypes"', "from './cardTypes.mjs'");
await writeFile(modulePath, transpile(source));
const { createCardService } = await import(pathToFileURL(modulePath.pathname).href);

const createSupabaseMock = ({ pages, uploadError = null } = {}) => {
  const calls = [];
  const client = {
    from(table) {
      const call = { table };
      calls.push(call);
      const query = {
        select(columns) { call.select = columns; return this; },
        order(column, options) { call.order = { column, ...options }; return this; },
        range(from, to) {
          call.range = [from, to];
          const data = pages?.[from] || [];
          return Promise.resolve({ data, error: null });
        },
        upsert(row) { call.upsert = row; return Promise.resolve({ error: null }); },
        delete() {
          call.delete = true;
          return { eq(column, value) { call.eq = [column, value]; return Promise.resolve({ error: null }); } };
        },
      };
      return query;
    },
    storage: {
      from(bucket) {
        return {
          upload(name, file, options) {
            calls.push({ table: "storage", bucket, name, file, options });
            return Promise.resolve({ error: uploadError });
          },
          getPublicUrl(name) {
            calls.push({ table: "public-url", bucket, name });
            return { data: { publicUrl: `https://storage.example/${bucket}/${name}` } };
          },
        };
      },
    },
  };
  return { client, calls };
};

test("카드 조회는 date 내림차순, 페이지당 1000건으로 전부 읽는다", async () => {
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `card-${index}` }));
  const { client, calls } = createSupabaseMock({ pages: { 0: firstPage, 1000: [{ id: "card-last" }] } });
  const result = await createCardService(client).fetchCardUses();

  assert.equal(result.data.length, 1001);
  assert.deepEqual(calls.map(({ order, range }) => ({ order, range })), [
    { order: { column: "date", ascending: false }, range: [0, 999] },
    { order: { column: "date", ascending: false }, range: [1000, 1999] },
  ]);
});

test("카드 저장·삭제 query와 payload를 그대로 위임한다", async () => {
  const { client, calls } = createSupabaseMock();
  const service = createCardService(client);
  const record = { id: "card-1", date: "2026-09-28", user_name: "담당", place: "상호", amount: 128500, memo: "메모" };

  await service.saveCardUse(record);
  await service.deleteCardUse(record.id);

  assert.deepEqual(calls[0].upsert, record);
  assert.deepEqual(calls[1], { table: "card_uses", delete: true, eq: ["id", "card-1"] });
});

test("영수증 첨부는 현재 파일 확장자·audio 표시 URL·첫 이미지 OCR 대상을 유지한다", async () => {
  const { client, calls } = createSupabaseMock();
  const service = createCardService(client);
  const image = new File(["image"], "receipt.png", { type: "image/png" });
  const audio = new File(["audio"], "memo.m4a", { type: "audio/mp4" });
  const alerts = [];
  const result = await service.uploadCardReceipts([image, audio], {
    validateFiles: (files) => Array.from(files),
    compressImage: async (file) => new File([file], "compressed.jpg", { type: "image/jpeg" }),
    getFileExtension: (file, fallback = "bin") => file.name.split(".").pop() || fallback,
    alert: (message) => alerts.push(message),
  });

  assert.equal(alerts.length, 0);
  assert.equal(result.uploadedUrls.length, 2);
  assert.match(result.uploadedUrls[0], /\.jpg$/);
  assert.match(result.uploadedUrls[1], /\.m4a\?erp_file=audio$/);
  assert.equal(result.ocrFile.name, "compressed.jpg");
  assert.deepEqual(calls.filter((call) => call.table === "storage").map((call) => call.options.contentType), ["image/jpeg", "audio/mp4"]);
});

test("저장소 업로드 오류는 알리고 다음 첨부 업로드는 계속한다", async () => {
  const { client } = createSupabaseMock({ uploadError: { message: "storage unavailable" } });
  const alerts = [];
  const file = new File(["image"], "receipt.jpg", { type: "image/jpeg" });
  const result = await createCardService(client).uploadCardReceipts([file], {
    validateFiles: (files) => Array.from(files),
    compressImage: async (value) => value,
    getFileExtension: (value, fallback = "bin") => value.name.split(".").pop() || fallback,
    alert: (message) => alerts.push(message),
  });

  assert.deepEqual(result, { uploadedUrls: [], ocrFile: null });
  assert.deepEqual(alerts, ["영수증 업로드 실패 (receipt.jpg): storage unavailable"]);
});

test.after(async () => {
  await unlink(modulePath).catch(() => {});
});
