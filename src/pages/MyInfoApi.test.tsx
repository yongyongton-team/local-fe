import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeJwt, jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 내 정보(/me)·동네 선택(/me/dong)의 API 모드(PUT /me). 서비스 구현은 import 시점에 정해지므로
 * 환경 값을 바꾼 뒤 React·RTL·앱 모듈을 모두 새로 불러온다(DemoEntryApi.test.tsx 와 같은 방식).
 */
type Rtl = typeof import('@testing-library/react');
let rtl: Rtl | null = null;

async function loadApp(demoFlag: 'true' | '' = '') {
  vi.stubEnv('VITE_DATA_SOURCE', 'api');
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');
  vi.stubEnv('VITE_ENABLE_DEMO_LOGIN', demoFlag);
  vi.resetModules();
  rtl = await import('@testing-library/react');
  const userEvent = (await import('@testing-library/user-event')).default;
  const { renderApp } = await import('@/test/renderApp');
  return { ...rtl, user: userEvent.setup(), renderApp };
}
type App = Awaited<ReturnType<typeof loadApp>>;

const DONGS = [
  { id: 22, name: '구성동', gu: '기흥구' },
  { id: 28, name: '보정동', gu: '기흥구' },
  { id: 40, name: '죽전1동', gu: '수지구' },
];
const TOKEN = () => fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
const SHOP = { shopName: '싱싱과일', category: { id: 7, name: '과일·채소' }, dong: DONGS[0] };

/** PUT /me 의 기본 응답: 요청한 역할·동으로 200 */
function okPut(call: StubCall): Response {
  const body = JSON.parse(call.body ?? '{}') as { role: string; dongId: number };
  return jsonResponse(200, {
    id: 3,
    nickname: '민트',
    role: body.role,
    dong: DONGS.find((d) => d.id === body.dongId),
  });
}

