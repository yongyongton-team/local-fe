import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 사장님 "내 가게(제안 목록)"와 "방문 판매 제안 작성"의 API 모드. 서비스 구현은 import 시점에 정해지므로
 * 환경 값을 바꾼 뒤 React·RTL·앱 모듈을 모두 새로 불러온다(MerchantApi.test.tsx 와 같은 방식).
 * 값은 모두 테스트용 [임의] 값이고 실제 서버 응답이 아니다.
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

const DONGS = [
  { id: 22, name: '구성동', gu: '기흥구' },
  { id: 23, name: '마북동', gu: '기흥구' },
];
const CATEGORIES = [{ id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true }];
const SHOP = {
  shopName: '싱싱과일',
  category: { id: 7, name: '과일·채소 가게' },
  dong: { id: 23, name: '마북동' },
  lat: 37.3108,
  lon: 127.1398,
};
const ME = { id: 54, nickname: '데모', role: 'OWNER', dong: null, shop: SHOP };
const detailFor = (dongId: number) => ({
  dong: { id: dongId, name: dongId === 23 ? '마북동' : '구성동' },
  category: { id: 7, name: '과일·채소 가게' },
  requestCount: 9,
  sameCategoryStoreCount: 0,
  conditions: [{ code: 'LATE_OPEN', label: '늦게까지 영업', count: 5 }],
  timeSlots: [],
  summary: { text: '요약', by: 'AI' },
});
/** 명세의 OwnerOfferItem 모양: price·pickupAt 이 없다. */
const ITEM_WITHOUT_PRICE = {
  id: 5,
  dong: { id: 23, name: '임의동' },
  title: '가격 없는 제안',
  status: 'OPEN',
  minOrders: 20,
  orderCount: 4,
  deadlineAt: '2026-11-14T18:00:00+09:00',
};
const ITEM_FULL = {
  ...ITEM_WITHOUT_PRICE,
  id: 6,
  title: '값이 다 있는 제안',
  price: 15000,
  pickupAt: '2026-11-15T10:00:00+09:00',
};

type Handler = (call: StubCall) => Response | Promise<Response>;
function stubServer(routes: { offers?: Handler; create?: Handler; action?: Handler } = {}) {
  return stubFetch((call) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.path === '/api/v1/me') return jsonResponse(200, ME);
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    const detail = /^\/api\/v1\/owner\/demand\/(\d+)/.exec(call.path);
    if (detail) return jsonResponse(200, detailFor(Number(detail[1])));
    if (call.path === '/api/v1/owner/offers') {
      return routes.offers?.(call) ?? jsonResponse(200, [ITEM_WITHOUT_PRICE]);
    }
    const action = /^\/api\/v1\/offers\/(\d+)\/(done|cancel)$/.exec(call.path);
    if (call.method === 'POST' && action) {
      return (
        routes.action?.(call) ??
        jsonResponse(200, {
          ...ITEM_FULL,
          id: Number(action[1]),
          status: action[2] === 'done' ? 'DONE' : 'CANCELLED',
          orderCount: action[2] === 'done' ? ITEM_FULL.orderCount : 0,
        })
      );
    }
    if (call.method === 'POST' && call.path === '/api/v1/offers') {
      return (
        routes.create?.(call) ??
        jsonResponse(201, {
          offer: { id: 6, status: 'OPEN', orderCount: 0, minOrders: 20 },
          notifiedResidentCount: 4,
        })
      );
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const callsTo = (calls: StubCall[], path: string, method = 'GET') =>
  calls.filter((c) => c.method === method && c.path.split('?')[0] === path);

beforeEach(() => {
  localStorage.clear();
  // 마감은 "지금"보다 늦어야 하므로 시각을 고정한다(Date 만 가짜로 둔다).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T09:00:00+09:00'));
});
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
  vi.useRealTimers();
});

const card = (app: App, name: string) => app.screen.findByRole('article', { name });

