import type { OwnerOffer } from '@/types/domain';

/*
 * 사장님 제안 목록의 개발용 목 데이터. 실제 제안이 아니다. "[임의]" 는 디자인의 예시에서 가져온 개발용 값이다.
 * 실서버(시연 시드)처럼 모집 중(OPEN) 1건과 확정(CONFIRMED) 1건이다.
 */

export const mockSeedOffers: readonly OwnerOffer[] = [
  // [임의] 모집 중. Figma 45:584 의 예시(제철 과일 꾸러미, 15,000원, 11/15(일) 오전 10:00 수령, 11/14(토) 18:00 마감, 0/20명).
  // 시안은 11/15 를 토요일로 적었지만 2026-11-15 는 일요일이다(코드는 실제 요일을 계산한다).
  {
    id: 'offer-seed-1',
    title: '제철 과일 꾸러미',
    status: 'OPEN',
    price: 15000,
    pickupAt: new Date('2026-11-15T10:00:00+09:00'),
    pickupPlace: '구성동 주민센터 앞',
    dongName: '구성동',
    deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
    orderCount: 0,
    minOrders: 20,
  },
  // [임의] 확정: 예약이 최소 주문 수 이상이고 마감 시각이 지났다(Figma 66:472 의 예시 제목·예약 22명·최소 20명).
  {
    id: 'offer-seed-2',
    title: '주말 채소 박스',
    status: 'CONFIRMED',
    price: 12000,
    pickupAt: new Date('2026-11-14T10:00:00+09:00'),
    pickupPlace: '보정동 행정복지센터 앞',
    dongName: '보정동',
    deadlineAt: new Date('2026-11-12T18:00:00+09:00'),
    orderCount: 22,
    minOrders: 20,
  },
];
