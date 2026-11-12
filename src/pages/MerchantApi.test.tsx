import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 사장님 화면(수요 지도·목록, 동네 상세)의 API 모드. 서비스 구현은 import 시점에 mock | api 로 정해지므로
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

const DONGS = [
  { id: 22, name: '구성동', gu: '기흥구' },
  { id: 23, name: '마북동', gu: '기흥구' },
  { id: 28, name: '보정동', gu: '기흥구' },
];
const CATEGORIES = [{ id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true }];
const SHOP = {
  shopName: '싱싱과일',
  category: { id: 7, name: '과일·채소 가게' },
  dong: { id: 23, name: '마북동' },
  lat: 37.3108,
  lon: 127.1398,
};
const ME = { id: 54, nickname: '데모', role: 'OWNER', dong: null, shop: SHOP };
const AREAS = [
  {
    dongId: 22,
    name: '구성동',
    requestCount: 29,
    distanceKm: 2,
    topTimeSlot: 'WEEKDAY_EVENING',
    sameCategoryStoreCount: 0,
    center: { lat: 37.2979, lon: 127.1054 },
  },
  {
    dongId: 28,
    name: '보정동',
    requestCount: 14,
    distanceKm: 2.8,
    topTimeSlot: 'WEEKEND',
    sameCategoryStoreCount: 2,
    center: { lat: 37.3, lon: 127.12 },
  },
  {
    dongId: 23,
    name: '마북동',
    requestCount: 9,
    distanceKm: 2.6,
    topTimeSlot: 'WEEKDAY_DAY',
    sameCategoryStoreCount: 3,
    center: { lat: 37.31, lon: 127.14 },
  },
];
const DETAIL = {
  dong: { id: 22, name: '구성동' },
  category: { id: 7, name: '과일·채소 가게' },
  requestCount: 29,
  sameCategoryStoreCount: 0,
  conditions: [
    { code: 'LATE_OPEN', label: '늦게까지 영업', count: 17 },
    { code: 'SMALL_QTY', label: '낱개 구매', count: 10 },
    { code: 'DELIVERY', label: '배달', count: 7 },
  ],
  timeSlots: [
    { slot: 'WEEKDAY_EVENING', count: 17, ratio: 0.59 },
    { slot: 'WEEKEND', count: 9, ratio: 0.31 },
    { slot: 'WEEKDAY_DAY', count: 3, ratio: 0.1 },
  ],
  summary: { text: '구성동에서는 과일·채소 가게를 찾는 주민이 29명이에요.', by: 'AI' },
};