interface Server {
  /** PUT /me 처리. 기본은 okPut */
  put?: (call: StubCall) => Response | Promise<Response>;
  me?: () => Response;
}
function stubServer(server: Server = {}) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: TOKEN(), expiresIn: 3600, isNew: true });
    }
    if (call.path === '/api/v1/auth/demo') {
      return jsonResponse(200, { accessToken: TOKEN(), expiresIn: 3600, user: { role: 'OWNER' } });
    }
    if (call.path === '/api/v1/me') {
      if (call.method === 'PUT') return server.put ? server.put(call) : okPut(call);
      return (
        server.me?.() ??
        jsonResponse(200, { id: 3, nickname: '민트', role: 'RESIDENT', dong: DONGS[0], shop: null })
      );
    }
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, []);
    if (call.path.startsWith('/api/v1/owner/demand')) {
      return jsonResponse(200, { radiusKm: 3, areas: [] });
    }
    if (/^\/api\/v1\/dongs\/\d+\/(gaps|map)$/.test(call.path)) {
      return jsonResponse(
        200,
        call.path.endsWith('gaps') ? [] : { stores: [], requests: [], gaps: [] },
      );
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const puts = (calls: StubCall[]) => calls.filter((c) => c.method === 'PUT');
const putBodies = (calls: StubCall[]) => puts(calls).map((c) => JSON.parse(c.body ?? '{}'));

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

/** 첫 화면에서 역할 + 구성동으로 시작한다(PUT /me 1회). */
async function start(app: App, role: RegExp = /^주민/) {
  const { router } = app.renderApp(['/']);
  await app.screen.findByRole('option', { name: '기흥구 구성동' });
  await app.user.click(app.screen.getByRole('radio', { name: role }));
  await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
  await app.waitFor(() => expect(router.state.location.pathname).not.toBe('/'));
  return router;
}
async function goTo(app: App, router: { navigate: (to: string) => Promise<void> }, path: string) {
  await app.act(() => router.navigate(path));
}

describe('api 모드: 내 정보의 역할 변경', () => {
  it('역할 칩을 누르면 PUT /me 에 새 역할과 현재 동네를 보내고 그 역할의 첫 화면으로 이동한다', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    const router = await start(app);
    await goTo(app, router, '/me');
    await app.screen.findByText('ID : 3');
    expect(app.screen.getByRole('radio', { name: '주민' })).toBeChecked();

    await app.user.click(app.screen.getByRole('radio', { name: '예비 창업자' }));

    await app.waitFor(() => expect(router.state.location.pathname).toBe('/founder'));
    expect(putBodies(calls)).toEqual([
      { role: 'RESIDENT', dongId: 22 }, // 첫 화면 시작
      { role: 'FOUNDER', dongId: 22 },
    ]);
    expect(puts(calls).every((c) => c.authorization?.startsWith('Bearer '))).toBe(true);
  });

  it('사장님 칩은 서버 역할 OWNER 로 보낸다', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    const router = await start(app);
    await goTo(app, router, '/me');
    await app.screen.findByText('ID : 3');

    await app.user.click(app.screen.getByRole('radio', { name: '사장님' }));

    await app.waitFor(() => expect(router.state.location.pathname).toBe('/merchant'));
    expect(putBodies(calls)[1]).toEqual({ role: 'OWNER', dongId: 22 });
  });

  it('이미 선택된 역할을 다시 눌러도 서버에 보내지 않는다', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    const router = await start(app);
    await goTo(app, router, '/me');
    await app.screen.findByText('ID : 3');

    await app.user.click(app.screen.getByRole('radio', { name: '주민' }));

    expect(puts(calls)).toHaveLength(1); // 시작할 때의 한 번뿐
    expect(router.state.location.pathname).toBe('/me');
  });

  it('저장에 실패하면 이동하지 않고 오류 종류별 문구를 보여준다(서버 message 는 쓰지 않는다)', async () => {
    let failing = false;
    const { calls } = stubServer({
      put: (call) =>
        failing ? jsonResponse(500, { code: 'X', message: '서버 원문 노출 금지' }) : okPut(call),
    });
    const app = await loadApp();
    const router = await start(app);
    await goTo(app, router, '/me');
    await app.screen.findByText('ID : 3');
    failing = true;

    await app.user.click(app.screen.getByRole('radio', { name: '사장님' }));

    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/me');
    expect(app.screen.getByRole('radio', { name: '주민' })).toBeChecked();
    expect(puts(calls)).toHaveLength(2);
  });

  it('데모 세션에서는 서버에 보내지 않고 기존 데모 차단 문구를 보여준다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('true');
    const { router } = app.renderApp(['/?demo=owner']);
    await app.waitFor(() => expect(router.state.location.pathname).toBe('/merchant'));
    await goTo(app, router, '/me');
    await app.screen.findByText('ID : 3');

    await app.user.click(app.screen.getByRole('radio', { name: '주민' }));

    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '데모 계정은 사장님 화면만 볼 수 있어요. 나가려면 주소 끝에 ?demo=off를 붙여 주세요.',
    );
    expect(puts(calls)).toHaveLength(0);
    expect(router.state.location.pathname).toBe('/me');
  });

  it('사장님이면 GET /me 의 가게를 "가게명 · 업종" 으로 보여준다', async () => {
    stubServer({
      me: () =>
        jsonResponse(200, { id: 3, nickname: '민트', role: 'OWNER', dong: DONGS[0], shop: SHOP }),
    });
    const app = await loadApp();
    const router = await start(app, /^사장님/);
    await goTo(app, router, '/me');

    expect(await app.screen.findByText('싱싱과일 · 과일·채소')).toBeInTheDocument();
    expect(app.screen.getByText('내 가게')).toBeInTheDocument();
  });

  it('GET /me 에 닉네임·동네가 없어도(필드 누락) 깨지지 않는다', async () => {
    stubServer({ me: () => jsonResponse(200, { id: 3 }) });
    const app = await loadApp();
    const router = await start(app);
    await goTo(app, router, '/me');

    expect(await app.screen.findByText('ID : 3')).toBeInTheDocument();
    expect(app.screen.getByText('사용자')).toBeInTheDocument();
  });
});

