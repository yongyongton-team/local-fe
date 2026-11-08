import { VISIT_TIME_LABELS } from '@/shared/lib/visitTime';
import type { VisitFrequency, VisitTime } from '@/types/domain';

/** 선택지 데이터. 표기는 화면(Figma) 그대로다. */
export const VISIT_TIME_OPTIONS = [
  { value: 'weekday-day', label: VISIT_TIME_LABELS['weekday-day'] },
  { value: 'weekday-evening', label: VISIT_TIME_LABELS['weekday-evening'] },
  { value: 'weekend', label: VISIT_TIME_LABELS.weekend },
] as const satisfies readonly { value: VisitTime; label: string }[];

export const VISIT_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: '주 1번 이상' },
  { value: 'monthly', label: '한 달 2~3번' },
  { value: 'rarely', label: '가끔' },
] as const satisfies readonly { value: VisitFrequency; label: string }[];

/**
 * 업종 후보 3개의 표기. 업종 id 는 mocks/demand.ts 와 같다.
 * 동네 탐색 카드의 표기("반찬가게")와 달리 이 화면은 "반찬 가게"로 띄어 쓴다(Figma 표기).
 */
export const REQUEST_CATEGORY_CHOICES: readonly { value: string; label: string }[] = [
  { value: 'fruit-vegetable', label: '과일 / 채소 가게' },
  { value: 'side-dish', label: '반찬 가게' },
  { value: 'bakery', label: '빵집' },
];

export const REQUEST_PLACEHOLDER = '원하는 가게와 조건을 자유롭게 적어 주세요';

/** [임시] 입력 최대 길이. 디자인에서 확인되지 않아 약 200자로 정했다. */
export const REQUEST_MAX_LENGTH = 200;

/** [임시] 입력이 멈춘 뒤 문장을 정리하기까지의 지연(ms). */
export const SUMMARY_DEBOUNCE_MS = 400;
