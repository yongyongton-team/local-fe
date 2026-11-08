import type { VisitTime } from '@/types/domain';

/** 방문 시간대의 화면 표기. 칩 선택지, 사장님 동네 상세의 행·문장이 함께 쓴다. */
export const VISIT_TIME_LABELS: Record<VisitTime, string> = {
  'weekday-day': '평일 낮',
  'weekday-evening': '평일 저녁',
  weekend: '주말',
};
