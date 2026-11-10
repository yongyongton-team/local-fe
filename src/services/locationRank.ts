import type { LocationRank } from '@/types/domain';

/**
 * 동네를 입지 순위로 정렬하고 1부터 번호를 매긴다.
 * - 요청 인원이 많은 순. 같은 업종 수는 점수에 섞지 않는다.
 * - 인원이 같으면 같은 업종 가게가 적은 순, 그다음 이름 순. [임의]
 * 서비스 구현과 테스트가 함께 쓰는 순수 함수다. 입력 배열과 항목은 바꾸지 않는다.
 */
export function rankLocations(items: readonly Omit<LocationRank, 'rank'>[]): LocationRank[] {
  return [...items]
    .sort(
      (a, b) =>
        b.requestCount - a.requestCount ||
        a.nearbySameCategoryCount - b.nearbySameCategoryCount ||
        a.neighborhood.name.localeCompare(b.neighborhood.name, 'ko'),
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
