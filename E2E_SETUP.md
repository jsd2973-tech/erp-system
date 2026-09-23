# ERP browser E2E setup

Playwright runs a production-mode Vite preview only at `http://127.0.0.1:4173` and is hard-pinned to the isolated Supabase project `nazyeklqgcygfuvzzgql` (`erp-dispatch-test`). The existing `npm run build`/`prebuild` chain runs unchanged inside a disposable copy, so generated prebuild patches do not alter the working tree. The guard rejects the production project `jqdvxmatbmmeubtoogvl` and any non-local browser base URL. The production ERP is never used as an E2E target.

The test project has the dispatch QA schema plus a test-only ERP bootstrap, the purchase payment migration, the maintenance-purchase link migration, and the current dispatch correction/company assignment migrations. `supabase/e2e/bootstrap.sql` is specific to the test project and must not be applied to production.

## Test account and environment

Create or use a dedicated Auth user in the test project. Add a matching `public.user_permissions` row with role `admin`. Use a test-only password. Do not reuse a production account or password. The test project may contain fictitious QA accounts only.

For the dispatch regression, the admin test user must also be authorized for dispatch registration/status/results and trip correction (normally by its existing row in `dispatch_admin_users`). The isolated test project's setup must already include the dispatch QA schema and latest dispatch migrations. No schema changes are performed by browser tests.

Set these variables in the shell or GitHub Actions repository secrets:

```text
E2E_SUPABASE_URL=https://nazyeklqgcygfuvzzgql.supabase.co
E2E_SUPABASE_ANON_KEY=<test project's publishable/anon key>
E2E_ADMIN_EMAIL=<dedicated test account>
E2E_ADMIN_PASSWORD=<test-only password>
E2E_DRIVER_EMAIL=<dedicated test-only dispatch driver>
E2E_DRIVER_PASSWORD=<test-only password>
E2E_BASE_URL=http://127.0.0.1:4173  # optional; local only
```

`E2E_DRIVER_EMAIL` and `E2E_DRIVER_PASSWORD` are an optional pair for the dispatch mobile browser regression. Use a fictitious Auth user in the isolated test project (the dispatch QA setup names `qa.mobile.driver@example.com`). It must not have a `user_permissions` row, so `DispatchAuthGate` presents the driver app. Its `dispatch_drivers` row must be active and linked to an active test vehicle through `assigned_vehicle_id`. The test reuses that driver and vehicle without modifying either row, creates only a uniquely prefixed dispatch order, and removes only that order and its trips during cleanup. This follows the existing RLS permissions without granting vehicle-management access to the E2E admin. If the pair is absent, Playwright reports the dispatch browser test as skipped while the other browser tests still run.

No service-role key is used by the E2E code. Both the safety guard and preview server reject Supabase secret/service-role keys before building. The browser bundle receives only the dedicated test project URL, a publishable/anon key, and the test login ID. The password stays in Node-side test processes and is never copied into the browser bundle. The global setup signs in, checks the test-project marker and `admin` role, and confirms the required tables are reachable before the test fixtures run.

For local use, store values in an ignored local environment file or export them from a secret manager. Never commit credentials. Install Chromium once with `npx playwright install chromium`.

## Commands

```sh
npm run test:unit
npm run test:e2e:smoke
npm run test:e2e:regression
npm run test:e2e:mobile
npm run test:e2e:typecheck
npm run test:e2e
```

The suite defines 12 browser test invocations across projects (9 desktop, 3 mobile viewport): purchase/payment, unit-price history, purchase-to-maintenance link, maintenance trash restore, linked-purchase edit protection, bulk-transfer workbook structure, dispatch mobile completion/GPS/corrections/results, fuel OCR mock, bidding partial-result/filter, mobile purchase lookup, and card OCR mock. Purchase, maintenance, dispatch, and fuel checks include test-DB assertions where the flow writes data. The card and fuel OCR flows leave the business record unsaved. Mobile smoke uses Playwright viewport/device emulation; it is not a physical-device test.

Each data-bearing test seeds uniquely prefixed records, then deletes only records associated with that test prefix/IDs in `finally`. The dispatch fixture leaves its pre-provisioned QA driver and vehicle unchanged and removes only its uniquely identified order and trips through the existing cleanup flow. The shared test project is never reset. Node-side API tests mock external G2B/LH responses to cover pagination, duplicate removal, filters, and partial failure; they do not call the real services. Google Vision is not called: browser OCR tests mock `/api/receipt-ocr`. GitHub Actions reports when base E2E secrets are absent and the browser job skips; dispatch coverage is separately reported as skipped unless the test-only driver credential pair is configured.
