import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeNaver, type FakeMarker, type FakeNaver } from '@/test/fakeNaverMaps';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';

/**
 * 주민 지도의 가게 핀 정보(API 모드, GET /dongs/{id}/map 의 stores[]). 서비스 구현은 import 시점에 정해지므로
 * 환경 값을 바꾼 뒤 앱 모듈을 모두 새로 불러온다. 지도는 가짜 SDK 로 대신하고 마커 클릭을 흉내 낸다.
 */
type Rtl = typeof import('@testing-library/react');
let rtl: Rtl | null = null;

async function loadApp() {
  vi.stubEnv('VITE_DATA_SOURCE', 'api');
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');
  vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
  vi.resetModules();
  rtl = await import('@testing-library/react');
  const userEvent = (await import('@testing-library/user-event')).default;
  const { renderApp } = await import('@/test/renderApp');
  return { ...rtl, user: userEvent.setup(), renderApp };
}
type App = Awaited<ReturnType<typeof loadApp>>;

const DONGS = [{ id: 22, name: '구성동', gu: '기흥구' }];
const CATEGORIES = [
  { id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true },
  { id: 33, code: 'MARTIAL_ARTS', name: '태권도장', martCheck: false },
];
const ME = { id: 3, nickname: '게스트', role: 'RESIDENT', dong: DONGS[0], shop: null };
const MAP_22 = {
  dong: { id: 22, center: { lat: 37.2979, lon: 127.1054 } },
  stores: [
    { id: 1, name: '구성 청과', categoryId: 7, lat: 37.299, lon: 127.106 },
    { id: 2, name: '용인 태권도', categoryId: 33, lat: 37.301, lon: 127.109 },
    // 업종 목록에 없는 업종: 이름만 보인다.
    { id: 3, name: '이름만 가게', categoryId: 999, lat: 37.3, lon: 127.108 },
  ],
  requests: [{ categoryId: 7, name: '과일', count: 4 }],
  gaps: [{ categoryId: 33, name: '태권도' }],
};

