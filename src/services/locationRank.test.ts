import { describe, expect, it } from 'vitest';
import type { LocationRank } from '@/types/domain';
import { rankLocations } from './locationRank';

const item = (
  name: string,
  requestCount: number,
  nearbySameCategoryCount = 0,
): Omit<LocationRank, 'rank'> => ({
  neighborhood: { id: name, district: '기흥구', name },
  requestCount,
  nearbySameCategoryCount,
  position: { x: 0, y: 0 },
});

const names = (items: readonly LocationRank[]) => items.map((i) => [i.rank, i.neighborhood.name]);

describe('rankLocations', () => {
  it('요청 인원 내림차순으로 정렬하고 1부터 번호를 매긴다', () => {
    expect(
      names(rankLocations([item('마북동', 9), item('구성동', 29), item('보정동', 14)])),
    ).toEqual([
      [1, '구성동'],
      [2, '보정동'],
      [3, '마북동'],
    ]);
  });

  it('같은 업종 수는 점수에 섞지 않는다(보정동 14명·1곳이 마북동 9명·0곳보다 위)', () => {
    expect(names(rankLocations([item('마북동', 9, 0), item('보정동', 14, 1)]))).toEqual([
      [1, '보정동'],
      [2, '마북동'],
    ]);
  });

  it('인원이 같으면 같은 업종이 적은 순, 그다음 이름 순이다', () => {
    expect(
      names(rankLocations([item('다동', 5, 2), item('나동', 5, 0), item('가동', 5, 2)])),
    ).toEqual([
      [1, '나동'],
      [2, '가동'],
      [3, '다동'],
    ]);
  });

  it('입력을 바꾸지 않고 비어 있으면 빈 배열이다', () => {
    const input = [item('마북동', 9), item('구성동', 29)];
    rankLocations(input);

    expect(input.map((i) => i.neighborhood.name)).toEqual(['마북동', '구성동']);
    expect(rankLocations([])).toEqual([]);
  });
});
