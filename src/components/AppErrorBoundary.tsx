import type { ReactNode } from "react";
import { MonitoringErrorBoundary } from "../lib/errorMonitoring";

export function AppErrorFallback({ onReload = () => window.location.reload() }: { onReload?: () => void }) {
  return <main role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f2f5f9", color: "#17304a" }}>
    <section style={{ width: "min(440px, 100%)", padding: 28, borderRadius: 16, background: "white", border: "1px solid #dbe4ed" }}>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>화면을 불러오는 중 오류가 발생했습니다.</h1>
      <p style={{ lineHeight: 1.6 }}>새로고침 후 다시 이용해 주세요. 저장하지 않은 입력 내용은 사라질 수 있습니다.</p>
      <button type="button" onClick={onReload} style={{ minHeight: 44, padding: "10px 18px", border: 0, borderRadius: 8, background: "#234f76", color: "white", font: "inherit", cursor: "pointer" }}>새로고침</button>
    </section>
  </main>;
}

export default function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <MonitoringErrorBoundary showDialog={false} fallback={<AppErrorFallback />}>{children}</MonitoringErrorBoundary>;
}
