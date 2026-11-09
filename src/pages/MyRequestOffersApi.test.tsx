import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 내 요청 화면의 사장님 응답(API 모드, GET /me/requests 의 offers[]). 서비스 구현은 import 시점에 정해지므로
 * 환경 값을 바꾼 뒤 React·RTL·앱 모듈을 모두 새로 불러온다(HomeStartApi.test.tsx 와 같은 방식).
 */
type Rtl = typeof import('@testing-library/react');
let rtl: Rtl | null = null;

async function loadApp(source: 'mock' | 'api') {
  vi.stubEnv('VITE_DATA_SOURCE', source);
  vi.stubEnv('VITE_API_BASE_URL', source === 'api' ? 'https://api.test' : '');
  vi.resetModules();
  rtl = await import('@testing-library/react');
  const { renderApp } = await import('@/test/renderApp');
  return { ...rtl, renderApp };
}

const CATEGORIES = [
  { id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true },
  { id: 33, code: 'MARTIAL_ARTS', name: '태권도장', martCheck: false },
];
const offer = (over: Record<string, unknown> = {}) => ({
  id: 1,
  shopName: '싱싱과일',
  title: '내일 저녁 과일 상자',
  price: 9900,
  pickupAt: '2026-11-10T18:00:00+09:00',
  pickupPlace: '가게 앞',
  minOrders: 5,
  orderCount: 2,
  deadlineAt: '2026-11-10T12:00:00+09:00',
  status: 'OPEN',
  myOrder: null,
  ...over,
});
const item = (over: Record<string, unknown>) => ({
  id: 351,
  dong: { id: 22, name: '구성동' },
  category: { id: 7, name: '과일·채소 가게' },
  count: 12,
  timeSlots: ['WEEKDAY_EVENING'],
  frequency: 'WEEKLY_PLUS',
  createdAt: '2026-11-09T10:55:54+09:00',
  offers: [],
  ...over,
});

function stubServer(mine: () => Response) {
  return stubFetch((call: StubCall) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (call.path === '/api/v1/me/requests') return mine();
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const NO_RESPONSE = '아직 사장님 응답이 없어요';

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

type App = Awaited<ReturnType<typeof loadApp>>;
async function openList(app: App) {
  app.renderApp(['/resident/requests']);
  const list = await app.screen.findByRole('region', { name: '내 요청' });
  return list;
}

describe('api 모드의 내 요청: 사장님 응답', () => {
  it('제안이 있으면 "업체(지역): 제목" 으로 보여주고 "아직 응답이 없어요" 는 없다', async () => {
    stubServer(() => jsonResponse(200, [item({ offers: [offer()] })]));
    const app = await loadApp('api');
    const list = await openList(app);

    const group = app.within(list).getByRole('group', { name: '사장님 응답' });
    expect(group).toHaveTextContent('싱싱과일(구성동): 내일 저녁 과일 상자');
    expect(app.within(list).queryByText(NO_RESPONSE)).not.toBeInTheDocument();
  });

  it('제안이 여러 개면 서버 순서의 첫 번째(취소·알 수 없는 상태 제외)만 보여준다', async () => {
    stubServer(() =>
      jsonResponse(200, [
        item({
          offers: [
            offer({ shopName: '취소가게', status: 'CANCELLED' }),
            offer({ shopName: '모르는가게', status: 'NEW_STATUS' }),
            offer({ shopName: '첫번째가게', title: '첫 제안', status: 'CONFIRMED' }),
            offer({ shopName: '두번째가게', title: '둘째 제안', status: 'OPEN' }),
          ],
        }),
      ]),
    );
    const app = await loadApp('api');
    const list = await openList(app);

    expect(app.within(list).getAllByRole('group', { name: '사장님 응답' })).toHaveLength(1);
    expect(app.within(list).getByText('첫번째가게(구성동): 첫 제안')).toBeInTheDocument();
    expect(app.screen.queryByText(/두번째가게|취소가게|모르는가게/)).not.toBeInTheDocument();
  });

  it('요청마다 따로 판단한다: 제안 있는 요청, 없는 요청, 취소된 제안뿐인 요청', async () => {
    stubServer(() =>
      jsonResponse(200, [
        item({ id: 1, offers: [offer()] }),
        item({ id: 2, category: { id: 33, name: '태권도장' }, offers: [] }),
        item({ id: 3, dong: { id: 28, name: '보정동' }, offers: [offer({ status: 'CANCELLED' })] }),
      ]),
    );
    const app = await loadApp('api');
    const list = await openList(app);

    expect(app.within(list).getAllByRole('group', { name: '사장님 응답' })).toHaveLength(1);
    expect(app.within(list).getAllByText(NO_RESPONSE)).toHaveLength(2);
  });

  it('offers 가 없거나 null 이고 제안 필드가 null 이어도 화면이 깨지지 않는다', async () => {
    stubServer(() =>
      jsonResponse(200, [
        item({ id: 1, offers: null }),
        item({ id: 2, offers: undefined }),
        item({
          id: 3,
          offers: [
            offer({ shopName: null, title: null, price: null, pickupAt: null, deadlineAt: null }),
          ],
        }),
      ]),
    );
    const app = await loadApp('api');
    const list = await openList(app);

    expect(app.within(list).getAllByRole('article')).toHaveLength(3);
    expect(app.within(list).getAllByText(NO_RESPONSE)).toHaveLength(3);
  });

  it('가격·수령 정보 같은 값은 화면에 나오지 않는다(담을 자리가 없다)', async () => {
    stubServer(() => jsonResponse(200, [item({ offers: [offer()] })]));
    const app = await loadApp('api');
    const list = await openList(app);

    await app.within(list).findByRole('group', { name: '사장님 응답' });
    expect(app.screen.queryByText(/9,?900|가게 앞|2026-11-10/)).not.toBeInTheDocument();
  });
});

describe('mock 모드의 내 요청', () => {
  it('네트워크 없이 기존 목 동작(첫 응답 없음 문구)이다', async () => {
    const { fn } = stubFetch(() => jsonResponse(500, {}));
    const app = await loadApp('mock');
    app.renderApp(['/resident/requests']);

    expect(await app.screen.findByRole('region', { name: '내 요청' })).toBeInTheDocument();
    expect(app.screen.getByText('예시 데이터')).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});
