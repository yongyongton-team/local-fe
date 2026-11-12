/*
 * 한국 표준시(KST, +09:00) 날짜 도우미. 기기의 시간대와 상관없이 같은 결과가 나오도록
 * UTC 에 9시간을 더해 UTC 접근자로 읽고 쓴다(서버 시각도 +09:00 오프셋이 붙은 ISO 8601 이다).
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** <input type="datetime-local"> 의 값("2026-11-15T10:00")은 KST 로 읽는다. 올바르지 않으면 undefined. */
export function parseKstInput(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}:00+09:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Date → datetime-local 값(KST). 예: "2026-11-15T10:00" */
export function toKstInput(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
}

/** Date → +09:00 오프셋이 붙은 ISO 8601 문자열(초는 00). 예: "2026-11-15T10:00:00+09:00" */
export function toKstIso(date: Date): string {
  return `${toKstInput(date)}:00+09:00`;
}

function kstParts(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    weekday: WEEKDAYS[kst.getUTCDay()],
    hour24: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
  };
}

/** 예: 11/15(토) */
const monthDay = (p: ReturnType<typeof kstParts>) => `${p.month}/${p.day}(${p.weekday})`;

/** 12시간제. 예: 11/15(토) 오전 10:00 (0시는 오전 12:00, 12시는 오후 12:00) */
export function formatMonthDayMeridiem(date: Date): string {
  const p = kstParts(date);
  const meridiem = p.hour24 < 12 ? '오전' : '오후';
  const hour12 = p.hour24 % 12 === 0 ? 12 : p.hour24 % 12;
  return `${monthDay(p)} ${meridiem} ${hour12}:${pad(p.minute)}`;
}

/** 24시간제. 예: 11/14(금) 18:00 */
export function formatMonthDay24h(date: Date): string {
  const p = kstParts(date);
  return `${monthDay(p)} ${pad(p.hour24)}:${pad(p.minute)}`;
}
