export type Vendor = {
  id: string;
  code: string;
  name: string;
  owner?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  address_detail?: string;
};

export type WarehouseGroup = { id: string; code: string; name: string };

export type Warehouse = { id: string; code: string; group: string; name: string };

export type MasterItem = {
  id: string;
  code: string;
  name: string;
  spec?: string;
  unit?: string;
  price?: number;
};

export type VendorForm = Omit<Vendor, "id">;
export type WarehouseGroupForm = Omit<WarehouseGroup, "id">;
export type WarehouseForm = Omit<Warehouse, "id">;
export type ItemForm = {
  code: string;
  name: string;
  spec: string;
  unit: string;
  price: string;
};

export type EcountVendorImportRow = {
  sourceSheet: string;
  sourceRow: number;
  code: string;
  name: string;
  owner: string;
  phone: string;
  mobile: string;
  address: string;
};

export type MasterDataSnapshot = {
  vendors: Vendor[];
  groups: WarehouseGroup[];
  warehouses: Warehouse[];
  items: MasterItem[];
};

export type TrashInput = {
  source_table: string;
  module: string;
  record_id: string;
  title?: string;
  detail?: string;
  data: unknown;
};
