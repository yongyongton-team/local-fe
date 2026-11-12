import { beforeEach, describe, expect, it } from 'vitest';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiMeService } from './apiMeService';
import { mapMe } from './mappers';
import { createTokenStore } from './tokenStore';

/** PUT /me/shop 의 API 구현. 자동 테스트는 실서버를 치지 않는다(fetch 스텁). */
const NOW = 1_000_000;
const KEY = 'yyt.session';
const newService = () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    store: createTokenStore(),
    now: () => NOW,
  });
  return createApiMeService(() => client);
};
const GUEST = '/api/v1/auth/guest';
const SHOP = '/api/v1/me/shop';
const INPUT = { shopName: '싱싱과일', categoryId: '7', lat: 37.2985, lng: 127.1085 };

function stubServer(shop: (call: StubCall) => Response = () => jsonResponse(200, { ok: true })) {
  return stubFetch((call) => {
    if (call.path === GUEST) return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600 });
    if (call.path === SHOP) return shop(call);
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const shopCalls = (calls: StubCall[]) => calls.filter((c) => c.path === SHOP);

beforeEach(() => localStorage.clear());

describe('createApiMeService.saveShop', () => {
  it('PUT /me/shop 에 {shopName, categoryId(숫자), lat, lon} 을 토큰과 함께 보낸다(lng 는 서버 이름 lon 으로)', async () => {
    const { calls } = stubServer();

    await expect(newService().saveShop(INPUT)).resolves.toBeUndefined();

    const [call] = shopCalls(calls);
    expect(shopCalls(calls)).toHaveLength(1);
    expect(call).toMatchObject({
      method: 'PUT',
      authorization: 'Bearer tok-1',
      contentType: 'application/json',
    });
    expect(JSON.parse(call!.body ?? '{}')).toEqual({
      shopName: '싱싱과일',
      categoryId: 7,
      lat: 37.2985,
      lon: 127.1085,
    });
  });

  it('동네는 보내지 않는다(서버가 좌표로 찾는다)', async () => {
    const { calls } = stubServer();

    await newService().saveShop(INPUT);

    const body = JSON.parse(shopCalls(calls)[0]!.body ?? '{}') as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['categoryId', 'lat', 'lon', 'shopName']);
  });

  it('응답 본문은 쓰지 않는다(204·빈 본문·모양이 달라도 성공)', async () => {
    stubServer(() => new Response(null, { status: 204 }));
    await expect(newService().saveShop(INPUT)).resolves.toBeUndefined();
    stubServer(() => jsonResponse(200, { 알수없는: '모양' }));
    await expect(newService().saveShop(INPUT)).resolves.toBeUndefined();
  });

  it('데모 세션이면 서버에 보내지 않고 DEMO_SESSION 으로 던진다', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ token: 'tok-demo', expiresAt: NOW + 1e7, demo: true }),
    );
    const { fn } = stubServer();

    await expect(newService().saveShop(INPUT)).rejects.toMatchObject({ code: 'DEMO_SESSION' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('업종 id 가 숫자가 아니면 요청 없이 INVALID_ID 오류다', async () => {
    const { fn } = stubServer();

    await expect(
      newService().saveShop({ ...INPUT, categoryId: 'fruit-vegetable' }),
    ).rejects.toMatchObject({
      code: 'INVALID_ID',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    [Number.NaN, 127.1],
    [37.3, Number.POSITIVE_INFINITY],
  ])('좌표가 올바르지 않으면(%s, %s) 요청 없이 INVALID_LOCATION 오류다', async (lat, lng) => {
    const { fn } = stubServer();

    await expect(newService().saveShop({ ...INPUT, lat, lng })).rejects.toMatchObject({
      code: 'INVALID_LOCATION',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'VALIDATION_ERROR'],
    [403, 'FORBIDDEN'],
    [500, 'INTERNAL'],
  ])('%s 는 status·code 를 가진 ApiError 로 던진다', async (status, code) => {
    stubServer(() => jsonResponse(status, { code, message: '서버 원문' }));

    await expect(newService().saveShop(INPUT)).rejects.toMatchObject({
      kind: 'http',
      status,
      code,
    });
  });

  it('서버에 닿지 못하면 network 오류로 던진다', async () => {
    stubServer(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(newService().saveShop(INPUT)).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('GET /me 의 shop → 도메인(내 가게 수정 모드가 미리 채우는 값)', () => {
  it('shopName·업종(id·이름)·동·좌표(lon → lng)를 옮긴다', () => {
    const me = mapMe({
      id: 3,
      role: 'OWNER',
      shop: {
        shopName: '싱싱과일',
        category: { id: 7, name: '과일·채소 가게' },
        dong: { id: 22, name: '구성동' },
        lat: 37.2985,
        lon: 127.1085,
      },
    });

    expect(me.shop).toEqual({
      shopName: '싱싱과일',
      categoryId: 7,
      categoryName: '과일·채소 가게',
      dongId: 22,
      dongName: '구성동',
      lat: 37.2985,
      lng: 127.1085,
    });
  });

  it('좌표나 업종이 없으면 그 필드만 비고, 가게 이름이 없으면 shop 은 null 이다', () => {
    expect(mapMe({ id: 3, shop: { shopName: '가게' } }).shop).toEqual({
      shopName: '가게',
      categoryName: '',
      dongName: '',
    });
    expect(mapMe({ id: 3, shop: { shopName: '' } }).shop).toBeNull();
    expect(mapMe({ id: 3, shop: null }).shop).toBeNull();
  });
});
