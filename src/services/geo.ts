/** 지구 평균 반지름(km) */
const EARTH_RADIUS_KM = 6371.0088;

interface LatLng {
  lat: number;
  lng: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 지점의 직선(대원) 거리(km). Haversine 공식. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * 중심에서 반경(km)의 원을 감싸는 남서·북동 모서리(근사). 위도 1° ≈ 111.32km, 경도 1° 는 위도에 따라 줄어든다.
 * 화면 시점을 원에 맞출 때 쓴다. 입력을 바꾸지 않는다.
 */
export function circleBounds(center: LatLng, radiusKm: number): { sw: LatLng; ne: LatLng } {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos(toRad(center.lat)));
  return {
    sw: { lat: center.lat - dLat, lng: center.lng - dLng },
    ne: { lat: center.lat + dLat, lng: center.lng + dLng },
  };
}
