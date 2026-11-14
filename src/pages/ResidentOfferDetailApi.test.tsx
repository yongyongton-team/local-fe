import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeJwt, jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 주민 제안 상세의 API 모드(실서버 호출 없이 fetch 스텁). 서비스 구현은 import 시점에 정해지므로
 * 환경 값을 바꾼 뒤 React·RTL·앱 모듈을 모두 새로 불러온다(MyRequestOffersApi.test.tsx 와 같은 방식).
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

const CATEGORIES = [{ id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true }];
// [임의] 테스트용 값. 실제 서버 응답이 아니다.
const offer = (over: Record<string, unknown> = {}) => ({
  id: 5,
  shopName: '테스트과일',
  title: '테스트 꾸러미',
  price: 15000,
  pickupAt: '2026-11-15T10:00:00+09:00',
  pickupPlace: '테스트 장소',
  minOrders: 20,
  orderCount: 8,
  deadlineAt: '2026-11-14T18:00:00+09:00',
  status: 'OPEN',
  myOrder: null,
  ...over,
});
const requests = (offers: unknown[]) => [
  {
    id: 351,
    dong: { id: 22, name: '구성동' },
    category: { id: 7, name: '과일·채소 가게' },
    count: 12,
    timeSlots: ['WEEKDAY_EVENING'],
    frequency: 'WEEKLY_PLUS',
    createdAt: '2026-11-09T10:55:54+09:00',
    offers,
  },
];

interface Server {
  /** GET /me/requests 가 돌려줄 제안들(호출 때마다 현재 값) */
  offers: () => unknown[];
  routes?: (call: StubCall) => Response | undefined;
}

