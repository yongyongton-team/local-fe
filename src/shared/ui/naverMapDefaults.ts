/**
 * 네이버 지도의 기본 시점. 마커나 기준점이 없을 때의 중심(용인시 기흥구 부근)과 줌.
 * NaverMap(마커·원 지도)과 내 가게 위치 선택 지도가 같은 값을 쓴다.
 */
export const DEFAULT_CENTER = { lat: 37.3, lng: 127.115 } as const;
export const DEFAULT_ZOOM = 14;
