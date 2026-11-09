import { beforeEach, describe, expect, it } from 'vitest';
import type { NewStoreRequest } from '@/types/domain';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiMerchantService } from './apiMerchantService';
import { buildCreateRequestBody } from './mappers';
import { createTokenStore } from './tokenStore';

describe('요청 생성 본문: 빈 시간대·빈도에 기본값을 채우지 않는다', () => {
  const base: NewStoreRequest = {
    neighborhoodId: '22',
    categoryId: '7',
    detail: '과일',
    conditions: [],
    visitTimes: [],
  };

  it('시간대가 비면 빈 배열, 빈도가 없으면 필드 자체가 없다(값을 지어내지 않는다)', () => {
    const body = buildCreateRequestBody(base, new Map());

    expect(body.timeSlots).toEqual([]);
    expect(body).not.toHaveProperty('frequency');
  });
});

describe('사장님 반경 칩의 쿼리와 가게의 동이 없을 때(shop.dong 이 null)', () => {
  beforeEach(() => localStorage.clear());

  const newServices = (shop: unknown) => {
    const calls: StubCall[] = [];
    stubFetch((call) => {
      calls.push(call);
      if (call.path === '/api/v1/auth/guest')
        return jsonResponse(200, { accessToken: 't', expiresIn: 3600 });
      if (call.path === '/api/v1/me')
        return jsonResponse(200, { id: 1, role: 'OWNER', dong: null, shop });
      if (call.path.startsWith('/api/v1/owner/demand'))
        return jsonResponse(200, { radiusKm: 3, areas: [] });
      return jsonResponse(404, { code: 'NOT_FOUND' });
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      store: createTokenStore(),
      now: () => 1_000_000,
    });
    const services = createApiMerchantService({
      listCategories: async () => [],
      listNeighborhoods: async () => [{ id: '23', district: '기흥구', name: '마북동' }],
      getClient: () => client,
    });
    return { ...services, calls };
  };
  const shopWith = (dong: unknown) => ({
    shopName: '가게',
    category: { id: 7, name: '과일·채소 가게' },
    dong,
    lat: 37.3,
    lon: 127.1,
  });
  const demandPaths = (calls: StubCall[]) =>
    calls.filter((c) => c.path.startsWith('/api/v1/owner/demand')).map((c) => c.path);

  it('3km 와 5km 는 radiusKm, 기흥구 전체는 gu(가게의 동 id 로 동네 목록에서 찾은 구)를 보낸다', async () => {
    const { merchantService, calls } = newServices(shopWith({ id: 23, name: '마북동' }));

    await merchantService.listAreaDemands({ categoryId: '7', radiusKm: 3 });
    await merchantService.listAreaDemands({ categoryId: '7', radiusKm: 5 });
    await merchantService.listAreaDemands({ categoryId: '7', radiusKm: null });

    expect(demandPaths(calls)).toEqual([
      '/api/v1/owner/demand?radiusKm=3',
      '/api/v1/owner/demand?radiusKm=5',
      `/api/v1/owner/demand?gu=${encodeURIComponent('기흥구')}`,
    ]);
  });

  it.each([
    ['shop.dong 이 null', null],
    ['shop.dong 에 id 가 없음', { name: '마북동' }],
    ['동네 목록에 없는 동', { id: 999, name: '모름동' }],
  ])(
    '%s 이면 구를 모른다: 3km·5km 는 그대로, 기흥구 전체는 오류, 지도는 gu 없이(서버 기본 반경) 요청한다',
    async (_name, dong) => {
      const { merchantService, calls } = newServices(shopWith(dong));

      await expect(merchantService.getProfile()).resolves.toMatchObject({ district: '' });
      await merchantService.listAreaDemands({ categoryId: '7', radiusKm: 3 });
      await expect(
        merchantService.listAreaDemands({ categoryId: '7', radiusKm: null }),
      ).rejects.toMatchObject({ kind: 'parse' });
      const { origin } = await merchantService.getMapData();

      expect(demandPaths(calls)).toEqual([
        '/api/v1/owner/demand?radiusKm=3',
        '/api/v1/owner/demand',
      ]);
      expect(origin).not.toHaveProperty('areaBounds');
    },
  );
});
