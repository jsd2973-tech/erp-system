import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const source = new URL("../src/features/purchase/purchaseModel.ts", import.meta.url);
const modulePath = new URL(`../src/features/purchase/.purchaseReceiptModel-${process.pid}.mjs`, import.meta.url);
await writeFile(modulePath, ts.transpileModule(await readFile(source, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText);
const { toPurchase, fromPurchase, getPurchaseReceiptFields, buildPurchaseReceiptUpdate, createPurchaseReceiptReconciler, filterPurchases, createEmptyPurchaseSearch, isPurchasePaid } = await import(pathToFileURL(modulePath.pathname).href);

const purchase = (id, status, paymentStatus = "unpaid") => toPurchase({
  id, date: "2026-10-07", vendor: "자재업체", warehouse: "1창고", rows: [{ id: "r", item: "볼트", qty: 2 }],
  receipt_status: status, received_date: status === "received" ? "2026-10-06" : null,
  payment_status: paymentStatus, paid_date: paymentStatus === "paid" ? "2026-10-01" : null, total: 1100,
});

test("신규 구매는 미수취/null, legacy는 미확인으로 서로 구분한다", () => {
  assert.deepEqual(getPurchaseReceiptFields(), { receiptStatus: "unreceived", receivedDate: "" });
  const fresh = fromPurchase({ ...purchase("new"), ...getPurchaseReceiptFields() });
  assert.equal(fresh.receipt_status, "unreceived");
  assert.equal(fresh.received_date, null);
  for (const value of [undefined, null, "", "invalid"]) {
    const legacy = purchase("old", value);
    assert.equal(legacy.receiptStatus, "unknown");
    assert.deepEqual(getPurchaseReceiptFields(legacy), { receiptStatus: "unknown", receivedDate: "" });
    assert.equal(fromPurchase(legacy).receipt_status, "unknown");
  }
});

test("snake_case/camelCase 수취 상태와 날짜는 round trip에서 보존한다", () => {
  const received = purchase("received", "received", "paid");
  const roundTrip = toPurchase(fromPurchase(received));
  assert.deepEqual(roundTrip, received);
  assert.deepEqual(getPurchaseReceiptFields(received), { receiptStatus: "received", receivedDate: "2026-10-06" });
  assert.equal(toPurchase({ ...received, receivedDate: "2026-10-06" }).receivedDate, "2026-10-06");
  assert.equal(toPurchase({ receipt_status: "unknown", received_date: "2026-01-01" }).receivedDate, "");
  assert.equal(fromPurchase({ ...received, receiptStatus: "unreceived" }).received_date, null);
});

test("수취완료와 취소 payload는 지급상태/지급일을 포함하지 않는다", () => {
  assert.deepEqual(buildPurchaseReceiptUpdate("received", "2026-10-07"), { receipt_status: "received", received_date: "2026-10-07" });
  assert.deepEqual(buildPurchaseReceiptUpdate("unreceived", "2026-10-08"), { receipt_status: "unreceived", received_date: null });
  for (const paid of ["unpaid", "paid"]) {
    const original = purchase("p", "unknown", paid);
    for (const status of ["unreceived", "received", "unreceived", "received"]) {
      const serialized = fromPurchase({ ...original, receiptStatus: status, receivedDate: status === "received" ? "2026-10-07" : "" });
      assert.equal(serialized.payment_status, paid);
      assert.equal(serialized.paid_date, paid === "paid" ? "2026-10-01" : null);
    }
  }
});

test("늦은 조회는 저장한 수취상태를 되돌리지 않고 이후 조회·지급 데이터는 존중한다", () => {
  const updates = createPurchaseReceiptReconciler();
  const legacy = purchase("p", "unknown");
  const loadBeforeComplete = updates.getRevision();
  updates.record("p", "received", "2026-10-07");
  const completed = updates.reconcile([legacy], loadBeforeComplete)[0];
  assert.deepEqual(completed, { ...legacy, receiptStatus: "received", receivedDate: "2026-10-07" });

  const loadBeforeCancel = updates.getRevision();
  updates.record("p", "unreceived", "");
  const paidServerRow = { ...completed, paymentStatus: "paid", paidDate: "2026-10-01" };
  assert.deepEqual(updates.reconcile([paidServerRow], loadBeforeCancel)[0], { ...paidServerRow, receiptStatus: "unreceived", receivedDate: "" });

  // 저장 이후 시작된 조회에는 다른 사용자의 최신 변경을 그대로 반영합니다.
  const freshLoad = updates.getRevision();
  assert.deepEqual(updates.reconcile([paidServerRow], freshLoad), [paidServerRow]);
  const other = purchase("other", "unknown", "paid");
  assert.deepEqual(updates.reconcile([other], loadBeforeComplete), [other]);
});

test("수취 4종 필터는 기간/업체/품목/창고/지급 필터와 독립적으로 조합된다", () => {
  const all = [purchase("unknown", "unknown"), purchase("waiting", "unreceived"), purchase("received", "received"), purchase("paid", "received", "paid")];
  const search = { ...createEmptyPurchaseSearch(), from: "2026-10-01", to: "2026-10-07", vendor: "자재", item: "볼트", warehouse: "1창고" };
  assert.equal(filterPurchases(all, search).length, 4);
  assert.deepEqual(filterPurchases(all, { ...search, receiptStatus: "unknown" }).map(p => p.id), ["unknown"]);
  assert.deepEqual(filterPurchases(all, { ...search, receiptStatus: "unreceived" }).map(p => p.id), ["waiting"]);
  assert.deepEqual(filterPurchases(all, { ...search, receiptStatus: "received" }).map(p => p.id), ["received", "paid"]);
  assert.deepEqual(filterPurchases(all, { ...search, receiptStatus: "received", paymentStatus: "unpaid" }).map(p => p.id), ["received"]);
  assert.deepEqual(filterPurchases(all, { ...search, receiptStatus: "received", paymentStatus: "paid" }).map(p => p.id), ["paid"]);
});

test("미지급 후보와 합계는 수취상태에 영향받지 않는다", () => {
  for (const status of ["unknown", "unreceived", "received"]) {
    const all = [purchase("a", status), purchase("b", status), purchase("c", status, "paid")];
    const candidates = filterPurchases(all, { ...createEmptyPurchaseSearch(), paymentStatus: "unpaid" });
    assert.deepEqual(candidates.map(p => p.id), ["b", "a"]);
    assert.equal(candidates.reduce((total, p) => total + p.total, 0), 2200);
    assert.equal(isPurchasePaid(all[2]), true);
  }
});

test.after(async () => { await unlink(modulePath).catch(() => undefined); });
