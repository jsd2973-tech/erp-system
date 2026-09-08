import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://jqdvxmatbmmeubtoogvl.supabase.co",
  "sb_publishable_83Pb_nHMoZCduendoRwE5w_uJqiuvH7",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  }
);
