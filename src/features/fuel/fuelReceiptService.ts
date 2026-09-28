import type { SupabaseClient } from "@supabase/supabase-js";
import type { FuelRecord } from "./fuelTypes";

export type FuelReceiptPatch = {
  receipt_path: string;
  receipt_name: string;
  receipt_mime_type: string | null;
  receipt_uploaded_at: string;
  updated_at: string;
};

export type FuelReceiptClearPatch = {
  receipt_path: null;
  receipt_name: null;
  receipt_mime_type: null;
  receipt_uploaded_at: null;
  updated_at: string;
};

const fuelReceiptExtension = (file: File) => (file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg"))
  .replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";

export async function uploadFuelRecordReceipt(
  supabase: SupabaseClient,
  record: Pick<FuelRecord, "id" | "receipt_path">,
  file: File,
) {
  const extension = fuelReceiptExtension(file);
  const nextPath = `fuel/${record.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const previousPath = record.receipt_path || "";
  const { error: uploadError } = await supabase.storage.from("fuel-receipts").upload(nextPath, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) return { patch: null, error: `영수증 업로드에 실패했습니다. (${uploadError.message})` };

  const patch: FuelReceiptPatch = {
    receipt_path: nextPath,
    receipt_name: file.name,
    receipt_mime_type: file.type || null,
    receipt_uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase.from("fuel_records").update(patch).eq("id", record.id);
  if (updateError) {
    await supabase.storage.from("fuel-receipts").remove([nextPath]);
    return { patch: null, error: `영수증 정보를 저장하지 못했습니다. (${updateError.message})` };
  }
  if (previousPath && previousPath !== nextPath) await supabase.storage.from("fuel-receipts").remove([previousPath]);
  return { patch, error: null };
}

export async function getFuelReceiptSignedUrl(supabase: SupabaseClient, path: string) {
  return supabase.storage.from("fuel-receipts").createSignedUrl(path, 300);
}

export async function clearFuelRecordReceipt(supabase: SupabaseClient, recordId: string, oldPath: string) {
  const patch: FuelReceiptClearPatch = {
    receipt_path: null,
    receipt_name: null,
    receipt_mime_type: null,
    receipt_uploaded_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase.from("fuel_records").update(patch).eq("id", recordId);
  if (updateError) return { patch: null, updateError, removeError: null };
  const { error: removeError } = await supabase.storage.from("fuel-receipts").remove([oldPath]);
  return { patch, updateError: null, removeError };
}

export async function removeFuelReceiptObject(supabase: SupabaseClient, path: string) {
  return supabase.storage.from("fuel-receipts").remove([path]);
}

export async function uploadFuelReceiptForNewRecord(supabase: SupabaseClient, recordId: string, file: File) {
  const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  const safeExtension = extension && /^[a-z0-9]+$/.test(extension) && extension.length <= 8
    ? extension
    : file.type === "application/pdf"
      ? "pdf"
      : file.type.startsWith("image/")
        ? "jpg"
        : "bin";
  const nextPath = `fuel/${recordId}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
  const fallbackMimeType = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    ? "application/pdf"
    : "image/jpeg";
  const { error: uploadError } = await supabase.storage.from("fuel-receipts").upload(nextPath, file, {
    upsert: false,
    contentType: file.type || fallbackMimeType,
  });
  if (uploadError) return `영수증 업로드에 실패했습니다. (${uploadError.message})`;

  const patch: FuelReceiptPatch = {
    receipt_path: nextPath,
    receipt_name: file.name || "영수증",
    receipt_mime_type: file.type || fallbackMimeType,
    receipt_uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase.from("fuel_records").update(patch).eq("id", recordId);
  if (updateError) {
    await supabase.storage.from("fuel-receipts").remove([nextPath]);
    return `영수증 정보를 저장하지 못했습니다. (${updateError.message})`;
  }
  return null;
}
