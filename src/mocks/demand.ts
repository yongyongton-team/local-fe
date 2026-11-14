import type {
  DemandSummary,
  GeoBounds,
  MapMarkerKind,
  MapPosition,
  ResidentOffer,
  Neighborhood,
  StoreCategory,
  StoreRequest,
} from '@/types/domain';

/*
 * 개발용 목 데이터. 실제로 검증된 통계가 아니다.
 * 이 데이터를 보여주는 화면에는 "예시 데이터" 표시를 둔다.
 * "[임의]" 로 표시한 값은 디자인이나 요구사항에 없어 개발용으로 임의로 정한 값이다.
 */

export const mockNeighborhoods: Neighborhood[] = [
  { id: 'guseong', district: '기흥구', name: '구성동' },
  { id: 'bojeong', district: '기흥구', name: '보정동' },
  { id: 'mabuk', district: '기흥구', name: '마북동' },
];

export const mockCategories: StoreCategory[] = [
  {
    id: 'fruit-vegetable',
    name: '과일·채소',
    cardTitle: '과일 / 채소 가게',
    requestLabel: '과일',
    missingLabel: '과일 / 채소',
    objectPhrase: '과일·채소 가게를',
    titleLabel: '과일 가게',
  },
  {
    id: 'side-dish',
    name: '반찬',
    cardTitle: '반찬가게',
    requestLabel: '반찬',
    missingLabel: '반찬',
    objectPhrase: '반찬 가게를',
    titleLabel: '반찬 가게',
  },
  {
    id: 'bakery',
    name: '빵집',
    cardTitle: '빵집',
    requestLabel: '빵',
    missingLabel: '빵집',
    objectPhrase: '빵집을',
    titleLabel: '빵집',
  },
];

export const mockDemandSummaries: DemandSummary[] = [
  {
    neighborhoodId: 'guseong',
    categoryId: 'fruit-vegetable',
    requestCount: 29,
    nearbySameCategoryCount: 0,
    nearestHypermarketKm: 2.4,
  },
  {
    neighborhoodId: 'guseong',
    categoryId: 'side-dish',
    // 디자인 불일치: 지도 마커는 "반찬 요청 29", 카드는 "12명". 카드 값(12)을 기준으로 한다.
    requestCount: 12,
    nearbySameCategoryCount: 0,
    // [임의] 반찬 카드의 우측 아이콘이 체크 배지 모양이라는 추정에서 "내가 요청함" 으로 둔다.
    requestedByMe: true,
  },
  {
    neighborhoodId: 'guseong',
    categoryId: 'bakery',
    requestCount: 6,
    nearbySameCategoryCount: 0,
  },
  {
    neighborhoodId: 'bojeong',
    categoryId: 'fruit-vegetable',
    requestCount: 14,
    nearbySameCategoryCount: 1,
    nearestHypermarketKm: 1.9,
  },
  {
    neighborhoodId: 'mabuk',
    categoryId: 'fruit-vegetable',
    requestCount: 9,
    nearbySameCategoryCount: 0,
    nearestHypermarketKm: 3.1,
  },
];

/**
 * 지도 마커의 위치. 문구와 수치는 수요 데이터에서 파생하고, 여기서는 위치만 정한다.
 * 위치는 지도 영역 대비 상대좌표이며 네이버 지도 연동 때 위경도로 교체한다.
 */
export interface MockMarkerPlacement {
  neighborhoodId: string;
  kind: MapMarkerKind;
  /** request / missing 마커는 업종이 필요하다. */
  categoryId?: string;
  /** existing(있는 가게) 마커의 가게 이름. 가게 정보 카드가 쓴다. */
  storeName?: string;
  position: MapPosition;
}

/**
 * [임의] 동네 중심 좌표(위도·경도, 용인시 기흥구). 정확한 값이 아니라 대략적인 값이다.
 * 백엔드 좌표가 연동되면 그 값으로 교체한다. 지도 마커는 이 중심에서 자리표시자의 상대좌표만큼 흩어 놓는다.
 */
export const mockNeighborhoodCenters: readonly {
  neighborhoodId: string;
  lat: number;
  lng: number;
}[] = [
  { neighborhoodId: 'guseong', lat: 37.2979, lng: 127.1054 },
  { neighborhoodId: 'bojeong', lat: 37.32, lng: 127.112 },
  { neighborhoodId: 'mabuk', lat: 37.3036, lng: 127.128 },
];