type Handler = (call: StubCall, init: RequestInit) => Response | Promise<Response>;
function stubServer(routes: { me?: Handler; demand?: Handler; detail?: Handler } = {}) {
  return stubFetch((call, init) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.path === '/api/v1/me') return routes.me?.(call, init) ?? jsonResponse(200, ME);
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (call.path.startsWith('/api/v1/owner/demand/')) {
      return routes.detail?.(call, init) ?? jsonResponse(200, DETAIL);
    }
    if (call.path.startsWith('/api/v1/owner/demand')) {
      return routes.demand?.(call, init) ?? jsonResponse(200, { radiusKm: 3, areas: AREAS });
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const demandCalls = (calls: StubCall[]) =>
  calls.filter((c) => /^\/api\/v1\/owner\/demand(\?|$)/.test(c.path));

const FORBIDDEN_TEXT =
  '이 화면을 볼 수 있는 역할이 아니에요. 처음 화면에서 역할을 다시 선택해 주세요.';
const NOT_FOUND_TEXT = '선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.';
const NETWORK_TEXT = '네트워크 연결을 확인하고 다시 시도해 주세요.';
const NO_SHOP_TITLE = '아직 등록된 가게가 없어요';

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

type App = Awaited<ReturnType<typeof loadApp>>;
const areaList = (app: App) =>
  app.within(
    app.screen
      .getByRole('heading', { level: 1, name: '내 업종을 원하는 동네' })
      .closest('section')!,
  );

describe('api 모드의 사장님 수요 화면', () => {
  it('서버 가게 정보와 동네 목록(서버 순서·거리)을 보여준다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/merchant']);

    expect(await app.screen.findByText('싱싱과일 · 과일·채소 가게')).toBeInTheDocument();
    const rows = await areaList(app).findAllByRole('link');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName(
      /구성동, 요청 29명, 2\.0km, 평일 저녁이 많아요, 근처 같은 업종 0곳/,
    );
    expect(rows[1]).toHaveAccessibleName(/보정동, 요청 14명, 2\.8km, 주말이 많아요/);
    expect(rows[0]).toHaveAttribute('href', '/merchant/areas/22');
    // 기본 반경 3km 는 서버 파라미터로 보낸다.
    expect(demandCalls(calls).map((c) => c.path)).toContain('/api/v1/owner/demand?radiusKm=3');
  });

  it('반경 칩을 바꾸면 서버 파라미터로 다시 요청한다(5km → radiusKm=5, 기흥구 전체 → gu)', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/merchant']);
    await areaList(app).findAllByRole('link');

    await app.user.click(app.screen.getByRole('radio', { name: '5km 안' }));
    await app.waitFor(() =>
      expect(demandCalls(calls).map((c) => c.path)).toContain('/api/v1/owner/demand?radiusKm=5'),
    );
    await app.user.click(app.screen.getByRole('radio', { name: '기흥구 전체' }));
    await app.waitFor(() =>
      expect(demandCalls(calls).map((c) => c.path)).toContain(
        `/api/v1/owner/demand?gu=${encodeURIComponent('기흥구')}`,
      ),
    );
  });

  it('반경을 바꾸면 이전 반경의 낡은 응답은 취소되어 목록을 덮어쓰지 않는다', async () => {
    const releases: ((r: Response) => void)[] = [];
    const signals: (AbortSignal | null | undefined)[] = [];
    stubServer({
      demand: (call, init) => {
        if (call.path.includes('radiusKm=3')) {
          // 지도 데이터(gu 요청)는 즉시, 3km 목록은 끝까지 늦게 온다.
          signals.push(init.signal);
          return new Promise<Response>((resolve) => releases.push(resolve));
        }
        return jsonResponse(200, { radiusKm: 5, areas: [AREAS[1]!] });
      },
    });
    const app = await loadApp('api');
    app.renderApp(['/merchant']);
    await app.waitFor(() => expect(releases).toHaveLength(1));

    await app.user.click(app.screen.getByRole('radio', { name: '5km 안' }));

    expect(await areaList(app).findByRole('link', { name: /보정동/ })).toBeInTheDocument();
    expect(signals[0]?.aborted).toBe(true);
    releases[0]!(jsonResponse(200, { radiusKm: 3, areas: AREAS }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(areaList(app).queryByRole('link', { name: /구성동/ })).not.toBeInTheDocument();
    expect(areaList(app).getAllByRole('link')).toHaveLength(1);
  });

  it('지도: 내 가게 핀과 서버 좌표가 있는 동네 알약만 그린다', async () => {
    stubServer({
      demand: (call) =>
        call.path.includes('gu=')
          ? jsonResponse(200, { gu: '기흥구', areas: [AREAS[0], { ...AREAS[1]!, center: null }] })
          : jsonResponse(200, { radiusKm: 3, areas: AREAS }),
    });
    const app = await loadApp('api');
    app.renderApp(['/merchant']);
    await areaList(app).findAllByRole('link');

    const map = app.screen.getByRole('region', { name: '수요 지도(예시)' });
    await app.waitFor(() => expect(app.within(map).getByText('과일 요청 29')).toBeInTheDocument());
    expect(app.within(map).queryByText('과일 요청 14')).not.toBeInTheDocument();
    expect(app.within(map).getByText('내 가게 위치')).toBeInTheDocument();
  });

  it('가게가 없으면(shop null) 안내만 보여주고 /owner/demand 는 요청하지 않는다', async () => {
    const { calls } = stubServer({ me: () => jsonResponse(200, { ...ME, shop: null }) });
    const app = await loadApp('api');
    app.renderApp(['/merchant']);

    expect(await app.screen.findByText(NO_SHOP_TITLE)).toBeInTheDocument();
    expect(
      app.screen.getByText('가게를 등록하면 내 업종을 원하는 동네를 볼 수 있어요.'),
    ).toBeInTheDocument();
    expect(app.screen.queryByRole('link', { name: /구성동/ })).not.toBeInTheDocument();
    expect(demandCalls(calls)).toHaveLength(0);
  });

  it.each([
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
  ])(
    '/me 가 %s 이면 코드별 문구를 보여준다(서버 message 는 쓰지 않는다)',
    async (_name, me, text) => {
      stubServer({ me });
      const app = await loadApp('api');
      app.renderApp(['/merchant']);

      expect(await app.screen.findByText(text)).toBeInTheDocument();
      expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    },
  );

  it('동네 목록 요청이 403 이면 목록 오류 안내에 FORBIDDEN 문구를 보여준다', async () => {
    stubServer({ demand: () => jsonResponse(403, { code: 'FORBIDDEN', message: '서버 원문' }) });
    const app = await loadApp('api');
    app.renderApp(['/merchant']);

    expect(await app.screen.findByText('데이터를 가져오지 못했어요')).toBeInTheDocument();
    expect(app.screen.getByText(FORBIDDEN_TEXT)).toBeInTheDocument();
  });
});

