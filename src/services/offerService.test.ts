import { describe, expect, it } from 'vitest';
import type { NewOffer } from '@/types/domain';
import { getDb } from '@/mocks/memoryDb';
import type { OfferStatus, OwnerOffer } from '@/types/domain';
import { offerService } from '.';

const input = (overrides: Partial<NewOffer> = {}): NewOffer => ({
  neighborhoodId: 'guseong',
  categoryId: 'fruit-vegetable',
  title: '  새 제안  ',
  price: 12000,
  minOrders: 5,
  pickupAt: new Date('2026-11-20T10:00:00+09:00'),
  pickupPlace: '주민센터 앞',
  deadlineAt: new Date('2026-11-19T18:00:00+09:00'),
  ...overrides,
});

describe('사장님 제안 목 서비스', () => {
  it('처음에는 실서버 시드처럼 모집 중 1건과 확정 1건이 있고 가격·받는 날이 있다', async () => {
    const offers = await offerService.listOwnerOffers();

    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      title: '제철 과일 꾸러미',
      status: 'OPEN',
      price: 15000,
      orderCount: 0,
      minOrders: 20,
    });
    expect(offers[0]?.pickupAt).toBeInstanceOf(Date);
    expect(offers[1]).toMatchObject({ title: '주말 채소 박스', status: 'CONFIRMED' });
    expect(offers[1]?.price).toBeGreaterThanOrEqual(0);
    expect(offers[1]?.pickupAt).toBeInstanceOf(Date);
  });

  it('확정 건은 예약이 최소 주문 이상이고 마감 시각이 받는 날보다 앞서며 이미 지났다', async () => {
    const confirmed = (await offerService.listOwnerOffers()).find((o) => o.status === 'CONFIRMED')!;

    expect(confirmed.orderCount).toBeGreaterThanOrEqual(confirmed.minOrders);
    expect(confirmed.deadlineAt!.getTime()).toBeLessThan(confirmed.pickupAt!.getTime());
    expect(confirmed.deadlineAt!.getTime()).toBeLessThan(
      new Date('2026-11-14T00:00:00+09:00').getTime(),
    );
  });

  it('보낸 제안은 목록 맨 앞에 모집 중으로 들어가고 알림 인원은 그 동네·업종의 요청 인원이다', async () => {
    const result = await offerService.createOffer(input());

    expect(result).toEqual({ notifiedResidentCount: 29 });
    const offers = await offerService.listOwnerOffers();
    expect(offers.map((o) => o.title)).toEqual(['새 제안', '제철 과일 꾸러미', '주말 채소 박스']);
    expect(offers[0]).toMatchObject({ status: 'OPEN', price: 12000, minOrders: 5, orderCount: 0 });
  });

  it('요청이 없는 동네·업종이면 알림 인원은 0 명이다', async () => {
    await expect(
      offerService.createOffer(input({ neighborhoodId: 'mabuk', categoryId: 'bakery' })),
    ).resolves.toEqual({ notifiedResidentCount: 0 });
  });

  it('돌려준 목록을 바꿔도 목 원본은 바뀌지 않는다', async () => {
    const [first] = await offerService.listOwnerOffers();
    first!.title = '바뀜';
    first!.pickupAt?.setFullYear(1999);

    const [again] = await offerService.listOwnerOffers();
    expect(again?.title).toBe('제철 과일 꾸러미');
    expect(again?.pickupAt?.getFullYear()).toBe(2026);
  });
});

const addOffer = (status: OfferStatus, overrides: Partial<OwnerOffer> = {}): OwnerOffer => {
  const offer: OwnerOffer = {
    id: `test-${status}`,
    title: `테스트 ${status}`,
    status,
    orderCount: 5,
    minOrders: 20,
    ...overrides,
  };
  getDb().offers.push(offer);
  return offer;
};

