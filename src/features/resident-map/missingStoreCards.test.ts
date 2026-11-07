import { describe, expect, it } from 'vitest';
import type { NeighborhoodReport } from '@/types/domain';
import { getMissingStoreCards } from './missingStoreCards';

function report(categoryId: string, requestCount: number, nearby: number): NeighborhoodReport {
  return {
    neighborhood: { id: 'n', district: 'd', name: 'n' },
    category: {
      id: categoryId,
      name: categoryId,
      cardTitle: categoryId,
      requestLabel: categoryId,
      missingLabel: categoryId,
      objectPhrase: categoryId,
    },
    demand: { neighborhoodId: 'n', categoryId, requestCount, nearbySameCategoryCount: nearby },
  };
}

const ids = (reports: NeighborhoodReport[]) => reports.map((r) => r.category.id);

describe('getMissingStoreCards', () => {
  it('요청 수 내림차순으로 정렬한다(입력 순서에 의존하지 않는다)', () => {
    const result = getMissingStoreCards([
      report('b', 12, 0),
      report('c', 6, 0),
      report('a', 29, 0),
    ]);

    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });

  it('주변 같은 업종 가게가 0곳인 업종만 남긴다', () => {
    const result = getMissingStoreCards([
      report('a', 29, 0),
      report('b', 50, 1),
      report('c', 6, 3),
    ]);

    expect(ids(result)).toEqual(['a']);
  });

  it('조건에 맞는 업종이 없으면 빈 배열이다', () => {
    expect(getMissingStoreCards([report('a', 14, 1)])).toEqual([]);
    expect(getMissingStoreCards([])).toEqual([]);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const input = [report('b', 12, 0), report('a', 29, 0)];
    getMissingStoreCards(input);

    expect(ids(input)).toEqual(['b', 'a']);
  });
});
