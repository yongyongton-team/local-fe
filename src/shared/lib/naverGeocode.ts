/*
 * 주소 → 좌표 검색(네이버 클라이언트 지오코더). 지도 스크립트를 submodules=geocoder 로 불러왔을 때만 쓸 수 있다
 * (useNaverMapScript). 클라이언트 지오코더는 Client ID 만 쓰고 Client Secret 은 쓰지 않는다.
 * 검색어와 결과 좌표는 기록하지 않는다.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** naver.maps.Service.Status.OK 의 값 */
const STATUS_OK = 200;

/**
 * 주소를 검색해 첫 결과의 좌표를 돌려준다. 결과가 없거나, 지오코더를 쓸 수 없거나(서브모듈 미로드·SDK 없음),
 * 호출이 실패하면 null 이다(화면은 "주소를 찾지 못했어요"로 같이 안내한다).
 */
export function geocodeAddress(query: string): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    const service = window.naver?.maps?.Service;
    if (!query.trim() || typeof service?.geocode !== 'function') {
      resolve(null);
      return;
    }
    try {
      service.geocode({ query: query.trim() }, (status, response) => {
        const first = status === STATUS_OK ? response?.v2?.addresses?.[0] : undefined;
        // x 가 경도, y 가 위도다(문자열).
        const lng = Number(first?.x);
        const lat = Number(first?.y);
        resolve(first && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null);
      });
    } catch {
      resolve(null);
    }
  });
}
