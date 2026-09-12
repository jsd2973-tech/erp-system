import { useEffect, useRef, type ReactNode } from "react";

/** Keeps the same form mounted when collapsed so unsaved input survives. */
export default function MobileEditor({ open, onToggle, title, children }: { open: boolean; onToggle: () => void; title: string; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && window.matchMedia("(max-width: 760px)").matches) container.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [open, title]);
  return <div ref={container} className={`dispatch-mobile-editor ${open ? "is-open" : ""}`}>
    <button type="button" className="dispatch-mobile-editor-toggle" aria-expanded={open} onClick={onToggle}>{title}<span>{open ? "접기 −" : "열기 +"}</span></button>
    <div className="dispatch-mobile-editor-content">{children}</div>
  </div>;
}