describe('api 모드의 내 가게(제안 목록)', () => {
  it('GET /owner/offers 를 부르고, 가게가 있는 동네(23)·업종(7)의 수요로 요약 카드를 만든다', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    app.renderApp(['/merchant/offers']);

    await card(app, '가격 없는 제안');
    const summary = await app.screen.findByRole('region', { name: '내 가게 요약' });
    expect(summary).toHaveTextContent('마북동 · 과일 가게');
    expect(summary).toHaveTextContent('요청 9명 · 늦게까지 영업 조건이 많아요');
    expect(callsTo(calls, '/api/v1/owner/offers')).toHaveLength(1);
    expect(calls.find((c) => c.path.startsWith('/api/v1/owner/demand/'))?.path).toBe(
      '/api/v1/owner/demand/23?categoryId=7',
    );
    expect(callsTo(calls, '/api/v1/offers', 'POST')).toHaveLength(0);
  });

  it('price·pickupAt 이 없는 항목은 그 행만 숨기고 마감 행·진행 막대는 보인다', async () => {
    stubServer();
    const app = await loadApp();
    app.renderApp(['/merchant/offers']);

    const item = await card(app, '가격 없는 제안');
    expect(app.within(item).queryByText('가격')).not.toBeInTheDocument();
    expect(app.within(item).queryByText('받는 날')).not.toBeInTheDocument();
    expect(app.within(item).getByText('마감').nextElementSibling).toHaveTextContent(
      '11/14(토) 18:00',
    );
    expect(
      app.within(item).getByRole('progressbar', { name: '4 / 20명 예약' }),
    ).toBeInTheDocument();
    expect(app.within(item).getByText('모집 중')).toBeInTheDocument();
  });

  it('값이 다 있는 항목은 가격·받는 날 행도 보인다', async () => {
    stubServer({ offers: () => jsonResponse(200, [ITEM_FULL]) });
    const app = await loadApp();
    app.renderApp(['/merchant/offers']);

    const item = await card(app, '값이 다 있는 제안');
    expect(app.within(item).getByText('가격').nextElementSibling).toHaveTextContent('15,000원');
    expect(app.within(item).getByText('받는 날').nextElementSibling).toHaveTextContent(
      '11/15(일) 오전 10:00',
    );
  });

  it('응답이 {items: []} 여도 받고, 빈 목록이면 안내와 "내 제안 보내기"만 보인다', async () => {
    stubServer({ offers: () => jsonResponse(200, { items: [] }) });
    const app = await loadApp();
    app.renderApp(['/merchant/offers']);

    expect(await app.screen.findByText('아직 보낸 제안이 없어요')).toBeInTheDocument();
    expect(await app.screen.findByRole('link', { name: '내 제안 보내기' })).toHaveAttribute(
      'href',
      '/merchant/offers/new?area=23',
    );
    expect(app.screen.queryByRole('link', { name: '요청 모아 보기로' })).not.toBeInTheDocument();
  });

  it('403 은 코드별 한국어 문구이고 서버 message 는 보이지 않는다', async () => {
    stubServer({
      offers: () => jsonResponse(403, { code: 'FORBIDDEN', message: '서버 원문' }),
    });
    const app = await loadApp();
    app.renderApp(['/merchant/offers']);

    expect(await app.screen.findByText('제안을 가져오지 못했어요')).toBeInTheDocument();
    expect(
      app.screen.getByText(
        '이 화면을 볼 수 있는 역할이 아니에요. 처음 화면에서 역할을 다시 선택해 주세요.',
      ),
    ).toBeInTheDocument();
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
  });

  it('데모 세션에서도 목록(읽기)은 동작한다', async () => {
    localStorage.setItem(
      'yyt.session',
      JSON.stringify({ token: 'tok-demo', expiresAt: Date.now() + 1e7, demo: true }),
    );
    const { calls } = stubServer();
    const app = await loadApp();
    app.renderApp(['/merchant/offers']);

    await card(app, '가격 없는 제안');
    expect(callsTo(calls, '/api/v1/owner/offers')).toHaveLength(1);
  });
});

