import type {
  DemandSummary,
  MapMarkerKind,
  MapPosition,
  Neighborhood,
  StoreCategory,
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
  },
  {
    id: 'side-dish',
    name: '반찬',
    cardTitle: '반찬가게',
    requestLabel: '반찬',
    missingLabel: '반찬',
  },
  {
    id: 'bakery',
    name: '빵집',
    cardTitle: '빵집',
    requestLabel: '빵',
    missingLabel: '빵집',
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
  position: MapPosition;
}

/** Figma 지도 영역(402×288)의 좌상단 px 좌표를 0~1 상대좌표로 바꾼다. */
const at = (x: number, y: number): MapPosition => ({ x: x / 402, y: y / 288 });

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
  { neighborhoodId: 'guseong', kind: 'existing', position: at(262, 60) },
  { neighborhoodId: 'guseong', kind: 'existing', position: at(29, 148) },
  { neighborhoodId: 'guseong', kind: 'existing', position: at(234, 231) },

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
