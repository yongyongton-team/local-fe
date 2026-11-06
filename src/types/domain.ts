/** 서비스 이용 역할. 접근 권한이 아니라 화면 구성을 고르는 선택값이다. */
export type UserRole = 'resident' | 'merchant' | 'founder';

/** 행정동 단위 동네. id 는 라우트의 :areaId 와 같다. */
export interface Neighborhood {
  id: string;
  /** 예: 기흥구 */
  district: string;
  /** 예: 구성동 */
  name: string;
}

/** 가게 업종. */
export interface StoreCategory {
  id: string;
  name: string;
}

/** 주민이 작성하는 가게 요청. 위치는 동 단위로만 가진다. */
export interface StoreRequest {
  id: string;
  neighborhoodId: string;
  categoryId: string;
  /** 주민이 자유롭게 적은 원하는 가게와 조건 */
  detail: string;
}

/** 동네·업종별 수요 수치. 수치는 구조화된 데이터가 기준이다. */
export interface DemandSummary {
  neighborhoodId: string;
  categoryId: string;
  /** 요청한 주민 수 */
  requestCount: number;
  /** 주변 같은 업종 가게 수 */
  nearbySameCategoryCount: number;
  /** 가장 가까운 대형마트까지의 거리(km) */
  nearestHypermarketKm: number;
}

/** 동네 리포트. 설명 문장은 포함하지 않는다(향후 AI 가 수치를 바탕으로 따로 작성). */
export interface NeighborhoodReport {
  neighborhood: Neighborhood;
  category: StoreCategory;
  demand: DemandSummary;
}
