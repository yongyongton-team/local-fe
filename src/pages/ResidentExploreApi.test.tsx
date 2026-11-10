import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 주민 탐색 화면의 API 모드(동네별 gaps·map 조회). 서비스 구현은 import 시점에 mock | api 로 정해지므로
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
  { id: 28, name: '보정동', gu: '기흥구' },
];
const CATEGORIES = [
  { id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true },
  { id: 30, code: 'FLOWER_SHOP', name: '꽃집', martCheck: false },
];
const ME = { id: 3, nickname: '게스트', role: 'RESIDENT', dong: DONGS[0], shop: null };

const GAPS_22 = [
  {
    categoryId: 7,
    name: '과일·채소 가게',
    status: 'S',
    requestCount: 4,
    nearestMart: { name: '마트', km: 2.5 },
    myRequested: true,
  },
  { categoryId: 30, name: '꽃집', status: 'S', requestCount: 9, nearestMart: null },
];
const GAPS_28 = [{ categoryId: 30, name: '꽃집', status: 'S', requestCount: 2, nearestMart: null }];
const MAP_22 = {
  stores: [
    { id: 1, name: '구성 청과', categoryId: 7, lat: 37.27, lon: 127.11 },
    { id: 2, name: '좌표 없는 가게', categoryId: 7 },
  ],
  requests: [{ categoryId: 7, name: '과일', count: 4 }],
  gaps: [{ categoryId: 30, name: '꽃집' }],
};

