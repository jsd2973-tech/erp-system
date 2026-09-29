import type { ErrorEvent, Event, StackFrame, init } from "@sentry/react";

type MonitoringTransport = ReturnType<NonNullable<Parameters<typeof init>[0]["transport"]>>;
type Envelope = Parameters<MonitoringTransport["send"]>[0];

export const REDACTED_MESSAGE = "[redacted error message]";
const roles = new Set(["admin", "office", "field", "dispatch_manager", "driver"]);
const modules = new Set(["auth", "purchase", "maintenance", "dispatch", "card", "fuel", "bidding", "master-data"]);
const errorTypes = new Set([
  "Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError",
  "EvalError", "AggregateError", "DOMException", "UnhandledRejection",
]);
const mechanisms = new Set([
  "generic", "auto.browser.global_handlers.onerror",
  "auto.browser.global_handlers.onunhandledrejection", "auto.function.react.error_boundary",
]);
const levels = new Set(["fatal", "error", "warning", "log", "info", "debug"]);

export type MonitoringContext = { role?: string; module?: string };

export const safeMonitoringTags = (context: MonitoringContext = {}) => ({
  ...(roles.has(context.role || "") ? { role: context.role } : {}),
  ...(modules.has(context.module || "") ? { module: context.module } : {}),
});

export const monitoringEnvironment = (value: unknown): "production" | "preview" | "development" =>
  value === "production" || value === "preview" ? value : "development";

export const monitoringRelease = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const sha = value.replace(/^taemyung-erp@/, "");
  return /^[a-f0-9]{7,40}$/i.test(sha) ? `taemyung-erp@${sha.toLowerCase()}` : undefined;
};

const safeFrame = (frame: StackFrame): StackFrame | undefined => {
  if (typeof frame.filename !== "string") return undefined;
  let filename: string;
  try {
    // Only bundled code paths are useful here. Drop host, credentials, query,
    // fragment, storage URLs, data/blob URLs, source context and local variables.
    const url = new URL(frame.filename, "https://monitoring.invalid");
    if (!/^https?:$/.test(url.protocol)) return undefined;
    filename = url.pathname;
  } catch {
    return undefined;
  }
  if (!/^\/assets\/[a-zA-Z0-9_.-]{1,160}\.js$/.test(filename)) return undefined;
  return {
    filename,
    ...(Number.isSafeInteger(frame.lineno) && frame.lineno! >= 0 ? { lineno: frame.lineno } : {}),
    ...(Number.isSafeInteger(frame.colno) && frame.colno! >= 0 ? { colno: frame.colno } : {}),
    ...(typeof frame.in_app === "boolean" ? { in_app: frame.in_app } : {}),
  };
};

/** Rebuild from an allowlist: unknown fields and all free text are excluded. */
export const sanitizeMonitoringEvent = (event: Event): ErrorEvent | null => {
  if (event.type !== undefined) return null;
  const sanitized: ErrorEvent = {
    type: undefined,
    platform: "javascript",
    environment: monitoringEnvironment(event.environment),
    ...(monitoringRelease(event.release) ? { release: monitoringRelease(event.release) } : {}),
    ...(typeof event.event_id === "string" && /^[a-f0-9]{32}$/i.test(event.event_id) ? { event_id: event.event_id } : {}),
    ...(typeof event.timestamp === "number" && Number.isFinite(event.timestamp) ? { timestamp: event.timestamp } : {}),
    ...(levels.has(event.level || "") ? { level: event.level } : {}),
    ...(event.message !== undefined || event.logentry ? { message: REDACTED_MESSAGE } : {}),
    tags: safeMonitoringTags({ role: event.tags?.role as string, module: event.tags?.module as string }),
  };
  if (event.exception?.values) {
    sanitized.exception = {
      values: event.exception.values.slice(0, 8).map((exception) => {
        const rawType = exception.type || "Error";
        const type = rawType.replace(/^React ErrorBoundary /, "");
        const frames = exception.stacktrace?.frames?.slice(-100).flatMap((frame) => {
          const safe = safeFrame(frame);
          return safe ? [safe] : [];
        });
        return {
          type: errorTypes.has(type) ? (rawType.startsWith("React ErrorBoundary ") ? `React ErrorBoundary ${type}` : type) : "Error",
          value: REDACTED_MESSAGE,
          ...(frames?.length ? { stacktrace: { frames } } : {}),
          ...(exception.mechanism ? {
            mechanism: {
              type: mechanisms.has(exception.mechanism.type) ? exception.mechanism.type : "generic",
              ...(typeof exception.mechanism.handled === "boolean" ? { handled: exception.mechanism.handled } : {}),
            },
          } : {}),
        };
      }),
    };
  }
  return sanitized;
};

/** Attachments, replay, logs, sessions and trace payloads bypass beforeSend.
 * Enforce the same policy at the final transport boundary, including headers. */
export const sanitizeMonitoringEnvelope = (envelope: Envelope): Envelope | null => {
  const items: Array<[{ type: "event" }, ErrorEvent]> = [];
  for (const [header, payload] of envelope[1]) {
    if (header.type !== "event" || !payload || typeof payload !== "object" || payload instanceof Uint8Array) continue;
    const event = sanitizeMonitoringEvent(payload as Event);
    if (event) items.push([{ type: "event" }, event]);
  }
  if (!items.length) return null;
  const eventId = envelope[0].event_id;
  if (typeof eventId !== "string" || !/^[a-f0-9]{32}$/i.test(eventId)) return null;
  const sdk = envelope[0].sdk;
  return [{
    sent_at: new Date().toISOString(),
    event_id: eventId,
    ...(sdk && typeof sdk.version === "string" && /^\d+\.\d+\.\d+$/.test(sdk.version) ? {
      sdk: { name: "sentry.javascript.react", version: sdk.version, settings: { infer_ip: "never" } },
    } : {}),
  }, items];
};