describe('api 모드: 동네 선택의 저장', () => {
  async function openDong(app: App) {
    const router = await start(app);
    await goTo(app, router, '/me');
    await app.screen.findByText('ID : 3');
    await goTo(app, router, '/me/dong');
    await app.screen.findByRole('list', { name: '동 목록' });
    return router;
  }

  it('다른 동을 고르고 정하면 PUT /me 에 현재 역할과 새 동을 보내고, 내 정보로 돌아가 바뀐 동네를 보여준다', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    const router = await openDong(app);

    await app.user.click(app.screen.getByRole('button', { name: '보정동' }));
    await app.user.click(app.screen.getByRole('button', { name: '이 동네로 정하기' }));

    await app.waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(await app.screen.findByRole('link', { name: /내 동네/ })).toHaveTextContent(
      '기흥구 보정동',
    );
    expect(putBodies(calls)).toEqual([
      { role: 'RESIDENT', dongId: 22 },
      { role: 'RESIDENT', dongId: 28 },
    ]);
  });

  it('현재 동네와 같으면 PUT /me 를 부르지 않고 돌아간다', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    const router = await openDong(app);

    await app.user.click(app.screen.getByRole('button', { name: '이 동네로 정하기' }));

    await app.waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(puts(calls)).toHaveLength(1);
  });

  it('저장에 실패하면 이동하지 않고 오류 문구만 보여준다(서버 message 는 쓰지 않는다)', async () => {
    let failing = false;
    const { calls } = stubServer({
      put: (call) =>
        failing
          ? jsonResponse(404, { code: 'NOT_FOUND', message: '서버 원문 노출 금지' })
          : okPut(call),
    });
    const app = await loadApp();
    const router = await openDong(app);
    failing = true;

    await app.user.click(app.screen.getByRole('button', { name: '보정동' }));
    await app.user.click(app.screen.getByRole('button', { name: '이 동네로 정하기' }));

    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/me/dong');
    // 실패했으므로 내 동네는 그대로다(내 정보로 돌아가 확인).
    expect(puts(calls)).toHaveLength(2);
    expect(app.screen.getByRole('button', { name: '이 동네로 정하기' })).toBeEnabled();
  });

  it('저장하는 동안 다시 눌러도(화면이 다시 그려지기 전) 요청은 한 번만 나간다', async () => {
    const gate: { release: () => void } = { release: () => {} };
    let blocking = false;
    const { calls } = stubServer({
      put: (call) =>
        blocking
          ? new Promise<Response>((resolve) => {
              gate.release = () => resolve(okPut(call));
            })
          : okPut(call),
    });
    const app = await loadApp();
    const router = await openDong(app);
    blocking = true;
    await app.user.click(app.screen.getByRole('button', { name: '보정동' }));
    const button = app.screen.getByRole('button', { name: '이 동네로 정하기' });

    await app.act(async () => {
      button.click();
      button.click();
    });

    await app.waitFor(() => expect(puts(calls)).toHaveLength(2)); // 시작할 때 한 번 + 이번 저장 한 번
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(puts(calls)).toHaveLength(2);
    gate.release();
    await app.waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(puts(calls)).toHaveLength(2);
  });

  it('데모 세션에서는 서버에 보내지 않고 기존 데모 차단 문구를 보여준다', async () => {
    const { calls } = stubServer();
    const app = await loadApp('true');
    const { router } = app.renderApp(['/?demo=owner']);
    await app.waitFor(() => expect(router.state.location.pathname).toBe('/merchant'));
    await goTo(app, router, '/me/dong');
    await app.screen.findByRole('list', { name: '동 목록' });

    await app.user.click(app.screen.getByRole('button', { name: '구성동' }));
    await app.user.click(app.screen.getByRole('button', { name: '이 동네로 정하기' }));

    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '데모 계정은 사장님 화면만 볼 수 있어요. 나가려면 주소 끝에 ?demo=off를 붙여 주세요.',
    );
    expect(puts(calls)).toHaveLength(0);
    expect(router.state.location.pathname).toBe('/me/dong');
  });
});
