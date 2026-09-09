const INTERNAL_LOGIN_DOMAIN = "tm.local";

const utf8Hex = (value: string) =>
  Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const normalizeLoginName = (value: string) =>
  String(value || "").trim().normalize("NFC").toLowerCase();

const DRIVER_LOGIN_EMAIL_BY_NAME: Record<string, string> = {
  "이상섭": `tmd1@${INTERNAL_LOGIN_DOMAIN}`,
};

export const toLoginEmail = (value: string) => {
  const raw = normalizeLoginName(value);
  if (!raw) return "";
  if (raw.includes("@")) return raw;

  // 기사님은 한글 이름으로 로그인하고, 실제 Supabase Auth 계정은
  // tmd1, tmd2... 형태의 내부 계정으로 연결합니다.
  if (DRIVER_LOGIN_EMAIL_BY_NAME[raw]) return DRIVER_LOGIN_EMAIL_BY_NAME[raw];

  // 기존 영문 아이디는 예전 방식과 완전히 동일하게 유지합니다.
  if (/^[a-z0-9._-]+$/.test(raw)) return `${raw}@${INTERNAL_LOGIN_DOMAIN}`;

  // 아직 매핑되지 않은 한글 이름은 기존 안전한 내부 이메일 규칙을 사용합니다.
  return `u-${utf8Hex(raw)}@${INTERNAL_LOGIN_DOMAIN}`;
};

export const toLoginId = (value: string) => {
  const raw = normalizeLoginName(value);
  const suffix = `@${INTERNAL_LOGIN_DOMAIN}`;
  return raw.endsWith(suffix) ? raw.slice(0, -suffix.length) : raw;
};
