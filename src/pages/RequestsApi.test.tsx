import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 요청 작성(정리·생성)과 내 요청의 API 모드. 서비스 구현은 import 시점에 mock | api 로 정해지므로
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
type App = Awaited<ReturnType<typeof loadApp>>;

const ME = {
  id: 3,
  nickname: '게스트',
  role: 'RESIDENT',
  dong: { id: 1, name: '포곡읍', gu: '처인구' },
  shop: null,
};
/** 서버 업종 38개: 첫 업종은 FRUIT_VEG, 33번은 태권도장 */
const CATEGORIES = Array.from({ length: 38 }, (_, i) => {
  const id = i + 1;
  if (id === 7) return { id, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true };
  if (id === 33) return { id, code: 'MARTIAL_ARTS', name: '태권도장', martCheck: false };
  return { id, code: `CODE_${id}`, name: `업종${id}`, martCheck: false };
});
const MY_ITEM = {
  id: 351,
  dong: { id: 1, name: '포곡읍' },
  category: { id: 33, name: '태권도장' },
  count: 12,
  timeSlots: ['WEEKDAY_EVENING', 'WEEKEND'],
  frequency: 'WEEKLY_PLUS',
  createdAt: '2026-11-09T10:55:54+09:00',
  offers: [],
};

type Handler = (call: StubCall) => Response | Promise<Response>;
interface Routes {
  me?: Handler;
  parse?: Handler;
  create?: Handler;
  mine?: Handler;
}
function stubServer(routes: Routes = {}) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-new', expiresIn: 3600, isNew: true });
    }
    if (call.path === '/api/v1/me') return routes.me?.(call) ?? jsonResponse(200, ME);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (call.path === '/api/v1/requests/parse') {
      return routes.parse?.(call) ?? jsonResponse(200, { category: null, conditions: [] });
    }
    if (call.path === '/api/v1/requests' && call.method === 'POST') {
      return routes.create?.(call) ?? jsonResponse(201, { request: { id: 351 } });
    }
    if (call.path === '/api/v1/me/requests') return routes.mine?.(call) ?? jsonResponse(200, []);
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const posts = (calls: StubCall[]) =>
  calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/requests');

/** 저장된 토큰이 있는 상태(새로고침 뒤). 값은 테스트용 가짜다. */
const storeToken = () =>
  localStorage.setItem(
    'yyt.session',
    JSON.stringify({ token: 'tok-saved', expiresAt: Date.now() + 1e7 }),
  );

const PARSED = {
  category: { id: 33, name: '태권도장' },
  conditions: [{ code: 'LATE_OPEN', label: '늦게까지 영업' }],
  alreadyRequested: false,
  candidates: [],
  by: 'AI',
};

async function openForm(app: App) {
  app.renderApp(['/resident/requests/new']);
  return app.screen.findByLabelText('어떤 가게가 생기면 갈까요?');
}
/** 문장 입력. user.type 은 "[" 를 키 설명으로 읽으므로 붙여넣기로 넣는다. */
async function writeText(app: App, box: HTMLElement, text: string) {
  await app.user.click(box);
  await app.user.paste(text);
}
async function chooseVisit(app: App) {
  await app.user.click(app.screen.getByRole('button', { name: '평일 저녁' }));
  await app.user.click(app.screen.getByRole('radio', { name: '가끔' }));
}
const submitButton = (app: App) => app.screen.getByRole('button', { name: '요청 보내기' });

