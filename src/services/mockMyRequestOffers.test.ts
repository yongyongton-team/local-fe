import { describe, expect, it } from 'vitest';
import { getDb } from '@/mocks/memoryDb';
import { myRequestService, requestSubmitter } from '.';

describe('내 요청 목 서비스의 제안 데이터', () => {
  it('시드 요청에는 모집 중·확정 제안이 있고, 주문이 없는 제안과 내 주문(RESERVED)이 있는 제안이 모두 있다', async () => {
    const [item] = await myRequestService.listMyRequests();
    const offers = item!.offers;

    expect(offers.map((o) => o.status)).toEqual(['OPEN', 'CONFIRMED']);
    expect(offers.find((o) => o.status === 'OPEN')?.myOrder).toBeNull();
    const confirmed = offers.find((o) => o.status === 'CONFIRMED');
    expect(confirmed?.myOrder).toMatchObject({
      status: 'RESERVED',
      quantity: 2,
      offerId: confirmed?.id,
    });
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
    expect(seed?.offers).toHaveLength(2);
  });
});
