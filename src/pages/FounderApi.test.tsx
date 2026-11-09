import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 예비 창업자 화면(입지 찾기·동네 리포트)의 API 모드. 서비스 구현은 import 시점에 mock | api 로 정해지므로
 * 환경 값을 바꾼 뒤 React·RTL·앱 모듈을 모두 새로 불러온다(HomeStartApi.test.tsx 와 같은 방식).
 */
type Rtl = typeof import('@testing-library/react');
let rtl: Rtl | null = null;

async function loadApp(source: 'mock' | 'api') {
  vi.stubEnv('VITE_DATA_SOURCE', source);
  vi.stubEnv('VITE_API_BASE_URL', source === 'api' ? 'https://api.test' : '');
  vi.resetModules();
  rtl = await import('@testing-library/react');
  const userEvent = (await import('@testing-library/user-event')).default;
  const { renderApp } = await import('@/test/renderApp');
  return { ...rtl, user: userEvent.setup(), renderApp };
}

/** 서버 업종 38개: 7 = FRUIT_VEG, 18 = SIDE_DISH */
const CATEGORIES = Array.from({ length: 38 }, (_, i) => {
  const id = i + 1;
  if (id === 7) return { id, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true };
  if (id === 18) return { id, code: 'SIDE_DISH', name: '반찬가게', martCheck: true };
  return { id, code: `CODE_${id}`, name: `업종${id}`, martCheck: false };
});
const RANK_ITEMS = [
  {
    rank: 1,
    dongId: 22,
    name: '구성동',
    requestCount: 29,
    sameCategoryStoreCount: 0,
    nearestMartKm: 2.4,
    score: 29,
  },
  {
    rank: 2,
    dongId: 28,
    name: '보정동',
    requestCount: 14,
    sameCategoryStoreCount: 2,
    nearestMartKm: 0.6,
    score: 4,
  },
  { rank: 3, dongId: 16, name: '영덕2동', requestCount: 0, sameCategoryStoreCount: 0, score: 0 },
];
const REPORT = {
  dong: { id: 22, name: '구성동', gu: '기흥구' },
  category: { id: 7, name: '과일·채소 가게' },
  stats: {
    requestCount: 29,
    walkStoreCount: 0,
    walkRadiusM: 1000,
    nearestMart: { name: '이마트 동백점', km: 2.4 },
    topTimeSlot: 'WEEKDAY_EVENING',
    topConditions: ['늦게까지 영업'],
    offers: { done: 0, orders: 0 },
  },
  explanation: { text: '구성동은 주민 요청이 29건이에요.', by: 'AI' },
  sources: [{ name: '상가 정보' }, { name: '대규모 점포 현황', asOf: '2026-05-07' }],
};

