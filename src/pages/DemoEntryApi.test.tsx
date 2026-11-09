import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeJwt, jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 시연용 사장님 데모 진입(/?demo=owner)과 종료(/?demo=off), 데모 세션 보호.
 * 서비스 구현과 플래그는 import 시점에 정해지므로 환경 값을 바꾼 뒤 React·RTL·앱 모듈을 모두 새로 불러온다.
 */
type Rtl = typeof import('@testing-library/react');
let rtl: Rtl | null = null;

async function loadApp(opts: { source: 'mock' | 'api'; demoFlag: 'true' | '' }) {
  vi.stubEnv('VITE_DATA_SOURCE', opts.source);
  vi.stubEnv('VITE_API_BASE_URL', opts.source === 'api' ? 'https://api.test' : '');
  vi.stubEnv('VITE_ENABLE_DEMO_LOGIN', opts.demoFlag);
  vi.resetModules();
  rtl = await import('@testing-library/react');
  const userEvent = (await import('@testing-library/user-event')).default;
  const React = await import('react');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { AppProviders } = await import('@/app/providers');
  const { routes } = await import('@/app/routes');
  function render(entries: string[], strict = false) {
    const router = createMemoryRouter(routes, { initialEntries: entries });
    const tree = React.createElement(
      AppProviders,
      null,
      React.createElement(RouterProvider, { router }),
    );
    rtl!.render(strict ? React.createElement(React.StrictMode, null, tree) : tree);
    return router;
  }
  return { ...rtl, user: userEvent.setup(), render };
}

const KEY = 'yyt.session';
const DONGS = [
  { id: 22, name: '구성동', gu: '기흥구' },
  { id: 28, name: '보정동', gu: '기흥구' },
];
const DEMO_TOKEN = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });

type Handler = (call: StubCall) => Response | Promise<Response>;
function stubServer(routes: { demo?: Handler } = {}) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/demo') {
      return (
        routes.demo?.(call) ??
        jsonResponse(200, {
          accessToken: DEMO_TOKEN,
          expiresIn: 3600,
          isNew: false,
          user: { id: 54, role: 'OWNER', dongId: null },
        })
      );
    }
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, {
        accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        expiresIn: 3600,
      });
    }
    if (call.path === '/api/v1/me') {
      return call.method === 'PUT'
        ? jsonResponse(200, { id: 3, role: 'RESIDENT', dong: DONGS[0] })
        : jsonResponse(200, { id: 54, nickname: '데모', role: 'OWNER', dong: null, shop: null });
    }
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path.startsWith('/api/v1/owner/demand'))
      return jsonResponse(200, { radiusKm: 3, areas: [] });
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const putCalls = (calls: StubCall[]) => calls.filter((c) => c.method === 'PUT');
const demoCalls = (calls: StubCall[]) => calls.filter((c) => c.path === '/api/v1/auth/demo');
const storeDemoSession = () =>
  localStorage.setItem(
    KEY,
    JSON.stringify({ token: DEMO_TOKEN, expiresAt: Date.now() + 1e7, demo: true }),
  );
const storeGuestSession = () =>
  localStorage.setItem(KEY, JSON.stringify({ token: 'tok-guest', expiresAt: Date.now() + 1e7 }));

const BLOCKED =
  '데모 계정은 사장님 화면만 볼 수 있어요. 나가려면 주소 끝에 ?demo=off를 붙여 주세요.';
