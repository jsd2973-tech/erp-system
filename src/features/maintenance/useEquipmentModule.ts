import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Maint } from "./maintenanceTypes";
import type { EquipmentBackupData, EquipmentHistoryDraft, EquipmentImportedHistory, EquipmentItem, EquipmentItemDraft, EquipmentSettings } from "./equipmentTypes";
import { buildEquipmentOverview, normalizeEquipmentHistory, normalizeEquipmentItem, normalizeEquipmentSettings } from "./equipmentModel";
import { createEquipmentService } from "./equipmentService";

type Props = { supabase: SupabaseClient; active: boolean; authKey: string; maintenanceRevision: Maint[] };
const EMPTY_BACKUP: EquipmentBackupData = { maintenance_equipment_items: [], maintenance_equipment_history: [], maintenance_equipment_settings: [] };
export type EquipmentModule = ReturnType<typeof useEquipmentModule>;

export function useEquipmentModule({ supabase, active, authKey, maintenanceRevision }: Props) {
  const service = useMemo(() => createEquipmentService(supabase), [supabase]);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [importedHistory, setImportedHistory] = useState<EquipmentImportedHistory[]>([]);
  const [linkedMaintenances, setLinkedMaintenances] = useState<Maint[]>([]);
  const [settings, setSettings] = useState<EquipmentSettings>(normalizeEquipmentSettings(null));
  const [backupData, setBackupData] = useState<EquipmentBackupData>(EMPTY_BACKUP);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const reload = useCallback(async () => {
    if (!active) return;
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const [itemResult, historyResult, maintResult, settingsResult] = await Promise.all([
        service.fetchItems(), service.fetchImportedHistory(), service.fetchLinkedMaintenances(), service.fetchSettings(),
      ]);
      if (request !== generation.current) return;
      const failure = itemResult.error || historyResult.error || maintResult.error || settingsResult.error;
      if (failure) throw new Error(failure.message);
      setItems((itemResult.data || []).map(normalizeEquipmentItem));
      setImportedHistory((historyResult.data || []).map(normalizeEquipmentHistory));
      setLinkedMaintenances((maintResult.data || []) as Maint[]);
      setSettings(normalizeEquipmentSettings(settingsResult.data));
      setBackupData({ maintenance_equipment_items: itemResult.data || [], maintenance_equipment_history: historyResult.data || [], maintenance_equipment_settings: settingsResult.data ? [settingsResult.data] : [] });
      setReady(true);
    } catch (caught) {
      if (request === generation.current) {
        setError(caught instanceof Error ? caught.message : "설비현황을 불러오지 못했습니다.");
        setReady(false);
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [service, active, authKey]);

  useEffect(() => {
    if (!active) {
      generation.current++;
      setItems([]); setImportedHistory([]); setLinkedMaintenances([]); setReady(false); setError(""); setLoading(false);
      setBackupData(EMPTY_BACKUP);
      return;
    }
    void reload();
    return () => { generation.current++; };
  }, [active, authKey, maintenanceRevision, reload]);

  const rows = useMemo(() => buildEquipmentOverview(items, importedHistory, linkedMaintenances), [items, importedHistory, linkedMaintenances]);

  const saveItem = async (item: EquipmentItem | null, draft: EquipmentItemDraft) => {
    const { data, error: saveError } = item
      ? await service.updateItem(item, draft)
      : await service.createItem(draft, items.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1);
    if (saveError) throw new Error(saveError.message);
    if (!data || (Array.isArray(data) && !data.length)) throw new Error("수정한 설비 정보를 확인하지 못했습니다. 새로고침 후 확인해주세요.");
    const updated = (Array.isArray(data) ? data : [data]).map(normalizeEquipmentItem);
    setItems(previous => [...previous.filter(row => !updated.some(next => next.id === row.id)), ...updated]);
    await reload();
    return updated.find(row => !item || row.id === item.id)!;
  };
  const saveImportedHistory = async (record: EquipmentImportedHistory, draft: EquipmentHistoryDraft) => {
    const { data, error: saveError } = await service.updateImportedHistory(record, draft);
    if (saveError) throw new Error(saveError.message);
    const updated = normalizeEquipmentHistory(data);
    setImportedHistory(previous => previous.map(row => row.id === updated.id ? updated : row));
    await reload();
  };
  const saveSettings = async (title: string, commonNote: string) => {
    const { data, error: saveError } = await service.updateSettings(settings, title, commonNote);
    if (saveError) throw new Error(saveError.message);
    setSettings(normalizeEquipmentSettings(data));
    await reload();
  };
  return { items, importedHistory, linkedMaintenances, rows, settings, backupData, loading, ready, error, reload, saveItem, saveImportedHistory, saveSettings };
}
