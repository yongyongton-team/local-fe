import { describe, expect, it } from 'vitest';
import type { AreaDetail } from '@/types/domain';
import {
  buildConditionRows,
  buildDetailTitle,
  buildVisitTimeRows,
  clampFill,
} from './areaDetailView';

const detail = (overrides: Partial<AreaDetail> = {}): AreaDetail => ({
  neighborhood: { id: 'guseong', district: '기흥구', name: '구성동' },
  category: {
    id: 'fruit-vegetable',
    name: '과일·채소',
    cardTitle: '과일 / 채소 가게',
    requestLabel: '과일',
    missingLabel: '과일 / 채소',
    objectPhrase: '과일·채소 가게를',
    titleLabel: '과일 가게',
  },
  requestCount: 29,
  nearbySameCategoryCount: 0,
  conditions: [
    { label: '늦게까지 영업', count: 17 },
    { label: '낱개 구매', count: 11 },
    { label: '배달', count: 7 },
  ],
  visitTimes: [
    { time: 'weekday-evening', ratio: 60 },
    { time: 'weekend', ratio: 30 },
    { time: 'weekday-day', ratio: 10 },
  ],
  ...overrides,
});

describe('buildDetailTitle', () => {
  it('"{동네} / {업종 표기}" 로 만든다', () => {
    expect(buildDetailTitle(detail())).toBe('구성동 / 과일 가게');
  });
});

describe('buildConditionRows', () => {
  it('막대 길이는 조건 인원 ÷ 요청 인원이다', () => {
    const rows = buildConditionRows(detail());

    expect(rows.map((r) => [r.label, r.valueText])).toEqual([
      ['늦게까지 영업', '17명'],
      ['낱개 구매', '11명'],
      ['배달', '7명'],
    ]);
    expect(rows[0]?.fill).toBeCloseTo(17 / 29);
    expect(rows[1]?.fill).toBeCloseTo(11 / 29);
    expect(rows[2]?.fill).toBeCloseTo(7 / 29);
  });

  it('요청 인원이 바뀌면 같은 조건 인원도 막대 길이가 바뀐다', () => {
    expect(buildConditionRows(detail({ requestCount: 30 }))[0]?.fill).toBeCloseTo(17 / 30);
  });

  it('요청 인원이 0이면 모두 빈 막대이고, 1을 넘는 비율은 1로 자른다', () => {
    expect(buildConditionRows(detail({ requestCount: 0 })).map((r) => r.fill)).toEqual([0, 0, 0]);
    expect(buildConditionRows(detail({ requestCount: 10 }))[0]?.fill).toBe(1);
  });
});

describe('buildVisitTimeRows', () => {
  it('막대 길이는 비율 ÷ 100 이고 입력 순서(비율 내림차순)를 유지한다', () => {
    const rows = buildVisitTimeRows(detail());

    expect(rows.map((r) => [r.label, r.valueText, r.fill])).toEqual([
      ['평일 저녁', '60%', 0.6],
      ['주말', '30%', 0.3],
      ['평일 낮', '10%', 0.1],
    ]);
  });
});

describe('clampFill', () => {
  it('0~1 로 자르고 숫자가 아니면 0 이다', () => {
    expect(clampFill(-1)).toBe(0);
    expect(clampFill(2)).toBe(1);
    expect(clampFill(0.5)).toBe(0.5);
    expect(clampFill(Number.NaN)).toBe(0);
  });
});
