import type { OwnerOffer } from '@/types/domain';

/*
 * 사장님 제안 목록의 개발용 목 데이터. 실제 제안이 아니다. "[임의]" 는 디자인의 예시에서 가져온 개발용 값이다.
 */

/** [임의] 처음부터 있는 제안 하나. Figma 45:584 의 예시(제철 과일 꾸러미, 15,000원, 11/15(토) 오전 10:00 수령, 11/14(금) 18:00 마감, 0/20명). */
export const mockSeedOffers: readonly OwnerOffer[] = [
  {
    id: 'offer-seed-1',
    title: '제철 과일 꾸러미',
    status: 'OPEN',
    price: 15000,
    pickupAt: new Date('2026-11-15T10:00:00+09:00'),
    deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
    orderCount: 0,
    minOrders: 20,
  },
];
