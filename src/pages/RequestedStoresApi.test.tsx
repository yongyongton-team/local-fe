import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 주민 지도 "주민이 요청한 가게"의 API 모드. 서비스 구현은 import 시점에 정해지므로 환경 값을 바꾼 뒤 앱 모듈을 새로 불러온다.
 * 값은 모두 테스트용 [임의] 값이고 자동 테스트는 실서버를 치지 않는다(fetch 스텁).
 */
type Rtl = typeof import('@testing-library/react');
let rtl: Rtl | null = null;

async function loadApp() {
  vi.stubEnv('VITE_DATA_SOURCE', 'api');
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');
  vi.resetModules();
  rtl = await import('@testing-library/react');
  const userEvent = (await import('@testing-library/user-event')).default;
  const { renderApp } = await import('@/test/renderApp');
  return { ...rtl, user: userEvent.setup(), renderApp };
}
type App = Awaited<ReturnType<typeof loadApp>>;

const DONGS = [{ id: 22, name: '구성동', gu: '기흥구' }];
const CATEGORIES = [
  { id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true },
  { id: 9, code: 'SIDE_DISH', name: '반찬가게', martCheck: true },
  { id: 10, code: 'BAKERY', name: '빵집', martCheck: true },
];
const ME = { id: 3, nickname: '게스트', role: 'RESIDENT', dong: DONGS[0], shop: null };
const GAPS = [
  { categoryId: 7, name: '과일·채소 가게', status: 'S', requestCount: 29, nearestMart: null },
];
const MAP = {
  stores: [],
  requests: [
    { categoryId: 7, name: '과일·채소 가게', count: 29 },
    { categoryId: 10, name: '빵집', count: 6 },
    { categoryId: 9, name: '반찬가게', count: 12 },
  ],
  gaps: [{ categoryId: 7, name: '과일·채소 가게' }],
};
/** 내 요청: 구성동(22) 반찬(9) */
const MY_REQUESTS = [
  { id: 1, dong: { id: 22, name: '구성동' }, category: { id: 9, name: '반찬가게' }, count: 12 },
];

