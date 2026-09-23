import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx-js-style";
import { test, expect } from "../fixtures";
import { loginAsE2EAdmin } from "../pages/login.page";
import { PurchasePage } from "../pages/purchase.page";

const seoulToday = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

test("@regression 대량이체 workbook 형식과 미지급 구매 후보를 고정 검증한다", async ({ page, e2e }, testInfo) => {
  await loginAsE2EAdmin(page);
  const purchasePage = new PurchasePage(page);
  const purchaseDate = seoulToday();
  const month = purchaseDate.slice(0, 7);

  await purchasePage.createPurchase(e2e, { qty: 1, price: 100000, date: purchaseDate });
  await purchasePage.createPurchase(e2e, { qty: 2, price: 100000, date: purchaseDate });

  const { data: purchases, error: purchasesError } = await e2e.db
    .from("purchases")
    .select("id,rows,total,payment_status,paid_date")
    .eq("vendor", e2e.vendorName);
  expect(purchasesError).toBeNull();
  expect(purchases).toHaveLength(2);
  if (!purchases || purchases.length !== 2) throw new Error("Both E2E purchase rows were not returned.");

  await purchasePage.openList();
  const paidCandidate = purchases.find((row) => Number(row.rows?.[0]?.qty) === 1);
  const unpaidCandidate = purchases.find((row) => Number(row.rows?.[0]?.qty) === 2);
  if (!paidCandidate || !unpaidCandidate) throw new Error("The paid and unpaid purchase fixtures could not be distinguished.");
  const paymentToggle = page.locator(".purchase-lookup-page .scroll-table")
    .getByTestId(`purchase-payment-toggle-${paidCandidate.id}`);
  await expect(paymentToggle).toHaveCount(1);
  await paymentToggle.check();
  await expect(paymentToggle).toBeChecked();
  await expect.poll(async () => {
    const { data, error } = await e2e.db
      .from("purchases").select("payment_status,paid_date").eq("id", paidCandidate.id).single();
    if (error) throw error;
    return data;
  }).toMatchObject({ payment_status: "paid", paid_date: expect.any(String) });

  const bulkMenu = page.getByTestId("menu-bulk_transfer");
  if (!(await bulkMenu.isVisible())) await page.getByTestId("nav-group-purchase").click();
  await page.getByTestId("menu-bulk_transfer").click();
  const bulkPage = page.locator(".bulk-transfer-page");
  await expect(bulkPage.getByRole("heading", { name: "대량이체 생성" })).toBeVisible();
  await bulkPage.getByPlaceholder("2026-04").fill(month);
  const candidateCard = bulkPage.locator(".bulk-transfer-card").filter({ hasText: e2e.vendorName });
  await expect(candidateCard).toBeVisible();
  await expect(candidateCard).toContainText("220,000원");
  await expect(bulkPage.locator(".bulk-transfer-list")).not.toContainText("110,000원");
  const inputFor = (label: string) => candidateCard.locator(".bulk-edit-grid .field").filter({ hasText: label }).locator("input");
  await inputFor("입금은행").fill("088");
  await inputFor("입금계좌").fill("123-456-789012");
  await inputFor("고객관리성명").fill(`${e2e.prefix} 표시명`);
  await expect(candidateCard.getByText("계좌매칭", { exact: true })).toBeVisible();

  await bulkPage.getByRole("button", { name: "대량이체 엑셀 다운로드", exact: true }).click();
  const selection = page.locator(".bulk-select-modal");
  await expect(selection.getByRole("heading", { name: "대량이체 항목 선택" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await selection.getByRole("button", { name: "선택 항목 다운로드", exact: true }).click();
  const download = await downloadPromise;
  const workbookPath = testInfo.outputPath("bulk-transfer-regression.xlsx");
  await download.saveAs(workbookPath);

  const workbook = XLSX.read(await readFile(workbookPath), { type: "buffer", cellStyles: true });
  expect(workbook.SheetNames).toEqual(["대량이체 미입금분"]);
  const sheet = workbook.Sheets["대량이체 미입금분"];
  expect(sheet["!ref"]).toBe("A1:I2");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  expect(matrix).toEqual([
    ["*입금은행", "*입금계좌", "*입금액", "고객관리성명", "입금통장표시내용", "출금통장표시내용", "입금인코드", "비고", "업체사용key"],
    ["088", "123456789012", 220000, `${e2e.prefix} 표시명`, "(주)태명산업개발", `${e2e.itemName}/${e2e.vendorName}${month.slice(5)}`, "", "", ""],
  ]);
  expect(sheet.A2.t).toBe("s");
  expect(sheet.B2.t).toBe("s");
  expect(sheet.C2.t).toBe("n");
  expect(sheet.C2.z).toBe("#,##0");
  expect(sheet.B2.z).toBe("@");
  expect(sheet["!autofilter"]).toEqual({ ref: "A1:I2" });
});
