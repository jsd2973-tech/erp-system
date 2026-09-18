import { parseReceiptOcr, type ReceiptOcrResult } from "../src/features/card/receiptOcr.js";
import { parseFuelReceiptOcr, type FuelReceiptOcrResult } from "../src/features/fuel/fuelReceiptOcr.js";

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL = process.env.SUPABASE_URL || "https://jqdvxmatbmmeubtoogvl.supabase.co";
const SUPABASE_PUBLIC_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_83Pb_nHMoZCduendoRwE5w_uJqiuvH7";
const MAX_BASE64_LENGTH = 6_000_000;
const ADMIN_EMAILS = new Set(["jsd2973@gmail.com"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp"]);

type AuthenticatedUser = { id?: string; email?: string };
type OcrRequestBody = { image?: unknown; dataUrl?: unknown; mode?: unknown };

const json = (data: unknown, status = 200, request?: Request) => {
  const origin = request?.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "POST, OPTIONS";
    headers["access-control-allow-headers"] = "authorization, content-type";
    headers.vary = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
};

const isAllowedOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return url.protocol === "https:"
      && (url.hostname === "taemyung-erp.vercel.app" || url.hostname.endsWith(".vercel.app"))
      || (url.protocol === "http:"
        && (url.hostname === "localhost" || url.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
};

const bearerToken = (request: Request) => {
  const value = request.headers.get("authorization") || "";
  return value.replace(/^Bearer\s+/i, "").trim();
};

const getAuthenticatedUser = async (request: Request): Promise<AuthenticatedUser | null> => {
  const token = bearerToken(request);
  if (!token) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null) as AuthenticatedUser | null;
  return user?.id && user.email ? user : null;
};

const hasReceiptOcrAccess = async (user: AuthenticatedUser, request: Request, mode: "card" | "fuel") => {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return false;
  if (ADMIN_EMAILS.has(email)) return true;

  const query = new URLSearchParams({
    select: "role,permissions",
    email: `eq.${email}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_permissions?${query.toString()}`, {
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      authorization: `Bearer ${bearerToken(request)}`,
    },
  });
  if (!response.ok) return false;
  const rows = await response.json().catch(() => []) as Array<{ role?: string; permissions?: Record<string, unknown> }>;
  const permission = rows[0];
  const fuelPermission = permission?.permissions?.fuel_management;
  return permission?.role === "office"
    || permission?.role === "admin"
    || (mode === "fuel" && (fuelPermission === true || fuelPermission === "true"));
};

const decodeImage = (body: OcrRequestBody) => {
  const value = typeof body.dataUrl === "string" ? body.dataUrl : body.image;
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s/g, "");
  if (!ALLOWED_IMAGE_TYPES.has(mimeType) || !base64 || base64.length > MAX_BASE64_LENGTH) return null;
  return { mimeType, base64 };
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? value as Record<string, unknown> : null;

const visionErrorDetails = (body: unknown) => {
  const root = asRecord(body);
  const responses = Array.isArray(root?.responses) ? root.responses : [];
  const firstResponse = asRecord(responses[0]);
  const error = asRecord(firstResponse?.error);
  return {
    code: typeof error?.code === "number" ? error.code : undefined,
    status: typeof error?.status === "string" ? error.status : "",
    message: typeof error?.message === "string" ? error.message : "",
  };
};

const visionErrorMessage = (body: unknown, httpStatus?: number) => {
  if (httpStatus === 403) {
    return "Google Vision API 요청이 거부되었습니다. API 키 문자열, Cloud Vision API 제한, 결제/프로젝트 설정을 확인해 주세요.";
  }
  if (httpStatus === 401) {
    return "Google Vision API 인증에 실패했습니다. Vercel Production 환경변수의 API 키를 확인해 주세요.";
  }
  const details = visionErrorDetails(body);
  const message = `${details.status} ${details.message}`;
  if (/quota|rate|limit/i.test(message)) return "OCR 사용량 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.";
  if (/billing|billing account|billable|service_disabled|has not been used|enable.*api/i.test(message)) {
    return "Google Cloud 결제 설정 또는 Vision API 사용 설정을 확인해 주세요.";
  }
  if (/invalid|api[_ ]?key|credential|permission|unauth|forbidden|not authorized|blocked/i.test(message)) {
    return "Google Vision API 키 또는 API 제한 설정을 확인해 주세요.";
  }
  return "영수증 OCR 서비스에서 응답하지 않았습니다.";
};

const fieldsFromResult = (result: ReceiptOcrResult) => ({
  date: Boolean(result.date),
  merchant: Boolean(result.merchant),
  totalAmount: result.totalAmount != null,
});

const fieldsFromFuelResult = (result: FuelReceiptOcrResult) => ({
  fuelDate: Boolean(result.fuelDate),
  stationName: Boolean(result.stationName),
  productName: Boolean(result.productName),
  quantity: result.quantity != null,
  unitPrice: result.unitPrice != null,
  supplyAmount: result.supplyAmount != null,
  vatAmount: result.vatAmount != null,
  totalAmount: result.totalAmount != null,
});

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") {
      return json(null, 204, request);
    }
    if (request.method !== "POST") return json({ error: "POST 요청만 허용됩니다." }, 405, request);
    if (!isAllowedOrigin(request.headers.get("origin") || "https://taemyung-erp.vercel.app")) {
      return json({ error: "허용되지 않은 요청입니다." }, 403, request);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8_000_000) return json({ error: "영수증 이미지가 너무 큽니다." }, 413, request);

    let body: OcrRequestBody;
    try {
      body = await request.json() as OcrRequestBody;
    } catch {
      return json({ error: "영수증 이미지 요청을 읽지 못했습니다." }, 400, request);
    }

    const mode: "card" | "fuel" = body.mode === "fuel" ? "fuel" : "card";
    const user = await getAuthenticatedUser(request).catch(() => null);
    if (!user || !(await hasReceiptOcrAccess(user, request, mode).catch(() => false))) {
      return json({ error: "OCR 사용 권한이 없습니다." }, 403, request);
    }

    const apiKey = String(
      process.env.GOOGLE_CLOUD_VISION_API_KEY
        || process.env.GOOGLE_VISION_API_KEY
        || "",
    ).trim();
    if (!apiKey) {
      return json({ error: "OCR 서비스가 아직 설정되지 않았습니다." }, 503, request);
    }

    const image = decodeImage(body);
    if (!image) return json({ error: "지원하는 이미지 형식이 아니거나 이미지가 너무 큽니다." }, 415, request);

    try {
      const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          requests: [{
            image: { content: image.base64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["ko", "en"] },
          }],
        }),
      });
      const visionBody = await visionResponse.json().catch(() => null);
      const visionError = visionErrorDetails(visionBody);
      if (!visionResponse.ok || visionBody?.responses?.[0]?.error) {
        console.error("[receipt-ocr] Vision request failed", {
          httpStatus: visionResponse.status,
          errorCode: visionError.code,
          errorStatus: visionError.status,
          errorMessage: visionError.message.slice(0, 240),
        });
        return json({ error: visionErrorMessage(visionBody, visionResponse.status) }, 502, request);
      }

      if (mode === "fuel") {
        const result = parseFuelReceiptOcr(visionBody);
        return json({
          fuelDate: result.fuelDate,
          stationName: result.stationName,
          productName: result.productName,
          quantity: result.quantity,
          unitPrice: result.unitPrice,
          supplyAmount: result.supplyAmount,
          vatAmount: result.vatAmount,
          totalAmount: result.totalAmount,
          confidence: result.confidence,
          fields: fieldsFromFuelResult(result),
        }, 200, request);
      }

      const result = parseReceiptOcr(visionBody);
      return json({
        date: result.date,
        merchant: result.merchant,
        totalAmount: result.totalAmount,
        confidence: result.confidence,
        fields: fieldsFromResult(result),
      }, 200, request);
    } catch (error) {
      console.error("[receipt-ocr] Vision request exception", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      });
      return json({ error: "영수증 OCR 분석에 실패했습니다." }, 502, request);
    }
  },
};