describe('api 모드의 방문 판매 제안 작성', () => {
  async function fill(app: App) {
    const field = (label: string) => app.screen.getByLabelText(label);
    await app.user.type(field('제목'), '새 제안');
    await app.user.type(field('가격'), '12000');
    app.fireEvent.change(field('받는 날짜 / 시간'), { target: { value: '2026-11-15T10:00' } });
    await app.user.type(field('받는 곳'), '주민센터 앞');
    app.fireEvent.change(field('주문 마감'), { target: { value: '2026-11-14T18:00' } });
  }

  it('POST /offers 본문이 CreateOfferRequest 모양(숫자 id, +09:00 날짜)이고, 응답의 offer.id 상세로 가서 알린 주민 수를 보인다', async () => {
    const { calls } = stubServer({ offers: () => jsonResponse(200, [ITEM_FULL]) });
    const app = await loadApp();
    const { router } = app.renderApp(['/merchant/offers/new?area=22']);
    await app.screen.findByRole('region', { name: '내 가게 요약' });
    await fill(app);

    await app.user.click(app.screen.getByRole('button', { name: /제안 보내기/ }));

    expect(await app.screen.findByText('제안을 보냈어요!')).toBeInTheDocument();
    expect(app.screen.getByText('4명의 주민에게 알렸어요')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/merchant/offers/6');
    const posts = callsTo(calls, '/api/v1/offers', 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0]?.body ?? '{}')).toEqual({
      dongId: 22,
      categoryId: 7,
      title: '새 제안',
      price: 12000,
      minOrders: 20,
      pickupAt: '2026-11-15T10:00:00+09:00',
      pickupPlace: '주민센터 앞',
      deadlineAt: '2026-11-14T18:00:00+09:00',
    });
  });

  it('?area= 가 없으면 가게가 있는 동네(23)로 보낸다', async () => {
    const { calls } = stubServer({ offers: () => jsonResponse(200, [ITEM_FULL]) });
    const app = await loadApp();
    app.renderApp(['/merchant/offers/new']);
    await app.screen.findByRole('region', { name: '내 가게 요약' });
    await fill(app);

    await app.user.click(app.screen.getByRole('button', { name: /제안 보내기/ }));

    await app.screen.findByText('제안을 보냈어요!');
    const post = callsTo(calls, '/api/v1/offers', 'POST')[0];
    expect(JSON.parse(post?.body ?? '{}')).toMatchObject({ dongId: 23, categoryId: 7 });
  });

  it('데모 세션도 POST /offers 를 서버로 보내고(차단 없음) 알림 인원을 알린다', async () => {
    localStorage.setItem(
      'yyt.session',
      JSON.stringify({ token: 'tok-demo', expiresAt: Date.now() + 1e7, demo: true }),
    );
    const { calls } = stubServer({ offers: () => jsonResponse(200, [ITEM_FULL]) });
    const app = await loadApp();
    app.renderApp(['/merchant/offers/new']);
    await app.screen.findByRole('region', { name: '내 가게 요약' });
    await fill(app);

    await app.user.click(app.screen.getByRole('button', { name: /제안 보내기/ }));

    expect(await app.screen.findByText('4명의 주민에게 알렸어요')).toBeInTheDocument();
    expect(callsTo(calls, '/api/v1/offers', 'POST')).toHaveLength(1);
    expect(app.screen.queryByText(/데모 계정은 사장님 화면만/)).not.toBeInTheDocument();
  });

  it('서버 400 은 코드별 문구이고 서버 message 는 보이지 않는다', async () => {
    stubServer({
      create: () => jsonResponse(400, { code: 'VALIDATION_ERROR', message: '서버 원문' }),
    });
    const app = await loadApp();
    app.renderApp(['/merchant/offers/new']);
    await app.screen.findByRole('region', { name: '내 가게 요약' });
    await fill(app);

    await app.user.click(app.screen.getByRole('button', { name: /제안 보내기/ }));

    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '입력한 값을 확인해 주세요. 날짜 순서와 가게 정보도 확인해 주세요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
  });
});

