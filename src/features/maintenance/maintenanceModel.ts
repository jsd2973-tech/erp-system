import type { Maint, MaintItem, MaintenanceSearch } from "./maintenanceTypes";

export type MaintenanceTotals = {
  validItems: MaintItem[];
  supplyTotal: number;
  vatTotal: number;
  total: number;
};

export type MaintenanceItemField = keyof MaintItem;

export type MaintenancePurchaseLinkValidation =
  | { valid: true }
  | { valid: false; reason: "non-positive-quantity" }
  | { valid: false; reason: "maintenance-quantity-exceeded"; maintenanceQty: number }
  | { valid: false; reason: "purchase-remaining-exceeded"; remainingQty: number }
  | { valid: false; reason: "maintenance-row-quantity-exceeded"; linkedQty: number; maintenanceQty: number };

export const createEmptyMaintItem = (id: string): MaintItem => ({
  id,
  item: "",
  spec: "",
  qty: "",
  price: "",
  supply: 0,
  vat: 0,
  total: 0,
});

export const updateMaintenanceItem = (
  currentItems: MaintItem[],
  index: number,
  key: MaintenanceItemField,
  value: string | number,
  selectedItem?: { spec?: string; price?: number },
): MaintItem[] => {
  const next = [...currentItems];
  const current = next[index];
  if (!current) return next;
  next[index] = { ...current, [key]: value };

  if (key === "item" && selectedItem) {
    next[index].spec = selectedItem.spec || "";
    next[index].price = selectedItem.price || 0;
  }

  if (["item", "qty", "price"].includes(key)) {
    const qty = Number(next[index].qty || 0);
    const price = Number(next[index].price || 0);
    next[index].supply = qty * price;
    next[index].vat = Math.round(next[index].supply * 0.1);
    next[index].total = next[index].supply + next[index].vat;
  }

  if (key === "supply") {
    next[index].supply = Number(value || 0);
    next[index].vat = Math.round(next[index].supply * 0.1);
    next[index].total = next[index].supply + next[index].vat;
  }

  if (key === "vat") {
    next[index].vat = Number(value || 0);
    next[index].total = Number(next[index].supply || 0) + next[index].vat;
  }

  return next;
};

export const sumMaintenanceRowTotals = (items: MaintItem[]) =>
  items.reduce((sum, row) => sum + Number(row.total || 0), 0);

export const calculateMaintenanceTotals = (items: MaintItem[]): MaintenanceTotals => {
  const validItems = items.filter((row) => row.item && Number(row.qty || 0) > 0);
  return {
    validItems,
    supplyTotal: validItems.reduce((sum, row) => sum + Number(row.supply || 0), 0),
    vatTotal: validItems.reduce((sum, row) => sum + Number(row.vat || 0), 0),
    total: validItems.reduce((sum, row) => sum + Number(row.total || 0), 0),
  };
};

export const calculateLinkedMaintenanceItem = (item: MaintItem, unitPrice: number): MaintItem => {
  const supply = Number(item.qty || 0) * unitPrice;
  const vat = Math.round(supply * 0.1);
  return { ...item, price: unitPrice, supply, vat, total: supply + vat };
};

export const validateMaintenancePurchaseLinkQuantity = ({
  usedQty,
  maintenanceQty,
  remainingQty,
  linkedQtyForMaintenanceRow,
}: {
  usedQty: number;
  maintenanceQty: number;
  remainingQty: number;
  linkedQtyForMaintenanceRow: number;
}): MaintenancePurchaseLinkValidation => {
  if (usedQty <= 0) return { valid: false, reason: "non-positive-quantity" };
  if (usedQty > maintenanceQty) {
    return { valid: false, reason: "maintenance-quantity-exceeded", maintenanceQty };
  }
  if (usedQty > remainingQty) {
    return { valid: false, reason: "purchase-remaining-exceeded", remainingQty };
  }
  if (linkedQtyForMaintenanceRow + usedQty > maintenanceQty) {
    return {
      valid: false,
      reason: "maintenance-row-quantity-exceeded",
      linkedQty: linkedQtyForMaintenanceRow,
      maintenanceQty,
    };
  }
  return { valid: true };
};

export const getMaintenanceCost = (maintenance: Maint, field: "supplyTotal" | "vatTotal" | "total") => {
  const itemField = field === "supplyTotal" ? "supply" : field === "vatTotal" ? "vat" : "total";
  const fallback = (maintenance.items || []).reduce((sum, row) => sum + Number(row[itemField] || 0), 0);
  return Number(maintenance[field] || (field === "total" ? maintenance.cost : 0) || fallback);
};

export const filterAndSortMaintenances = (maints: Maint[], search: MaintenanceSearch): Maint[] =>
  maints
    .filter((m) =>
      (!search.from || (m.date || "") >= search.from) &&
      (!search.to || (m.date || "") <= search.to) &&
      (!search.warehouse || m.warehouse.includes(search.warehouse)) &&
      (!search.keyword || `${m.title} ${m.detail} ${m.manager}`.includes(search.keyword)),
    )
    .sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

export const buildMaintenanceNumberMap = (maints: Maint[]): Map<string, string> => {
  const orderedByOldest = [...maints].sort((a, b) => {
    const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCompare !== 0) return dateCompare;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
  const running = new Map<string, number>();
  const map = new Map<string, string>();

  orderedByOldest.forEach((maintenance) => {
    const date = maintenance.date || "날짜없음";
    const nextNo = (running.get(date) || 0) + 1;
    running.set(date, nextNo);
    map.set(maintenance.id, `${date}-${String(nextNo).padStart(2, "0")}`);
  });

  return map;
};
