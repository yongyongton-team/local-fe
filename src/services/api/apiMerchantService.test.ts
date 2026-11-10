import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Neighborhood, StoreCategory } from '@/types/domain';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiMerchantService } from './apiMerchantService';
import {
  mapMerchantProfile,
  mapOwnerAreas,
  mapOwnerDetail,
  mapOwnerMapData,
  ratioToPercent,
} from './mappers';
import { createTokenStore } from './tokenStore';

const GUEST = '/api/v1/auth/guest';
const FRUIT: StoreCategory = {
  id: '7',
  name: '과일·채소 가게',
  cardTitle: '과일 / 채소 가게',
  requestLabel: '과일',
  missingLabel: '과일 / 채소',
  objectPhrase: '과일·채소 가게를',
  titleLabel: '과일 가게',
  martCheck: true,
};
const NEIGHBORHOODS: Neighborhood[] = [
  { id: '22', district: '기흥구', name: '구성동' },
  { id: '23', district: '기흥구', name: '마북동' },
  { id: '28', district: '기흥구', name: '보정동' },
];

const SHOP = {
  shopName: '싱싱과일',
  category: { id: 7, name: '과일·채소 가게' },
  dong: { id: 23, name: '마북동' },
  lat: 37.3108,
  lon: 127.1398,
};
const ME = { id: 54, nickname: '데모', role: 'OWNER', dong: null, shop: SHOP };
const AREAS = [
  {
    dongId: 22,
    name: '구성동',
    requestCount: 29,
    distanceKm: 2,
    topTimeSlot: 'WEEKDAY_EVENING',
    sameCategoryStoreCount: 0,
    center: { lat: 37.2979, lon: 127.1054 },
  },
  {
    dongId: 28,
    name: '보정동',
    requestCount: 14,
    distanceKm: 2.8,
    topTimeSlot: 'WEEKEND',
    sameCategoryStoreCount: 2,
    center: { lat: 37.3, lon: 127.12 },
  },
  {
    dongId: 23,
    name: '마북동',
    requestCount: 9,
    distanceKm: 2.6,
    topTimeSlot: 'WEEKDAY_DAY',
    sameCategoryStoreCount: 3,
    center: { lat: 37.31, lon: 127.14 },
  },
];
const DETAIL = {
  dong: { id: 22, name: '구성동' },
  category: { id: 7, name: '과일·채소 가게' },
  requestCount: 29,
  sameCategoryStoreCount: 0,
  conditions: [
    { code: 'LATE_OPEN', label: '늦게까지 영업', count: 17 },
    { code: 'SMALL_QTY', label: '낱개 구매', count: 10 },
  ],
  timeSlots: [
    { slot: 'WEEKDAY_EVENING', count: 17, ratio: 0.59 },
    { slot: 'WEEKEND', count: 9, ratio: 0.31 },
    { slot: 'WEEKDAY_DAY', count: 3, ratio: 0.1 },
  ],
  summary: { text: '구성동에서는 29명이 찾아요.', by: 'AI' },
};

type Handler = (call: StubCall, init: RequestInit) => Response | Promise<Response>;
function stubServer(routes: { me?: Handler; demand?: Handler; detail?: Handler } = {}) {
  return stubFetch((call, init) => {
    if (call.path === GUEST) return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600 });
    if (call.path === '/api/v1/me') return routes.me?.(call, init) ?? jsonResponse(200, ME);
    if (call.path.startsWith('/api/v1/owner/demand/')) {
      return routes.detail?.(call, init) ?? jsonResponse(200, DETAIL);
    }
    if (call.path.startsWith('/api/v1/owner/demand')) {
      return routes.demand?.(call, init) ?? jsonResponse(200, { radiusKm: 3, areas: AREAS });
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
function newServices(neighborhoods: Neighborhood[] = NEIGHBORHOODS) {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    store: createTokenStore(),
    now: () => 1_000_000,
  });
  return createApiMerchantService({
    listCategories: async () => [FRUIT],
    listNeighborhoods: async () => neighborhoods,
    getClient: () => client,
  });
}
const callsTo = (calls: StubCall[], prefix: string) =>
  calls.filter((c) => c.path.startsWith(prefix));

