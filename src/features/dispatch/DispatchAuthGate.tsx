import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../supabaseClient";
import PushSettings from "../push/PushSettings";
import DriverMobileApp from "./DriverMobileApp";
import type { DispatchDriver } from "./dispatchTypes";
import { loadActiveDispatchDriver, loadDispatchAccountAccess } from "./dispatchAuthService";

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
    const access = await loadDispatchAccountAccess(supabase, userEmail);

    if (requestId !== resolveRequestRef.current) return;

    if (access.error) {
      console.error("ERP 계정 권한 확인 실패", access.error);
      setDriver(null);
      setChecking(false);
      return;
    }

    if (access.isDispatchAdmin || access.hasErpPermission) {
      setDriver(null);
      setChecking(false);
      return;
    }

    const { driver: activeDriver, error } = await loadActiveDispatchDriver(supabase, session.user.id);

    if (requestId !== resolveRequestRef.current) return;
    if (error) console.error("기사 계정 확인 실패", error);
    setDriver(activeDriver);
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
  if (driver) return <>
    <PushSettings key={resolvedUserIdRef.current || driver.id} />
    <DriverMobileApp supabase={supabase} driver={driver} onLogout={() => { void supabase.auth.signOut(); }} />
    <button
      type="button"
      className="driver-push-settings-fab"
      onClick={() => window.dispatchEvent(new Event("ERP_OPEN_NOTIFICATIONS"))}
      aria-label="운행관리 알림 설정 열기"
    >
      🔔 알림 설정
    </button>
    <style>{`.driver-push-settings-fab{position:fixed;z-index:45;right:14px;bottom:calc(82px + env(safe-area-inset-bottom));min-height:44px;border:1px solid #bfd5ea;border-radius:999px;padding:0 14px;background:#fff;color:#155faa;font:800 13px/1 inherit;box-shadow:0 8px 24px rgba(18,71,123,.18);cursor:pointer}.driver-push-settings-fab:focus-visible{outline:3px solid #2468b4;outline-offset:3px}@media(min-width:761px){.driver-push-settings-fab{right:calc((100vw - 620px)/2 + 14px)}}`}</style>
  </>;
  return children;
}
