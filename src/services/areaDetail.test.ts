import { describe, expect, it } from 'vitest';
import { rankConditions, rankVisitTimes } from './areaDetail';

describe('rankVisitTimes', () => {
  it('비율 내림차순으로 정렬한다', () => {
    expect(
      rankVisitTimes({ 'weekday-day': 10, 'weekday-evening': 60, weekend: 30 }).map((v) => v.time),
    ).toEqual(['weekday-evening', 'weekend', 'weekday-day']);
  });

  it('비율이 같으면 선택지 순서(평일 낮, 평일 저녁, 주말)를 따른다', () => {
    expect(
      rankVisitTimes({ 'weekday-day': 30, 'weekday-evening': 40, weekend: 30 }).map((v) => v.time),
    ).toEqual(['weekday-evening', 'weekday-day', 'weekend']);
  });

  it('입력을 바꾸지 않고 비율을 그대로 담는다', () => {
    const input = { 'weekday-day': 10, 'weekday-evening': 60, weekend: 30 } as const;
    const ranked = rankVisitTimes(input);

    expect(ranked[0]).toEqual({ time: 'weekday-evening', ratio: 60 });
    expect(input).toEqual({ 'weekday-day': 10, 'weekday-evening': 60, weekend: 30 });
  });
});

describe('rankConditions', () => {
  it('인원 내림차순으로 정렬하고 같으면 입력 순서를 유지한다', () => {
    const input = [
      { label: '배달', count: 3 },
      { label: '늦게까지 영업', count: 8 },
      { label: '낱개 구매', count: 3 },
    ];

    expect(rankConditions(input).map((c) => c.label)).toEqual([
      '늦게까지 영업',
      '배달',
      '낱개 구매',
    ]);
    expect(input.map((c) => c.label)).toEqual(['배달', '늦게까지 영업', '낱개 구매']);
  });
});
