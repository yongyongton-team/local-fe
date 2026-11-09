import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 새로고침 뒤 서버에 저장된 역할·동네로 선택 Context 를 복원한다(API 모드, GET /me).
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

const DONGS = [
  { id: 17, name: '구갈동', gu: '기흥구' },
  { id: 22, name: '구성동', gu: '기흥구' },
  { id: 28, name: '보정동', gu: '기흥구' },
];
const CATEGORIES = [{ id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true }];
const ME = (over: Record<string, unknown> = {}) => ({
  id: 3,
  nickname: '게스트',
  role: 'RESIDENT',
  dong: { id: 28, name: '보정동', gu: '기흥구' },
  shop: null,
  ...over,
});

type Handler = (call: StubCall) => Response | Promise<Response>;
function stubServer(getMe: Handler) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-new', expiresIn: 3600, isNew: true });
    }
    if (call.path === '/api/v1/me') {
      return call.method === 'PUT' ? jsonResponse(200, ME()) : getMe(call);
    }
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (/\/gaps$/.test(call.path)) return jsonResponse(200, []);
    if (/\/map$/.test(call.path)) return jsonResponse(200, { stores: [] });
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const meCalls = (calls: StubCall[]) =>
  calls.filter((c) => c.path === '/api/v1/me' && c.method === 'GET');

/** 저장된 토큰이 있는 상태(새로고침 뒤). 값은 테스트용 가짜다. */
const storeToken = () =>
  localStorage.setItem(
    'yyt.session',
    JSON.stringify({ token: 'tok-saved', expiresAt: Date.now() + 1e7 }),
  );

