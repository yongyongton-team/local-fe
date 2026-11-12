import { beforeEach, describe, expect, it } from 'vitest';
import type { NewOffer } from '@/types/domain';
import { jsonResponse, stubFetch } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiOfferService } from './apiOfferService';
import { buildCreateOfferBody, mapCreateOfferResponse, mapOwnerOffers } from './mappers';
import { createTokenStore } from './tokenStore';

const NOW = 1_000_000;
const KEY = 'yyt.session';
const newClient = () =>
  createApiClient({ baseUrl: 'https://api.test', store: createTokenStore(), now: () => NOW });
const storeSession = (demo = false) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({ token: 'tok', expiresAt: NOW + 1e7, ...(demo && { demo: true }) }),
  );

// [임의] 테스트용 값. 실제 서버 응답이 아니다.
const ITEM = {
  id: 5,
  title: '테스트 꾸러미',
  status: 'OPEN',
  price: 15000,
  pickupAt: '2026-11-15T10:00:00+09:00',
  deadlineAt: '2026-11-14T18:00:00+09:00',
  minOrders: 20,
  orderCount: 3,
};

describe('mapOwnerOffers', () => {
  it('필드를 도메인으로 옮기고 서버 순서를 그대로 쓴다', () => {
    const offers = mapOwnerOffers([ITEM, { ...ITEM, id: 2, title: '둘째' }]);

    expect(offers.map((o) => o.id)).toEqual(['5', '2']);
    expect(offers[0]).toEqual({
      id: '5',
      title: '테스트 꾸러미',
      status: 'OPEN',
      price: 15000,
      pickupAt: new Date('2026-11-15T10:00:00+09:00'),
      deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
      orderCount: 3,
      minOrders: 20,
    });
  });

  it('배열이 아니라 {items} 나 {offers} 객체로 와도 받는다', () => {
    expect(mapOwnerOffers({ items: [ITEM] })).toHaveLength(1);
    expect(mapOwnerOffers({ offers: [ITEM] })).toHaveLength(1);
    expect(mapOwnerOffers([])).toEqual([]);
  });

  it('목록이 아니면 parse 오류다', () => {
    expect(() => mapOwnerOffers(undefined)).toThrow();
    expect(() => mapOwnerOffers({ foo: [] })).toThrow();
    expect(() => mapOwnerOffers('x')).toThrow();
  });

  it('price·pickupAt 이 없거나(OwnerOfferItem 에는 아직 없다) null 이어도 항목은 만들어진다', () => {
    const withoutBoth = { ...ITEM, price: undefined, pickupAt: undefined };

    const [missing, nulls] = mapOwnerOffers([
      withoutBoth,
      { ...ITEM, price: null, pickupAt: null },
    ]);

    for (const offer of [missing, nulls]) {
      expect(offer).toBeDefined();
      expect(offer).not.toHaveProperty('price');
      expect(offer).not.toHaveProperty('pickupAt');
      expect(offer).toMatchObject({ title: '테스트 꾸러미', orderCount: 3, minOrders: 20 });
    }
  });

  it('올바르지 않은 값은 비우거나 0 으로 둔다(지어내지 않는다)', () => {
    const [offer] = mapOwnerOffers([
      {
        id: 1,
        title: '  ',
        status: 'WHATEVER',
        price: -5,
        pickupAt: 'not a date',
        deadlineAt: '',
        minOrders: 'x',
        orderCount: null,
      },
    ]);

    expect(offer).toEqual({ id: '1', title: '', orderCount: 0, minOrders: 0 });
  });

  it('id 가 양의 정수가 아니거나 객체가 아닌 항목은 건너뛴다', () => {
    expect(
      mapOwnerOffers([{ ...ITEM, id: 0 }, null, 'x', { ...ITEM, id: null }, ITEM]),
    ).toHaveLength(1);
  });

  it('알려진 다섯 상태를 모두 받는다', () => {
    const statuses = ['OPEN', 'CONFIRMED', 'CLOSED', 'CANCELLED', 'DONE'];

    expect(
      mapOwnerOffers(statuses.map((status, i) => ({ ...ITEM, id: i + 1, status }))).map(
        (o) => o.status,
      ),
    ).toEqual(statuses);
  });
});

