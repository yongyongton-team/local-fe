import { beforeEach, describe, expect, it } from 'vitest';
import type { NewOffer } from '@/types/domain';
import { jsonResponse, stubFetch } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiOfferService } from './apiOfferService';
import {
  buildCreateOfferBody,
  mapCreateOfferResponse,
  mapOwnerOffer,
  mapOwnerOfferResponse,
  mapOwnerOffers,
} from './mappers';
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

  it('데모 세션에서도 POST /offers 를 막지 않고 서버로 보낸다', async () => {
    storeSession(true);
    const { calls } = stubFetch(() => jsonResponse(201, { notifiedResidentCount: 3 }));
    const client = newClient();

    await expect(createApiOfferService(() => client).createOffer(input)).resolves.toEqual({
      notifiedResidentCount: 3,
    });
    expect(calls.map((c) => [c.method, c.path])).toEqual([['POST', '/api/v1/offers']]);
  });

  it('데모 세션에서 서버가 거절하면(403) 그 오류를 그대로 던진다(DEMO_SESSION 이 아니다)', async () => {
    storeSession(true);
    stubFetch(() => jsonResponse(403, { code: 'FORBIDDEN', message: '서버 원문' }));
    const client = newClient();

    await expect(createApiOfferService(() => client).createOffer(input)).rejects.toMatchObject({
      kind: 'http',
      status: 403,
      code: 'FORBIDDEN',
    });
  });
});

// 판매 끝·제안 취소 응답(갱신된 OwnerOfferItem). [임의] 테스트용 값이다.
const FULL = {
  ...ITEM,
  description: '설명은 읽지 않는다',
  pickupPlace: ' 구성동 주민센터 앞 ',
  dong: { id: 22, name: ' 구성동 ' },
};

describe('mapOwnerOffer', () => {
  it('받는 곳(공백 정리)과 동네 이름(dong.name)을 읽고 설명은 읽지 않는다', () => {
    const offer = mapOwnerOffer(FULL);

    expect(offer).toMatchObject({ id: '5', pickupPlace: '구성동 주민센터 앞', dongName: '구성동' });
    expect(offer).not.toHaveProperty('description');
  });

  it('받는 곳·동네가 없거나 비어 있으면 그 필드만 없다', () => {
    for (const patch of [
      { pickupPlace: null, dong: null },
      { pickupPlace: '   ', dong: { id: 1, name: '' } },
      { pickupPlace: undefined, dong: undefined },
    ]) {
      const offer = mapOwnerOffer({ ...FULL, ...patch });

      expect(offer).toBeDefined();
      expect(offer).not.toHaveProperty('pickupPlace');
      expect(offer).not.toHaveProperty('dongName');
    }
  });

  it('id 가 올바르지 않으면 undefined 이고, 목록은 그 항목을 건너뛴다', () => {
    expect(mapOwnerOffer({ ...FULL, id: 0 })).toBeUndefined();
    expect(mapOwnerOffer(null)).toBeUndefined();
    expect(mapOwnerOffers([{ ...FULL, id: null }, FULL])).toHaveLength(1);
  });
});

describe('mapOwnerOfferResponse (done·cancel 응답)', () => {
  it('갱신된 제안으로 옮긴다(상태 DONE·CANCELLED, 취소하면 orderCount 0)', () => {
    expect(mapOwnerOfferResponse({ ...FULL, status: 'DONE' })).toMatchObject({
      id: '5',
      status: 'DONE',
      orderCount: 3,
    });
    expect(mapOwnerOfferResponse({ ...FULL, status: 'CANCELLED', orderCount: 0 })).toMatchObject({
      status: 'CANCELLED',
      orderCount: 0,
    });
  });

  it('알아볼 수 없는 응답은 parse 오류다(처리됐는지 알 수 없다)', () => {
    expect(() => mapOwnerOfferResponse(undefined)).toThrow();
    expect(() => mapOwnerOfferResponse({ status: 'DONE' })).toThrow();
  });
});

