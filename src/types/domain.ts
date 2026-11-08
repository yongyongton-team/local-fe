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
  /** 문장에 쓰는 업종 표기. 조사까지 완성된 값이다(조사를 코드로 계산하지 않는다). 예: 과일·채소 가게를 */
  objectPhrase: string;
  /** 사장님 동네 상세 제목의 업종 표기. 예: 과일 가게, 빵집 ("{동네} / {titleLabel}") */
  titleLabel: string;
}

/** 방문하기 좋은 시간대. 여러 개를 고를 수 있다. */
export type VisitTime = 'weekday-day' | 'weekday-evening' | 'weekend';

/** 방문 빈도. 하나만 고른다. */
export type VisitFrequency = 'weekly' | 'monthly' | 'rarely';

/** 주민이 작성하는 가게 요청. 위치는 동 단위로만 가진다. */
export interface StoreRequest {
  id: string;
  /** 위치는 선택된 동네 id 만 저장한다. 현재 위치는 사용하지 않는다. */
  neighborhoodId: string;
  categoryId: string;
  /** 주민이 자유롭게 적은 원하는 가게와 조건(입력 문장) */
  detail: string;
  /** 문장에서 정리한 조건 목록. 예: 늦게까지 영업 */
  conditions: string[];
  /** 선택하지 않으면 빈 배열 */
  visitTimes: VisitTime[];
  /** 선택하지 않으면 없음 */
  visitFrequency?: VisitFrequency;
}

/** 제출할 요청. id 는 저장하는 쪽이 정한다. */
export type NewStoreRequest = Omit<StoreRequest, 'id'>;

/** 사장님이 주민 요청에 남긴 응답. 화면에는 "업체(지역): 메시지" 로 보여준다. */
export interface MerchantResponse {
  merchantName: string;
  areaName: string;
  message: string;
}

/** 내 요청 화면의 한 항목. 요청 인원은 수요 데이터에서 계산한 해당 동네·업종의 전체 요청 인원이다. */
export interface MyRequest {
  request: StoreRequest;
  neighborhood: Neighborhood;
  category: StoreCategory;
  requestCount: number;
  /** 사장님 응답이 없으면 없음 */
  response?: MerchantResponse;
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

/** 사장님 프로필. 로그인과 가게 등록이 없어 목 데이터로만 존재한다. */
export interface MerchantProfile {
  shopName: string;
  /** 사장님의 업종. "내 업종"은 이 업종이다. */
  categoryId: string;
  /** 화면에 보여줄 업종 이름. 예: 과일·채소 (서비스가 업종 데이터에서 채운다) */
  categoryName: string;
  /** 예: 기흥구 */
  district: string;
}

/** 사장님 탐색 화면의 동네 한 줄: 내 업종을 원하는 동네의 요청 현황. 개인 정보와 원문 문장은 담지 않는다. */
export interface AreaDemand {
  neighborhood: Neighborhood;
  /** 해당 동네에서 내 업종을 원하는 요청 인원(수요 데이터에서 계산) */
  requestCount: number;
  /** 내 가게로부터 동네까지의 거리(km) */
  distanceKm: number;
  /** 요청이 가장 많은 방문 시간대 */
  peakVisitTime: VisitTime;
  /** 근처 같은 업종 가게 수(수요 데이터) */
  nearbySameCategoryCount: number;
}

/**
 * 지도의 기준점(내 가게 위치)과 탐색 반경. 지도 위에서는 중심 핀과 점선 원으로 그린다.
 * 자리표시자 지도는 원 크기를 고정해서 그리지만, 반경 값(km)은 네이버 지도 연동 때 실제 반경으로 쓰도록 남겨 둔다.
 */
export interface MapOrigin {
  /** 보이지 않는 텍스트로 읽히는 이름. 예: 내 가게 위치 */
  label: string;
  /** 핀의 좌상단 위치(지도 영역 대비 상대좌표 0~1) */
  position: MapPosition;
  /** 탐색 반경(km). 제한이 없으면 null */
  radiusKm: number | null;
}

/** 동네 상세의 조건 한 줄: 그 조건을 원한 주민 수. 문장 원문은 담지 않는다. */
export interface AreaCondition {
  /** 예: 늦게까지 영업 */
  label: string;
  /** 해당 조건을 원한 주민 수 */
  count: number;
}

/** 동네 상세의 방문 시간대 한 줄. */
export interface AreaVisitTime {
  time: VisitTime;
  /** 전체 대비 비율(%). 시간대 비율의 합은 100 이다. */
  ratio: number;
}

/**
 * 사장님용 동네 수요 상세. 개인 정보와 원문 문장은 담지 않고 개수·비율만 담는다.
 * conditions 는 인원 내림차순, visitTimes 는 비율 내림차순이다(첫 항목이 가장 많은 시간대).
 */
export interface AreaDetail {
  neighborhood: Neighborhood;
  category: StoreCategory;
  /** 요청한 주민 수(수요 데이터) */
  requestCount: number;
  /** 근처 같은 업종 가게 수(수요 데이터) */
  nearbySameCategoryCount: number;
  conditions: AreaCondition[];
  visitTimes: AreaVisitTime[];
}

/**
 * 예비 창업자용 입지 순위의 한 줄: 선택한 업종에 대한 동네의 요청 현황. 개인 정보와 원문 문장은 담지 않는다.
 * position 은 동네의 지도상 위치(지금은 자리표시자 지도 대비 상대좌표)라 업종이 바뀌어도 같다.
 */
export interface LocationRank {
  /** 1부터 시작하는 순위 */
  rank: number;
  neighborhood: Neighborhood;
  /** 요청한 주민 수 */
  requestCount: number;
  /** 주변 같은 업종 가게 수 */
  nearbySameCategoryCount: number;
  /** 가장 가까운 대형마트까지의 거리(km). 값이 없으면 화면에 표시하지 않는다. */
  nearestHypermarketKm?: number;
  position: MapPosition;
}
