import { test, expect } from "../fixtures";
import { loginAsE2EAdmin } from "../pages/login.page";
import { MaintenancePage } from "../pages/maintenance.page";
import { PurchasePage } from "../pages/purchase.page";

test("@regression 정비 휴지통 이동은 구매 연결을 풀고 복구 시 같은 링크와 사용수량을 되살린다", async ({ page, e2e }) => {
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.createPurchase(e2e, { qty: 4, price: 910000 });
  const maintenance = new MaintenancePage(page);
  const title = `${e2e.prefix} 삭제복구 정비`;
  await maintenance.connectPurchase(e2e, { title, maintenanceQty: 2, usedQty: 2 });

  const { data: purchase, error: purchaseError } = await e2e.db
    .from("purchases").select("id,rows").eq("vendor", e2e.vendorName).single();
  expect(purchaseError).toBeNull();
  if (!purchase) throw new Error("The E2E purchase row was not found before maintenance deletion.");
  const purchaseRowId = String(purchase.rows[0].id);
  const { data: savedMaintenance, error: maintenanceError } = await e2e.db
    .from("maints").select("id").eq("title", title).single();
  expect(maintenanceError).toBeNull();
  if (!savedMaintenance) throw new Error("The E2E maintenance row was not found before deletion.");

  const { data: beforeLinks, error: beforeLinksError } = await e2e.db
    .from("maintenance_purchase_links")
    .select("id,purchase_row_id,used_qty")
    .eq("maintenance_id", savedMaintenance.id);
  expect(beforeLinksError).toBeNull();
  expect(beforeLinks).toHaveLength(1);
  expect(beforeLinks?.[0]).toMatchObject({ purchase_row_id: purchaseRowId, used_qty: 2 });
  expect(Number(purchase.rows[0].qty) - Number(beforeLinks?.[0].used_qty)).toBe(2);

  await maintenance.openList();
  await maintenance.deleteFromList(title);

  const { data: deletedMaintenance, error: deletedMaintenanceError } = await e2e.db
    .from("maints").select("id").eq("id", savedMaintenance.id).maybeSingle();
  expect(deletedMaintenanceError).toBeNull();
  expect(deletedMaintenance).toBeNull();
  const { data: afterDeleteLinks, error: afterDeleteLinksError } = await e2e.db
    .from("maintenance_purchase_links").select("id").eq("purchase_id", purchase.id);
  expect(afterDeleteLinksError).toBeNull();
  expect(afterDeleteLinks).toHaveLength(0);
  const { data: trash, error: trashError } = await e2e.db
    .from("deleted_records")
    .select("id,record_id,data")
    .eq("source_table", "maints")
    .eq("record_id", savedMaintenance.id)
    .single();
  expect(trashError).toBeNull();
  expect(trash?.data.__maintenance_purchase_links).toHaveLength(1);
  expect(trash?.data.__maintenance_purchase_links[0]).toMatchObject({ purchase_row_id: purchaseRowId, used_qty: 2 });
  expect(Number(purchase.rows[0].qty)).toBe(4);

  await maintenance.restoreFromTrash(title);

  await expect.poll(async () => {
    const { data, error } = await e2e.db
      .from("maintenance_purchase_links")
      .select("id,purchase_row_id,used_qty")
      .eq("maintenance_id", savedMaintenance.id);
    if (error) throw error;
    return data;
  }).toMatchObject([{ id: beforeLinks?.[0].id, purchase_row_id: purchaseRowId, used_qty: 2 }]);

  const { data: afterRestoreTrash, error: afterRestoreTrashError } = await e2e.db
    .from("deleted_records").select("id").eq("id", trash?.id || "").maybeSingle();
  expect(afterRestoreTrashError).toBeNull();
  expect(afterRestoreTrash).toBeNull();
  const { data: restoredPurchase, error: restoredPurchaseError } = await e2e.db
    .from("purchases").select("rows").eq("id", purchase.id).single();
  expect(restoredPurchaseError).toBeNull();
  expect(Number(restoredPurchase?.rows[0].qty) - 2).toBe(2);
});

test("@regression 연결된 구매는 수량 축소·품목명 변경을 막고 규격 변경은 허용한다", async ({ page, e2e }) => {
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.createPurchase(e2e, { qty: 4, price: 910000 });
  const maintenance = new MaintenancePage(page);
  await maintenance.connectPurchase(e2e, { title: `${e2e.prefix} 보호 정비`, maintenanceQty: 3, usedQty: 3 });

  const { data: purchase, error: purchaseError } = await e2e.db
    .from("purchases").select("id,rows").eq("vendor", e2e.vendorName).single();
  expect(purchaseError).toBeNull();
  if (!purchase) throw new Error("The E2E purchase row was not found before editing.");

  await purchases.openList();
  await purchases.editFromList(e2e.vendorName);
  const save = page.getByTestId("purchase-save");

  await page.getByTestId("purchase-qty-0").fill("2");
  let dialogPromise = page.waitForEvent("dialog");
  await save.click();
  let dialog = await dialogPromise;
  expect(dialog.message()).toContain("정비에 3개가 연결되어 있어 구매수량을 3개보다 적게 줄일 수 없습니다.");
  await dialog.accept();
  await expect(page.getByTestId("purchase-qty-0")).toHaveValue("2");

  await page.getByTestId("purchase-qty-0").fill("4");
  await page.getByPlaceholder("품목명 직접수정").fill(`${e2e.itemName} 변경`);
  dialogPromise = page.waitForEvent("dialog");
  await save.click();
  dialog = await dialogPromise;
  expect(dialog.message()).toContain("정비에 연결된 구매 품목의 품목명·규격은 변경할 수 없습니다.");
  await dialog.accept();

  await page.getByPlaceholder("품목명 직접수정").fill(e2e.itemName);
  await page.getByTestId("purchase-spec-0").fill("E2E-UPDATED-SPEC");
  let specChangeDialogMessage: string | null = null;
  const specDialogPromise = page.waitForEvent("dialog", { timeout: 5000 }).then(async (specDialog) => {
    specChangeDialogMessage = specDialog.message();
    await specDialog.accept();
  }).catch(() => undefined);
  const specChangeSaved = page.getByText("구매내역을 수정했습니다.", { exact: true })
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true, () => false);
  await save.click();
  const [, specChangeDidSave] = await Promise.all([specDialogPromise, specChangeSaved]);
  expect(specChangeDialogMessage).toBeNull();
  expect(specChangeDidSave).toBe(true);

  const { data: updatedPurchase, error: updatedPurchaseError } = await e2e.db
    .from("purchases").select("rows").eq("id", purchase.id).single();
  expect(updatedPurchaseError).toBeNull();
  expect(updatedPurchase?.rows[0]).toMatchObject({ item: e2e.itemName, spec: "E2E-UPDATED-SPEC", qty: 4 });
  const { data: links, error: linksError } = await e2e.db
    .from("maintenance_purchase_links").select("used_qty,purchase_row_id,spec").eq("purchase_id", purchase.id);
  expect(linksError).toBeNull();
  expect(links).toHaveLength(1);
  expect(links?.[0]).toMatchObject({ purchase_row_id: purchase.rows[0].id, used_qty: 3, spec: e2e.itemSpec });
});