beforeEach(() => localStorage.clear());

describe('mapMerchantProfile', () => {
  const shop = {
    shopName: '싱싱과일',
    categoryId: 7,
    categoryName: '과일·채소 가게',
    dongId: 23,
    dongName: '마북동',
    lat: 37.3,
    lng: 127.1,
  };

  it('shop 을 프로필로 바꾼다(업종 id 문자열, 구는 동네 목록에서)', () => {
    expect(mapMerchantProfile(shop, NEIGHBORHOODS)).toEqual({
      shopName: '싱싱과일',
      categoryId: '7',
      categoryName: '과일·채소 가게',
      district: '기흥구',
    });
  });

  it('가게가 없거나 업종 id 가 없으면 null 이고, 동네를 못 찾으면 구는 빈 문자열이다', () => {
    expect(mapMerchantProfile(null, NEIGHBORHOODS)).toBeNull();
    expect(mapMerchantProfile({ ...shop, categoryId: undefined }, NEIGHBORHOODS)).toBeNull();
    expect(mapMerchantProfile({ ...shop, dongId: 999 }, NEIGHBORHOODS)?.district).toBe('');
  });
});

describe('mapOwnerAreas', () => {
  it('숫자 id 를 문자열로 바꾸고 서버 순서·거리를 그대로 둔다(거리로 다시 정렬하지 않는다)', () => {
    const areas = mapOwnerAreas({ areas: AREAS }, NEIGHBORHOODS);

    expect(
      areas.map((a) => [a.neighborhood.id, a.neighborhood.name, a.requestCount, a.distanceKm]),
    ).toEqual([
      ['22', '구성동', 29, 2],
      ['28', '보정동', 14, 2.8],
      ['23', '마북동', 9, 2.6],
    ]);
    expect(areas[0]).toMatchObject({
      neighborhood: { district: '기흥구' },
      peakVisitTime: 'weekday-evening',
      nearbySameCategoryCount: 0,
    });
  });

  it.each([
    ['null', null],
    ['알 수 없는 값', 'NIGHT'],
    ['없음', undefined],
  ])('topTimeSlot 이 %s 이면 peakVisitTime 을 비운다', (_name, topTimeSlot) => {
    const [area] = mapOwnerAreas({ areas: [{ ...AREAS[0]!, topTimeSlot }] }, NEIGHBORHOODS);

    expect(area).not.toHaveProperty('peakVisitTime');
  });

  it('빈 areas 는 빈 배열이고, 값이 숫자가 아니거나 areas 가 없으면 오류다', () => {
    expect(mapOwnerAreas({ areas: [] }, NEIGHBORHOODS)).toEqual([]);
    expect(() => mapOwnerAreas({ areas: [{ ...AREAS[0]!, distanceKm: undefined }] }, [])).toThrow(
      expect.objectContaining({ kind: 'parse' }),
    );
    expect(() => mapOwnerAreas({ areas: [{ ...AREAS[0]!, dongId: 0 }] }, [])).toThrow(
      expect.objectContaining({ code: 'INVALID_ID' }),
    );
    expect(() => mapOwnerAreas({}, [])).toThrow(expect.objectContaining({ kind: 'parse' }));
  });
});

