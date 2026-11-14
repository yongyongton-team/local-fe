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
  /**
   * 서버의 martCheck. 대형마트 거리 확인이 필요한 업종인지로 추정하지만 의미는 확정되지 않았다.
   * 지금은 화면 동작에 쓰지 않는다. 목 업종에는 없다.
   */
  martCheck?: boolean;
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

/**
 * 사장님이 주민 요청에 남긴 응답(제안). 화면에는 "가게: 요일 시각, 장소에서 방문 판매해요" 로 보여준다.
 * 서버가 주지 않았거나 올바르지 않은 값은 비워 둔다(지어내지 않는다).
 */
export interface MerchantResponse {
  merchantName: string;
  /** 수령(방문 판매) 시각. 없거나 날짜로 해석되지 않으면 없음 */
  pickupAt?: Date;
  /** 수령(방문 판매) 장소. 없으면 없음 */
  pickupPlace?: string;
}

/** 내 요청 화면의 한 항목. 요청 인원은 수요 데이터에서 계산한 해당 동네·업종의 전체 요청 인원이다. */
export interface MyRequest {
  request: StoreRequest;
  neighborhood: Neighborhood;
  category: StoreCategory;
  requestCount: number;
  /** 요청을 보낸 시각. 서버가 주지 않거나 올바르지 않으면 없음 */
  createdAt?: Date;
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

/**
 * 예비 창업자용 동네 리포트: 수치와 많이 원하는 시간대. 설명 문장은 포함하지 않는다(문장 생성 경계가 따로 만든다).
 * peakVisitTime 은 사장님 동네 상세와 같은 시간대 분포의 최상위다.
 */
export interface AreaReport extends NeighborhoodReport {
  /** 가장 많이 원하는 시간대. 요청이 없어 서버가 주지 않으면 없음 */
  peakVisitTime?: VisitTime;
  /** 서버가 쓴 설명 문장(API 모드). by 는 "AI", "TEMPLATE" 등 서버가 준 출처. 목 모드에는 없다(생성기가 쓴다). */
  explanation?: { text: string; by?: string };
  /** 서버가 준 근거 데이터(API 모드). asOf 는 기준일 문자열 그대로 */
  sources?: { name: string; asOf?: string }[];
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
  /** 표시 문구. 글자가 보이지 않는 마커(existing)에서는 보조 기술용 텍스트로 쓴다. 가게 이름이 아니다(storeName 을 쓴다). */
  label: string;
  /**
   * 가게(existing) 마커의 가게 이름. 누르면 보여주는 가게 정보 카드가 쓴다. 서버가 이름을 주지 않았거나 비어 있으면
   * 빈 문자열이거나 없다. 가게가 아닌 마커나 이름을 모르는 마커에는 없다.
   */
  storeName?: string;
  /** 자리표시자 지도(MapPlaceholder)가 쓰는 지도 영역 대비 상대좌표 */
  position: MapPosition;
  /**
   * 실제 지도(NaverMap)가 쓰는 위도·경도. 백엔드 좌표 연동 전에는 목 데이터의 임시 값이다.
   * 선택이라 없으면 자리표시자 지도만 이 마커를 그린다.
   */
  lat?: number;
  lng?: number;
  /**
   * 실제 지도에서 마커 라벨을 좌표에서 화면 픽셀만큼 옮겨 그리는 값(같은 동의 여러 마커 라벨이 겹쳐 읽히지 않을 때).
   * 좌표 자체는 그대로이고, 줌이 달라져도 라벨 간격이 유지된다. 선택이라 없으면 좌표에 그린다.
   */
  offset?: { x: number; y: number };
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
  /** 가게가 있는 동네 id. 서버가 주지 않으면 없다(제안 화면은 이때 동네를 알 수 없다). */
  dongId?: string;
}

/** 사장님 탐색 화면의 동네 한 줄: 내 업종을 원하는 동네의 요청 현황. 개인 정보와 원문 문장은 담지 않는다. */
export interface AreaDemand {
  neighborhood: Neighborhood;
  /** 해당 동네에서 내 업종을 원하는 요청 인원(수요 데이터에서 계산) */
  requestCount: number;
  /** 내 가게에서 동네 중심까지의 직선거리(km, 반올림하지 않은 값). 목록 문구·반경 필터·지도 원이 같은 기준을 쓴다. */
  distanceKm: number;
  /** 요청이 가장 많은 방문 시간대. 서버가 주지 않으면(요청 없음 등) 없음 */
  peakVisitTime?: VisitTime;
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
  /**
   * 실제 지도(NaverMap)가 쓰는 기준점의 위도·경도. 백엔드 가게 위치 연동 전에는 목 데이터의 임시 값이다.
   * 선택이라 없으면 자리표시자 지도만 이 기준점을 그린다.
   */
  lat?: number;
  lng?: number;
  /**
   * 반경 제한이 없을 때(radiusKm === null) 실제 지도에 보여줄 범위(남서·북동 모서리).
   * 예: "기흥구 전체" 칩에서 기흥구를 대략 감싸는 사각형. 없으면 핀과 마커 전체에 맞춘다.
   */
  areaBounds?: GeoBounds;
}

/** 위경도 사각형(남서·북동 모서리) */
export interface GeoBounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
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
  /** 서버가 쓴 한 줄 요약(API 모드). by 는 "AI" 등 서버가 준 출처. 목 모드에는 없다(생성기가 쓴다). */
  summary?: { text: string; by?: string };
}

