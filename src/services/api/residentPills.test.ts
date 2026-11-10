import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreCategory } from '@/types/domain';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiDemandService } from './apiDemandService';
import { mapMapMarkers, mapMyRequests } from './mappers';
import { mockDemandService } from '../mockDemandService';
import { createTokenStore } from './tokenStore';

const category = (
  id: string,
  name: string,
  requestLabel: string,
  missingLabel: string,
): StoreCategory => ({
  id,
  name,
  cardTitle: name,
  requestLabel,
  missingLabel,
  objectPhrase: name,
  titleLabel: name,
});
const CATEGORIES = [
  category('7', '과일·채소 가게', '과일', '과일 / 채소'),
  category('18', '반찬가게', '반찬', '반찬'),
  category('28', '빵집', '빵', '빵집'),
];
const CENTER = { lat: 37.29349, lon: 127.13252 };
const STORES = [
  { id: 1, name: '가게A', categoryId: 7, lat: 37.29, lon: 127.13 },
  { id: 2, name: '가게B', categoryId: 3, lat: 37.3, lon: 127.14 },
];
const MAP = {
  dong: { id: 22, name: '구성동', center: CENTER },
  stores: STORES,
  requests: [
    { categoryId: 7, name: '과일·채소 가게', count: 29 },
    { categoryId: 18, name: '반찬가게', count: 12 },
    { categoryId: 28, name: '빵집', count: 6 },
  ],
  gaps: [{ categoryId: 7, name: '과일·채소 가게' }],
};
const pills = (markers: ReturnType<typeof mapMapMarkers>) =>
  markers.filter((m) => m.kind !== 'existing');

describe('mapMapMarkers: 요청·부족 가게 알약', () => {
  it('requests·gaps 를 dong.center 에 놓고 위경도는 전부 같으며 서버 값 그대로다', () => {
    const markers = mapMapMarkers(MAP, CATEGORIES);

    expect(pills(markers).map((m) => [m.id, m.kind, m.label])).toEqual([
      ['request-7', 'request', '과일 요청 29'],
      ['request-18', 'request', '반찬 요청 12'],
      ['request-28', 'request', '빵 요청 6'],
      ['missing-7', 'missing', 'X : 과일 / 채소'],
    ]);
    for (const pill of pills(markers)) {
      expect([pill.lat, pill.lng]).toEqual([CENTER.lat, CENTER.lon]);
    }
  });

  it('겹침은 오프셋으로만 푼다: 알약마다 서로 다른 오프셋이고 declutterOffsets 가 만든 값이다', () => {
    const list = pills(mapMapMarkers(MAP, CATEGORIES));

    expect(list.every((m) => m.offset !== undefined)).toBe(true);
    expect(new Set(list.map((m) => `${m.offset?.x},${m.offset?.y}`)).size).toBe(list.length);
    // 세로로 쌓이므로 y 가 순서대로 커지고 평균이 0 근처(가운데 기준)다.
    const ys = list.map((m) => m.offset?.y ?? 0);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(ys.reduce((a, b) => a + b, 0) / ys.length).toBeCloseTo(0, 0);
    // 알약 높이(약 26px)보다 간격이 커서 서로 덮이지 않는다.
    for (let i = 1; i < ys.length; i += 1)
      expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(30);
  });

  it('알약이 하나면 오프셋은 0 이다', () => {
    const [only] = pills(
      mapMapMarkers({ dong: MAP.dong, requests: [MAP.requests[0]!] }, CATEGORIES),
    );

    expect(only?.offset).toEqual({ x: 0, y: 0 });
  });

  it('가게 핀은 그대로이고 알약보다 앞에 온다(stores 처리에 영향이 없다)', () => {
    const markers = mapMapMarkers(MAP, CATEGORIES);

    expect(markers.slice(0, 2).map((m) => [m.id, m.kind, m.lat, m.lng])).toEqual([
      ['store-1', 'existing', 37.29, 127.13],
      ['store-2', 'existing', 37.3, 127.14],
    ]);
    expect(markers).toHaveLength(2 + 4);
  });

  it.each([
    ['center 가 없음', { id: 22 }],
    ['dong 이 없음', undefined],
    ['center 가 null', { id: 22, center: null }],
    ['lat 가 없음', { id: 22, center: { lon: 127.1 } }],
    ['lon 이 없음', { id: 22, center: { lat: 37.2 } }],
    ['lat 이 문자', { id: 22, center: { lat: '37.2' as never, lon: 127.1 } }],
    ['lat 이 NaN', { id: 22, center: { lat: Number.NaN, lon: 127.1 } }],
    ['lat 이 범위 밖(91)', { id: 22, center: { lat: 91, lon: 127.1 } }],
    ['lon 이 범위 밖(-181)', { id: 22, center: { lat: 37.2, lon: -181 } }],
  ])('dong.center 가 %s 이면 알약을 만들지 않고 가게 핀은 그대로다', (_name, dong) => {
    const markers = mapMapMarkers({ ...MAP, dong }, CATEGORIES);

    expect(pills(markers)).toEqual([]);
    expect(markers.map((m) => m.id)).toEqual(['store-1', 'store-2']);
  });

  it('stores 가 없어도 center 가 있으면 알약은 만든다. 항목이 모두 잘못되면 알약이 없다', () => {
    expect(
      pills(mapMapMarkers({ dong: MAP.dong, requests: MAP.requests }, CATEGORIES)),
    ).toHaveLength(3);
    expect(
      mapMapMarkers(
        {
          dong: MAP.dong,
          requests: [
            { categoryId: 0, name: 'x', count: 1 },
            { categoryId: 7, name: 'y' },
            null as never,
          ],
          gaps: [{ name: 'z' }],
        },
        CATEGORIES,
      ),
    ).toEqual([]);
  });

  it('업종 목록에 없으면 항목의 이름을 쓰고, 업종 목록 없이도 만든다', () => {
    const [request, gap] = pills(
      mapMapMarkers({
        dong: MAP.dong,
        requests: [{ categoryId: 99, name: '꽃집', count: 2 }],
        gaps: [{ categoryId: 99, name: '꽃집' }],
      }),
    );

    expect(request?.label).toBe('꽃집 요청 2');
    expect(gap?.label).toBe('X : 꽃집');
  });

  it('요청이 하나도 없고 gaps 도 비면(포곡읍) 알약은 없고 가게 핀만 있다', () => {
    const markers = mapMapMarkers({ ...MAP, requests: [], gaps: [] }, CATEGORIES);

    expect(pills(markers)).toEqual([]);
    expect(markers).toHaveLength(2);
  });
});

