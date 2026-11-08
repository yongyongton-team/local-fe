import type { VisitTime } from '@/types/domain';

/**
 * 반경 칩. value 는 칩의 값, label 은 칩과 부제에 쓰는 문구, km 는 거리 필터 값(null 이면 제한 없음).
 * "기흥구 전체"는 거리 제한이 없다. (추정)
 */
export const RADIUS_OPTIONS = [
  { value: '3km', label: '3km 안', km: 3 },
  { value: '5km', label: '5km 안', km: 5 },
  { value: 'all', label: '기흥구 전체', km: null },
] as const;

export type RadiusValue = (typeof RADIUS_OPTIONS)[number]['value'];

/** 기본으로 선택되는 반경 */
export const DEFAULT_RADIUS: RadiusValue = '3km';

/** 시간대별 "많아요" 문구. 조사가 시간대마다 달라 코드로 계산하지 않고 완성된 문구를 둔다. */
export const PEAK_TIME_PHRASES: Record<VisitTime, string> = {
  'weekday-day': '평일 낮이 많아요',
  'weekday-evening': '평일 저녁이 많아요',
  weekend: '주말이 많아요',
};
