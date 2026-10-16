import XLSX from "xlsx-js-style";
import { test, expect } from "../fixtures";
import type { E2EData } from "../helpers/test-data";
import { loginAsE2EAdmin } from "../pages/login.page";
import { MaintenancePage } from "../pages/maintenance.page";
import type { Page } from "@playwright/test";

async function openEquipment(page: Page) {
  const menu = page.getByTestId("menu-maint_equipment");
  const mobileNavigation = page.locator(".mobile-bottom-nav");
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    await expect(mobileNavigation).toBeVisible();
    await mobileNavigation.getByRole("button", { name: "정비", exact: true }).click();
    await page.locator(".role-mobile-sheet-card").getByRole("button", { name: "설비현황", exact: true }).click();
  } else {
    if (!(await menu.isVisible())) await page.getByTestId("nav-group-maintenance").click();
    await menu.click();
  }
  await expect(page.getByTestId("equipment-overview")).toBeVisible();
  await expect(page.getByTestId("equipment-export")).toBeEnabled();
}
async function seedEquipment(e2e: E2EData, suffix = "모터") {
  const result = await e2e.db.from("maintenance_equipment_items").insert({ category: "E2E 설비", name: `${e2e.prefix} ${suffix}`, spec: "E2E 22kW", warehouse_id: e2e.warehouseId, cycle_method: "average", cycle_intervals: 2 }).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}

