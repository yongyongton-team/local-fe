import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 시연 리허설 후속 수정: 요청 정리 대기·실패 표시, 주민 지도의 요청·부족 가게 알약, 창업자 순위 숨김과 지도 카드.
 * 서비스 구현은 import 시점에 정해지므로 환경 값을 바꾼 뒤 React·RTL·앱 모듈을 모두 새로 불러온다.
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
type App = Awaited<ReturnType<typeof loadApp>>;

const storeToken = () =>
  localStorage.setItem(
    'yyt.session',
    JSON.stringify({ token: 'tok', expiresAt: Date.now() + 1e7 }),
  );
const me = (role: string) => ({
  id: 3,
  nickname: 'x',
  role,
  dong: { id: 22, name: '구성동', gu: '기흥구' },
  shop: null,
});
const CATEGORIES = Array.from({ length: 38 }, (_, i) => {
  const id = i + 1;
  if (id === 7) return { id, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true };
  if (id === 18) return { id, code: 'SIDE_DISH', name: '반찬가게', martCheck: true };
  if (id === 33) return { id, code: 'MARTIAL_ARTS', name: '태권도장', martCheck: false };
  return { id, code: `CODE_${id}`, name: `업종${id}`, martCheck: false };
});
const DONGS = [{ id: 22, name: '구성동', gu: '기흥구' }];
const MAP = (center: unknown = { lat: 37.29349, lon: 127.13252 }) => ({
  dong: { id: 22, name: '구성동', center },
  stores: [
    { id: 1, name: '가게A', categoryId: 7, lat: 37.29, lon: 127.13 },
    { id: 2, name: '가게B', categoryId: 3, lat: 37.3, lon: 127.14 },
  ],
  requests: [
    { categoryId: 7, name: '과일·채소 가게', count: 29 },
    { categoryId: 18, name: '반찬가게', count: 12 },
    { categoryId: 28, name: '빵집', count: 6 },
  ],
  gaps: [{ categoryId: 7, name: '과일·채소 가게' }],
});

type Handler = (call: StubCall) => Response | Promise<Response>;
function stubServer(
  role: string,
  routes: { map?: Handler; parse?: Handler; rankings?: Handler; gaps?: Handler } = {},
) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest')
      return jsonResponse(200, { accessToken: 'tok', expiresIn: 3600 });
    if (call.path === '/api/v1/me') return jsonResponse(200, me(role));
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (call.path.endsWith('/gaps')) return routes.gaps?.(call) ?? jsonResponse(200, []);
    if (call.path.endsWith('/map')) return routes.map?.(call) ?? jsonResponse(200, MAP());
    if (call.path === '/api/v1/requests/parse') {
      return routes.parse?.(call) ?? jsonResponse(200, { category: null, conditions: [] });
    }
    if (call.path.startsWith('/api/v1/founder/rankings')) {
      return routes.rankings?.(call) ?? jsonResponse(200, { items: [] });
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}

beforeEach(() => {
  localStorage.clear();
  storeToken();
});
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

const mapRegion = (app: App) => app.screen.getByRole('region', { name: '동네 지도(예시)' });
const mapTexts = (app: App) =>
  app
    .within(mapRegion(app))
    .queryAllByRole('listitem')
    .map((li) => li.textContent ?? '');

