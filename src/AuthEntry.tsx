import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { toLoginEmail } from "./authLogin";

const AUTH_NAME_KEY = "erp_login_name_v2";

export default function AuthEntry({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [loginName, setLoginName] = useState(() => localStorage.getItem(AUTH_NAME_KEY) || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setChecking(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async () => {
    const name = loginName.trim();
    if (!name) return setError("이름 또는 아이디를 입력하세요.");
    if (!password) return setError("비밀번호를 입력하세요.");

    setSubmitting(true);
    setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: toLoginEmail(name),
      password,
    });
    setSubmitting(false);

    if (loginError) {
      setError("로그인 실패: 이름(아이디) 또는 비밀번호를 확인하세요.");
      return;
    }

    localStorage.setItem(AUTH_NAME_KEY, name);
    setPassword("");
  };

  if (checking) {
    return <div style={styles.page}><div style={styles.card}>로그인 확인 중...</div></div>;
  }

  if (session) return <>{children}</>;

  return (
    <div style={styles.page}>
      <form
        style={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          void login();
        }}
      >
        <div style={styles.badge}>TAEMYUNG ERP</div>
        <h1 style={styles.title}>태명산업개발</h1>
        <p style={styles.subtitle}>통합 관리 시스템 로그인</p>

        <label style={styles.label}>이름 또는 아이디</label>
        <input
          value={loginName}
          onChange={(event) => { setLoginName(event.target.value); setError(""); }}
          placeholder="예: 김철수"
          autoComplete="username"
          style={styles.input}
        />

        <label style={styles.label}>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(""); }}
          placeholder="비밀번호"
          autoComplete="current-password"
          style={styles.input}
        />

        {error && <div style={styles.error}>{error}</div>}
        <button type="submit" disabled={submitting} style={{ ...styles.button, opacity: submitting ? 0.65 : 1 }}>
          {submitting ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f2f5f9", padding: 20, fontFamily: "inherit" },
  card: { width: "min(420px, 100%)", background: "#fff", borderRadius: 22, padding: 32, boxShadow: "0 20px 50px rgba(30,45,65,.12)", border: "1px solid #e6ebf1" },
  badge: { display: "inline-block", fontSize: 12, fontWeight: 900, letterSpacing: 1.2, color: "#35506f", background: "#eef3f8", borderRadius: 999, padding: "7px 10px", marginBottom: 14 },
  title: { margin: 0, fontSize: 28, lineHeight: 1.2, color: "#182535" },
  subtitle: { margin: "8px 0 26px", color: "#68788b", fontSize: 14 },
  label: { display: "block", margin: "14px 0 7px", fontSize: 13, fontWeight: 800, color: "#33465a" },
  input: { width: "100%", boxSizing: "border-box", height: 48, border: "1px solid #d7dee7", borderRadius: 12, padding: "0 14px", fontSize: 16, outline: "none", background: "#fff" },
  error: { marginTop: 14, padding: "11px 12px", borderRadius: 10, background: "#fff2f2", color: "#b72d2d", fontSize: 13, fontWeight: 700 },
  button: { width: "100%", height: 50, border: 0, borderRadius: 12, marginTop: 20, background: "#253d59", color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer" },
};