beforeEach(() => {
  localStorage.clear();
  storeToken();
});
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('api 모드의 요청 작성', () => {
  it('복원 중에는 선택 안내 대신 로딩을 보이고, 끝나면 폼을 보여준다', async () => {
    let finish: (response: Response) => void = () => undefined;
    stubServer({ me: () => new Promise<Response>((resolve) => (finish = resolve)) });
    const app = await loadApp('api');
    app.renderApp(['/resident/requests/new']);

    expect(await app.screen.findByText('불러오는 중이에요.')).toBeInTheDocument();
    expect(app.screen.queryByText('내 동네를 먼저 선택해 주세요')).not.toBeInTheDocument();

    finish(jsonResponse(200, ME));
    expect(await app.screen.findByLabelText('어떤 가게가 생기면 갈까요?')).toBeInTheDocument();
    expect(app.screen.getByText(/처인구 포곡읍/)).toBeInTheDocument();
  });

  it('업종이 정해지지 않으면 서버 업종 38개를 칩으로 보여주고 "예시 정리" 표시는 없다', async () => {
    stubServer();
    const app = await loadApp('api');
    await writeText(app, await openForm(app), '[프론트 테스트] 뭔가');

    const card = await app.screen.findByRole('region', { name: '요청 정리 결과' });
    const chips = app.within(card).getAllByRole('radio');
    expect(chips).toHaveLength(38);
    expect(chips[0]).toHaveAccessibleName('업종1');
    expect(app.within(card).getByRole('radio', { name: '과일 / 채소 가게' })).toBeInTheDocument();
    expect(app.within(card).queryByText(/예시 정리/)).not.toBeInTheDocument();
  });

  it('정리 성공: 업종·조건을 보여주고, 시간대·빈도를 고르면 숫자 id·서버 코드로 보내고 내 요청으로 이동한다', async () => {
    const { calls } = stubServer({
      parse: () => jsonResponse(200, PARSED),
      mine: () => jsonResponse(200, [MY_ITEM]),
    });
    const app = await loadApp('api');
    await writeText(app, await openForm(app), '[프론트 테스트] 늦게까지 하는 태권도장');

    const card = await app.screen.findByRole('region', { name: '요청 정리 결과' });
    expect(app.within(card).getByText('태권도장')).toBeInTheDocument();
    expect(app.within(card).getByText('늦게까지 영업')).toBeInTheDocument();
    expect(app.within(card).queryByRole('radio')).not.toBeInTheDocument();

    // 서버는 시간대(1개 이상)와 빈도를 필수로 받는다. 고르지 않고 누르면 요청 없이 안내만 보이고(버튼은 막지 않는다), 고르면 안내가 사라진다.
    expect(submitButton(app)).toBeEnabled();
    await app.user.click(submitButton(app));
    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '방문 시간대와 빈도를 골라 주세요.',
    );
    expect(posts(calls)).toHaveLength(0);
    await chooseVisit(app);
    expect(app.screen.queryByRole('alert')).not.toBeInTheDocument();
    await app.user.click(submitButton(app));

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '내 요청' }),
    ).toBeInTheDocument();
    expect(JSON.parse(posts(calls)[0]?.body ?? '{}')).toEqual({
      dongId: 1,
      categoryId: 33,
      text: '[프론트 테스트] 늦게까지 하는 태권도장',
      conditions: ['LATE_OPEN'],
      timeSlots: ['WEEKDAY_EVENING'],
      frequency: 'SOMETIMES',
    });
    const parseBody = JSON.parse(
      calls.find((c) => c.path === '/api/v1/requests/parse')?.body ?? '{}',
    );
    expect(parseBody.dongId).toBe(1);
    // 내 요청 화면은 서버 데이터를 보여주고 "예시 데이터" 표시가 없다.
    expect(await app.screen.findByText('12명')).toBeInTheDocument();
    expect(app.screen.queryByText('예시 데이터')).not.toBeInTheDocument();
  });

  it('AI_UNAVAILABLE 이면 안내 문구와 함께 업종 칩으로 직접 고르게 한다(서버 message 는 쓰지 않는다)', async () => {
    const { calls } = stubServer({
      parse: () => jsonResponse(502, { code: 'AI_UNAVAILABLE', message: '서버 원문' }),
    });
    const app = await loadApp('api');
    await writeText(app, await openForm(app), '[프론트 테스트] 문장');

    const card = await app.screen.findByRole('region', { name: '요청 정리 결과' });
    expect(app.within(card).getByRole('status')).toHaveTextContent(
      '요청 내용을 정리하지 못했어요. 업종을 직접 골라 주세요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(app.within(card).getAllByRole('radio')).toHaveLength(38);

    expect(submitButton(app)).toBeDisabled();
    await app.user.click(app.within(card).getByRole('radio', { name: '태권도장' }));
    await chooseVisit(app);
    expect(submitButton(app)).toBeEnabled();
    await app.user.click(submitButton(app));

    await app.waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(JSON.parse(posts(calls)[0]?.body ?? '{}')).toMatchObject({
      categoryId: 33,
      conditions: [],
    });
  });

  it('409 ALREADY_REQUESTED 이면 이동하지 않고 코드별 문구를 보여준다(서버 message 는 쓰지 않는다)', async () => {
    stubServer({
      parse: () => jsonResponse(200, PARSED),
      create: () => jsonResponse(409, { code: 'ALREADY_REQUESTED', message: '서버 원문' }),
    });
    const app = await loadApp('api');
    await writeText(app, await openForm(app), '[프론트 테스트] 태권도장');
    await app.screen.findByRole('region', { name: '요청 정리 결과' });
    await chooseVisit(app);
    await app.user.click(submitButton(app));

    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '이 동네에 같은 업종을 이미 요청했어요. 내 요청에서 확인해 보세요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(app.screen.getByLabelText('어떤 가게가 생기면 갈까요?')).toHaveValue(
      '[프론트 테스트] 태권도장',
    );
    expect(
      app.screen.queryByRole('heading', { level: 1, name: '내 요청' }),
    ).not.toBeInTheDocument();
    expect(submitButton(app)).toBeEnabled();
  });

  it('제출하는 동안 다시 눌러도 요청은 한 번만 나가고, 끝나면 이동한다', async () => {
    let finish: (response: Response) => void = () => undefined;
    const { calls } = stubServer({
      parse: () => jsonResponse(200, PARSED),
      create: () => new Promise<Response>((resolve) => (finish = resolve)),
    });
    const app = await loadApp('api');
    await writeText(app, await openForm(app), '[프론트 테스트] 태권도장');
    await app.screen.findByRole('region', { name: '요청 정리 결과' });
    await chooseVisit(app);

    await app.user.click(submitButton(app));
    await app.waitFor(() => expect(posts(calls)).toHaveLength(1));
    await app.user.click(app.screen.getByRole('button', { name: /요청 보내기/ }));
    await app.user.click(app.screen.getByRole('button', { name: /요청 보내기/ }));
    // 버튼이 아니라 폼 submit 이벤트가 직접 와도(예: Enter) 저장 중에는 요청이 한 번만 나간다.
    const form = app.screen.getByRole('button', { name: /요청 보내기/ }).closest('form')!;
    app.fireEvent.submit(form);
    app.fireEvent.submit(form);
    expect(posts(calls)).toHaveLength(1);
    expect(
      app.screen.queryByRole('heading', { level: 1, name: '내 요청' }),
    ).not.toBeInTheDocument();

    finish(jsonResponse(201, { request: { id: 351 } }));

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '내 요청' }),
    ).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(1);
  });
});

