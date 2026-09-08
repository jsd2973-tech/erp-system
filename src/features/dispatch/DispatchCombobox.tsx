import { useEffect, useMemo, useRef, useState } from "react";

export type DispatchComboboxOption = {
  id: string;
  name: string;
  detail?: string;
};

type DispatchComboboxProps = {
  label: string;
  value: string;
  options: DispatchComboboxOption[];
  placeholder: string;
  required?: boolean;
  onChange: (value: string, selectedId: string | null) => void;
};

const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase("ko-KR");

export default function DispatchCombobox({ label, value, options, placeholder, required = false, onChange }: DispatchComboboxProps) {
  const rootRef = useRef<HTMLLabelElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => {
    const keyword = normalizeSearch(value);
    return options.filter((option) => !keyword || normalizeSearch(`${option.name} ${option.detail || ""}`).includes(keyword)).slice(0, 12);
  }, [options, value]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => setActiveIndex(0), [value]);

  const selectOption = (option: DispatchComboboxOption) => {
    onChange(option.name, option.id);
    setOpen(false);
  };

  return (
    <label className="dispatch-combobox" ref={rootRef}>
      <span>{label}{required ? " *" : ""}</span>
      <input
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onChange={(event) => { onChange(event.target.value, null); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") return setOpen(false);
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            return setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            return setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && open && filtered[activeIndex]) {
            event.preventDefault();
            selectOption(filtered[activeIndex]);
          }
        }}
      />
      {open && (
        <div className="dispatch-combobox-menu" role="listbox">
          {filtered.length ? filtered.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              <b>{option.name}</b>{option.detail && <small>{option.detail}</small>}
            </button>
          )) : <p>일치하는 저장값이 없습니다. 입력한 이름을 그대로 사용할 수 있습니다.</p>}
        </div>
      )}
    </label>
  );
}
