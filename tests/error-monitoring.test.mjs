import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const privacyPath = new URL(`../src/lib/.errorMonitoringPrivacy-${process.pid}.mjs`, import.meta.url);
const reporterPath = new URL(`../src/lib/.errorMonitoring-${process.pid}.mjs`, import.meta.url);
const boundaryPath = new URL(`../src/components/.AppErrorBoundary-${process.pid}.mjs`, import.meta.url);
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
await writeFile(privacyPath, transpile(await readFile(new URL("../src/lib/errorMonitoringPrivacy.ts", import.meta.url), "utf8")));
await writeFile(reporterPath, transpile((await readFile(new URL("../src/lib/errorMonitoring.ts", import.meta.url), "utf8"))
  .replace('from "./errorMonitoringPrivacy"', `from "./.errorMonitoringPrivacy-${process.pid}.mjs"`)));
await writeFile(boundaryPath, transpile((await readFile(new URL("../src/components/AppErrorBoundary.tsx", import.meta.url), "utf8"))
  .replace('from "../lib/errorMonitoring"', `from "../lib/.errorMonitoring-${process.pid}.mjs"`)));
const { createErrorMonitoring } = await import(reporterPath.href);
const { sanitizeMonitoringEvent, sanitizeMonitoringEnvelope, REDACTED_MESSAGE } = await import(privacyPath.href);
const { default: AppErrorBoundary, AppErrorFallback } = await import(boundaryPath.href);
test.after(async () => { await Promise.all([privacyPath, reporterPath, boundaryPath].map((path) => unlink(path))); });

const options = { dsn: "https://public-key@sentry.example.invalid/123", environment: "preview", release: "e72c71b028e4b72fe8ff2e6bfa2f93f4c70b6ae1" };
const sdkMock = () => {
  const calls = [];
  let initialized;
  let fetchOptions;
  const sdk = {
    init(value) { calls.push(["init"]); initialized = value; },
    globalHandlersIntegration(value) { return { name: "GlobalHandlers", options: value }; },
    linkedErrorsIntegration() { return { name: "LinkedErrors" }; },
    dedupeIntegration() { return { name: "Dedupe" }; },
    captureException(...args) { calls.push(["exception", ...args]); return "exception-id"; },
    captureMessage(...args) { calls.push(["message", ...args]); return "message-id"; },
    setTag(...args) { calls.push(["tag", ...args]); },
    makeFetchTransport(options) { fetchOptions = options; return { send(value) { calls.push(["send", value]); return Promise.resolve({ statusCode: 200 }); }, flush() { return Promise.resolve(true); } }; },
  };
  return { sdk, calls, initialized: () => initialized, fetchOptions: () => fetchOptions };
};

test("no DSN is a safe no-op for initialization, capture and context", () => {
  const mock = sdkMock();
  const reporter = createErrorMonitoring(mock.sdk);
  assert.equal(reporter.initializeErrorMonitoring({ environment: "production" }), false);
  assert.equal(reporter.captureException(new Error("secret")), undefined);
  assert.equal(reporter.captureMessage("secret"), undefined);
  reporter.setMonitoringContext({ role: "admin" });
  assert.deepEqual(mock.calls, []);
});

test("development, missing deployment metadata and invalid DSNs never initialize", () => {
  for (const override of [
    { environment: "development" }, { environment: undefined }, { environment: "invalid" },
    { dsn: "" }, { dsn: "   " }, { dsn: "invalid" },
    { dsn: "https://public:secret@sentry.example.invalid/123" },
  ]) {
    const mock = sdkMock();
    assert.equal(createErrorMonitoring(mock.sdk).initializeErrorMonitoring({ ...options, ...override }), false);
    assert.deepEqual(mock.calls, []);
  }
});

test("preview/production initialize once with global handlers, dedupe and collection disabled", () => {
  for (const environment of ["production", "preview"]) {
    const mock = sdkMock();
    const reporter = createErrorMonitoring(mock.sdk);
    assert.equal(reporter.initializeErrorMonitoring({ ...options, environment }), true);
    assert.equal(reporter.initializeErrorMonitoring(options), true);
    assert.equal(mock.calls.length, 1);
    const config = mock.initialized();
    assert.equal(config.environment, environment);
    assert.equal(config.release, `taemyung-erp@${options.release}`);
    assert.equal(config.defaultIntegrations, false);
    assert.deepEqual(config.integrations.map(({ name }) => name), ["GlobalHandlers", "LinkedErrors", "Dedupe"]);
    assert.deepEqual(config.integrations[0].options, { onerror: true, onunhandledrejection: true });
    assert.equal(config.dataCollection.userInfo, false);
    assert.equal(config.dataCollection.cookies, false);
    assert.equal(config.dataCollection.httpHeaders, false);
    assert.deepEqual(config.dataCollection.httpBodies, []);
    assert.equal(config.dataCollection.stackFrameVariables, false);
    assert.equal(config.dataCollection.frameContextLines, 0);
    assert.equal(config.maxBreadcrumbs, 0);
    assert.equal(config.beforeBreadcrumb({ message: "secret" }), null);
    assert.equal(config.sendClientReports, false);
    assert.equal(config.enhanceFetchErrorMessages, false);
    assert.equal(config.beforeSendTransaction({}), null);
    assert.equal(config.beforeSendLog({}), null);
    assert.equal(config.beforeSendMetric({}), null);
    assert.deepEqual(config.tracePropagationTargets, []);
  }
});

