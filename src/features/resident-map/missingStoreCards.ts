import type { NeighborhoodReport } from '@/types/domain';

/**
 * "우리 동네에 없는 가게" 카드로 보여줄 업종을 고른다.
 * - 규칙(보조 문구 "걸어서 15분 안에 같은 업종 가게가 없어요 · 요청 많은 순"에서 추정):
 *   주변 같은 업종 가게가 0곳인 업종만, 요청 수 내림차순.
 * - 지도 필터와는 무관하다. 칩을 바꿔도 이 목록은 바뀌지 않는다.
 */
export function getMissingStoreCards(reports: readonly NeighborhoodReport[]): NeighborhoodReport[] {
  return reports
    .filter((report) => report.demand.nearbySameCategoryCount === 0)
    .sort((a, b) => b.demand.requestCount - a.demand.requestCount);
}
