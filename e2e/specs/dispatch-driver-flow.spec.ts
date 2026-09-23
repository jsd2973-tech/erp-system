import { createClient } from "@supabase/supabase-js";
import { devices, type Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { createDispatchE2EFixture } from "../helpers/dispatch-test-data";
import { loginAsE2EAdmin } from "../pages/login.page";
import { readE2EEnvironment } from "../safety";

const seoulToday = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const openDispatchView = async (page: Page, view: "dispatch_status" | "dispatch_results") => {
  const group = page.locator(".menu-group").filter({ has: page.getByRole("button", { name: "운행관리", exact: true }) });
  const menu = group.getByTestId(`menu-${view}`);
  if (!(await menu.isVisible())) await group.getByRole("button", { name: "운행관리", exact: true }).click();
  await menu.click();
};

test("@regression 배차 운행·GPS·정정·운송실적 핵심 흐름", async ({ page, browser, e2e }) => {
  const env = readE2EEnvironment();
  test.skip(!env.driverEmail || !env.driverPassword, "Dispatch browser E2E requires the dedicated test-only E2E_DRIVER_EMAIL and E2E_DRIVER_PASSWORD account.");
  await loginAsE2EAdmin(page);

  const driverAuth = createClient(env.supabaseURL, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: driverSession, error: driverSignInError } = await driverAuth.auth.signInWithPassword({
    email: env.driverEmail!,
    password: env.driverPassword!,
  });
  if (driverSignInError || !driverSession.user) {
    throw new Error("The dedicated E2E driver account could not authenticate in the isolated test project.");
  }

  let fixture: Awaited<ReturnType<typeof createDispatchE2EFixture>> | undefined;
  let driverContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    fixture = await createDispatchE2EFixture(e2e.db, driverAuth, e2e.prefix, driverSession.user.id);
    driverContext = await browser.newContext({
      baseURL: env.baseURL,
      ...devices["Pixel 7"],
      permissions: ["geolocation"],
      geolocation: { latitude: 37.4215, longitude: 127.105, accuracy: 8 },
    });
    const driverPage = await driverContext.newPage();
    await driverPage.route("https://nominatim.openstreetmap.org/reverse**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ address: { state: "E2E 가상도", city: "테스트시", town: "회귀동", road: "테스트로" } }),
    }));
    await driverPage.goto("/");
    await driverPage.locator('input[autocomplete="username"]').fill(env.driverEmail!);
    await driverPage.locator('input[autocomplete="current-password"]').fill(env.driverPassword!);
    await driverPage.getByRole("button", { name: "로그인", exact: true }).click();
    const driverApp = driverPage.locator(".driver-mobile-app");
    await expect(driverApp).toBeVisible();
    await expect(driverApp.getByRole("heading", { name: "오늘 배차" })).toBeVisible();
    const orderCard = driverApp.locator(".driver-order-card").filter({ hasText: fixture.vendorName });
    await expect(orderCard).toBeVisible();

    let firstTripId = "";
    for (let tripIndex = 0; tripIndex < 3; tripIndex += 1) {
      if (tripIndex === 0) {
        await orderCard.getByRole("button", { name: "운행 입력", exact: true }).click();
        await driverApp.getByRole("button", { name: "운행 시작", exact: true }).click();
      } else {
        // "다음 운행 시작" is the start action itself and creates the next trip.
        await driverApp.getByRole("button", { name: "다음 운행 시작", exact: true }).click();
      }
      await expect(driverApp.getByRole("button", { name: "상차 완료", exact: true })).toBeVisible();
      await expect.poll(async () => {
        const { data, error } = await e2e.db
          .from("dispatch_trips")
          .select("id,status,actual_volume,loading_completed_at,unloading_completed_at")
          .eq("dispatch_order_id", fixture!.orderId)
          .eq("trip_no", tripIndex + 1)
          .maybeSingle();
        if (error) throw error;
        return data;
      }).toMatchObject({ status: "상차대기" });

      await driverPage.getByRole("button", { name: "상차 완료", exact: true }).click();
      await expect(driverApp.locator(".driver-volume-input input")).toBeVisible();
      const { data: currentTrips, error: currentTripsError } = await e2e.db
        .from("dispatch_trips")
        .select("id,status,loading_completed_at")
        .eq("dispatch_order_id", fixture.orderId)
        .eq("trip_no", tripIndex + 1)
        .single();
      expect(currentTripsError).toBeNull();
      if (!currentTrips) throw new Error("The started E2E trip was not returned by the test database.");
      if (tripIndex === 0) firstTripId = currentTrips.id;
      expect(currentTrips).toMatchObject({ status: "진행중", loading_completed_at: expect.any(String) });
      const { data: loadingLocation, error: loadingLocationError } = await e2e.db
        .from("dispatch_trip_locations")
        .select("latitude,longitude,event_type")
        .eq("trip_id", currentTrips.id)
        .eq("event_type", "loading")
        .single();
      expect(loadingLocationError).toBeNull();
      expect(loadingLocation).toMatchObject({ latitude: 37.4215, longitude: 127.105, event_type: "loading" });

      await driverApp.locator(".driver-volume-input input").fill("17");
      await driverApp.getByRole("button", { name: "하차 완료", exact: true }).click();
      await expect(driverApp.getByRole("button", { name: "다음 운행 시작", exact: true })).toBeVisible();
      const { data: completedTrip, error: completedTripError } = await e2e.db
        .from("dispatch_trips")
        .select("id,status,actual_volume,loading_completed_at,unloading_completed_at")
        .eq("id", currentTrips.id)
        .single();
      expect(completedTripError).toBeNull();
      expect(completedTrip).toMatchObject({ status: "완료", actual_volume: 17, loading_completed_at: expect.any(String), unloading_completed_at: expect.any(String) });
      const { data: unloadingLocation, error: unloadingLocationError } = await e2e.db
        .from("dispatch_trip_locations")
        .select("latitude,longitude,event_type")
        .eq("trip_id", currentTrips.id)
        .eq("event_type", "unloading")
        .single();
      expect(unloadingLocationError).toBeNull();
      expect(unloadingLocation).toMatchObject({ latitude: 37.4215, longitude: 127.105, event_type: "unloading" });
      await expect(driverApp).not.toContainText("회귀동 테스트로");
      await expect(driverApp).not.toContainText("37.4215");
    }

    const { data: allTrips, error: allTripsError } = await e2e.db
      .from("dispatch_trips")
      .select("id,status,actual_volume,unloading_completed_at")
      .eq("dispatch_order_id", fixture.orderId);
    expect(allTripsError).toBeNull();
    expect(allTrips).toHaveLength(3);
    expect(allTrips?.every((trip) => trip.status === "완료" && trip.unloading_completed_at)).toBe(true);
    expect(allTrips?.reduce((sum, trip) => sum + Number(trip.actual_volume), 0)).toBe(51);

    await openDispatchView(page, "dispatch_results");
    const results = page.locator(".transport-results");
    await expect(results.getByRole("heading", { name: "운송실적" })).toBeVisible();
    const vendorGroup = results.locator(".transport-group").filter({ hasText: fixture.vendorName });
    await expect(vendorGroup).toContainText("3회");
    await expect(vendorGroup).toContainText("51루베");
    await vendorGroup.locator("summary").click();
    const vendorDay = vendorGroup.locator(".transport-day-drilldown");
    await expect(vendorDay).toHaveCount(1);
    await expect(vendorDay.first()).toContainText("3회 · 51루베");
    const vehicleSummary = vendorGroup.locator(".transport-vehicle-detail");
    await expect(vehicleSummary).toHaveCount(1);
    await expect(vehicleSummary.first()).toContainText(`${e2e.prefix}-덤프`);
    await expect(vehicleSummary.first()).toContainText("3회 · 51루베");
    await vendorGroup.locator(".transport-day-drilldown").click();
    const drilldown = page.getByRole("dialog");
    await expect(drilldown.locator(".transport-drilldown-kpis")).toContainText("3회");
    await expect(drilldown.locator(".transport-drilldown-kpis")).toContainText("51루베");
    await expect(drilldown.locator(".transport-drilldown-row")).toHaveCount(3);
    await drilldown.getByRole("button", { name: "상세 닫기" }).click();

    await results.getByRole("button", { name: "품목별", exact: true }).click();
    const itemGroup = results.locator(".transport-group").filter({ hasText: fixture.itemName });
    await expect(itemGroup).toContainText("3회");
    await expect(itemGroup).toContainText("51루베");
    await itemGroup.locator("summary").click();
    const itemVendorBreakdown = itemGroup.locator(".transport-breakdown-list").last();
    await expect(itemVendorBreakdown).toContainText(fixture.vendorName);
    await expect(itemVendorBreakdown).toContainText("3회 · 51루베");
    const itemDay = itemGroup.locator(".transport-day-drilldown");
    await expect(itemDay).toHaveCount(1);
    await expect(itemDay.first()).toContainText("3회 · 51루베");

    await openDispatchView(page, "dispatch_status");
    const dashboard = page.locator(".driver-status-dashboard");
    const driverMaster = dashboard.locator(".driver-master-item").filter({ hasText: fixture.driverName });
    await expect(driverMaster).toBeVisible();
    await driverMaster.click();
    const driverSummary = dashboard.locator(".driver-detail-stats");
    await expect(driverSummary).toContainText("3회");
    await expect(driverSummary).toContainText("51루베");
    await dashboard.locator(".dispatch-mobile-editor-toggle").filter({ hasText: "오늘의 운행내역" }).click();
    const tripRows = dashboard.locator(".driver-trip-history-detail .driver-trip-row");
    await expect(tripRows).toHaveCount(3);
    await expect(tripRows.first()).toContainText("회귀동 테스트로");

    const firstTripRow = tripRows.first();
    await firstTripRow.getByRole("button", { name: "정정", exact: true }).click();
    const correctionDialog = page.getByRole("dialog");
    await expect(correctionDialog.getByRole("heading", { name: "하차완료 취소" })).toBeVisible();
    await correctionDialog.getByPlaceholder("오입력, 현장 확인 후 정정 등").fill(`${e2e.prefix} E2E correction`);
    await correctionDialog.getByRole("button", { name: "정정 실행", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("하차완료 취소 정정이 완료되었습니다.");

    const correctedTripId = firstTripId;
    expect(correctedTripId).not.toBe("");
    await expect.poll(async () => {
      const { data, error } = await e2e.db.from("dispatch_trips")
        .select("status,loading_completed_at,unloading_completed_at,actual_volume")
        .eq("id", correctedTripId).single();
      if (error) throw error;
      return data;
    }).toMatchObject({ status: "진행중", loading_completed_at: expect.any(String), unloading_completed_at: null, actual_volume: 17 });
    const { data: afterUnloadingCorrectionLocations, error: afterUnloadingCorrectionError } = await e2e.db
      .from("dispatch_trip_locations").select("event_type").eq("trip_id", correctedTripId);
    expect(afterUnloadingCorrectionError).toBeNull();
    expect(afterUnloadingCorrectionLocations?.map((location) => location.event_type)).toEqual(["loading"]);

    await openDispatchView(page, "dispatch_results");
    await page.locator(".transport-results").getByRole("button", { name: "거래처별", exact: true }).click();
    await expect.poll(async () => {
      const group = page.locator(".transport-group").filter({ hasText: fixture!.vendorName });
      return await group.innerText().catch(() => "");
    }).toContain("34루베");

    await openDispatchView(page, "dispatch_status");
    await dashboard.locator(".driver-master-item").filter({ hasText: fixture.driverName }).click();
    await dashboard.locator(".dispatch-mobile-editor-toggle").filter({ hasText: "오늘의 운행내역" }).click();
    const correctedRow = dashboard.locator(".driver-trip-history-detail .driver-trip-row").filter({ hasText: "진행중" });
    await correctedRow.getByRole("button", { name: "정정", exact: true }).click();
    let nextCorrection = page.getByRole("dialog");
    await expect(nextCorrection.getByRole("heading", { name: "상차완료 취소" })).toBeVisible();
    await nextCorrection.getByRole("button", { name: "정정 실행", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("상차완료 취소 정정이 완료되었습니다.");
    await expect.poll(async () => {
      const { data, error } = await e2e.db.from("dispatch_trips")
        .select("status,loading_completed_at,unloading_completed_at")
        .eq("id", correctedTripId).single();
      if (error) throw error;
      return data;
    }).toMatchObject({ status: "상차대기", loading_completed_at: null, unloading_completed_at: null });
    const { data: afterLoadingCorrectionLocations, error: afterLoadingCorrectionError } = await e2e.db
      .from("dispatch_trip_locations").select("event_type").eq("trip_id", correctedTripId);
    expect(afterLoadingCorrectionError).toBeNull();
    expect(afterLoadingCorrectionLocations).toHaveLength(0);

    await dashboard.locator(".driver-trip-history-detail .driver-trip-row").filter({ hasText: "상차대기" }).getByRole("button", { name: "정정", exact: true }).click();
    nextCorrection = page.getByRole("dialog");
    await expect(nextCorrection.getByRole("heading", { name: "운행시작 취소" })).toBeVisible();
    await nextCorrection.getByRole("button", { name: "정정 실행", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("운행시작 취소 정정이 완료되었습니다.");
    await expect.poll(async () => {
      const { data, error } = await e2e.db.from("dispatch_trips")
        .select("status,loading_completed_at,unloading_completed_at")
        .eq("id", correctedTripId).single();
      if (error) throw error;
      return data;
    }).toMatchObject({ status: "취소", loading_completed_at: null, unloading_completed_at: null });

    const { data: corrections, error: correctionsError } = await e2e.db
      .from("dispatch_trip_corrections")
      .select("action,before_status,after_status,reason")
      .eq("trip_id", correctedTripId)
      .order("corrected_at", { ascending: true });
    expect(correctionsError).toBeNull();
    expect(corrections).toHaveLength(3);
    expect(corrections?.map((row) => row.action)).toEqual(["하차완료 취소", "상차완료 취소", "운행시작 취소"]);
    expect(corrections?.[0].reason).toBe(`${e2e.prefix} E2E correction`);
  } finally {
    try {
      await driverContext?.close();
    } finally {
      try {
        await fixture?.cleanup();
      } finally {
        await driverAuth.auth.signOut();
      }
    }
  }
});