/**
 * 예비 창업자용 입지 순위의 한 줄: 선택한 업종에 대한 동네의 요청 현황. 개인 정보와 원문 문장은 담지 않는다.
 * position 은 동네의 지도상 위치(지금은 자리표시자 지도 대비 상대좌표)라 업종이 바뀌어도 같다.
 */
/** 공공데이터 판정 값. 알려진 값 5가지에 문자열 폴백을 더해 서버가 새 값을 추가해도 깨지지 않게 한다. */
export type PublicDataVerdict =
  'SHORT' | 'SOME_NEARBY' | 'NEXT_DONG' | 'NOT_SHORT' | 'NOT_JUDGED' | (string & {});

/**
 * 순위 항목의 공공데이터 지표(인구 대비 기대 가게 수와 판정). 서버가 주지 않았거나 일부가 비면 그 필드만 없다.
 * 서버 값을 가공하지 않는다: expectedCount 는 소수 그대로이고(반올림은 표시 단계), verdictLabel 은 서버 문구다.
 */
export interface PublicData {
  population?: number;
  /** 인구로 기대하는 가게 수. 소수일 수 있다. */
  expectedCount?: number;
  /** 이 동의 실제 가게 수 */
  dongStoreCount?: number;
  verdict?: PublicDataVerdict;
  /** 서버가 쓴 판정 문구. 프론트에서 만들지 않는다. */
  verdictLabel?: string;
}

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
  /**
   * 자리표시자 지도(MapPlaceholder)가 쓰는 지도 영역 대비 상대좌표. 목 데이터에만 있다.
   * 백엔드 순위(GET /founder/rankings)에는 위치 정보가 없어 API 모드에서는 없다(만들어 넣지 않는다).
   */
  position?: MapPosition;
  /**
   * 실제 지도(NaverMap)가 쓰는 위도·경도. 동네에 속한 값이라 업종이 바뀌어도 같다.
   * 백엔드 순위에는 좌표가 없어 API 모드에서는 없고, 목 모드에서는 목 데이터의 동네 중심 좌표다.
   */
  lat?: number;
  lng?: number;
  /** 공공데이터 지표. 서버가 주지 않았거나 비어 있으면 없다. */
  publicData?: PublicData;
}

/**
 * 로그인한 사용자(GET /me). 서버 값을 화면용 도메인 값으로 바꾼 것이다.
 * 동네 id 는 서버의 숫자 id 그대로다(기존 Neighborhood.id 는 문자열 slug 라 다음 단계에서 맞춘다).
 */
export interface Me {
  id: number;
  nickname: string;
  /** 서버에 역할이 없거나 알 수 없는 값이면 null */
  role: UserRole | null;
  dong: { id: number; name: string; district: string } | null;
  /** 가게를 등록하지 않았으면 null */
  shop: MeShop | null;
}

/** 사장님 가게. 좌표나 id 가 응답에 없으면 그 필드만 비어 있다. */
export interface MeShop {
  shopName: string;
  categoryId?: number;
  categoryName: string;
  dongId?: number;
  dongName: string;
  lat?: number;
  lng?: number;
}

/** 서버 상태 확인 결과(GET /health). 값은 서버가 준 문자열만 담는다. */
export interface Health {
  details: Record<string, string>;
}

/** 제안 상태. 서버 명세 기준이며 모르는 값은 상태 없음으로 다룬다. */
export type OfferStatus = 'OPEN' | 'CONFIRMED' | 'CLOSED' | 'CANCELLED' | 'DONE';

/**
 * 사장님이 보낸 방문 판매 제안(GET /owner/offers 의 한 항목).
 * price·pickupAt 은 서버가 아직 주지 않을 수 있어 선택이다. 없으면 화면은 그 행만 그리지 않는다.
 */
export interface OwnerOffer {
  id: string;
  title: string;
  /** 모르는 상태이면 없다 */
  status?: OfferStatus;
  price?: number;
  /** 받는 날(수령 시각). 없거나 해석하지 못하면 없다 */
  pickupAt?: Date;
  /** 받는 곳. 비어 있으면 없다 */
  pickupPlace?: string;
  /** 제안한 동네 이름(서버 dong.name). 없으면 없다 */
  dongName?: string;
  /** 주문 마감. 없거나 해석하지 못하면 없다 */
  deadlineAt?: Date;
  /** 예약 수(서버는 취소를 뺀 주문 수량의 합계) */
  orderCount: number;
  /** 확정에 필요한 최소 주문 수 */
  minOrders: number;
}

/** 보낼 제안(POST /offers). 동네·업종은 호출하는 쪽이 정한다. 날짜는 시각이 있는 Date 다. */
export interface NewOffer {
  neighborhoodId: string;
  categoryId: string;
  title: string;
  /** 비면 없다 */
  description?: string;
  price: number;
  minOrders: number;
  pickupAt: Date;
  pickupPlace: string;
  deadlineAt: Date;
}

/** 제안을 보낸 결과. 알림을 받은 주민 수는 서버가 준 값이 올바를 때만 있다. */
export interface OfferSent {
  notifiedResidentCount?: number;
}

/** 주민 지도 화면의 "주민이 요청한 가게": 주민 요청이 있는데 그 동네의 "없는 가게"(gaps)에는 없는 업종. */
export interface RequestedStore {
  category: StoreCategory;
  /** 서버(목)가 준 요청 인원. 화면에서 임의로 더하지 않는다. */
  requestCount: number;
}

/** 동네 지도 한 번의 응답에서 만드는 화면 데이터: 지도 마커와 "주민이 요청한 가게". */
export interface MapOverview {
  markers: MapMarker[];
  /** 요청 많은 순 */
  requestedStores: RequestedStore[];
}