const MERCHANT_H1 = '내 업종을 원하는 동네';
const HOME_H1 = /우리 동네에 없는 가게/;

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('플래그가 꺼져 있거나 목 모드', () => {
  it('플래그가 꺼진 API 모드는 demo 파라미터를 무시한다(데모 로그인 없음, 주소 그대로, 메인 폼 정상)', async () => {
    const { calls } = stubServer();
    const app = await loadApp({ source: 'api', demoFlag: '' });
    const router = app.render(['/?demo=owner']);

    expect(await app.screen.findByRole('heading', { level: 1, name: HOME_H1 })).toBeInTheDocument();
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    expect(demoCalls(calls)).toHaveLength(0);
    expect(router.state.location.search).toBe('?demo=owner');
    expect(app.screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('플래그가 켜져 있어도 목 모드면 무시하고 fetch 가 호출되지 않는다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    const app = await loadApp({ source: 'mock', demoFlag: 'true' });
    const router = app.render(['/?demo=owner']);

    expect(await app.screen.findByRole('heading', { level: 1, name: HOME_H1 })).toBeInTheDocument();
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    expect(router.state.location.search).toBe('?demo=owner');
    expect(fn).not.toHaveBeenCalled();
  });

  it('플래그가 꺼져 있으면 ?demo=off 도 무시한다(토큰 유지)', async () => {
    storeGuestSession();
    stubServer();
    const app = await loadApp({ source: 'api', demoFlag: '' });
    const router = app.render(['/?demo=off']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });

    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(router.state.location.search).toBe('?demo=off');
  });
});

describe('?demo=owner (플래그 켜짐)', () => {
  it('POST /auth/demo 로 로그인하고 토큰·데모 표시를 저장한 뒤 PUT /me 없이 사장님 화면으로 이동한다', async () => {
    const { calls } = stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    const router = app.render(['/?demo=owner']);

    expect(
      await app.screen.findByRole('heading', { level: 1, name: MERCHANT_H1 }),
    ).toBeInTheDocument();
    expect(demoCalls(calls)).toHaveLength(1);
    expect(JSON.parse(demoCalls(calls)[0]?.body ?? '{}')).toEqual({ role: 'OWNER' });
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toMatchObject({
      token: DEMO_TOKEN,
      demo: true,
    });
    expect(putCalls(calls)).toHaveLength(0);
    expect(router.state.location.pathname).toBe('/merchant');
    expect(router.state.location.search).toBe('');
  });

  it('사장님 역할이 선택 Context 에 설정된다(메인으로 돌아오면 사장님이 미리 선택돼 있다)', async () => {
    stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    const router = app.render(['/?demo=owner']);
    await app.screen.findByRole('heading', { level: 1, name: MERCHANT_H1 });

    await app.act(() => router.navigate('/'));

    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    expect(app.screen.getByRole('radio', { name: /^사장님/ })).toBeChecked();
  });

  it('로그인하는 동안은 폼 대신 기존 로딩 표시를 보인다', async () => {
    let finish: (r: Response) => void = () => undefined;
    stubServer({ demo: () => new Promise<Response>((resolve) => (finish = resolve)) });
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    app.render(['/?demo=owner']);

    expect(await app.screen.findByText('불러오는 중이에요.')).toBeInTheDocument();
    expect(app.screen.queryByRole('button', { name: '시작하기' })).not.toBeInTheDocument();

    finish(jsonResponse(200, { accessToken: DEMO_TOKEN, expiresIn: 3600 }));
    expect(
      await app.screen.findByRole('heading', { level: 1, name: MERCHANT_H1 }),
    ).toBeInTheDocument();
  });

  it('StrictMode 에서도 데모 로그인은 한 번만 호출한다', async () => {
    const { calls } = stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    app.render(['/?demo=owner'], true);

    expect(
      await app.screen.findByRole('heading', { level: 1, name: MERCHANT_H1 }),
    ).toBeInTheDocument();
    expect(demoCalls(calls)).toHaveLength(1);
    expect(putCalls(calls)).toHaveLength(0);
  });

  it('실패하면 이동하지 않고 오류 문구를 보이며 메인 폼이 정상이고 주소에서 파라미터가 지워진다', async () => {
    const { calls } = stubServer({
      demo: () => jsonResponse(500, { code: 'X', message: '서버 원문' }),
    });
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    const router = app.render(['/?demo=owner']);

    expect(
      await app.screen.findByText('일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(app.screen.getByRole('heading', { level: 1, name: HOME_H1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('');
    // 데모 세션은 만들어지지 않았다(동네 목록을 읽으려고 새 게스트가 됐을 수는 있다).
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).not.toHaveProperty('demo');

    // 폼은 정상이라 일반 흐름(PUT /me)으로 시작할 수 있다.
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
    expect(
      await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' }),
    ).toBeInTheDocument();
    expect(putCalls(calls)).toHaveLength(1);
  });

  it('네트워크 오류도 코드·종류별 문구를 보인다', async () => {
    stubServer({
      demo: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    app.render(['/?demo=owner']);

    expect(
      await app.screen.findByText('네트워크 연결을 확인하고 다시 시도해 주세요.'),
    ).toBeInTheDocument();
  });
});

describe('데모 세션에서 "시작하기"', () => {
  async function openHomeInDemo() {
    storeDemoSession();
    const stub = stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    const router = app.render(['/']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    return { ...stub, app, router };
  }

  it.each([
    ['주민', /^주민/],
    ['예비 창업자', /^예비 창업자/],
  ])('%s 를 고르면 PUT /me 없이 안내 문구를 보이고 이동하지 않는다', async (_name, role) => {
    const { calls, app, router } = await openHomeInDemo();

    await app.user.click(app.screen.getByRole('radio', { name: role }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));

    expect(await app.screen.findByRole('alert')).toHaveTextContent(BLOCKED);
    expect(router.state.location.pathname).toBe('/');
    expect(putCalls(calls)).toHaveLength(0);
  });

  it('사장님을 고르면 서버 호출(PUT /me) 없이 사장님 화면으로 이동한다', async () => {
    const { calls, app } = await openHomeInDemo();

    await app.user.click(app.screen.getByRole('radio', { name: /^사장님/ }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));

    expect(
      await app.screen.findByRole('heading', { level: 1, name: MERCHANT_H1 }),
    ).toBeInTheDocument();
    expect(putCalls(calls)).toHaveLength(0);
  });

  it('일반(게스트) 세션에서는 기존 PUT /me 흐름이 그대로다(플래그가 켜져 있어도)', async () => {
    storeGuestSession();
    const { calls } = stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    app.render(['/']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });

    await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' }),
    ).toBeInTheDocument();
    expect(putCalls(calls)).toHaveLength(1);
    expect(JSON.parse(putCalls(calls)[0]?.body ?? '{}')).toEqual({ role: 'RESIDENT', dongId: 22 });
  });

  it('데모 세션에서 사장님 화면을 새로고침(라우트로 진입)해도 사장님 화면이 유지된다', async () => {
    storeDemoSession();
    stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    app.render(['/merchant']);

    expect(
      await app.screen.findByRole('heading', { level: 1, name: MERCHANT_H1 }),
    ).toBeInTheDocument();
  });
});

describe('?demo=off (플래그 켜짐)', () => {
  it('토큰과 데모 표시를 지우고 선택을 비우며 주소에서 파라미터를 지운다', async () => {
    storeDemoSession();
    const { calls } = stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    const router = app.render(['/?demo=off']);

    expect(await app.screen.findByRole('heading', { level: 1, name: HOME_H1 })).toBeInTheDocument();
    await app.waitFor(() => expect(router.state.location.search).toBe(''));
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    // 토큰과 데모 표시가 지워졌고(다음 호출에서 새 게스트가 된다) 데모 로그인은 다시 하지 않았다.
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(demoCalls(calls)).toHaveLength(0);
    app.screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked());
  });

  it('이미 사장님이 선택된 상태에서 ?demo=off 로 열면 선택도 비워진다', async () => {
    storeDemoSession();
    stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    const router = app.render(['/']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    await app.user.click(app.screen.getByRole('radio', { name: /^사장님/ }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
    await app.screen.findByRole('heading', { level: 1, name: MERCHANT_H1 });

    await app.act(() => router.navigate('/?demo=off'));

    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    app.screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked());
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('데모를 끝낸 뒤에는 일반 흐름이라 PUT /me 로 저장된다', async () => {
    storeDemoSession();
    const { calls } = stubServer();
    const app = await loadApp({ source: 'api', demoFlag: 'true' });
    app.render(['/?demo=off']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });

    await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' }),
    ).toBeInTheDocument();
    expect(putCalls(calls)).toHaveLength(1);
  });
});
