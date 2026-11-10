import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import {
  canSubmitRequest,
  isDuplicateRequest,
  isVisitInfoMissing,
} from '@/features/store-request/requestForm';
import { mapParseResponse } from '@/services/api/mappers';

/** 이미 요청한 업종(parse 의 alreadyRequested)과 시간대·빈도 필수 규칙(API 모드). */
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

const CATEGORIES = [
  { id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true },
  { id: 33, code: 'MARTIAL_ARTS', name: '태권도장', martCheck: false },
];
const ME = {
  id: 3,
  nickname: 'x',
  role: 'RESIDENT',
  dong: { id: 1, name: '포곡읍', gu: '처인구' },
  shop: null,
};
type Handler = (call: StubCall) => Response | Promise<Response>;
function stubServer(parse: Handler) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest')
      return jsonResponse(200, { accessToken: 't', expiresIn: 3600 });
    if (call.path === '/api/v1/me') return jsonResponse(200, ME);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (call.path === '/api/v1/requests/parse') return parse(call);
    if (call.path === '/api/v1/requests' && call.method === 'POST') {
      return jsonResponse(201, { request: { id: 1 } });
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const ALREADY = '이 동네에 같은 업종을 이미 요청했어요. 내 요청에서 확인해 보세요.';
const parsed = (extra: Record<string, unknown>) =>
  jsonResponse(200, { category: { id: 33, name: '태권도장' }, conditions: [], ...extra });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'yyt.session',
    JSON.stringify({ token: 'tok', expiresAt: Date.now() + 1e7 }),
  );
});
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

async function openAndParse(app: App) {
  app.renderApp(['/resident/requests/new']);
  const box = await app.screen.findByLabelText('어떤 가게가 생기면 갈까요?');
  await app.user.click(box);
  await app.user.paste('[프론트 테스트] 태권도장');
  return app.screen.findByRole('region', { name: '요청 정리 결과' });
}
const send = (app: App) => app.screen.getByRole('button', { name: '요청 보내기' });
const choose = async (app: App) => {
  await app.user.click(app.screen.getByRole('button', { name: '평일 저녁' }));
  await app.user.click(app.screen.getByRole('radio', { name: '가끔' }));
};

describe('alreadyRequested (화면)', () => {
  it('true 이고 선택한 업종이 parse 가 정한 업종이면 보내기를 막고 기존 문구를 카드 맨 위에 보여준다', async () => {
    const { calls } = stubServer(() => parsed({ alreadyRequested: true }));
    const app = await loadApp();
    const card = await openAndParse(app);
    await choose(app);

    expect(app.within(card).getByRole('status')).toHaveTextContent(ALREADY);
    expect(send(app)).toBeDisabled();
    await app.user.click(send(app));
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/requests')).toHaveLength(
      0,
    );
    // 문구는 요청 정리 실패 문구와 같은 자리(카드 맨 위, "업종" 행보다 앞)다.
    const notice = app.within(card).getByRole('status');
    expect(
      notice.compareDocumentPosition(app.within(card).getByText('업종')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it.each([
    ['false', { alreadyRequested: false }],
    ['필드 없음', {}],
    ['boolean 이 아님', { alreadyRequested: 'yes' }],
  ])('alreadyRequested 가 %s 이면 영향이 없다(문구 없음, 보낼 수 있음)', async (_name, extra) => {
    stubServer(() => parsed(extra));
    const app = await loadApp();
    const card = await openAndParse(app);
    await choose(app);

    expect(app.within(card).queryByRole('status')).not.toBeInTheDocument();
    expect(send(app)).toBeEnabled();
  });

  it('POST 에서 409 ALREADY_REQUESTED 가 오면 기존 처리(오류 안내, 이동 없음)를 그대로 한다', async () => {
    stubFetch((call) => {
      if (call.path === '/api/v1/auth/guest')
        return jsonResponse(200, { accessToken: 't', expiresIn: 3600 });
      if (call.path === '/api/v1/me') return jsonResponse(200, ME);
      if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
      if (call.path === '/api/v1/requests/parse') return parsed({ alreadyRequested: false });
      return jsonResponse(409, { code: 'ALREADY_REQUESTED', message: '서버 원문' });
    });
    const app = await loadApp();
    await openAndParse(app);
    await choose(app);

    await app.user.click(send(app));

    expect(await app.screen.findByRole('alert')).toHaveTextContent(ALREADY);
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
  });
});

describe('isDuplicateRequest · canSubmitRequest', () => {
  const summary = { categoryId: '33', alreadyRequested: true };

  it('같은 업종이면 막고, 다른 업종을 고르면 풀린다(그 업종은 판단 근거가 없다)', () => {
    expect(isDuplicateRequest(summary, '33')).toBe(true);
    expect(isDuplicateRequest(summary, '7')).toBe(false);
    expect(isDuplicateRequest(summary, null)).toBe(false);
  });

  it('false·없음·결과 없음·업종 없음이면 막지 않는다', () => {
    expect(isDuplicateRequest({ categoryId: '33', alreadyRequested: false }, '33')).toBe(false);
    expect(isDuplicateRequest({ categoryId: '33' }, '33')).toBe(false);
    expect(isDuplicateRequest(null, '33')).toBe(false);
    expect(isDuplicateRequest({ categoryId: null, alreadyRequested: true }, null)).toBe(false);
    expect(isDuplicateRequest({ categoryId: null, alreadyRequested: true }, '33')).toBe(false);
  });

  it('canSubmitRequest: duplicate 이면 다른 조건이 모두 맞아도 막는다', () => {
    const base = { text: '빵집', categoryId: '33', summaryIsCurrent: true };

    expect(canSubmitRequest(base)).toBe(true);
    expect(canSubmitRequest({ ...base, duplicate: false })).toBe(true);
    expect(canSubmitRequest({ ...base, duplicate: true })).toBe(false);
  });
});

describe('isVisitInfoMissing', () => {
  it('시간대가 비었거나 빈도가 없으면 true, 둘 다 있으면 false', () => {
    expect(isVisitInfoMissing([], null)).toBe(true);
    expect(isVisitInfoMissing(['weekend'], null)).toBe(true);
    expect(isVisitInfoMissing([], 'weekly')).toBe(true);
    expect(isVisitInfoMissing(['weekend'], undefined)).toBe(true);
    expect(isVisitInfoMissing(['weekend'], 'weekly')).toBe(false);
  });
});

describe('mapParseResponse 의 alreadyRequested', () => {
  const categories = [
    {
      id: '33',
      name: '태권도장',
      cardTitle: '태권도장',
      requestLabel: '태권도장',
      missingLabel: '태권도장',
      objectPhrase: '태권도장',
      titleLabel: '태권도장',
    },
  ];
  const map = (extra: Record<string, unknown>) =>
    mapParseResponse(
      { category: { id: 33, name: '태권도장' }, conditions: [], ...extra },
      categories,
      new Map(),
    );

  it('boolean true 일 때만 true 이고 없거나 boolean 이 아니면 false 다', () => {
    expect(map({ alreadyRequested: true }).alreadyRequested).toBe(true);
    expect(map({ alreadyRequested: false }).alreadyRequested).toBe(false);
    expect(map({}).alreadyRequested).toBe(false);
    expect(map({ alreadyRequested: null }).alreadyRequested).toBe(false);
    expect(map({ alreadyRequested: 'true' as never }).alreadyRequested).toBe(false);
  });
});
