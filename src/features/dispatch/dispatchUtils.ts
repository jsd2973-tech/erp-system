import type { DispatchOrderForm, DispatchStatus } from "./dispatchTypes";

export const dispatchToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export const createDispatchId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const normalizeVehicleNumber = (value: string) => String(value || "").replace(/\s+/g, "").trim();

export const toPositiveNumber = (value: string | number) => {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export const calculateEstimatedTrips = (totalVolume: string | number, volumePerTrip: string | number) => {
  const total = toPositiveNumber(totalVolume);
  const perTrip = toPositiveNumber(volumePerTrip);
  return total && perTrip ? Math.ceil(total / perTrip) : 0;
};

export const emptyDispatchOrderForm = (): DispatchOrderForm => ({
  id: "",
  dispatch_date: dispatchToday(),
  vendor_id: "",
  vendor_name: "",
  save_vendor: false,
  loading_location: "",
  save_loading_location: false,
  unloading_location: "",
  save_unloading_location: false,
  item_id: "",
  item_name: "",
  save_item: false,
  total_volume: "",
  volume_per_trip: "17",
  status: "대기",
  memo: "",
  vehicle_ids: [],
});

export const dispatchStatusClass = (status: DispatchStatus) => {
  if (status === "완료") return "done";
  if (status === "진행중") return "active";
  if (status === "취소") return "cancelled";
  return "waiting";
};

export const formatVolume = (value: number) => `${Number(value || 0).toLocaleString("ko-KR")}루베`;
