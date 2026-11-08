import type { AreaCondition, AreaVisitTime, VisitTime } from '@/types/domain';

/** 시간대 비율이 같을 때의 순서(화면의 선택지 순서). */
const VISIT_TIME_ORDER: readonly VisitTime[] = ['weekday-day', 'weekday-evening', 'weekend'];

/**
 * 시간대 비율을 비율 내림차순으로 정렬한다. 같으면 선택지 순서를 따른다.
 * 첫 항목이 "가장 많은 방문 시간대"이며, 탐색 화면과 상세 화면이 모두 이 결과에서 가져온다.
 * 서비스 구현과 테스트가 함께 쓰는 순수 함수다. 입력은 바꾸지 않는다.
 */
export function rankVisitTimes(ratios: Readonly<Record<VisitTime, number>>): AreaVisitTime[] {
  return VISIT_TIME_ORDER.map((time) => ({ time, ratio: ratios[time] })).sort(
    (a, b) => b.ratio - a.ratio,
  );
}

/** 조건을 인원 내림차순으로 정렬한다(같으면 입력 순서 유지). 입력은 바꾸지 않는다. */
export function rankConditions(conditions: readonly AreaCondition[]): AreaCondition[] {
  return conditions.map((c) => ({ ...c })).sort((a, b) => b.count - a.count);
}
