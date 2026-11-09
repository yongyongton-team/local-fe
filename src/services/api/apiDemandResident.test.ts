import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDemandService } from '@/services/mockDemandService';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiDemandService } from './apiDemandService';
import { isNoStoreGap } from './gapStatus';
import { mapGaps, mapMapMarkers, pickDefaultCategoryId } from './mappers';
import { createTokenStore } from './tokenStore';

const GUEST = '/api/v1/auth/guest';
const newService = () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    store: createTokenStore(),
    now: () => 1_000_000,
  });
  return createApiDemandService(mockDemandService, () => client);
};

const DONGS = [
  { id: 22, name: '구성동', gu: '기흥구' },
  { id: 28, name: '보정동', gu: '기흥구' },
];
const CATEGORIES = [
  { id: 3, code: 'BAKERY', name: '빵집', martCheck: false },
  { id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true },
  { id: 30, code: 'FLOWER_SHOP', name: '꽃집', martCheck: false },
];

interface Routes {
  gaps?: (call: StubCall, init: RequestInit) => Response | Promise<Response>;
  map?: (call: StubCall, init: RequestInit) => Response | Promise<Response>;
  categories?: () => Response;
}
/** 서버 흉내. 경로별 응답을 바꿀 수 있고, 안 바꾸면 빈 목록이다. */
function stubServer(routes: Routes = {}) {
  return stubFetch((call, init) => {
    if (call.path === GUEST) {
      return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });
    }
    if (call.path === '/api/v1/dongs') return jsonResponse(200, DONGS);
    if (call.path === '/api/v1/categories') {
      return routes.categories?.() ?? jsonResponse(200, CATEGORIES);
    }
    if (call.path.endsWith('/gaps')) return routes.gaps?.(call, init) ?? jsonResponse(200, []);
    if (call.path.endsWith('/map')) return routes.map?.(call, init) ?? jsonResponse(200, {});
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const callsTo = (calls: StubCall[], path: string) => calls.filter((c) => c.path === path);

beforeEach(() => localStorage.clear());

describe('mapGaps', () => {
  const neighborhood = { id: '22', district: '기흥구', name: '구성동' };
  const categories = [
    {
      id: '7',
      name: '과일·채소 가게',
      cardTitle: '과일 / 채소 가게',
      requestLabel: '과일',
      missingLabel: '과일 / 채소',
      objectPhrase: '과일·채소 가게를',
      titleLabel: '과일 가게',
      martCheck: true,
    },
  ];

  it('숫자 categoryId 를 문자열로, nearestMart.km 를 nearestHypermarketKm 으로, myRequested 를 requestedByMe 로 바꾼다', () => {
    const [report] = mapGaps(
      [
        {
          categoryId: 7,
          name: '과일·채소 가게',
          status: 'X',
          requestCount: 12,
          nearestMart: { name: '이마트', km: 1.4 },
          myRequested: true,
        },
      ],
      { neighborhood, categories },
    );

    expect(report).toEqual({
      neighborhood,
      category: categories[0],
      demand: {
        neighborhoodId: '22',
        categoryId: '7',
        requestCount: 12,
        nearbySameCategoryCount: 0,
        nearestHypermarketKm: 1.4,
        requestedByMe: true,
      },
    });
  });

  it('nearestMart 가 null·없음·km 없음이면 거리 필드를 비우고 나머지는 정상이다', () => {
    const reports = mapGaps(
      [
        { categoryId: 7, requestCount: 1, nearestMart: null },
        { categoryId: 7, requestCount: 2 },
        { categoryId: 7, requestCount: 3, nearestMart: { name: '이마트', km: null } },
      ],
      { neighborhood, categories },
    );

    expect(reports).toHaveLength(3);
    reports.forEach((r) => expect(r.demand).not.toHaveProperty('nearestHypermarketKm'));
    expect(reports.map((r) => r.demand.requestCount)).toEqual([1, 2, 3]);
    expect(reports[0]?.demand.requestedByMe).toBe(false);
  });

  it('업종 목록에 없는 categoryId 는 항목의 name 으로 대체하고, 양의 정수가 아니면 INVALID_ID 오류다', () => {
    const [report] = mapGaps([{ categoryId: 99, name: '꽃집' }], { neighborhood, categories });
    expect(report?.category).toMatchObject({ id: '99', name: '꽃집', cardTitle: '꽃집' });

    expect(() => mapGaps([{ categoryId: 'x' as never }], { neighborhood, categories })).toThrow(
      expect.objectContaining({ kind: 'parse', code: 'INVALID_ID' }),
    );
    expect(() => mapGaps({} as never, { neighborhood, categories })).toThrow(
      expect.objectContaining({ kind: 'parse' }),
    );
  });
});

describe('isNoStoreGap (status 판단)', () => {
  it('확인된 값 목록이 있으면 그 값만 "없는 가게"다', () => {
    expect(isNoStoreGap('NO_STORE', ['NO_STORE'])).toBe(true);
    expect(isNoStoreGap('HAS_STORE', ['NO_STORE'])).toBe(false);
    expect(isNoStoreGap(undefined, ['NO_STORE'])).toBe(false);
    expect(isNoStoreGap(null, ['NO_STORE'])).toBe(false);
  });

  it('뜻이 확인된 값이 없으면(현재 상태) 어떤 status 든 전부 보여준다', () => {
    expect(isNoStoreGap('ANYTHING')).toBe(true);
    expect(isNoStoreGap(undefined)).toBe(true);
    expect(isNoStoreGap(null)).toBe(true);

    const reports = mapGaps(
      [{ categoryId: 7, status: 'A' }, { categoryId: 3, status: 'B' }, { categoryId: 30 }],
      { neighborhood: { id: '22', district: '', name: '' }, categories: [] },
    );
    expect(reports.map((r) => r.category.id)).toEqual(['7', '3', '30']);
  });
});

describe('mapMapMarkers', () => {
  it('좌표가 있는 stores 를 existing 마커로 바꾼다(lon → lng, 좌표는 그대로, 숫자 id → 문자열)', () => {
    const markers = mapMapMarkers({
      stores: [
        { id: 1, name: '가게A', categoryId: 7, lat: 37.27, lon: 127.11 },
        { id: 2, name: '가게B', categoryId: 3, lat: 37.28, lon: 127.12 },
      ],
    });

    expect(markers.map((m) => [m.id, m.kind, m.categoryId, m.label, m.lat, m.lng])).toEqual([
      ['store-1', 'existing', '7', '가게A', 37.27, 127.11],
      ['store-2', 'existing', '3', '가게B', 37.28, 127.12],
    ]);
    // 자리표시자용 상대좌표는 마커 범위 안의 0~1 값이다(북쪽이 위).
    expect(markers[0]?.position).toEqual({ x: 0, y: 1 });
    expect(markers[1]?.position).toEqual({ x: 1, y: 0 });
  });

  it('좌표가 없거나 숫자가 아닌 가게와 id 없는 가게는 빼고, 좌표를 만들어 넣지 않는다', () => {
    const markers = mapMapMarkers({
      stores: [
        { id: 1, name: '좌표 없음', categoryId: 7 },
        { id: 2, name: 'lat 만', lat: 37.2 },
        { id: 3, name: 'null', lat: null, lon: null },
        { id: 4, name: '문자', lat: '37.2' as never, lon: 127.1 },
        { name: 'id 없음', lat: 37.2, lon: 127.1 },
        { id: 5, name: '정상', lat: 37.2, lon: 127.1 },
      ],
    });

    expect(markers.map((m) => m.id)).toEqual(['store-5']);
    expect(markers[0]).toMatchObject({ lat: 37.2, lng: 127.1, position: { x: 0.5, y: 0.5 } });
  });

  it('requests·gaps 는 좌표가 없어 마커가 되지 않고, stores 가 없으면 빈 배열이다', () => {
    expect(
      mapMapMarkers({
        requests: [{ categoryId: 7, name: '과일', count: 3 }],
        gaps: [{ categoryId: 7, name: '과일' }],
        stores: [],
      } as never),
    ).toEqual([]);
    expect(mapMapMarkers({})).toEqual([]);
    expect(() => mapMapMarkers(undefined)).toThrow(expect.objectContaining({ kind: 'parse' }));
  });
});

describe('pickDefaultCategoryId', () => {
  it('code FRUIT_VEG 가 있으면 그 id, 없으면 첫 업종, 비어 있으면 undefined', () => {
    expect(pickDefaultCategoryId(CATEGORIES)).toBe('7');
    expect(pickDefaultCategoryId([CATEGORIES[0]!, CATEGORIES[2]!])).toBe('3');
    expect(pickDefaultCategoryId([])).toBeUndefined();
  });
});

describe('createApiDemandService 주민 조회', () => {
  it('listReportsByNeighborhood: 숫자 dongId 로 gaps 를 부르고 업종·동네 정보와 합쳐 리포트로 만든다', async () => {
    const { calls } = stubServer({
      gaps: () =>
        jsonResponse(200, [
          {
            categoryId: 7,
            name: '과일·채소 가게',
            status: 'S',
            requestCount: 5,
            nearestMart: { name: '마트', km: 2.5 },
            myRequested: true,
          },
          { categoryId: 30, name: '꽃집', status: 'S', requestCount: 1, nearestMart: null },
        ]),
    });
    const service = newService();

    const reports = await service.listReportsByNeighborhood('22');

    expect(
      reports.map((r) => [r.neighborhood.name, r.category.cardTitle, r.demand.requestCount]),
    ).toEqual([
      ['구성동', '과일 / 채소 가게', 5],
      ['구성동', '꽃집', 1],
    ]);
    expect(reports[0]?.demand).toMatchObject({ nearestHypermarketKm: 2.5, requestedByMe: true });
    expect(reports[1]?.demand).not.toHaveProperty('nearestHypermarketKm');
    expect(callsTo(calls, '/api/v1/dongs/22/gaps')).toHaveLength(1);
    expect(callsTo(calls, '/api/v1/dongs/22/gaps')[0]?.authorization).toBe('Bearer tok-1');
  });

  it('listMapMarkers: 숫자 dongId 로 map 을 부르고 stores 만 마커로 만든다', async () => {
    const { calls } = stubServer({
      map: () =>
        jsonResponse(200, {
          dong: { id: 22, name: '구성동' },
          stores: [{ id: 9, name: '가게', categoryId: 7, lat: 37.3, lon: 127.1 }],
          requests: [{ categoryId: 7, name: '과일', count: 3 }],
          gaps: [{ categoryId: 7, name: '과일' }],
          marts: [{ name: '마트', lat: 37.2, lon: 127.2 }],
        }),
    });

    const markers = await newService().listMapMarkers('22');

    expect(markers.map((m) => [m.id, m.kind, m.lat, m.lng])).toEqual([
      ['store-9', 'existing', 37.3, 127.1],
    ]);
    expect(callsTo(calls, '/api/v1/dongs/22/map')).toHaveLength(1);
  });

  it('숫자가 아닌 neighborhoodId 는 요청 없이 INVALID_ID 오류다', async () => {
    const { fn } = stubServer();
    const service = newService();

    await expect(service.listReportsByNeighborhood('guseong')).rejects.toMatchObject({
      kind: 'parse',
      code: 'INVALID_ID',
    });
    await expect(service.listMapMarkers('guseong')).rejects.toMatchObject({
      kind: 'parse',
      code: 'INVALID_ID',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND 와 403 FORBIDDEN 은 코드를 가진 ApiError 로 던진다', async () => {
    stubServer({
      gaps: () => jsonResponse(404, { code: 'NOT_FOUND', message: 'x' }),
      map: () => jsonResponse(403, { code: 'FORBIDDEN', message: 'x' }),
    });
    const service = newService();

    await expect(service.listReportsByNeighborhood('9999')).rejects.toMatchObject({
      kind: 'http',
      status: 404,
      code: 'NOT_FOUND',
    });
    await expect(service.listMapMarkers('22')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it.each([
    ['listReportsByNeighborhood', '/gaps'],
    ['listMapMarkers', '/map'],
  ] as const)(
    '%s: 응답을 기다리는 중에 호출한 쪽이 abort 하면 요청이 취소되고 AbortError 로 끝난다',
    async (method, suffix) => {
      let fetchSignal: AbortSignal | null | undefined;
      const hang = (_call: StubCall, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          fetchSignal = init.signal;
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        });
      const { calls } = stubServer({ gaps: hang, map: hang });
      const controller = new AbortController();

      const pending = newService()[method]('22', controller.signal);
      const settled = pending.then(
        () => 'resolved',
        (error: unknown) => error,
      );
      await vi.waitFor(() => expect(calls.some((c) => c.path.endsWith(suffix))).toBe(true));
      expect(fetchSignal?.aborted).toBe(false);
      controller.abort();

      const outcome = await settled;
      expect(fetchSignal?.aborted).toBe(true);
      expect(outcome).toMatchObject({ name: 'AbortError' });
    },
  );
});

describe('업종·동네 목록 세션 캐시', () => {
  it('listCategories 를 두 번 불러도 요청은 한 번이고, 동시에 불러도 하나로 합친다', async () => {
    const { calls } = stubServer();
    const service = newService();

    const [a, b] = await Promise.all([service.listCategories(), service.listCategories()]);
    await service.listCategories();

    expect(a).toBe(b);
    expect(callsTo(calls, '/api/v1/categories')).toHaveLength(1);
  });

  it('gaps 를 여러 번 불러도 업종·동네 목록은 다시 받지 않는다', async () => {
    const { calls } = stubServer();
    const service = newService();

    await service.listReportsByNeighborhood('22');
    await service.listReportsByNeighborhood('28');
    await service.listNeighborhoods();

    expect(callsTo(calls, '/api/v1/categories')).toHaveLength(1);
    expect(callsTo(calls, '/api/v1/dongs')).toHaveLength(1);
  });

  it('실패하면 기억을 지워 다음 호출이 다시 요청하고, 성공한 뒤에는 다시 부르지 않는다', async () => {
    let fail = true;
    const { calls } = stubServer({
      categories: () => (fail ? jsonResponse(500, { code: 'X' }) : jsonResponse(200, CATEGORIES)),
    });
    const service = newService();

    await expect(service.listCategories()).rejects.toMatchObject({ status: 500 });
    fail = false;
    await expect(service.listCategories()).resolves.toHaveLength(3);
    await service.listCategories();

    expect(callsTo(calls, '/api/v1/categories')).toHaveLength(2);
  });

  it('서비스마다 기억이 따로라 새로 만든 서비스는 다시 불러온다', async () => {
    const { calls } = stubServer();

    await newService().listCategories();
    await newService().listCategories();

    expect(callsTo(calls, '/api/v1/categories')).toHaveLength(2);
  });
});

describe('getDefaultCategoryId', () => {
  it('API 는 code FRUIT_VEG 의 id 이고, 없으면 첫 업종이며, 같은 캐시를 써서 요청은 한 번이다', async () => {
    const { calls } = stubServer();
    const service = newService();

    await expect(service.getDefaultCategoryId()).resolves.toBe('7');
    await service.listCategories();
    expect(callsTo(calls, '/api/v1/categories')).toHaveLength(1);

    stubServer({
      categories: () => jsonResponse(200, [CATEGORIES[2], CATEGORIES[0]]),
    });
    await expect(newService().getDefaultCategoryId()).resolves.toBe('30');
  });

  it('업종 목록이 비어 있으면 parse 오류다', async () => {
    stubServer({ categories: () => jsonResponse(200, []) });

    await expect(newService().getDefaultCategoryId()).rejects.toMatchObject({ kind: 'parse' });
  });

  it('목은 기존 slug 기본값을 그대로 돌려주고 네트워크를 쓰지 않는다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, []));

    await expect(mockDemandService.getDefaultCategoryId()).resolves.toBe('fruit-vegetable');
    expect(fn).not.toHaveBeenCalled();
  });
});