type Handler = (call: StubCall) => Response;
function stubServer(routes: { map?: Handler; mine?: Handler; create?: Handler } = {}) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.method === 'PUT' && call.path === '/api/v1/me') return jsonResponse(200, ME);
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (call.path === '/api/v1/dongs/22/gaps') return jsonResponse(200, GAPS);
    if (call.path === '/api/v1/dongs/22/map') return routes.map?.(call) ?? jsonResponse(200, MAP);
    if (call.path === '/api/v1/me/requests') {
      return routes.mine?.(call) ?? jsonResponse(200, MY_REQUESTS);
    }
    if (call.method === 'POST' && call.path === '/api/v1/requests') {
      return routes.create?.(call) ?? jsonResponse(201, { request: { id: 5 }, reachedGoal: false });
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const callsTo = (calls: StubCall[], path: string, method = 'GET') =>
  calls.filter((c) => c.method === method && c.path === path);

async function openResident(app: App) {
  app.renderApp(['/']);
  await app.screen.findByRole('option', { name: '기흥구 구성동' });
  await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
  await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
  await app.screen.findByRole('heading', { level: 2, name: '우리 동네에 없는 가게' });
}
const requestedSection = (app: App) =>
  app.screen.findByRole('heading', { level: 2, name: '주민이 요청한 가게' });
const itemsOf = async (app: App) =>
  app.within((await requestedSection(app)).closest('section')!).getAllByRole('listitem');

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('api 모드의 주민이 요청한 가게', () => {
  it('map 의 requests 중 gaps 와 겹치지 않는 업종만 요청 많은 순으로 보이고, 내 요청에 있는 업종은 ✓ 다', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    await openResident(app);

    const items = await itemsOf(app);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('반찬가게');
    expect(items[0]).toHaveTextContent('주민 12명이 요청');
    expect(items[1]).toHaveTextContent('빵집');
    expect(items[1]).toHaveTextContent('주민 6명이 요청');
    await app.waitFor(async () =>
      expect(
        app.within((await itemsOf(app))[0]!).getByRole('link', { name: '내 요청 보기' }),
      ).toBeInTheDocument(),
    );
    expect(app.within(items[1]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
    // 요청 목록은 읽기만 한다: 쓰기 호출은 없다.
    expect(calls.filter((c) => c.method !== 'GET' && c.path !== '/api/v1/auth/guest')).toHaveLength(
      1, // 역할·동네 저장(PUT /me) 하나뿐
    );
  });

  it('지도 응답 한 번으로 마커와 요청한 가게를 만든다(지도 요청이 gaps 요청보다 많지 않다)', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    await openResident(app);
    await requestedSection(app);

    expect(callsTo(calls, '/api/v1/dongs/22/map').length).toBe(
      callsTo(calls, '/api/v1/dongs/22/gaps').length,
    );
  });

  it('이미 요청해서 gap 도 아닌 항목이 없으면 섹션이 없다', async () => {
    stubServer({
      map: () =>
        jsonResponse(200, {
          stores: [],
          requests: [{ categoryId: 7, name: '과일·채소 가게', count: 29 }],
          gaps: [{ categoryId: 7, name: '과일·채소 가게' }],
        }),
    });
    const app = await loadApp();
    await openResident(app);

    await app.screen.findByText('과일 / 채소 가게');
    expect(
      app.screen.queryByRole('heading', { level: 2, name: '주민이 요청한 가게' }),
    ).not.toBeInTheDocument();
  });

  it('GET /me/requests 가 403 이어도 목록은 정상이고 ✓ 만 없다(오류 안내 없음)', async () => {
    stubServer({ mine: () => jsonResponse(403, { code: 'FORBIDDEN', message: '서버 원문' }) });
    const app = await loadApp();
    await openResident(app);

    const items = await itemsOf(app);
    expect(items).toHaveLength(2);
    expect(app.within(items[0]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
    expect(app.within(items[1]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
    expect(app.screen.queryByText(/서버 원문|역할이 아니에요|요청을 가져오지 못했어요/)).toBeNull();
  });

  it('「나도 요청」은 그 동네·업종 숫자 id 로 POST /requests 하고 ✓ 가 된다(요청 수는 그대로)', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    await openResident(app);
    const items = await itemsOf(app);

    await app.user.click(app.within(items[1]!).getByRole('button', { name: '나도 요청' }));
    const dialog = app.screen.getByRole('dialog');
    expect(app.within(dialog).getByText('구성동 · 빵집')).toBeInTheDocument();
    await app.user.click(app.within(dialog).getByRole('button', { name: '평일 저녁' }));
    await app.user.click(app.within(dialog).getByRole('radio', { name: '주 1번 이상' }));
    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    await app.waitFor(() => expect(callsTo(calls, '/api/v1/requests', 'POST')).toHaveLength(1));
    expect(JSON.parse(callsTo(calls, '/api/v1/requests', 'POST')[0]?.body ?? '{}')).toEqual({
      dongId: 22,
      categoryId: 10,
      timeSlots: ['WEEKDAY_EVENING'],
      frequency: 'WEEKLY_PLUS',
    });
    await app.waitFor(async () =>
      expect(
        app.within((await itemsOf(app))[1]!).getByRole('link', { name: '내 요청 보기' }),
      ).toBeInTheDocument(),
    );
    // 숫자는 바로 올라간다(6명 → 7명). 서버 값을 다시 읽지 않고 화면에서 반영한다.
    expect((await itemsOf(app))[1]).toHaveTextContent('주민 7명이 요청');
    expect((await itemsOf(app))[0]).toHaveTextContent('주민 12명이 요청');
  });

  it('성공해도 지도·gaps·내 요청을 다시 부르지 않는다(요청 횟수가 늘지 않는다)', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    await openResident(app);
    const items = await itemsOf(app);
    await app.waitFor(() =>
      expect(callsTo(calls, '/api/v1/me/requests').length).toBeGreaterThan(0),
    );
    const before = {
      map: callsTo(calls, '/api/v1/dongs/22/map').length,
      gaps: callsTo(calls, '/api/v1/dongs/22/gaps').length,
      mine: callsTo(calls, '/api/v1/me/requests').length,
    };

    await app.user.click(app.within(items[1]!).getByRole('button', { name: '나도 요청' }));
    const dialog = app.screen.getByRole('dialog');
    await app.user.click(app.within(dialog).getByRole('button', { name: '평일 저녁' }));
    await app.user.click(app.within(dialog).getByRole('radio', { name: '주 1번 이상' }));
    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));
    await app.waitFor(() => expect(callsTo(calls, '/api/v1/requests', 'POST')).toHaveLength(1));
    await app.waitFor(async () =>
      expect((await itemsOf(app))[1]).toHaveTextContent('주민 7명이 요청'),
    );

    expect({
      map: callsTo(calls, '/api/v1/dongs/22/map').length,
      gaps: callsTo(calls, '/api/v1/dongs/22/gaps').length,
      mine: callsTo(calls, '/api/v1/me/requests').length,
    }).toEqual(before);
  });

  it('요청이 실패(500)하면 숫자도 ✓ 도 바뀌지 않는다', async () => {
    stubServer({ create: () => jsonResponse(500, { code: 'X', message: '서버 원문' }) });
    const app = await loadApp();
    await openResident(app);
    const items = await itemsOf(app);

    await app.user.click(app.within(items[1]!).getByRole('button', { name: '나도 요청' }));
    const dialog = app.screen.getByRole('dialog');
    await app.user.click(app.within(dialog).getByRole('button', { name: '평일 저녁' }));
    await app.user.click(app.within(dialog).getByRole('radio', { name: '주 1번 이상' }));
    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    expect(await app.within(dialog).findByRole('alert')).toBeInTheDocument();
    await app.user.click(app.within(dialog).getByRole('button', { name: '닫기' }));
    const after = await itemsOf(app);
    expect(after[1]).toHaveTextContent('주민 6명이 요청');
    expect(app.within(after[1]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
  });

  it('409 ALREADY_REQUESTED 는 기존 안내(서버 message 는 안 보임)와 함께 ✓ 가 된다', async () => {
    stubServer({
      create: () => jsonResponse(409, { code: 'ALREADY_REQUESTED', message: '서버 원문' }),
    });
    const app = await loadApp();
    await openResident(app);
    const items = await itemsOf(app);

    await app.user.click(app.within(items[1]!).getByRole('button', { name: '나도 요청' }));
    const dialog = app.screen.getByRole('dialog');
    await app.user.click(app.within(dialog).getByRole('button', { name: '평일 저녁' }));
    await app.user.click(app.within(dialog).getByRole('radio', { name: '주 1번 이상' }));
    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    expect(await app.within(dialog).findByRole('alert')).toHaveTextContent(
      '이 동네에 같은 업종을 이미 요청했어요. 내 요청에서 확인해 보세요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    await app.user.click(app.within(dialog).getByRole('button', { name: '확인' }));
    expect(
      app.within((await itemsOf(app))[1]!).getByRole('link', { name: '내 요청 보기' }),
    ).toBeInTheDocument();
    // 이미 세어진 요청이라 숫자는 그대로다.
    expect((await itemsOf(app))[1]).toHaveTextContent('주민 6명이 요청');
  });

  it('데모 세션은 POST /requests 가 서버로 나가지 않는다(차단 유지)', async () => {
    localStorage.setItem(
      'yyt.session',
      JSON.stringify({ token: 'tok-demo', expiresAt: Date.now() + 1e7, demo: true }),
    );
    const { calls } = stubServer();
    await loadApp();
    // 데모 세션은 역할·동네를 저장하지 못해 화면에 들어올 수 없으므로 서비스 수준에서 차단을 확인한다.
    const { requestSubmitter } = await import('@/services');

    await expect(
      requestSubmitter.submitQuick({
        neighborhoodId: '22',
        categoryId: '10',
        visitTimes: ['weekend'],
        visitFrequency: 'weekly',
      }),
    ).rejects.toMatchObject({ code: 'DEMO_SESSION' });
    expect(callsTo(calls, '/api/v1/requests', 'POST')).toHaveLength(0);
  });
});
