import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const loadHandler = async (filePath) => {
  const source = fs.readFileSync(new URL(filePath, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
};

const g2bHandler = await loadHandler('../api/g2b.ts');
const lhHandler = await loadHandler('../api/lh.ts');

const withMockedFetch = async (env, fetchMock, callback) => {
  const originalFetch = globalThis.fetch;
  const previousEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  globalThis.fetch = fetchMock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const apiRequest = () => new Request('https://erp.test/api/notices?include=%EA%B3%A8%EC%9E%AC&exclude=%EC%88%9C%ED%99%98%EA%B3%A8%EC%9E%AC&from=2026-09-23&to=2026-09-23');

const g2bItem = (bidNtceNo, bidNtceNm = '골재 운송') => ({
  bidNtceNo,
  bidNtceOrd: '000',
  bidNtceNm,
  bidNtceDt: '2026-09-23 09:00:00',
  bidClseDt: '2026-09-24 17:00:00',
  dminsttNm: '대전시청',
  prtcptLmtRgnNm: '대전광역시',
  asignBdgtAmt: '1285000',
  bidNtceDtlUrl: `https://example.invalid/${bidNtceNo}`,
});

const g2bPage = (items = [], totalCount = items.length) => new Response(JSON.stringify({
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
    body: { items, totalCount, numOfRows: 100 },
  },
}), { status: 200 });

test('나라장터 2페이지까지 가져오고 페이지 간 중복을 제거한다', async () => {
  const requestedPages = [];
  const response = await withMockedFetch({ G2B_SERVICE_KEY: 'E2E-MOCK-KEY' }, async (input) => {
    const url = new URL(String(input));
    const pageNo = Number(url.searchParams.get('pageNo'));
    requestedPages.push({ path: url.pathname, pageNo });
    if (!url.pathname.includes('getBidPblancListInfoCnstwkPPSSrch')) return g2bPage();
    if (pageNo === 1) return g2bPage([g2bItem('DUP-1'), g2bItem('EXCLUDED', '순환골재 운송')], 101);
    return g2bPage([g2bItem('PAGE-2'), g2bItem('DUP-1')], 101);
  }, async () => {
    const result = await g2bHandler.fetch(apiRequest());
    assert.equal(result.status, 200);
    return result.json();
  });

  assert.ok(requestedPages.some((request) => request.pageNo === 2));
  assert.equal(response.notices.length, 2);
  assert.deepEqual(response.notices.map((notice) => notice.id).sort(), ['DUP-1-000', 'PAGE-2-000']);
  assert.equal(response.sourceStatus.g2b.status, 'normal');
  assert.equal(response.diagnostics.partial, false);
});

test('나라장터 2페이지 오류는 일부 조회 상태로 보고한다', async () => {
  const response = await withMockedFetch({ G2B_SERVICE_KEY: 'E2E-MOCK-KEY' }, async (input) => {
    const url = new URL(String(input));
    const pageNo = Number(url.searchParams.get('pageNo'));
    if (!url.pathname.includes('getBidPblancListInfoCnstwkPPSSrch')) return g2bPage();
    if (pageNo === 2) throw new Error('mock page 2 failure');
    return g2bPage([g2bItem('PAGE-1')], 101);
  }, async () => {
    const result = await g2bHandler.fetch(apiRequest());
    assert.equal(result.status, 200);
    return result.json();
  });

  assert.equal(response.notices.length, 1);
  assert.equal(response.partial, true);
  assert.equal(response.sourceStatus.g2b.status, 'partial');
  assert.equal(response.diagnostics.failedPages, 1);
});

test('LH 2페이지 결과를 포함해 공고를 합친다', async () => {
  const requestedPages = [];
  const response = await withMockedFetch({ LH_SERVICE_KEY: 'E2E-MOCK-KEY' }, async (input) => {
    const url = new URL(String(input));
    const pageNo = Number(url.searchParams.get('pageNo'));
    requestedPages.push(pageNo);
    const item = pageNo === 1
      ? '<item><bidNum>LH-1</bidNum><bidDegree>00</bidDegree><cstrtnJobGbNm>용역</cstrtnJobGbNm><bidnmKor>골재 운송 1</bidnmKor><zoneHqCd>대전지역본부</zoneHqCd><tndrbidRegDt>20260923</tndrbidRegDt><tndrdocAcptEndDtm>2026/09/24 17:00</tndrdocAcptEndDtm><fdmtlAmt>100000</fdmtlAmt></item>'
      : '<item><bidNum>LH-2</bidNum><bidDegree>00</bidDegree><cstrtnJobGbNm>용역</cstrtnJobGbNm><bidnmKor>골재 운송 2</bidnmKor><zoneHqCd>대전지역본부</zoneHqCd><tndrbidRegDt>20260923</tndrbidRegDt><tndrdocAcptEndDtm>2026/09/25 17:00</tndrdocAcptEndDtm><fdmtlAmt>200000</fdmtlAmt></item>';
    return new Response(`<response><header><resultCode>00</resultCode><resultMsg>정상</resultMsg></header><body><items>${item}</items><totalCount>101</totalCount><numOfRows>100</numOfRows></body></response>`, { status: 200 });
  }, async () => {
    const result = await lhHandler.fetch(apiRequest());
    assert.equal(result.status, 200);
    return result.json();
  });

  assert.ok(requestedPages.includes(2));
  assert.equal(response.notices.length, 2);
  assert.deepEqual(response.notices.map((notice) => notice.id).sort(), ['lh-LH-1-00', 'lh-LH-2-00']);
  assert.equal(response.sourceStatus.lh.status, 'normal');
});
