import {
  mockCategories,
  mockDistrictBounds,
  mockNeighborhoodCenters,
  mockNeighborhoods,
} from '@/mocks/demand';
import { getDb } from '@/mocks/memoryDb';
import { mockAreaInsights } from '@/mocks/areaInsights';
import {
  mockMerchantMarkerPlacements,
  mockMerchantOrigin,
  mockMerchantProfile,
  mockMerchantShopLocation,
} from '@/mocks/merchant';
import type { AreaDemand, MapMarker } from '@/types/domain';
import { selectAreaDemands } from './areaDemand';
import { rankConditions, rankVisitTimes } from './areaDetail';
import { haversineKm } from './geo';
import { declutterOffsets, spreadAroundCenter } from './mapCoordinates';
import type { MerchantService } from './merchantService';

export const mockMerchantService: MerchantService = {
  remote: false,
  async getProfile() {
    const category = mockCategories.find((c) => c.id === mockMerchantProfile.categoryId);
    return { ...mockMerchantProfile, categoryName: category?.name ?? '' };
  },

  async listAreaDemands({ categoryId, radiusKm }) {
    // 인원과 근처 같은 업종 수는 주민 화면들과 같은 메모리 DB 의 수요 데이터를 읽는다.
    // 주민이 요청을 보내면 이 화면도 같은 값으로 갱신된다.
    // 거리는 가게 좌표와 동네 중심 좌표의 직선거리(Haversine)다. 목록 문구·반경 필터·지도 원이 같은 값을 쓴다.
    const areas: AreaDemand[] = [];
    for (const neighborhood of mockNeighborhoods) {
      const center = mockNeighborhoodCenters.find((c) => c.neighborhoodId === neighborhood.id);
      const demand = getDb().summaries.find(
        (s) => s.neighborhoodId === neighborhood.id && s.categoryId === categoryId,
      );
      const insight = mockAreaInsights.find((i) => i.neighborhoodId === neighborhood.id);
      // 가장 많은 시간대는 상세 화면과 같은 분포의 첫 항목이다(출처 하나).
      const [peak] = insight ? rankVisitTimes(insight.visitTimeRatios) : [];
      if (!center || !demand || !peak) continue;
      areas.push({
        neighborhood,
        requestCount: demand.requestCount,
        distanceKm: haversineKm(mockMerchantShopLocation, center),
        peakVisitTime: peak.time,
        nearbySameCategoryCount: demand.nearbySameCategoryCount,
      });
    }
    return selectAreaDemands(areas, radiusKm);
  },

  async getMapData() {
    const markers: MapMarker[] = [];
    // 같은 동의 마커 라벨이 지도에서 겹치지 않게 라벨의 픽셀 보정값을 만든다(좌표는 그대로).
    const offsets = declutterOffsets(mockMerchantMarkerPlacements.map((p) => p.position));
    for (const [index, placement] of mockMerchantMarkerPlacements.entries()) {
      const category = mockCategories.find((c) => c.id === placement.categoryId);
      const demand = getDb().summaries.find(
        (s) =>
          s.neighborhoodId === placement.neighborhoodId && s.categoryId === placement.categoryId,
      );
      if (!category || !demand) continue;
      // 실제 지도용 임시 위도·경도: 동네 중심에서 자리표시자의 상대좌표만큼 흩어 놓는다(백엔드 좌표로 교체 예정).
      const center = mockNeighborhoodCenters.find(
        (c) => c.neighborhoodId === placement.neighborhoodId,
      );
      markers.push({
        id: `merchant-${placement.neighborhoodId}-${placement.categoryId}`,
        kind: 'request',
        categoryId: placement.categoryId,
        label: `${category.requestLabel} 요청 ${demand.requestCount}`,
        position: placement.position,
        ...(center && spreadAroundCenter(center, placement.position)),
        ...(offsets[index] && { offset: offsets[index] }),
      });
    }
    // 가게 위치(중심 핀)는 임시 좌표다. 백엔드에서 가게 위치가 오면 교체한다.
    // "기흥구 전체"(반경 제한 없음)에 보여줄 범위: 가게가 있는 구(프로필의 district)를 대략 감싸는 사각형.
    const district = mockDistrictBounds.find((d) => d.district === mockMerchantProfile.district);
    return {
      markers,
      origin: {
        ...mockMerchantOrigin,
        ...mockMerchantShopLocation,
        ...(district && { areaBounds: district.bounds }),
      },
    };
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
