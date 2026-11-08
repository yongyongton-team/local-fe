import type { MapPosition } from '@/types/domain';

/**
 * [임의] 동네 중심에서 마커를 흩어 놓는 범위(도). 같은 동의 여러 업종 마커가 겹치지 않고 서로 읽히도록
 * 자리표시자 지도의 상대좌표(0~1)를 이 범위의 오프셋으로 바꾼다. 위도 0.0079° ≈ 880m, 경도 0.0107° ≈ 950m.
 * 실제 지도에서 마커 전체를 화면에 맞추면(fitBounds) 알약(고정 크기)이 서로 덮이지 않도록 실제 지도로 확인해 정한 값이다.
 * 백엔드가 마커마다 실제 좌표를 주면 이 변환은 필요 없다.
 */
export const GEO_SPREAD = { lat: 0.0079, lng: 0.0107 } as const;

/**
 * 동네 중심(lat, lng)에 상대좌표(position)를 더해 임시 위도·경도를 만든다.
 * 상대좌표 (0.5, 0.5)가 중심이고, 화면의 위쪽(y 가 작음)이 북쪽이다.
 * 순수 함수라 입력을 바꾸지 않는다.
 */
export function spreadAroundCenter(
  center: { lat: number; lng: number },
  position: MapPosition,
): { lat: number; lng: number } {
  return {
    lat: center.lat - (position.y - 0.5) * GEO_SPREAD.lat,
    lng: center.lng + (position.x - 0.5) * GEO_SPREAD.lng,
  };
}
