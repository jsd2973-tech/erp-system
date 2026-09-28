import type { FuelStatementParty, FuelStatementRecord } from "./fuelStatementExport";

export type FuelRecord = FuelStatementRecord & {
  source_file?: string | null;
  source_fingerprint?: string | null;
  receipt_path?: string | null;
  receipt_name?: string | null;
  receipt_mime_type?: string | null;
  receipt_uploaded_at?: string | null;
  created_at?: string;
};

export type ParsedFuelRow = Omit<FuelRecord, "id" | "created_at">;
export type SummaryRow = { name: string; count: number; quantity: number; total: number };
export type FuelMasterCategory = "vehicle" | "station" | "product" | "site";
export type FuelMasterOption = { id: string; category: FuelMasterCategory; name: string; is_active: boolean; updated_at?: string };
export type FuelViewMode = "records" | "vehicle" | "site" | "station" | "basics";
export type FuelDetailTarget = { type: "vehicle" | "site" | "station"; name: string };

export type FuelManagementProps = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  vendors?: FuelStatementParty[];
};
