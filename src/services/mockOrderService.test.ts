import { describe, expect, it } from 'vitest';
import { getDb } from '@/mocks/memoryDb';
import { myRequestService, orderService } from '.';

const SEED_OPEN = 'mock-offer-seed-1'; // 모집 중, 주문 없음, orderCount 8 / 최소 20
const SEED_CONFIRMED = 'mock-offer-seed-2'; // 확정 + 예약 2개(mock-order-seed-1)
const SEED_RESERVED = 'mock-offer-seed-3'; // 모집 중 + 예약 1개(mock-order-seed-2), orderCount 4
const SEED_DONE = 'mock-offer-seed-4'; // 수령 끝 + 받아 감(mock-order-seed-3)
const SEED_CLOSED = 'mock-offer-seed-5'; // 마감, 주문 없음

const offerOf = async (id: string) => (await myRequestService.getResidentOffer(id))!;
const errorOf = async (run: () => Promise<unknown>) =>
  run().then(
    () => null,
    (e: unknown) => e,
  );

describe('선주문 목 서비스(createOrder)', () => {
  it('OPEN 제안에 주문하면 RESERVED 주문이 생기고 orderCount 가 수량만큼 늘며, 내 요청 목록의 제안에도 반영된다', async () => {
    const result = await orderService.createOrder(SEED_OPEN, 3);

    expect(result).toMatchObject({
      order: { offerId: SEED_OPEN, quantity: 3, status: 'RESERVED' },
      orderCount: 11,
      minOrders: 20,
    });
    const offer = await offerOf(SEED_OPEN);
    expect(offer.orderCount).toBe(11);
    expect(offer.myOrder).toEqual(result.order);
    // 인원이 차지 않았으니 여전히 OPEN 이다(상태는 마감 시각이 지나야 정해진다).
    expect(offer.status).toBe('OPEN');
  });

  it('인원이 최소 주문을 넘어도 마감 전에는 OPEN 이다(CONFIRMED·CLOSED 는 마감 시각이 지난 뒤에 서버가 정한다)', async () => {
    getDb().requests[0]!.offers![0]!.orderCount = 19;

    const result = await orderService.createOrder(SEED_OPEN, 10);

    expect(result.orderCount).toBe(29);
    expect(result.orderCount).toBeGreaterThanOrEqual(result.minOrders);
    expect((await offerOf(SEED_OPEN)).status).toBe('OPEN');
  });

  it('수량은 1~10 이어야 한다: 범위 밖·소수는 400 VALIDATION_ERROR 이고 아무것도 바뀌지 않는다', async () => {
    for (const quantity of [0, 11, -1, 1.5, Number.NaN]) {
      expect(await errorOf(() => orderService.createOrder(SEED_OPEN, quantity))).toMatchObject({
        kind: 'http',
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    expect((await offerOf(SEED_OPEN)).orderCount).toBe(8);
    await expect(orderService.createOrder(SEED_OPEN, 1)).resolves.toBeDefined();
    await orderService.cancelOrder((await offerOf(SEED_OPEN)).myOrder!.id);
    await expect(orderService.createOrder(SEED_OPEN, 10)).resolves.toBeDefined();
  });

  it('없는 제안은 404 NOT_FOUND 다', async () => {
    expect(await errorOf(() => orderService.createOrder('nope', 1))).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it.each([
    ['CONFIRMED', SEED_CONFIRMED],
    ['CLOSED', SEED_CLOSED],
    ['DONE', SEED_DONE],
  ])('OPEN 이 아니면(%s) 409 OFFER_CLOSED 다', async (_status, id) => {
    expect(await errorOf(() => orderService.createOrder(id, 1))).toMatchObject({
      status: 409,
      code: 'OFFER_CLOSED',
    });
  });

  it('이미 주문(취소가 아닌)이 있으면 409 ALREADY_ORDERED 이고 수량은 그대로다', async () => {
    expect(await errorOf(() => orderService.createOrder(SEED_RESERVED, 2))).toMatchObject({
      status: 409,
      code: 'ALREADY_ORDERED',
    });
    const offer = await offerOf(SEED_RESERVED);
    expect(offer.orderCount).toBe(4);
    expect(offer.myOrder?.quantity).toBe(1);
  });

  it('주문 번호는 서로 다르다', async () => {
    const a = await orderService.createOrder(SEED_OPEN, 1);

    expect(a.order.id).toMatch(/^mock-order-/);
    expect(a.order.id).not.toBe('mock-order-seed-1');
  });
});

describe('예약 취소 목 서비스(cancelOrder)', () => {
  it('OPEN 제안의 RESERVED 주문을 취소하면 myOrder 가 null 이 되고 orderCount 에서 그 수량이 빠진다', async () => {
    await expect(orderService.cancelOrder('mock-order-seed-2')).resolves.toBeUndefined();

    const offer = await offerOf(SEED_RESERVED);
    expect(offer.myOrder).toBeNull();
    expect(offer.orderCount).toBe(3);
  });

  it('이미 취소한 주문을 다시 취소해도 성공이고 수량이 두 번 빠지지 않는다', async () => {
    await orderService.cancelOrder('mock-order-seed-2');
    await expect(orderService.cancelOrder('mock-order-seed-2')).resolves.toBeUndefined();

    expect((await offerOf(SEED_RESERVED)).orderCount).toBe(3);
  });

  it('취소한 뒤 다시 주문할 수 있고, 취소했던 주문이 되살아난다(같은 id)', async () => {
    await orderService.cancelOrder('mock-order-seed-2');

    const again = await orderService.createOrder(SEED_RESERVED, 4);

    expect(again.order).toMatchObject({ id: 'mock-order-seed-2', quantity: 4, status: 'RESERVED' });
    expect(again.orderCount).toBe(7);
    expect((await offerOf(SEED_RESERVED)).myOrder?.quantity).toBe(4);
  });

  it('OPEN 이 아닌 제안(확정)의 예약은 취소할 수 없다: 409 OFFER_CLOSED', async () => {
    expect(await errorOf(() => orderService.cancelOrder('mock-order-seed-1'))).toMatchObject({
      status: 409,
      code: 'OFFER_CLOSED',
    });
    expect((await offerOf(SEED_CONFIRMED)).myOrder?.status).toBe('RESERVED');
  });

  it('받아 간(PICKED_UP) 주문은 취소할 수 없다: 409 OFFER_CLOSED', async () => {
    expect(await errorOf(() => orderService.cancelOrder('mock-order-seed-3'))).toMatchObject({
      status: 409,
      code: 'OFFER_CLOSED',
    });
  });

  it('없는 주문은 404 NOT_FOUND 다', async () => {
    expect(await errorOf(() => orderService.cancelOrder('nope'))).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('getResidentOffer (내 요청 목록에서 찾기)', () => {
  it('모든 요청의 offers 에서 id 로 찾고, 없으면 null 이다', async () => {
    expect((await myRequestService.getResidentOffer(SEED_CLOSED))?.status).toBe('CLOSED');
    expect(await myRequestService.getResidentOffer('nope')).toBeNull();
  });
});