describe('api 모드의 사장님 동네 상세', () => {
  it('서버 수치·조건·시간대(비율 → %)·요약을 보여주고 "예시 정리" 표시는 없다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/merchant/areas/22']);

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '구성동 / 과일 가게' }),
    ).toBeInTheDocument();
    expect(app.screen.getByText('29명')).toBeInTheDocument();
    expect(app.screen.getByText('0곳')).toBeInTheDocument();
    const conditions = app.within(
      app.screen.getByRole('heading', { name: '주민이 원하는 조건' }).closest('section')!,
    );
    expect(conditions.getByText('늦게까지 영업')).toBeInTheDocument();
    expect(conditions.getByText('17명')).toBeInTheDocument();
    const times = app.within(
      app.screen.getByRole('heading', { name: '가기 좋은 시간' }).closest('section')!,
    );
    expect(times.getByText('평일 저녁')).toBeInTheDocument();
    expect(times.getByText('59%')).toBeInTheDocument();
    expect(times.getByText('31%')).toBeInTheDocument();
    expect(
      await app.screen.findByText('구성동에서는 과일·채소 가게를 찾는 주민이 29명이에요.'),
    ).toBeInTheDocument();
    expect(app.screen.queryByText('예시 정리 · AI 연동 예정')).not.toBeInTheDocument();
    expect(calls.find((c) => c.path.startsWith('/api/v1/owner/demand/'))?.path).toBe(
      '/api/v1/owner/demand/22?categoryId=7',
    );
  });

  it('제안 CTA("방문 판매 제안하기")는 이 동네의 제안 작성 화면으로 가는 링크이고 누르는 것만으로 서버에 쓰지 않는다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/merchant/areas/22']);
    const link = await app.screen.findByRole('link', { name: /방문 판매 제안하기/ });
    expect(link).toHaveAttribute('href', '/merchant/offers/new?area=22');

    await app.user.click(link);

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '방문 판매 제안' }),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST' && c.path.endsWith('/offers'))).toHaveLength(0);
  });

  it('요약이 없으면 요약 카드만 실패 안내이고 수치는 그대로 보인다', async () => {
    stubServer({ detail: () => jsonResponse(200, { ...DETAIL, summary: null }) });
    const app = await loadApp('api');
    app.renderApp(['/merchant/areas/22']);

    expect(await app.screen.findByText('요약을 불러오지 못했어요.')).toBeInTheDocument();
    expect(app.screen.getByText('29명')).toBeInTheDocument();
  });

  it('동네 id 가 숫자가 아니면 요청 없이 기존의 "찾을 수 없음" 안내를 보여준다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/merchant/areas/guseong']);

    expect(await app.screen.findByText('찾을 수 없는 동네예요')).toBeInTheDocument();
    expect(app.screen.getByRole('link', { name: '동네 목록으로' })).toHaveAttribute(
      'href',
      '/merchant',
    );
    expect(calls.some((c) => c.path.startsWith('/api/v1/owner/demand/'))).toBe(false);
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
  ])('상세가 %s 이면 코드별 문구를 보여준다', async (_name, detail, text) => {
    stubServer({ detail });
    const app = await loadApp('api');
    app.renderApp(['/merchant/areas/9999']);

    expect(await app.screen.findByText(text)).toBeInTheDocument();
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
  });

  it('가게가 없으면 상세도 가게 없음 안내를 보여준다', async () => {
    stubServer({ me: () => jsonResponse(200, { ...ME, shop: null }) });
    const app = await loadApp('api');
    app.renderApp(['/merchant/areas/22']);

    expect(await app.screen.findByText(NO_SHOP_TITLE)).toBeInTheDocument();
  });
});

describe('mock 모드', () => {
  it('네트워크 없이 기존 목 데이터로 목록·상세를 보여준다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    const app = await loadApp('mock');
    app.renderApp(['/merchant']);

    expect(await app.screen.findByText('싱싱과일 · 과일·채소')).toBeInTheDocument();
    expect(await areaList(app).findAllByRole('link')).toHaveLength(3);

    app.cleanup();
    app.renderApp(['/merchant/areas/guseong']);
    expect(
      await app.screen.findByRole('heading', { level: 1, name: '구성동 / 과일 가게' }),
    ).toBeInTheDocument();
    expect(app.screen.getByText('예시 정리 · AI 연동 예정')).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});
