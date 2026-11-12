import type { MapPosition, MerchantProfile } from '@/types/domain';

/*
 * 사장님 탐색 화면의 개발용 목 데이터. 실제 가게 정보나 통계가 아니다.
 * "[임의]" 로 표시한 값은 디자인이나 요구사항의 예시에서 가져온 개발용 값이다.
 */

/** [임의] 사장님 프로필. 출처는 디자인에서 알 수 없고 로그인·가게 등록이 없어 목으로 둔다. */
export const mockMerchantProfile: Omit<MerchantProfile, 'categoryName'> = {
  shopName: '싱싱과일',
  categoryId: 'fruit-vegetable',
  district: '기흥구',
  // [임의] 가게가 있는 동네(구성동). 서버에서는 GET /me 의 shop.dong 이다.
  dongId: 'guseong',
};

/** Figma 지도 영역(402×288)의 좌상단 px 좌표를 0~1 상대좌표로 바꾼다. */
const at = (x: number, y: number): MapPosition => ({ x: x / 402, y: y / 288 });

/** 지도 중심 핀(내 가게 위치). 핀 17×21 의 좌상단이 (192,133)이라 지도 정중앙에 놓인다. */
export const mockMerchantOrigin: { label: string; position: MapPosition } = {
  label: '내 가게 위치',
  position: at(192, 133),
};

/**
 * [임의] 내 가게(중심 핀)의 임시 위도·경도. 백엔드에서 가게 위치가 오면 그 값으로 교체한다.
 * 가게 프로필(mockMerchantProfile)이 기흥구이므로 기흥구 구성동 중심(mockNeighborhoodCenters 의 구성동, 37.2979·127.1054)에서
 * 동쪽으로 약 0.3km 떨어진 곳(탄천 동쪽, 구성역 부근)으로 잡았다. 구성동 중심에 가까워 구성동 안일 가능성이 높지만,
 * 행정구역 경계 데이터가 없어 이 좌표가 기흥구 안이라는 것은 코드로 검증하지 못한다. 실제 지도에서 직접 확인해야 한다.
 * 목록의 동네 거리와 반경 칩 필터는 이 좌표와 동네 중심 좌표의 직선거리(haversineKm)로 계산한다(지도의 원과 같은 기준).
 */
export const mockMerchantShopLocation = { lat: 37.2985, lng: 127.1085 } as const;

/**
 * 이 화면의 지도 마커 위치. 주민 탐색 화면과 위치가 달라 따로 둔다.
 * 문구와 인원은 구성동 수요 데이터에서 파생한다(Figma 의 라벨은 주민 탐색의 업종별 마커를 복제한 것으로 보인다).
 */
export const mockMerchantMarkerPlacements: readonly {
  neighborhoodId: string;
  categoryId: string;
  position: MapPosition;
}[] = [
  { neighborhoodId: 'guseong', categoryId: 'fruit-vegetable', position: at(26, 173) },
  { neighborhoodId: 'guseong', categoryId: 'side-dish', position: at(149, 47) },
  { neighborhoodId: 'guseong', categoryId: 'bakery', position: at(266, 182) },
];
