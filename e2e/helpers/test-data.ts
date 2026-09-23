import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TestInfo } from "@playwright/test";
import { readE2EEnvironment } from "../safety";

export type E2EData = {
  db: SupabaseClient;
  prefix: string;
  vendorId: string;
  vendorName: string;
  warehouseId: string;
  warehouseName: string;
  itemId: string;
  itemName: string;
  itemSpec: string;
  cleanup: () => Promise<void>;
};

export async function createE2EData(testInfo: TestInfo): Promise<E2EData> {
  const env = readE2EEnvironment();
  const db = createClient(env.supabaseURL, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await db.auth.signInWithPassword({ email: env.adminEmail, password: env.adminPassword });
  if (authError) throw new Error(`E2E data session could not sign in: ${authError.message}`);

  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `E2E-${ymd}-${testInfo.workerIndex}-${randomBytes(4).toString("hex")}`;
  const data: E2EData = {
    db,
    prefix,
    vendorId: `${prefix}-vendor`,
    vendorName: `${prefix} 테스트 거래처`,
    warehouseId: `${prefix}-warehouse`,
    warehouseName: `${prefix} 테스트 창고`,
    itemId: `${prefix}-item`,
    itemName: `${prefix} 테스트 베어링`,
    itemSpec: "E2E-PURCHASE-SPEC",
    cleanup: async () => {},
  };

  data.cleanup = async () => {
    try {
      const [purchaseResult, maintenanceResult, cardResult] = await Promise.all([
        db.from("purchases").select("id").eq("vendor", data.vendorName),
        db.from("maints").select("id").ilike("title", `${prefix}%`),
        db.from("card_uses").select("id").eq("place", `${prefix} 테스트상사`),
      ]);
      if (purchaseResult.error) throw new Error(`E2E purchase cleanup lookup failed: ${purchaseResult.error.message}`);
      if (maintenanceResult.error) throw new Error(`E2E maintenance cleanup lookup failed: ${maintenanceResult.error.message}`);
      if (cardResult.error) throw new Error(`E2E card cleanup lookup failed: ${cardResult.error.message}`);
      const purchaseIds = (purchaseResult.data || []).map((row) => String(row.id));
      const maintenanceIds = (maintenanceResult.data || []).map((row) => String(row.id));
      const cardIds = (cardResult.data || []).map((row) => String(row.id));
      const recordIds = [...purchaseIds, ...maintenanceIds, ...cardIds];

      if (purchaseIds.length) {
        const { error } = await db.from("maintenance_purchase_links").delete().in("purchase_id", purchaseIds);
        if (error) throw new Error(`E2E purchase link cleanup failed: ${error.message}`);
      }
      if (maintenanceIds.length) {
        const { error } = await db.from("maintenance_purchase_links").delete().in("maintenance_id", maintenanceIds);
        if (error) throw new Error(`E2E maintenance link cleanup failed: ${error.message}`);
      }
      if (recordIds.length) {
        const { error } = await db.from("activity_logs").delete().in("target_id", recordIds);
        if (error) throw new Error(`E2E activity cleanup failed: ${error.message}`);
      }
      if (maintenanceIds.length) {
        const { error } = await db.from("maints").delete().in("id", maintenanceIds);
        if (error) throw new Error(`E2E maintenance cleanup failed: ${error.message}`);
      }
      if (cardIds.length) {
        const { error } = await db.from("card_uses").delete().in("id", cardIds);
        if (error) throw new Error(`E2E card cleanup failed: ${error.message}`);
      }
      if (purchaseIds.length) {
        const { error } = await db.from("purchases").delete().in("id", purchaseIds);
        if (error) throw new Error(`E2E purchase cleanup failed: ${error.message}`);
      }

      for (const [table, id] of [["items", data.itemId], ["warehouses", data.warehouseId], ["vendors", data.vendorId]] as const) {
        const { error } = await db.from(table).delete().eq("id", id);
        if (error) throw new Error(`E2E ${table} cleanup failed: ${error.message}`);
      }
    } finally {
      await db.auth.signOut();
    }
  };

  try {
    const seedResults = await Promise.all([
      db.from("vendors").insert({ id: data.vendorId, code: `${prefix}-V`, name: data.vendorName }),
      db.from("warehouses").insert({ id: data.warehouseId, code: `${prefix}-W`, group: `${prefix}-G`, name: data.warehouseName }),
      db.from("items").insert({ id: data.itemId, code: `${prefix}-I`, name: data.itemName, spec: data.itemSpec, unit: "EA", price: 0 }),
    ]);
    const seedError = seedResults.find((result) => result.error)?.error;
    if (seedError) throw new Error(`E2E master data seed failed: ${seedError.message}`);
  } catch (error) {
    try {
      await data.cleanup();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "E2E seed failed and partial test data cleanup also failed.");
    }
    throw error;
  }

  return data;
}
