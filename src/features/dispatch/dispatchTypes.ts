export const DISPATCH_VIEWS = [
  "dispatch_register",
  "dispatch_list",
  "dispatch_vehicles",
  "dispatch_drivers",
] as const;

export type DispatchView = (typeof DISPATCH_VIEWS)[number];

export const DISPATCH_STATUSES = ["대기", "진행중", "완료", "취소"] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export type DispatchReferenceOption = {
  id: string;
  name: string;
  code?: string;
  spec?: string;
};

export type DispatchVehicle = {
  id: string;
  vehicle_number: string;
  active: boolean;
  memo: string;
  created_at?: string;
  updated_at?: string;
};

export type DispatchDriver = {
  id: string;
  name: string;
  phone: string;
  assigned_vehicle_id: string | null;
  active: boolean;
  memo: string;
  created_at?: string;
  updated_at?: string;
};

export type DispatchOrder = {
  id: string;
  dispatch_date: string;
  vendor_id: string | null;
  vendor_name: string;
  loading_location: string;
  unloading_location: string;
  item_id: string | null;
  item_name: string;
  total_volume: number;
  volume_per_trip: number;
  estimated_trip_count: number;
  status: DispatchStatus;
  memo: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DispatchOrderVehicle = {
  id: string;
  order_id: string;
  vehicle_id: string;
  created_at?: string;
};

export type DispatchOrderWithVehicles = DispatchOrder & {
  vehicle_ids: string[];
};

export type DispatchOrderForm = {
  id: string;
  dispatch_date: string;
  vendor_id: string;
  loading_location: string;
  unloading_location: string;
  item_id: string;
  total_volume: string;
  volume_per_trip: string;
  status: DispatchStatus;
  memo: string;
  vehicle_ids: string[];
};

export type DispatchFilters = {
  from: string;
  to: string;
  vendor: string;
  item: string;
  status: "" | DispatchStatus;
};
