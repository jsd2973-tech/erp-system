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

const rangedRequest = (from, to) => new Request('https://erp.test/api/g2b?' + new URLSearchParams({
  include: '골재', exclude: '순환골재', from, to,
}));

const parseDateKey = (key) => new Date(`${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}T00:00:00Z`);

for (const days of [7, 8, 30, 90]) {
  test(`나라장터 ${days}일 조회는 7일 제한 안에서 전 기간을 합치고 중복을 제거한다`, async () => {
    const to = new Date('2026-11-11T00:00:00Z');
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    const requests = [];
    const result = await withMockedFetch({ G2B_SERVICE_KEY: 'E2E-MOCK-KEY' }, async (input) => {
      const url = new URL(String(input));
      const begin = url.searchParams.get('inqryBgnDt');
      const end = url.searchParams.get('inqryEndDt');
      requests.push({ path: url.pathname, begin, end });
      // The real service can return HTTP 200 with an error outside response.header.
      if (parseDateKey(end) - parseDateKey(begin) >= 7 * 86400000) {
        return Response.json({ header: { resultCode: '11', resultMsg: '조회기간은 7일 이내여야 합니다.' } });
      }
      if (!url.pathname.includes('Cnstwk')) return g2bPage();
      const noticeDate = parseDateKey(begin).toISOString().slice(0, 10) + ' 09:00:00';
      return g2bPage([
        { ...g2bItem('RANGE-' + begin), bidNtceDt: noticeDate },
        g2bItem('DUP-ACROSS-RANGES'),
        g2bItem('EXCLUDED', '순환골재 운송'),
      ]);
    }, () => g2bHandler.fetch(rangedRequest(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10))));

    assert.equal(result.status, 200);
    const payload = await result.json();
    const rangeCount = Math.ceil(days / 7);
    assert.equal(payload.notices.length, rangeCount + 1);
    assert.equal(payload.notices.filter((notice) => notice.bidNo === 'DUP-ACROSS-RANGES').length, 1);
    assert.equal(payload.notices.some((notice) => notice.bidNo === 'EXCLUDED'), false);
    assert.equal(payload.sourceStatus.g2b.status, 'normal');
    assert.equal(requests.length, rangeCount * 4);
    for (const path of new Set(requests.map((request) => request.path))) {
      let cursor = from.getTime();
      const ranges = requests.filter((request) => request.path === path).sort((a, b) => a.begin.localeCompare(b.begin));
      for (const range of ranges) {
        const start = parseDateKey(range.begin).getTime();
        const end = parseDateKey(range.end).getTime();
        assert.equal(start, cursor, '날짜 사이에 누락이나 겹침이 없어야 한다');
        assert.ok(end >= start && end - start < 7 * 86400000);
        assert.ok(range.begin.endsWith('0000') && range.end.endsWith('2359'));
        cursor = end + 86400000;
      }
      assert.equal(cursor, to.getTime() + 86400000);
    }
    const dates = payload.notices.map((notice) => notice.noticeDate);
    assert.deepEqual(dates, [...dates].sort((a, b) => b.localeCompare(a)));
  });
}

test('7일 구간 하나가 실패해도 나머지 공고를 유지하고 일부 조회로 보고한다', async () => {
  const result = await withMockedFetch({ G2B_SERVICE_KEY: 'E2E-MOCK-KEY' }, async (input) => {
    const url = new URL(String(input));
    const begin = url.searchParams.get('inqryBgnDt');
    if (begin === '202611010000') {
      return Response.json({ header: { resultCode: '11', resultMsg: '일시적인 조회 오류' } });
    }
    return url.pathname.includes('Cnstwk') ? g2bPage([g2bItem('RANGE-' + begin)]) : g2bPage();
  }, () => g2bHandler.fetch(rangedRequest('2026-10-25', '2026-11-11')));

  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.notices.length, 2);
  assert.equal(payload.sourceStatus.g2b.status, 'partial');
  assert.equal(payload.diagnostics.failedCalls, 4);
  assert.equal(payload.partial, true);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('제목 결과가 없어 전체검색을 할 때도 모든 요청을 7일 이내로 나눈다', async () => {
  const requests = [];
  const result = await withMockedFetch({ G2B_SERVICE_KEY: 'E2E-MOCK-KEY' }, async (input) => {
    const url = new URL(String(input));
    const begin = url.searchParams.get('inqryBgnDt');
    const end = url.searchParams.get('inqryEndDt');
    requests.push(url);
    assert.ok(parseDateKey(end) - parseDateKey(begin) < 7 * 86400000);
    if (url.searchParams.has('bidNtceNm') || !url.pathname.includes('Thng')) return g2bPage();
    return g2bPage([{ ...g2bItem('DETAIL-' + begin, '관급자재 구매'), dtilPrdctClsfcNoNm: '골재' }]);
  }, () => g2bHandler.fetch(rangedRequest('2026-10-13', '2026-11-11')));

  const payload = await result.json();
  assert.equal(result.status, 200);
  assert.equal(payload.notices.length, 5);
  assert.equal(requests.filter((url) => !url.searchParams.has('bidNtceNm')).length, 20);
  assert.equal(payload.sourceStatus.g2b.status, 'normal');
});

for (const payload of [
  { header: { resultCode: '11', resultMsg: '조회기간 오류' } },
  {},
  { response: { header: { resultCode: '00' } } },
  { response: { header: { resultCode: '00' }, body: { totalCount: 1, items: [] } } },
]) {
  test(`나라장터 비정상 응답을 정상 0건으로 숨기지 않는다: ${JSON.stringify(payload)}`, async () => {
    const result = await withMockedFetch({ G2B_SERVICE_KEY: 'E2E-MOCK-KEY' }, async () => Response.json(payload),
      () => g2bHandler.fetch(apiRequest()));
    assert.equal(result.status, 502);
    assert.ok((await result.json()).error);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  });
}

test('정상 빈 응답은 오류로 바꾸지 않고 0건으로 유지한다', async () => {
  const result = await withMockedFetch({ G2B_SERVICE_KEY: 'E2E-MOCK-KEY' }, async () => g2bPage(),
    () => g2bHandler.fetch(apiRequest()));
  const payload = await result.json();
  assert.equal(result.status, 200);
  assert.deepEqual(payload.notices, []);
  assert.equal(payload.sourceStatus.g2b.status, 'normal');
});

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
