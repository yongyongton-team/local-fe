import type { AreaDemand } from '@/types/domain';
import { PEAK_TIME_PHRASES } from './constants';

export interface AreaRowText {
  /** 굵은 제목. 예: 구성동 · 요청 29명 */
  title: string;
  /** 작은 둘째 줄. 예: 1.8km · 평일 저녁이 많아요 · 근처 같은 업종 0곳 */
  detail: string;
  /** 링크의 접근 가능한 이름. 한 문장으로 읽힌다. */
  accessibleName: string;
}

/** 거리 표기: 소수점 한 자리(예: 2.4km). 필터는 반올림하지 않은 같은 값(distanceKm)으로 비교한다. */
export const formatDistanceKm = (km: number): string => `${km.toFixed(1)}km`;

/** 동네 행의 문구. 수치는 모두 데이터에서 만든다. 주민이 입력한 원문 문장은 쓰지 않는다. */
export function describeAreaRow(area: AreaDemand): AreaRowText {
  const name = area.neighborhood.name;
  // 서버가 많이 원하는 시간대를 주지 않으면(없을 수 있다) 그 부분을 뺀다.
  const phrase = area.peakVisitTime === undefined ? null : PEAK_TIME_PHRASES[area.peakVisitTime];
  const parts = [
    formatDistanceKm(area.distanceKm),
    phrase,
    `근처 같은 업종 ${area.nearbySameCategoryCount}곳`,
  ].filter((part): part is string => part !== null);
  return {
    title: `${name} · 요청 ${area.requestCount}명`,
    detail: parts.join(' · '),
    accessibleName: `${name}, 요청 ${area.requestCount}명, ${parts.join(', ')}`,
  };
}

/** 섹션 부제. 예: 요청 많은 순 · 3km 안 */
export function buildSubtitle(radiusLabel: string): string {
  return `요청 많은 순 · ${radiusLabel}`;
}

/** 반경이 바뀔 때 보조 기술에 알리는 요약. 예: 3km 안 동네 3곳 표시 중 */
export function buildRadiusSummary(radiusLabel: string, count: number): string {
  return `${radiusLabel} 동네 ${count}곳 표시 중`;
}
