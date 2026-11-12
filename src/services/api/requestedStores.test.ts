import { beforeEach, describe, expect, it } from 'vitest';
import type { StoreCategory } from '@/types/domain';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiDemandService } from './apiDemandService';
import type { DongMapDto } from './dto';
import { mapRequestedStores } from './mappers';
import { createTokenStore } from './tokenStore';
import { mockDemandService } from '../mockDemandService';

const category = (id: string, name: string): StoreCategory => ({
  id,
  name,
  cardTitle: `${name} 카드`,
  requestLabel: name,
  missingLabel: name,
  objectPhrase: name,
  titleLabel: name,
});
const CATEGORIES = [category('7', '과일'), category('9', '반찬'), category('10', '빵')];

// [임의] 테스트용 값. 실제 서버 응답이 아니다.
const MAP = {
  dong: { id: 22, center: { lat: 37.3, lon: 127.1 } },
  stores: [],
  requests: [
    { categoryId: 7, name: '과일', count: 29 },
    { categoryId: 10, name: '빵', count: 6 },
    { categoryId: 9, name: '반찬', count: 12 },
  ],
  gaps: [{ categoryId: 7, name: '과일' }],
};

describe('mapRequestedStores', () => {
  it('gaps 와 업종 id 가 겹치는 요청은 빼고, 요청 수 많은 순으로 서버 인원 그대로 만든다', () => {
    const stores = mapRequestedStores(MAP, CATEGORIES);

    expect(stores.map((s) => [s.category.id, s.requestCount])).toEqual([
      ['9', 12],
      ['10', 6],
    ]);
    expect(stores[0]?.category.cardTitle).toBe('반찬 카드');
  });

  it('gaps 가 없거나 비어 있으면 요청 전부가 목록이다', () => {
    expect(mapRequestedStores({ requests: MAP.requests }, CATEGORIES)).toHaveLength(3);
    expect(mapRequestedStores({ ...MAP, gaps: [] }, CATEGORIES)).toHaveLength(3);
  });

  it('요청이 모두 gaps 와 겹치거나 requests 가 없으면 빈 배열이다', () => {
    expect(
      mapRequestedStores(
        { requests: [{ categoryId: 7, name: '과일', count: 3 }], gaps: [{ categoryId: 7 }] },
        CATEGORIES,
      ),
    ).toEqual([]);
    expect(mapRequestedStores({ stores: [] }, CATEGORIES)).toEqual([]);
    expect(mapRequestedStores({ requests: [] }, CATEGORIES)).toEqual([]);
  });

  it('요청 수가 같으면 서버 순서를 지킨다', () => {
    const stores = mapRequestedStores(
      {
        requests: [
          { categoryId: 10, name: '빵', count: 5 },
          { categoryId: 9, name: '반찬', count: 5 },
        ],
      },
      CATEGORIES,
    );

    expect(stores.map((s) => s.category.id)).toEqual(['10', '9']);
  });

  it('올바르지 않은 항목(업종 id·인원)은 건너뛰고, 업종 목록에 없으면 항목의 이름을 쓴다', () => {
    const stores = mapRequestedStores(
      {
        requests: [
          { categoryId: 0, name: 'x', count: 3 },
          { categoryId: 9, name: '반찬', count: 'many' },
          { categoryId: 9, name: '반찬', count: -1 },
          null,
          { categoryId: 99, name: '꽃집', count: 2 },
        ],
        gaps: [{ categoryId: 'bad' }, null],
      } as unknown as DongMapDto,
      CATEGORIES,
    );

    expect(stores).toHaveLength(1);
    expect(stores[0]?.category).toMatchObject({ id: '99', name: '꽃집', cardTitle: '꽃집' });
  });

  it('응답이 객체가 아니면 parse 오류다', () => {
    expect(() => mapRequestedStores(undefined, CATEGORIES)).toThrow();
  });
});

describe('getMapOverview(API)', () => {
  beforeEach(() => localStorage.clear());

  const newService = () => {
    const calls: StubCall[] = [];
    stubFetch((call) => {
      calls.push(call);
      if (call.path === '/api/v1/auth/guest')
        return jsonResponse(200, { accessToken: 't', expiresIn: 3600 });
      if (call.path === '/api/v1/categories')
        return jsonResponse(
          200,
          CATEGORIES.map((c) => ({ id: Number(c.id), code: `C${c.id}`, name: c.name })),
        );
      if (call.path === '/api/v1/dongs/22/map') return jsonResponse(200, MAP);
      return jsonResponse(404, { code: 'NOT_FOUND' });
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      store: createTokenStore(),
      now: () => 1_000_000,
    });
    return { service: createApiDemandService(mockDemandService, () => client), calls };
  };

  it('같은 지도 응답 한 번으로 마커와 요청한 가게를 함께 만든다', async () => {
    const { service, calls } = newService();

    const overview = await service.getMapOverview('22');

    expect(calls.filter((c) => c.path === '/api/v1/dongs/22/map')).toHaveLength(1);
    expect(overview.markers.map((m) => m.kind)).toEqual([
      'request',
      'request',
      'request',
      'missing',
    ]);
    expect(overview.requestedStores.map((s) => s.category.id)).toEqual(['9', '10']);
  });

  it('listMapMarkers 도 같은 요청 하나로 마커만 돌려준다', async () => {
    const { service, calls } = newService();

    const markers = await service.listMapMarkers('22');

    expect(markers).toHaveLength(4);
    expect(calls.filter((c) => c.path === '/api/v1/dongs/22/map')).toHaveLength(1);
  });

  it('숫자가 아닌 동네 id 는 요청 없이 INVALID_ID 오류다', async () => {
    const { service, calls } = newService();

    await expect(service.getMapOverview('guseong')).rejects.toMatchObject({ code: 'INVALID_ID' });
    expect(calls).toHaveLength(0);
  });
});

describe('getMapOverview(mock)', () => {
  it('구성동: gaps 는 과일뿐이라 반찬(12)·빵(6)이 요청 많은 순으로 나온다', async () => {
    const { requestedStores } = await mockDemandService.getMapOverview('guseong');

    expect(requestedStores.map((s) => [s.category.id, s.requestCount])).toEqual([
      ['side-dish', 12],
      ['bakery', 6],
    ]);
  });

  it('보정동은 gaps 가 없어 과일 14 가 나오고, 마북동은 요청이 모두 gap 이라 비어 있다', async () => {
    expect(
      (await mockDemandService.getMapOverview('bojeong')).requestedStores.map((s) => [
        s.category.id,
        s.requestCount,
      ]),
    ).toEqual([['fruit-vegetable', 14]]);
    expect((await mockDemandService.getMapOverview('mabuk')).requestedStores).toEqual([]);
    expect((await mockDemandService.getMapOverview('unknown')).requestedStores).toEqual([]);
  });

  it('마커는 listMapMarkers 와 같다', async () => {
    const overview = await mockDemandService.getMapOverview('guseong');

    expect(overview.markers).toEqual(await mockDemandService.listMapMarkers('guseong'));
  });
});
