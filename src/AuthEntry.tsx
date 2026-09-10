import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { toLoginEmail } from "./authLogin";

const AUTH_NAME_KEY = "erp_login_name_v2";
const AUTH_REMEMBER_KEY = "erp_login_remember_v1";
const AUTH_AUTO_KEY = "erp_login_auto_v1";
const AUTH_AUTO_PASSWORD_KEY = "erp_login_auto_password_v1";

export default function AuthEntry({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [rememberId, setRememberId] = useState(() => localStorage.getItem(AUTH_REMEMBER_KEY) === "1");
  const [autoLogin, setAutoLogin] = useState(() => localStorage.getItem(AUTH_AUTO_KEY) === "1");
  const [loginName, setLoginName] = useState(() => {
    const shouldLoad = localStorage.getItem(AUTH_REMEMBER_KEY) === "1" || localStorage.getItem(AUTH_AUTO_KEY) === "1";
    return shouldLoad ? (localStorage.getItem(AUTH_NAME_KEY) || "") : "";
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem(AUTH_AUTO_KEY) === "1"
      ? (localStorage.getItem(AUTH_AUTO_PASSWORD_KEY) || "")
      : "";
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const signIn = async (nameValue: string, passwordValue: string, options?: { automatic?: boolean }) => {
    const name = nameValue.trim();
    if (!name) {
      if (!options?.automatic) setError("아이디를 입력하세요.");
      return false;
    }
    if (!passwordValue) {
      if (!options?.automatic) setError("비밀번호를 입력하세요.");
      return false;
    }

    setSubmitting(true);
    setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: toLoginEmail(name),
      password: passwordValue,
    });
    setSubmitting(false);

    if (loginError) {
      if (options?.automatic) {
        localStorage.removeItem(AUTH_AUTO_PASSWORD_KEY);
        localStorage.setItem(AUTH_AUTO_KEY, "0");
        setAutoLogin(false);
        setPassword("");
        setError("자동로그인에 실패했습니다. 비밀번호를 다시 입력해 주세요.");
      } else {
        setError("로그인 실패: 아이디 또는 비밀번호를 확인하세요.");
      }
      return false;
    }

    if (rememberId || autoLogin) {
      localStorage.setItem(AUTH_NAME_KEY, name);
    } else {
      localStorage.removeItem(AUTH_NAME_KEY);
    }
    localStorage.setItem(AUTH_REMEMBER_KEY, rememberId || autoLogin ? "1" : "0");
    localStorage.setItem(AUTH_AUTO_KEY, autoLogin ? "1" : "0");
    if (autoLogin) localStorage.setItem(AUTH_AUTO_PASSWORD_KEY, passwordValue);
    else localStorage.removeItem(AUTH_AUTO_PASSWORD_KEY);

    setPassword(autoLogin ? passwordValue : "");
    return true;
  };

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setSession(data.session);
        setChecking(false);
        return;
      }

      const shouldAutoLogin = localStorage.getItem(AUTH_AUTO_KEY) === "1";
      const savedName = localStorage.getItem(AUTH_NAME_KEY) || "";
      const savedPassword = localStorage.getItem(AUTH_AUTO_PASSWORD_KEY) || "";
      if (shouldAutoLogin && savedName && savedPassword) {
        await signIn(savedName, savedPassword, { automatic: true });
      }
      if (mounted) setChecking(false);
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
    // Initial authentication check only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async () => {
    await signIn(loginName, password);
  };

  const toggleRememberId = (checked: boolean) => {
    setRememberId(checked);
    localStorage.setItem(AUTH_REMEMBER_KEY, checked ? "1" : "0");
    if (!checked && autoLogin) {
      setAutoLogin(false);
      localStorage.setItem(AUTH_AUTO_KEY, "0");
      localStorage.removeItem(AUTH_AUTO_PASSWORD_KEY);
    }
    if (!checked && !autoLogin) localStorage.removeItem(AUTH_NAME_KEY);
  };

  const toggleAutoLogin = (checked: boolean) => {
    setAutoLogin(checked);
    localStorage.setItem(AUTH_AUTO_KEY, checked ? "1" : "0");
    if (checked) {
      setRememberId(true);
      localStorage.setItem(AUTH_REMEMBER_KEY, "1");
      if (loginName.trim()) localStorage.setItem(AUTH_NAME_KEY, loginName.trim());
    } else {
      localStorage.removeItem(AUTH_AUTO_PASSWORD_KEY);
    }
  };

  const shell = (content: ReactNode) => (
    <div className="erp-auth-page">
      <style>{authCss}</style>
      <div className="erp-auth-shell">
        <section className="erp-auth-brand">
          <span className="erp-auth-kicker">TAEMYUNG ERP</span>
          <h1>태명산업개발</h1>
          <p>구매, 카드, 정비, 운행을 하나의 시스템에서 관리합니다.</p>
          <div className="erp-auth-brand-line" />
          <small>통합 관리 시스템</small>
        </section>
        <section className="erp-auth-login">{content}</section>
      </div>
    </div>
  );

  if (checking) return shell(<div className="erp-auth-checking">로그인 확인 중...</div>);
  if (session) return <>{children}</>;

  return shell(
    <form
      className="erp-auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        void login();
      }}
    >
      <div className="erp-auth-mobile-brand">TAEMYUNG ERP</div>
      <div className="erp-auth-form-head">
        <span>ERP LOGIN</span>
        <h2>로그인</h2>
        <p>사내 ERP 계정으로 로그인하세요.</p>
      </div>

      <label>아이디</label>
      <input
        value={loginName}
        onChange={(event) => {
          const next = event.target.value;
          setLoginName(next);
          if (rememberId || autoLogin) localStorage.setItem(AUTH_NAME_KEY, next.trim());
          setError("");
        }}
        placeholder="이름 또는 아이디"
        autoComplete="username"
      />

      <label>비밀번호</label>
      <input
        type="password"
        value={password}
        onChange={(event) => { setPassword(event.target.value); setError(""); }}
        placeholder="비밀번호"
        autoComplete="current-password"
      />

      <div className="erp-auth-options">
        <label className="erp-auth-check">
          <input
            type="checkbox"
            checked={rememberId}
            onChange={(event) => toggleRememberId(event.target.checked)}
          />
          <span>아이디 저장</span>
        </label>
        <label className="erp-auth-check">
          <input
            type="checkbox"
            checked={autoLogin}
            onChange={(event) => toggleAutoLogin(event.target.checked)}
          />
          <span>자동로그인</span>
        </label>
      </div>

      {error && <div className="erp-auth-error">{error}</div>}
      <button type="submit" disabled={submitting}>{submitting ? "로그인 중..." : "로그인"}</button>
    </form>
  );
}

