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

const KOREAN_WEEKDAYS = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
] as const;

/** 한국 표준시(UTC+9). 서머타임이 없어 고정 오프셋으로 계산한다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 시각을 한국 시간(Asia/Seoul)으로 "토요일 오전 10시" 형태로 만든다. 분이 0 이 아니면 "오전 10시 30분".
 * 기기의 시간대와 상관없이 같은 결과가 나오도록 UTC 에 9시간을 더해 UTC 접근자로 읽는다.
 * 12시간제: 0시는 "오전 12시", 12시는 "오후 12시".
 */
export function formatKoreanPickupTime(at: Date): string {
  const kst = new Date(at.getTime() + KST_OFFSET_MS);
  const hour24 = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  const meridiem = hour24 < 12 ? '오전' : '오후';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minutePart = minute === 0 ? '' : ` ${minute}분`;
  return `${KOREAN_WEEKDAYS[kst.getUTCDay()]} ${meridiem} ${hour12}시${minutePart}`;
}

/**
 * 사장님 응답 문구. "가게: 토요일 오전 10시, 구성동 주민센터 앞에서 방문 판매해요"
 * 수령 시각이나 장소가 없으면 그 부분만 뺀다(없는 값을 지어내지 않는다).
 * 둘 다 없으면 "가게: 방문 판매해요".
 */
export function formatMerchantResponse({
  merchantName,
  pickupAt,
  pickupPlace,
}: MerchantResponse): string {
  const when =
    pickupAt && !Number.isNaN(pickupAt.getTime()) ? formatKoreanPickupTime(pickupAt) : '';
  const where = pickupPlace ? `${pickupPlace}에서` : '';
  const detail = [when, where].filter(Boolean).join(', ');
  return `${merchantName}: ${detail ? `${detail} ` : ''}방문 판매해요`;
}
