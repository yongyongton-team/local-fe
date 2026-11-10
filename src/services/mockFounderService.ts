import { mockAreaInsights } from '@/mocks/areaInsights';
import { mockCategories, mockNeighborhoodCenters, mockNeighborhoods } from '@/mocks/demand';
import { mockFounderMapPositions } from '@/mocks/founder';
import { getDb } from '@/mocks/memoryDb';
import type { LocationRank } from '@/types/domain';
import type { FounderService } from './founderService';
import { rankVisitTimes } from './areaDetail';
import { rankLocations } from './locationRank';

export const mockFounderService: FounderService = {
  remote: false,
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
      // [임의] 동네당 마커가 하나라 흩뿌리지 않고 동네 중심 좌표를 그대로 쓴다. 백엔드가 좌표를 주면 그 값으로 교체한다.
      const center = mockNeighborhoodCenters.find((c) => c.neighborhoodId === neighborhood.id);
      items.push({
        neighborhood,
        requestCount: demand.requestCount,
        nearbySameCategoryCount: demand.nearbySameCategoryCount,
        ...(demand.nearestHypermarketKm !== undefined && {
          nearestHypermarketKm: demand.nearestHypermarketKm,
        }),
        position: { ...placement.position },
        ...(center && { lat: center.lat, lng: center.lng }),
      });
    }
    return rankLocations(items);
  },
  async getAreaReport({ areaId, categoryId }) {
    const neighborhood = mockNeighborhoods.find((n) => n.id === areaId);
    const category = mockCategories.find((c) => c.id === categoryId);
    const demand = getDb().summaries.find(
      (s) => s.neighborhoodId === areaId && s.categoryId === categoryId,
    );
    const insight = mockAreaInsights.find((i) => i.neighborhoodId === areaId);
    // 가장 많은 시간대는 사장님 동네 상세와 같은 분포(mocks/areaInsights)의 첫 항목이다.
    const [peak] = insight ? rankVisitTimes(insight.visitTimeRatios) : [];
    if (!neighborhood || !category || !demand || !peak) return null;
    // 수요 수치는 복사해서 돌려줘 호출한 쪽이 메모리 DB 를 바꾸지 못하게 한다.
    return { neighborhood, category, demand: { ...demand }, peakVisitTime: peak.time };
  },
};
