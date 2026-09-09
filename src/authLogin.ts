const INTERNAL_LOGIN_DOMAIN = "tm.local";

const utf8Hex = (value: string) =>
  Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const normalizeLoginName = (value: string) =>
  String(value || "").trim().normalize("NFC").toLowerCase();

export const toLoginEmail = (value: string) => {
  const raw = normalizeLoginName(value);
  if (!raw) return "";
  if (raw.includes("@")) return raw;

  // 기존 영문 아이디는 예전 방식과 완전히 동일하게 유지합니다.
  if (/^[a-z0-9._-]+$/.test(raw)) return `${raw}@${INTERNAL_LOGIN_DOMAIN}`;

  // 한글 이름 등 비 ASCII 로그인명은 Supabase Auth가 안전하게 받을 수 있도록
  // UTF-8 hex 기반의 내부 이메일로 변환합니다. 사용자는 이 값을 볼 필요가 없습니다.
  return `u-${utf8Hex(raw)}@${INTERNAL_LOGIN_DOMAIN}`;
};

export const toLoginId = (value: string) => {
  const raw = normalizeLoginName(value);
  const suffix = `@${INTERNAL_LOGIN_DOMAIN}`;
  return raw.endsWith(suffix) ? raw.slice(0, -suffix.length) : raw;
};