describe('api 모드의 내 요청', () => {
  it('서버 데이터를 보여준다(동네·시간대·빈도, 인원, 사장님 응답 없음). 입력 문장·사장님 응답은 서버에 없어 비어 있다', async () => {
    stubServer({ mine: () => jsonResponse(200, [MY_ITEM]) });
    const app = await loadApp('api');
    app.renderApp(['/resident/requests']);

    const list = await app.screen.findByRole('region', { name: '내 요청' });
    expect(
      app.within(list).getByRole('heading', { level: 3, name: '태권도장' }),
    ).toBeInTheDocument();
    expect(app.within(list).getByText('12명')).toBeInTheDocument();
    expect(
      app.within(list).getByText('포곡읍 · 평일 저녁, 주말 · 주 1번 이상'),
    ).toBeInTheDocument();
    expect(app.within(list).getByText('아직 사장님 응답이 없어요')).toBeInTheDocument();
    expect(app.screen.queryByText('예시 데이터')).not.toBeInTheDocument();
  });

  it('빈 목록(새 게스트)은 안내를 보여준다', async () => {
    localStorage.clear();
    stubServer({ mine: () => jsonResponse(200, []) });
    const app = await loadApp('api');
    app.renderApp(['/resident/requests']);

    expect(await app.screen.findByText('아직 보낸 요청이 없어요')).toBeInTheDocument();
  });

  it('서버 오류는 코드·종류별 문구를 보여준다', async () => {
    stubServer({
      mine: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const app = await loadApp('api');
    app.renderApp(['/resident/requests']);

    expect(
      await app.screen.findByText('네트워크 연결을 확인하고 다시 시도해 주세요.'),
    ).toBeInTheDocument();
  });
});

describe('mock 모드', () => {
  it('요청 작성은 네트워크 없이 기존 목 동작(예시 정리)이고 시간대·빈도 필수 규칙은 같다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    const app = await loadApp('mock');
    app.renderApp(['/']);
    await app.screen.findByRole('option', { name: '기흥구 구성동' });
    await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
    await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
    await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' });
    await app.user.click(app.screen.getByRole('link', { name: '+가게 요청하기' }));

    await app.user.type(
      await app.screen.findByLabelText('어떤 가게가 생기면 갈까요?'),
      '빵집이 생기면 좋겠어요',
    );
    const card = await app.screen.findByRole('region', { name: '요청 정리 결과' });
    expect(app.within(card).getByText('예시 정리 · AI 연동 예정')).toBeInTheDocument();
    // 시간대·빈도는 목 모드에서도 필수다: 고르지 않고 누르면 이동하지 않고 안내가 보인다.
    expect(submitButton(app)).toBeEnabled();
    await app.user.click(submitButton(app));
    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '방문 시간대와 빈도를 골라 주세요.',
    );
    await chooseVisit(app);
    await app.user.click(submitButton(app));

    expect(
      await app.screen.findByRole('heading', { level: 1, name: '내 요청' }),
    ).toBeInTheDocument();
    expect(await app.screen.findByText('예시 데이터')).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});
