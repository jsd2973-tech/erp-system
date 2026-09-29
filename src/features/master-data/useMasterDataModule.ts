import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMasterDataService } from "./masterDataService";
import {
  buildVendorExportRows,
  vendorExportFileName,
} from "./vendorExport";
import {
  emptyVendorForm,
  filterMasterItems,
  getEcountVendorRowKey,
  groupEcountVendorRowsByName,
  nextItemCode,
  nextWarehouseCode,
  normalizeMasterItems,
  cleanVendorImportText,
} from "./masterDataModel";
import {
  mapItemImportRows,
  mapVendorImportRows,
  mergeItemImportRows,
  mergeVendorImportRows,
  readEcountVendorRows,
  readMasterDataRows,
} from "./masterDataImport";
import type {
  EcountVendorImportRow,
  ItemForm,
  MasterDataSnapshot,
  MasterItem,
  TrashInput,
  Vendor,
  VendorForm,
  Warehouse,
  WarehouseForm,
  WarehouseGroup,
  WarehouseGroupForm,
} from "./masterDataTypes";

type PurchaseItemFormState = { open: boolean; rowIndex: number | null };
type VendorEcountReview = { rows: EcountVendorImportRow[]; currentVendors: Vendor[] };
type PostcodeData = {
  userSelectedType?: string;
  jibunAddress?: string;
  roadAddress?: string;
  address?: string;
};
type PostcodeInstance = { embed: (container: HTMLElement, options: { autoClose: boolean }) => void };
type PostcodeConstructor = new (options: {
  oncomplete: (data: PostcodeData) => void;
  width: string;
  height: string;
}) => PostcodeInstance;
type PostcodeWindow = { kakao?: { Postcode?: PostcodeConstructor }; daum?: { Postcode?: PostcodeConstructor } };

export type MasterDataModuleOptions = {
  supabase: SupabaseClient;
  canCreateRecords: boolean;
  canEditDeleteRecords: boolean;
  isAdmin: boolean;
  createId: () => string;
  getTodayKey: () => string;
  showToast: (message: string) => void;
  downloadExcel: (fileName: string, rows: Record<string, unknown>[]) => void;
  moveToTrash: (record: TrashInput) => Promise<boolean>;
  moveRecordsToTrash: (records: TrashInput[]) => Promise<boolean>;
  onPurchaseItemCreated: (rowIndex: number, item: MasterItem) => void;
};

const readLocalValue = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