type Handler = (call: StubCall, init: RequestInit) => Response | Promise<Response>;
function stubServer(routes: { categories?: Handler; rankings?: Handler; report?: Handler } = {}) {
  return stubFetch((call, init) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.path === '/api/v1/categories') {
      return routes.categories?.(call, init) ?? jsonResponse(200, CATEGORIES);
    }
    if (call.path.startsWith('/api/v1/founder/rankings')) {
      return routes.rankings?.(call, init) ?? jsonResponse(200, { items: RANK_ITEMS });
    }
    if (call.path.startsWith('/api/v1/founder/report')) {
      return routes.report?.(call, init) ?? jsonResponse(200, REPORT);
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
/** 순위 섹션(제목 "요청은 많고 가게는 없는 동네") 안의 목록 */
const rankSection = (app: { screen: Rtl['screen']; within: Rtl['within'] }) =>
  app.within(
    app.screen
      .getByRole('heading', { level: 2, name: '요청은 많고 가게는 없는 동네' })
      .closest('section')!,
  );
const rankingCalls = (calls: StubCall[]) =>
  calls.filter((c) => c.path.startsWith('/api/v1/founder/rankings'));
const reportCalls = (calls: StubCall[]) =>
  calls.filter((c) => c.path.startsWith('/api/v1/founder/report'));

const FORBIDDEN_TEXT =
  '이 화면을 볼 수 있는 역할이 아니에요. 처음 화면에서 역할을 다시 선택해 주세요.';
const NOT_FOUND_TEXT = '선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.';
const NETWORK_TEXT = '네트워크 연결을 확인하고 다시 시도해 주세요.';

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('api 모드의 입지 찾기', () => {
  it('기본 업종(FRUIT_VEG)의 서버 순위를 서버 순서대로 보여주고 행은 숫자 id 리포트로 연결된다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/founder']);

    await app.screen.findByRole('link', { name: /1\. 구성동/ });
    const rows = rankSection(app).getAllByRole('link');
    // 요청 0명 동네(영덕2동)는 숨기므로 2행이다.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(/1\. 구성동, 요청 29명, 같은 업종 0곳, 대형마트 2\.4km/);
    expect(rows[1]).toHaveAccessibleName(/2\. 보정동, 요청 14명/);
    expect(rows[0]).toHaveAttribute('href', '/founder/areas/22/report?category=7');

    expect(rankingCalls(calls)).toHaveLength(1);
    expect(rankingCalls(calls)[0]?.path).toBe('/api/v1/founder/rankings?categoryId=7&limit=50');
  });

  it('서버 순위에는 좌표가 없어 마커가 0개이므로 지도 카드를 숨기고, 순위 목록은 정상이다', async () => {
    stubServer();
    const app = await loadApp('api');
    app.renderApp(['/founder']);
    await app.screen.findByRole('link', { name: /1\. 구성동/ });
    expect(rankSection(app).getAllByRole('link')).toHaveLength(2);

    expect(
      app.screen.queryByRole('region', { name: '입지 후보 지도(예시)' }),
    ).not.toBeInTheDocument();
    expect(app.screen.queryByText(/기준 동네 .*곳 표시 중/)).not.toBeInTheDocument();
  });

  it('업종 38개를 모두 선택지로 보여준다', async () => {
    stubServer();
    const app = await loadApp('api');
    app.renderApp(['/founder']);

    const select = await app.screen.findByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' });
    const options = app.within(select).getAllByRole('option');
    expect(options).toHaveLength(38);
    expect(select).toHaveDisplayValue('과일 / 채소 가게');
  });

  it('FRUIT_VEG 가 없으면 첫 업종이 기본이고, 올바르지 않은 ?category= 도 기본 업종이다', async () => {
    const { calls } = stubServer({
      categories: () =>
        jsonResponse(
          200,
          CATEGORIES.filter((c) => c.code !== 'FRUIT_VEG'),
        ),
    });
    const app = await loadApp('api');
    app.renderApp(['/founder?category=fruit-vegetable']);
    await app.screen.findByRole('link', { name: /1\. 구성동/ });

    expect(rankingCalls(calls)[0]?.path).toContain('categoryId=1&');
  });

  it('업종을 바꾸면 새 순위를 불러오고, 이전 업종의 낡은 응답은 취소되어 덮어쓰지 않는다', async () => {
    const releases: ((r: Response) => void)[] = [];
    const signals: (AbortSignal | null | undefined)[] = [];
    const { calls } = stubServer({
      rankings: (call, init) => {
        if (call.path.includes('categoryId=7&')) {
          signals.push(init.signal);
          return new Promise<Response>((resolve) => releases.push(resolve));
        }
        return jsonResponse(200, {
          items: [
            { rank: 1, dongId: 28, name: '보정동', requestCount: 5, sameCategoryStoreCount: 1 },
          ],
        });
      },
    });
    const app = await loadApp('api');
    app.renderApp(['/founder']);
    await app.waitFor(() => expect(releases).toHaveLength(1));

    await app.user.selectOptions(
      await app.screen.findByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' }),
      '18',
    );

    expect(await app.screen.findByRole('link', { name: /1\. 보정동/ })).toBeInTheDocument();
    expect(rankingCalls(calls).map((c) => c.path)).toEqual([
      '/api/v1/founder/rankings?categoryId=7&limit=50',
      '/api/v1/founder/rankings?categoryId=18&limit=50',
    ]);
    expect(signals[0]?.aborted).toBe(true);
    releases[0]!(jsonResponse(200, { items: RANK_ITEMS }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(app.screen.queryByRole('link', { name: /구성동/ })).not.toBeInTheDocument();
    expect(app.screen.getAllByRole('link', { name: /보정동/ })).toHaveLength(1);
  });

  it('빈 순위는 기존의 빈 상태 안내를 보여준다', async () => {
    stubServer({ rankings: () => jsonResponse(200, { items: [] }) });
    const app = await loadApp('api');
    app.renderApp(['/founder']);

    expect(await app.screen.findByText('아직 요청이 없는 업종이에요')).toBeInTheDocument();
  });

  it.each([
    [
      '403 FORBIDDEN',
      () => jsonResponse(403, { code: 'FORBIDDEN', message: '서버 원문' }),
      FORBIDDEN_TEXT,
    ],
    [
      '404 NOT_FOUND',
      () => jsonResponse(404, { code: 'NOT_FOUND', message: '서버 원문' }),
      NOT_FOUND_TEXT,
    ],
    [
      '네트워크 오류',
      () => {
        throw new TypeError('Failed to fetch');
      },
      NETWORK_TEXT,
    ],
  ])(
    '%s 이면 코드별 문구를 보여준다(서버 message 는 쓰지 않는다)',
    async (_name, rankings, text) => {
      stubServer({ rankings });
      const app = await loadApp('api');
      app.renderApp(['/founder']);

      expect(await app.screen.findByText(text)).toBeInTheDocument();
      expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
      expect(app.screen.getByText('데이터를 가져오지 못했어요')).toBeInTheDocument();
    },
  );
});

describe('api 모드의 동네 리포트', () => {
  it('서버 수치·설명·근거를 보여주고 "예시" 표시는 없다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/founder/areas/22/report?category=7']);

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '구성동 / 과일 가게' }),
    ).toBeInTheDocument();
    expect(app.screen.getByText('29명')).toBeInTheDocument();
    expect(app.screen.getByText('0곳')).toBeInTheDocument();
    expect(app.screen.getByText('2.4km')).toBeInTheDocument();
    expect(app.screen.getByText('평일 저녁')).toBeInTheDocument();
    expect(await app.screen.findByText('구성동은 주민 요청이 29건이에요.')).toBeInTheDocument();
    expect(app.screen.getByText('상가 정보')).toBeInTheDocument();
    expect(app.screen.getByText('대규모 점포 현황 (2026-05-07)')).toBeInTheDocument();
    expect(app.screen.queryByText(/개발용 예시 데이터/)).not.toBeInTheDocument();
    expect(app.screen.queryByText(/예시 문장/)).not.toBeInTheDocument();
    expect(app.screen.getByText('숫자는 서버가 계산하고, 문장만 AI가 써요')).toBeInTheDocument();
    expect(reportCalls(calls)[0]?.path).toBe('/api/v1/founder/report?dongId=22&categoryId=7');
  });

  it('설명의 출처가 AI 가 아니면(TEMPLATE) 안내 문구를 바꾼다', async () => {
    stubServer({
      report: () => jsonResponse(200, { ...REPORT, explanation: { text: '문장', by: 'TEMPLATE' } }),
    });
    const app = await loadApp('api');
    app.renderApp(['/founder/areas/22/report?category=7']);

    expect(await app.screen.findByText('숫자와 문장 모두 서버가 만들어요')).toBeInTheDocument();
  });

  it('요청이 없어 시간대가 null 이면 "정보 없음"이고, 대형마트 정보가 없어도 깨지지 않는다', async () => {
    stubServer({
      report: () =>
        jsonResponse(200, {
          ...REPORT,
          stats: { ...REPORT.stats, requestCount: 0, topTimeSlot: null, nearestMart: null },
        }),
    });
    const app = await loadApp('api');
    app.renderApp(['/founder/areas/22/report?category=7']);

    await app.screen.findByRole('heading', { level: 1, name: '구성동 / 과일 가게' });
    expect(app.screen.getAllByText('정보 없음')).toHaveLength(2);
  });

  it('설명 문장이 없으면 문장 카드만 실패 안내이고 수치는 그대로 보인다', async () => {
    stubServer({ report: () => jsonResponse(200, { ...REPORT, explanation: null }) });
    const app = await loadApp('api');
    app.renderApp(['/founder/areas/22/report?category=7']);

    expect(await app.screen.findByText('문장을 불러오지 못했어요.')).toBeInTheDocument();
    expect(app.screen.getByText('29명')).toBeInTheDocument();
  });

  it('동네 id 가 숫자가 아니면 요청 없이 기존의 "찾을 수 없음" 안내를 보여준다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/founder/areas/guseong/report?category=7']);

    expect(await app.screen.findByText('찾을 수 없는 동네예요')).toBeInTheDocument();
    expect(app.screen.getByRole('link', { name: '입지 찾기로' })).toHaveAttribute(
      'href',
      '/founder?category=7',
    );
    expect(reportCalls(calls)).toHaveLength(0);
  });

  it.each([
    [
      '404 NOT_FOUND',
      () => jsonResponse(404, { code: 'NOT_FOUND', message: '서버 원문' }),
      NOT_FOUND_TEXT,
    ],
    [
      '403 FORBIDDEN',
      () => jsonResponse(403, { code: 'FORBIDDEN', message: '서버 원문' }),
      FORBIDDEN_TEXT,
    ],
    [
      '네트워크 오류',
      () => {
        throw new TypeError('Failed to fetch');
      },
      NETWORK_TEXT,
    ],
  ])('%s 이면 코드별 문구를 보여준다', async (_name, report, text) => {
    stubServer({ report });
    const app = await loadApp('api');
    app.renderApp(['/founder/areas/9999/report?category=7']);

    expect(await app.screen.findByText(text)).toBeInTheDocument();
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
  });
});

describe('mock 모드', () => {
  it('네트워크 없이 기존 목 데이터로 입지 찾기·리포트를 보여준다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    const app = await loadApp('mock');
    app.renderApp(['/founder']);

    await app.screen.findAllByRole('link', { name: /^1\. / });
    expect(rankSection(app).getAllByRole('link').length).toBeGreaterThan(0);
    expect(
      app.screen.getByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' }),
    ).toHaveDisplayValue('과일 / 채소 가게');

    app.cleanup();
    app.renderApp(['/founder/areas/guseong/report']);
    expect(
      await app.screen.findByRole('heading', { level: 1, name: '구성동 / 과일 가게' }),
    ).toBeInTheDocument();
    expect(app.screen.getByText(/개발용 예시 데이터/)).toBeInTheDocument();
    expect(app.screen.getByText('예시 문장 · AI 연동 예정')).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});
