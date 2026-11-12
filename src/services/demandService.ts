import type { MapMarker, Neighborhood, NeighborhoodReport, StoreCategory } from '@/types/domain';

/**
 * 업종 선택 UI 가 확정되기 전까지 화면이 공통으로 쓰는 기본 업종.
 * (목 데이터의 과일·채소 업종 id 와 같다.)
 */
export const DEFAULT_CATEGORY_ID = 'fruit-vegetable';

/** 수요 데이터 접근 인터페이스. 실제 API 로 바꿀 때 이 인터페이스의 구현만 교체한다. */
export interface DemandService {
  listNeighborhoods(): Promise<Neighborhood[]>;
  /** 선택할 수 있는 업종 전체 */
  listCategories(): Promise<StoreCategory[]>;
  /** 화면이 공통으로 쓰는 기본 업종의 id. 목은 DEFAULT_CATEGORY_ID, API 는 code FRUIT_VEG(없으면 첫 업종) */
  getDefaultCategoryId(): Promise<string>;
  /** 한 동네의 업종별 리포트. 정렬·필터는 호출하는 쪽의 규칙이다. 없는 동네면 빈 배열 */
  listReportsByNeighborhood(
    neighborhoodId: string,
    signal?: AbortSignal,
  ): Promise<NeighborhoodReport[]>;
  /** 한 동네의 지도 마커. 문구는 수요 데이터에서 파생한다. 없는 동네면 빈 배열 */
  listMapMarkers(neighborhoodId: string, signal?: AbortSignal): Promise<MapMarker[]>;
}