test("@regression 설비 등록·정비 연결·수정·전체 이력·엑셀·삭제복구가 실제 DB에서 연동된다", async ({ page, e2e }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsE2EAdmin(page);
  await openEquipment(page);
  await page.getByTestId("equipment-add").click();
  await page.getByTestId("equipment-category").fill("E2E 설비");
  const itemName = `${e2e.prefix} 모터`;
  await page.getByTestId("equipment-name").fill(itemName);
  await page.getByTestId("equipment-spec").fill("E2E 22kW");
  await page.getByTestId("equipment-warehouse").selectOption(e2e.warehouseId);
  await page.getByTestId("equipment-cycle-method").selectOption("average");
  await page.getByTestId("equipment-item-save").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const equipment = await e2e.db.from("maintenance_equipment_items").select("id").eq("name", itemName).single();
  if (equipment.error) throw equipment.error;
  const equipmentId = equipment.data.id as string;
  const legacy = await e2e.db.from("maintenance_equipment_history").insert([
    ...Array.from({ length: 6 }, (_, n) => ({ id: `${e2e.prefix}-history-${n}`, equipment_item_id: equipmentId, work_date: `2000-01-0${n + 1}`, date_text: "", vendor_label: `이전 업체 ${n}`, cycle_included: true })),
    { id: `${e2e.prefix}-history-raw`, equipment_item_id: equipmentId, work_date: null, date_text: "204-11-09", vendor_label: "원본 날짜", cycle_included: false },
  ]);
  if (legacy.error) throw legacy.error;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByTestId("equipment-export")).toBeEnabled();
  await page.getByTestId("equipment-search").fill(e2e.prefix);
  const summaryRow = page.locator(`[data-equipment-id="${equipmentId}"]`);
  await expect(summaryRow).toContainText("2000-01-06");
  await expect(summaryRow).toContainText("2000-01-05");
  await summaryRow.getByRole("button", { name: "정비 등록", exact: true }).click();
  await expect(page.getByTestId("maintenance-equipment-item")).toHaveValue(equipmentId);
  await expect(page.getByTestId("maintenance-warehouse")).toHaveAttribute("placeholder", new RegExp(e2e.warehouseName));
  const title = `${e2e.prefix} 정비 기록`;
  await page.getByTestId("maintenance-title").fill(title);
  await page.getByTestId("maintenance-equipment-type").selectOption("replacement");
  await page.getByTestId("maintenance-equipment-vendor").fill("현장 교체업체");
  await expect(page.getByTestId("maintenance-equipment-cycle")).toBeChecked();
  await expect(page.getByTestId("maintenance-equipment-item")).toBeEnabled();
  await page.getByTestId("maintenance-save").click();
  await expect(page.getByTestId("equipment-overview")).toBeVisible();
  await expect(summaryRow).toContainText("현장 교체업체");
  const saved = await e2e.db.from("maints").select("id,warehouse,equipment_item_id,equipment_cycle_included,total").eq("title", title).single();
  if (saved.error) throw saved.error;
  expect(saved.data).toMatchObject({ equipment_item_id: equipmentId, equipment_cycle_included: true, total: 0 });
  expect(saved.data.warehouse).toContain(e2e.warehouseName);
  const maintenanceId = saved.data.id as string;
  await summaryRow.getByRole("button", { name: itemName, exact: true }).click();
  await expect(page.getByTestId("equipment-history-table").locator("tbody tr")).toHaveCount(8);
  const liveRow = page.locator(`[data-work-id="maintenance:${maintenanceId}"]`);
  await liveRow.getByRole("button", { name: /기록 수정/ }).click();
  await expect(page.getByTestId("maintenance-equipment-item")).toHaveValue(equipmentId);
  await page.getByPlaceholder("20260519 또는 260519").fill("20260901");
  await page.getByTestId("maintenance-equipment-vendor").fill("수정된 업체");
  await page.getByTestId("maintenance-save").click();
  await expect(page.getByTestId("equipment-overview")).toBeVisible();
  await expect(page.locator(`[data-equipment-id="${equipmentId}"]`)).toContainText("2026-09-01");
  await page.locator(`[data-equipment-id="${equipmentId}"]`).getByRole("button", { name: itemName, exact: true }).click();
  await expect(liveRow).toContainText("수정된 업체");
  await page.getByTestId("equipment-basic-edit").click();
  await page.getByTestId("equipment-spec").fill("E2E 30kW");
  await page.getByTestId("equipment-notes").fill("수정 비고");
  await page.getByTestId("equipment-item-save").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".equipment-detail-grid")).toContainText("E2E 30kW");
  const rawRow = page.locator(`[data-work-id="import:${e2e.prefix}-history-raw"]`);
  await rawRow.getByRole("button", { name: /기록 수정/ }).click();
  await expect(page.getByTestId("equipment-history-date-text")).toHaveValue("204-11-09");
  await page.getByTestId("equipment-history-vendor").fill("원본 이력 수정");
  await page.getByTestId("equipment-history-save").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rawRow).toContainText("원본 이력 수정");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("equipment-export").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Workbook download stream missing");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const book = XLSX.read(Buffer.concat(chunks), { type: "buffer" });
  expect(book.SheetNames).toEqual(["크라샤", "전체 작업이력"]);
  const history = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["전체 작업이력"]);
  expect(history.filter(row => row["관리 항목"] === itemName)).toHaveLength(8);
  expect(history.find(row => row["관리 항목"] === itemName && row["작업일"] === "204-11-09")?.["업체·작업표시"]).toBe("원본 이력 수정");
  await page.screenshot({ path: testInfo.outputPath("equipment-detail-1440.png") });

  await page.getByRole("button", { name: "백업/권한관리", exact: true }).click();
  const backupButton = page.getByRole("button", { name: "현재 화면 간단 백업", exact: true });
  await expect(backupButton).toBeEnabled();
  const backupDownloadPromise = page.waitForEvent("download");
  await backupButton.click();
  const backupDownload = await backupDownloadPromise;
  const backupStream = await backupDownload.createReadStream();
  if (!backupStream) throw new Error("Backup download stream missing");
  const backupChunks: Buffer[] = [];
  for await (const chunk of backupStream) backupChunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(backupChunks).toString("utf8")).data;
  const ownItems = backup.maintenance_equipment_items.filter((row: { id: string }) => row.id === equipmentId);
  const ownHistory = backup.maintenance_equipment_history.filter((row: { equipment_item_id: string }) => row.equipment_item_id === equipmentId);
  const ownMaints = backup.maints.filter((row: { id: string }) => row.id === maintenanceId);
  expect(ownItems).toHaveLength(1);
  expect(ownItems[0]).toMatchObject({ spec: "E2E 30kW", notes: "수정 비고" });
  expect(ownItems[0]).toHaveProperty("source_key");
  expect(ownHistory).toHaveLength(7);
  expect(backup.maintenance_equipment_settings).toHaveLength(1);
  expect(ownMaints).toHaveLength(1);
  const changed = await e2e.db.from("maintenance_equipment_items").update({ spec: "복구 검증용 임시값" }).eq("id", equipmentId);
  if (changed.error) throw changed.error;
  // Restore only this test's IDs; never overwrite another fixture or singleton.
  await page.locator('.restore-file-picker input[type="file"]').setInputFiles({ name: "equipment-fixture-restore.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ data: { maintenance_equipment_items: ownItems, maintenance_equipment_history: ownHistory, maints: ownMaints } })) });
  const restoreDialogPromise = page.waitForEvent("dialog");
  const restoreClick = page.getByRole("button", { name: "선택한 백업 복구", exact: true }).click();
  const restoreDialog = await restoreDialogPromise;
  await restoreDialog.accept();
  await restoreClick;
  await expect(page.getByText("백업 복구가 완료되었습니다.", { exact: true })).toBeVisible();
  await expect.poll(async () => (await e2e.db.from("maintenance_equipment_items").select("spec").eq("id", equipmentId).single()).data?.spec).toBe("E2E 30kW");
  const maintenance = new MaintenancePage(page);
  await maintenance.openList();
  await maintenance.deleteFromList(title);
  await openEquipment(page);
  await page.locator(`[data-equipment-id="${equipmentId}"]`).getByRole("button", { name: itemName, exact: true }).click();
  await expect(page.getByTestId("equipment-history-table").locator("tbody tr")).toHaveCount(7);
  await maintenance.restoreFromTrash(title);
  await openEquipment(page);
  await page.locator(`[data-equipment-id="${equipmentId}"]`).getByRole("button", { name: itemName, exact: true }).click();
  await expect(page.getByTestId("equipment-history-table").locator("tbody tr")).toHaveCount(8);
  await expect(liveRow).toContainText("2026-09-01");
});

