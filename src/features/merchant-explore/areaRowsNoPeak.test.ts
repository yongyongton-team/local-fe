import { describe, expect, it } from 'vitest';
import type { AreaDemand } from '@/types/domain';
import { describeAreaRow } from './areaRows';

const area: AreaDemand = {
  neighborhood: { id: '22', district: '기흥구', name: '구성동' },
  requestCount: 29,
  distanceKm: 2,
  nearbySameCategoryCount: 0,
};

describe('describeAreaRow: 많이 원하는 시간대가 없을 때', () => {
  it('시간대 문구만 빼고 나머지는 그대로다(undefined 문구가 나오지 않는다)', () => {
    const text = describeAreaRow(area);

    expect(text.title).toBe('구성동 · 요청 29명');
    expect(text.detail).toBe('2.0km · 근처 같은 업종 0곳');
    expect(text.accessibleName).toBe('구성동, 요청 29명, 2.0km, 근처 같은 업종 0곳');
  });

  it('시간대가 있으면 기존 문구 그대로다', () => {
    const text = describeAreaRow({ ...area, peakVisitTime: 'weekday-evening' });

    expect(text.detail).toBe('2.0km · 평일 저녁이 많아요 · 근처 같은 업종 0곳');
  });
});