export const useMasterDataModule = ({
  supabase,
  canCreateRecords,
  canEditDeleteRecords,
  isAdmin,
  createId,
  getTodayKey,
  showToast,
  downloadExcel,
  moveToTrash,
  moveRecordsToTrash,
  onPurchaseItemCreated,
}: MasterDataModuleOptions) => {
  const service = useMemo(() => createMasterDataService(supabase), [supabase]);

  const [vendors, setVendors] = useState<Vendor[]>(() => readLocalValue("erp_vendors_v2", [
    { id: createId(), code: "V001", name: "수산세보틱스", owner: "", phone: "", mobile: "" },
    { id: createId(), code: "V002", name: "영재카", owner: "", phone: "", mobile: "" },
  ]));
  const [groups, setGroups] = useState<WarehouseGroup[]>(() => readLocalValue("erp_groups_v2", [
    { id: createId(), code: "0001", name: "크라샤" },
    { id: createId(), code: "0002", name: "폐목" },
  ]));
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => readLocalValue("erp_warehouses_v2", [
    { id: createId(), code: "0001", group: "크라샤", name: "로더" },
    { id: createId(), code: "0002", group: "크라샤", name: "암프" },
  ]));
  const [items, setItems] = useState<MasterItem[]>(() => readLocalValue("erp_items_v2", [
    { id: createId(), code: "0001", name: "유압호스", spec: "A형", unit: "ea", price: 50000 },
    { id: createId(), code: "0002", name: "베어링", spec: "B형", unit: "ea", price: 20000 },
    { id: createId(), code: "0003", name: "타이어", spec: "29인치", unit: "ea", price: 300000 },
  ]));

  const [vendorForm, setVendorForm] = useState<VendorForm>(emptyVendorForm);
  const [vendorImportMessage, setVendorImportMessage] = useState("");
  const [editingVendorId, setEditingVendorId] = useState("");
  const [vendorEcountReview, setVendorEcountReview] = useState<VendorEcountReview | null>(null);
  const [vendorEcountSelections, setVendorEcountSelections] = useState<Record<string, string>>({});
  const [vendorEcountImporting, setVendorEcountImporting] = useState(false);
  const [vendorAddressSearchOpen, setVendorAddressSearchOpen] = useState(false);
  const [vendorAddressSearchReady, setVendorAddressSearchReady] = useState(false);
  const [vendorAddressSearchError, setVendorAddressSearchError] = useState("");
  const vendorAddressSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const vendorAddressDetailRef = useRef<HTMLInputElement | null>(null);

  const [groupForm, setGroupForm] = useState<WarehouseGroupForm>(() => ({ code: nextWarehouseCode(groups), name: "" }));
  const [warehouseForm, setWarehouseForm] = useState<WarehouseForm>(() => ({ group: "", code: nextWarehouseCode(warehouses), name: "" }));
  const [editingGroupId, setEditingGroupId] = useState("");
  const [editingWarehouseId, setEditingWarehouseId] = useState("");
  const [itemForm, setItemForm] = useState<ItemForm>(() => ({ code: nextItemCode(items), name: "", spec: "", unit: "", price: "" }));
  const [itemImportMessage, setItemImportMessage] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [newItemModal, setNewItemModal] = useState<PurchaseItemFormState>({ open: false, rowIndex: null });
  const [newItemForm, setNewItemForm] = useState<ItemForm>(() => ({ code: nextItemCode(items), name: "", spec: "", unit: "", price: "" }));

  const filteredItems = useMemo(() => filterMasterItems(items, itemSearch), [items, itemSearch]);

  useEffect(() => {
    const postcodeWindow = window as unknown as PostcodeWindow;
    const markReady = () => {
      if (postcodeWindow.kakao?.Postcode || postcodeWindow.daum?.Postcode) {
        setVendorAddressSearchReady(true);
        setVendorAddressSearchError("");
      }
    };
    markReady();
    if (postcodeWindow.kakao?.Postcode || postcodeWindow.daum?.Postcode) return;

    const existingScript = document.getElementById("kakao-postcode-script") as HTMLScriptElement | null;
    const script = existingScript || document.createElement("script");
    const handleError = () => setVendorAddressSearchError("주소 검색 서비스를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
    script.addEventListener("load", markReady);
    script.addEventListener("error", handleError);
    if (!existingScript) {
      script.id = "kakao-postcode-script";
      script.src = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      document.head.appendChild(script);
    }
    return () => {
      script.removeEventListener("load", markReady);
      script.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (!vendorAddressSearchOpen || !vendorAddressSearchReady || !vendorAddressSearchContainerRef.current) return;
    const postcodeWindow = window as unknown as PostcodeWindow;
    const Postcode = postcodeWindow.kakao?.Postcode || postcodeWindow.daum?.Postcode;
    if (!Postcode) return;

    const container = vendorAddressSearchContainerRef.current;
    container.innerHTML = "";
    new Postcode({
      oncomplete: (data) => {
        const selectedAddress = data.userSelectedType === "J"
          ? data.jibunAddress
          : data.roadAddress || data.address;
        setVendorForm((previous) => ({ ...previous, address: selectedAddress || data.address || "" }));
        setVendorAddressSearchOpen(false);
        window.setTimeout(() => vendorAddressDetailRef.current?.focus(), 0);
      },
      width: "100%",
      height: "100%",
    }).embed(container, { autoClose: false });
  }, [vendorAddressSearchOpen, vendorAddressSearchReady]);

  useEffect(() => {
    if (!vendorAddressSearchOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVendorAddressSearchOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [vendorAddressSearchOpen]);

  const applySnapshot = (snapshot: MasterDataSnapshot) => {
    const nextItems = normalizeMasterItems(snapshot.items as unknown as Array<Record<string, unknown>>);
    setVendors(snapshot.vendors);
    setGroups(snapshot.groups);
    setWarehouses(snapshot.warehouses);
    setItems(nextItems);
    setVendorForm(emptyVendorForm());
    setGroupForm({ code: nextWarehouseCode(snapshot.groups), name: "" });
    setWarehouseForm({ group: "", code: nextWarehouseCode(snapshot.warehouses), name: "" });
    setItemForm({ code: nextItemCode(nextItems), name: "", spec: "", unit: "", price: "" });
  };

  const openVendorAddressSearch = () => {
    setVendorAddressSearchError("");
    setVendorAddressSearchOpen(true);
  };

  const downloadVendorsExcel = () => {
    downloadExcel(vendorExportFileName(getTodayKey()), buildVendorExportRows(vendors));
  };

  const saveVendor = async () => {
    if (editingVendorId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    const code = vendorForm.code.trim();
    const name = vendorForm.name.trim();
    if (!name) return;

    const existing = editingVendorId ? vendors.find((vendor) => vendor.id === editingVendorId) : undefined;
    if (editingVendorId && !existing) return alert("수정할 거래처를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.");

    const duplicate = vendors.find((vendor) =>
      vendor.id !== editingVendorId && ((code !== "" && vendor.code.trim() === code) || vendor.name.trim() === name),
    );
    if (duplicate) {
      const duplicateField = code !== "" && duplicate.code.trim() === code ? "거래처코드" : "거래처명";
      return alert(`같은 ${duplicateField}의 거래처가 이미 있습니다. 기존 거래처를 선택해 수정해 주세요.`);
    }

    const payload: Vendor = { ...vendorForm, id: existing?.id || createId(), code, name };
    const { error } = await service.upsertVendor(payload);
    if (error) return alert(`거래처 저장 실패: ${error.message}`);
    const next = existing ? vendors.map((vendor) => (vendor.id === existing.id ? payload : vendor)) : [...vendors, payload];
    setVendors(next);
    setVendorForm(emptyVendorForm());
    setEditingVendorId("");
    showToast(existing ? "거래처 정보를 수정했습니다." : "거래처를 등록했습니다.");
  };

  const importVendors = async (file: File) => {
    const rows = await readMasterDataRows(file);
    const imported = mapVendorImportRows(rows, vendors, createId);
    const merged = mergeVendorImportRows(vendors, imported);
    const { error } = await service.upsertVendors(merged);
    if (error) return alert(`거래처 업로드 실패: ${error.message}`);
    setVendors(merged);
    setVendorImportMessage(`${imported.length}건 불러왔습니다.`);
  };

  const importEcountVendorDetails = async (
    rows: EcountVendorImportRow[],
    selectionOverrides: Record<string, string> | null = null,
  ): Promise<boolean> => {
    if (!canCreateRecords) {
      alert("등록 권한이 없습니다.");
      return false;
    }
    if (!rows.length) {
      setVendorImportMessage("이카운트 파일에 거래처 데이터가 없습니다.");
      alert("이카운트 파일에서 거래처 데이터를 찾지 못했습니다.");
      return false;
    }

    const invalidRows = rows.filter((row) => !row.name);
    if (invalidRows.length) {
      const details = invalidRows.slice(0, 8).map((row) => `${row.sourceSheet} ${row.sourceRow}행 (${row.code || "코드 없음"} / 상호 없음)`).join("\n");
      setVendorImportMessage(`이카운트 대조 중단 · 필수값 누락 ${invalidRows.length}건`);
      alert(`이카운트 거래처 정보 반영을 중단했습니다.\n거래처명이 있어야 ERP 거래처와 연결할 수 있습니다.\n\n${details}${invalidRows.length > 8 ? `\n외 ${invalidRows.length - 8}건` : ""}`);
      return false;
    }

    const vendorResult = await service.fetchVendors();
    if (vendorResult.error) {
      setVendorImportMessage("이카운트 대조 실패 · 현재 거래처 목록을 불러오지 못했습니다.");
      alert(`현재 거래처 목록을 불러오지 못해 반영을 중단했습니다. (${vendorResult.error.message})`);
      return false;
    }

    const currentVendors = vendorResult.data || [];
    const matched: { source: EcountVendorImportRow; vendor: Vendor }[] = [];
    const mismatches: { source: EcountVendorImportRow; reason: string }[] = [];
    const rowsByName = new Map<string, EcountVendorImportRow[]>();
    rows.forEach((source) => {
      const sameNameRows = rowsByName.get(source.name) || [];
      sameNameRows.push(source);
      rowsByName.set(source.name, sameNameRows);
    });

    const duplicateGroups = groupEcountVendorRowsByName(rows);
    if (!selectionOverrides && duplicateGroups.length) {
      const defaultSelections: Record<string, string> = {};
      duplicateGroups.forEach(([name, sameNameRows]) => {
        const nameMatches = currentVendors.filter((vendor) => vendor.name && cleanVendorImportText(vendor.name) === name);
        if (nameMatches.length !== 1) return;
        const exactCodeRows = sameNameRows.filter((source) => source.code && cleanVendorImportText(source.code) === cleanVendorImportText(nameMatches[0].code));
        if (exactCodeRows.length === 1) defaultSelections[name] = getEcountVendorRowKey(exactCodeRows[0]);
      });
      setVendorEcountSelections(defaultSelections);
      setVendorEcountReview({ rows, currentVendors });
      setVendorImportMessage(`중복 상호 ${duplicateGroups.length}건 · 반영할 행을 선택해 주세요.`);
      return false;
    }

    const selectedRows = selectionOverrides
      ? Array.from(rowsByName.entries()).flatMap(([name, sameNameRows]) => {
          if (sameNameRows.length === 1) return sameNameRows;
          const selectedKey = selectionOverrides[name];
          return sameNameRows.filter((source) => getEcountVendorRowKey(source) === selectedKey);
        })
      : rows;
    if (!selectedRows.length) {
      setVendorImportMessage("이카운트 반영 대기 · 선택된 거래처가 없습니다.");
      alert("반영할 거래처를 하나 이상 선택해 주세요.");
      return false;
    }

    selectedRows.forEach((source) => {
      const nameMatches = currentVendors.filter((vendor) => vendor.name && cleanVendorImportText(vendor.name) === source.name);
      if (!nameMatches.length) {
        const codeMatch = source.code && currentVendors.find((vendor) => vendor.code && cleanVendorImportText(vendor.code) === source.code);
        mismatches.push({
          source,
          reason: codeMatch ? `상호 불일치 (ERP: ${codeMatch.name?.trim() || "-"})` : "ERP 거래처명 없음",
        });
        return;
      }
      if (nameMatches.length > 1) {
        mismatches.push({ source, reason: "ERP 거래처명 중복" });
        return;
      }
      matched.push({ source, vendor: nameMatches[0] });
    });

    if (mismatches.length) {
      const details = mismatches.slice(0, 8).map(({ source, reason }) => `${source.sourceSheet} ${source.sourceRow}행 · ${source.code} / ${source.name} · ${reason}`).join("\n");
      setVendorImportMessage(`이카운트 대조 중단 · 상호 불일치 ${mismatches.length}건`);
      alert(`이카운트 거래처 정보 반영을 중단했습니다.\n거래처명 또는 중복 상호를 ERP와 안전하게 연결하지 못한 행이 있습니다.\n수정된 내용은 저장하지 않았습니다.\n\n${details}${mismatches.length > 8 ? `\n외 ${mismatches.length - 8}건` : ""}`);
      return false;
    }

    const preferExistingWhenPresent = (existing: string | null | undefined, incoming: string) => cleanVendorImportText(existing) || incoming;
    const updates: Vendor[] = matched.map(({ source, vendor }) => ({
      id: vendor.id,
      code: vendor.code,
      name: vendor.name,
      owner: preferExistingWhenPresent(vendor.owner, source.owner),
      phone: preferExistingWhenPresent(vendor.phone, source.phone),
      mobile: preferExistingWhenPresent(vendor.mobile, source.mobile),
      address: preferExistingWhenPresent(vendor.address, source.address),
      address_detail: cleanVendorImportText(vendor.address_detail),
    }));

    const { error } = await service.upsertVendorDetails(updates);
    if (error) {
      setVendorImportMessage("이카운트 대조 완료 · 저장 실패");
      alert(`이카운트 추가정보 저장 실패: ${error.message}`);
      return false;
    }

    const updatedById = new Map(updates.map((vendor) => [vendor.id, vendor]));
    setVendors(currentVendors.map((vendor) => updatedById.get(vendor.id) || vendor));
    const codeMismatchCount = matched.filter(({ source, vendor }) => cleanVendorImportText(source.code) !== cleanVendorImportText(vendor.code)).length;
    const excludedCount = rows.length - selectedRows.length;
    setVendorImportMessage(`이카운트 ${matched.length}건 상호 일치 · 추가정보 반영 완료${codeMismatchCount ? ` · ERP 코드 유지 ${codeMismatchCount}건` : ""}${excludedCount ? ` · 선택 제외 ${excludedCount}건` : ""}`);
    return true;
  };

  const confirmEcountVendorImport = async () => {
    if (!vendorEcountReview) return;
    setVendorEcountImporting(true);
    try {
      const saved = await importEcountVendorDetails(vendorEcountReview.rows, vendorEcountSelections);
      if (saved) {
        setVendorEcountReview(null);
        setVendorEcountSelections({});
      }
    } finally {
      setVendorEcountImporting(false);
    }
  };

  const handleVendorExcelImport = async (file: File) => {
    try {
      const ecountRows = await readEcountVendorRows(file);
      if (ecountRows) {
        await importEcountVendorDetails(ecountRows);
        return;
      }
      await importVendors(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일 형식을 확인해 주세요.";
      alert(`거래처 엑셀 처리 실패: ${message || "파일 형식을 확인해 주세요."}`);
    }
  };

  const dismissEcountReview = () => {
    setVendorEcountReview(null);
    setVendorEcountSelections({});
  };

  const setEcountSelection = (name: string, rowKey: string, checked: boolean) => {
    setVendorEcountSelections((previous) => {
      const next = { ...previous };
      if (checked) next[name] = rowKey;
      else delete next[name];
      return next;
    });
  };

  const saveGroup = async () => {
    if (editingGroupId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    const nextGroupName = groupForm.name.trim();
    if (!nextGroupName) return;
    const previousGroup = editingGroupId ? groups.find((group) => group.id === editingGroupId) : undefined;
    const payload: WarehouseGroup = { id: editingGroupId || createId(), ...groupForm, name: nextGroupName };
    const result = await service.saveWarehouseGroup(payload, previousGroup, warehouses);
    if (result.stage === "group-upsert") return alert(`저장 실패: ${result.error.message}`);
    if (result.stage === "warehouse-rename") {
      if (result.rollbackError) {
        return alert(`세부창고 연결 변경 실패: ${result.error.message}\n대분류 이름 복구도 실패했습니다: ${result.rollbackError.message}`);
      }
      return alert(`세부창고 연결 변경에 실패하여 대분류 이름을 원래대로 복구했습니다: ${result.error.message}`);
    }

    if (result.updatedWarehouseIds.length) {
      const updatedIds = new Set(result.updatedWarehouseIds);
      setWarehouses((current) => current.map((warehouse) =>
        updatedIds.has(warehouse.id) ? { ...warehouse, group: payload.name } : warehouse,
      ));
      setWarehouseForm((current) =>
        current.group.trim() === previousGroup?.name.trim() ? { ...current, group: payload.name } : current,
      );
    }
    const next = editingGroupId ? groups.map((group) => (group.id === editingGroupId ? payload : group)) : [...groups, payload];
    setGroups(next);
    setGroupForm({ code: nextWarehouseCode(next), name: "" });
    setEditingGroupId("");
    showToast(editingGroupId ? "창고 대분류를 수정했습니다." : "창고 대분류를 등록했습니다.");
  };

  const saveWarehouse = async () => {
    if (editingWarehouseId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    if (!warehouseForm.group || !warehouseForm.name) return;
    const payload: Warehouse = { id: editingWarehouseId || createId(), ...warehouseForm };
    const { error } = await service.upsertWarehouse(payload);
    if (error) return alert(`창고 저장 실패: ${error.message}`);
    const next = editingWarehouseId
      ? warehouses.map((warehouse) => (warehouse.id === editingWarehouseId ? payload : warehouse))
      : [...warehouses, payload];
    setWarehouses(next);
    setWarehouseForm({ group: "", code: nextWarehouseCode(next), name: "" });
    setEditingWarehouseId("");
    showToast(editingWarehouseId ? "세부 창고를 수정했습니다." : "세부 창고를 등록했습니다.");
  };

  const deleteGroup = async (id: string, name: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const target = groups.find((group) => group.id === id);
    if (!target) return alert("삭제할 창고 대분류를 찾지 못했습니다.");
    const linkedWarehouses = warehouses.filter((warehouse) => warehouse.group === name);
    if (!confirm(`창고 대분류와 연결된 세부창고 ${linkedWarehouses.length}건을 휴지통으로 이동할까요?`)) return;

    const movedToTrash = await moveRecordsToTrash([
      {
        source_table: "warehouse_groups",
        module: "창고분류",
        record_id: target.id,
        title: target.name || "",
        detail: `연결 세부창고 ${linkedWarehouses.length}건`,
        data: target,
      },
      ...linkedWarehouses.map((warehouse) => ({
        source_table: "warehouses",
        module: "창고",
        record_id: warehouse.id,
        title: warehouse.name || "",
        detail: warehouse.group || "",
        data: warehouse,
      })),
    ]);
    if (!movedToTrash) return;

    const deleteWarehouseResult = await service.deleteWarehousesInGroup(name);
    if (deleteWarehouseResult.error) return alert(`세부창고 삭제 실패: ${deleteWarehouseResult.error.message}`);
    const deleteGroupResult = await service.deleteWarehouseGroup(id);
    if (deleteGroupResult.error) return alert(`대분류 삭제 실패: ${deleteGroupResult.error.message}`);

    const nextGroups = groups.filter((group) => group.id !== id);
    const nextWarehouses = warehouses.filter((warehouse) => warehouse.group !== name);
    setGroups(nextGroups);
    setWarehouses(nextWarehouses);
    setGroupForm({ code: nextWarehouseCode(nextGroups), name: "" });
    setWarehouseForm({ group: "", code: nextWarehouseCode(nextWarehouses), name: "" });
  };

  const deleteWarehouse = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const target = warehouses.find((warehouse) => warehouse.id === id);
    if (!target) return alert("삭제할 창고를 찾지 못했습니다.");
    if (!confirm("세부창고를 휴지통으로 이동할까요?")) return;
    const movedToTrash = await moveToTrash({
      source_table: "warehouses",
      module: "창고",
      record_id: id,
      title: target.name || "",
      detail: target.group || "",
      data: target,
    });
    if (!movedToTrash) return;
    const { error } = await service.deleteWarehouse(id);
    if (error) return alert(`창고 삭제 실패: ${error.message}`);
    const next = warehouses.filter((warehouse) => warehouse.id !== id);
    setWarehouses(next);
    setWarehouseForm({ group: "", code: nextWarehouseCode(next), name: "" });
  };

  const saveItem = async () => {
    if (editingItemId && !canEditDeleteRecords) return alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return alert("등록 권한이 없습니다.");
    const code = String(itemForm.code || "").trim();
    const name = String(itemForm.name || "").trim();
    if (!code) return alert("품목코드를 입력하세요.");
    if (!name) return alert("품목명을 입력하세요.");

    const latestResult = await service.fetchItems();
    if (latestResult.error) return alert(`품목 최신자료 불러오기 실패: ${latestResult.error.message}`);
    const latestItems = normalizeMasterItems((latestResult.data || []) as unknown as Array<Record<string, unknown>>);
    const duplicateCode = latestItems.find((item) => item.code === code && item.id !== editingItemId);
    if (duplicateCode) return alert("이미 사용 중인 품목코드입니다.");

    const existing = editingItemId ? latestItems.find((item) => item.id === editingItemId) : undefined;
    const payload: MasterItem = { id: existing?.id || createId(), ...itemForm, code, name, price: Number(itemForm.price || 0) };
    const { error } = await service.upsertItem(payload);
    if (error) return alert(`저장 실패: ${error.message}`);
    const next = existing ? latestItems.map((item) => (item.id === existing.id ? payload : item)) : [...latestItems, payload];
    setItems(next);
    setItemForm({ code: nextItemCode(next), name: "", spec: "", unit: "", price: "" });
    setEditingItemId("");
    showToast(existing ? "품목 정보를 수정했습니다." : "품목을 등록했습니다.");
  };

  const importItems = async (file: File) => {
    const rows = await readMasterDataRows(file);
    const existingResult = await service.fetchItems();
    if (existingResult.error) return alert(`기존 품목 불러오기 실패: ${existingResult.error.message}`);
    const existingItems = normalizeMasterItems((existingResult.data || []) as unknown as Array<Record<string, unknown>>);
    const imported = mapItemImportRows(rows, existingItems, createId);
    const merged = mergeItemImportRows(existingItems, imported);
    const upsertError = await service.upsertImportedItems(merged);
    if (upsertError) return alert(`품목 업로드 실패: ${upsertError.message}`);

    const reloadResult = await service.fetchItems();
    if (reloadResult.error) return alert(`품목 다시 불러오기 실패: ${reloadResult.error.message}`);
    const nextItems = normalizeMasterItems((reloadResult.data || []) as unknown as Array<Record<string, unknown>>);
    setItems(nextItems);
    setItemImportMessage(`${imported.length}건 업로드 / 현재 ${nextItems.length}건 표시`);
    setItemForm({ code: nextItemCode(nextItems), name: "", spec: "", unit: "", price: "" });
  };

  const openNewItemModal = (rowIndex: number) => {
    setNewItemForm({ code: nextItemCode(items), name: "", spec: "", unit: "", price: "" });
    setNewItemModal({ open: true, rowIndex });
  };

  const closeNewItemModal = () => {
    setNewItemModal({ open: false, rowIndex: null });
    setNewItemForm({ code: nextItemCode(items), name: "", spec: "", unit: "", price: "" });
  };

  const saveNewItemFromModal = async () => {
    const code = newItemForm.code.trim();
    if (!code) return alert("품목코드를 입력하세요.");
    if (items.some((item) => String(item.code || "").trim().toLowerCase() === code.toLowerCase())) {
      return alert("이미 등록된 품목코드입니다. 다른 코드를 입력하세요.");
    }
    const name = newItemForm.name.trim();
    if (!name) return alert("품목명을 입력하세요.");
    const spec = newItemForm.spec.trim();
    const unit = newItemForm.unit.trim();
    const price = Number(String(newItemForm.price || "0").replace(/,/g, "")) || 0;
    const newItem: MasterItem = { id: createId(), code, name, spec, unit, price };
    const { error } = await service.insertItem(newItem);
    if (error) return alert(`신규 저장 실패: ${error.message}`);
    setItems((previous) => [...previous, newItem]);
    if (newItemModal.rowIndex !== null) onPurchaseItemCreated(newItemModal.rowIndex, newItem);
    showToast("신규 품목을 등록하고 입력란에 반영했습니다.");
    closeNewItemModal();
  };

  const editVendor = (vendor: Vendor) => {
    setEditingVendorId(vendor.id);
    setVendorForm({
      code: vendor.code || "",
      name: vendor.name || "",
      owner: vendor.owner || "",
      phone: vendor.phone || "",
      mobile: vendor.mobile || "",
      address: vendor.address || "",
      address_detail: vendor.address_detail || "",
    });
  };

  const editGroup = (group: WarehouseGroup) => {
    setEditingGroupId(group.id);
    setGroupForm({ code: group.code || "", name: group.name || "" });
  };

  const editWarehouse = (warehouse: Warehouse) => {
    setEditingWarehouseId(warehouse.id);
    setWarehouseForm({ code: warehouse.code || "", group: warehouse.group || "", name: warehouse.name || "" });
  };

  const editItem = (item: MasterItem) => {
    setEditingItemId(item.id);
    setItemForm({ code: item.code || "", name: item.name || "", spec: item.spec || "", unit: item.unit || "", price: String(item.price || "") });
  };

  const deleteVendor = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const target = vendors.find((vendor) => vendor.id === id);
    if (!target) return alert("삭제할 거래처를 찾지 못했습니다.");
    if (!confirm("거래처를 휴지통으로 이동할까요?")) return;
    const movedToTrash = await moveToTrash({
      source_table: "vendors",
      module: "거래처",
      record_id: id,
      title: target.name || "",
      detail: target.code || "",
      data: target,
    });
    if (!movedToTrash) return;
    const { error } = await service.deleteVendor(id);
    if (error) return alert(`거래처 삭제 실패: ${error.message}`);
    setVendors((previous) => previous.filter((vendor) => vendor.id !== id));
  };

  const clearVendors = async () => {
    if (!isAdmin) return alert("관리자만 전체삭제할 수 있습니다.");
    if (!vendors.length) return alert("삭제할 거래처가 없습니다.");
    if (!confirm(`거래처 ${vendors.length}건을 모두 휴지통으로 이동할까요?`)) return;
    const movedToTrash = await moveRecordsToTrash(vendors.map((vendor) => ({
      source_table: "vendors",
      module: "거래처",
      record_id: vendor.id,
      title: vendor.name || "",
      detail: vendor.code || "",
      data: vendor,
    })));
    if (!movedToTrash) return;
    const { error } = await service.deleteAllVendors();
    if (error) return alert(`거래처 전체삭제 실패: ${error.message}`);
    setVendors([]);
    setVendorImportMessage("거래처 전체 삭제 완료");
    setVendorForm(emptyVendorForm());
  };

  const deleteItem = async (id: string) => {
    if (!canEditDeleteRecords) return alert("삭제는 관리자만 가능합니다.");
    const target = items.find((item) => item.id === id);
    if (!target) return alert("삭제할 품목을 찾지 못했습니다.");
    if (!confirm("품목을 휴지통으로 이동할까요?")) return;
    const movedToTrash = await moveToTrash({
      source_table: "items",
      module: "품목",
      record_id: id,
      title: target.name || "",
      detail: `${target.code || "-"} · ${target.spec || "규격 없음"}`,
      data: target,
    });
    if (!movedToTrash) return;
    const { error } = await service.deleteItem(id);
    if (error) return alert(`품목 삭제 실패: ${error.message}`);
    setItems((previous) => previous.filter((item) => item.id !== id));
  };

  const clearItems = async () => {
    if (!isAdmin) return alert("관리자만 전체삭제할 수 있습니다.");
    if (!items.length) return alert("삭제할 품목이 없습니다.");
    if (!confirm(`품목 ${items.length}건을 모두 휴지통으로 이동할까요?`)) return;
    const movedToTrash = await moveRecordsToTrash(items.map((item) => ({
      source_table: "items",
      module: "품목",
      record_id: item.id,
      title: item.name || "",
      detail: `${item.code || "-"} · ${item.spec || "규격 없음"}`,
      data: item,
    })));
    if (!movedToTrash) return;
    const { error } = await service.deleteAllItems();
    if (error) return alert(`품목 전체삭제 실패: ${error.message}`);
    setItems([]);
    setItemSearch("");
    setItemImportMessage("품목 전체 삭제 완료");
    setItemForm({ code: "0001", name: "", spec: "", unit: "", price: "" });
    setEditingItemId("");
  };

  return {
    data: { vendors, groups, warehouses, items },
    fetchMasterData: () => service.fetchMasterData(),
    applySnapshot,
    vendorScreen: {
      vendors,
      form: vendorForm,
      setForm: setVendorForm,
      importMessage: vendorImportMessage,
      editingId: editingVendorId,
      onSave: saveVendor,
      onImport: handleVendorExcelImport,
      onExport: downloadVendorsExcel,
      onEdit: editVendor,
      onDelete: deleteVendor,
      onClear: clearVendors,
      onOpenAddressSearch: openVendorAddressSearch,
      addressDetailRef: vendorAddressDetailRef,
    },
    warehouseScreen: {
      groups,
      warehouses,
      groupForm,
      setGroupForm,
      warehouseForm,
      setWarehouseForm,
      editingGroupId,
      editingWarehouseId,
      onSaveGroup: saveGroup,
      onSaveWarehouse: saveWarehouse,
      onEditGroup: editGroup,
      onEditWarehouse: editWarehouse,
      onDeleteGroup: deleteGroup,
      onDeleteWarehouse: deleteWarehouse,
    },
    itemScreen: {
      items,
      form: itemForm,
      setForm: setItemForm,
      importMessage: itemImportMessage,
      editingId: editingItemId,
      search: itemSearch,
      setSearch: setItemSearch,
      filteredItems,
      onSave: saveItem,
      onImport: importItems,
      onEdit: editItem,
      onDelete: deleteItem,
      onClear: clearItems,
      onOpenNewItem: openNewItemModal,
    },
    dialogs: {
      addressSearch: {
        open: vendorAddressSearchOpen,
        setOpen: setVendorAddressSearchOpen,
        ready: vendorAddressSearchReady,
        error: vendorAddressSearchError,
        containerRef: vendorAddressSearchContainerRef,
      },
      ecountReview: {
        value: vendorEcountReview,
        selections: vendorEcountSelections,
        importing: vendorEcountImporting,
        groupRowsByName: groupEcountVendorRowsByName,
        getRowKey: getEcountVendorRowKey,
        onConfirm: confirmEcountVendorImport,
        onDismiss: dismissEcountReview,
        onSelect: setEcountSelection,
      },
      newItem: {
        state: newItemModal,
        form: newItemForm,
        setForm: setNewItemForm,
        onSave: saveNewItemFromModal,
        onClose: closeNewItemModal,
      },
    },
  };
};

export type MasterDataModule = ReturnType<typeof useMasterDataModule>;
