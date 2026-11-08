import { describe, expect, it } from 'vitest';
import type { AreaDemand } from '@/types/domain';
import { buildRadiusSummary, buildSubtitle, describeAreaRow } from './areaRows';
import { RADIUS_OPTIONS } from './constants';

const area = (overrides: Partial<AreaDemand> = {}): AreaDemand => ({
  neighborhood: { id: 'guseong', district: '기흥구', name: '구성동' },
  requestCount: 29,
  distanceKm: 1.8,
  peakVisitTime: 'weekday-evening',
  nearbySameCategoryCount: 0,
  ...overrides,
});

describe('describeAreaRow', () => {
  it('제목과 둘째 줄을 데이터에서 만든다', () => {
    const text = describeAreaRow(area());

    expect(text.title).toBe('구성동 · 요청 29명');
    expect(text.detail).toBe('1.8km · 평일 저녁이 많아요 · 근처 같은 업종 0곳');
  });

  it('시간대마다 완성된 문구를 쓴다(조사를 코드로 계산하지 않는다)', () => {
    expect(describeAreaRow(area({ peakVisitTime: 'weekend' })).detail).toContain('주말이 많아요');
    expect(describeAreaRow(area({ peakVisitTime: 'weekday-day' })).detail).toContain(
      '평일 낮이 많아요',
    );
  });

  it('링크 이름은 한 문장으로 읽힌다', () => {
    expect(describeAreaRow(area()).accessibleName).toBe(
      '구성동, 요청 29명, 1.8km, 평일 저녁이 많아요, 근처 같은 업종 0곳',
    );
  });

  it('근처 같은 업종 수와 인원이 바뀌면 문구도 바뀐다', () => {
    const text = describeAreaRow(
      area({ requestCount: 14, nearbySameCategoryCount: 1, distanceKm: 2.6 }),
    );

    expect(text.title).toBe('구성동 · 요청 14명');
    expect(text.detail).toBe('2.6km · 평일 저녁이 많아요 · 근처 같은 업종 1곳');
  });
});

describe('섹션 부제와 요약', () => {
  it('부제는 "요청 많은 순 · 반경 라벨" 이다', () => {
    expect(buildSubtitle('3km 안')).toBe('요청 많은 순 · 3km 안');
    expect(buildSubtitle('기흥구 전체')).toBe('요청 많은 순 · 기흥구 전체');
  });

  it('반경 변경 요약을 만든다', () => {
    expect(buildRadiusSummary('3km 안', 3)).toBe('3km 안 동네 3곳 표시 중');
    expect(buildRadiusSummary('5km 안', 0)).toBe('5km 안 동네 0곳 표시 중');
  });
});

describe('RADIUS_OPTIONS', () => {
  it('칩 문구와 거리 값이 정해진 대로다("기흥구 전체"는 제한 없음)', () => {
    expect(RADIUS_OPTIONS.map((o) => [o.label, o.km])).toEqual([
      ['3km 안', 3],
      ['5km 안', 5],
      ['기흥구 전체', null],
    ]);
  });
});
