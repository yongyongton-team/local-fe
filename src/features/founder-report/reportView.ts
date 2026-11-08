import { VISIT_TIME_LABELS } from '@/shared/lib/visitTime';
import type { StatItem } from '@/shared/ui/StatCards';
import type { AreaReport } from '@/types/domain';
import { NO_HYPERMARKET_VALUE } from './constants';

/** 리포트 제목. 예: 구성동 / 과일 가게 (업종 표기는 업종 데이터의 titleLabel) */
export function buildReportTitle({ neighborhood, category }: AreaReport): string {
  return `${neighborhood.name} / ${category.titleLabel}`;
}

/** 요약 카드 4개(2×2). 수치는 모두 데이터에서 만든다. 대형마트 거리가 없으면 "정보 없음"이다. */
export function buildReportStats({ demand, peakVisitTime }: AreaReport): StatItem[] {
  return [
    { label: '주민 요청', value: `${demand.requestCount}명` },
    { label: '걸어서 15분 안 같은 업종', value: `${demand.nearbySameCategoryCount}곳` },
    {
      label: '가장 가까운 대형마트',
      value:
        demand.nearestHypermarketKm === undefined
          ? NO_HYPERMARKET_VALUE
          : `${demand.nearestHypermarketKm}km`,
    },
    { label: '많이 원하는 시간', value: VISIT_TIME_LABELS[peakVisitTime] },
  ];
}
