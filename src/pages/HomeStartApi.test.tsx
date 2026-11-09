import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 메인 화면의 "시작하기"(역할·동네 저장). 서비스 구현은 import 시점에 mock | api 로 정해지므로
 * 환경 값을 바꾼 뒤 React·RTL·앱 모듈을 모두 새로 불러온다(React 인스턴스가 하나여야 해서 RTL 도 함께 새로 불러온다).
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
const ME = {
  id: 3,
  nickname: '게스트',
  role: 'FOUNDER',
  dong: { id: 28, name: '보정동', gu: '기흥구' },
  shop: null,
};
const CATEGORIES = [{ id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true }];

type PutHandler = (call: StubCall) => Response | Promise<Response>;

/** 서버를 흉내 내는 fetch 스텁. PUT /me 의 동작만 테스트마다 바꾼다. */
function stubServer(put: PutHandler = () => jsonResponse(200, ME)) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.method === 'PUT' && call.path === '/api/v1/me') return put(call);
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    return jsonResponse(404, { code: 'NOT_FOUND', message: 'x' });
  });
}

const putCalls = (calls: StubCall[]) => calls.filter((c) => c.method === 'PUT');

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  // 새로 불러온 RTL 이 그린 화면은 setup.ts 의 cleanup(처음 불러온 RTL)이 지우지 못한다.
  rtl?.cleanup();
  rtl = null;
});