describe('주민 지도: 요청·부족 가게 알약(API 모드)', () => {
  async function openResident(app: App) {
    app.renderApp(['/resident']);
    await app.screen.findByRole('radio', { name: '주민 요청' });
    await app.waitFor(() => expect(mapTexts(app).length).toBeGreaterThan(0));
  }

  it('칩마다 알약이 나오고 요약 문구가 알약 수와 일치한다', async () => {
    stubServer('RESIDENT');
    const app = await loadApp('api');
    await openResident(app);

    // 전체: 가게 핀 2 + 요청 알약 3 + 부족 가게 알약 1
    expect(app.screen.getByText('현재 전체 6곳 표시 중')).toBeInTheDocument();
    expect(mapTexts(app)).toHaveLength(6);

    await app.user.click(app.screen.getByRole('radio', { name: '주민 요청' }));
    expect(app.screen.getByText('현재 주민 요청 3곳 표시 중')).toBeInTheDocument();
    // 업종 28 은 이 테스트의 업종 목록에서 "업종28"(표에 없는 업종은 서버 이름 그대로)이다.
    expect(mapTexts(app).sort()).toEqual(['과일 요청 29', '반찬 요청 12', '업종28 요청 6'].sort());

    await app.user.click(app.screen.getByRole('radio', { name: '없는 가게' }));
    expect(app.screen.getByText('현재 없는 가게 1곳 표시 중')).toBeInTheDocument();
    expect(mapTexts(app)).toEqual(['X : 과일 / 채소']);

    await app.user.click(app.screen.getByRole('radio', { name: '있는 가게' }));
    expect(app.screen.getByText('현재 있는 가게 2곳 표시 중')).toBeInTheDocument();
  });

  it.each([
    ['center 가 null', () => MAP(null)],
    ['center 가 없음', () => ({ ...MAP(), dong: { id: 22, name: '구성동' } })],
    ['dong 이 없음', () => ({ ...MAP(), dong: undefined })],
    ['center 가 유효하지 않음(lat 91)', () => MAP({ lat: 91, lon: 127 })],
  ])('dong.center 가 %s 이면 알약이 없고 가게 핀은 그대로다', async (_name, body) => {
    stubServer('RESIDENT', { map: () => jsonResponse(200, body()) });
    const app = await loadApp('api');
    await openResident(app);

    expect(app.screen.getByText('현재 전체 2곳 표시 중')).toBeInTheDocument();
    await app.user.click(app.screen.getByRole('radio', { name: '주민 요청' }));
    expect(app.screen.getByText('현재 주민 요청 0곳 표시 중')).toBeInTheDocument();
    await app.user.click(app.screen.getByRole('radio', { name: '없는 가게' }));
    expect(app.screen.getByText('현재 없는 가게 0곳 표시 중')).toBeInTheDocument();
  });

  it('요청도 gaps 도 없는 동네(포곡읍)는 알약 없이 가게 핀만 있다', async () => {
    stubServer('RESIDENT', {
      map: () => jsonResponse(200, { ...MAP(), requests: [], gaps: [] }),
    });
    const app = await loadApp('api');
    app.renderApp(['/resident']);

    expect(await app.screen.findByText('현재 전체 2곳 표시 중')).toBeInTheDocument();
  });
});

