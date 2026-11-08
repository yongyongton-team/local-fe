import { describe, expect, it } from 'vitest';
import type { AreaDemand } from '@/types/domain';
import { selectAreaDemands } from './areaDemand';

/** 테스트용 데이터: 실제 목 데이터에는 동네를 더 추가하지 않고 필터링만 이 데이터로 검증한다. */
function area(name: string, requestCount: number, distanceKm: number): AreaDemand {
  return {
    neighborhood: { id: name, district: '기흥구', name },
    requestCount,
    distanceKm,
    peakVisitTime: 'weekend',
    nearbySameCategoryCount: 0,
  };
}

const names = (areas: AreaDemand[]) => areas.map((a) => a.neighborhood.name);

describe('selectAreaDemands', () => {
  const AREAS = [
    area('가까운동', 5, 0.9),
    area('경계동', 20, 3),
    area('조금먼동', 30, 3.01),
    area('중간동', 12, 4.9),
    area('먼동', 40, 8.5),
  ];

  it('요청 인원 내림차순으로 정렬한다(입력 순서에 의존하지 않는다)', () => {
    expect(names(selectAreaDemands(AREAS, null))).toEqual([
      '먼동',
      '조금먼동',
      '경계동',
      '중간동',
      '가까운동',
    ]);
  });

  it('반경 이하(경계 포함)인 동네만 남긴다: 3km 이면 3.0 은 포함, 3.01 은 제외', () => {
    expect(names(selectAreaDemands(AREAS, 3))).toEqual(['경계동', '가까운동']);
  });

  it('5km 이면 4.9km 까지 포함하고 8.5km 는 제외한다', () => {
    expect(names(selectAreaDemands(AREAS, 5))).toEqual([
      '조금먼동',
      '경계동',
      '중간동',
      '가까운동',
    ]);
  });

  it('반경이 null 이면("기흥구 전체") 거리 제한이 없다', () => {
    expect(selectAreaDemands(AREAS, null)).toHaveLength(5);
  });

  it('반경 안에 동네가 없으면 빈 배열이다', () => {
    expect(selectAreaDemands(AREAS, 0.5)).toEqual([]);
    expect(selectAreaDemands([], 3)).toEqual([]);
  });

  it('인원이 같으면 가까운 동네가 앞에 온다', () => {
    const result = selectAreaDemands([area('먼동', 10, 2.5), area('가까운동', 10, 1.2)], null);

    expect(names(result)).toEqual(['가까운동', '먼동']);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const input = [area('b', 1, 1), area('a', 9, 1)];
    selectAreaDemands(input, null);

    expect(names(input)).toEqual(['b', 'a']);
  });
});
