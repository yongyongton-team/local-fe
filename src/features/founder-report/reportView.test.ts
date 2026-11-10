import { describe, expect, it } from 'vitest';
import type { AreaReport } from '@/types/domain';
import { buildReportStats, buildReportTitle } from './reportView';

const report = (demand: Partial<AreaReport['demand']> = {}): AreaReport => ({
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
  demand: {
    neighborhoodId: 'guseong',
    categoryId: 'fruit-vegetable',
    requestCount: 29,
    nearbySameCategoryCount: 0,
    nearestHypermarketKm: 2.4,
    ...demand,
  },
  peakVisitTime: 'weekday-evening',
});

describe('buildReportTitle', () => {
  it('"{동네} / {업종 표기}" 로 만든다', () => {
    expect(buildReportTitle(report())).toBe('구성동 / 과일 가게');
  });
});

describe('buildReportStats', () => {
  it('카드 4개의 라벨과 값을 데이터에서 만든다', () => {
    expect(buildReportStats(report()).map((s) => [s.label, s.value])).toEqual([
      ['주민 요청', '29명'],
      ['걸어서 15분 안 같은 업종', '0곳'],
      ['가장 가까운 대형마트', '2.4km'],
      ['많이 원하는 시간', '평일 저녁'],
    ]);
  });

  it('대형마트 거리가 없으면 "정보 없음"이다', () => {
    expect(buildReportStats(report({ nearestHypermarketKm: undefined }))[2]?.value).toBe(
      '정보 없음',
    );
  });
});
