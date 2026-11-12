import {
  mockCategories,
  mockMarkerPlacements,
  mockNeighborhoodCenters,
  mockNeighborhoods,
} from '@/mocks/demand';
import { getDb } from '@/mocks/memoryDb';
import type { MapMarker, MapPosition, NeighborhoodReport } from '@/types/domain';
import { DEFAULT_CATEGORY_ID, type DemandService } from './demandService';
import { spreadAroundCenter } from './mapCoordinates';

function buildReport(neighborhoodId: string, categoryId: string): NeighborhoodReport | null {
  const neighborhood = mockNeighborhoods.find((n) => n.id === neighborhoodId);
  const category = mockCategories.find((c) => c.id === categoryId);
  // 메모리 DB 의 수요 수치를 읽는다(제출하면 갱신된다). 복사해서 돌려줘 호출한 쪽이 DB 를 바꾸지 못하게 한다.
  const found = getDb().summaries.find(
    (d) => d.neighborhoodId === neighborhoodId && d.categoryId === categoryId,
  );
  return neighborhood && category && found
    ? { neighborhood, category, demand: { ...found } }
    : null;
}

/** 마커의 임시 위도·경도. 동네 중심이 없으면 좌표를 붙이지 않는다(자리표시자 지도만 그린다). */
function geoOf(neighborhoodId: string, position: MapPosition): { lat?: number; lng?: number } {
  const center = mockNeighborhoodCenters.find((c) => c.neighborhoodId === neighborhoodId);
  return center ? spreadAroundCenter(center, position) : {};
}

/** 위치(placement)에 수요 데이터를 합쳐 마커를 만든다. 조건에 맞지 않으면 null. */
function buildMarker(
  placement: (typeof mockMarkerPlacements)[number],
  index: number,
): MapMarker | null {
  const { neighborhoodId, kind, categoryId, position, storeName } = placement;
  const id = `${neighborhoodId}-${kind}-${categoryId ?? index}`;

  if (kind === 'existing') {
    return {
      id,
      kind,
      categoryId,
      label: '있는 가게 위치',
      ...(storeName !== undefined && { storeName }),
      position,
      ...geoOf(neighborhoodId, position),
    };
  }
  const report = categoryId ? buildReport(neighborhoodId, categoryId) : null;
  if (!report) return null;

  if (kind === 'request') {
    return {
      id,
      kind,
      categoryId,
      label: `${report.category.requestLabel} 요청 ${report.demand.requestCount}`,
      position,
      ...geoOf(neighborhoodId, position),
    };
  }
  // missing: 주변 같은 업종이 없을 때만 표시한다.
  if (report.demand.nearbySameCategoryCount > 0) return null;
  return {
    id,
    kind,
    categoryId,
    label: `X : ${report.category.missingLabel}`,
    position,
    ...geoOf(neighborhoodId, position),
  };
}

/** 네트워크 없이 목 데이터를 비동기로 돌려주는 구현. */
export const mockDemandService: DemandService = {
  async listNeighborhoods() {
    return mockNeighborhoods;
  },

  async listCategories() {
    return mockCategories;
  },

  async getDefaultCategoryId() {
    return DEFAULT_CATEGORY_ID;
  },

  async listReportsByNeighborhood(neighborhoodId) {
    return mockCategories
      .map((c) => buildReport(neighborhoodId, c.id))
      .filter((report): report is NeighborhoodReport => report !== null);
  },

  async listMapMarkers(neighborhoodId) {
    return mockMarkerPlacements
      .map((placement, index) => ({ placement, index }))
      .filter(({ placement }) => placement.neighborhoodId === neighborhoodId)
      .map(({ placement, index }) => buildMarker(placement, index))
      .filter((marker): marker is MapMarker => marker !== null);
  },
};
