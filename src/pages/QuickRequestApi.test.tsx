import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 간편 요청(나도 요청)의 API 모드. 서비스 구현은 import 시점에 정해지므로 환경 값을 바꾼 뒤 앱 모듈을 새로 불러온다.
 * 자동 테스트는 실서버를 치지 않는다(fetch 스텁, 가짜 값).
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
const CATEGORIES = [{ id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true }];
const ME = { id: 3, nickname: '게스트', role: 'RESIDENT', dong: DONGS[0], shop: null };
const GAPS = [
  { categoryId: 7, name: '과일·채소 가게', status: 'S', requestCount: 29, nearestMart: null },
];

function stubServer(create: (call: StubCall) => Response) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.method === 'PUT' && call.path === '/api/v1/me') return jsonResponse(200, ME);
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (call.path === '/api/v1/dongs/22/gaps') return jsonResponse(200, GAPS);
    if (call.path === '/api/v1/dongs/22/map')
      return jsonResponse(200, { stores: [], requests: [], gaps: [] });
    if (call.method === 'POST' && call.path === '/api/v1/requests') return create(call);
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const posts = (calls: StubCall[]) =>
  calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/requests');

async function openAndFill(app: App) {
  app.renderApp(['/']);
  await app.screen.findByRole('option', { name: '기흥구 구성동' });
  await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
  await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
  await app.user.click(await app.screen.findByRole('button', { name: '나도 요청' }));
  const dialog = app.screen.getByRole('dialog');
  await app.user.click(app.within(dialog).getByRole('button', { name: '평일 저녁' }));
  await app.user.click(app.within(dialog).getByRole('radio', { name: '주 1번 이상' }));
  return dialog;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('api 모드의 나도 요청', () => {
  it('POST /requests 본문은 {dongId, categoryId, timeSlots, frequency} 뿐이고 문장·조건·AI 정리 호출이 없다', async () => {
    const { calls } = stubServer(() =>
      jsonResponse(201, { request: { id: 1 }, count: 30, reachedGoal: false }),
    );
    const app = await loadApp();
    const dialog = await openAndFill(app);

    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    await app.waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(JSON.parse(posts(calls)[0]!.body ?? '{}')).toEqual({
      dongId: 22,
      categoryId: 7,
      timeSlots: ['WEEKDAY_EVENING'],
      frequency: 'WEEKLY_PLUS',
    });
    expect(calls.some((c) => c.path === '/api/v1/requests/parse')).toBe(false);
  });

  it('성공하면 추가 GET 없이 카드 숫자가 +1 이고 ✓ 가 된다', async () => {
    const { calls } = stubServer(() =>
      jsonResponse(201, { request: { id: 1 }, count: 30, reachedGoal: false }),
    );
    const app = await loadApp();
    const dialog = await openAndFill(app);
    const before = calls.length;

    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    await app.waitFor(() => expect(app.screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(app.screen.getByText(/주민 30명이 요청/)).toBeInTheDocument();
    expect(app.screen.getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument();
    expect(calls.slice(before).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/v1/requests',
    ]);
  });

  it('reachedGoal 이면 창 안에 모였다는 안내와 알린 사장님 수를 보여준다', async () => {
    stubServer(() =>
      jsonResponse(201, {
        request: { id: 1 },
        count: 30,
        goal: 30,
        reachedGoal: true,
        notifiedOwnerCount: 3,
      }),
    );
    const app = await loadApp();
    const dialog = await openAndFill(app);

    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    expect(await app.screen.findByText('30명이 모였어요!')).toBeInTheDocument();
    expect(app.screen.getByText('근처 사장님 3명에게 알렸어요')).toBeInTheDocument();
  });

  it('409 ALREADY_REQUESTED 는 기존 안내 문구를 보여주고 카드를 ✓ 로 바꾼다(숫자는 그대로, 서버 message 는 쓰지 않는다)', async () => {
    stubServer(() =>
      jsonResponse(409, { code: 'ALREADY_REQUESTED', message: '서버 원문 노출 금지' }),
    );
    const app = await loadApp();
    const dialog = await openAndFill(app);

    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    expect(await app.within(dialog).findByRole('alert')).toHaveTextContent(
      '이 동네에 같은 업종을 이미 요청했어요. 내 요청에서 확인해 보세요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(app.screen.getByText(/주민 29명이 요청/)).toBeInTheDocument();
    expect(app.screen.getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument();
  });

  it('400 VALIDATION_ERROR 는 요청 작성 맥락의 문구이고 서버 message 는 보이지 않는다', async () => {
    stubServer(() =>
      jsonResponse(400, { code: 'VALIDATION_ERROR', message: '서버 원문 노출 금지' }),
    );
    const app = await loadApp();
    const dialog = await openAndFill(app);

    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    expect(await app.within(dialog).findByRole('alert')).toHaveTextContent(
      '요청 내용을 다시 확인해 주세요. 시간대와 이용 빈도를 선택했는지 살펴봐 주세요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(app.screen.queryByText(/역할과 동네/)).not.toBeInTheDocument();
  });

  it('그 밖의 서버 오류는 오류 문구만 보여주고 카드는 그대로다', async () => {
    stubServer(() => jsonResponse(500, { code: 'X', message: '서버 원문 노출 금지' }));
    const app = await loadApp();
    const dialog = await openAndFill(app);

    await app.user.click(app.within(dialog).getByRole('button', { name: /^보내기/ }));

    expect(await app.within(dialog).findByRole('alert')).toHaveTextContent(
      '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(app.screen.getByText(/주민 29명이 요청/)).toBeInTheDocument();
    expect(app.screen.getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
  });
});
