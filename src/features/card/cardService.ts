import type { SupabaseClient } from "@supabase/supabase-js";
import type { CardUse } from "./cardTypes";

type CardSupabaseClient = Pick<SupabaseClient, "from" | "storage">;

export type CardReceiptUploadTools = {
  validateFiles: (files: FileList | File[]) => File[] | null;
  compressImage: (file: File) => Promise<File>;
  getFileExtension: (file: File, fallback?: string) => string;
  alert: (message: string) => void;
};

export const createCardService = (supabase: CardSupabaseClient) => ({
  fetchCardUses: async (ascending = false) => {
    let allRows: unknown[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("card_uses")
        .select("*")
        .order("date", { ascending })
        .range(from, to);

      if (error) return { data: allRows, error };

      const rows = data || [];
      allRows = [...allRows, ...rows];
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return { data: allRows, error: null };
  },

  saveCardUse: (cardUse: CardUse) =>
    supabase.from("card_uses").upsert(cardUse),

  deleteCardUse: (cardUseId: string) =>
    supabase.from("card_uses").delete().eq("id", cardUseId),

  uploadCardReceipts: async (files: FileList | File[], tools: CardReceiptUploadTools) => {
    const uploadedUrls: string[] = [];
    let ocrFile: File | null = null;
    const validFiles = tools.validateFiles(files);
    if (!validFiles) return { uploadedUrls, ocrFile };

    for (const file of validFiles) {
      const isImage =
        file.type.startsWith("image/") ||
        /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || "");

      const uploadFile = isImage ? await tools.compressImage(file) : file;
      const ext = tools.getFileExtension(
        uploadFile,
        tools.getFileExtension(file, isImage ? "jpg" : "bin"),
      );
      const uploadContentType =
        uploadFile.type || file.type || "application/octet-stream";
      const fileName = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("receipts").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: uploadContentType,
      });

      if (error) {
        tools.alert(`영수증 업로드 실패 (${file.name || "이름 없는 파일"}): ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from("receipts").getPublicUrl(fileName);
      const isAudioUpload = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg|aac)$/i.test(file.name || "");
      uploadedUrls.push(isAudioUpload ? `${data.publicUrl}?erp_file=audio` : data.publicUrl);
      if (isImage && !ocrFile) ocrFile = uploadFile;
    }

    return { uploadedUrls, ocrFile };
  },
});