function stubServer({ offers, routes }: Server, { demo = false } = {}) {
  if (demo) {
    // 데모 세션: 저장된 세션에 demo 표시가 있으면 게스트 로그인을 하지 않는다.
    localStorage.setItem(
      'yyt.session',
      JSON.stringify({
        token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        expiresAt: Date.now() + 3_600_000,
        demo: true,
      }),
    );
  }
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    const custom = routes?.(call);
    if (custom) return custom;
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (call.path === '/api/v1/me/requests') return jsonResponse(200, requests(offers()));
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const writes = (calls: StubCall[]) =>
  calls.filter((c) => c.method !== 'GET' && !c.path.endsWith('/auth/guest'));

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('api 모드의 주민 제안 상세', () => {
  it('GET /me/requests 에서 제안을 찾아 보여주고, 선주문은 POST /offers/{id}/orders 를 {quantity} 로 부른다', async () => {
    let myOrder: unknown = null;
    let orderCount = 8;
    const { calls } = stubServer({
      offers: () => [offer({ myOrder, orderCount })],
      routes: (call) => {
        if (call.method === 'POST' && call.path === '/api/v1/offers/5/orders') {
          myOrder = { id: 77, offerId: 5, quantity: 2, status: 'RESERVED' };
          orderCount = 10;
          return jsonResponse(201, { order: myOrder, orderCount, minOrders: 20 });
        }
        return undefined;
      },
    });
    const app = await loadApp();
    app.renderApp(['/resident/offers/5']);

    expect(
      await app.screen.findByRole('heading', { level: 2, name: '테스트과일 / 테스트 꾸러미' }),
    ).toBeInTheDocument();
    await app.user.click(app.screen.getByRole('button', { name: '수량 늘리기' }));
    await app.user.click(app.screen.getByRole('button', { name: '선주문하기 30,000원' }));

    expect(await app.screen.findByText('내 예약: 2개')).toBeInTheDocument();
    const posts = writes(calls);
    expect(posts.map((c) => [c.method, c.path])).toEqual([['POST', '/api/v1/offers/5/orders']]);
    expect(JSON.parse(posts[0]?.body ?? '{}')).toEqual({ quantity: 2 });
    expect(app.screen.getByText('10 / 20명 · 10명만 더 모이면 돼요')).toBeInTheDocument();
    // 성공 뒤 조용히 /me/requests 를 다시 불러 서버 값과 맞춘다(처음 한 번 + 다시 한 번).
    await app.waitFor(() =>
      expect(calls.filter((c) => c.path === '/api/v1/me/requests')).toHaveLength(2),
    );
  });

  it('예약 취소는 DELETE /orders/{id}(204)이고 성공하면 myOrder 가 사라지고 예약 수에서 수량이 빠진다', async () => {
    let myOrder: unknown = { id: 77, offerId: 5, quantity: 2, status: 'RESERVED' };
    let orderCount = 10;
    const { calls } = stubServer({
      offers: () => [offer({ myOrder, orderCount })],
      routes: (call) => {
        if (call.method === 'DELETE' && call.path === '/api/v1/orders/77') {
          myOrder = null;
          orderCount = 8;
          return new Response(null, { status: 204 });
        }
        return undefined;
      },
    });
    const app = await loadApp();
    app.renderApp(['/resident/offers/5']);

    await app.user.click(await app.screen.findByRole('button', { name: '예약 취소하기' }));
    await app.user.click(
      app.within(await app.screen.findByRole('dialog')).getByRole('button', { name: '예약 취소' }),
    );

    expect(await app.screen.findByRole('group', { name: '수량' })).toBeInTheDocument();
    expect(writes(calls).map((c) => [c.method, c.path, c.body])).toEqual([
      ['DELETE', '/api/v1/orders/77', null],
    ]);
    expect(app.screen.getByText('8 / 20명 · 12명만 더 모이면 돼요')).toBeInTheDocument();
  });

  it('409 ALREADY_ORDERED: 문구를 보이고 /me/requests 를 다시 불러 서버 상태로 맞춘다(서버 message 는 쓰지 않는다)', async () => {
    let myOrder: unknown = null;
    const { calls } = stubServer({
      offers: () => [offer({ myOrder })],
      routes: (call) => {
        if (call.method === 'POST' && call.path === '/api/v1/offers/5/orders') {
          myOrder = { id: 80, offerId: 5, quantity: 1, status: 'RESERVED' };
          return jsonResponse(409, { code: 'ALREADY_ORDERED', message: '서버 원문' });
        }
        return undefined;
      },
    });
    const app = await loadApp();
    app.renderApp(['/resident/offers/5']);

    await app.user.click(await app.screen.findByRole('button', { name: /^선주문하기/ }));

    expect(await app.screen.findByRole('alert')).toHaveTextContent('이미 선주문한 제안이에요.');
    expect(await app.screen.findByText('내 예약: 1개')).toBeInTheDocument();
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/api/v1/me/requests')).toHaveLength(2);
  });

  it('제안이 응답에서 빠져 있으면(사장님이 취소) 요청 없이도 사라진 제안 화면이다', async () => {
    stubServer({ offers: () => [offer({ id: 6 })] });
    const app = await loadApp();
    app.renderApp(['/resident/offers/5']);

    expect(await app.screen.findByText('취소되었거나 사라진 제안이에요')).toBeInTheDocument();
  });

  it('숫자가 아닌 id 는 서버를 부르지 않고 사라진 제안 화면이다', async () => {
    const { calls } = stubServer({ offers: () => [offer()] });
    const app = await loadApp();
    app.renderApp(['/resident/offers/mock-offer-seed-1']);

    expect(await app.screen.findByText('취소되었거나 사라진 제안이에요')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/api/v1/me/requests')).toHaveLength(0);
  });

  it('데모 세션에서는 선주문 요청이 서버로 나가지 않고 데모 안내가 보인다', async () => {
    const { calls } = stubServer({ offers: () => [offer()] }, { demo: true });
    const app = await loadApp();
    app.renderApp(['/resident/offers/5']);

    await app.user.click(await app.screen.findByRole('button', { name: /^선주문하기/ }));

    expect(await app.screen.findByRole('alert')).toHaveTextContent('데모 계정은 사장님 화면만');
    expect(writes(calls)).toHaveLength(0);
  });
});