describe('createApiOfferService: 상세·판매 끝·제안 취소', () => {
  beforeEach(() => localStorage.clear());

  it('getOwnerOffer 는 GET /owner/offers 의 배열에서 id 로 찾는다(단건 엔드포인트 없음)', async () => {
    storeSession();
    const { calls } = stubFetch(() => jsonResponse(200, [FULL, { ...FULL, id: 9, title: '둘째' }]));
    const client = newClient();
    const service = createApiOfferService(() => client);

    expect((await service.getOwnerOffer('9'))?.title).toBe('둘째');
    expect(await service.getOwnerOffer('77')).toBeNull();
    expect(calls.map((c) => [c.method, c.path])).toEqual([
      ['GET', '/api/v1/owner/offers'],
      ['GET', '/api/v1/owner/offers'],
    ]);
  });

  it('getOwnerOffer 는 숫자가 아닌 id 면 요청 없이 null 이다', async () => {
    storeSession();
    const { fn } = stubFetch(() => jsonResponse(200, []));
    const client = newClient();

    expect(await createApiOfferService(() => client).getOwnerOffer('offer-seed-1')).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('completeOffer 는 POST /offers/{id}/done 을 본문 없이 보내고 갱신된 제안을 돌려준다', async () => {
    storeSession();
    const { calls } = stubFetch(() => jsonResponse(200, { ...FULL, status: 'DONE' }));
    const client = newClient();

    const done = await createApiOfferService(() => client).completeOffer('5');

    expect(done).toMatchObject({ id: '5', status: 'DONE' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/offers/5/done', body: null });
  });

  it('cancelOffer 는 POST /offers/{id}/cancel 을 본문 없이 보내고 예약 0 의 제안을 돌려준다', async () => {
    storeSession();
    const { calls } = stubFetch(() =>
      jsonResponse(200, { ...FULL, status: 'CANCELLED', orderCount: 0 }),
    );
    const client = newClient();

    const cancelled = await createApiOfferService(() => client).cancelOffer('5');

    expect(cancelled).toMatchObject({ status: 'CANCELLED', orderCount: 0 });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/offers/5/cancel', body: null });
  });

  it('숫자가 아닌 id 는 요청 없이 INVALID_ID 오류다', async () => {
    storeSession();
    const { fn } = stubFetch(() => jsonResponse(200, FULL));
    const client = newClient();
    const service = createApiOfferService(() => client);

    await expect(service.completeOffer('offer-seed-1')).rejects.toMatchObject({
      code: 'INVALID_ID',
    });
    await expect(service.cancelOffer('x')).rejects.toMatchObject({ code: 'INVALID_ID' });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'OFFER_CLOSED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
  ] as const)('%s %s 는 서버 message 없이 ApiError 코드로 던진다', async (status, code) => {
    storeSession();
    stubFetch(() => jsonResponse(status, { code, message: '서버 원문' }));
    const client = newClient();
    const service = createApiOfferService(() => client);

    for (const run of [() => service.completeOffer('5'), () => service.cancelOffer('5')]) {
      const error = await run().then(
        () => null,
        (e: unknown) => e as Error,
      );
      expect(error).toMatchObject({ kind: 'http', status, code });
      expect(error?.message).not.toContain('서버 원문');
    }
  });

  it('응답이 올바르지 않으면 parse 오류다', async () => {
    storeSession();
    stubFetch(() => jsonResponse(200, {}));
    const client = newClient();

    await expect(createApiOfferService(() => client).completeOffer('5')).rejects.toMatchObject({
      kind: 'parse',
    });
  });

  it('데모 세션에서도 done·cancel 을 막지 않고 서버로 보낸다', async () => {
    storeSession(true);
    const { calls } = stubFetch(() => jsonResponse(200, FULL));
    const client = newClient();
    const service = createApiOfferService(() => client);

    await service.completeOffer('5');
    await service.cancelOffer('5');

    expect(calls.map((c) => [c.method, c.path])).toEqual([
      ['POST', '/api/v1/offers/5/done'],
      ['POST', '/api/v1/offers/5/cancel'],
    ]);
  });
});
