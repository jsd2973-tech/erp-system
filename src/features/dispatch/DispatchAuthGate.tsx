import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../supabaseClient";
import DriverMobileApp from "./DriverMobileApp";
import type { DispatchDriver } from "./dispatchTypes";

const ERP_ADMIN_EMAILS = new Set(["jsd2973@gmail.com"]);

const toDriver = (row: Record<string, unknown>): DispatchDriver => ({
  id: String(row.id),
  name: String(row.name || ""),
  phone: String(row.phone || ""),
  assigned_vehicle_id: row.assigned_vehicle_id ? String(row.assigned_vehicle_id) : null,
  auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null,
  active: row.active !== false,
  memo: String(row.memo || ""),
  created_at: row.created_at ? String(row.created_at) : undefined,
  updated_at: row.updated_at ? String(row.updated_at) : undefined,
});

export default function DispatchAuthGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [driver, setDriver] = useState<DispatchDriver | null>(null);

  const resolveSession = useCallback(async (session: Session | null) => {
    if (!session || ERP_ADMIN_EMAILS.has(String(session.user.email || "").toLowerCase())) {
      setDriver(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    const { data, error } = await supabase
      .from("dispatch_drivers")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .eq("active", true)
      .maybeSingle();

    if (error) console.error("기사 계정 확인 실패", error);
    setDriver(!error && data ? toDriver(data) : null);
    setChecking(false);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void resolveSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      window.setTimeout(() => { if (active) void resolveSession(session); }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [resolveSession]);

  if (checking) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f2f5f9", color: "#526174", fontWeight: 800 }}>로그인 권한 확인 중...</div>;
  if (driver) return <DriverMobileApp supabase={supabase} driver={driver} onLogout={() => { void supabase.auth.signOut(); }} />;
  return children;
}
