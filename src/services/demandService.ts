import type { Neighborhood, NeighborhoodReport } from '@/types/domain';

/**
 * 업종 선택 UI 가 확정되기 전까지 화면이 공통으로 쓰는 기본 업종.
 * (목 데이터의 과일·채소 업종 id 와 같다.)
 */
export const DEFAULT_CATEGORY_ID = 'fruit-vegetable';

/** 수요 데이터 접근 인터페이스. 실제 API 로 바꿀 때 이 인터페이스의 구현만 교체한다. */
export interface DemandService {
  listNeighborhoods(): Promise<Neighborhood[]>;
  /** 요청 많은 순으로 정렬된 동네별 리포트 */
  listReports(categoryId: string): Promise<NeighborhoodReport[]>;
  /** 존재하지 않는 동네·업종이면 null */
  getReport(neighborhoodId: string, categoryId: string): Promise<NeighborhoodReport | null>;
}
