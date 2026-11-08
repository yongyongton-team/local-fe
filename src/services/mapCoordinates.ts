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

/** [임의] 라벨 간격을 풀 때 쓰는 기준 지도 크기(px). Figma 사장님 지도 영역 402×288 이다. */
const OFFSET_REFERENCE = { width: 402, height: 288 } as const;
/** [임의] 기준 크기에서 실제 픽셀 간격으로 줄이는 비율. 라벨(알약 약 85×26px)이 서로 겹치지 않도록 정했다. */
const OFFSET_SCALE = 0.45;

/**
 * 같은 동의 여러 마커 라벨이 지도에서 서로 덮이지 않도록 라벨의 화면 픽셀 보정값을 만든다.
 * 자리표시자 지도의 상대좌표 배치(겹치지 않게 잡은 모양)를 마커들의 평균 위치 기준으로 옮겨 그대로 쓴다.
 * 좌표(lat, lng)는 바꾸지 않는다. 마커가 하나면 보정이 없다(0, 0). 입력은 바꾸지 않는다.
 */
export function declutterOffsets(positions: readonly MapPosition[]): { x: number; y: number }[] {
  if (positions.length === 0) return [];
  const mean = {
    x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
    y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
  };
  return positions.map((p) => ({
    x: Math.round((p.x - mean.x) * OFFSET_REFERENCE.width * OFFSET_SCALE),
    y: Math.round((p.y - mean.y) * OFFSET_REFERENCE.height * OFFSET_SCALE),
  }));
}
