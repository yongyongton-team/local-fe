import { describe, expect, it } from 'vitest';
import {
  formatMonthDay24h,
  formatMonthDayMeridiem,
  parseKstInput,
  toKstInput,
  toKstIso,
} from './kstDate';

describe('parseKstInput / toKstInput / toKstIso', () => {
  it('datetime-local 값을 KST 로 읽고 기기 시간대와 상관없이 같은 순간이다', () => {
    expect(parseKstInput('2026-11-15T10:00')?.toISOString()).toBe('2026-11-15T01:00:00.000Z');
  });

  it('올바르지 않은 값은 undefined 다', () => {
    expect(parseKstInput('')).toBeUndefined();
    expect(parseKstInput('2026-11-15')).toBeUndefined();
    expect(parseKstInput('2026-13-45T10:00')).toBeUndefined();
  });

  it('Date → 입력 값, +09:00 ISO 문자열로 되돌린다', () => {
    const date = new Date('2026-11-15T01:00:00Z');

    expect(toKstInput(date)).toBe('2026-11-15T10:00');
    expect(toKstIso(date)).toBe('2026-11-15T10:00:00+09:00');
  });
});

describe('표시 형식', () => {
  it('12시간제: 11/15(일) 오전 10:00, 자정은 오전 12:00, 정오는 오후 12:00, 18시는 오후 6:00', () => {
    expect(formatMonthDayMeridiem(new Date('2026-11-15T10:00:00+09:00'))).toBe(
      '11/15(일) 오전 10:00',
    );
    expect(formatMonthDayMeridiem(new Date('2026-11-15T00:05:00+09:00'))).toBe(
      '11/15(일) 오전 12:05',
    );
    expect(formatMonthDayMeridiem(new Date('2026-11-15T12:00:00+09:00'))).toBe(
      '11/15(일) 오후 12:00',
    );
    expect(formatMonthDayMeridiem(new Date('2026-11-15T18:30:00+09:00'))).toBe(
      '11/15(일) 오후 6:30',
    );
  });

  it('24시간제: 11/14(토) 18:00, 0시는 00:00', () => {
    expect(formatMonthDay24h(new Date('2026-11-14T18:00:00+09:00'))).toBe('11/14(토) 18:00');
    expect(formatMonthDay24h(new Date('2026-11-16T00:00:00+09:00'))).toBe('11/16(월) 00:00');
  });

  it('UTC 로 전날 저녁이어도 한국 날짜로 읽는다', () => {
    expect(formatMonthDay24h(new Date('2026-11-13T15:30:00Z'))).toBe('11/14(토) 00:30');
  });
});
