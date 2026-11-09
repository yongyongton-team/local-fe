import type { VisitFrequency, VisitTime } from '@/types/domain';

/*
 * 요청 작성에서 서버와 주고받는 enum 값. 명세(OpenAPI)에 적힌 값이고 의미는 이름 그대로다.
 * 서버 enum 이 바뀌면 이 표만 고친다. 표에 없는 서버 값은 도메인으로 바꾸지 않고 건너뛴다.
 */
export const TIME_SLOT_CODES: Readonly<Record<VisitTime, string>> = {
  'weekday-day': 'WEEKDAY_DAY',
  'weekday-evening': 'WEEKDAY_EVENING',
  weekend: 'WEEKEND',
};

export const FREQUENCY_CODES: Readonly<Record<VisitFrequency, string>> = {
  weekly: 'WEEKLY_PLUS',
  monthly: 'MONTHLY_2_3',
  rarely: 'SOMETIMES',
};

const invert = <K extends string>(table: Readonly<Record<K, string>>) =>
  new Map((Object.entries(table) as [K, string][]).map(([domain, server]) => [server, domain]));

const VISIT_TIME_BY_CODE = invert(TIME_SLOT_CODES);
const VISIT_FREQUENCY_BY_CODE = invert(FREQUENCY_CODES);

/** 서버 시간대 → 도메인. 모르는 값이면 undefined */
export const toVisitTime = (code: unknown): VisitTime | undefined =>
  typeof code === 'string' ? VISIT_TIME_BY_CODE.get(code) : undefined;

/** 서버 빈도 → 도메인. 모르는 값이면 undefined */
export const toVisitFrequency = (code: unknown): VisitFrequency | undefined =>
  typeof code === 'string' ? VISIT_FREQUENCY_BY_CODE.get(code) : undefined;
