import { beforeEach, describe, expect, it } from 'vitest';
import { jsonResponse, stubFetch } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiOrderService } from './apiOrderService';
import { createApiRequestServices } from './apiRequestServices';
import { mapOrderResult } from './mappers';
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
const CREATED = {
  order: { id: 77, offerId: 5, quantity: 2, status: 'RESERVED' },
  orderCount: 12,
  minOrders: 20,
};

beforeEach(() => localStorage.clear());

describe('mapOrderResult', () => {
  it('order·orderCount·minOrders 를 도메인으로 옮기고 id 는 문자열이다', () => {
    expect(mapOrderResult(CREATED)).toEqual({
      order: { id: '77', offerId: '5', quantity: 2, status: 'RESERVED' },
      orderCount: 12,
      minOrders: 20,
    });
  });

  it.each([
    ['본문이 없음', undefined],
    ['order 가 없음', { orderCount: 1, minOrders: 2 }],
    ['order 의 id 가 틀림', { ...CREATED, order: { ...CREATED.order, id: 0 } }],
    ['수량이 0', { ...CREATED, order: { ...CREATED.order, quantity: 0 } }],
    ['취소된 주문', { ...CREATED, order: { ...CREATED.order, status: 'CANCELLED' } }],
    ['orderCount 가 문자열', { ...CREATED, orderCount: '12' }],
    ['minOrders 가 없음', { ...CREATED, minOrders: null }],
  ])('알아볼 수 없는 응답(%s)은 parse 오류다', (_name, dto) => {
    expect(() => mapOrderResult(dto as never)).toThrow(expect.objectContaining({ kind: 'parse' }));
  });
});

describe('createApiOrderService', () => {
  it('createOrder: POST /offers/{id}/orders 를 {quantity} 본문으로 부르고 응답을 매핑한다', async () => {
    storeSession();
    const { calls } = stubFetch(() => jsonResponse(201, CREATED));

    const result = await createApiOrderService(newClient).createOrder('5', 2);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/offers/5/orders',
      authorization: 'Bearer tok',
    });
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ quantity: 2 });
    expect(result).toEqual({
      order: { id: '77', offerId: '5', quantity: 2, status: 'RESERVED' },
      orderCount: 12,
      minOrders: 20,
    });
  });

  it('cancelOrder: DELETE /orders/{id} 를 부르고 204(본문 없음)를 성공으로 본다', async () => {
    storeSession();
    const { calls } = stubFetch(() => new Response(null, { status: 204 }));

    await expect(createApiOrderService(newClient).cancelOrder('77')).resolves.toBeUndefined();

    expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ['DELETE', '/api/v1/orders/77', null],
    ]);
  });

  it('숫자가 아닌 id 는 요청 없이 INVALID_ID 다(mock id 를 서버로 보내지 않는다)', async () => {
    storeSession();
    const { fn } = stubFetch(() => jsonResponse(201, CREATED));
    const service = createApiOrderService(newClient);

    await expect(service.createOrder('mock-offer-seed-1', 1)).rejects.toMatchObject({
      code: 'INVALID_ID',
    });
    await expect(service.cancelOrder('mock-order-seed-1')).rejects.toMatchObject({
      code: 'INVALID_ID',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    ['409 ALREADY_ORDERED', 409, 'ALREADY_ORDERED'],
    ['409 OFFER_CLOSED', 409, 'OFFER_CLOSED'],
    ['400 VALIDATION_ERROR', 400, 'VALIDATION_ERROR'],
    ['404 NOT_FOUND', 404, 'NOT_FOUND'],
    ['403 FORBIDDEN', 403, 'FORBIDDEN'],
  ])('%s 오류는 상태와 코드를 그대로 던진다', async (_name, status, code) => {
    storeSession();
    stubFetch(() => jsonResponse(status, { code, message: '서버 원문' }));
    const service = createApiOrderService(newClient);

    await expect(service.createOrder('5', 1)).rejects.toMatchObject({ kind: 'http', status, code });
    await expect(service.cancelOrder('77')).rejects.toMatchObject({ kind: 'http', status, code });
  });

  it('성공 응답을 알아볼 수 없으면 parse 오류다(주문은 만들어졌을 수 있다)', async () => {
    storeSession();
    stubFetch(() => jsonResponse(201, { order: null }));

    await expect(createApiOrderService(newClient).createOrder('5', 1)).rejects.toMatchObject({
      kind: 'parse',
    });
  });

  it('데모 세션에서는 선주문·예약 취소 모두 요청 없이 DEMO_SESSION 으로 막힌다', async () => {
    storeSession(true);
    const { fn } = stubFetch(() => jsonResponse(201, CREATED));
    const service = createApiOrderService(newClient);

    await expect(service.createOrder('5', 1)).rejects.toMatchObject({ code: 'DEMO_SESSION' });
    await expect(service.cancelOrder('77')).rejects.toMatchObject({ code: 'DEMO_SESSION' });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('getResidentOffer (API)', () => {
  const OFFER = (id: number) => ({
    id,
    shopName: '가게',
    title: '제목',
    price: 1000,
    pickupAt: '2026-11-15T10:00:00+09:00',
    pickupPlace: '가게 앞',
    minOrders: 5,
    orderCount: 1,
    deadlineAt: '2026-11-14T18:00:00+09:00',
    status: 'OPEN',
    myOrder: null,
  });
  const REQUESTS = [
    {
      id: 1,
      dong: { id: 22, name: '구성동' },
      category: { id: 7, name: '과일' },
      count: 1,
      offers: [OFFER(10)],
    },
    {
      id: 2,
      dong: { id: 22, name: '구성동' },
      category: { id: 8, name: '반찬' },
      count: 1,
      offers: [OFFER(20), OFFER(21)],
    },
  ];
  const services = () =>
    createApiRequestServices({
      listCategories: async () => [],
      getClient: newClient,
    }).myRequestService;

  it('GET /me/requests 한 번으로 모든 요청의 offers 에서 id 로 찾는다', async () => {
    storeSession();
    const { calls } = stubFetch(() => jsonResponse(200, REQUESTS));

    const found = await services().getResidentOffer('21');

    expect(found?.id).toBe('21');
    expect(calls.map((c) => [c.method, c.path])).toEqual([['GET', '/api/v1/me/requests']]);
  });

  it('없는 제안(사장님이 취소해 응답에서 빠진 경우 포함)은 null 이다', async () => {
    storeSession();
    stubFetch(() => jsonResponse(200, REQUESTS));

    expect(await services().getResidentOffer('999')).toBeNull();
  });

  it('숫자가 아닌 id 는 요청 없이 null 이다', async () => {
    storeSession();
    const { fn } = stubFetch(() => jsonResponse(200, REQUESTS));

    expect(await services().getResidentOffer('abc')).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
