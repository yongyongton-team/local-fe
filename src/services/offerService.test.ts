import { describe, expect, it } from 'vitest';
import type { NewOffer } from '@/types/domain';
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