/**
 * [임의] 구(區)를 대략 감싸는 위경도 사각형. 행정구역 경계 데이터가 없어 대략적인 값이며,
 * 백엔드가 기흥구 동별 좌표(또는 경계)를 주면 그 값으로 교체한다.
 * 기흥구: 북쪽 보정동(죽전역 부근, 약 37.33°)부터 남쪽 고매동·농서동(약 37.21°)까지,
 * 서쪽 영덕동·서천동(약 127.055°)부터 동쪽 동백동·중동(약 127.17°)까지를 감싼다.
 * 실제 경계는 사각형이 아니므로 이 사각형에는 이웃 구(수지구·영통구·처인구·화성시)의 일부가 들어가고,
 * 기흥구의 튀어나온 가장자리는 1~2km 정도 빠질 수 있다. 코드로는 경계를 검증할 수 없다.
 */
export const mockDistrictBounds: readonly { district: string; bounds: GeoBounds }[] = [
  {
    district: '기흥구',
    bounds: { sw: { lat: 37.21, lng: 127.055 }, ne: { lat: 37.335, lng: 127.17 } },
  },
];

/** Figma 지도 영역(402×288)의 좌상단 px 좌표를 0~1 상대좌표로 바꾼다. */
const at = (x: number, y: number): MapPosition => ({ x: x / 402, y: y / 288 });

/**
 * [임의] 목 지도 응답의 gaps: 동네별로 "주민 요청이 있는데 그 동네에 같은 업종 가게가 없는" 업종 id.
 * 수요 데이터에서 요청이 있는 업종 중 여기에 없는 것이 "주민이 요청한 가게"가 된다.
 * 실제 서버처럼 구성동은 과일/채소만 gap 으로 두어 반찬·빵(요청만 있는 업종)이 그 목록에 나온다.
 * 지도 알약과 "우리 동네에 없는 가게" 카드는 Figma 그대로(구성동 세 업종 모두 없는 가게)라 이 값과 어긋난다. 목 데이터의 한계다.
 */
export const mockMapGapCategoryIds: Readonly<Record<string, readonly string[]>> = {
  guseong: ['fruit-vegetable'],
  bojeong: [],
  mabuk: ['fruit-vegetable'],
};

export const mockMarkerPlacements: MockMarkerPlacement[] = [
  // 구성동: Figma 에서 읽은 위치 (마커 크기는 요청 89×26 / 89×26 / 73×26, 없는 가게 89×26 / 59×26 / 59×26, 핀 17×21)
  {
    neighborhoodId: 'guseong',
    kind: 'request',
    categoryId: 'fruit-vegetable',
    position: at(35, 73),
  },
  { neighborhoodId: 'guseong', kind: 'request', categoryId: 'side-dish', position: at(221, 144) },
  { neighborhoodId: 'guseong', kind: 'request', categoryId: 'bakery', position: at(282, 207) },
  {
    neighborhoodId: 'guseong',
    kind: 'missing',
    categoryId: 'fruit-vegetable',
    position: at(162, 25),
  },
  { neighborhoodId: 'guseong', kind: 'missing', categoryId: 'side-dish', position: at(291, 93) },
  { neighborhoodId: 'guseong', kind: 'missing', categoryId: 'bakery', position: at(83, 187) },
  // [임의] 있는 가게 핀의 가게 이름. 실제 가게가 아닌 개발용 이름이다. 업종은 같은 동네의 "없는 가게" 업종과 겹치지 않게 비워 둔다.
  { neighborhoodId: 'guseong', kind: 'existing', storeName: '예시 가게 1', position: at(262, 60) },
  { neighborhoodId: 'guseong', kind: 'existing', storeName: '예시 가게 2', position: at(29, 148) },
  { neighborhoodId: 'guseong', kind: 'existing', storeName: '예시 가게 3', position: at(234, 231) },

  // [임의] 보정동·마북동 위치는 디자인에 없어 개발용으로 정한 값이다. 기존 요약값에 맞는 최소한의 마커만 둔다.
  // 보정동: 과일/채소 14명, 주변 같은 업종 1곳 → 요청 마커 1개 + 같은 업종의 있는 가게 핀 1개
  {
    neighborhoodId: 'bojeong',
    kind: 'request',
    categoryId: 'fruit-vegetable',
    position: at(60, 90),
  },
  {
    neighborhoodId: 'bojeong',
    kind: 'existing',
    categoryId: 'fruit-vegetable',
    storeName: '예시 청과',
    position: at(230, 140),
  },
  // 마북동: 과일/채소 9명, 주변 같은 업종 0곳 → 요청 마커 + 없는 가게 마커
  {
    neighborhoodId: 'mabuk',
    kind: 'request',
    categoryId: 'fruit-vegetable',
    position: at(110, 110),
  },
  {
    neighborhoodId: 'mabuk',
    kind: 'missing',
    categoryId: 'fruit-vegetable',
    position: at(200, 50),
  },
];

/**
 * 메모리 DB 에 들어 있는 요청 한 건. 사장님 제안(offers)은 목 시드로만 존재하고 최신순이다(서버 GET /me/requests 와 같다).
 * 내 요청 카드의 "사장님 응답" 한 줄은 이 제안 중 첫 OPEN·CONFIRMED 제안에서 만든다(mockMyRequestService).
 * 새로 보낸 요청에는 offers 가 없다.
 */
