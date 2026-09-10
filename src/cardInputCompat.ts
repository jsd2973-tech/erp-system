const normalizeCardAmountValue = (value: string) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\s,₩원]/g, "")
    .replace(/[^0-9.-]/g, "");

const isCardAmountInput = (target: EventTarget | null): target is HTMLInputElement =>
  target instanceof HTMLInputElement
  && target.inputMode === "numeric"
  && target.placeholder === "금액 입력";

// Some office PCs/IME combinations enter full-width digits, commas, or spaces.
// Normalize before React reads the input event so existing card-save validation
// receives a plain numeric string consistently.
document.addEventListener("input", (event) => {
  if (!isCardAmountInput(event.target)) return;
  const normalized = normalizeCardAmountValue(event.target.value);
  if (normalized !== event.target.value) event.target.value = normalized;
}, true);
