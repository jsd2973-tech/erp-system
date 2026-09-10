import { createClient } from "@supabase/supabase-js";

const PROD_SUPABASE_URL = "https://jqdvxmatbmmeubtoogvl.supabase.co";
const PROD_SUPABASE_KEY = "sb_publishable_83Pb_nHMoZCduendoRwE5w_uJqiuvH7";
const testMode = import.meta.env.VITE_SUPABASE_TEST_MODE === "1";
const envUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const envKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

const normalizeSupabaseUrl = (value: string) => value.replace(/\/+$/, "").toLowerCase();

if (testMode && (!envUrl || !envKey)) {
  throw new Error("테스트 Supabase 모드에는 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 필요합니다.");
}

if (testMode && normalizeSupabaseUrl(envUrl) === normalizeSupabaseUrl(PROD_SUPABASE_URL)) {
  throw new Error("테스트 Supabase 모드에서는 운영 Supabase URL을 사용할 수 없습니다.");
}

const supabaseUrl = testMode ? envUrl : PROD_SUPABASE_URL;
const supabaseKey = testMode ? envKey : PROD_SUPABASE_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  }
);

export const isSupabaseTestMode = testMode;
