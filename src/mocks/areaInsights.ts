import type { AreaCondition, VisitTime } from '@/types/domain';

/*
 * 동네별 통계의 개발용 목 데이터. 실제 통계가 아니다.
 * 사장님 동네 상세와 창업자 동네 리포트가 같은 분포를 읽도록 서비스에서 따로 두지 않고 이 모듈에 한 곳에만 둔다.
 * (서비스끼리 서로 import 하지 않고 데이터 모듈만 공유하므로 순환 참조가 생기지 않는다.)
 */

/**
 * [임의] 동네 상세의 조건별 인원과 방문 시간대 비율. 구성동 값은 Figma 의 예시(17/11/7, 60/30/10)이고,
 * 보정동·마북동 값은 디자인(2:2159, 2:2227)의 수치를 따른 개발용 값이다.
 * 정적 목이라 주민이 요청을 보내도 바뀌지 않는다(요청 인원·근처 업종 수만 수요 데이터에서 읽는다).
 * 시간대 비율(%)의 합은 100 이다. 이 분포가 "가장 많은 방문 시간대"의 유일한 출처다.
 */
export const mockAreaInsights: readonly {
  neighborhoodId: string;
  conditions: readonly AreaCondition[];
  visitTimeRatios: Readonly<Record<VisitTime, number>>;
}[] = [
  {
    neighborhoodId: 'guseong',
    conditions: [
      { label: '늦게까지 영업', count: 17 },
      { label: '낱개 구매', count: 11 },
      { label: '배달', count: 7 },
    ],
    visitTimeRatios: { 'weekday-evening': 60, weekend: 30, 'weekday-day': 10 },
  },
  {
    neighborhoodId: 'bojeong',
    conditions: [
      { label: '늦게까지 영업', count: 8 },
      { label: '낱개 구매', count: 5 },
      { label: '배달', count: 3 },
    ],
    visitTimeRatios: { weekend: 60, 'weekday-evening': 30, 'weekday-day': 10 },
  },
  {
    neighborhoodId: 'mabuk',
    conditions: [
      { label: '늦게까지 영업', count: 5 },
      { label: '낱개 구매', count: 3 },
      { label: '배달', count: 2 },
    ],
    visitTimeRatios: { 'weekday-day': 60, 'weekday-evening': 30, weekend: 10 },
  },
];