test("normal Error capture retains the original stack path and allowlisted tags", () => {
  const mock = sdkMock();
  const reporter = createErrorMonitoring(mock.sdk);
  reporter.initializeErrorMonitoring(options);
  const error = new TypeError("user memo secret");
  assert.equal(reporter.captureException(error, { role: "office", module: "purchase", email: "private@example.invalid", memo: "secret" }), "exception-id");
  assert.equal(mock.calls.at(-1)[1], error);
  assert.deepEqual(mock.calls.at(-1)[2], { tags: { role: "office", module: "purchase" } });
  assert.equal(reporter.captureMessage("private free text", { role: "invalid", module: "fuel" }), "message-id");
  assert.deepEqual(mock.calls.at(-1), ["message", REDACTED_MESSAGE, { level: "error", tags: { module: "fuel" } }]);
  reporter.setMonitoringContext({ role: "driver", module: "dispatch" });
  assert.deepEqual(mock.calls.slice(-2), [["tag", "role", "driver"], ["tag", "module", "dispatch"]]);
  reporter.setMonitoringContext(null);
  assert.deepEqual(mock.calls.slice(-2), [["tag", "role", undefined], ["tag", "module", undefined]]);
});

test("SDK initialization and capture failures cannot break the ERP", () => {
  const mock = sdkMock();
  mock.sdk.init = () => { throw new Error("SDK unavailable"); };
  const reporter = createErrorMonitoring(mock.sdk);
  assert.equal(reporter.initializeErrorMonitoring(options), false);
  assert.equal(reporter.captureException(new Error("error")), undefined);
  mock.sdk.init = () => {};
  assert.equal(reporter.initializeErrorMonitoring(options), true);
  mock.sdk.captureException = mock.sdk.captureMessage = mock.sdk.setTag = () => { throw new Error("SDK unavailable"); };
  assert.equal(reporter.captureException(new Error("error")), undefined);
  assert.equal(reporter.captureMessage("message"), undefined);
  assert.doesNotThrow(() => reporter.setMonitoringContext(null));
});

const sensitiveEvent = () => {
  const sensitive = {
    password: "P4ss-secret!", access_token: "access-secret", refresh_token: "refresh-secret",
    Authorization: "Bearer auth-secret", cookie: "cookie-secret", account_number: "123-456-789012",
    business_number: "123-45-67890", ocrText: "OCR ORIGINAL secret", receiptImage: "data:image/png;base64,receipt-secret",
    attachment: "receipt-secret.jpg", latitude: 36.123456, longitude: 127.654321,
    address: "세종시 금남면 정확한 주소 123", driverLocation: "vehicle-location-secret", memo: "수동 입력 메모 secret",
    email: "private@example.invalid", name: "비공개 실명",
  };
  const secretText = Object.values(sensitive).join(" ");
  return {
    sensitive,
    event: {
      event_id: "a".repeat(32), environment: "production", release: options.release,
      level: "error", message: secretText, logentry: { message: secretText, params: [sensitive] },
      request: { headers: sensitive, cookies: sensitive, data: sensitive, url: `https://app.invalid/?${secretText}` },
      user: sensitive, extra: sensitive, contexts: { user: sensitive, response: sensitive },
      breadcrumbs: [{ message: secretText, data: sensitive }], tags: { ...sensitive, role: "admin", module: "maintenance" },
      transaction: secretText, fingerprint: [secretText], threads: sensitive, debug_meta: sensitive, unknownFutureField: sensitive,
      exception: { values: [{
        type: "TypeError", value: secretText,
        mechanism: { type: "auto.browser.global_handlers.onerror", handled: false, data: sensitive },
        stacktrace: { frames: [
          { filename: "https://user:pass@app.invalid/assets/index-A1.js?token=access-secret#memo", lineno: 17, colno: 3, in_app: true, function: secretText, vars: sensitive, context_line: secretText, abs_path: secretText },
          { filename: "https://storage.invalid/receipts/receipt-secret.jpg", context_line: secretText },
          { filename: "data:text/javascript,secret" }, { filename: "blob:secret" },
        ] },
      }] },
    },
  };
};