const authCss = `
.erp-auth-page{min-height:100vh;display:grid;place-items:center;padding:36px;background:linear-gradient(135deg,#edf3f8 0%,#f8fafc 55%,#eaf1f7 100%);font-family:inherit;color:#17304a}
.erp-auth-shell{width:min(1040px,100%);min-height:600px;display:grid;grid-template-columns:1.08fr .92fr;overflow:hidden;border:1px solid #dbe4ed;border-radius:28px;background:#fff;box-shadow:0 30px 80px rgba(28,48,72,.14)}
.erp-auth-brand{position:relative;display:flex;flex-direction:column;justify-content:center;padding:64px;background:linear-gradient(145deg,#173b60 0%,#244f78 60%,#315f88 100%);color:#fff}
.erp-auth-brand:after{content:"";position:absolute;width:280px;height:280px;right:-90px;bottom:-90px;border:1px solid rgba(255,255,255,.12);border-radius:50%}
.erp-auth-kicker{display:inline-flex;width:max-content;margin-bottom:22px;padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.08);font-size:11px;font-weight:900;letter-spacing:.14em}
.erp-auth-brand h1{margin:0;font-size:42px;line-height:1.08;letter-spacing:-.045em}
.erp-auth-brand p{max-width:420px;margin:18px 0 0;color:#d7e3ee;font-size:16px;line-height:1.7}
.erp-auth-brand-line{width:52px;height:3px;margin:32px 0 16px;border-radius:999px;background:#8fc5ef}
.erp-auth-brand small{color:#c7d7e5;font-size:12px;font-weight:700;letter-spacing:.08em}
.erp-auth-login{display:grid;place-items:center;padding:54px}
.erp-auth-form{width:min(390px,100%)}
.erp-auth-mobile-brand{display:none}
.erp-auth-form-head span{display:block;margin-bottom:7px;color:#4f7190;font-size:10px;font-weight:900;letter-spacing:.14em}
.erp-auth-form-head h2{margin:0;color:#172b40;font-size:30px;letter-spacing:-.035em}
.erp-auth-form-head p{margin:8px 0 28px;color:#748296;font-size:13px}
.erp-auth-form>label{display:block;margin:15px 0 7px;color:#344a60;font-size:12px;font-weight:850}
.erp-auth-form>input{box-sizing:border-box;width:100%;height:50px;border:1px solid #cfd9e4;border-radius:11px;padding:0 14px;background:#fff;color:#1d3146;font-size:15px;outline:none;transition:border-color .15s,box-shadow .15s}
.erp-auth-form>input:focus{border-color:#5e98cc;box-shadow:0 0 0 3px rgba(63,132,193,.12)}
.erp-auth-options{display:flex;align-items:center;gap:22px;margin-top:16px}
.erp-auth-check{display:inline-flex!important;align-items:center;gap:7px;margin:0!important;color:#52677b!important;font-size:12px!important;font-weight:750!important;cursor:pointer;user-select:none}
.erp-auth-check input{width:16px;height:16px;margin:0;accent-color:#2d638f;cursor:pointer}
.erp-auth-form>button{width:100%;height:50px;margin-top:20px;border:0;border-radius:11px;background:linear-gradient(180deg,#2d638f,#234f76);color:#fff;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 8px 18px rgba(35,79,118,.18)}
.erp-auth-form>button:disabled{opacity:.6;cursor:not-allowed}
.erp-auth-error{margin-top:13px;padding:10px 12px;border-radius:9px;background:#fff0f0;color:#b22c2c;font-size:12px;font-weight:750}
.erp-auth-checking{color:#607489;font-size:14px;font-weight:800}
@media(max-width:760px){
  .erp-auth-page{padding:18px;background:#eef3f8}
  .erp-auth-shell{display:block;min-height:0;border-radius:20px;box-shadow:0 18px 44px rgba(30,45,65,.12)}
  .erp-auth-brand{display:none}
  .erp-auth-login{padding:30px 24px 28px}
  .erp-auth-mobile-brand{display:inline-flex;margin-bottom:18px;padding:6px 9px;border-radius:999px;background:#eef3f8;color:#35506f;font-size:10px;font-weight:900;letter-spacing:.11em}
  .erp-auth-form-head h2{font-size:26px}
  .erp-auth-form-head p{margin-bottom:22px}
  .erp-auth-form>input,.erp-auth-form>button{height:48px}
  .erp-auth-options{gap:18px;justify-content:flex-start}
}
`;
