import { mockNeighborhoods } from '@/mocks/demand';
import { mockFounderMapPositions } from '@/mocks/founder';
import { getDb } from '@/mocks/memoryDb';
import type { LocationRank } from '@/types/domain';
import type { FounderService } from './founderService';
import { rankLocations } from './locationRank';

export const mockFounderService: FounderService = {
  async listLocationRanks(categoryId) {
    // 인원·같은 업종 수·대형마트 거리는 주민 화면들과 같은 메모리 DB 의 수요 데이터를 읽는다.
    // 주민이 요청을 보내면 이 화면도 같은 값과 순위로 갱신된다.
    const items: Omit<LocationRank, 'rank'>[] = [];
    for (const neighborhood of mockNeighborhoods) {
      const demand = getDb().summaries.find(
        (s) => s.neighborhoodId === neighborhood.id && s.categoryId === categoryId,
      );
      const placement = mockFounderMapPositions.find((p) => p.neighborhoodId === neighborhood.id);
      if (!demand || !placement) continue;
      items.push({
        neighborhood,
        requestCount: demand.requestCount,
        nearbySameCategoryCount: demand.nearbySameCategoryCount,
        ...(demand.nearestHypermarketKm !== undefined && {
          nearestHypermarketKm: demand.nearestHypermarketKm,
        }),
        position: { ...placement.position },
      });
    }
    return rankLocations(items);
  },
};