test("sanitizer removes every sensitive category including nested/free-text and unknown fields", () => {
  const { event, sensitive } = sensitiveEvent();
  const original = structuredClone(event);
  const safe = sanitizeMonitoringEvent(event);
  const serialized = JSON.stringify(safe);
  for (const value of Object.values(sensitive)) assert.equal(serialized.includes(String(value)), false, `leaked ${value}`);
  assert.deepEqual(event, original, "sanitizer must not mutate application data");
  assert.equal(safe.message, REDACTED_MESSAGE);
  assert.deepEqual(safe.tags, { role: "admin", module: "maintenance" });
  assert.deepEqual(safe.exception.values[0], {
    type: "TypeError", value: REDACTED_MESSAGE,
    mechanism: { type: "auto.browser.global_handlers.onerror", handled: false },
    stacktrace: { frames: [{ filename: "/assets/index-A1.js", lineno: 17, colno: 3, in_app: true }] },
  });
  assert.equal(safe.environment, "production");
  assert.equal(safe.release, `taemyung-erp@${options.release}`);
  assert.deepEqual(Object.keys(safe).sort(), ["environment", "event_id", "exception", "level", "message", "platform", "release", "tags", "type"].sort());
});

test("arbitrary exception types, rejection values, tags and release strings are removed", () => {
  const safe = sanitizeMonitoringEvent({
    environment: "secret address", release: "private@example.invalid", event_id: "secret",
    tags: { role: "private@example.invalid", module: "secret memo" },
    exception: { values: [{ type: "secret memo", value: "123-456-789012", mechanism: { type: "secret", description: "secret" } }] },
  });
  assert.deepEqual(safe.tags, {});
  assert.equal(safe.environment, "development");
  assert.equal(safe.release, undefined);
  assert.equal(safe.exception.values[0].type, "Error");
  assert.equal(safe.exception.values[0].mechanism.type, "generic");
  for (const type of ["transaction", "feedback", "replay_event", "profile"]) assert.equal(sanitizeMonitoringEvent({ type }), null);
});

test("final transport drops attachments/replay/body payloads and re-sanitizes error envelopes", async () => {
  const { event } = sensitiveEvent();
  const envelope = [{ event_id: event.event_id, trace: { transaction: "private memo" }, dsn: "private DSN", sdk: { name: "secret", version: "11.1.0", extra: "secret" } }, [
    [{ type: "event", filename: "private receipt" }, event],
    [{ type: "attachment", filename: "private receipt.jpg" }, new Uint8Array([1, 2, 3])],
    [{ type: "replay_recording" }, "receipt image"], [{ type: "log" }, { body: "secret" }],
    [{ type: "session" }, { user: "secret" }], [{ type: "transaction" }, { request: "secret" }],
  ]];
  const safe = sanitizeMonitoringEnvelope(envelope);
  assert.equal(safe[1].length, 1);
  assert.deepEqual(safe[1][0][0], { type: "event" });
  assert.equal(Number.isNaN(Date.parse(safe[0].sent_at)), false);
  assert.deepEqual(Object.keys(safe[0]).sort(), ["event_id", "sdk", "sent_at"]);
  assert.deepEqual(safe[0].sdk, { name: "sentry.javascript.react", version: "11.1.0", settings: { infer_ip: "never" } });
  const mock = sdkMock();
  createErrorMonitoring(mock.sdk).initializeErrorMonitoring(options);
  const transport = mock.initialized().transport({ url: "https://sentry.example.invalid", headers: { Authorization: "secret" }, fetchOptions: { credentials: "include" } });
  assert.equal(mock.fetchOptions().headers, undefined);
  assert.deepEqual(mock.fetchOptions().fetchOptions, { credentials: "omit", referrerPolicy: "no-referrer" });
  await transport.send(envelope);
  assert.equal(mock.calls.at(-1)[0], "send");
  assert.deepEqual(mock.calls.at(-1)[1][1], safe[1]);
  const callsBefore = mock.calls.length;
  await transport.send([{}, [[{ type: "attachment" }, "image-secret"]]]);
  assert.equal(mock.calls.length, callsBefore);
  assert.equal(sanitizeMonitoringEnvelope([{ event_id: "secret" }, [[{ type: "event" }, event]]]), null);
  assert.equal(await transport.flush(100), true);
});

test("real Sentry React boundary renders Korean fallback without exposing the error and reload works", () => {
  const element = AppErrorBoundary({ children: createElement("span", null, "ERP") });
  assert.equal(element.props.showDialog, false);
  assert.equal(element.props.onError, undefined, "do not double-capture in onError");
  const boundary = new element.type(element.props);
  boundary.setState = (patch) => { boundary.state = { ...boundary.state, ...patch }; };
  boundary.componentDidCatch(new Error("password=private-secret"), { componentStack: "\n at App" });
  const markup = renderToStaticMarkup(boundary.render());
  assert.match(markup, /role="alert"/);
  assert.match(markup, /화면을 불러오는 중 오류가 발생했습니다/);
  assert.match(markup, /새로고침/);
  assert.equal(markup.includes("private-secret"), false);
  let reloadCount = 0;
  const fallback = AppErrorFallback({ onReload: () => { reloadCount += 1; } });
  fallback.props.children.props.children[2].props.onClick();
  assert.equal(reloadCount, 1);
});
