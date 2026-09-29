import * as Sentry from "@sentry/react";
import {
  monitoringEnvironment, monitoringRelease, REDACTED_MESSAGE,
  safeMonitoringTags, sanitizeMonitoringEnvelope, sanitizeMonitoringEvent,
  type MonitoringContext,
} from "./errorMonitoringPrivacy";

type MonitoringOptions = { dsn?: string; environment?: string; release?: string };
type MonitoringSdk = Pick<typeof Sentry,
  "init" | "captureException" | "captureMessage" | "setTag" | "makeFetchTransport" |
  "globalHandlersIntegration" | "linkedErrorsIntegration" | "dedupeIntegration"
>;

const validDsn = (dsn: string) => {
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" && !!url.username && !url.password && /^\/[0-9]+$/.test(url.pathname) && !url.search && !url.hash;
  } catch {
    return false;
  }
};

/** Keep feature code independent of the monitoring vendor; never throw to callers. */
export const createErrorMonitoring = (sdk: MonitoringSdk = Sentry) => {
  let enabled = false;
  return {
    initializeErrorMonitoring(options: MonitoringOptions = {}): boolean {
      if (enabled) return true;
      const environment = monitoringEnvironment(options.environment);
      const dsn = options.dsn?.trim() || "";
      if (!dsn || environment === "development" || !validDsn(dsn)) return false;
      try {
        sdk.init({
          dsn, environment, release: monitoringRelease(options.release),
          defaultIntegrations: false,
          integrations: [
            sdk.globalHandlersIntegration({ onerror: true, onunhandledrejection: true }),
            sdk.linkedErrorsIntegration(), sdk.dedupeIntegration(),
          ],
          dataCollection: {
            userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
            urlQueryParams: false, databaseQueryData: false, queues: false,
            stackFrameVariables: false, frameContextLines: 0,
            graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
          },
          // No console/DOM/network breadcrumbs, sessions, replay or performance collection.
          maxBreadcrumbs: 0, beforeBreadcrumb: () => null,
          sendClientReports: false, enhanceFetchErrorMessages: false,
          tracePropagationTargets: [], replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
          beforeSend: sanitizeMonitoringEvent,
          beforeSendTransaction: () => null,
          beforeSendLog: () => null, beforeSendMetric: () => null,
          transport(transportOptions) {
            const transport = sdk.makeFetchTransport({
              ...transportOptions, headers: undefined,
              fetchOptions: { credentials: "omit", referrerPolicy: "no-referrer" },
            });
            return {
              send(envelope) {
                const sanitized = sanitizeMonitoringEnvelope(envelope);
                return sanitized ? transport.send(sanitized) : Promise.resolve({});
              },
              flush: (timeout) => transport.flush(timeout),
            };
          },
        });
        enabled = true;
      } catch {
        enabled = false;
      }
      return enabled;
    },
    captureException(error: unknown, context: MonitoringContext = {}): string | undefined {
      if (!enabled) return undefined;
      try { return sdk.captureException(error, { tags: safeMonitoringTags(context) }); }
      catch { return undefined; }
    },
    captureMessage(_message: string, context: MonitoringContext = {}): string | undefined {
      if (!enabled) return undefined;
      try { return sdk.captureMessage(REDACTED_MESSAGE, { level: "error", tags: safeMonitoringTags(context) }); }
      catch { return undefined; }
    },
    setMonitoringContext(context: MonitoringContext | null): void {
      if (!enabled) return;
      try {
        const tags = safeMonitoringTags(context || {});
        sdk.setTag("role", tags.role);
        sdk.setTag("module", tags.module);
      } catch { /* Monitoring must never affect the ERP. */ }
    },
  };
};

export const { initializeErrorMonitoring, captureException, captureMessage, setMonitoringContext } = createErrorMonitoring();
// The SDK owns render-error capture. Do not add a second capture in onError.
export { ErrorBoundary as MonitoringErrorBoundary } from "@sentry/react";