describe('buildCreateOfferBody', () => {
  const input: NewOffer = {
    neighborhoodId: '22',
    categoryId: '7',
    title: ' 테스트 꾸러미 ',
    description: ' 소포장 ',
    price: 15000,
    minOrders: 20,
    pickupAt: new Date('2026-11-15T10:00:00+09:00'),
    pickupPlace: ' 주민센터 앞 ',
    deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
  };

  it('필드를 CreateOfferRequest 로 옮긴다(숫자 id, +09:00 ISO 날짜, 공백 정리)', () => {
    expect(buildCreateOfferBody(input)).toEqual({
      dongId: 22,
      categoryId: 7,
      title: '테스트 꾸러미',
      description: '소포장',
      price: 15000,
      minOrders: 20,
      pickupAt: '2026-11-15T10:00:00+09:00',
      pickupPlace: '주민센터 앞',
      deadlineAt: '2026-11-14T18:00:00+09:00',
    });
  });

  it('설명이 비면 description 을 보내지 않는다', () => {
    expect(buildCreateOfferBody({ ...input, description: '  ' })).not.toHaveProperty('description');
    expect(buildCreateOfferBody({ ...input, description: undefined })).not.toHaveProperty(
      'description',
    );
  });

  it('동네·업종 id 가 숫자가 아니면 던진다', () => {
    expect(() => buildCreateOfferBody({ ...input, neighborhoodId: 'guseong' })).toThrow();
    expect(() => buildCreateOfferBody({ ...input, categoryId: 'fruit-vegetable' })).toThrow();
  });
});

describe('mapCreateOfferResponse', () => {
  it('notifiedResidentCount 가 0 이상의 정수일 때만 쓴다', () => {
    expect(mapCreateOfferResponse({ notifiedResidentCount: 12 })).toEqual({
      notifiedResidentCount: 12,
    });
    expect(mapCreateOfferResponse({ notifiedResidentCount: 0 })).toEqual({
      notifiedResidentCount: 0,
    });
    expect(mapCreateOfferResponse({ notifiedResidentCount: -1 })).toEqual({});
    expect(mapCreateOfferResponse({ notifiedResidentCount: 1.5 })).toEqual({});
    expect(mapCreateOfferResponse({ notifiedResidentCount: null })).toEqual({});
    expect(mapCreateOfferResponse(undefined)).toEqual({});
  });
});

describe('createApiOfferService', () => {
  beforeEach(() => localStorage.clear());

  const input: NewOffer = {
    neighborhoodId: '22',
    categoryId: '7',
    title: 't',
    price: 1000,
    minOrders: 1,
    pickupAt: new Date('2026-11-15T10:00:00+09:00'),
    pickupPlace: 'p',
    deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
  };

  it('목록은 GET /owner/offers 이고 데모 세션에서도 읽힌다', async () => {
    storeSession(true);
    const { calls } = stubFetch(() => jsonResponse(200, [ITEM]));
    const client = newClient();

    const offers = await createApiOfferService(() => client).listOwnerOffers();

    expect(offers).toHaveLength(1);
    expect(calls.map((c) => [c.method, c.path])).toEqual([['GET', '/api/v1/owner/offers']]);
  });

  it('보내기는 POST /offers 에 본문을 싣고 알림 인원을 돌려준다', async () => {
    storeSession();
    const { calls } = stubFetch(() => jsonResponse(201, { notifiedResidentCount: 7, id: 1 }));
    const client = newClient();

    const result = await createApiOfferService(() => client).createOffer(input);

    expect(result).toEqual({ notifiedResidentCount: 7 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/offers' });
    expect(JSON.parse(calls[0]?.body ?? '{}')).toMatchObject({
      dongId: 22,
      categoryId: 7,
      title: 't',
    });
  });

  it('데모 세션에서는 POST /offers 를 요청 없이 막는다', async () => {
    storeSession(true);
    const { fn } = stubFetch(() => jsonResponse(201, {}));
    const client = newClient();

    await expect(createApiOfferService(() => client).createOffer(input)).rejects.toMatchObject({
      code: 'DEMO_SESSION',
    });
    expect(fn).not.toHaveBeenCalled();
  });
});