test("@regression 조회 실패 시 엑셀 차단·낙관적 수정 충돌·점검의 주기 제외를 확인한다", async ({ page, e2e }) => {
  const item = await seedEquipment(e2e);
  await loginAsE2EAdmin(page);
  await openEquipment(page);
  await page.locator(`[data-equipment-id="${item.id}"]`).getByRole("button", { name: "수정", exact: true }).click();
  await page.getByTestId("equipment-spec").fill("덮어쓰면 안 되는 값");
  const update = await e2e.db.from("maintenance_equipment_items").update({ spec: "다른 사용자의 수정" }).eq("id", item.id);
  if (update.error) throw update.error;
  const conflictResponsePromise = page.waitForResponse(response => response.url().includes("/rpc/save_maintenance_equipment_item") && response.request().method() === "POST");
  await page.getByTestId("equipment-item-save").click();
  expect((await conflictResponsePromise).status()).toBe(409);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("다른 사용자가 수정한 항목");
  const conflict = await e2e.db.from("maintenance_equipment_items").select("spec").eq("id", item.id).single();
  expect(conflict.data?.spec).toBe("다른 사용자의 수정");
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  await page.route(/\/rest\/v1\/maintenance_equipment_history\?/, route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "E2E 이력 조회 실패" }) }));
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByTestId("equipment-overview").getByRole("alert")).toContainText("E2E 이력 조회 실패");
  await expect(page.getByTestId("equipment-export")).toBeDisabled();
  await page.unroute(/\/rest\/v1\/maintenance_equipment_history\?/);
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByTestId("equipment-export")).toBeEnabled();
  await page.locator(`[data-equipment-id="${item.id}"]`).getByRole("button", { name: "정비 등록", exact: true }).click();
  await page.getByTestId("maintenance-equipment-type").selectOption("replacement");
  await expect(page.getByTestId("maintenance-equipment-cycle")).toBeChecked();
  await page.getByTestId("maintenance-equipment-type").selectOption("inspection");
  await expect(page.getByTestId("maintenance-equipment-cycle")).not.toBeChecked();
  await expect(page.getByTestId("maintenance-equipment-cycle")).toBeDisabled();
});

test("@mobile-smoke 모바일 설비현황과 편집 화면은 화면 밖으로 넘치지 않는다", async ({ page, e2e }, testInfo) => {
  const item = await seedEquipment(e2e, "모바일 벨트");
  await loginAsE2EAdmin(page);
  await openEquipment(page);
  await page.getByTestId("equipment-search").fill(e2e.prefix);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(`[data-equipment-id="${item.id}"]`).getByRole("button", { name: `${e2e.prefix} 모바일 벨트`, exact: true }).click();
  await page.getByTestId("equipment-basic-edit").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").evaluate(element => element.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("equipment-mobile-edit.png") });
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
});