describe('요청 정리 대기·실패 표시', () => {
  const TEXT = '[프론트 테스트] 과일 가게가 있으면 좋겠어요';
  const WAITING = '요청 내용을 정리하고 있어요.';

  async function openForm(app: App) {
    app.renderApp(['/resident/requests/new']);
    const box = await app.screen.findByLabelText('어떤 가게가 생기면 갈까요?');
    await app.user.click(box);
    return box;
  }

  it('API 모드: 입력 지연이 끝나고 호출이 시작된 뒤 응답이 올 때까지 안내를 보이고, 응답이 오면 사라진다', async () => {
    let finish: (r: Response) => void = () => undefined;
    stubServer('RESIDENT', { parse: () => new Promise<Response>((resolve) => (finish = resolve)) });
    const app = await loadApp('api');
    await openForm(app);

    await app.user.paste(TEXT);
    // 입력 지연(400ms) 안에는 아직 호출 전이라 안내가 없다.
    expect(app.screen.queryByText(WAITING)).not.toBeInTheDocument();
    expect(await app.screen.findByText(WAITING)).toBeInTheDocument();
    expect(app.screen.getByRole('status')).toHaveTextContent(WAITING);

    finish(jsonResponse(200, { category: { id: 7, name: '과일·채소 가게' }, conditions: [] }));

    expect(await app.screen.findByRole('region', { name: '요청 정리 결과' })).toBeInTheDocument();
    expect(app.screen.queryByText(WAITING)).not.toBeInTheDocument();
  });

  it('API 모드: 실패하면 안내가 사라지고 카드가 나온다', async () => {
    let fail: (r: Response) => void = () => undefined;
    stubServer('RESIDENT', { parse: () => new Promise<Response>((resolve) => (fail = resolve)) });
    const app = await loadApp('api');
    await openForm(app);
    await app.user.paste(TEXT);
    await app.screen.findByText(WAITING);

    fail(jsonResponse(502, { code: 'AI_UNAVAILABLE', message: 'x' }));

    await app.screen.findByRole('region', { name: '요청 정리 결과' });
    expect(app.screen.queryByText(WAITING)).not.toBeInTheDocument();
  });

  it('실패 문구는 카드 맨 위(업종 칩보다 앞)에 있고 칩 선택은 그대로 동작한다', async () => {
    stubServer('RESIDENT', {
      parse: () => jsonResponse(502, { code: 'AI_UNAVAILABLE', message: '서버 원문' }),
    });
    const app = await loadApp('api');
    await openForm(app);
    await app.user.paste(TEXT);

    const card = await app.screen.findByRole('region', { name: '요청 정리 결과' });
    const error = app.within(card).getByRole('status');
    expect(error).toHaveTextContent('요청 내용을 정리하지 못했어요. 업종을 직접 골라 주세요.');
    const chips = app.within(card).getAllByRole('radio');
    expect(chips).toHaveLength(38);
    // 문서 순서: 오류 문구가 모든 칩과 "업종" 행보다 앞이다.
    for (const target of [chips[0]!, chips.at(-1)!, app.within(card).getByText('업종')]) {
      expect(error.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    await app.user.click(app.within(card).getByRole('radio', { name: '태권도장' }));
    expect(app.within(card).getByRole('radio', { name: '태권도장' })).toBeChecked();
    expect(app.within(card).getByText('태권도장', { selector: 'dd' })).toBeInTheDocument();
  });

  it('목 모드: 대기 안내가 없고(pending 은 항상 false) fetch 도 호출되지 않는다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    const app = await loadApp('mock');
    const { requestSummarizer } = await import('@/services');
    const { renderHook, act } = await import('@testing-library/react');
    const { useRequestSummary } = await import('@/features/store-request/useRequestSummary');
    let release: (value: { categoryId: string | null; conditions: string[] }) => void = () =>
      undefined;
    vi.useFakeTimers();
    vi.spyOn(requestSummarizer, 'summarize').mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { result } = renderHook(() => useRequestSummary('빵집', '22'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    // 호출은 시작됐지만(응답 대기 중) 목 구현이라 대기 안내는 켜지지 않는다.
    expect(result.current.pending).toBe(false);
    await act(async () => release({ categoryId: 'bakery', conditions: [] }));
    vi.useRealTimers();
    vi.restoreAllMocks();

    expect(result.current.pending).toBe(false);
    expect(fn).not.toHaveBeenCalled();
    void app;
  });
});

describe('창업자 순위: 요청 0명 동네 숨김과 지도 카드', () => {
  const item = (over: Record<string, unknown>) => ({
    rank: 1,
    dongId: 22,
    name: '구성동',
    requestCount: 29,
    sameCategoryStoreCount: 0,
    nearestMartKm: 2.4,
    score: 29,
    ...over,
  });
  const section = (app: App) =>
    app.within(
      app.screen
        .getByRole('heading', { level: 2, name: '요청은 많고 가게는 없는 동네' })
        .closest('section')!,
    );

  it('요청 0명 동네는 숨기고 순위 번호를 보이는 행 기준으로 1부터 다시 매긴다(서버 rank 와 달라진다)', async () => {
    stubServer('FOUNDER', {
      rankings: () =>
        jsonResponse(200, {
          items: [
            item({ rank: 1, dongId: 16, name: '영덕2동', requestCount: 0 }),
            item({ rank: 2, dongId: 36, name: '상현1동', requestCount: 0 }),
            item({ rank: 3, dongId: 22, name: '구성동', requestCount: 12 }),
          ],
        }),
    });
    const app = await loadApp('api');
    app.renderApp(['/founder']);

    await app.screen.findByRole('link', { name: /구성동/ });
    const rows = section(app).getAllByRole('link');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAccessibleName(/^1\. 구성동, 요청 12명/);
  });

  it('업종에 요청이 하나도 없으면 기존 빈 상태 문구가 나오고 지도 카드는 없다', async () => {
    stubServer('FOUNDER', {
      rankings: () =>
        jsonResponse(200, {
          items: [
            item({ requestCount: 0 }),
            item({ rank: 2, dongId: 28, name: '보정동', requestCount: 0 }),
          ],
        }),
    });
    const app = await loadApp('api');
    app.renderApp(['/founder']);

    expect(await app.screen.findByText('아직 요청이 없는 업종이에요')).toBeInTheDocument();
    expect(
      app.screen.queryByRole('region', { name: '입지 후보 지도(예시)' }),
    ).not.toBeInTheDocument();
  });

  it('목 모드는 기존대로 지도 카드를 보여주고 fetch 를 부르지 않는다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    const app = await loadApp('mock');
    app.renderApp(['/founder']);

    expect(
      await app.screen.findByRole('region', { name: '입지 후보 지도(예시)' }),
    ).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('shouldShowRankMap', () => {
  it('서버 순위(remote)는 마커가 있을 때만, 목은 항상 보인다', async () => {
    const { shouldShowRankMap } = await import('@/features/founder-explore/locationRows');

    expect(shouldShowRankMap(true, 0)).toBe(false);
    expect(shouldShowRankMap(true, 1)).toBe(true);
    expect(shouldShowRankMap(false, 0)).toBe(true);
    expect(shouldShowRankMap(false, 5)).toBe(true);
  });
});

describe('favicon', () => {
  it('index.html 에 아이콘 링크가 있어 favicon.ico 404 요청이 없다', () => {
    const html = readFileSync(`${process.cwd()}/index.html`, 'utf8');

    expect(html).toMatch(/<link[^>]*rel="icon"[^>]*href="data:,"/);
  });
});