describe('api 모드의 제안 상세·판매 끝·제안 취소', () => {
  const CONFIRMED = { ...ITEM_FULL, id: 6, status: 'CONFIRMED', orderCount: 22 };
  const open = async (app: App, id = 6) => {
    app.renderApp([`/merchant/offers/${id}`]);
    await app.screen.findByRole('heading', { level: 2, name: '싱싱과일 / 값이 다 있는 제안' });
  };

  it('GET /owner/offers 에서 id 로 찾아 보여주고, 제안 취소는 POST /offers/6/cancel 을 본문 없이 보낸다', async () => {
    const { calls } = stubServer({ offers: () => jsonResponse(200, [ITEM_FULL]) });
    const app = await loadApp();
    await open(app);
    expect(app.screen.getByText('모집 중')).toBeInTheDocument();

    await app.user.click(app.screen.getByRole('button', { name: '제안 취소' }));
    await app.user.click(
      app.within(app.screen.getByRole('dialog')).getByRole('button', { name: '취소하기' }),
    );

    expect(await app.screen.findByText('취소한 제안이에요')).toBeInTheDocument();
    const posts = calls.filter((c) => c.method === 'POST' && !c.path.endsWith('/auth/guest'));
    expect(posts.map((c) => c.path)).toEqual(['/api/v1/offers/6/cancel']);
    expect(posts[0]?.body).toBeNull();
    expect(app.screen.getByText('0 / 20명 예약')).toBeInTheDocument();
  });

  it('수령 완료 처리는 POST /offers/6/done 이고 성공하면 완료가 된다', async () => {
    const { calls } = stubServer({ offers: () => jsonResponse(200, [CONFIRMED]) });
    const app = await loadApp();
    await open(app);

    await app.user.click(app.screen.getByRole('button', { name: '수령 완료 처리' }));
    await app.user.click(
      app.within(app.screen.getByRole('dialog')).getByRole('button', { name: '끝내기' }),
    );

    expect(await app.screen.findByText('수량이 완료된 제안이에요')).toBeInTheDocument();
    expect(
      calls
        .filter((c) => c.method === 'POST' && !c.path.endsWith('/auth/guest'))
        .map((c) => c.path),
    ).toEqual(['/api/v1/offers/6/done']);
  });

  it('데모 세션도 막지 않고 POST 를 보낸다(데모 차단 문구 없음)', async () => {
    localStorage.setItem(
      'yyt.session',
      JSON.stringify({ token: 'tok-demo', expiresAt: Date.now() + 1e7, demo: true }),
    );
    const { calls } = stubServer({ offers: () => jsonResponse(200, [CONFIRMED]) });
    const app = await loadApp();
    await open(app);

    await app.user.click(app.screen.getByRole('button', { name: '수령 완료 처리' }));
    await app.user.click(
      app.within(app.screen.getByRole('dialog')).getByRole('button', { name: '끝내기' }),
    );

    expect(await app.screen.findByText('수량이 완료된 제안이에요')).toBeInTheDocument();
    expect(
      calls.filter((c) => c.method === 'POST' && !c.path.endsWith('/auth/guest')),
    ).toHaveLength(1);
    expect(app.screen.queryByText(/데모 계정은 사장님 화면만/)).not.toBeInTheDocument();
  });

  it('409 OFFER_CLOSED 는 안내 후 GET /owner/offers 를 다시 불러 서버 상태로 맞춘다', async () => {
    let listCalls = 0;
    const { calls } = stubServer({
      offers: () =>
        jsonResponse(200, [++listCalls === 1 ? ITEM_FULL : { ...ITEM_FULL, status: 'CLOSED' }]),
      action: () => jsonResponse(409, { code: 'OFFER_CLOSED', message: '서버 원문' }),
    });
    const app = await loadApp();
    await open(app);

    await app.user.click(app.screen.getByRole('button', { name: '제안 취소' }));
    await app.user.click(
      app.within(app.screen.getByRole('dialog')).getByRole('button', { name: '취소하기' }),
    );

    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '지금은 처리할 수 없는 상태예요. 최신 상태로 다시 보여드릴게요.',
    );
    expect(app.screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    await app.waitFor(() =>
      expect(app.screen.getByText('마감', { selector: 'span' })).toBeInTheDocument(),
    );
    expect(calls.filter((c) => c.path === '/api/v1/owner/offers')).toHaveLength(2);
    expect(app.screen.queryByRole('button', { name: '제안 취소' })).not.toBeInTheDocument();
  });

  it('403 은 내 제안이 아니라는 안내이고, 404 는 찾을 수 없는 제안 화면이다', async () => {
    stubServer({
      offers: () => jsonResponse(200, [ITEM_FULL]),
      action: () => jsonResponse(403, { code: 'FORBIDDEN', message: '서버 원문' }),
    });
    const app = await loadApp();
    await open(app);
    await app.user.click(app.screen.getByRole('button', { name: '제안 취소' }));
    await app.user.click(
      app.within(app.screen.getByRole('dialog')).getByRole('button', { name: '취소하기' }),
    );
    expect(await app.screen.findByRole('alert')).toHaveTextContent(
      '내 제안이 아니라서 처리할 수 없어요.',
    );
    app.cleanup();

    stubServer({
      offers: () => jsonResponse(200, [ITEM_FULL]),
      action: () => jsonResponse(404, { code: 'NOT_FOUND', message: '서버 원문' }),
    });
    const app2 = await loadApp();
    await open(app2);
    await app2.user.click(app2.screen.getByRole('button', { name: '제안 취소' }));
    await app2.user.click(
      app2.within(app2.screen.getByRole('dialog')).getByRole('button', { name: '취소하기' }),
    );
    expect(await app2.screen.findByText('찾을 수 없는 제안이에요')).toBeInTheDocument();
  });

  it('목록에 없는 id·숫자가 아닌 id 는 찾을 수 없는 제안이다(숫자가 아니면 요청도 없다)', async () => {
    const { calls } = stubServer({ offers: () => jsonResponse(200, [ITEM_FULL]) });
    const app = await loadApp();
    app.renderApp(['/merchant/offers/offer-seed-1']);

    expect(await app.screen.findByText('찾을 수 없는 제안이에요')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/api/v1/owner/offers')).toHaveLength(0);
  });
});
