import { VISIT_TIME_LABELS } from '@/shared/lib/visitTime';
import type { AreaDetail } from '@/types/domain';

/** 막대 한 줄. fill 은 0~1 이며 막대 길이의 유일한 근거다. */
export interface BarRowData {
  key: string;
  label: string;
  /** 값 표기. 예: 17명, 60% */
  valueText: string;
  fill: number;
}

/** 0~1 범위로 자른다. 숫자가 아니면 0. */
export function clampFill(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 상세 제목. 예: 구성동 / 과일 가게 */
export function buildDetailTitle(detail: AreaDetail): string {
  return `${detail.neighborhood.name} / ${detail.category.titleLabel}`;
}

/** 조건 막대: 길이 = 그 조건 인원 ÷ 요청 인원. 인원이 0명이면 모두 빈 막대다. */
export function buildConditionRows(detail: AreaDetail): BarRowData[] {
  return detail.conditions.map((condition) => ({
    key: condition.label,
    label: condition.label,
    valueText: `${condition.count}명`,
    fill: detail.requestCount > 0 ? clampFill(condition.count / detail.requestCount) : 0,
  }));
}

/** 시간대 막대: 길이 = 비율(%) ÷ 100. 입력이 비율 내림차순이라 같은 순서로 나온다. */
export function buildVisitTimeRows(detail: AreaDetail): BarRowData[] {
  return detail.visitTimes.map(({ time, ratio }) => ({
    key: time,
    label: VISIT_TIME_LABELS[time],
    valueText: `${ratio}%`,
    fill: clampFill(ratio / 100),
  }));
}
