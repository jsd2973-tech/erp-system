# ERP browser E2E setup

Playwright runs a production-mode Vite preview only at `http://127.0.0.1:4173` and is hard-pinned to the isolated Supabase project `nazyeklqgcygfuvzzgql` (`erp-dispatch-test`). The existing `npm run build`/`prebuild` chain runs unchanged inside a disposable copy, so generated prebuild patches do not alter the working tree. The guard rejects the production project `jqdvxmatbmmeubtoogvl` and any non-local browser base URL. The production ERP is never used as an E2E target.

The test project has the dispatch QA schema plus a test-only ERP bootstrap, the purchase payment migration, the maintenance-purchase link migration, and the current dispatch correction/company assignment migrations. `supabase/e2e/bootstrap.sql` is specific to the test project and must not be applied to production.

## Test account and environment

Create or use a dedicated Auth user in the test project. Add a matching `public.user_permissions` row with role `admin`. Use a test-only password. Do not reuse a production account or password. The test project may contain fictitious QA accounts only.

Set these variables in the shell or GitHub Actions repository secrets:

```text
E2E_SUPABASE_URL=https://nazyeklqgcygfuvzzgql.supabase.co
E2E_SUPABASE_ANON_KEY=<test project's publishable/anon key>
E2E_ADMIN_EMAIL=<dedicated test account>
E2E_ADMIN_PASSWORD=<test-only password>
E2E_BASE_URL=http://127.0.0.1:4173  # optional; local only
```

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

The current suite defines five browser tests: a purchase/payment desktop smoke, a purchase lookup mobile viewport smoke, a recent/previous unit-price regression with spec separation, and two purchase-to-maintenance quantity/link regressions. These include DB checks and detail-screen checks. Mobile smoke uses Playwright viewport/device emulation; it is not a physical-device test.

Each data-bearing test seeds uniquely prefixed vendor, warehouse and item records, then deletes only records associated with that test prefix/IDs in `finally`. It does not reset the shared test project. This first slice does not yet cover bulk-transfer workbook output, dispatch completion/corrections/results, card/fuel OCR mocks, or bid pagination mocks. OCR and external bid APIs are not called. GitHub Actions reports a clear skip when the dedicated test secrets are absent.
