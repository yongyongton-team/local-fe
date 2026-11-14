import { describe, expect, it } from 'vitest';
import { getDb } from '@/mocks/memoryDb';
import { myRequestService, requestSubmitter } from '.';

describe('내 요청 목 서비스의 제안 데이터', () => {
  it('시드 요청에는 모집 중(주문 없음·예약 있음)·확정·수령 끝(받아 감)·마감 제안이 모두 있다', async () => {
    const [item] = await myRequestService.listMyRequests();
    const offers = item!.offers;
    const byId = (id: string) => offers.find((o) => o.id === id);

    expect(offers.map((o) => o.status)).toEqual(['OPEN', 'CONFIRMED', 'OPEN', 'DONE', 'CLOSED']);
    // 모집 중 + 내 주문 없음
    expect(byId('mock-offer-seed-1')).toMatchObject({ status: 'OPEN', myOrder: null });
    // 모집 중 + 예약(RESERVED)
    expect(byId('mock-offer-seed-3')).toMatchObject({
      status: 'OPEN',
      myOrder: { status: 'RESERVED', offerId: 'mock-offer-seed-3' },
    });
    // 확정 + 예약
    expect(byId('mock-offer-seed-2')).toMatchObject({
      status: 'CONFIRMED',
      myOrder: { status: 'RESERVED', quantity: 2 },
    });
    // 받아 간 주문
    expect(byId('mock-offer-seed-4')).toMatchObject({
      status: 'DONE',
      myOrder: { status: 'PICKED_UP' },
    });
    expect(byId('mock-offer-seed-5')).toMatchObject({ status: 'CLOSED', myOrder: null });
    expect(new Set(offers.map((o) => o.id)).size).toBe(offers.length);
  });

  it('카드의 사장님 응답 한 줄은 서버 순서의 첫 OPEN·CONFIRMED 제안에서 만든다(예전과 같은 값)', async () => {
    const [item] = await myRequestService.listMyRequests();

    expect(item?.response).toEqual({
      merchantName: '맛나반찬',
      pickupAt: new Date('2026-11-14T10:00:00+09:00'),
      pickupPlace: '구성동 주민센터 앞',
    });
    expect(item?.response?.merchantName).toBe(item?.offers[0]?.shopName);
  });

  it('새로 보낸 요청에는 제안이 없다(offers 는 빈 배열이고 응답도 없다)', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: 'fruit-vegetable',
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });

    const [newest] = await myRequestService.listMyRequests();

    expect(newest?.category.id).toBe('fruit-vegetable');
    expect(newest?.offers).toEqual([]);
    expect(newest?.response).toBeUndefined();
  });

  it('돌려준 제안을 바꿔도 메모리 DB 의 시드는 바뀌지 않는다(복사본)', async () => {
    const [first] = await myRequestService.listMyRequests();
    first!.offers[0]!.title = '바뀜';
    first!.offers[1]!.myOrder!.quantity = 99;
    first!.offers[0]!.pickupAt.setFullYear(1999);

    const stored = getDb().requests[0]!.offers!;
    expect(stored[0]?.title).not.toBe('바뀜');
    expect(stored[1]?.myOrder?.quantity).toBe(2);
    expect(stored[0]?.pickupAt.getFullYear()).toBe(2026);
  });

  it('요청을 지워도 다른 요청의 제안은 그대로다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: 'fruit-vegetable',
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });
    const [newest] = await myRequestService.listMyRequests();

    await myRequestService.deleteRequest(newest!.request.id);

    const [seed] = await myRequestService.listMyRequests();
    expect(seed?.offers).toHaveLength(5);
  });
});