describe('mapOwnerMapData', () => {
  const context = { shop: { lat: 37.3108, lng: 127.1398 }, category: FRUIT };

  it('기준점은 가게 좌표이고, 알약은 서버가 준 동 중심 좌표 그대로다', () => {
    const { markers, origin } = mapOwnerMapData({ areas: AREAS }, context);

    expect(origin).toMatchObject({ label: '내 가게 위치', lat: 37.3108, lng: 127.1398 });
    expect(markers.map((m) => [m.id, m.label, m.lat, m.lng])).toEqual([
      ['merchant-22-7', '과일 요청 29', 37.2979, 127.1054],
      ['merchant-28-7', '과일 요청 14', 37.3, 127.12],
      ['merchant-23-7', '과일 요청 9', 37.31, 127.14],
    ]);
    // 자리표시자용 상대좌표는 좌표 범위 안의 0~1 값이다.
    [origin.position, ...markers.map((m) => m.position)].forEach(({ x, y }) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    });
  });

  it('좌표(center)가 없는 동네는 알약을 만들지 않고 좌표를 만들어 넣지 않는다', () => {
    const { markers } = mapOwnerMapData(
      {
        areas: [
          { ...AREAS[0]!, center: null },
          { ...AREAS[1]!, center: { lat: 37.3 } },
          { ...AREAS[1]!, dongId: 29, center: { lon: 127.1 } },
          AREAS[2]!,
        ],
      },
      context,
    );

    expect(markers.map((m) => m.id)).toEqual(['merchant-23-7']);
  });

  it('areaBounds 는 넘긴 값만 담고, 가게 좌표가 없으면 오류다', () => {
    const bounds = { sw: { lat: 37.2, lng: 127 }, ne: { lat: 37.4, lng: 127.2 } };

    expect(
      mapOwnerMapData({ areas: [] }, { ...context, areaBounds: bounds }).origin.areaBounds,
    ).toEqual(bounds);
    expect(mapOwnerMapData({ areas: [] }, context).origin).not.toHaveProperty('areaBounds');
    expect(() => mapOwnerMapData({ areas: [] }, { ...context, shop: {} })).toThrow(
      expect.objectContaining({ kind: 'parse' }),
    );
  });
});

describe('mapOwnerDetail', () => {
  const context = {
    neighborhoodId: '22',
    categoryId: '7',
    categories: [FRUIT],
    neighborhoods: NEIGHBORHOODS,
  };

  it('조건(서버 label)·시간대(코드 → VisitTime, 비율 0~1 → %)·요약을 도메인으로 바꾼다', () => {
    const detail = mapOwnerDetail(DETAIL, context);

    expect(detail).toEqual({
      neighborhood: { id: '22', district: '기흥구', name: '구성동' },
      category: FRUIT,
      requestCount: 29,
      nearbySameCategoryCount: 0,
      conditions: [
        { label: '늦게까지 영업', count: 17 },
        { label: '낱개 구매', count: 10 },
      ],
      visitTimes: [
        { time: 'weekday-evening', ratio: 59 },
        { time: 'weekend', ratio: 31 },
        { time: 'weekday-day', ratio: 10 },
      ],
      summary: { text: '구성동에서는 29명이 찾아요.', by: 'AI' },
    });
  });

  it('ratioToPercent: 0~1 비율을 퍼센트(반올림)로 바꾼다', () => {
    expect(ratioToPercent(0.59)).toBe(59);
    expect(ratioToPercent(0.1)).toBe(10);
    expect(ratioToPercent(1)).toBe(100);
    expect(ratioToPercent(0)).toBe(0);
  });

  it('조건은 label 이 없으면 확인된 코드 표로, 표에도 없으면 뺀다', () => {
    const detail = mapOwnerDetail(
      {
        ...DETAIL,
        conditions: [
          { code: 'LATE_OPEN', count: 5 },
          { code: 'CHEAP', count: 3 },
          { code: 'DELIVERY', label: '서버 라벨', count: 2 },
          { label: '', count: 1 },
          { code: 'SMALL_QTY', label: '낱개 구매' },
        ],
      },
      context,
    );

    expect(detail.conditions).toEqual([
      { label: '늦게까지 영업', count: 5 },
      { label: '서버 라벨', count: 2 },
    ]);
  });

  it('알 수 없는 시간대는 빼고, 요약·조건·시간대가 null 이거나 없어도 깨지지 않는다', () => {
    const detail = mapOwnerDetail(
      {
        ...DETAIL,
        timeSlots: [
          { slot: 'NIGHT', ratio: 1 },
          { slot: 'WEEKEND', ratio: 0.5 },
        ],
        summary: null,
      },
      context,
    );
    expect(detail.visitTimes).toEqual([{ time: 'weekend', ratio: 50 }]);
    expect(detail).not.toHaveProperty('summary');

    const empty = mapOwnerDetail(
      { requestCount: 0, sameCategoryStoreCount: 0, conditions: null, timeSlots: null },
      context,
    );
    expect(empty).toMatchObject({
      conditions: [],
      visitTimes: [],
      neighborhood: { id: '22', name: '' },
    });
  });

  it('인원이 숫자가 아니거나 응답이 비어 있으면 parse 오류다', () => {
    expect(() => mapOwnerDetail({ ...DETAIL, requestCount: undefined }, context)).toThrow(
      expect.objectContaining({ kind: 'parse' }),
    );
    expect(() => mapOwnerDetail(undefined, context)).toThrow(
      expect.objectContaining({ kind: 'parse' }),
    );
  });
});

