import type { SupabaseClient } from "@supabase/supabase-js";
import { fuelMonthBounds, normalizeFuelMasterOptions, normalizeFuelRecord } from "./fuelModel";
import type { FuelMasterCategory, FuelMasterOption, FuelRecord, ParsedFuelRow } from "./fuelTypes";

export type FuelRecordEdit = Pick<FuelRecord, "fuel_date" | "site_name" | "product_name" | "vehicle_number" | "station_name" | "memo"> & {
  updated_at: string;
};

export async function getFuelRecords(supabase: SupabaseClient, month: string) {
  const bounds = fuelMonthBounds(month);
  const { data, error } = await supabase
    .from("fuel_records")
    .select("*")
    .gte("fuel_date", bounds.from)
    .lte("fuel_date", bounds.to)
    .order("fuel_date", { ascending: false })
    .order("vehicle_number", { ascending: true });
  return { data: (data || []).map(normalizeFuelRecord), error };
}

export async function getFuelMasterOptions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("fuel_master_options")
    .select("id,category,name,is_active,updated_at")
    .order("category")
    .order("name");
  return { data: normalizeFuelMasterOptions(data || []), error };
}

export async function getFuelReferenceRecords(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("fuel_records")
    .select("fuel_date,site_name,product_name,vehicle_number,unit_price,station_name,quantity,total_amount,usage_count,line_amount,supply_amount,vat_amount,id")
    .order("fuel_date", { ascending: false })
    .limit(2000);
  return { data: data as FuelRecord[] | null, error };
}

export async function addFuelMasterOption(supabase: SupabaseClient, category: FuelMasterCategory, name: string) {
  return supabase.from("fuel_master_options").insert({ category, name, is_active: true });
}

export async function renameFuelMasterOption(supabase: SupabaseClient, row: FuelMasterOption, name: string) {
  return supabase.from("fuel_master_options")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", row.id);
}

export async function setFuelMasterOptionActive(supabase: SupabaseClient, row: FuelMasterOption, isActive: boolean) {
  return supabase.from("fuel_master_options")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", row.id);
}

export async function importFuelRows(supabase: SupabaseClient, rows: ParsedFuelRow[]) {
  return supabase.from("fuel_records").upsert(rows, {
    onConflict: "source_fingerprint",
    ignoreDuplicates: true,
  });
}

export async function insertFuelRecord(supabase: SupabaseClient, payload: Record<string, unknown>) {
  return supabase.from("fuel_records").insert(payload);
}

export async function updateFuelRecord(supabase: SupabaseClient, id: string, payload: FuelRecordEdit) {
  return supabase.from("fuel_records").update(payload).eq("id", id);
}

export async function deleteFuelRecord(supabase: SupabaseClient, id: string) {
  return supabase.from("fuel_records").delete().eq("id", id);
}

export async function getFuelStatementParties(supabase: SupabaseClient) {
  return supabase.from("vendors")
    .select("code,name,owner,phone,mobile,address,address_detail")
    .order("code");
}
