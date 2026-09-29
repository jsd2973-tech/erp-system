# Frontend error monitoring foundation

## Scope and current error handling

The entry point previously rendered `StrictMode → AuthEntry → DispatchAuthGate → App`
without an ErrorBoundary, `window.onerror` or an `unhandledrejection` collector.
`App.tsx` owns an in-app success/info toast, inline error state and alert messages.
Feature services normally return Supabase `{ data, error }` results to their callers;
caught/returned errors are displayed or logged rather than automatically thrown.
There are 14 `console.error` calls in App, two in DispatchAuthGate, and two in the
receipt OCR API. This change does not turn console output into telemetry.

The Vercel serverless routes are `api/g2b.ts`, `api/lh.ts` and `api/receipt-ocr.ts`.
Their server-side environment variables and error handling remain unchanged.
This foundation monitors browser runtime errors only; handled service errors and
serverless exceptions are outside this PR's scope.

## Integration

- `src/main.tsx` initializes the facade before `createRoot().render()`.
- `src/components/AppErrorBoundary.tsx` wraps AuthEntry, DispatchAuthGate and App
  with the standard Sentry React boundary. The fallback displays a generic Korean
  message and a reload button without showing error details.
- `src/lib/errorMonitoring.ts` owns all SDK usage, provides initialization,
  exception/message capture and safe context tags, and exports the boundary.
- Sentry `GlobalHandlers` owns `window.onerror` and `window.onunhandledrejection`.
  LinkedErrors retains React's linked component error; Dedupe handles duplicate
  events. There are no additional window listeners, boundary `onError` captures
  or React root capture hooks that would report the same render error twice.
- The facade is optional and fail-safe. Empty/invalid DSNs and development builds
  do not initialize the SDK or send events. The recovery UI still works.

## Data policy

`src/lib/errorMonitoringPrivacy.ts` reconstructs events from an allowlist in
`beforeSend` and again immediately before the SDK's fetch transport. This avoids
depending on sensitive field names alone: arbitrary strings can contain user
input, passwords or business details even when they use harmless-looking keys.

The only retained fields are a generated event ID, timestamp, severity, JavaScript
platform, environment, validated commit release, standard error type, fixed
redacted message, known error mechanism/handled flag, bundled `/assets/*.js`
filename with line/column, and allowlisted role/module tags.

All raw exception/message text is replaced. Requests/responses, body data,
headers, Authorization, cookies, access/refresh tokens, account and business
numbers, OCR text/images, attachments, GPS coordinates, addresses, vehicle/driver
location, user memos, email/name/IP, breadcrumbs, extra/context data, custom
fingerprints, transaction names, source lines and stack locals are excluded.
Unrecognized fields and values are excluded, including those from future SDKs.
URLs retain only a bundled code path, without host, credentials, query or fragment.
As a result, stack positions and releases remain useful but free-form error
messages and dynamically named functions are intentionally unavailable.

The final transport accepts only sanitized error events. It drops attachment,
session, replay, feedback, trace, log, metric and other envelope items, and strips
custom envelope headers/trace context. SDK metadata explicitly disables IP
inference. Transport fetches omit credentials, custom headers and the browser
referrer. SDK data collection is also disabled for user info, cookies, headers,
bodies, queries, database/task payloads, local variables, source context,
GraphQL and AI content. No console/DOM/network breadcrumb, session, replay,
profiling or tracing integration is enabled; trace headers are not propagated.

Existing role data could safely supply `admin`, `office`, `field`,
`dispatch_manager` or `driver`. `setMonitoringContext` accepts only these roles
and known module names and clears tags with `null`. This PR does not connect it
to authentication, query user data, alter permissions or send user identifiers.
No emails, real names or Supabase session objects should ever be passed to it.

## Deployment metadata

`vite.config.ts` exposes only `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` as
`VITE_MONITORING_ENVIRONMENT` and `VITE_MONITORING_RELEASE` at build time.
Production and Preview therefore remain distinct although both are Vite
production builds. Releases use `taemyung-erp@<commit SHA>`.
Missing/unknown environment metadata defaults to development; Vite dev mode
always disables remote monitoring, even if a DSN is present. Local and dedicated
E2E builds therefore do not send remotely by default.

The existing Vercel branch deployment allowlist enables this PR's branch only
for Preview validation; the default wildcard and main's configuration are kept.

## Sentry / Vercel setup

The repository did not contain a Sentry dependency, DSN, release metadata or
Sentry account setup. No DSN, Sentry account, project, auth token or remote
environment variable is created by this PR. The connected Vercel project's
metadata confirms the production target but its API tool does not expose the
environment variable list, so existing Vercel DSN configuration is not verified.
An existing `VITE_SENTRY_DSN` is automatically reused if valid.

1. If there is no existing Sentry project, create a React project in your own
   Sentry organization (for example, `taemyung-erp`).
2. Open **Settings → Projects → your project → Client Keys (DSN)** and copy the
   public browser DSN. Do not copy a Sentry auth token.
3. Open the Vercel **erp-system** project (which serves
   `taemyung-erp.vercel.app`) → **Settings → Environment Variables**. First check
   for an existing `VITE_SENTRY_DSN`; reuse the correct project DSN if present.
   Otherwise add it as `VITE_SENTRY_DSN` for **Production and Preview**.
   Leave Development unset. Preview may use a separate Sentry project/DSN if desired.
4. Redeploy the relevant Preview after changing its variables. Production
   activation requires a deployment containing this code after review/merge;
   this PR remains Draft and does not change production itself.

Vite substitutes the DSN during build; updating a dashboard variable alone does
not activate an already built bundle. The browser DSN is public routing metadata,
but its actual value must still stay out of commits, PR descriptions and reports.

For proactive notification, use Sentry's issue alert settings to configure a
new-issue/regression notification for the appropriate environment and recipient.
This PR does not create alert rules or send messages to anyone. Source map upload
is deferred; bundled filename/line/column and the release commit are retained.

## Verification

`tests/error-monitoring.test.mjs` covers no-DSN/development/invalid-DSN behavior,
idempotent init, exception/message capture, context reset, SDK failure isolation,
all sensitive data categories including free text and unknown fields, transport
attachment/non-error blocking, and the real Sentry boundary's fallback/reload path.

Required checks remain `npm ci`, `npm run build`, the existing CI build-clean
guard, `npm run test:unit`, `npm run test:e2e:typecheck`, full browser E2E and
`git diff --check`. Browser tests use the existing dedicated test Supabase project
and GitHub secrets. Production DB data/schema, migrations, OCR, GPS and ERP
business logic are unchanged.

References: [React ErrorBoundary](https://docs.sentry.io/platforms/javascript/guides/react/features/error-boundary/),
[SDK options and data collection](https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/),
[Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).
