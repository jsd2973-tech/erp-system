export type MaintItem = {
  id: string;
  item: string;
  spec: string;
  qty: string | number;
  price: string | number;
  supply: number;
  vat: number;
  total: number;
};

export type Maint = {
  id: string;
  managementNo?: string;
  date: string;
  warehouse: string;
  manager: string;
  title: string;
  detail: string;
  cost: number | string;
  image_url?: string;
  image_urls?: string[];
  items?: MaintItem[];
  supplyTotal?: number;
  vatTotal?: number;
  total?: number;
};

export type MaintenanceForm = {
  date: string;
  warehouse: string;
  manager: string;
  title: string;
  detail: string;
  cost: string;
  image_urls: string[];
};

export type MaintenanceSearch = {
  from: string;
  to: string;
  warehouse: string;
  keyword: string;
};