describe('사장님 제안 목 서비스: 단건과 상세 정보', () => {
  it('getOwnerOffer 는 id 로 찾고 없으면 null 이다', async () => {
    expect((await offerService.getOwnerOffer('offer-seed-1'))?.title).toBe('제철 과일 꾸러미');
    expect(await offerService.getOwnerOffer('nope')).toBeNull();
  });

  it('시드와 보낸 제안에는 받는 곳과 동네 이름이 있다', async () => {
    expect(await offerService.getOwnerOffer('offer-seed-2')).toMatchObject({
      pickupPlace: '보정동 행정복지센터 앞',
      dongName: '보정동',
    });
    await offerService.createOffer(input());
    const [created] = await offerService.listOwnerOffers();
    expect(created).toMatchObject({ pickupPlace: '주민센터 앞', dongName: '구성동' });
  });
});

describe('사장님 제안 목 서비스: 판매 끝(done)', () => {
  it('CONFIRMED 는 DONE 이 되고 응답과 이후 조회가 같다(주문 수는 그대로)', async () => {
    const done = await offerService.completeOffer('offer-seed-2');

    expect(done).toMatchObject({ id: 'offer-seed-2', status: 'DONE', orderCount: 22 });
    expect((await offerService.getOwnerOffer('offer-seed-2'))?.status).toBe('DONE');
  });

  it.each(['OPEN', 'CLOSED', 'CANCELLED', 'DONE'] as const)(
    '%s 는 OFFER_CLOSED(409) 이고 상태를 바꾸지 않는다',
    async (status) => {
      const offer =
        status === 'OPEN' ? (await offerService.getOwnerOffer('offer-seed-1'))! : addOffer(status);

      await expect(offerService.completeOffer(offer.id)).rejects.toMatchObject({
        kind: 'http',
        status: 409,
        code: 'OFFER_CLOSED',
      });
      expect((await offerService.getOwnerOffer(offer.id))?.status).toBe(status);
    },
  );

  it('없는 제안은 NOT_FOUND(404)다', async () => {
    await expect(offerService.completeOffer('nope')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('두 번 누르면 두 번째는 OFFER_CLOSED 다', async () => {
    await offerService.completeOffer('offer-seed-2');

    await expect(offerService.completeOffer('offer-seed-2')).rejects.toMatchObject({
      code: 'OFFER_CLOSED',
    });
  });
});

describe('사장님 제안 목 서비스: 제안 취소(cancel)', () => {
  it('OPEN 은 CANCELLED 가 되고 예약(orderCount)이 0 이 된다', async () => {
    const offer = addOffer('OPEN', { orderCount: 7 });

    const cancelled = await offerService.cancelOffer(offer.id);

    expect(cancelled).toMatchObject({ status: 'CANCELLED', orderCount: 0 });
    expect(await offerService.getOwnerOffer(offer.id)).toMatchObject({
      status: 'CANCELLED',
      orderCount: 0,
    });
  });

  it('CONFIRMED 도 취소되고 예약이 0 이 된다', async () => {
    expect(await offerService.cancelOffer('offer-seed-2')).toMatchObject({
      status: 'CANCELLED',
      orderCount: 0,
      minOrders: 20,
    });
  });

  it.each(['CLOSED', 'CANCELLED', 'DONE'] as const)(
    '%s 는 OFFER_CLOSED(409) 이고 바꾸지 않는다',
    async (status) => {
      const offer = addOffer(status, { orderCount: 4 });

      await expect(offerService.cancelOffer(offer.id)).rejects.toMatchObject({
        status: 409,
        code: 'OFFER_CLOSED',
      });
      expect(await offerService.getOwnerOffer(offer.id)).toMatchObject({ status, orderCount: 4 });
    },
  );

  it('없는 제안은 NOT_FOUND(404)다', async () => {
    await expect(offerService.cancelOffer('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('돌려준 제안을 바꿔도 목 원본은 바뀌지 않는다', async () => {
    const done = await offerService.completeOffer('offer-seed-2');
    done.title = '바뀜';
    done.pickupAt?.setFullYear(1999);

    const again = await offerService.getOwnerOffer('offer-seed-2');
    expect(again?.title).toBe('주말 채소 박스');
    expect(again?.pickupAt?.getFullYear()).toBe(2026);
  });
});
