import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorrectionHistoryItem } from "./dispatchModel";

export const canCorrectDispatchTrips = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase.rpc("can_correct_dispatch_trip");
  return !error && data === true;
};

export const correctDispatchTripEvent = (supabase: SupabaseClient, tripId: string, correctionType: string, reason: string | null) =>
  supabase.rpc("correct_dispatch_trip_event", {
    p_trip_id: tripId,
    p_correction_type: correctionType,
    p_reason: reason,
  });

export const loadDispatchTripCorrectionHistory = async (supabase: SupabaseClient, tripId: string): Promise<CorrectionHistoryItem[]> => {
  const { data, error } = await supabase
    .from("dispatch_trip_corrections")
    .select("id,action,reason,before_status,after_status,corrected_by_email,corrected_at")
    .eq("trip_id", tripId)
    .order("corrected_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    action: String(row.action || ""),
    reason: String(row.reason || ""),
    before_status: String(row.before_status || ""),
    after_status: String(row.after_status || ""),
    corrected_by_email: String(row.corrected_by_email || ""),
    corrected_at: String(row.corrected_at || ""),
  }));
};
