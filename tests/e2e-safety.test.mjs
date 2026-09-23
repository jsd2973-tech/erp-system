import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../e2e/safety.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { readE2EEnvironment, sanitizeSupabaseDiagnostic } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const defaults = {
  E2E_BASE_URL: 'http://127.0.0.1:4173',
  E2E_SUPABASE_URL: 'https://nazyeklqgcygfuvzzgql.supabase.co',
  E2E_SUPABASE_ANON_KEY: 'sb_publishable_e2e_test_key',
  E2E_ADMIN_EMAIL: 'e2e@example.invalid',
  E2E_ADMIN_PASSWORD: randomBytes(16).toString('hex'),
};

const withEnvironment = (overrides, callback) => {
  const previous = Object.fromEntries(Object.keys(defaults).map((key) => [key, process.env[key]]));
  Object.assign(process.env, defaults, overrides);
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('accepts only the dedicated local E2E target and a publishable key', () => {
  const env = withEnvironment({}, () => readE2EEnvironment());
  assert.equal(new URL(env.supabaseURL).hostname, 'nazyeklqgcygfuvzzgql.supabase.co');
  assert.equal(env.baseURL, 'http://127.0.0.1:4173');
});

test('rejects production Supabase before any test fixture can connect', () => {
  assert.throws(
    () => withEnvironment({ E2E_SUPABASE_URL: 'https://jqdvxmatbmmeubtoogvl.supabase.co' }, () => readE2EEnvironment()),
    /rejected the production Supabase project/,
  );
});

test('rejects a service-role key before it can enter the browser build', () => {
  const serviceRoleJwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(
    () => withEnvironment({ E2E_SUPABASE_ANON_KEY: serviceRoleJwt }, () => readE2EEnvironment()),
    /publishable\/anon key/,
  );
});

test('rejects remote browser targets and non-test Supabase projects', () => {
  assert.throws(
    () => withEnvironment({ E2E_BASE_URL: 'https://taemyung-erp.vercel.app' }, () => readE2EEnvironment()),
    /local Playwright Vite server/,
  );
  assert.throws(
    () => withEnvironment({ E2E_SUPABASE_URL: 'https://different.supabase.co' }, () => readE2EEnvironment()),
    /dedicated test Supabase project/,
  );
});

test('sanitizes marker diagnostics before they are written to workflow logs', () => {
  const email = 'e2e-admin@example.invalid';
  const password = 'test-only-password-123';
  const anonKey = 'sb_publishable_test_key_123';
  const accessToken = `eyJ${Buffer.from(JSON.stringify({ sub: 'test-user' })).toString('base64url')}.payload.signature`;
  const diagnostic = sanitizeSupabaseDiagnostic({
    code: 'PGRST116',
    message: `query for ${email} failed; bearer ${accessToken}`,
    details: `key=${anonKey}; password=${password}; phone=+1 (555) 010-1234`,
    hint: 'request referenced 123e4567-e89b-12d3-a456-426614174000',
  }, [email, password, anonKey, accessToken]);

  assert.equal(diagnostic.code, 'PGRST116');
  const serialized = JSON.stringify(diagnostic);
  for (const secret of [email, password, anonKey, accessToken, '555) 010-1234', '123e4567-e89b-12d3-a456-426614174000']) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.match(diagnostic.message, /query for \[redacted\] failed/);
  assert.match(diagnostic.details, /key=\[redacted\]/);
  assert.match(diagnostic.details, /\[redacted-phone\]/);
  assert.match(diagnostic.hint, /\[redacted-id\]/);

  const genericEmail = sanitizeSupabaseDiagnostic({ message: 'contact support@example.invalid' });
  assert.match(genericEmail.message, /contact \[redacted-email\]/);
});