type Handler = (call: StubCall, init: RequestInit) => Response | Promise<Response>;
interface Server {
  gaps?: Handler;
  map?: Handler;
}
function stubServer(server: Server = {}) {
  return stubFetch((call, init) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.method === 'PUT' && call.path === '/api/v1/me') return jsonResponse(200, ME);
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    const gaps = /^\/api\/v1\/dongs\/(\d+)\/gaps$/.exec(call.path);
    if (gaps) {
      return server.gaps?.(call, init) ?? jsonResponse(200, gaps[1] === '22' ? GAPS_22 : GAPS_28);
    }
    if (/^\/api\/v1\/dongs\/\d+\/map$/.test(call.path)) {
      return server.map?.(call, init) ?? jsonResponse(200, MAP_22);
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}

type Loaded = Awaited<ReturnType<typeof loadApp>>;
async function startResident(app: Loaded, dongName = '기흥구 구성동') {
  await app.screen.findByRole('option', { name: dongName });
  await app.user.selectOptions(app.screen.getByLabelText('내 동네'), dongName);
  await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
  await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
  await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' });
}

const cardSection = (app: Loaded) =>
  app.within(
    app.screen
      .getByRole('heading', { level: 2, name: '우리 동네에 없는 가게' })
      .closest('section')!,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('api 모드의 주민 탐색 화면', () => {
  it('gaps 를 카드로(요청 많은 순), map 의 가게를 마커로 보여준다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('api');
    app.renderApp(['/']);
    await startResident(app);

    const section = cardSection(app);
    expect(await section.findByText('꽃집')).toBeInTheDocument();
    const cards = section.getAllByRole('listitem').map((li) => li.textContent ?? '');
    // 요청 많은 순: 꽃집 9명 → 과일 4명. nearestMart 가 null 인 카드는 거리 문구가 없다.
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('꽃집');
    expect(cards[0]).toContain('주민 9명이 요청');
    expect(cards[0]).not.toContain('대형마트');
    expect(cards[1]).toContain('과일 / 채소 가게');
    expect(cards[1]).toContain('주민 4명이 요청 / 대형마트 2.5km');
    expect(cards[1]).toContain('내가 요청함');

    // 키가 없는 테스트 환경이라 자리표시자 지도가 그린다. 좌표가 있는 가게 하나만 마커다.
    const map = app.screen.getByRole('region', { name: '동네 지도(예시)' });
    await app.waitFor(() => expect(app.within(map).getAllByRole('listitem')).toHaveLength(1));
    expect(app.within(map).getByText('구성 청과')).toBeInTheDocument();

    expect(calls.map((c) => c.path)).toEqual(
      expect.arrayContaining(['/api/v1/dongs/22/gaps', '/api/v1/dongs/22/map']),
    );
  });

  it('gaps 가 빈 배열이면 빈 안내를, map 에 가게가 없으면 마커 없이 지도를 보여준다', async () => {
    stubServer({
      gaps: () => jsonResponse(200, []),
      map: () => jsonResponse(200, { stores: [], requests: [], gaps: [] }),
    });
    const app = await loadApp('api');
    app.renderApp(['/']);
    await startResident(app);

    expect(await app.screen.findByText('조건에 맞는 가게가 아직 없어요')).toBeInTheDocument();
    expect(app.screen.getByRole('region', { name: '동네 지도(예시)' })).toBeInTheDocument();
  });

  it('404 NOT_FOUND 는 "선택한 동네를 찾을 수 없어요" 문구를 보여준다', async () => {
    stubServer({
      gaps: () => jsonResponse(404, { code: 'NOT_FOUND', message: '서버 원문 노출 금지' }),
      map: () => jsonResponse(404, { code: 'NOT_FOUND', message: '서버 원문 노출 금지' }),
    });
    const app = await loadApp('api');
    app.renderApp(['/']);
    await startResident(app);

    expect(
      (await app.screen.findAllByText('선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.'))
        .length,
    ).toBe(2);
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(app.screen.getByText('데이터를 가져오지 못했어요')).toBeInTheDocument();
    expect(app.screen.getByText('지도 마커를 가져오지 못했어요')).toBeInTheDocument();
  });

  it('네트워크 오류는 연결 확인 문구를 보여주고, 그 밖의 서버 오류는 일반 문구를 보여준다', async () => {
    stubServer({
      gaps: () => {
        throw new TypeError('Failed to fetch');
      },
      map: () => jsonResponse(500, { code: 'X' }),
    });
    const app = await loadApp('api');
    app.renderApp(['/']);
    await startResident(app);

    expect(
      await app.screen.findByText('네트워크 연결을 확인하고 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(
      await app.screen.findByText('일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument();
  });

  it('동네를 바꾸면 이전 동네의 낡은 응답은 취소되어 화면을 덮어쓰지 않는다', async () => {
    const releases: ((response: Response) => void)[] = [];
    const signals: (AbortSignal | null | undefined)[] = [];
    stubServer({
      gaps: (call, init) => {
        if (call.path !== '/api/v1/dongs/22/gaps') return jsonResponse(200, GAPS_28);
        signals.push(init.signal);
        // 22 번 동네의 gaps 는 끝까지 늦게 온다.
        return new Promise<Response>((resolve) => releases.push(resolve));
      },
    });
    const app = await loadApp('api');
    app.renderApp(['/']);
    await startResident(app);
    await app.waitFor(() => expect(releases).toHaveLength(1));

    // 동네 변경(첫 화면)에서 다른 동네로 다시 시작한다.
    await app.user.click(app.screen.getByRole('link', { name: /동네 변경/ }));
    await startResident(app, '기흥구 보정동');
    const section = cardSection(app);
    expect(await section.findByText('주민 2명이 요청')).toBeInTheDocument();

    // 이전 동네의 요청은 화면을 떠나면서 취소됐고, 뒤늦게 온 응답도 반영되지 않는다.
    expect(signals[0]?.aborted).toBe(true);
    releases[0]!(jsonResponse(200, GAPS_22));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(section.queryByText('주민 9명이 요청')).not.toBeInTheDocument();
    expect(section.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('mock 모드의 주민 탐색 화면', () => {
  it('네트워크 없이 기존 목 데이터로 카드와 마커를 보여준다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    const app = await loadApp('mock');
    app.renderApp(['/']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
    await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' });

    expect(await cardSection(app).findAllByRole('listitem')).not.toHaveLength(0);
    const map = app.screen.getByRole('region', { name: '동네 지도(예시)' });
    await app.waitFor(() =>
      expect(app.within(map).getAllByRole('listitem').length).toBeGreaterThan(0),
    );
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('describeLoadError', () => {
  it('ApiError 는 코드별 문구이고, 그 밖의 오류는 기존 문구 그대로다', async () => {
    const { describeLoadError, GENERIC_RETRY_TEXT } =
      await import('@/features/resident-map/loadErrorText');
    const { ApiError } = await import('@/services/api/apiError');

    const notFound = new ApiError({ kind: 'http', status: 404, code: 'NOT_FOUND', message: 'x' });
    expect(describeLoadError(notFound)).toBe(
      '선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.',
    );
    expect(describeLoadError(new Error('boom'))).toBe(GENERIC_RETRY_TEXT);
    expect(GENERIC_RETRY_TEXT).toBe('잠시 후 다시 시도해 주세요.');
  });
});
