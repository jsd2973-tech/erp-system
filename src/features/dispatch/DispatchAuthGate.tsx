import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../supabaseClient";
import DriverMobileApp from "./DriverMobileApp";
import type { DispatchDriver } from "./dispatchTypes";

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
  const resolvedUserIdRef = useRef<string | null>(null);
  const resolveRequestRef = useRef(0);

  const resolveSession = useCallback(async (session: Session | null, showChecking = true) => {
    const requestId = ++resolveRequestRef.current;
    resolvedUserIdRef.current = session?.user.id || null;

    if (!session) {
      setDriver(null);
      setChecking(false);
      return;
    }

    if (showChecking) setChecking(true);
    const userEmail = String(session.user.email || "").trim().toLowerCase();
    const [adminResult, permissionResult] = await Promise.all([
      supabase.rpc("is_dispatch_admin"),
      userEmail
        ? supabase.from("user_permissions").select("id").eq("email", userEmail).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (requestId !== resolveRequestRef.current) return;

    if (adminResult.error || permissionResult.error) {
      console.error("ERP 계정 권한 확인 실패", adminResult.error || permissionResult.error);
      setDriver(null);
      setChecking(false);
      return;
    }

    if (adminResult.data === true || permissionResult.data) {
      setDriver(null);
      setChecking(false);
      return;
    }

    const { data, error } = await supabase
      .from("dispatch_drivers")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .eq("active", true)
      .maybeSingle();

    if (requestId !== resolveRequestRef.current) return;
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
      const nextUserId = session?.user.id || null;

      // Supabase may emit SIGNED_IN again when an already authenticated tab regains
      // focus. Rechecking through the full-screen gate would unmount every ERP form
      // and discard unsaved React state, so only resolve when the user actually changed.
      if (event === "SIGNED_IN" && nextUserId === resolvedUserIdRef.current) return;

      const userChanged = nextUserId !== resolvedUserIdRef.current;
      window.setTimeout(() => {
        if (active) void resolveSession(session, userChanged);
      }, 0);
    });

    return () => {
      active = false;
      resolveRequestRef.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [resolveSession]);

  if (checking) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f2f5f9", color: "#526174", fontWeight: 800 }}>로그인 권한 확인 중...</div>;
  if (driver) return <DriverMobileApp supabase={supabase} driver={driver} onLogout={() => { void supabase.auth.signOut(); }} />;
  return children;
}