describe('listMapMarkers(API) 의 업종 문구', () => {
  beforeEach(() => localStorage.clear());
  const newService = () => {
    const client = createApiClient({
      baseUrl: 'https://api.test',
      store: createTokenStore(),
      now: () => 1_000_000,
    });
    return createApiDemandService(mockDemandService, () => client);
  };
  const server = (categories: (call: StubCall) => Response) =>
    stubFetch((call) => {
      if (call.path === '/api/v1/auth/guest')
        return jsonResponse(200, { accessToken: 't', expiresIn: 3600 });
      if (call.path === '/api/v1/categories') return categories(call);
      if (call.path === '/api/v1/dongs/22/map') return jsonResponse(200, MAP);
      return jsonResponse(404, { code: 'NOT_FOUND' });
    });

  it('업종 목록의 표시 문구로 알약을 만든다', async () => {
    server(() =>
      jsonResponse(200, [{ id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true }]),
    );

    const markers = await newService().listMapMarkers('22');

    expect(pills(markers).map((m) => m.label)).toEqual([
      '과일 요청 29',
      '반찬가게 요청 12',
      '빵집 요청 6',
      'X : 과일 / 채소',
    ]);
  });

  it('업종 목록을 기다리는 중에 취소(abort)돼도 처리되지 않은 거부가 남지 않는다', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    let finishCategories: (r: Response) => void = () => undefined;
    stubFetch((call, init) => {
      if (call.path === '/api/v1/auth/guest')
        return jsonResponse(200, { accessToken: 't', expiresIn: 3600 });
      if (call.path === '/api/v1/categories') {
        return new Promise<Response>((resolve) => (finishCategories = resolve));
      }
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    });
    const controller = new AbortController();

    const outcome = newService()
      .listMapMarkers('22', controller.signal)
      .then(
        () => 'resolved',
        (error: unknown) => error,
      );
    await vi.waitFor(() => expect(typeof finishCategories).toBe('function'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 20));
    finishCategories(jsonResponse(200, []));

    expect(await outcome).toMatchObject({ name: 'AbortError' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it('업종 목록을 못 불러와도 가게 핀과 알약(항목의 이름)은 그린다', async () => {
    server(() => jsonResponse(500, { code: 'X' }));

    const markers = await newService().listMapMarkers('22');

    expect(markers.filter((m) => m.kind === 'existing')).toHaveLength(2);
    expect(pills(markers).map((m) => m.label)).toContain('과일·채소 가게 요청 29');
  });
});

describe('mapMyRequests 의 구 이름', () => {
  const dto = {
    id: 1,
    dong: { id: 22, name: '구성동' },
    category: { id: 7, name: '과일·채소 가게' },
    count: 3,
  };

  it('동네 목록에서 동 id 로 구를 채우고, 못 찾으면 빈 문자열이다', () => {
    const hood = [{ id: '22', district: '기흥구', name: '구성동' }];

    expect(mapMyRequests([dto], [], hood)[0]?.neighborhood).toEqual({
      id: '22',
      district: '기흥구',
      name: '구성동',
    });
    expect(
      mapMyRequests([{ ...dto, dong: { id: 99, name: '모름동' } }], [], hood)[0]?.neighborhood
        .district,
    ).toBe('');
    expect(mapMyRequests([dto], [])[0]?.neighborhood.district).toBe('');
  });
});

describe('내 요청 서비스의 구 이름(createApiRequestServices)', () => {
  beforeEach(() => localStorage.clear());

  async function listWith(
    neighborhoods: () => Promise<{ id: string; district: string; name: string }[]>,
  ) {
    const { createApiRequestServices } = await import('./apiRequestServices');
    stubFetch((call) =>
      call.path === '/api/v1/auth/guest'
        ? jsonResponse(200, { accessToken: 't', expiresIn: 3600 })
        : jsonResponse(200, [
            {
              id: 1,
              dong: { id: 22, name: '구성동' },
              category: { id: 7, name: '과일·채소 가게' },
              count: 3,
            },
          ]),
    );
    const client = createApiClient({
      baseUrl: 'https://api.test',
      store: createTokenStore(),
      now: () => 1_000_000,
    });
    const { myRequestService } = createApiRequestServices({
      listCategories: async () => CATEGORIES,
      listNeighborhoods: neighborhoods,
      getClient: () => client,
    });
    return myRequestService.listMyRequests();
  }

  it('동네 목록에서 구를 채운다', async () => {
    const [item] = await listWith(async () => [{ id: '22', district: '기흥구', name: '구성동' }]);

    expect(item?.neighborhood.district).toBe('기흥구');
  });

  it('동네 목록 호출이 실패해도 내 요청은 표시되고 구만 빈다', async () => {
    const [item] = await listWith(() => Promise.reject(new Error('boom')));

    expect(item).toMatchObject({
      neighborhood: { id: '22', district: '', name: '구성동' },
      requestCount: 3,
    });
  });
});

describe('가게 핀과 알약의 z-index (syncMarkers)', () => {
  it('알약은 가게 핀보다 위(큰 zIndex)에 그린다', async () => {
    const created: Record<string, unknown>[] = [];
    vi.stubGlobal('naver', {
      maps: {
        LatLng: class {
          lat: number;
          lng: number;
          constructor(lat: number, lng: number) {
            this.lat = lat;
            this.lng = lng;
          }
        },
        Point: class {
          x: number;
          y: number;
          constructor(x: number, y: number) {
            this.x = x;
            this.y = y;
          }
        },
        Marker: class {
          constructor(options: Record<string, unknown>) {
            created.push(options);
          }
          setMap() {}
        },
      },
    });
    const { syncMarkers } = await import('@/shared/ui/naverMapMarkers');
    const geo = mapMapMarkers(MAP, CATEGORIES) as Parameters<typeof syncMarkers>[2];

    syncMarkers({} as never, new Map(), geo);

    const zOf = (index: number) => created[index]?.zIndex as number;
    expect(created).toHaveLength(geo.length);
    geo.forEach((marker, index) => {
      if (marker.kind === 'existing') expect(zOf(index)).toBe(0);
      else expect(zOf(index)).toBeGreaterThan(0);
    });
    vi.unstubAllGlobals();
  });
});