export interface MockStoredRequest {
  request: StoreRequest;
  offers?: ResidentOffer[];
}

/**
 * [임의] 처음부터 있는 "내가 보낸 요청". 개발용 값이다.
 * 구성동 반찬 요청 12명·"내가 요청함"(위 수요 데이터)과 일치하게 두었다.
 * 사장님 응답의 업체·수령 시각·장소도 개발용이다(Figma 예시는 과일/채소 카드의 "싱싱과일: 토요일 오전 10시, 구성동 주민센터 앞에서 방문 판매해요" 응답).
 */
export const mockSeedRequests: MockStoredRequest[] = [
  {
    request: {
      id: 'mock-request-seed-1',
      neighborhoodId: 'guseong',
      categoryId: 'side-dish',
      detail: '반찬가게가 생기면 좋겠어요.',
      conditions: [],
      visitTimes: ['weekday-evening'],
      visitFrequency: 'monthly',
    },
    offers: [
      // 카드의 "사장님 응답" 한 줄은 서버 순서의 첫 OPEN·CONFIRMED 제안(아래 첫 번째)이다.
      {
        id: 'mock-offer-seed-1',
        shopName: '맛나반찬',
        title: '[임의] 제철 반찬 꾸러미',
        price: 15000,
        // 2026-11-14 는 토요일이다.
        pickupAt: new Date('2026-11-14T10:00:00+09:00'),
        pickupPlace: '구성동 주민센터 앞',
        minOrders: 20,
        orderCount: 8,
        deadlineAt: new Date('2026-11-13T18:00:00+09:00'),
        status: 'OPEN',
        // 주문이 없는 모집 중 제안
        myOrder: null,
      },
      {
        id: 'mock-offer-seed-2',
        shopName: '푸른반찬',
        title: '[임의] 국·찌개 세트',
        price: 12000,
        pickupAt: new Date('2026-11-15T11:00:00+09:00'),
        pickupPlace: '구성동 놀이터 앞',
        minOrders: 10,
        orderCount: 12,
        deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
        // 최소 주문 수를 채운 제안 + 내가 예약한 주문
        status: 'CONFIRMED',
        myOrder: {
          id: 'mock-order-seed-1',
          offerId: 'mock-offer-seed-2',
          quantity: 2,
          status: 'RESERVED',
        },
      },
      {
        id: 'mock-offer-seed-3',
        shopName: '든든반찬',
        title: '[임의] 밑반찬 3종',
        price: 9000,
        pickupAt: new Date('2026-11-16T17:00:00+09:00'),
        pickupPlace: '구성동 버스정류장 앞',
        minOrders: 15,
        orderCount: 4,
        deadlineAt: new Date('2026-11-15T20:00:00+09:00'),
        // 모집 중 + 내가 예약한 주문(예약 취소를 해 볼 수 있다)
        status: 'OPEN',
        myOrder: {
          id: 'mock-order-seed-2',
          offerId: 'mock-offer-seed-3',
          quantity: 1,
          status: 'RESERVED',
        },
      },
      {
        id: 'mock-offer-seed-4',
        shopName: '손맛반찬',
        title: '[임의] 지난주 반찬 꾸러미',
        price: 14000,
        pickupAt: new Date('2026-11-08T10:00:00+09:00'),
        pickupPlace: '구성동 주민센터 앞',
        minOrders: 10,
        orderCount: 11,
        deadlineAt: new Date('2026-11-07T18:00:00+09:00'),
        // 수령이 끝난 제안 + 받아 간 내 주문
        status: 'DONE',
        myOrder: {
          id: 'mock-order-seed-3',
          offerId: 'mock-offer-seed-4',
          quantity: 1,
          status: 'PICKED_UP',
        },
      },
      {
        id: 'mock-offer-seed-5',
        shopName: '새벽반찬',
        title: '[임의] 제철 나물 세트',
        price: 11000,
        pickupAt: new Date('2026-11-12T09:00:00+09:00'),
        pickupPlace: '구성동 놀이터 앞',
        minOrders: 20,
        orderCount: 6,
        deadlineAt: new Date('2026-11-11T18:00:00+09:00'),
        // 마감됐지만 최소 인원을 채우지 못한 제안(주문 없음)
        status: 'CLOSED',
        myOrder: null,
      },
    ],
  },
];

/** [임의] 목 모드에서 "기준 인원에 도달했다"고 보는 요청 인원(시연: 구성동 과일 29명 → 30명). */
export const MOCK_GOAL_COUNT = 30;
/** [임의] 목 모드에서 기준 인원에 도달했을 때 "알린 사장님 수"로 돌려주는 값. */
export const MOCK_NOTIFIED_OWNER_COUNT = 1;
