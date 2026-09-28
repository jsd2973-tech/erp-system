import type { SupabaseClient } from "@supabase/supabase-js";

type MaintenanceSupabaseClient = Pick<SupabaseClient, "from" | "storage">;

export type MaintenanceAttachmentTools = {
  validateFiles: (files: FileList | File[]) => File[] | null;
  compressImage: (file: File) => Promise<File>;
  getFileExtension: (file: File) => string;
};

export const createMaintenanceService = (supabase: MaintenanceSupabaseClient) => ({
  fetchMaintenances: async (pageSize = 1000) => {
    let allRows: unknown[] = [];
    let from = 0;

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("maints")
        .select("*")
        .order("date", { ascending: false })
        .range(from, to);

      if (error) return { data: allRows, error };
      const rows = data || [];
      allRows = [...allRows, ...rows];
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return { data: allRows, error: null };
  },

  saveMaintenance: (maintenance: Record<string, unknown>) =>
    supabase.from("maints").upsert(maintenance),

  restoreMaintenance: (maintenance: Record<string, unknown>) =>
    supabase.from("maints").upsert(maintenance),

  deleteMaintenance: (maintenanceId: string) =>
    supabase.from("maints").delete().eq("id", maintenanceId),

  uploadAttachments: async (
    files: FileList | File[],
    tools: MaintenanceAttachmentTools,
    onUploadError: (fileName: string, message: string) => void,
  ) => {
    const uploadedUrls: string[] = [];
    const validFiles = tools.validateFiles(files);
    if (!validFiles) return uploadedUrls;

    for (const file of validFiles) {
      const isImage = file.type.startsWith("image/");
      const uploadFile = isImage ? await tools.compressImage(file) : file;
      const ext = isImage ? "jpg" : tools.getFileExtension(file);
      const fileName = "maint-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;

      const { error } = await supabase.storage.from("receipts").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: isImage ? "image/jpeg" : file.type || "application/octet-stream",
      });

      if (error) {
        onUploadError(file.name || "이름 없는 파일", error.message);
        continue;
      }

      const { data } = supabase.storage.from("receipts").getPublicUrl(fileName);
      const isAudioUpload = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg|aac)$/i.test(file.name || "");
      uploadedUrls.push(isAudioUpload ? data.publicUrl + "?erp_file=audio" : data.publicUrl);
    }

    return uploadedUrls;
  },
});