function stubServer() {
  return stubFetch((call: StubCall) => {
    if (call.path === '/api/v1/auth/guest') {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.method === 'PUT' && call.path === '/api/v1/me') return jsonResponse(200, ME);
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
    if (/^\/api\/v1\/dongs\/22\/gaps$/.test(call.path)) return jsonResponse(200, []);
    if (/^\/api\/v1\/dongs\/22\/map$/.test(call.path)) return jsonResponse(200, MAP_22);
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}

const nameOf = (marker: FakeMarker) => marker.options.icon.content.getAttribute('aria-label') ?? '';
const stores = (fake: FakeNaver) => fake.attached().filter((m) => m.options.clickable);
const store = (fake: FakeNaver, name: string) => stores(fake).find((m) => nameOf(m) === name)!;

async function openResident(app: App) {
  const fake = installFakeNaver();
  app.renderApp(['/']);
  await app.screen.findByRole('option', { name: '기흥구 구성동' });
  await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
  await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
  await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' });
  // 가게 핀 3개 + 요청·부족 알약 2개가 지도에 올라올 때까지 기다린다.
  await app.waitFor(() => expect(fake.attached()).toHaveLength(5));
  return fake;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  rtl?.cleanup();
  rtl = null;
});

describe('주민 지도: 가게 핀 정보', () => {
  it('가게 핀만 클릭할 수 있고 요청·부족 지역 알약은 눌러도 반응이 없다', async () => {
    stubServer();
    const app = await loadApp();
    const fake = await openResident(app);

    expect(stores(fake).map(nameOf).sort()).toEqual(['구성 청과', '용인 태권도', '이름만 가게']);
    fake
      .attached()
      .filter((m) => !m.options.clickable)
      .forEach((m) => m.click());

    expect(app.screen.queryByRole('status', { name: /./ })).not.toBeInTheDocument();
    expect(app.screen.queryByText(/구성 청과 ·/)).not.toBeInTheDocument();
  });

  it('핀을 누르면 지도 아래에 "가게 이름 · 업종" 정보 카드가 보인다(role="status")', async () => {
    stubServer();
    const app = await loadApp();
    const fake = await openResident(app);

    app.act(() => store(fake, '구성 청과').click());

    const card = app.screen.getByText('구성 청과 · 과일·채소 가게');
    expect(card).toHaveAttribute('role', 'status');
    // 지도 영역 안에 있어 하단 내비를 가리지 않는다(내비는 지도 밖에 따로 있다).
    expect(card.closest('nav')).toBeNull();
    expect(app.screen.getByRole('navigation', { name: '주민 메뉴' })).toBeInTheDocument();
  });

  it('업종 목록에 없는 업종이면 가게 이름만 보인다', async () => {
    stubServer();
    const app = await loadApp();
    const fake = await openResident(app);

    app.act(() => store(fake, '이름만 가게').click());

    expect(app.screen.getByText('이름만 가게')).toBeInTheDocument();
    expect(app.screen.queryByText(/이름만 가게 ·/)).not.toBeInTheDocument();
  });

  it('다른 핀을 누르면 정보 카드가 교체되어 한 번에 하나만 보인다', async () => {
    stubServer();
    const app = await loadApp();
    const fake = await openResident(app);

    app.act(() => store(fake, '구성 청과').click());
    app.act(() => store(fake, '용인 태권도').click());

    expect(app.screen.getByText('용인 태권도 · 태권도장')).toBeInTheDocument();
    expect(app.screen.queryByText(/구성 청과 ·/)).not.toBeInTheDocument();
    expect(
      app.screen.getAllByRole('status').filter((el) => / · /.test(el.textContent ?? '')),
    ).toHaveLength(1);
  });

  it('닫기 버튼을 누르면 닫힌다', async () => {
    stubServer();
    const app = await loadApp();
    const fake = await openResident(app);
    app.act(() => store(fake, '구성 청과').click());

    await app.user.click(app.screen.getByRole('button', { name: '가게 정보 닫기' }));

    expect(app.screen.queryByText(/구성 청과 ·/)).not.toBeInTheDocument();
  });

  it('지도의 빈 곳을 누르면 닫히지만, 핀을 누른 같은 순간의 지도 클릭에는 닫히지 않는다', async () => {
    stubServer();
    const app = await loadApp();
    const fake = await openResident(app);
    const map = fake.maps.at(-1)!;

    app.act(() => {
      store(fake, '구성 청과').click();
      map.emit('click');
    });
    expect(app.screen.getByText('구성 청과 · 과일·채소 가게')).toBeInTheDocument();

    // 사용자의 다음 누르기는 다른 순간이다(같은 순간 무시는 한 틱 뒤에 풀린다).
    await new Promise((resolve) => setTimeout(resolve, 5));
    app.act(() => map.emit('click'));
    expect(app.screen.queryByText(/구성 청과 ·/)).not.toBeInTheDocument();
  });

  it('추가 요청 없이 이미 받은 데이터와 업종 목록으로 보여준다', async () => {
    const { calls } = stubServer();
    const app = await loadApp();
    const fake = await openResident(app);
    const before = calls.length;

    app.act(() => store(fake, '구성 청과').click());
    app.act(() => store(fake, '용인 태권도').click());

    expect(calls).toHaveLength(before);
  });

  it('필터로 가게 핀이 지도에서 사라지면 정보 카드도 사라지고 리스너가 해제된다', async () => {
    stubServer();
    const app = await loadApp();
    const fake = await openResident(app);
    app.act(() => store(fake, '구성 청과').click());
    expect(fake.listenerCount()).toBe(4); // 가게 핀 3 + 지도 클릭 1

    await app.user.click(app.screen.getByRole('radio', { name: '주민 요청' }));

    expect(app.screen.queryByText(/구성 청과 ·/)).not.toBeInTheDocument();
    expect(fake.listenerCount()).toBe(1); // 지도 클릭만
    expect(stores(fake)).toHaveLength(0);
  });

  it('화면을 떠나면 마커·지도 리스너가 모두 해제된다(누수 없음)', async () => {
    stubServer();
    const app = await loadApp();
    const fake = await openResident(app);
    expect(fake.listenerCount()).toBe(4);

    await app.user.click(app.screen.getByRole('link', { name: '가게 요청' }));
    await app.screen.findByRole('heading', { level: 1, name: '가게 요청하기' });

    expect(fake.listenerCount()).toBe(0);
    expect(fake.attached()).toHaveLength(0);
  });
});

/** 이름이 비었거나 업종을 못 찾는 가게(가짜 값). 카드는 있는 정보만 보여준다. */
const MAP_PARTIAL = {
  ...MAP_22,
  stores: [
    { id: 11, name: '', categoryId: 7, lat: 37.299, lon: 127.106 }, // 이름 없음 → 업종만
    { id: 12, name: '업종 없는 가게', lat: 37.301, lon: 127.109 }, // categoryId 없음 → 이름만
    { id: 13, name: '  ', lat: 37.3, lon: 127.108 }, // 이름도 업종도 없음 → 기본 문구
    { id: 14, name: '낯선 업종 가게', categoryId: 999, lat: 37.302, lon: 127.107 }, // 목록에 없는 업종 → 이름만
  ],
};

describe('주민 지도: 가게 정보가 일부 비었을 때', () => {
  async function openPartial() {
    stubFetch((call: StubCall) => {
      if (call.path === '/api/v1/auth/guest') {
        return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
      }
      if (call.method === 'PUT' && call.path === '/api/v1/me') return jsonResponse(200, ME);
      if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
      if (call.path === '/api/v1/categories') return jsonResponse(200, CATEGORIES);
      if (/^\/api\/v1\/dongs\/22\/gaps$/.test(call.path)) return jsonResponse(200, []);
      if (/^\/api\/v1\/dongs\/22\/map$/.test(call.path)) return jsonResponse(200, MAP_PARTIAL);
      return jsonResponse(404, { code: 'NOT_FOUND' });
    });
    const app = await loadApp();
    const fake = await (async () => {
      const f = installFakeNaver();
      app.renderApp(['/']);
      await app.screen.findByRole('option', { name: '기흥구 구성동' });
      await app.user.click(app.screen.getByRole('radio', { name: /^주민/ }));
      await app.user.click(app.screen.getByRole('button', { name: '시작하기' }));
      await app.screen.findByRole('heading', { level: 1, name: '동네 탐색' });
      await app.waitFor(() => expect(stores(f)).toHaveLength(4));
      return f;
    })();
    return { app, fake };
  }
  const textAfterClicking = async (index: number) => {
    const { app, fake } = await openPartial();
    app.act(() => stores(fake)[index]!.click());
    return app.screen.getByRole('button', { name: '가게 정보 닫기' }).parentElement!.textContent;
  };

  it('이름이 비어 있으면 업종만 보인다(앞에 구분점이 남지 않는다)', async () => {
    expect(await textAfterClicking(0)).toBe('과일·채소 가게');
  });

  it('업종 id 가 없거나 업종 목록에 없으면 이름만 보인다', async () => {
    expect(await textAfterClicking(1)).toBe('업종 없는 가게');
  });

  it('업종 목록에 없는 업종도 이름만 보인다', async () => {
    expect(await textAfterClicking(3)).toBe('낯선 업종 가게');
  });

  it('이름도 업종도 없으면 기본 문구를 보여주고 "있는 가게 위치" 같은 패널 제목은 쓰지 않는다', async () => {
    const text = await textAfterClicking(2);
    expect(text).toBe('가게 정보를 불러오지 못했어요');
    expect(text).not.toContain('있는 가게 위치');
  });
});
