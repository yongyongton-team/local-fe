import { describe, expect, it } from 'vitest';
import {
  OFFER_DESCRIPTION_MAX,
  OFFER_MIN_ORDERS_MAX,
  OFFER_MIN_ORDERS_MIN,
  OFFER_PICKUP_PLACE_MAX,
  OFFER_PRICE_MAX,
  OFFER_TITLE_MAX,
  SHOP_NAME_MAX,
} from './inputLimits';

describe('입력 제한 상수(서버 명세 값)', () => {
  it('가게 이름 50, 제안 제목 50, 설명 500, 받는 곳 100, 최소 주문 1~100, 가격 int32 최댓값', () => {
    expect([
      SHOP_NAME_MAX,
      OFFER_TITLE_MAX,
      OFFER_DESCRIPTION_MAX,
      OFFER_PICKUP_PLACE_MAX,
      OFFER_MIN_ORDERS_MIN,
      OFFER_MIN_ORDERS_MAX,
      OFFER_PRICE_MAX,
    ]).toEqual([50, 50, 500, 100, 1, 100, 2_147_483_647]);
  });
});
