import { describe, expect, it } from 'vitest';
import { meService } from '@/services';

/** mock 모드의 내 가게: 서버 없이 메모리 상태만 바꾼다. */
describe('mockMeService 의 내 가게', () => {
  it('처음에는 가게가 없다(GET /me 의 shop 이 null)', async () => {
    expect((await meService.getMe()).shop).toBeNull();
  });

  it('saveShop 은 메모리 상태를 바꾸고 getMe 가 그 가게를 돌려준다(업종 이름은 업종 목록에서)', async () => {
    await meService.saveShop({
      shopName: '싱싱과일',
      categoryId: 'fruit-vegetable',
      lat: 37.3,
      lng: 127.1,
    });

    expect((await meService.getMe()).shop).toEqual({
      shopName: '싱싱과일',
      categoryName: '과일·채소',
      dongName: '',
      lat: 37.3,
      lng: 127.1,
    });
  });

  it('다시 저장하면 고쳐진다(수정)', async () => {
    await meService.saveShop({
      shopName: '싱싱과일',
      categoryId: 'fruit-vegetable',
      lat: 37.3,
      lng: 127.1,
    });
    await meService.saveShop({
      shopName: '맛나반찬',
      categoryId: 'side-dish',
      lat: 37.31,
      lng: 127.12,
    });

    expect((await meService.getMe()).shop).toMatchObject({
      shopName: '맛나반찬',
      categoryName: '반찬',
      lat: 37.31,
      lng: 127.12,
    });
  });

  it('getMe 가 돌려준 가게를 바꿔도 메모리 상태는 바뀌지 않는다(복사본)', async () => {
    await meService.saveShop({
      shopName: '싱싱과일',
      categoryId: 'fruit-vegetable',
      lat: 37.3,
      lng: 127.1,
    });
    const me = await meService.getMe();
    if (me.shop) me.shop.shopName = '바뀜';

    expect((await meService.getMe()).shop?.shopName).toBe('싱싱과일');
  });
});
