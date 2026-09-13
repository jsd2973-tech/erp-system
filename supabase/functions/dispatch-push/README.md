# Dispatch push

Additive infrastructure for new orders, quantity changes and cancellations. No existing RPC or RLS definition is replaced. Deferred order triggers observe final vehicle assignments. Only opted-in dispatch administrators and active linked drivers receive events. Capture failures warn without failing the business transaction.

`dispatch-push` verifies user tokens with `getUser`; its gateway JWT check is disabled to support publishable-key clients and the separate worker token. Device data and VAPID configuration are service-only with RLS and no client grants. The scheduler invokes the worker only when pending deliveries exist. Tokens and private keys must never be committed. The first authorized configuration request generates the VAPID pair once, with race-safe insertion.

Delivery runs each minute, claims up to 30 jobs, retries up to five times with a five-minute lease, expires messages after a day and removes 404/410 endpoints. A crash after sending but before recording success can retry; the notification tag reduces visible duplicates. Delivery acceptance is not proof that the user read a notification.

Notifications display the event title, customer, item and quantity in the OS notification, as requested. Opening further ERP details still requires login and existing RLS. Clicking focuses an existing ERP window without navigating or refreshing it. Logout unsubscribes the browser, and the worker rejects removed/expired sessions. Network/device/OS settings can delay or suppress delivery.

Validation: `npm run build`, `node --test tests/transport-results.test.mjs`, and transactional `tests/dispatch-push.sql`. Physical push receipt still requires a signed-in phone with notification permission. Use More > notification settings > enable > test on my device. Preview domains have separate subscriptions; moving to a different domain requires registration again.

## Per-account notification choices and trip progress

Each account can save new-order, quantity-change, cancellation and trip-progress preferences. Existing three kinds default on; the new trip-progress kind defaults off. The Edge Function binds settings reads/writes to the validated user id. Queued messages recheck preferences before sending.

A new completion event is captured once per trip id. The worker reads a fresh SQL aggregate of all committed completed trips for the order, so multiple drivers never decrement a separate counter. Notifications show the latest delivery-time aggregate (multiple completions within one scheduler interval can show the same latest total), remaining volume and estimated trips at the order's per-trip volume. Over-delivery is shown explicitly. Existing save/complete RPCs are unchanged. Tests: `node --test tests/push-preferences.test.mjs` and rollback-only `tests/push-progress.sql`.