describe('createApiMerchantService', () => {
  it('프로필: GET /me 의 shop 을 프로필로 바꾼다', async () => {
    const { calls } = stubServer();

    await expect(newServices().merchantService.getProfile()).resolves.toEqual({
      shopName: '싱싱과일',
      categoryId: '7',
      categoryName: '과일·채소 가게',
      district: '기흥구',
    });
    expect(callsTo(calls, '/api/v1/me')).toHaveLength(1);
  });

  it('가게가 없으면(shop null) NoShopError 이고 /owner/demand 는 요청하지 않는다', async () => {
    const { calls } = stubServer({ me: () => jsonResponse(200, { ...ME, shop: null }) });
    const { merchantService } = newServices();

    await expect(merchantService.getProfile()).rejects.toMatchObject({ name: 'NoShopError' });
    await expect(
      merchantService.listAreaDemands({ categoryId: '7', radiusKm: 3 }),
    ).rejects.toMatchObject({ name: 'NoShopError' });
    await expect(merchantService.getMapData()).rejects.toMatchObject({ name: 'NoShopError' });
    expect(callsTo(calls, '/api/v1/owner/demand')).toHaveLength(0);
  });

  it('프로필과 지도 데이터가 동시에 요청돼도 GET /me 는 한 번이다', async () => {
    const { calls } = stubServer();
    const { merchantService } = newServices();

    await Promise.all([merchantService.getProfile(), merchantService.getMapData()]);

    expect(callsTo(calls, '/api/v1/me')).toHaveLength(1);
  });

  it.each([
    [3, '/api/v1/owner/demand?radiusKm=3'],
    [5, '/api/v1/owner/demand?radiusKm=5'],
    [null, `/api/v1/owner/demand?gu=${encodeURIComponent('기흥구')}`],
  ])('목록: 반경 %s 은 서버 파라미터로 보내고 서버 순서를 그대로 쓴다', async (radiusKm, path) => {
    const { calls } = stubServer();

    const areas = await newServices().merchantService.listAreaDemands({
      categoryId: '7',
      radiusKm,
    });

    expect(areas.map((a) => a.neighborhood.id)).toEqual(['22', '28', '23']);
    expect(callsTo(calls, '/api/v1/owner/demand').map((c) => c.path)).toEqual([path]);
  });

  it('목록: 반경 제한 없음인데 가게의 구를 모르면 오류다(반경을 임의로 정하지 않는다)', async () => {
    stubServer();

    await expect(
      newServices([]).merchantService.listAreaDemands({ categoryId: '7', radiusKm: null }),
    ).rejects.toMatchObject({ kind: 'parse' });
  });

  it('지도: 가게 구의 수요 동네를 알약으로, 가게 좌표를 기준점으로 만들고 기흥구는 근사 영역을 붙인다', async () => {
    const { calls } = stubServer();

    const { markers, origin } = await newServices().merchantService.getMapData();

    expect(markers).toHaveLength(3);
    expect(origin).toMatchObject({ lat: 37.3108, lng: 127.1398 });
    expect(origin.areaBounds).toBeDefined();
    expect(callsTo(calls, '/api/v1/owner/demand')[0]?.path).toContain('gu=');
  });

  it('상세: 숫자 id 로 요청하고 도메인으로 바꾼다', async () => {
    const { calls } = stubServer();

    const detail = await newServices().merchantService.getAreaDetail({
      areaId: '22',
      categoryId: '7',
    });

    expect(detail?.neighborhood).toEqual({ id: '22', district: '기흥구', name: '구성동' });
    expect(callsTo(calls, '/api/v1/owner/demand/')[0]?.path).toBe(
      '/api/v1/owner/demand/22?categoryId=7',
    );
  });

  it.each([
    ['동네 id 가 slug', { areaId: 'guseong', categoryId: '7' }],
    ['업종 id 가 숫자가 아님', { areaId: '22', categoryId: 'fruit-vegetable' }],
    ['동네 id 가 0', { areaId: '0', categoryId: '7' }],
  ])('상세: %s 이면 요청 없이 null(찾을 수 없음)이다', async (_name, query) => {
    const { fn } = stubServer();

    await expect(newServices().merchantService.getAreaDetail(query)).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_ERROR'],
    [403, 'FORBIDDEN'],
  ])('%s %s 는 code 를 가진 ApiError 로 던진다', async (status, code) => {
    stubServer({
      demand: () => jsonResponse(status, { code, message: '서버 원문' }),
      detail: () => jsonResponse(status, { code, message: '서버 원문' }),
    });
    const { merchantService } = newServices();

    await expect(
      merchantService.listAreaDemands({ categoryId: '7', radiusKm: 3 }),
    ).rejects.toMatchObject({ status, code });
    await expect(
      merchantService.getAreaDetail({ areaId: '9999', categoryId: '7' }),
    ).rejects.toMatchObject({ status, code });
  });

  it.each(['list', 'detail'] as const)(
    '%s: 응답을 기다리는 중에 abort 하면 요청이 취소된다',
    async (which) => {
      let fetchSignal: AbortSignal | null | undefined;
      const hang: Handler = (_c, init) =>
        new Promise<Response>((_resolve, reject) => {
          fetchSignal = init.signal;
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        });
      const { calls } = stubServer({ demand: hang, detail: hang });
      const controller = new AbortController();
      const { merchantService } = newServices();

      const pending =
        which === 'list'
          ? merchantService.listAreaDemands({ categoryId: '7', radiusKm: 3 }, controller.signal)
          : merchantService.getAreaDetail({ areaId: '22', categoryId: '7' }, controller.signal);
      const outcome = pending.then(
        () => 'resolved',
        (error: unknown) => error,
      );
      await vi.waitFor(() =>
        expect(calls.some((c) => c.path.includes('/owner/demand'))).toBe(true),
      );
      controller.abort();

      expect(await outcome).toMatchObject({ name: 'AbortError' });
      expect(fetchSignal?.aborted).toBe(true);
    },
  );

  it('요약 생성기는 상세 응답의 요약을 돌려주고(호출 없음), 요약이 없으면 parse 오류다', async () => {
    const { fn } = stubServer();
    const { areaDescriptionGenerator } = newServices();
    const base = mapOwnerDetail(DETAIL, {
      neighborhoodId: '22',
      categoryId: '7',
      categories: [FRUIT],
      neighborhoods: NEIGHBORHOODS,
    });
    const { summary, ...withoutSummary } = base;
    void summary;

    await expect(areaDescriptionGenerator.generate(base)).resolves.toBe(
      '구성동에서는 29명이 찾아요.',
    );
    await expect(areaDescriptionGenerator.generate(withoutSummary)).rejects.toMatchObject({
      kind: 'parse',
    });
    expect(fn).not.toHaveBeenCalled();
  });
});