describe('api 모드의 메인 화면', () => {
  it('동네 목록을 서버 데이터로 보여주고 첫 동네가 기본 선택이다(숫자 id 는 문자열 값으로)', async () => {
    stubServer();
    const { renderApp, screen } = await loadApp('api');
    renderApp(['/']);

    const select = await screen.findByRole('combobox', { name: '내 동네' });
    await screen.findByRole('option', { name: '기흥구 구성동' });
    expect(
      screen.getAllByRole('option').map((o) => [o.textContent, (o as HTMLOptionElement).value]),
    ).toEqual([
      ['기흥구 구성동', '22'],
      ['기흥구 보정동', '28'],
    ]);
    expect(select).toHaveDisplayValue('기흥구 구성동');
    expect(select).toBeEnabled();
  });

  it('"시작하기"는 PUT /me 를 {role, dongId}(숫자)로 호출하고 성공하면 역할별 기본 페이지로 이동한다', async () => {
    const { calls } = stubServer();
    const { renderApp, screen, user } = await loadApp('api');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 보정동' });

    await user.selectOptions(screen.getByLabelText('내 동네'), '기흥구 보정동');
    await user.click(screen.getByRole('radio', { name: /^예비 창업자/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await screen.findByRole('heading', { level: 1, name: '입지 찾기' })).toBeInTheDocument();
    const put = putCalls(calls);
    expect(put).toHaveLength(1);
    expect(put[0]).toMatchObject({ path: '/api/v1/me', authorization: 'Bearer tok-1' });
    expect(JSON.parse(put[0]!.body!)).toEqual({ role: 'FOUNDER', dongId: 28 });
  });

  it.each([
    [/^주민/, 'RESIDENT', '동네 탐색'],
    [/^사장님/, 'OWNER', '내 업종을 원하는 동네'],
    [/^예비 창업자/, 'FOUNDER', '입지 찾기'],
  ])('역할 %s 는 서버 코드 %s 로 저장하고 %s 화면으로 이동한다', async (roleName, code, title) => {
    const { calls } = stubServer();
    const { renderApp, screen, user } = await loadApp('api');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });

    await user.click(screen.getByRole('radio', { name: roleName }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(JSON.parse(putCalls(calls)[0]!.body!)).toEqual({ role: code, dongId: 22 });
  });

  it('저장하는 동안 버튼은 loading 이고 다시 눌러도 요청은 한 번만 나가며, 끝나면 이동한다', async () => {
    let finish: (response: Response) => void = () => undefined;
    const { calls } = stubServer(() => new Promise<Response>((resolve) => (finish = resolve)));
    const { renderApp, screen, user, waitFor } = await loadApp('api');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^주민/ }));

    const button = screen.getByRole('button', { name: '시작하기' });
    await user.click(button);
    await waitFor(() => expect(putCalls(calls)).toHaveLength(1));
    expect(screen.getByRole('button', { name: /시작하기/ })).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: /시작하기/ }));
    await user.click(screen.getByRole('button', { name: /시작하기/ }));

    expect(putCalls(calls)).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: /우리 동네에 없는 가게/ }),
    ).toBeInTheDocument();

    finish(jsonResponse(200, ME));

    expect(await screen.findByRole('heading', { level: 1, name: '동네 탐색' })).toBeInTheDocument();
    expect(putCalls(calls)).toHaveLength(1);
  });

  it('버튼 클릭이 아니어도(폼 submit 이벤트가 직접 와도) 저장 중에는 요청이 한 번만 나간다', async () => {
    let finish: (response: Response) => void = () => undefined;
    const { calls } = stubServer(() => new Promise<Response>((resolve) => (finish = resolve)));
    const { renderApp, screen, user, waitFor, fireEvent } = await loadApp('api');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^주민/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(putCalls(calls)).toHaveLength(1));

    const form = screen.getByRole('button', { name: /시작하기/ }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    // 두 번째 요청이 있었다면 비동기로 나가므로 잠시 기다린 뒤 센다.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(putCalls(calls)).toHaveLength(1);
    finish(jsonResponse(200, ME));
    expect(await screen.findByRole('heading', { level: 1, name: '동네 탐색' })).toBeInTheDocument();
  });

  it.each([
    [
      '404 NOT_FOUND',
      () => jsonResponse(404, { code: 'NOT_FOUND', message: '서버 문구' }),
      '선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.',
    ],
    [
      '400 VALIDATION_ERROR',
      () => jsonResponse(400, { code: 'VALIDATION_ERROR', message: '서버 문구' }),
      '선택한 정보를 확인하지 못했어요. 역할과 동네를 다시 선택해 주세요.',
    ],
    [
      '403 FORBIDDEN',
      () => jsonResponse(403, { code: 'FORBIDDEN', message: '서버 문구' }),
      '이 화면을 볼 수 있는 역할이 아니에요. 처음 화면에서 역할을 다시 선택해 주세요.',
    ],
    [
      '500 서버 오류',
      () => jsonResponse(500, { code: 'X', message: '서버 문구' }),
      '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    ],
    [
      '502 HTML',
      () => new Response('<html>Bad Gateway</html>', { status: 502 }),
      '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    ],
    [
      '네트워크 오류',
      () => {
        throw new TypeError('Failed to fetch');
      },
      '네트워크 연결을 확인하고 다시 시도해 주세요.',
    ],
  ])(
    '%s 이면 이동하지 않고 코드별 안내를 보여주며(서버 message 는 쓰지 않는다) 다시 시도할 수 있다',
    async (_name, put, text) => {
      stubServer(put);
      const { renderApp, screen, user } = await loadApp('api');
      renderApp(['/']);
      await screen.findByRole('option', { name: '기흥구 구성동' });
      await user.click(screen.getByRole('radio', { name: /^사장님/ }));

      await user.click(screen.getByRole('button', { name: '시작하기' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(text);
      expect(alert).not.toHaveTextContent('서버 문구');
      expect(
        screen.getByRole('heading', { level: 1, name: /우리 동네에 없는 가게/ }),
      ).toBeInTheDocument();
      // 선택은 그대로이고 버튼은 다시 눌러 볼 수 있다.
      expect(screen.getByRole('radio', { name: /^사장님/ })).toBeChecked();
      expect(screen.getByRole('button', { name: '시작하기' })).not.toHaveAttribute('aria-busy');
    },
  );

  it('401 이 재로그인 뒤에도 계속되면 로그인 상태 안내를 보여준다', async () => {
    const { calls } = stubServer(() => jsonResponse(401, { code: 'UNAUTHORIZED', message: 'x' }));
    const { renderApp, screen, user } = await loadApp('api');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^주민/ }));

    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(putCalls(calls)).toHaveLength(2); // 한 번 재시도하고 끝(무한 루프 없음)
  });

  it('실패 뒤 다시 누르면 성공하고 이동하며, 역할이나 동네를 바꾸면 안내가 사라진다', async () => {
    let attempt = 0;
    const { calls } = stubServer(() =>
      ++attempt === 1 ? jsonResponse(500, { code: 'X', message: 'x' }) : jsonResponse(200, ME),
    );
    const { renderApp, screen, user } = await loadApp('api');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^주민/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^사장님/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '내 업종을 원하는 동네' }),
    ).toBeInTheDocument();
    expect(putCalls(calls)).toHaveLength(2);
  });

  it('역할을 고르지 않으면 요청 없이 기존 안내(role="alert")를 보여주고 첫 라디오로 포커스를 옮긴다', async () => {
    const { calls } = stubServer();
    const { renderApp, screen, user } = await loadApp('api');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });

    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(screen.getByRole('alert')).toHaveTextContent('역할을 선택해 주세요.');
    expect(screen.getAllByRole('radio')[0]).toHaveFocus();
    expect(putCalls(calls)).toHaveLength(0);
  });

  it('선택한 역할·동네는 저장 성공 뒤에만 메모리 Context 에 들어간다(실패하면 이동하지 않는다)', async () => {
    stubServer(() => jsonResponse(404, { code: 'NOT_FOUND', message: 'x' }));
    const { renderApp, screen, user } = await loadApp('api');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^주민/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await screen.findByRole('alert');

    // 주민 화면으로 직접 이동하려면 동네 선택이 필요하다는 안내가 보여야 한다(Context 가 비어 있다).
    expect(screen.queryByRole('navigation', { name: '주민 메뉴' })).not.toBeInTheDocument();
  });
});

describe('mock 모드의 메인 화면(기존 동작 그대로)', () => {
  it('fetch 를 부르지 않고, 저장을 기다리지 않고 바로(동기로) 이동한다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, {}));
    const { renderApp, screen, user } = await loadApp('mock');
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });

    await user.click(screen.getByRole('radio', { name: /^예비 창업자/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    // findBy 가 아니라 getBy: 클릭 직후 이미 이동해 있다(await 없이 이동하는 기존 동작).
    expect(screen.getByRole('heading', { level: 1, name: '입지 찾기' })).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('동네 목록은 목 데이터이고 loading 표시 없이 이동한다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, {}));
    const { renderApp, screen, user } = await loadApp('mock');
    renderApp(['/']);

    await screen.findByRole('option', { name: '기흥구 구성동' });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '기흥구 구성동',
      '기흥구 보정동',
      '기흥구 마북동',
    ]);
    await user.click(screen.getByRole('radio', { name: /^주민/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(screen.getByRole('heading', { level: 1, name: '동네 탐색' })).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});
