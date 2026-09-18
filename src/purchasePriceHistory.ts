export type PurchasePriceHistoryInputRow = {
  id?: string;
  item?: string;
  spec?: string;
  qty?: string | number | null;
  price?: string | number | null;
  supply?: string | number | null;
  total?: string | number | null;
};

export type PurchasePriceHistoryInput = {
  id: string;
  date?: string | null;
  created_at?: string | null;
  vendor?: string | null;
  warehouse?: string | null;
  rows?: PurchasePriceHistoryInputRow[] | null;
};

export type PurchasePriceHistoryEntry = {
  id: string;
  purchaseId: string;
  date: string;
  vendor: string;
  warehouse: string;
  item: string;
  spec: string;
  qty: number;
  price: number;
  supply: number;
  total: number;
  priceDerivedFromSupply: boolean;
  sortKey: string;
};

export type PurchaseVendorPriceStat = {
  vendorKey: string;
  vendor: string;
  count: number;
  latest: PurchasePriceHistoryEntry;
  weightedAvgPrice: number;
};

export type PurchasePriceHistory = {
  key: string;
  item: string;
  spec: string;
  entries: PurchasePriceHistoryEntry[];
  latest?: PurchasePriceHistoryEntry;
  previous?: PurchasePriceHistoryEntry;
  deltaAmount: number | null;
  deltaPercent: number | null;
  minPrice: number;
  maxPrice: number;
  weightedAvgPrice: number | null;
  vendorStats: PurchaseVendorPriceStat[];
};

export type PurchasePriceHistoryOptions = {
  excludePurchaseIds?: string[];
};

const toNumber = (value: unknown) => {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  const number = Number(cleaned || 0);
  return Number.isFinite(number) ? number : 0;
};

export const normalizePurchasePriceText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR");

export const getPurchasePriceHistoryKey = (item: unknown, spec: unknown = "") => {
  const itemKey = normalizePurchasePriceText(item);
  const specKey = normalizePurchasePriceText(spec);
  return `${itemKey}\u001f${specKey}`;
};

const compareLatestFirst = (a: PurchasePriceHistoryEntry, b: PurchasePriceHistoryEntry) => {
  const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
  if (dateCompare !== 0) return dateCompare;
  return String(b.sortKey || "").localeCompare(String(a.sortKey || ""));
};

export const getPurchaseEffectiveUnitPrice = (row: PurchasePriceHistoryInputRow) => {
  const price = toNumber(row.price);
  if (price > 0) return { price, priceDerivedFromSupply: false };

  const qty = toNumber(row.qty);
  const supply = toNumber(row.supply);
  if (qty > 0 && supply > 0) {
    return { price: supply / qty, priceDerivedFromSupply: true };
  }

  return { price: 0, priceDerivedFromSupply: false };
};

export const buildPurchasePriceHistory = (
  purchases: PurchasePriceHistoryInput[],
  options: PurchasePriceHistoryOptions = {},
) => {
  const excludedIds = new Set((options.excludePurchaseIds || []).map(String));
  const grouped = new Map<string, PurchasePriceHistoryEntry[]>();

  purchases.forEach((purchase) => {
    const purchaseId = String(purchase.id || "");
    if (!purchaseId || excludedIds.has(purchaseId)) return;

    const purchaseDate = String(purchase.date || "");
    const sortKey = String(purchase.created_at || purchase.id || "");
    (purchase.rows || []).forEach((row, rowIndex) => {
      const item = String(row.item || "").trim();
      const spec = String(row.spec || "").trim();
      if (!item) return;

      const qty = toNumber(row.qty);
      const effectivePrice = getPurchaseEffectiveUnitPrice(row);
      if (qty <= 0 || effectivePrice.price <= 0) return;

      const entry: PurchasePriceHistoryEntry = {
        id: String(row.id || `${purchaseId}-${rowIndex}`),
        purchaseId,
        date: purchaseDate,
        vendor: String(purchase.vendor || "").trim(),
        warehouse: String(purchase.warehouse || "").trim(),
        item,
        spec,
        qty,
        price: effectivePrice.price,
        supply: toNumber(row.supply),
        total: toNumber(row.total),
        priceDerivedFromSupply: effectivePrice.priceDerivedFromSupply,
        sortKey,
      };

      const key = getPurchasePriceHistoryKey(item, spec);
      grouped.set(key, [...(grouped.get(key) || []), entry]);
    });
  });

  const result = new Map<string, PurchasePriceHistory>();
  grouped.forEach((unsortedEntries, key) => {
    const entries = [...unsortedEntries].sort(compareLatestFirst);
    const latest = entries[0];
    const previous = entries[1];
    const deltaAmount = latest && previous ? latest.price - previous.price : null;
    const deltaPercent = latest && previous && previous.price > 0
      ? (deltaAmount! / previous.price) * 100
      : null;
    const totalQty = entries.reduce((sum, entry) => sum + entry.qty, 0);
    const weightedAvgPrice = totalQty > 0
      ? entries.reduce((sum, entry) => sum + entry.price * entry.qty, 0) / totalQty
      : null;

    const prices = entries.map((entry) => entry.price);
    const vendorGroups = new Map<string, PurchasePriceHistoryEntry[]>();
    entries.forEach((entry) => {
      const vendorKey = normalizePurchasePriceText(entry.vendor) || "__empty__";
      vendorGroups.set(vendorKey, [...(vendorGroups.get(vendorKey) || []), entry]);
    });

    const vendorStats = Array.from(vendorGroups.entries())
      .map(([vendorKey, vendorEntries]) => {
        const vendorQty = vendorEntries.reduce((sum, entry) => sum + entry.qty, 0);
        return {
          vendorKey,
          vendor: vendorEntries[0]?.vendor || "거래처 미입력",
          count: vendorEntries.length,
          latest: vendorEntries[0],
          weightedAvgPrice: vendorQty > 0
            ? vendorEntries.reduce((sum, entry) => sum + entry.price * entry.qty, 0) / vendorQty
            : vendorEntries[0]?.price || 0,
        };
      })
      .sort((a, b) => {
        const priceCompare = a.latest.price - b.latest.price;
        if (priceCompare !== 0) return priceCompare;
        return compareLatestFirst(a.latest, b.latest);
      });

    result.set(key, {
      key,
      item: latest?.item || entries[0]?.item || "",
      spec: latest?.spec || entries[0]?.spec || "",
      entries,
      latest,
      previous,
      deltaAmount,
      deltaPercent,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      weightedAvgPrice,
      vendorStats,
    });
  });

  return result;
};

export const getPurchaseVendorPriceStat = (
  history: PurchasePriceHistory | undefined,
  vendor: unknown,
) => {
  const vendorKey = normalizePurchasePriceText(vendor);
  if (!vendorKey) return undefined;
  return history?.vendorStats.find((stat) => stat.vendorKey === vendorKey);
};

export const comparePurchaseUnitPrice = (currentPrice: unknown, recentPrice: unknown) => {
  const current = toNumber(currentPrice);
  const recent = toNumber(recentPrice);
  if (current <= 0 || recent <= 0) return null;

  const deltaAmount = current - recent;
  return {
    current,
    recent,
    deltaAmount,
    deltaPercent: (deltaAmount / recent) * 100,
  };
};
