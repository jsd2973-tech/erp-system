export type CardUse = {
  id: string;
  date: string;
  user_name: string;
  place: string;
  amount: number | string;
  memo?: string;
  image_url?: string;
  image_urls?: string[];
  created_at?: string;
};

export type CardOcrState = "idle" | "analyzing" | "success" | "error";

export type CardForm = {
  date: string;
  user_name: string;
  place: string;
  amount: string;
  memo: string;
  image_url: string;
  image_urls: string[];
};

export type CardSearch = {
  from: string;
  to: string;
  user_name: string;
  place: string;
};

export type CardOcrTouchedFields = {
  date: boolean;
  place: boolean;
  amount: boolean;
};
