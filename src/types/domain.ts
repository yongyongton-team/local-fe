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
  /*
   * 화면마다 표기가 조금씩 달라(예: 카드 "반찬가게", 마커 "X : 반찬", "빵 요청") 표기용 필드를 둔다.
   */
  /** 요청 카드 제목. 예: 과일 / 채소 가게 */
  cardTitle: string;
  /** "요청" 마커의 업종 표기. 예: 과일 → "과일 요청 29" */
  requestLabel: string;
  /** "없는 가게" 마커의 업종 표기. 예: 과일 / 채소 → "X : 과일 / 채소" */
  missingLabel: string;
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
  /** 가장 가까운 대형마트까지의 거리(km). 값이 없으면 화면에 표시하지 않는다. */
  nearestHypermarketKm?: number;
  /** 내가 이미 요청했는지. 요청자 정보가 아직 없어 목 데이터에서만 쓰는 값이다. */
  requestedByMe?: boolean;
}

/** 동네 리포트. 설명 문장은 포함하지 않는다(향후 AI 가 수치를 바탕으로 따로 작성). */
export interface NeighborhoodReport {
  neighborhood: Neighborhood;
  category: StoreCategory;
  demand: DemandSummary;
}

/** 지도 마커 종류. request: 주민 요청, missing: 없는 가게, existing: 있는 가게 */
export type MapMarkerKind = 'request' | 'missing' | 'existing';

/**
 * 지도 영역 대비 상대좌표(0~1). 마커의 좌상단 기준이다.
 * 지금은 자리표시자 지도 위의 상대좌표이고, 네이버 지도 연동 때 위경도로 교체할 예정이다.
 */
export interface MapPosition {
  x: number;
  y: number;
}

/** 지도에 표시하는 마커. 표시 여부는 필터가 정하고 위치는 바꾸지 않는다. */
export interface MapMarker {
  id: string;
  kind: MapMarkerKind;
  /** 업종이 있는 마커만 가진다. */
  categoryId?: string;
  /** 표시 문구. 글자가 보이지 않는 마커(existing)에서는 보조 기술용 텍스트로 쓴다. */
  label: string;
  position: MapPosition;
}
