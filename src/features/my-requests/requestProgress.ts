import { VISIT_FREQUENCY_OPTIONS, VISIT_TIME_OPTIONS } from '@/features/store-request/constants';
import type { MerchantResponse, MyRequest, VisitFrequency, VisitTime } from '@/types/domain';
import { REQUEST_GOAL_COUNT } from './constants';

export interface Progress {
  /** 막대 채움 비율(0~1). 기준 인원을 넘어도 1 이다. */
  ratio: number;
  /** 기준 인원에 도달했는지. true 이면 "결정 필요"를 표시한다. (임시 규칙) */
  reached: boolean;
  /** progressbar 의 aria-valuenow. min~max 범위 안으로 맞춘 값 */
  valueNow: number;
  /** 사람이 읽는 값. 예: 12명이 모였어요 (기준 30명) */
  valueText: string;
  /** 화면 문구. 예: 12명이 모였어요! */
  label: string;
}

/** 인원과 기준 인원으로 진행 상황을 계산한다. */
export function getProgress(count: number, goal: number = REQUEST_GOAL_COUNT): Progress {
  const safeCount = Math.max(0, count);
  return {
    ratio: goal > 0 ? Math.min(1, safeCount / goal) : 1,
    reached: safeCount >= goal,
    valueNow: Math.min(goal, safeCount),
    valueText: `${safeCount}명이 모였어요 (기준 ${goal}명)`,
    label: `${safeCount}명이 모였어요!`,
  };
}

/** 요약 카드 설명. 예: 구성동에서 과일·채소 가게를 원하는 주민이 30명이 됐어요. */
export function describeRequestSummary({
  neighborhood,
  category,
  requestCount,
}: MyRequest): string {
  return `${neighborhood.name}에서 ${category.objectPhrase} 원하는 주민이 ${requestCount}명이 됐어요.`;
}

/**
 * 요청 카드의 메타 줄. "{동네} · {시간대} · {빈도}"
 * 시간대가 여럿이면 ", "로 잇고, 선택하지 않은 항목은 뺀다. 입력한 원문 문장은 쓰지 않는다.
 */
export function buildMetaLine(
  neighborhoodName: string,
  visitTimes: readonly VisitTime[],
  visitFrequency?: VisitFrequency,
): string {
  // 선택 순서가 아니라 선택지 순서(평일 낮 → 평일 저녁 → 주말)로 보여준다.
  const times = VISIT_TIME_OPTIONS.filter((option) => visitTimes.includes(option.value))
    .map((option) => option.label)
    .join(', ');
  const frequency = VISIT_FREQUENCY_OPTIONS.find(
    (option) => option.value === visitFrequency,
  )?.label;
  return [neighborhoodName, times, frequency].filter(Boolean).join(' · ');
}

/** 사장님 응답 문구. "업체(지역): 메시지" */
export function formatMerchantResponse({
  merchantName,
  areaName,
  message,
}: MerchantResponse): string {
  return `${merchantName}(${areaName}): ${message}`;
}