const NOTICE = '내 동네를 먼저 선택해 주세요';
const LOADING = '불러오는 중이에요.';

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('GET /me 로 선택 복원', () => {
  it('토큰이 있고 role·dong 이 있으면 Context 를 채운다(id 는 문자열, district 는 gu)', async () => {
    storeToken();
    const { calls } = stubServer(() => jsonResponse(200, ME()));
    const app = await loadApp('api');
    app.renderApp(['/resident']);

    expect(await app.screen.findByRole('link', { name: /기흥구 보정동/ })).toBeInTheDocument();
    expect(app.screen.queryByText(NOTICE)).not.toBeInTheDocument();
    // 주민 조회가 복원된 동네의 숫자 id(28)로 나간다 = Context 의 id 가 "28" 이다.
    await app.waitFor(() =>
      expect(calls.some((c) => c.path === '/api/v1/dongs/28/gaps')).toBe(true),
    );
    expect(meCalls(calls)).toHaveLength(1);
    expect(meCalls(calls)[0]?.authorization).toBe('Bearer tok-saved');
  });

  it('토큰이 없으면 GET /me 를 부르지 않고(로그인도 없이) 바로 선택 안내를 보여준다', async () => {
    const { calls } = stubServer(() => jsonResponse(200, ME()));
    const app = await loadApp('api');
    app.renderApp(['/resident']);

    expect(await app.screen.findByText(NOTICE)).toBeInTheDocument();
    expect(app.screen.queryByText(LOADING)).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('만료된 토큰은 없는 것으로 보고 GET /me 를 부르지 않는다', async () => {
    localStorage.setItem('yyt.session', JSON.stringify({ token: 'tok-old', expiresAt: 1 }));
    const { calls } = stubServer(() => jsonResponse(200, ME()));
    const app = await loadApp('api');
    app.renderApp(['/resident']);

    expect(await app.screen.findByText(NOTICE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['role 이 null', { role: null }],
    ['dong 이 null', { dong: null }],
    ['role 과 dong 이 모두 null(새 게스트·만료 후 새 게스트)', { role: null, dong: null }],
    ['알 수 없는 role', { role: 'ADMIN' }],
    ['dong 에 id 가 없음', { dong: { name: '보정동', gu: '기흥구' } }],
  ])('%s 이면 선택 없는 상태다', async (_name, over) => {
    storeToken();
    stubServer(() => jsonResponse(200, ME(over)));
    const app = await loadApp('api');
    app.renderApp(['/resident']);

    expect(await app.screen.findByText(NOTICE)).toBeInTheDocument();
  });

  it('복원 중에는 선택 안내 대신 로딩을 보이고, 끝나면 복원된 화면을 보여준다', async () => {
    storeToken();
    let finish: (response: Response) => void = () => undefined;
    stubServer(() => new Promise<Response>((resolve) => (finish = resolve)));
    const app = await loadApp('api');
    app.renderApp(['/resident']);

    expect(await app.screen.findByText(LOADING)).toBeInTheDocument();
    expect(app.screen.getByRole('heading', { level: 1, name: '동네 탐색' })).toBeInTheDocument();
    expect(app.screen.queryByText(NOTICE)).not.toBeInTheDocument();

    finish(jsonResponse(200, ME()));

    expect(await app.screen.findByRole('link', { name: /기흥구 보정동/ })).toBeInTheDocument();
    expect(app.screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('요청 화면도 복원 중에는 안내 대신 로딩을 보인다', async () => {
    storeToken();
    let finish: (response: Response) => void = () => undefined;
    stubServer(() => new Promise<Response>((resolve) => (finish = resolve)));
    const app = await loadApp('api');
    app.renderApp(['/resident/requests/new']);

    expect(await app.screen.findByText(LOADING)).toBeInTheDocument();
    expect(app.screen.queryByText(NOTICE)).not.toBeInTheDocument();

    finish(jsonResponse(200, ME({ role: null, dong: null })));
    expect(await app.screen.findByText(NOTICE)).toBeInTheDocument();
  });

  it.each([
    ['500', () => jsonResponse(500, { code: 'X' })],
    [
      '네트워크 오류',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
    ['본문이 비어 있음', () => jsonResponse(200, null)],
  ])(
    'GET /me 가 실패(%s)해도 멈추지 않고 선택 없는 상태이며, 메인에서 다시 선택할 수 있다',
    async (_n, getMe) => {
      storeToken();
      const { calls } = stubServer(getMe);
      const app = await loadApp('api');
      app.renderApp(['/resident']);

      expect(await app.screen.findByText(NOTICE)).toBeInTheDocument();
      expect(app.screen.queryByText(LOADING)).not.toBeInTheDocument();

      await app.user.click(app.screen.getByRole('link', { name: '첫 화면으로' }));
      await app.screen.findByRole('option', { name: '기흥구 구성동' });
      await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
      await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));

      expect(
        await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' }),
      ).toBeInTheDocument();
      expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
      expect(meCalls(calls)).toHaveLength(1);
    },
  );
});

describe('메인 화면 폼 초기값', () => {
  it('복원된 역할·동네로 미리 채우고 자동으로 이동하지 않는다', async () => {
    storeToken();
    const { calls } = stubServer(() => jsonResponse(200, ME({ role: 'OWNER' })));
    const app = await loadApp('api');
    app.renderApp(['/']);

    await app.waitFor(() =>
      expect(app.screen.getByRole('radio', { name: /^사장님/ })).toBeChecked(),
    );
    expect(app.screen.getByLabelText('내 동네')).toHaveDisplayValue('기흥구 보정동');
    expect((app.screen.getByLabelText('내 동네') as HTMLSelectElement).value).toBe('28');
    // 이동하지 않았다: 메인 제목이 그대로 있고 PUT 도 없다.
    expect(
      app.screen.getByRole('heading', { level: 1, name: /우리 동네에 없는 가게/ }),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);

    // 시작하기를 눌러야 이동하고, 복원된 값 그대로 PUT /me 로 저장한다.
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
    expect(
      await app.screen.findByRole('heading', { level: 1, name: '내 업종을 원하는 동네' }),
    ).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT');
    expect(JSON.parse(put?.body ?? '{}')).toEqual({ role: 'OWNER', dongId: 28 });
  });

  it('복원된 동네가 목록에 없으면 첫 항목을 보여주고 그대로 시작할 수 있다', async () => {
    storeToken();
    const { calls } = stubServer(() =>
      jsonResponse(200, ME({ dong: { id: 99, name: '없는동', gu: '기흥구' } })),
    );
    const app = await loadApp('api');
    app.renderApp(['/']);
    await app.screen.findByRole('option', { name: '기흥구 구갈동' });
    await app.waitFor(() => expect(app.screen.getByRole('radio', { name: /^주민/ })).toBeChecked());

    expect((app.screen.getByLabelText('내 동네') as HTMLSelectElement).value).toBe('17');
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' }),
    ).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.method === 'PUT')?.body ?? '{}')).toEqual({
      role: 'RESIDENT',
      dongId: 17,
    });
  });

  it('복원 값이 없으면 기존처럼 역할은 선택 없음, 동네는 목록의 첫 항목이다', async () => {
    storeToken();
    stubServer(() => jsonResponse(200, ME({ role: null, dong: null })));
    const app = await loadApp('api');
    app.renderApp(['/']);

    await app.screen.findByRole('option', { name: '기흥구 구갈동' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    app.screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked());
    expect(app.screen.getByLabelText('내 동네')).toHaveDisplayValue('기흥구 구갈동');
  });

  it('복원이 늦게 끝나도 사용자가 이미 고른 역할·동네를 덮어쓰지 않는다', async () => {
    storeToken();
    let finish: (response: Response) => void = () => undefined;
    stubServer(() => new Promise<Response>((resolve) => (finish = resolve)));
    const app = await loadApp('api');
    app.renderApp(['/']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });

    await app.user.click(app.screen.getByRole('radio', { name: /^예비 창업자/ }));
    await app.user.selectOptions(app.screen.getByLabelText('내 동네'), '기흥구 구성동');
    finish(jsonResponse(200, ME({ role: 'OWNER' })));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(app.screen.getByRole('radio', { name: /^예비 창업자/ })).toBeChecked();
    expect(app.screen.getByRole('radio', { name: /^사장님/ })).not.toBeChecked();
    expect(app.screen.getByLabelText('내 동네')).toHaveDisplayValue('기흥구 구성동');
  });

  it('복원이 끝나기 전에 시작하기로 이동했다면 늦게 온 복원 값이 선택을 바꾸지 않는다', async () => {
    storeToken();
    let finish: (response: Response) => void = () => undefined;
    stubServer(() => new Promise<Response>((resolve) => (finish = resolve)));
    const app = await loadApp('api');
    app.renderApp(['/']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    await app.user.selectOptions(app.screen.getByLabelText('내 동네'), '기흥구 구성동');
    await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
    expect(await app.screen.findByRole('link', { name: /기흥구 구성동/ })).toBeInTheDocument();

    finish(jsonResponse(200, ME()));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(app.screen.getByRole('link', { name: /기흥구 구성동/ })).toBeInTheDocument();
    expect(app.screen.queryByRole('link', { name: /기흥구 보정동/ })).not.toBeInTheDocument();
  });
});

describe('mock 모드', () => {
  it('fetch 를 호출하지 않고 로딩 상태도 거치지 않는다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    localStorage.setItem(
      'yyt.session',
      JSON.stringify({ token: 'x', expiresAt: Date.now() + 1e7 }),
    );
    const app = await loadApp('mock');
    const { SelectionProvider, useSelection } =
      await import('@/features/selection/SelectionContext');
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useSelection().restoring);
      return null;
    }
    app.render(
      <SelectionProvider>
        <Probe />
      </SelectionProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((restoring) => restoring === false)).toBe(true);
    expect(fn).not.toHaveBeenCalled();

    app.cleanup();
    app.renderApp(['/resident']);
    expect(await app.screen.findByText(NOTICE)).toBeInTheDocument();
    expect(app.screen.queryByText(LOADING)).not.toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it('API 모드도 토큰이 없으면 restoring 이 처음부터 끝까지 false 다(로딩 깜빡임 없음)', async () => {
    const { calls } = stubServer(() => jsonResponse(200, ME()));
    const app = await loadApp('api');
    const { SelectionProvider, useSelection } =
      await import('@/features/selection/SelectionContext');
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useSelection().restoring);
      return null;
    }
    app.render(
      <SelectionProvider>
        <Probe />
      </SelectionProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((restoring) => restoring === false)).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('API 모드는 토큰이 있을 때만 restoring 이 true 에서 false 로 한 번 바뀐다', async () => {
    storeToken();
    stubServer(() => jsonResponse(200, ME({ role: null, dong: null })));
    const app = await loadApp('api');
    const { SelectionProvider, useSelection } =
      await import('@/features/selection/SelectionContext');
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useSelection().restoring);
      return null;
    }
    app.render(
      <SelectionProvider>
        <Probe />
      </SelectionProvider>,
    );
    await app.waitFor(() => expect(seen.at(-1)).toBe(false));

    expect(seen[0]).toBe(true);
    expect(seen.filter((v, i) => i > 0 && seen[i - 1] !== v)).toEqual([false]);
  });
});
