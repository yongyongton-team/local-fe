import { mockCategories, mockNeighborhoods } from '@/mocks/demand';
import { getDb } from '@/mocks/memoryDb';
import { mockAreaInsights } from '@/mocks/areaInsights';
import {
  mockAreaProfiles,
  mockMerchantMarkerPlacements,
  mockMerchantOrigin,
  mockMerchantProfile,
} from '@/mocks/merchant';
import type { AreaDemand, MapMarker } from '@/types/domain';
import { selectAreaDemands } from './areaDemand';
import { rankConditions, rankVisitTimes } from './areaDetail';
import type { MerchantService } from './merchantService';

export const mockMerchantService: MerchantService = {
  async getProfile() {
    const category = mockCategories.find((c) => c.id === mockMerchantProfile.categoryId);
    return { ...mockMerchantProfile, categoryName: category?.name ?? '' };
  },

  async listAreaDemands({ categoryId, radiusKm }) {
    // 인원과 근처 같은 업종 수는 주민 화면들과 같은 메모리 DB 의 수요 데이터를 읽는다.
    // 주민이 요청을 보내면 이 화면도 같은 값으로 갱신된다.
    const areas: AreaDemand[] = [];
    for (const profile of mockAreaProfiles) {
      const neighborhood = mockNeighborhoods.find((n) => n.id === profile.neighborhoodId);
      const demand = getDb().summaries.find(
        (s) => s.neighborhoodId === profile.neighborhoodId && s.categoryId === categoryId,
      );
      const insight = mockAreaInsights.find((i) => i.neighborhoodId === profile.neighborhoodId);
      // 가장 많은 시간대는 상세 화면과 같은 분포의 첫 항목이다(출처 하나).
      const [peak] = insight ? rankVisitTimes(insight.visitTimeRatios) : [];
      if (!neighborhood || !demand || !peak) continue;
      areas.push({
        neighborhood,
        requestCount: demand.requestCount,
        distanceKm: profile.distanceKm,
        peakVisitTime: peak.time,
        nearbySameCategoryCount: demand.nearbySameCategoryCount,
      });
    }
    return selectAreaDemands(areas, radiusKm);
  },

  async getMapData() {
    const markers: MapMarker[] = [];
    for (const placement of mockMerchantMarkerPlacements) {
      const category = mockCategories.find((c) => c.id === placement.categoryId);
      const demand = getDb().summaries.find(
        (s) =>
          s.neighborhoodId === placement.neighborhoodId && s.categoryId === placement.categoryId,
      );
      if (!category || !demand) continue;
      markers.push({
        id: `merchant-${placement.neighborhoodId}-${placement.categoryId}`,
        kind: 'request',
        categoryId: placement.categoryId,
        label: `${category.requestLabel} 요청 ${demand.requestCount}`,
        position: placement.position,
      });
    }
    return { markers, origin: { ...mockMerchantOrigin } };
  },
  async getAreaDetail({ areaId, categoryId }) {
    const neighborhood = mockNeighborhoods.find((n) => n.id === areaId);
    const category = mockCategories.find((c) => c.id === categoryId);
    const insight = mockAreaInsights.find((i) => i.neighborhoodId === areaId);
    const demand = getDb().summaries.find(
      (s) => s.neighborhoodId === areaId && s.categoryId === categoryId,
    );
    if (!neighborhood || !category || !insight || !demand) return null;
    // 요청 인원·근처 업종 수는 주민 화면들과 같은 메모리 DB 에서 읽고,
    // 조건별 인원·시간대 비율은 정적 목이다.
    return {
      neighborhood,
      category,
      requestCount: demand.requestCount,
      nearbySameCategoryCount: demand.nearbySameCategoryCount,
      conditions: rankConditions(insight.conditions),
      visitTimes: rankVisitTimes(insight.visitTimeRatios),
    };
  },
};
