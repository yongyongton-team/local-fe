import type { MapPosition, MerchantProfile, VisitTime } from '@/types/domain';

/*
 * 사장님 탐색 화면의 개발용 목 데이터. 실제 가게 정보나 통계가 아니다.
 * "[임의]" 로 표시한 값은 디자인이나 요구사항의 예시에서 가져온 개발용 값이다.
 */

/** [임의] 사장님 프로필. 출처는 디자인에서 알 수 없고 로그인·가게 등록이 없어 목으로 둔다. */
export const mockMerchantProfile: Omit<MerchantProfile, 'categoryName'> = {
  shopName: '싱싱과일',
  categoryId: 'fruit-vegetable',
  district: '기흥구',
};

/** [임의] 내 가게로부터 동네까지의 거리와 요청이 가장 많은 시간대. 요청 인원은 수요 데이터에서 계산한다. */
export const mockAreaProfiles: readonly {
  neighborhoodId: string;
  distanceKm: number;
  peakVisitTime: VisitTime;
}[] = [
  { neighborhoodId: 'guseong', distanceKm: 1.8, peakVisitTime: 'weekday-evening' },
  { neighborhoodId: 'bojeong', distanceKm: 2.6, peakVisitTime: 'weekend' },
  { neighborhoodId: 'mabuk', distanceKm: 2.9, peakVisitTime: 'weekday-day' },
];

/** Figma 지도 영역(402×288)의 좌상단 px 좌표를 0~1 상대좌표로 바꾼다. */
const at = (x: number, y: number): MapPosition => ({ x: x / 402, y: y / 288 });

/** 지도 중심 핀(내 가게 위치). 핀 17×21 의 좌상단이 (192,133)이라 지도 정중앙에 놓인다. */
export const mockMerchantOrigin: { label: string; position: MapPosition } = {
  label: '내 가게 위치',
  position: at(192, 133),
};

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
